import React, { useState } from "react";
import { Icon } from "./Common.jsx";
import { FilePicker, AttachmentList } from "./FileAttachments.jsx";
import StudentMultiSelect from "./StudentMultiSelect.jsx";
import { formatClassDay, formatDuration, formatTimeRange, classStudents, classStartMs, rangesOverlap, hueForName, initials } from "../data.js";

const DURATION_OPTIONS = Array.from({ length: 12 }, (_, i) => (i + 1) * 15); // 15, 30, … 180

export default function ClassDetailModal({
  classItem,
  isTutor,
  onClose,
  onAddMaterials,
  onRemoveMaterial,
  onEditNotes,
  onEditMeetingLink,
  onEditTime,
  onDeleteClass,
  onDeleteClassSeries,
  seriesCount = 0,
  roster = [],
  classes = [],
  onAddStudents,
}) {
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(classItem?.notes || "");
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState("");

  const [editingLink, setEditingLink] = useState(false);
  const [linkDraft, setLinkDraft] = useState(classItem?.meetingLink || "");
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState("");

  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [addSelectedUids, setAddSelectedUids] = useState([]);
  const [addBusy, setAddBusy] = useState(false);
  const [addError, setAddError] = useState("");

  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState({ date: "", time: "", duration: 60 });
  const [timeBusy, setTimeBusy] = useState(false);
  const [timeError, setTimeError] = useState("");

  if (!classItem) return null;

  // Only treat it as a series when there's actually more than one session still around to delete;
  // a lone survivor of a deleted series behaves like a normal one-off.
  const isSeries = Boolean(classItem.seriesId) && seriesCount > 1;

  const attendees = classStudents(classItem);
  const attendeeUids = new Set(attendees.map((s) => s.uid));

  // Students booked in another of this tutor's classes that overlaps this one — they can't be added
  // here without a clash, so they're left out of the picker ("not currently in a class" at this time).
  const thisStart = classStartMs(classItem);
  const thisEnd = thisStart != null ? thisStart + (Number(classItem.duration) || 60) * 60000 : null;
  const busyUids = new Set();
  if (thisStart != null) {
    for (const c of classes) {
      if (c.id === classItem.id) continue;
      const s = classStartMs(c);
      if (s == null) continue;
      const e = s + (Number(c.duration) || 60) * 60000;
      if (rangesOverlap(thisStart, thisEnd, s, e)) {
        for (const st of classStudents(c)) busyUids.add(st.uid);
      }
    }
  }
  const availableRoster = roster.filter((r) => !attendeeUids.has(r.studentUid) && !busyUids.has(r.studentUid));

  function startEditTime() {
    setTimeDraft({ date: classItem.date || "", time: classItem.time || "", duration: classItem.duration || 60 });
    setTimeError("");
    setEditingTime(true);
  }

  async function handleSaveTime() {
    if (!timeDraft.date || !timeDraft.time) {
      setTimeError("Pick a date and time.");
      return;
    }
    setTimeError("");
    setTimeBusy(true);
    try {
      await onEditTime(classItem.id, timeDraft);
      setEditingTime(false);
    } catch (err) {
      setTimeError(err.message || "Couldn't reschedule that class. Try again.");
    } finally {
      setTimeBusy(false);
    }
  }

  async function handleAddStudents() {
    if (addSelectedUids.length === 0) return;
    setAddError("");
    setAddBusy(true);
    try {
      const additions = roster
        .filter((r) => addSelectedUids.includes(r.studentUid))
        .map((r) => ({ uid: r.studentUid, name: r.studentName }));
      await onAddStudents(classItem.id, [...attendees, ...additions]);
      setAddSelectedUids([]);
    } catch (err) {
      setAddError(err.message || "Couldn't add those students. Try again.");
    } finally {
      setAddBusy(false);
    }
  }

  async function handleAddMaterials() {
    if (files.length === 0) return;
    setError("");
    setBusy(true);
    try {
      await onAddMaterials(classItem.id, files);
      setFiles([]);
    } catch (err) {
      setError(err.message || "Couldn't attach that file. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function startEditNotes() {
    setNotesDraft(classItem.notes || "");
    setNotesError("");
    setEditingNotes(true);
  }

  async function handleSaveNotes() {
    setNotesError("");
    setNotesBusy(true);
    try {
      await onEditNotes(classItem.id, notesDraft);
      setEditingNotes(false);
    } catch (err) {
      setNotesError(err.message || "Couldn't save those notes. Try again.");
    } finally {
      setNotesBusy(false);
    }
  }

  function startEditLink() {
    setLinkDraft(classItem.meetingLink || "");
    setLinkError("");
    setEditingLink(true);
  }

  async function handleSaveLink() {
    setLinkError("");
    setLinkBusy(true);
    try {
      await onEditMeetingLink(classItem.id, linkDraft);
      setEditingLink(false);
    } catch (err) {
      setLinkError(err.message || "Couldn't save that link. Try again.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function runDelete(scope) {
    setDeleteError("");
    setDeleteBusy(true);
    try {
      if (scope === "series") {
        await onDeleteClassSeries(classItem.seriesId);
      } else {
        await onDeleteClass(classItem.id);
      }
      // On success the modal is unmounted by the parent (selected class cleared), so no reset needed.
    } catch (err) {
      setDeleteError(err.message || "Couldn't delete that class. Try again.");
      setDeleteBusy(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title serif">{classItem.title}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>
        <div className="modal-body">
          {isTutor && editingTime ? (
            <div className="modal-time-edit">
              {timeError && <div className="auth-error" style={{ marginBottom: 8 }}>{timeError}</div>}
              <div className="modal-time-fields">
                <input
                  type="date"
                  value={timeDraft.date}
                  onChange={(e) => setTimeDraft((d) => ({ ...d, date: e.target.value }))}
                />
                <input
                  type="time"
                  value={timeDraft.time}
                  onChange={(e) => setTimeDraft((d) => ({ ...d, time: e.target.value }))}
                />
                <select
                  value={timeDraft.duration}
                  onChange={(e) => setTimeDraft((d) => ({ ...d, duration: Number(e.target.value) }))}
                >
                  {DURATION_OPTIONS.map((mins) => (
                    <option key={mins} value={mins}>
                      {formatDuration(mins)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="modal-time-actions">
                <button className="btn btn-primary" onClick={handleSaveTime} disabled={timeBusy}>
                  {timeBusy ? "Saving…" : "Save"}
                </button>
                <button type="button" className="link-btn" onClick={() => setEditingTime(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-meta-row modal-time-row">
              <div className="modal-time-display">
                <span>{formatClassDay(classItem)}</span>
                <span>·</span>
                <span>{formatTimeRange(classItem)}</span>
                {classItem.duration ? (
                  <>
                    <span>·</span>
                    <span>{formatDuration(classItem.duration)}</span>
                  </>
                ) : null}
              </div>
              {isTutor && (
                <button type="button" className="link-btn" onClick={startEditTime}>
                  Edit
                </button>
              )}
            </div>
          )}
          {!isTutor && (
            <div className="modal-meta-row">
              <span>With {classItem.tutorName}</span>
            </div>
          )}

          {isTutor && (
            <div className="modal-students">
              <div className="modal-section-label">Students</div>
              <div className="attendee-chips">
                {attendees.map((a) => {
                  const h = hueForName(a.name);
                  return (
                    <span key={a.uid} className="attendee-chip">
                      <span className="avatar-dark" style={{ width: 20, height: 20, fontSize: 9, background: `oklch(0.6 0.14 ${h})` }}>
                        {initials(a.name)}
                      </span>
                      {a.name}
                    </span>
                  );
                })}
              </div>
              {availableRoster.length > 0 ? (
                <div className="add-student-row">
                  <StudentMultiSelect roster={availableRoster} selectedUids={addSelectedUids} onChange={setAddSelectedUids} />
                  <button className="btn btn-primary" onClick={handleAddStudents} disabled={addSelectedUids.length === 0 || addBusy}>
                    {addBusy ? "Adding…" : "Add"}
                  </button>
                </div>
              ) : (
                <div className="modal-hint">
                  {roster.length === 0
                    ? "Add students to your roster to invite them to classes."
                    : "Every other student is already in this class or booked at this time."}
                </div>
              )}
              {addError && <div className="auth-error" style={{ marginTop: 8 }}>{addError}</div>}
            </div>
          )}

          {isTutor ? (
            <div className="modal-section-row" style={{ marginTop: 4 }}>
              <div className="modal-section-label">Meeting link</div>
              {!editingLink && (
                <button type="button" className="link-btn" onClick={startEditLink}>
                  {classItem.meetingLink ? "Edit" : "Add link"}
                </button>
              )}
            </div>
          ) : (
            classItem.meetingLink && <div className="modal-section-label" style={{ marginTop: 4 }}>Meeting link</div>
          )}

          {isTutor && editingLink ? (
            <div style={{ marginBottom: 12 }}>
              {linkError && <div className="auth-error">{linkError}</div>}
              <input
                type="url"
                value={linkDraft}
                onChange={(e) => setLinkDraft(e.target.value)}
                placeholder="Paste your Zoom, Google Meet, or other meeting link"
                style={{ width: "100%", marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSaveLink} disabled={linkBusy}>
                  Save
                </button>
                <button type="button" className="link-btn" onClick={() => setEditingLink(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            classItem.meetingLink && (
              <a
                className="btn btn-primary"
                href={classItem.meetingLink}
                target="_blank"
                rel="noreferrer"
                style={{ margin: "4px 0 12px 0" }}
              >
                <Icon name="videocam" /> Join meeting
              </a>
            )
          )}

          <div className="modal-section-row">
            <div className="modal-section-label">Notes</div>
            {isTutor && !editingNotes && (
              <button type="button" className="link-btn" onClick={startEditNotes}>
                Edit
              </button>
            )}
          </div>
          {editingNotes ? (
            <div>
              {notesError && <div className="auth-error">{notesError}</div>}
              <textarea
                value={notesDraft}
                onChange={(e) => setNotesDraft(e.target.value)}
                rows={3}
                style={{ width: "100%", marginBottom: 8 }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" onClick={handleSaveNotes} disabled={notesBusy}>
                  Save
                </button>
                <button type="button" className="link-btn" onClick={() => setEditingNotes(false)}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="modal-notes">{classItem.notes ? classItem.notes : "No notes added."}</div>
          )}

          <AttachmentList
            attachments={classItem.materials}
            label="Materials"
            onRemove={isTutor ? (material) => onRemoveMaterial(classItem.id, material) : undefined}
          />

          {isTutor && (
            <div className="modal-add-materials">
              {error && <div className="auth-error">{error}</div>}
              <FilePicker files={files} onChange={setFiles} label="Attach materials" />
              {files.length > 0 && (
                <button className="btn btn-primary" onClick={handleAddMaterials} disabled={busy} style={{ marginTop: 10 }}>
                  Upload
                </button>
              )}
            </div>
          )}

          {isTutor && (
            <div className="modal-danger-zone">
              {deleteError && <div className="auth-error">{deleteError}</div>}
              {!confirmingDelete ? (
                <button type="button" className="btn-danger" onClick={() => setConfirmingDelete(true)} disabled={deleteBusy}>
                  Delete class
                </button>
              ) : isSeries ? (
                <div className="delete-confirm">
                  <div className="delete-confirm-text">
                    This class is part of a recurring series of {seriesCount}. What would you like to delete?
                  </div>
                  <div className="delete-confirm-actions">
                    <button type="button" className="btn-danger" onClick={() => runDelete("single")} disabled={deleteBusy}>
                      Just this class
                    </button>
                    <button type="button" className="btn-danger" onClick={() => runDelete("series")} disabled={deleteBusy}>
                      All {seriesCount} classes in the series
                    </button>
                    <button type="button" className="link-btn" onClick={() => setConfirmingDelete(false)} disabled={deleteBusy}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="delete-confirm">
                  <div className="delete-confirm-text">Delete this class? This can't be undone.</div>
                  <div className="delete-confirm-actions">
                    <button type="button" className="btn-danger" onClick={() => runDelete("single")} disabled={deleteBusy}>
                      Delete class
                    </button>
                    <button type="button" className="link-btn" onClick={() => setConfirmingDelete(false)} disabled={deleteBusy}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
