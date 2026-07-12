import React, { useState } from "react";
import GoogleIcon from "../../components/GoogleIcon.jsx";
import { isFirebaseConfigured } from "../../firebase.js";
import { isDismissedPopupError } from "../../auth/authErrors.js";

function authErrorMessage(err) {
  const code = err?.code || "";
  if (code.includes("email-already-in-use")) return "An account with that email already exists — sign in instead.";
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  return err?.message || "Something went wrong. Please try again.";
}

export default function SignUp({ auth, onSwitchToSignIn }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("student");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await auth.signUpWithEmail({ name, email, password, role });
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setError("");
    setBusy(true);
    try {
      await auth.signInWithGoogle();
    } catch (err) {
      if (!isDismissedPopupError(err)) setError(authErrorMessage(err));
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
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Choose whether you're a student or a tutor — this can't be changed later.</p>

        {!isFirebaseConfigured && (
          <div className="auth-error">
            Firebase isn't configured yet — add your project keys to <code>.env</code> to enable sign up.
          </div>
        )}
        {error && <div className="auth-error">{error}</div>}

        <button type="button" className="btn google-btn" onClick={handleGoogle} disabled={busy || !isFirebaseConfigured}>
          <GoogleIcon />
          Continue with Google
        </button>

        <div className="auth-divider">or</div>

        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label htmlFor="signup-name">Name</label>
            <input id="signup-name" type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-email">Email</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <label htmlFor="signup-password">Password</label>
            <input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>
          <div className="auth-field">
            <label>I am a…</label>
            <div className="role-toggle">
              <button type="button" className={role === "student" ? "active" : ""} onClick={() => setRole("student")}>
                Student
              </button>
              <button type="button" className={role === "tutor" ? "active" : ""} onClick={() => setRole("tutor")}>
                Tutor
              </button>
            </div>
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !isFirebaseConfigured}>
            Create account
          </button>
        </form>

        <div className="auth-footer">
          Already have an account?{" "}
          <button type="button" onClick={onSwitchToSignIn}>
            Sign in
          </button>
        </div>
        <div className="auth-footer">
          <a href="/privacy">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
