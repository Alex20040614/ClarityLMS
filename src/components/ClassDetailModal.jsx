import React, { useState } from "react";
import { Icon } from "./Common.jsx";
import { FilePicker, AttachmentList } from "./FileAttachments.jsx";
import { formatClassDay, formatDuration, formatTimeRange, classStudentNames } from "../data.js";

export default function ClassDetailModal({
  classItem,
  isTutor,
  onClose,
  onAddMaterials,
  onRemoveMaterial,
  onEditNotes,
  onEditMeetingLink,
  onDeleteClass,
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

  if (!classItem) return null;

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

  async function handleDeleteClass() {
    if (!window.confirm("Delete this class? This can't be undone.")) return;
    setDeleteError("");
    setDeleteBusy(true);
    try {
      await onDeleteClass(classItem.id);
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
          <div className="modal-meta-row">
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
          <div className="modal-meta-row">
            <span>{isTutor ? `With ${classStudentNames(classItem)}` : `With ${classItem.tutorName}`}</span>
          </div>

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
              <button type="button" className="btn-danger" onClick={handleDeleteClass} disabled={deleteBusy}>
                Delete class
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
