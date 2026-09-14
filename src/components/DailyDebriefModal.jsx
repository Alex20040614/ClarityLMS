import React from "react";
import { Icon } from "./Common.jsx";
import { formatTimeRange, formatDuration, classStudentNames, classStartMs, isClassUpcoming } from "../data.js";

// An end-of-day style summary of a tutor's classes for today: each session with its time, topic,
// attendees, notes, and whether it's already done or still to come. Opened from the daily debrief
// notification; `classes` is expected to be pre-filtered to today and sorted by start time.
export default function DailyDebriefModal({ classes, onClose }) {
  const now = Date.now();
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title serif">Today's debrief</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-meta-row">
            {dateLabel} · {classes.length} {classes.length === 1 ? "class" : "classes"}
          </div>
          {classes.length === 0 ? (
            <div className="debrief-empty">No classes scheduled today.</div>
          ) : (
            <div className="debrief-list">
              {classes.map((c) => {
                const started = classStartMs(c) != null;
                const done = started && !isClassUpcoming(c, now);
                return (
                  <div key={c.id} className="debrief-item">
                    <div className="debrief-time">
                      <span className="debrief-time-range">{formatTimeRange(c)}</span>
                      {c.duration ? <span className="debrief-dur">{formatDuration(c.duration)}</span> : null}
                    </div>
                    <div className="debrief-main">
                      <div className="debrief-title">{c.title}</div>
                      <div className="debrief-students">{classStudentNames(c) || "No students"}</div>
                      {c.notes ? <div className="debrief-notes">{c.notes}</div> : null}
                    </div>
                    <span className={`debrief-status ${done ? "done" : "upcoming"}`}>
                      {done ? "Done" : "Upcoming"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
