import React from "react";
import { Icon } from "./Common.jsx";

const TITLES = {
  dashboard: { title: "Dashboard", sub: "Your week at a glance" },
  schedule: { title: "Schedule", sub: "Book and manage your maths classes" },
  qna: { title: "Questions & Answers", sub: "Ask questions, share answers" },
  tasks: { title: "Tasks", sub: "Assignments and homework" },
  ai: { title: "AI Study Tutor", sub: "Learn to study smarter with AI" },
  settings: { title: "Settings", sub: "Manage integrations" },
};

export default function Header({ view }) {
  const { title, sub } = TITLES[view];
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <header className="header">
      <div>
        <div className="header-title">{title}</div>
        <div className="header-sub">{sub}</div>
      </div>
      <div className="header-right">
        <span className="header-date mono">{today}</span>
        <span className="header-divider" />
        <button className="bell-btn" aria-label="Notifications">
          <Icon name="notifications" />
          <span className="bell-dot" />
        </button>
      </div>
    </header>
  );
}
