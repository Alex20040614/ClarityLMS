import React, { useState } from "react";
import { Icon } from "../components/Common.jsx";
import { initials, hueForName, truncateEmail } from "../data.js";

// Preset "pick an avatar" options — each a colored circle with an emoji, encoded inline as an SVG
// data URI so choosing one is just a photoURL write (no upload) and renders anywhere <img> is used.
const AVATAR_PRESETS = [
  { bg: "#EAF1FE", emoji: "🦊" },
  { bg: "#E7F2EC", emoji: "🐼" },
  { bg: "#FBEFD3", emoji: "🦉" },
  { bg: "#F3E8FC", emoji: "🐧" },
  { bg: "#FCE7E7", emoji: "🐢" },
  { bg: "#E2F0F6", emoji: "🐳" },
  { bg: "#FDEFE0", emoji: "🐱" },
  { bg: "#E9E4F7", emoji: "🚀" },
  { bg: "#FBE9F1", emoji: "🌸" },
  { bg: "#E6F4E6", emoji: "🐸" },
  { bg: "#F0ECE1", emoji: "🦁" },
  { bg: "#DEEBFB", emoji: "⭐" },
];

function avatarDataUri(bg, emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" rx="60" fill="${bg}"/><text x="60" y="68" font-size="62" text-anchor="middle" dominant-baseline="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export default function Profile({ profile, onSaveName, onUploadPhoto, onSetPhotoURL }) {
  const [name, setName] = useState(profile.name || "");
  const [savingName, setSavingName] = useState(false);
  const [nameMsg, setNameMsg] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const nameChanged = name.trim() && name.trim() !== profile.name;
  const h = hueForName(profile.name || "?");

  async function saveName() {
    if (!name.trim()) {
      setNameMsg("Your name can't be empty.");
      return;
    }
    setSavingName(true);
    setNameMsg("");
    try {
      await onSaveName(name.trim());
      setNameMsg("Saved");
    } catch {
      setNameMsg("Couldn't save — try again.");
    } finally {
      setSavingName(false);
    }
  }

  async function withPhotoBusy(fn) {
    setPhotoError("");
    setPhotoBusy(true);
    try {
      await fn();
    } catch {
      setPhotoError("Couldn't update your picture. Try again.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Image must be under 5 MB.");
      return;
    }
    withPhotoBusy(() => onUploadPhoto(file));
  }

  return (
    <div className="content-inner" style={{ maxWidth: 620 }}>
      <div className="card fade-up profile-card">
        <div className="card-header">
          <div className="card-title">Profile picture</div>
        </div>
        <div className="profile-pad">
          <div className="profile-avatar-row">
            <div className="profile-avatar">
              {profile.photoURL ? (
                <img src={profile.photoURL} alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="profile-avatar-initials" style={{ background: `oklch(0.6 0.14 ${h})` }}>
                  {initials(profile.name || "?")}
                </div>
              )}
            </div>
            <div className="profile-avatar-actions">
              <label className={`btn btn-primary ${photoBusy ? "is-disabled" : ""}`}>
                <Icon name="upload" /> {photoBusy ? "Working…" : "Upload photo"}
                <input type="file" accept="image/*" onChange={handleUpload} disabled={photoBusy} style={{ display: "none" }} />
              </label>
              {profile.photoURL && (
                <button type="button" className="link-btn" disabled={photoBusy} onClick={() => withPhotoBusy(() => onSetPhotoURL(null))}>
                  Remove
                </button>
              )}
            </div>
          </div>
          {photoError && <div className="auth-error" style={{ marginTop: 12 }}>{photoError}</div>}

          <div className="profile-subhead">Or pick an avatar</div>
          <div className="profile-avatar-grid">
            {AVATAR_PRESETS.map((a) => {
              const uri = avatarDataUri(a.bg, a.emoji);
              const selected = profile.photoURL === uri;
              return (
                <button
                  key={a.emoji}
                  type="button"
                  className={`profile-avatar-option ${selected ? "selected" : ""}`}
                  disabled={photoBusy}
                  onClick={() => withPhotoBusy(() => onSetPhotoURL(uri))}
                  aria-label={`Use ${a.emoji} avatar`}
                >
                  <img src={uri} alt="" />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card fade-up profile-card">
        <div className="card-header">
          <div className="card-title">Your name</div>
        </div>
        <div className="profile-pad">
          <p className="profile-hint">This is how you appear to everyone else on Clarity.</p>
          <div className="profile-name-row">
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setNameMsg("");
              }}
              placeholder="Your name"
            />
            <button className="btn btn-primary" onClick={saveName} disabled={savingName || !nameChanged}>
              {savingName ? "Saving…" : "Save"}
            </button>
          </div>
          {nameMsg && <div className={`profile-name-msg ${nameMsg === "Saved" ? "ok" : "err"}`}>{nameMsg}</div>}
        </div>
      </div>

      <div className="card fade-up profile-card">
        <div className="card-header">
          <div className="card-title">Account</div>
        </div>
        <div className="profile-pad profile-account">
          <div className="profile-account-row">
            <span className="profile-account-label">Email</span>
            <span className="profile-account-value">{truncateEmail(profile.email || "")}</span>
          </div>
          <div className="profile-account-row">
            <span className="profile-account-label">Role</span>
            <span className="profile-account-value">{profile.role === "tutor" ? "Maths Tutor" : "Student"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
