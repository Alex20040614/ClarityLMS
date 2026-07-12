import React, { useState } from "react";
import { Icon } from "../components/Common.jsx";
import { getZoomConnectUrl, disconnectZoomAccount, isZoomConfigured } from "../services/zoom.js";

export default function Settings({ profile, onProfileChange }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connected = Boolean(profile.zoomConnected);

  async function handleDisconnect() {
    setError("");
    setBusy(true);
    try {
      await disconnectZoomAccount();
      await onProfileChange();
    } catch (err) {
      setError(err.message || "Couldn't disconnect. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content-inner narrow">
      <div className="card fade-up" style={{ padding: 20 }}>
        <div className="card-header" style={{ padding: 0, border: "none", marginBottom: 12 }}>
          <div className="card-title">Zoom</div>
        </div>

        {!isZoomConfigured ? (
          <p className="sched-hint" style={{ margin: 0 }}>
            Zoom isn't configured yet — add the Zoom app keys to <code>.env</code> to enable this.
          </p>
        ) : connected ? (
          <>
            <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "0 0 14px 0" }}>
              Connected as <strong>{profile.zoomEmail}</strong>. Every class you schedule will
              automatically get a matching Zoom meeting.
            </p>
            {error && <div className="auth-error">{error}</div>}
            <button type="button" className="btn-danger" onClick={handleDisconnect} disabled={busy}>
              Disconnect Zoom
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 13.5, color: "var(--text-2)", margin: "0 0 14px 0" }}>
              Connect your Zoom account so classes you schedule automatically get a matching Zoom
              meeting, with Join/Start links your students can use right from Clarity.
            </p>
            <a className="btn btn-primary" href={getZoomConnectUrl(profile.uid)}>
              <Icon name="link" /> Connect Zoom account
            </a>
          </>
        )}
      </div>
    </div>
  );
}
