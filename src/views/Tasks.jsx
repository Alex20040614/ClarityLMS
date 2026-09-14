import React, { useState } from "react";
import { Icon, PersonChip } from "../components/Common.jsx";
import { FileDropField, FilePicker, AttachmentList } from "../components/FileAttachments.jsx";
import MathText from "../components/MathText.jsx";
import StudentMultiSelect from "../components/StudentMultiSelect.jsx";
import { hueForName, taskDueInfo, taskDueMs, formatTaskDueDay } from "../data.js";

// Groups tasks by due date, most recent first. Used for the student's own history (no "who"
// dimension needed, since it's always just their own tasks).
function groupByDate(tasks) {
  const byDate = new Map();
  for (const t of tasks) {
    const key = formatTaskDueDay(t);
    if (!byDate.has(key)) byDate.set(key, []);
    byDate.get(key).push(t);
  }
  return Array.from(byDate.entries())
    .map(([dateLabel, items]) => ({ dateLabel, items, sortKey: taskDueMs(items[0]) || 0 }))
    .sort((a, b) => b.sortKey - a.sortKey);
}


function StudentTaskRow({ task, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const done = task.status !== "pending";
  const due = taskDueInfo(task);
  const hasFeedback = Boolean(task.feedback?.text?.trim() || task.feedback?.attachments?.length);

  async function handleSubmit() {
    setError("");
    setBusy(true);
    try {
      await onSubmit(task.id, { files, note });
      setFiles([]);
      setNote("");
      setOpen(false);
    } catch (err) {
      setError(err.message || "Couldn't submit that. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="task-row-wrap">
      <div className="task-row">
        <button className={`check-btn ${done ? "done" : ""}`} disabled aria-label="Submission status">
          {done && <Icon name="check" />}
        </button>
        <span className={`task-title ${done ? "done" : ""}`}>{task.title}</span>
        <span className={`task-due ${due.tone}`}>{due.label}</span>
        {!done && (
          <button type="button" className="link-btn" onClick={() => setOpen((o) => !o)}>
            {open ? "Cancel" : "Submit"}
          </button>
        )}
      </div>
      <div style={{ padding: "0 20px 14px 20px" }}>
        {task.notes && (
          <div style={{ marginBottom: 10 }}>
            <div className="task-attachments-label">Notes from your tutor</div>
            <div className="modal-notes"><MathText text={task.notes} /></div>
          </div>
        )}
        <AttachmentList attachments={task.attachments} label="From your tutor" />
        {done && <AttachmentList attachments={task.submission?.attachments} label="Your submission" />}
        {hasFeedback && (
          <div className="task-feedback">
            <div className="task-attachments-label">Feedback from your tutor</div>
            <div className="modal-notes task-feedback-body">
              {task.feedback.text?.trim() ? <MathText text={task.feedback.text} /> : "See the attached files."}
            </div>
            <AttachmentList attachments={task.feedback?.attachments} label="Feedback attachments" />
          </div>
        )}
        {task.status === "reviewed" && <div className="task-reviewed-note">Reviewed by your tutor</div>}
        {open && !done && (
          <div className="task-submit-panel">
            {error && <div className="auth-error">{error}</div>}
            <FileDropField files={files} onChange={setFiles}>
              <textarea
                placeholder="Add a note (optional)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
              />
            </FileDropField>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={busy}>
              Submit task
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StudentTaskHistory({ historyTasks, onSubmit }) {
  if (historyTasks.length === 0) {
    return (
      <div className="card fade-up">
        <div className="list-row list-row-empty">No completed tasks yet.</div>
      </div>
    );
  }
  return groupByDate(historyTasks).map((group) => (
    <div key={group.dateLabel} className="history-date-group">
      <div className="history-date-label">{group.dateLabel}</div>
      <div className="card fade-up">
        {group.items.map((t) => (
          <StudentTaskRow key={t.id} task={t} onSubmit={onSubmit} />
        ))}
      </div>
    </div>
  ));
}

function StudentTasks({ tasks, onSubmit }) {
  const [showHistory, setShowHistory] = useState(false);
  const total = tasks.length;
  const activeTasks = tasks.filter((t) => t.status === "pending");
  const historyTasks = tasks.filter((t) => t.status !== "pending");
  const pct = total === 0 ? 0 : Math.round((historyTasks.length / total) * 100);

  if (total === 0) {
    return (
      <div className="card fade-up">
        <div className="list-row list-row-empty">No tasks assigned yet.</div>
      </div>
    );
  }

  if (showHistory) {
    return (
      <>
        <div className="tasks-header-row">
          <div className="tasks-section-title">Task history</div>
          <button type="button" className="link-btn" onClick={() => setShowHistory(false)}>
            Back to tasks
          </button>
        </div>
        <StudentTaskHistory historyTasks={historyTasks} onSubmit={onSubmit} />
      </>
    );
  }

  return (
    <>
      <div className="card progress-card fade-up">
        <div className="progress-top">
          <span className="progress-label">This week's progress</span>
          <span className="progress-count mono">
            {historyTasks.length} of {total} done
          </span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="tasks-header-row">
        <div className="tasks-section-title">Assigned to you</div>
        <button type="button" className="link-btn" onClick={() => setShowHistory(true)}>
          View history
        </button>
      </div>
      <div className="card fade-up">
        {activeTasks.length === 0 ? (
          <div className="list-row list-row-empty">Nothing outstanding — nice work.</div>
        ) : (
          activeTasks.map((t) => <StudentTaskRow key={t.id} task={t} onSubmit={onSubmit} />)
        )}
      </div>
    </>
  );
}

function TutorTaskCard({ task: t, onAddAttachments, onRemoveAttachment, onSaveFeedback, onRemoveFeedbackAttachment, onEditTitle, onEditNotes, onDelete, onMarkReviewed }) {
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(t.title);
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);

  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(t.notes || "");
  const [notesBusy, setNotesBusy] = useState(false);
  const [notesError, setNotesError] = useState("");
  const [notesPreview, setNotesPreview] = useState(false);

  const [files, setFiles] = useState([]);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Feedback is composed like a Q&A message: free text that may carry $…$ maths, plus attachments.
  const [editingFeedback, setEditingFeedback] = useState(false);
  const [feedbackDraft, setFeedbackDraft] = useState(t.feedback?.text || "");
  const [feedbackFiles, setFeedbackFiles] = useState([]);
  const [feedbackPreview, setFeedbackPreview] = useState(false);
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [feedbackError, setFeedbackError] = useState("");

  const hasSubmission = t.status === "submitted" || t.status === "reviewed";
  // Feedback counts as given once there's text or at least one attached file.
  const hasFeedback = Boolean(t.feedback?.text?.trim() || t.feedback?.attachments?.length);
  const isReviewed = t.status === "reviewed";
  const statusLabel = isReviewed ? "Reviewed" : hasSubmission ? "Submitted" : "Pending";
  const due = taskDueInfo(t);
  const h = hueForName(t.studentName);

  function startEdit() {
    setTitleDraft(t.title);
    setEditError("");
    setEditing(true);
  }

  async function handleSaveTitle() {
    if (!titleDraft.trim()) {
      setEditError("Title can't be empty.");
      return;
    }
    setEditError("");
    setEditBusy(true);
    try {
      await onEditTitle(t.id, titleDraft.trim());
      setEditing(false);
    } catch (err) {
      setEditError(err.message || "Couldn't save that. Try again.");
    } finally {
      setEditBusy(false);
    }
  }

  function startEditNotes() {
    setNotesDraft(t.notes || "");
    setNotesError("");
    setNotesPreview(false);
    setEditingNotes(true);
  }

  async function handleSaveNotes() {
    setNotesError("");
    setNotesBusy(true);
    try {
      await onEditNotes(t.id, notesDraft);
      setEditingNotes(false);
    } catch (err) {
      setNotesError(err.message || "Couldn't save those notes. Try again.");
    } finally {
      setNotesBusy(false);
    }
  }

  async function handleUpload() {
    if (files.length === 0) return;
    setUploadError("");
    setUploadBusy(true);
    try {
      await onAddAttachments(t.id, files);
      setFiles([]);
    } catch (err) {
      setUploadError(err.message || "Couldn't attach that file. Try again.");
    } finally {
      setUploadBusy(false);
    }
  }

  function startEditFeedback() {
    setFeedbackDraft(t.feedback?.text || "");
    setFeedbackFiles([]);
    setFeedbackPreview(false);
    setFeedbackError("");
    setEditingFeedback(true);
  }

  async function handleSaveFeedback() {
    setFeedbackError("");
    setFeedbackBusy(true);
    try {
      await onSaveFeedback(t.id, { text: feedbackDraft, files: feedbackFiles });
      setFeedbackFiles([]);
      setEditingFeedback(false);
    } catch (err) {
      setFeedbackError(err.message || "Couldn't save that feedback. Try again.");
    } finally {
      setFeedbackBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete this task? This can't be undone.")) return;
    setDeleteBusy(true);
    try {
      await onDelete(t.id);
    } catch (err) {
      setDeleteBusy(false);
    }
  }

  async function handleMarkReviewed() {
    setReviewBusy(true);
    try {
      await onMarkReviewed(t.id);
    } finally {
      setReviewBusy(false);
    }
  }

  return (
    <div className="card tutor-task-card fade-up">
      <div className="tutor-task-top">
        {editing ? (
          <div style={{ flex: 1, marginRight: 10 }}>
            {editError && <div className="auth-error">{editError}</div>}
            <input value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} style={{ width: "100%" }} />
          </div>
        ) : (
          <span className="tutor-task-title">{t.title}</span>
        )}
        <span className={`tutor-task-status ${hasSubmission ? "complete" : ""}`}>{statusLabel}</span>
      </div>
      <div className="tutor-task-meta">
        <PersonChip name={t.studentName} hue={h} />
        <span className={`tutor-task-due ${due.tone}`}>{due.label}</span>
      </div>

      <div className="modal-section-row">
        <div className="task-attachments-label">Notes</div>
        {!editingNotes && (
          <button type="button" className="link-btn" onClick={startEditNotes}>
            Edit
          </button>
        )}
      </div>
      {editingNotes ? (
        <div style={{ marginBottom: 10 }}>
          {notesError && <div className="auth-error">{notesError}</div>}
          <div className="qna-compose-toolbar">
            <span className="qna-compose-hint">
              Tip: wrap maths in $…$ (or $$…$$ for a centred equation) to render it.
            </span>
            <button type="button" className="qna-preview-toggle" onClick={() => setNotesPreview((p) => !p)}>
              {notesPreview ? "Write" : "Preview"}
            </button>
          </div>
          {notesPreview ? (
            <div className="qna-compose-preview task-feedback-preview">
              {notesDraft.trim() ? (
                <MathText text={notesDraft} />
              ) : (
                <span className="qna-compose-preview-empty">Nothing to preview yet.</span>
              )}
            </div>
          ) : (
            <textarea
              value={notesDraft}
              onChange={(e) => setNotesDraft(e.target.value)}
              rows={2}
              style={{ width: "100%", marginBottom: 8 }}
            />
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button className="btn btn-primary" onClick={handleSaveNotes} disabled={notesBusy}>
              Save
            </button>
            <button type="button" className="link-btn" onClick={() => setEditingNotes(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="modal-notes" style={{ marginBottom: 10 }}>
          {t.notes ? <MathText text={t.notes} /> : "No notes added."}
        </div>
      )}

      <AttachmentList attachments={t.attachments} label="Attached by you" onRemove={(file) => onRemoveAttachment(t.id, file)} />
      <div className="task-add-attachments">
        {uploadError && <div className="auth-error">{uploadError}</div>}
        <FilePicker files={files} onChange={setFiles} label="Attach files" />
        {files.length > 0 && (
          <button className="btn btn-primary" onClick={handleUpload} disabled={uploadBusy} style={{ marginTop: 10 }}>
            {uploadBusy ? "Uploading…" : "Upload"}
          </button>
        )}
      </div>
      {hasSubmission && <AttachmentList attachments={t.submission?.attachments} label={`Submitted by ${t.studentName}`} />}

      <div className="task-feedback">
        <div className="modal-section-row">
          <div className="task-attachments-label">Feedback</div>
          {!editingFeedback && (
            <button type="button" className="link-btn" onClick={startEditFeedback} aria-label={hasFeedback ? "Edit feedback" : "Add feedback"}>
              {hasFeedback ? "Edit" : "Add feedback"}
            </button>
          )}
        </div>
        {editingFeedback ? (
          <div>
            {feedbackError && <div className="auth-error">{feedbackError}</div>}
            <div className="qna-compose-toolbar">
              <span className="qna-compose-hint">
                Tip: wrap maths in $…$ (or $$…$$ for a centred equation) to render it.
              </span>
              <button type="button" className="qna-preview-toggle" onClick={() => setFeedbackPreview((p) => !p)}>
                {feedbackPreview ? "Write" : "Preview"}
              </button>
            </div>
            {feedbackPreview ? (
              <div className="qna-compose-preview task-feedback-preview">
                {feedbackDraft.trim() ? (
                  <MathText text={feedbackDraft} />
                ) : (
                  <span className="qna-compose-preview-empty">Nothing to preview yet.</span>
                )}
              </div>
            ) : (
              <FileDropField files={feedbackFiles} onChange={setFeedbackFiles}>
                <textarea
                  className="task-feedback-input"
                  placeholder={`Write feedback for ${t.studentName}…`}
                  value={feedbackDraft}
                  onChange={(e) => setFeedbackDraft(e.target.value)}
                  rows={3}
                />
              </FileDropField>
            )}
            {/* The files already saved on this feedback, editable in place alongside the text.
                Removing one applies straight away (as removing an attachment does everywhere else
                in the app), unlike the text, which is staged until Save. */}
            <AttachmentList
              attachments={t.feedback?.attachments}
              label="Already attached (removing is immediate)"
              onRemove={(file) => onRemoveFeedbackAttachment(t.id, file)}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button className="btn btn-primary" onClick={handleSaveFeedback} disabled={feedbackBusy}>
                {feedbackBusy ? "Saving…" : "Save feedback"}
              </button>
              <button type="button" className="link-btn" onClick={() => setEditingFeedback(false)} disabled={feedbackBusy}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="modal-notes task-feedback-body">
              {hasFeedback ? <MathText text={t.feedback.text} /> : "No feedback given yet."}
            </div>
            <AttachmentList
              attachments={t.feedback?.attachments}
              label="Attached to your feedback"
              onRemove={(file) => onRemoveFeedbackAttachment(t.id, file)}
            />
          </>
        )}
      </div>

      <div className="tutor-task-actions">
        {editing ? (
          <>
            <button className="btn btn-primary" onClick={handleSaveTitle} disabled={editBusy}>
              Save
            </button>
            <button type="button" className="link-btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
          </>
        ) : (
          <>
            {t.status === "submitted" && (
              <button type="button" className="btn btn-primary" onClick={handleMarkReviewed} disabled={reviewBusy}>
                Mark as reviewed
              </button>
            )}
            <button type="button" className="link-btn" onClick={startEdit}>
              Edit title
            </button>
            <button type="button" className="btn-danger" onClick={handleDelete} disabled={deleteBusy}>
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function TutorTaskHistory({ historyTasks, roster, onAddAttachments, onRemoveAttachment, onSaveFeedback, onRemoveFeedbackAttachment, onEditTitle, onEditNotes, onDelete, onMarkReviewed }) {
  const [selectedStudentUid, setSelectedStudentUid] = useState("");

  const studentTasks = historyTasks.filter((t) => t.studentUid === selectedStudentUid);
  const selectedStudent = roster.find((r) => r.studentUid === selectedStudentUid);

  return (
    <>
      <div className="card assign-form fade-up" style={{ marginBottom: 16 }}>
        <select value={selectedStudentUid} onChange={(e) => setSelectedStudentUid(e.target.value)} style={{ flex: 1 }}>
          <option value="">Choose a student…</option>
          {roster.map((r) => (
            <option key={r.studentUid} value={r.studentUid}>
              {r.studentName}
            </option>
          ))}
        </select>
      </div>

      {!selectedStudentUid ? (
        <div className="card fade-up">
          <div className="list-row list-row-empty">Choose a student above to see their task history.</div>
        </div>
      ) : studentTasks.length === 0 ? (
        <div className="card fade-up">
          <div className="list-row list-row-empty">No reviewed tasks yet for {selectedStudent?.studentName}.</div>
        </div>
      ) : (
        groupByDate(studentTasks).map((dateGroup) => (
          <div key={dateGroup.dateLabel} className="history-date-group">
            <div className="history-date-label">{dateGroup.dateLabel}</div>
            {dateGroup.items.map((t) => (
              <TutorTaskCard
                key={t.id}
                task={t}
                onAddAttachments={onAddAttachments}
                onRemoveAttachment={onRemoveAttachment}
                onSaveFeedback={onSaveFeedback}
                onRemoveFeedbackAttachment={onRemoveFeedbackAttachment}
                onEditTitle={onEditTitle}
                onEditNotes={onEditNotes}
                onDelete={onDelete}
                onMarkReviewed={onMarkReviewed}
              />
            ))}
          </div>
        ))
      )}
    </>
  );
}

function TutorTasks({ tasks, roster, onAssign, onAddAttachments, onRemoveAttachment, onSaveFeedback, onRemoveFeedbackAttachment, onEditTitle, onEditNotes, onDelete, onMarkReviewed }) {
  const [showForm, setShowForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedStudentUids, setSelectedStudentUids] = useState([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [files, setFiles] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const activeTasks = tasks.filter((t) => t.status !== "reviewed");
  const historyTasks = tasks.filter((t) => t.status === "reviewed");

  async function handleAssign() {
    setError("");
    const students = roster
      .filter((r) => selectedStudentUids.includes(r.studentUid))
      .map((r) => ({ uid: r.studentUid, name: r.studentName }));
    if (students.length === 0) {
      setError("Choose at least one student first.");
      return;
    }
    if (!title.trim()) {
      setError("Give the task a title.");
      return;
    }
    if (!dueDate || !dueTime) {
      setError("Choose a due date and time.");
      return;
    }
    setBusy(true);
    try {
      await onAssign({
        students,
        title: title.trim(),
        notes,
        dueDate,
        dueTime,
        files,
      });
      setSelectedStudentUids([]);
      setTitle("");
      setNotes("");
      setDueDate("");
      setDueTime("");
      setFiles([]);
      setShowForm(false);
    } catch (err) {
      setError(err.message || "Couldn't assign that task.");
    } finally {
      setBusy(false);
    }
  }

  if (showHistory) {
    return (
      <>
        <div className="tasks-header-row">
          <div className="tasks-section-title">Task history</div>
          <button type="button" className="link-btn" onClick={() => setShowHistory(false)}>
            Back to tasks
          </button>
        </div>
        <TutorTaskHistory
          historyTasks={historyTasks}
          roster={roster}
          onAddAttachments={onAddAttachments}
          onRemoveAttachment={onRemoveAttachment}
          onSaveFeedback={onSaveFeedback}
          onRemoveFeedbackAttachment={onRemoveFeedbackAttachment}
          onEditTitle={onEditTitle}
          onEditNotes={onEditNotes}
          onDelete={onDelete}
          onMarkReviewed={onMarkReviewed}
        />
      </>
    );
  }

  return (
    <>
      <div className="tasks-header-row">
        <div className="tasks-section-title">Assigned tasks</div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button type="button" className="link-btn" onClick={() => setShowHistory(true)}>
            View history
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm((s) => !s)} disabled={roster.length === 0}>
            <Icon name="add" /> Assign task
          </button>
        </div>
      </div>

      {showForm && (
        <div className="card assign-form fade-up" style={{ flexDirection: "column", alignItems: "stretch" }}>
          <div className="assign-form-title serif">New task for one or more students</div>
          {error && <div className="auth-error">{error}</div>}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <input
              placeholder="Task title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <input type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
          </div>
          <div className="form-field-label">{selectedStudentUids.length === 1 ? "Student" : "Students"}</div>
          <StudentMultiSelect roster={roster} selectedUids={selectedStudentUids} onChange={setSelectedStudentUids} />
          <div className="qna-compose-hint" style={{ marginBottom: 6 }}>
            Tip: wrap maths in $…$ (or $$…$$ for a centred equation) to render it.
          </div>
          <FileDropField files={files} onChange={setFiles}>
            <textarea
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </FileDropField>
          <button className="btn btn-primary" onClick={handleAssign} disabled={busy} style={{ marginTop: 10, alignSelf: "flex-start" }}>
            Assign
          </button>
        </div>
      )}

      {roster.length === 0 && (
        <div className="card fade-up">
          <div className="list-row list-row-empty">Add a student to your roster before assigning tasks.</div>
        </div>
      )}

      {activeTasks.length === 0 && !showForm && roster.length > 0 && (
        <div className="card fade-up">
          <div className="list-row list-row-empty">No tasks assigned yet.</div>
        </div>
      )}

      {activeTasks.map((t) => (
        <TutorTaskCard
          key={t.id}
          task={t}
          onAddAttachments={onAddAttachments}
          onRemoveAttachment={onRemoveAttachment}
          onSaveFeedback={onSaveFeedback}
          onRemoveFeedbackAttachment={onRemoveFeedbackAttachment}
          onEditTitle={onEditTitle}
          onEditNotes={onEditNotes}
          onDelete={onDelete}
          onMarkReviewed={onMarkReviewed}
        />
      ))}
    </>
  );
}

export default function Tasks({
  role,
  studentTasks,
  onSubmitStudentTask,
  tutorTasks,
  roster,
  onAssignTutorTask,
  onAddTaskAttachments,
  onRemoveTaskAttachment,
  onSaveTaskFeedback,
  onRemoveTaskFeedbackAttachment,
  onEditTaskTitle,
  onEditTaskNotes,
  onDeleteTask,
  onMarkTaskReviewed,
}) {
  return (
    <div className="content-inner narrow">
      {role === "student" ? (
        <StudentTasks tasks={studentTasks} onSubmit={onSubmitStudentTask} />
      ) : (
        <TutorTasks
          tasks={tutorTasks}
          roster={roster}
          onAssign={onAssignTutorTask}
          onAddAttachments={onAddTaskAttachments}
          onRemoveAttachment={onRemoveTaskAttachment}
          onSaveFeedback={onSaveTaskFeedback}
          onRemoveFeedbackAttachment={onRemoveTaskFeedbackAttachment}
          onEditTitle={onEditTaskTitle}
          onEditNotes={onEditTaskNotes}
          onDelete={onDeleteTask}
          onMarkReviewed={onMarkTaskReviewed}
        />
      )}
    </div>
  );
}
