import React, { useState } from "react";
import { Icon } from "../../components/Common.jsx";

export default function ChooseRole({ auth }) {
  const [name, setName] = useState(auth.user?.displayName || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function choose(role) {
    if (!name.trim()) {
      setError("Please enter the name you'd like to show on the platform.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      await auth.completeRoleChoice(role, name);
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="card auth-card fade-up">
        <div className="auth-logo-row">
          <div className="logo-mark">C</div>
          <div className="logo-word">Clarity</div>
        </div>
        <h1 className="auth-title">Set up your profile</h1>
        <p className="auth-sub">Tell us your name and whether you're a student or a tutor.</p>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-field">
          <label htmlFor="profile-name">Your name</label>
          <input
            id="profile-name"
            type="text"
            placeholder="e.g. Alex Rivera"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            autoFocus
          />
          <span className="auth-field-hint">This is how you'll appear to others on the platform.</span>
        </div>

        <div className="auth-field-label-row" style={{ marginBottom: 8 }}>
          <label>I am a…</label>
        </div>
        <div className="role-pick-row">
          <button type="button" className="role-pick-card" disabled={busy} onClick={() => choose("student")}>
            <div className="role-pick-icon">
              <Icon name="school" />
            </div>
            <span className="role-pick-label">Student</span>
          </button>
          <button type="button" className="role-pick-card" disabled={busy} onClick={() => choose("tutor")}>
            <div className="role-pick-icon">
              <Icon name="cast_for_education" />
            </div>
            <span className="role-pick-label">Tutor</span>
          </button>
        </div>
        <p className="auth-sub" style={{ marginTop: 14, marginBottom: 0, fontSize: 12 }}>
          Your role can't be changed later.
        </p>
      </div>
    </div>
  );
}
