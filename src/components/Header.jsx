import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Common.jsx";

const TITLES = {
  dashboard: { title: "Dashboard", sub: "Your week at a glance" },
  schedule: { title: "Schedule", sub: "Book and manage your maths classes" },
  booking: { title: "Booking", sub: "Set availability and handle class requests" },
  qna: { title: "Questions & Answers", sub: "Ask questions, share answers" },
  tasks: { title: "Tasks", sub: "Assignments and homework" },
  ai: { title: "AI Study Tutor", sub: "Learn to study smarter with AI" },
  profile: { title: "Profile", sub: "Your name and picture" },
  settings: { title: "Settings", sub: "Manage integrations" },
};

// Persist which notification ids the user has already seen, per-user, so the unread dot stays gone
// across reloads/sessions once they've viewed everything — and only re-lights for genuinely new
// items. Tracking a set of ids (rather than a signature) means a notification disappearing never
// counts as "new".
function loadSeen(key) {
  if (!key) return new Set();
  try {
    return new Set(JSON.parse(localStorage.getItem(key) || "[]"));
  } catch {
    return new Set();
  }
}

function NotificationBell({ notifications, userId }) {
  const [open, setOpen] = useState(false);
  const storageKey = userId ? `clarity:notif-seen:${userId}` : null;
  const [seenIds, setSeenIds] = useState(() => loadSeen(storageKey));
  const ref = useRef(null);

  const sig = notifications.map((n) => n.id).join("|");
  const hasUnread = notifications.some((n) => !seenIds.has(n.id));

  // Reload the persisted seen-set if the signed-in user changes (e.g. sign out / sign in).
  useEffect(() => {
    setSeenIds(loadSeen(storageKey));
  }, [storageKey]);

  // While the panel is open, treat everything currently shown as seen (persisted), so opening it
  // clears the dot and anything that arrives while it's open is marked read too.
  useEffect(() => {
    if (!open) return;
    const ids = sig ? sig.split("|") : [];
    setSeenIds(new Set(ids));
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(ids));
      } catch {
        /* ignore storage failures (private mode, quota) */
      }
    }
  }, [open, sig, storageKey]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggle() {
    setOpen((o) => !o);
  }

  return (
    <div className="notif-wrap" ref={ref}>
      <button className="bell-btn" onClick={toggle} aria-label="Notifications" aria-expanded={open}>
        <Icon name="notifications" />
        {hasUnread && <span className="bell-dot" />}
      </button>
      {open && (
        <div className="notif-panel">
          <div className="notif-panel-header">
            Notifications
            {notifications.length > 0 && <span className="notif-count">{notifications.length}</span>}
          </div>
          {notifications.length === 0 ? (
            <div className="notif-empty">You're all caught up.</div>
          ) : (
            <div className="notif-list">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  className="notif-item"
                  onClick={() => {
                    n.onClick();
                    setOpen(false);
                  }}
                >
                  <span className="notif-icon">
                    <Icon name={n.icon} />
                  </span>
                  <span className="notif-text">
                    <span className="notif-title">{n.title}</span>
                    {n.meta ? <span className="notif-meta">{n.meta}</span> : null}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Header({ view, notifications = [], userId, onMenuClick }) {
  const { title, sub } = TITLES[view];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <header className="header">
      <div className="header-left">
        <button type="button" className="menu-btn" onClick={onMenuClick} aria-label="Open menu">
          <Icon name="menu" />
        </button>
        <div>
          <div className="header-title">{title}</div>
          <div className="header-sub">{sub}</div>
        </div>
      </div>
      <div className="header-right">
        <span className="header-date mono">{today}</span>
        <span className="header-divider" />
        <NotificationBell notifications={notifications} userId={userId} />
      </div>
    </header>
  );
}
