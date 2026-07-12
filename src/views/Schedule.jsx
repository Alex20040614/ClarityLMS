import React, { useRef, useState } from "react";
import { Icon } from "../components/Common.jsx";
import WeekCalendar from "../components/WeekCalendar.jsx";
import { FileDropField } from "../components/FileAttachments.jsx";
import StudentMultiSelect from "../components/StudentMultiSelect.jsx";
import { hueForName, formatClassDay, formatDuration, formatTimeRange, isClassUpcoming, classStartMs, truncateEmail } from "../data.js";
import { useNow } from "../hooks/useNow.js";

const DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 15); // 15, 30, ... 180

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

function RosterRow({ entry, onRemove }) {
  const h = hueForName(entry.studentName);
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    setBusy(true);
    try {
      await onRemove(entry.id);
    } finally {
      setBusy(false);
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
      <button className="icon-btn" onClick={handleRemove} disabled={busy} aria-label="Remove student">
        <Icon name="close" />
      </button>
    </div>
  );
}

function TutorSchedule({ profile, classes, roster, onAddStudent, onRemoveStudent, onCreateClass, onSelectClass }) {
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
  const [createError, setCreateError] = useState("");
  const [createBusy, setCreateBusy] = useState(false);

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
    setCreateBusy(true);
    try {
      await onCreateClass({
        students,
        title,
        notes,
        date,
        time,
        duration,
        files,
        meetingLink,
      });
      setSelectedStudentUids([]);
      setDate("");
      setTime("");
      setDuration("60");
      setTitle("");
      setNotes("");
      setMeetingLink("");
      setFiles([]);
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
            roster.map((r) => <RosterRow key={r.id} entry={r} onRemove={onRemoveStudent} />)
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
              Create class
            </button>
          </form>
        )}
      </div>
    </>
  );
}

function StudentSchedule({ classes, onSelectClass }) {
  const now = useNow();
  const upcoming = [...classes]
    .filter((c) => isClassUpcoming(c, now))
    .sort((a, b) => classStartMs(a) - classStartMs(b));
  const history = [...classes]
    .filter((c) => !isClassUpcoming(c, now))
    .sort((a, b) => classStartMs(b) - classStartMs(a));

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
            history.map((c) => (
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
    </>
  );
}

export default function Schedule({ role, profile, classes, roster, onAddStudent, onRemoveStudent, onCreateClass, onSelectClass }) {
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
          onSelectClass={onSelectClass}
        />
      ) : (
        <StudentSchedule classes={classes} onSelectClass={onSelectClass} />
      )}
    </div>
  );
}
