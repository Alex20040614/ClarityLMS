import React, { useState } from "react";
import GoogleIcon from "../../components/GoogleIcon.jsx";
import { isFirebaseConfigured } from "../../firebase.js";
import { isDismissedPopupError } from "../../auth/authErrors.js";

function authErrorMessage(err) {
  const code = err?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Incorrect email or password.";
  }
  if (code.includes("invalid-email")) return "Enter a valid email address.";
  if (code.includes("too-many-requests")) return "Too many attempts — try again in a moment.";
  return err?.message || "Something went wrong. Please try again.";
}

export default function SignIn({ auth, onSwitchToSignUp }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("signin");
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await auth.signInWithEmail({ email, password });
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

  async function handleResetSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await auth.resetPassword(email);
      setResetSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function openReset() {
    setError("");
    setResetSent(false);
    setMode("reset");
  }

  function backToSignIn() {
    setError("");
    setResetSent(false);
    setMode("signin");
  }

  if (mode === "reset") {
    return (
      <div className="auth-page">
        <div className="card auth-card fade-up">
          <div className="auth-logo-row">
            <div className="logo-mark">C</div>
            <div className="logo-word">Clarity</div>
          </div>
          <h1 className="auth-title">Reset your password</h1>
          <p className="auth-sub">Enter your account email and we'll send you a reset link.</p>

          {error && <div className="auth-error">{error}</div>}
          {resetSent && (
            <div className="auth-success">
              Check your inbox for a link to reset your password.
            </div>
          )}

          <form onSubmit={handleResetSubmit}>
            <div className="auth-field">
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !isFirebaseConfigured}>
              Send reset link
            </button>
          </form>

          <div className="auth-footer">
            <button type="button" onClick={backToSignIn}>
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="card auth-card fade-up">
        <div className="auth-logo-row">
          <div className="logo-mark">C</div>
          <div className="logo-word">Clarity</div>
        </div>
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Sign in to continue to your classes.</p>

        {!isFirebaseConfigured && (
          <div className="auth-error">
            Firebase isn't configured yet — add your project keys to <code>.env</code> to enable sign in.
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
            <label htmlFor="signin-email">Email</label>
            <input
              id="signin-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="auth-field">
            <div className="auth-field-label-row">
              <label htmlFor="signin-password">Password</label>
              <button type="button" className="auth-inline-link" onClick={openReset}>
                Forgot password?
              </button>
            </div>
            <input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary auth-submit" disabled={busy || !isFirebaseConfigured}>
            Sign in
          </button>
        </form>

        <div className="auth-footer">
          Don't have an account?{" "}
          <button type="button" onClick={onSwitchToSignUp}>
            Sign up
          </button>
        </div>
        <div className="auth-footer">
          <a href="/privacy">Privacy Policy</a>
        </div>
      </div>
    </div>
  );
}
