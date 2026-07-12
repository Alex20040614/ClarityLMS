import React, { useState } from "react";
import { Icon } from "../../components/Common.jsx";

export default function ChooseRole({ auth }) {
  const [busy, setBusy] = useState(false);

  async function choose(role) {
    setBusy(true);
    try {
      await auth.completeRoleChoice(role);
    } finally {
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
        <h1 className="auth-title">One quick thing</h1>
        <p className="auth-sub">Are you a student or a tutor? You won't be able to change this later.</p>

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
      </div>
    </div>
  );
}
