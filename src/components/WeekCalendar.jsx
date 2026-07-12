import React, { useState } from "react";
import { Icon } from "./Common.jsx";
import { formatTimeRange, classStartMs, classStudentNames } from "../data.js";

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toISODateLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function WeekCalendar({ classes, onSelectClass, onAddClass }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const today = new Date();

  const rangeLabel =
    weekStart.getMonth() === weekEnd.getMonth()
      ? `${weekStart.getDate()} – ${weekEnd.toLocaleDateString(undefined, { day: "numeric", month: "long" })}`
      : `${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

  // Bucket by the VIEWER's own local calendar date (derived from the absolute startAt instant),
  // not the raw stored date string, which reflects the scheduling tutor's calendar date and can
  // differ from the viewer's if they're in a very different timezone near a day boundary.
  const byDate = {};
  for (const c of classes) {
    const startMs = classStartMs(c);
    if (startMs == null) continue;
    const key = toISODateLocal(new Date(startMs));
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(c);
  }
  for (const key in byDate) {
    byDate[key].sort((a, b) => classStartMs(a) - classStartMs(b));
  }

  return (
    <div className="card week-cal fade-up" style={{ marginBottom: 16 }}>
      <div className="week-cal-header">
        <div className="card-title serif week-cal-title">{rangeLabel}</div>
        <div className="week-cal-nav">
          <button type="button" className="week-cal-nav-btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            Today
          </button>
          <button
            type="button"
            className="week-cal-nav-btn week-cal-nav-arrow"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            aria-label="Previous week"
          >
            <Icon name="chevron_left" />
          </button>
          <button
            type="button"
            className="week-cal-nav-btn week-cal-nav-arrow"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            aria-label="Next week"
          >
            <Icon name="chevron_right" />
          </button>
        </div>
      </div>
      <div className="week-cal-list">
        {days.map((d) => {
          const iso = toISODateLocal(d);
          const dayClasses = byDate[iso] || [];
          const isToday = isSameDay(d, today);
          return (
            <div key={iso} className={`week-cal-day-row ${isToday ? "week-cal-day-row-today" : ""}`}>
              <div className="week-cal-day-badge">
                <span className="week-cal-day-name">{d.toLocaleDateString(undefined, { weekday: "short" }).toUpperCase()}</span>
                <span className="week-cal-day-num">{d.getDate()}</span>
              </div>
              <div className="week-cal-day-body">
                {dayClasses.length === 0 ? (
                  onAddClass ? (
                    <button type="button" className="week-cal-add-class" onClick={() => onAddClass(iso)}>
                      <Icon name="add" /> Add a class
                    </button>
                  ) : (
                    <div className="week-cal-empty">—</div>
                  )
                ) : (
                  dayClasses.map((c) => (
                    <div key={c.id} className="week-cal-class-item" onClick={() => onSelectClass(c.id)}>
                      <span className="week-cal-class-time">{formatTimeRange(c).split(" – ")[0]}</span>
                      <span className="week-cal-class-title">{c.title}</span>
                      <span className="week-cal-class-sep">·</span>
                      <span className="week-cal-class-meta">{classStudentNames(c)}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
