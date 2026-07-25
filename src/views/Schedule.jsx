import React, { useRef, useState } from "react";
import { Icon } from "../components/Common.jsx";
import WeekCalendar from "../components/WeekCalendar.jsx";
import { FileDropField } from "../components/FileAttachments.jsx";
import StudentMultiSelect from "../components/StudentMultiSelect.jsx";
import { hueForName, formatClassDate, formatClassDay, formatClassStartTime, formatDuration, formatHours, formatTimeRange, isClassUpcoming, classStartMs, findClassConflict, truncateEmail, RECURRENCE_OPTIONS, RECURRENCE_MAX_COUNT, recurrenceDates } from "../data.js";
import { useNow } from "../hooks/useNow.js";

const DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 15); // 15, 30, ... 180
const HISTORY_PAGE_SIZE = 10; // past classes shown before "Show more" (all are still fetched/stored)

function ClassRow({ classItem: c, personName, personLabel, onClick }) {
  const h = hueForName(personName);
  return (
    <div className="class-row class-row-clickable" onClick={onClick}>
      <div className="class-time-col wide">
        <div className="class-time">{formatClassDay(c)}</div>
        <div className="class-day">
          {formatTimeRange(c)}
          {c.duration ? ` · ${formatDuration(c.duration)}` : ""}
        </div>
      </div>
      <div className="class-bar" style={{ background: `oklch(0.6 0.14 ${h})` }} />
      <div className="class-info">
        <div className="class-title">{c.title}</div>
        <div className="class-meta">
          {personLabel} {personName}
          {c.notes ? ` · ${c.notes}` : ""}
        </div>
      </div>
    </div>
  );
}

function RosterRow({ entry, onRemove, onSetHours }) {
  const h = hueForName(entry.studentName);
  const [busy, setBusy] = useState(false);
  const [editingHours, setEditingHours] = useState(false);
  const [hoursDraft, setHoursDraft] = useState("");
  const [hoursBusy, setHoursBusy] = useState(false);

  const hours = Number(entry.hoursRemaining) || 0;

  async function handleRemove() {
    setBusy(true);
    try {
      await onRemove(entry.id);
    } finally {
      setBusy(false);
    }
  }

  function startEditHours() {
    setHoursDraft(String(hours));
    setEditingHours(true);
  }

  async function saveHours() {
    setHoursBusy(true);
    try {
      await onSetHours(entry.id, Number(hoursDraft) || 0);
      setEditingHours(false);
    } finally {
      setHoursBusy(false);
    }
  }

  return (
    <div className="list-row">
      <div className="avatar-dark" style={{ width: 30, height: 30, fontSize: 11, background: `oklch(0.6 0.14 ${h})` }}>
        {entry.studentName
          .split(" ")
          .map((p) => p[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="list-row-title">{entry.studentName}</div>
        <div className="list-row-meta">{truncateEmail(entry.studentEmail)}</div>
      </div>
      {editingHours ? (
        <div className="roster-hours-edit">
          <input
            type="number"
            step="0.25"
            value={hoursDraft}
            onChange={(e) => setHoursDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveHours()}
            autoFocus
          />
          <button className="btn btn-primary" onClick={saveHours} disabled={hoursBusy}>
            Save
          </button>
          <button type="button" className="link-btn" onClick={() => setEditingHours(false)}>
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={`roster-hours ${hours < 0 ? "negative" : ""}`}
          onClick={startEditHours}
          title="Edit remaining hours"
        >
          <span className="roster-hours-value">{formatHours(hours)}</span>
          <Icon name="edit" />
        </button>
      )}
      <button className="icon-btn" onClick={handleRemove} disabled={busy} aria-label="Remove student">
        <Icon name="close" />
      </button>
    </div>
  );
}

function TutorSchedule({ profile, classes, roster, onAddStudent, onRemoveStudent, onCreateClass, onCreateRecurringClasses, onSetStudentHours, onSelectClass }) {
  const [email, setEmail] = useState("");
  const [addError, setAddError] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const createClassRef = useRef(null);

  const [selectedStudentUids, setSelectedStudentUids] = useState([]);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [meetingLink, setMeetingLink] = useState("");
  const [files, setFiles] = useState([]);
  const [repeat, setRepeat] = useState("none");
  const [repeatCount, setRepeatCount] = useState(8);
  const [createError, setCreateError] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

  const isRecurring = repeat !== "none";
  // Live preview of the series the current rule would produce (empty until a date is picked).
  const seriesDates = isRecurring && date ? recurrenceDates(date, repeat, repeatCount) : [];

  async function handleAdd(e) {
    e.preventDefault();
    setAddError("");
    setAddBusy(true);
    try {
      await onAddStudent(email);
      setEmail("");
    } catch (err) {
      setAddError(err.message || "Couldn't add that student.");
    } finally {
      setAddBusy(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError("");
    const students = roster
      .filter((r) => selectedStudentUids.includes(r.studentUid))
      .map((r) => ({ uid: r.studentUid, name: r.studentName }));
    if (students.length === 0) {
      setCreateError("Choose at least one student first.");
      return;
    }
    // Block double-booking: every session this submit would create must be free of overlap with an
    // existing class. For a recurring series we check each occurrence and report the first clash.
    const dates = isRecurring ? seriesDates : [date];
    for (const d of dates) {
      const startMs = new Date(`${d}T${time}`).getTime();
      const conflict = findClassConflict(classes, startMs, Number(duration));
      if (conflict) {
        const when = `${formatClassDay(conflict)} at ${formatClassStartTime(conflict)}`;
        setCreateError(
          isRecurring
            ? `${formatClassDate(d)} clashes with an existing class (“${conflict.title}”, ${when}). Adjust the time, length, or start date.`
            : `That time clashes with an existing class (“${conflict.title}”, ${when}). Pick another time or length.`
        );
        return;
      }
    }
    // Warn (but don't block) when a student lacks the hours this booking would consume — the tutor can
    // still go ahead, and that student's balance goes negative.
    const totalHours = ((Number(duration) || 0) / 60) * dates.length;
    const shortStudents = students.filter((s) => {
      const link = roster.find((r) => r.studentUid === s.uid);
      return (link?.hoursRemaining ?? 0) < totalHours;
    });
    if (shortStudents.length > 0) {
      const names = shortStudents.map((s) => s.name).join(", ");
      const scope = isRecurring ? `these ${dates.length} classes` : "this class";
      const ok = window.confirm(
        `${names} ${shortStudents.length === 1 ? "does" : "do"} not have enough hours remaining for ${scope} (${formatHours(totalHours)}). Schedule anyway? Their balance will go negative.`
      );
      if (!ok) return;
    }
    setCreateBusy(true);
    try {
      const data = { students, title, notes, date, time, duration, files, meetingLink };
      if (isRecurring) {
        await onCreateRecurringClasses(data, { frequency: repeat, count: repeatCount });
      } else {
        await onCreateClass(data);
      }
      setSelectedStudentUids([]);
      setDate("");
      setTime("");
      setDuration("60");
      setTitle("");
      setNotes("");
      setMeetingLink("");
      setFiles([]);
      setRepeat("none");
      setRepeatCount(8);
    } catch (err) {
      setCreateError(err.message || "Couldn't create that class.");
    } finally {
      setCreateBusy(false);
    }
  }

  function handleAddClassFromCalendar(iso) {
    setDate(iso);
    createClassRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      <WeekCalendar classes={classes} onSelectClass={onSelectClass} onAddClass={handleAddClassFromCalendar} />

      <div className="card fade-up" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">Your students</div>
        </div>
        <form className="assign-form" onSubmit={handleAdd}>
          <input
            type="email"
            placeholder="name@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button className="btn btn-outline-accent" type="submit" disabled={addBusy}>
            Add
          </button>
        </form>
        {addError && <div className="auth-error" style={{ margin: "0 20px 16px 20px" }}>{addError}</div>}
        <div>
          {roster.length === 0 ? (
            <div className="list-row list-row-empty">No students yet — add one by email above.</div>
          ) : (
            roster.map((r) => <RosterRow key={r.id} entry={r} onRemove={onRemoveStudent} onSetHours={onSetStudentHours} />)
          )}
        </div>
      </div>

      <div ref={createClassRef} className="card assign-form fade-up" style={{ flexDirection: "column", alignItems: "stretch", marginBottom: 16 }}>
        <div className="assign-form-title serif">Create a class</div>
        {roster.length === 0 ? (
          <p className="sched-hint" style={{ margin: 0 }}>
            Add a student to your roster first.
          </p>
        ) : (
          <form onSubmit={handleCreate}>
            {createError && <div className="auth-error">{createError}</div>}
            <input
              type="text"
              placeholder="Topic, e.g. Quadratics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: "100%", marginBottom: 10 }}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              <select value={duration} onChange={(e) => setDuration(e.target.value)} required style={{ minWidth: 120 }}>
                {DURATION_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {formatDuration(mins)}
                  </option>
                ))}
              </select>
            </div>
            <div className="repeat-row" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
              <Icon name="repeat" />
              <select value={repeat} onChange={(e) => setRepeat(e.target.value)} style={{ minWidth: 150 }}>
                {RECURRENCE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              {isRecurring && (
                <label className="repeat-count-label">
                  <span>for</span>
                  <input
                    type="number"
                    min={2}
                    max={RECURRENCE_MAX_COUNT}
                    value={repeatCount}
                    onChange={(e) => setRepeatCount(Math.max(1, Math.min(Number(e.target.value) || 1, RECURRENCE_MAX_COUNT)))}
                    style={{ width: 64, flex: "none" }}
                  />
                  <span>sessions</span>
                </label>
              )}
            </div>
            {isRecurring && seriesDates.length > 0 && (
              <div className="repeat-preview">
                Creates {seriesDates.length} classes — {formatClassDate(seriesDates[0])} through {formatClassDate(seriesDates[seriesDates.length - 1])}.
              </div>
            )}
            <div className="form-field-label">{selectedStudentUids.length === 1 ? "Student" : "Students"}</div>
            <StudentMultiSelect roster={roster} selectedUids={selectedStudentUids} onChange={setSelectedStudentUids} />
            <input
              type="url"
              placeholder="Meeting link (optional) — e.g. your Zoom or Google Meet link"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
              style={{ width: "100%", marginBottom: 10 }}
            />
            <FileDropField files={files} onChange={setFiles}>
              <textarea
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </FileDropField>
            <button className="btn btn-primary" type="submit" disabled={createBusy}>
              {createBusy
                ? "Creating…"
                : isRecurring && seriesDates.length > 1
                ? `Create ${seriesDates.length} classes`
                : "Create class"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}

function StudentSchedule({ classes, onSelectClass }) {
  const now = useNow();
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE_SIZE);
  const upcoming = [...classes]
    .filter((c) => isClassUpcoming(c, now))
    .sort((a, b) => classStartMs(a) - classStartMs(b));
  const history = [...classes]
    .filter((c) => !isClassUpcoming(c, now))
    .sort((a, b) => classStartMs(b) - classStartMs(a));
  const visibleHistory = history.slice(0, historyLimit);
  const remaining = history.length - visibleHistory.length;

  return (
    <>
      <div className="card fade-up" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <div className="card-title">Your classes</div>
        </div>
        <div>
          {upcoming.length === 0 ? (
            <div className="list-row list-row-empty">
              No classes yet — ask your tutor to add you and schedule one.
            </div>
          ) : (
            upcoming.map((c) => (
              <ClassRow
                key={c.id}
                classItem={c}
                personName={c.tutorName}
                personLabel="With"
                onClick={() => onSelectClass(c.id)}
              />
            ))
          )}
        </div>
      </div>

      <div className="card fade-up">
        <div className="card-header">
          <div className="card-title">Class history</div>
        </div>
        <div>
          {history.length === 0 ? (
            <div className="list-row list-row-empty">No past classes yet.</div>
          ) : (
            <>
              {visibleHistory.map((c) => (
                <ClassRow
                  key={c.id}
                  classItem={c}
                  personName={c.tutorName}
                  personLabel="With"
                  onClick={() => onSelectClass(c.id)}
                />
              ))}
              {remaining > 0 && (
                <button type="button" className="history-show-more" onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE_SIZE)}>
                  Show {Math.min(HISTORY_PAGE_SIZE, remaining)} more
                  <span className="history-show-more-count">{remaining} older {remaining === 1 ? "class" : "classes"}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function Schedule({ role, profile, classes, roster, onAddStudent, onRemoveStudent, onCreateClass, onCreateRecurringClasses, onSetStudentHours, onSelectClass }) {
  const isTutor = role === "tutor";

  return (
    <div className="content-inner">
      <div className="sched-toolbar">
        <div className="sched-toolbar-left">
          <span className="sched-month serif">{isTutor ? "Manage classes" : "Your classes"}</span>
        </div>
      </div>

      {isTutor ? (
        <TutorSchedule
          profile={profile}
          classes={classes}
          roster={roster}
          onAddStudent={onAddStudent}
          onRemoveStudent={onRemoveStudent}
          onCreateClass={onCreateClass}
          onCreateRecurringClasses={onCreateRecurringClasses}
          onSetStudentHours={onSetStudentHours}
          onSelectClass={onSelectClass}
        />
      ) : (
        <StudentSchedule classes={classes} onSelectClass={onSelectClass} />
      )}
    </div>
  );
}
