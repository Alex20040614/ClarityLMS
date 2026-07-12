import React from "react";
import { Icon } from "./Common.jsx";
import { initials } from "../data.js";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "space_dashboard" },
  { key: "schedule", label: "Schedule", icon: "calendar_month" },
  { key: "qna", label: "Q&A", icon: "forum" },
  { key: "tasks", label: "Tasks", icon: "checklist" },
  { key: "ai", label: "AI Tutor", icon: "auto_awesome" },
  { key: "settings", label: "Settings", icon: "settings", tutorOnly: true },
];

export default function Sidebar({ view, setView, profile, awaitingCount, onSignOut }) {
  const isTutor = profile.role === "tutor";

  return (
    <aside className="sidebar">
      <div className="logo-row">
        <div className="logo-mark">C</div>
        <div className="logo-word">Clarity</div>
      </div>

      <nav className="nav">
        {NAV_ITEMS.filter((item) => !item.tutorOnly || isTutor).map((item) => (
          <button
            key={item.key}
            className={`nav-item ${view === item.key ? "active" : ""}`}
            onClick={() => setView(item.key)}
          >
            <Icon name={item.icon} />
            {item.label}
            {item.key === "qna" && isTutor && awaitingCount > 0 && (
              <span className="nav-badge">{awaitingCount}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="user-card">
          {profile.photoURL ? (
            <img className="avatar-dark" src={profile.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="avatar-dark">{initials(profile.name)}</div>
          )}
          <div>
            <div className="user-card-name">{profile.name}</div>
            <div className="user-card-sub">{isTutor ? "Maths Tutor" : "Student"}</div>
          </div>
        </div>
        <button className="btn btn-ghost sign-out-btn" onClick={onSignOut}>
          <Icon name="logout" /> Sign out
        </button>
      </div>
    </aside>
  );
}
