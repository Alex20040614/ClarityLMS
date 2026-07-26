import React from "react";
import { Icon } from "./Common.jsx";
import { initials } from "../data.js";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "space_dashboard" },
  { key: "schedule", label: "Schedule", icon: "calendar_month" },
  { key: "booking", label: "Book a class", tutorLabel: "Availability", icon: "event_available" },
  { key: "qna", label: "Q&A", icon: "forum" },
  { key: "tasks", label: "Tasks", icon: "checklist" },
  { key: "ai", label: "AI Tutor", icon: "auto_awesome" },
];

export default function Sidebar({ view, setView, profile, awaitingCount, bookingCount, onSignOut, navOpen, onCloseNav }) {
  const isTutor = profile.role === "tutor";

  function navigate(key) {
    setView(key);
    onCloseNav?.();
  }

  return (
    <>
      {navOpen && <div className="sidebar-backdrop" onClick={onCloseNav} />}
      <aside className={`sidebar ${navOpen ? "open" : ""}`}>
        <button type="button" className="logo-row logo-row-btn" onClick={() => navigate("dashboard")}>
          <div className="logo-mark">C</div>
          <div className="logo-word">Clarity</div>
        </button>

        <nav className="nav">
          {NAV_ITEMS.filter((item) => !item.tutorOnly || isTutor).map((item) => (
            <button
              key={item.key}
              className={`nav-item ${view === item.key ? "active" : ""}`}
              onClick={() => navigate(item.key)}
            >
              <Icon name={item.icon} />
              {isTutor && item.tutorLabel ? item.tutorLabel : item.label}
              {item.key === "qna" && isTutor && awaitingCount > 0 && (
                <span className="nav-badge">{awaitingCount}</span>
              )}
              {item.key === "booking" && isTutor && bookingCount > 0 && (
                <span className="nav-badge">{bookingCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button
            type="button"
            className={`user-card ${view === "profile" ? "active" : ""}`}
            onClick={() => navigate("profile")}
            title="View your profile"
          >
            {profile.photoURL ? (
              <img className="avatar-dark" src={profile.photoURL} alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="avatar-dark">{initials(profile.name)}</div>
            )}
            <div className="user-card-info">
              <div className="user-card-name">{profile.name}</div>
              <div className="user-card-sub">{isTutor ? "Maths Tutor" : "Student"}</div>
            </div>
            <Icon name="chevron_right" />
          </button>
          <button className="btn btn-ghost sign-out-btn" onClick={onSignOut}>
            <Icon name="logout" /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
