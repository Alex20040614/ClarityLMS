import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase.js";

const ZOOM_CLIENT_ID = import.meta.env.VITE_ZOOM_CLIENT_ID;
const ZOOM_REDIRECT_URI = import.meta.env.VITE_ZOOM_REDIRECT_URI;

export const isZoomConfigured = Boolean(ZOOM_CLIENT_ID && ZOOM_REDIRECT_URI);

// Sends the tutor to Zoom's consent screen. `state` carries their uid so the OAuth callback
// (a Cloud Function, since it needs the client secret) knows whose account to link.
export function getZoomConnectUrl(tutorUid) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: ZOOM_CLIENT_ID,
    redirect_uri: ZOOM_REDIRECT_URI,
    state: tutorUid,
  });
  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

export async function createZoomMeetingForClass(classId) {
  const fn = httpsCallable(functions, "createZoomMeetingForClass");
  const result = await fn({ classId });
  return result.data;
}

export async function disconnectZoomAccount() {
  const fn = httpsCallable(functions, "disconnectZoomAccount");
  await fn();
}
