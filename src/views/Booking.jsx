import React, { useMemo, useState } from "react";
import { Icon } from "../components/Common.jsx";
import WeeklyAvailabilityGrid from "../components/WeeklyAvailabilityGrid.jsx";
import {
  DAY_SLOT_TIMES,
  REQUEST_DURATION_OPTIONS,
  SLOT_MINUTES,
  formatDuration,
  formatHours,
  hueForName,
  overlapsBusy,
  rangeTemplateAvailable,
  slotStartMs,
  weeklySlotKey,
  mondayWeekday,
} from "../data.js";

// ---------- shared week helpers ----------

function startOfWeek(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d;
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function fmtDay(d) {
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}
function fmtTime(ms) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtSlotRange(startAt, duration) {
  const end = startAt + (Number(duration) || 60) * 60000;
  const d = new Date(startAt);
  return `${d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })} · ${fmtTime(startAt)}–${fmtTime(end)}`;
}

function StatusPill({ status }) {
  const label = status === "accepted" ? "Accepted" : status === "declined" ? "Declined" : "Pending";
  return <span className={`request-status request-status-${status}`}>{label}</span>;
}

// ---------- Tutor ----------

function TutorBooking({ profile, availability, requests, onSetAvailability, onAccept, onDecline }) {
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const available = availability?.available || [];

  const pending = requests.filter((r) => r.status === "pending");
  const resolved = requests.filter((r) => r.status !== "pending");

  async function act(id, fn) {
    setBusyId(id);
    setActionError("");
    try {
      await fn();
    } catch (err) {
      setActionError(err.message || "Something went wrong. Try again.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <div className="card fade-up booking-card">
        <div className="card-header">
          <div className="card-title">Class requests</div>
          {pending.length > 0 && <span className="nav-badge booking-inbox-badge">{pending.length}</span>}
        </div>
        {actionError && <div className="auth-error" style={{ margin: "12px 20px 0" }}>{actionError}</div>}
        {pending.length === 0 ? (
          <div className="list-row list-row-empty">No pending requests right now.</div>
        ) : (
          pending.map((r) => {
            const h = hueForName(r.studentName);
            return (
              <div key={r.id} className="request-row">
                <div className="avatar-dark request-avatar" style={{ background: `oklch(0.6 0.14 ${h})` }}>
                  {r.studentName.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="request-main">
                  <div className="request-title">
                    {r.topic?.trim() ? r.topic : "Tutoring session"} · {r.studentName}
                  </div>
                  <div className="request-meta">
                    {fmtSlotRange(r.startAt, r.duration)} · {formatDuration(r.duration)}
                  </div>
                  {r.notes ? <div className="request-notes">“{r.notes}”</div> : null}
                </div>
                <div className="request-actions">
                  <button className="btn btn-primary" disabled={busyId === r.id} onClick={() => act(r.id, () => onAccept(r))}>
                    Accept
                  </button>
                  <button className="btn-danger" disabled={busyId === r.id} onClick={() => act(r.id, () => onDecline(r.id))}>
                    Decline
                  </button>
                </div>
              </div>
            );
          })
        )}
        {resolved.length > 0 && (
          <div className="request-resolved">
            {resolved.map((r) => (
              <div key={r.id} className="request-resolved-row">
                <span className="request-resolved-name">{r.studentName}</span>
                <span className="request-resolved-meta">{fmtSlotRange(r.startAt, r.duration)}</span>
                <StatusPill status={r.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card fade-up booking-card">
        <div className="card-header">
          <div className="card-title">Your weekly availability</div>
          {available.length > 0 && (
            <button type="button" className="link-btn" onClick={() => onSetAvailability([])}>
              Clear all
            </button>
          )}
        </div>
        <div className="booking-pad">
          <p className="booking-hint">
            Click or drag across the grid to mark the times you're open to teach each week. Students can request
            classes in these slots; a slot with an existing class is shown as busy to them automatically.
          </p>
          <WeeklyAvailabilityGrid available={available} onChange={onSetAvailability} />
          <div className="avail-legend">
            <span className="avail-legend-item"><span className="avail-swatch on" /> Available</span>
            <span className="avail-legend-item"><span className="avail-swatch" /> Unavailable</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- Student ----------

function StudentBooking({ profile, tutors, selectedTutorUid, onSelectTutor, tutorAvailability, requests, onRequest, onCancel }) {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedSlot, setSelectedSlot] = useState(null); // { dayDate, time, startMs }
  const [duration, setDuration] = useState(60);
  const [topic, setTopic] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const selectedTutor = tutors.find((t) => t.tutorUid === selectedTutorUid) || null;
  const availableSet = useMemo(() => new Set(tutorAvailability?.available || []), [tutorAvailability]);
  const busy = tutorAvailability?.busy || [];

  // Slots this student has already requested (pending) or had accepted, keyed by startAt, so the
  // same slot isn't offered twice.
  const myTaken = useMemo(() => {
    const map = new Map();
    for (const r of requests) {
      if (r.tutorUid === selectedTutorUid && (r.status === "pending" || r.status === "accepted")) {
        map.set(r.startAt, r.status);
      }
    }
    return map;
  }, [requests, selectedTutorUid]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = days[6];
  const now = Date.now();

  // Drop requests whose class has already finished — once the time has passed there's nothing left
  // to act on, so they shouldn't linger in the list.
  const visibleRequests = requests.filter((r) => (r.startAt || 0) + (Number(r.duration) || 60) * 60000 > now);

  const rangeLabel = `${weekStart.toLocaleDateString(undefined, { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`;

  // For each day, the future template-available, non-busy base slots.
  function openSlotsFor(dayDate) {
    const weekday = mondayWeekday(dayDate);
    const out = [];
    for (const time of DAY_SLOT_TIMES) {
      if (!availableSet.has(weeklySlotKey(weekday, time))) continue;
      const startMs = slotStartMs(dayDate, time);
      if (startMs < now) continue;
      const endMs = startMs + SLOT_MINUTES * 60000;
      if (overlapsBusy(busy, startMs, endMs)) continue;
      out.push({ time, startMs, taken: myTaken.get(startMs) });
    }
    return out;
  }

  function pickSlot(dayDate, slot) {
    if (slot.taken) return;
    setSelectedSlot({ dayDate, time: slot.time, startMs: slot.startMs });
    setDuration(60);
    setTopic("");
    setNotes("");
    setFormError("");
  }

  async function submitRequest() {
    if (!selectedSlot || !selectedTutor) return;
    // Guard the whole chosen duration, not just the first 30 minutes: every slot it spans must be in
    // the tutor's template and free of existing classes.
    const endMs = selectedSlot.startMs + duration * 60000;
    const okTemplate = rangeTemplateAvailable(availableSet, selectedSlot.dayDate, selectedSlot.time, duration);
    const free = !overlapsBusy(busy, selectedSlot.startMs, endMs);
    if (!okTemplate || !free) {
      setFormError(`That ${formatDuration(duration)} slot runs into a time the tutor isn't available. Try a shorter length or another slot.`);
      return;
    }
    setSubmitting(true);
    try {
      await onRequest({
        tutorUid: selectedTutor.tutorUid,
        tutorName: selectedTutor.tutorName,
        startAt: selectedSlot.startMs,
        duration,
        topic,
        notes,
      });
      setSelectedSlot(null);
    } catch (err) {
      setFormError(err.message || "Couldn't send that request. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (tutors.length === 0) {
    return (
      <div className="card fade-up booking-card">
        <div className="card-header">
          <div className="card-title">Book a class</div>
        </div>
        <div className="list-row list-row-empty">
          You're not linked to a tutor yet. Ask your tutor to add you by email, then you can request classes here.
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="card fade-up booking-card">
        <div className="card-header">
          <div className="card-title">Book a class</div>
          {tutors.length > 1 && (
            <select className="booking-tutor-select" value={selectedTutorUid || ""} onChange={(e) => onSelectTutor(e.target.value)}>
              {tutors.map((t) => (
                <option key={t.tutorUid} value={t.tutorUid}>
                  {t.tutorName}
                </option>
              ))}
            </select>
          )}
        </div>

        {selectedTutor && (
          <div className={`booking-hours ${(Number(selectedTutor.hoursRemaining) || 0) < 0 ? "negative" : ""}`}>
            <Icon name="hourglass_top" />
            You have <strong>{formatHours(selectedTutor.hoursRemaining || 0)}</strong> of classes remaining with {selectedTutor.tutorName}.
            {(Number(selectedTutor.hoursRemaining) || 0) <= 0 && <span className="booking-hours-note"> Ask them to top up your hours.</span>}
          </div>
        )}

        <div className="booking-weeknav">
          <button type="button" className="week-cal-nav-btn" onClick={() => setWeekStart(startOfWeek(new Date()))}>
            This week
          </button>
          <button type="button" className="week-cal-nav-btn week-cal-nav-arrow" onClick={() => setWeekStart((w) => addDays(w, -7))} aria-label="Previous week">
            <Icon name="chevron_left" />
          </button>
          <span className="booking-weeklabel serif">{rangeLabel}</span>
          <button type="button" className="week-cal-nav-btn week-cal-nav-arrow" onClick={() => setWeekStart((w) => addDays(w, 7))} aria-label="Next week">
            <Icon name="chevron_right" />
          </button>
        </div>

        <div className="booking-days">
          {days.map((d) => {
            const slots = openSlotsFor(d);
            return (
              <div key={d.toISOString()} className="booking-day-row">
                <div className="booking-day-label">{fmtDay(d)}</div>
                <div className="booking-day-slots">
                  {slots.length === 0 ? (
                    <span className="booking-no-slots">No open times</span>
                  ) : (
                    slots.map((s) => {
                      const isSelected = selectedSlot && selectedSlot.startMs === s.startMs;
                      return (
                        <button
                          key={s.time}
                          type="button"
                          className={`booking-slot ${s.taken ? "taken" : ""} ${isSelected ? "selected" : ""}`}
                          disabled={Boolean(s.taken)}
                          onClick={() => pickSlot(d, s)}
                        >
                          {fmtTime(s.startMs)}
                          {s.taken ? <span className="booking-slot-tag">{s.taken === "accepted" ? "booked" : "requested"}</span> : null}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {selectedSlot && (
        <div className="card fade-up booking-card booking-composer">
          <div className="card-header">
            <div className="card-title">Request this class</div>
            <button className="icon-btn" onClick={() => setSelectedSlot(null)} aria-label="Close">
              <Icon name="close" />
            </button>
          </div>
          <div className="booking-pad">
            <div className="booking-composer-when">
              <Icon name="event" /> {fmtSlotRange(selectedSlot.startMs, duration)} · with {selectedTutor?.tutorName}
            </div>
            {formError && <div className="auth-error">{formError}</div>}
            <div className="booking-field">
              <label className="form-field-label">Length</label>
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {REQUEST_DURATION_OPTIONS.map((mins) => (
                  <option key={mins} value={mins}>
                    {formatDuration(mins)}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              className="booking-input"
              placeholder="Topic (optional) — e.g. Quadratics"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
            <textarea
              className="booking-input"
              placeholder="Notes for your tutor (optional)"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="booking-composer-actions">
              <button className="btn btn-primary" onClick={submitRequest} disabled={submitting}>
                {submitting ? "Sending…" : "Send request"}
              </button>
              <button type="button" className="link-btn" onClick={() => setSelectedSlot(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card fade-up booking-card">
        <div className="card-header">
          <div className="card-title">Your requests</div>
        </div>
        {visibleRequests.length === 0 ? (
          <div className="list-row list-row-empty">No class requests yet — pick an open time above to get started.</div>
        ) : (
          visibleRequests.map((r) => (
            <div key={r.id} className="request-row">
              <div className="request-main">
                <div className="request-title">
                  {r.topic?.trim() ? r.topic : "Tutoring session"} · with {r.tutorName}
                </div>
                <div className="request-meta">
                  {fmtSlotRange(r.startAt, r.duration)} · {formatDuration(r.duration)}
                </div>
                {r.notes ? <div className="request-notes">“{r.notes}”</div> : null}
              </div>
              <div className="request-actions">
                <StatusPill status={r.status} />
                {r.status === "pending" && (
                  <button type="button" className="link-btn" onClick={() => onCancel(r.id)}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default function Booking(props) {
  const { role } = props;
  return (
    <div className="content-inner">
      {role === "tutor" ? <TutorBooking {...props} /> : <StudentBooking {...props} />}
    </div>
  );
}
