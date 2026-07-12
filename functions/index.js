const { onRequest, onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();
const db = admin.firestore();

const ZOOM_CLIENT_ID = defineSecret("ZOOM_CLIENT_ID");
const ZOOM_CLIENT_SECRET = defineSecret("ZOOM_CLIENT_SECRET");
const ZOOM_TOKEN_ENC_KEY = defineSecret("ZOOM_TOKEN_ENC_KEY");

// Zoom access/refresh tokens are bearer credentials for a tutor's Zoom account, so they're encrypted
// at the application layer (on top of Firestore's own default at-rest encryption and the security
// rules that already block all client-side reads/writes of this collection) before being stored.
// AES-256-GCM: random IV per value, auth tag guards against tampering, key lives only in Secret Manager.
function encryptToken(plaintext) {
  const key = Buffer.from(ZOOM_TOKEN_ENC_KEY.value(), "base64");
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

function decryptToken(encoded) {
  const [ivB64, authTagB64, ciphertextB64] = encoded.split(".");
  const key = Buffer.from(ZOOM_TOKEN_ENC_KEY.value(), "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(authTagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextB64, "base64")), decipher.final()]).toString("utf8");
}

const PROJECT_ID = "parabola-6a220";
const REGION = "us-central1";
const REDIRECT_URI = `https://${REGION}-${PROJECT_ID}.cloudfunctions.net/zoomOAuthCallback`;

// Where to send the browser back to once the OAuth handshake finishes.
const APP_BASE_URL = "https://parabola-6a220.web.app";

function zoomBasicAuthHeader() {
  return "Basic " + Buffer.from(`${ZOOM_CLIENT_ID.value()}:${ZOOM_CLIENT_SECRET.value()}`).toString("base64");
}

async function exchangeZoomCode(code) {
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });
  const res = await fetch(`https://zoom.us/oauth/token?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: zoomBasicAuthHeader() },
  });
  if (!res.ok) throw new Error(`Zoom token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function refreshZoomToken(refreshToken) {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
  const res = await fetch(`https://zoom.us/oauth/token?${params.toString()}`, {
    method: "POST",
    headers: { Authorization: zoomBasicAuthHeader() },
  });
  if (!res.ok) throw new Error(`Zoom token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Browser lands here after the tutor approves (or denies) access on Zoom's consent screen.
// `state` carries the tutor's uid — set when the client builds the authorize URL.
exports.zoomOAuthCallback = onRequest(
  { secrets: [ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_TOKEN_ENC_KEY] },
  async (req, res) => {
  const { code, state: tutorUid, error } = req.query;

  if (error || !code || !tutorUid) {
    res.redirect(`${APP_BASE_URL}/?zoom=error`);
    return;
  }

  try {
    const tokens = await exchangeZoomCode(code);

    const meRes = await fetch("https://api.zoom.us/v2/users/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = meRes.ok ? await meRes.json() : {};

    await db
      .collection("zoomConnections")
      .doc(tutorUid)
      .set({
        accessToken: encryptToken(tokens.access_token),
        refreshToken: encryptToken(tokens.refresh_token),
        expiresAt: Date.now() + tokens.expires_in * 1000,
        zoomEmail: me.email || null,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    await db
      .collection("users")
      .doc(tutorUid)
      .set({ zoomConnected: true, zoomEmail: me.email || null }, { merge: true });

    res.redirect(`${APP_BASE_URL}/?zoom=connected`);
  } catch (err) {
    logger.error("zoomOAuthCallback failed", err);
    res.redirect(`${APP_BASE_URL}/?zoom=error`);
  }
});

exports.disconnectZoomAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  await db.collection("zoomConnections").doc(uid).delete();
  await db.collection("users").doc(uid).set({ zoomConnected: false, zoomEmail: null }, { merge: true });
  return { ok: true };
});

// Called right after a class is created. Best-effort: if the tutor hasn't connected Zoom, or the
// Zoom API call fails, this returns a reason instead of throwing — the class itself already
// exists and shouldn't be rolled back just because the Zoom meeting couldn't be created.
exports.createZoomMeetingForClass = onCall(
  { secrets: [ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_TOKEN_ENC_KEY] },
  async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const { classId } = request.data || {};
  if (!classId) throw new HttpsError("invalid-argument", "classId is required.");

  const classRef = db.collection("classes").doc(classId);
  const classSnap = await classRef.get();
  if (!classSnap.exists) throw new HttpsError("not-found", "Class not found.");
  const classData = classSnap.data();

  if (classData.tutorUid !== request.auth.uid) {
    throw new HttpsError("permission-denied", "Only the tutor who owns this class can do this.");
  }

  const connRef = db.collection("zoomConnections").doc(request.auth.uid);
  const connSnap = await connRef.get();
  if (!connSnap.exists) {
    return { ok: false, reason: "not-connected" };
  }
  let conn = connSnap.data();
  let accessToken = decryptToken(conn.accessToken);

  try {
    if (Date.now() > conn.expiresAt - 60_000) {
      const refreshed = await refreshZoomToken(decryptToken(conn.refreshToken));
      accessToken = refreshed.access_token;
      conn = {
        ...conn,
        accessToken: encryptToken(refreshed.access_token),
        refreshToken: encryptToken(refreshed.refresh_token),
        expiresAt: Date.now() + refreshed.expires_in * 1000,
      };
      await connRef.set(conn, { merge: true });
    }

    const startAt = classData.startAt || new Date(`${classData.date}T${classData.time}`).getTime();
    const meetingRes = await fetch("https://api.zoom.us/v2/users/me/meetings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        topic: classData.title,
        type: 2,
        start_time: new Date(startAt).toISOString(),
        duration: Number(classData.duration) || 60,
        timezone: "UTC",
        settings: { join_before_host: true, waiting_room: false },
      }),
    });

    if (!meetingRes.ok) {
      logger.error("Zoom meeting creation failed", await meetingRes.text());
      return { ok: false, reason: "zoom-api-error" };
    }
    const meeting = await meetingRes.json();

    await classRef.update({
      zoomMeetingId: meeting.id,
      zoomJoinUrl: meeting.join_url,
      zoomStartUrl: meeting.start_url,
    });

    return { ok: true, joinUrl: meeting.join_url };
  } catch (err) {
    logger.error("createZoomMeetingForClass failed", err);
    return { ok: false, reason: "unexpected-error" };
  }
});
