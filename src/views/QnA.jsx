import React, { useEffect, useRef, useState } from "react";
import { Icon, TopicChip, PersonChip, StatusPill } from "../components/Common.jsx";
import MathText from "../components/MathText.jsx";
import { FileDropField, AttachmentList } from "../components/FileAttachments.jsx";
import { hueForName, initials, formatMessageTime } from "../data.js";

export default function QnA({
  role,
  profile,
  threads,
  activeId,
  setActiveId,
  onPost,
  onNewQuestion,
  onEditMessage,
  onDeleteMessage,
  onDeleteThread,
  onMarkSeen,
  roster = [],
  tutors = [],
}) {
  const isTutor = role === "tutor";
  const counterparts = isTutor
    ? roster.map((r) => ({ id: r.studentUid, name: r.studentName }))
    : tutors.map((t) => ({ id: t.tutorUid, name: t.tutorName }));

  const [draft, setDraft] = useState("");
  const [composeFiles, setComposeFiles] = useState([]);
  const [preview, setPreview] = useState(false);
  const [postBusy, setPostBusy] = useState(false);
  const [postError, setPostError] = useState("");

  const [asking, setAsking] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newCounterpartId, setNewCounterpartId] = useState("");
  const [newFiles, setNewFiles] = useState([]);
  const [askBusy, setAskBusy] = useState(false);
  const [askError, setAskError] = useState("");

  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editDraft, setEditDraft] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState("");

  const [threadDeleteBusy, setThreadDeleteBusy] = useState(false);

  const scrollRef = useRef(null);

  const active = threads.find((t) => t.id === activeId) || threads[0];

  // A student opening a thread counts as having seen whatever answer is currently in it — this is
  // what lets the dashboard's "recent questions" widget drop a question once it's actually been read.
  useEffect(() => {
    if (!isTutor && active && active.status === "answered") {
      onMarkSeen(active.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTutor, active?.id, active?.status, active?.messages?.length]);

  async function handlePost() {
    const text = draft.trim();
    if ((!text && composeFiles.length === 0) || !active) return;
    setPostError("");
    setPostBusy(true);
    try {
      await onPost(active.id, text, composeFiles);
      setDraft("");
      setComposeFiles([]);
      setPreview(false);
    } catch (err) {
      setPostError(err.message || "Couldn't send that. Try again.");
    } finally {
      setPostBusy(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handlePost();
    }
  }

  function startEditMessage(message) {
    setEditingMessageId(message.id);
    setEditDraft(message.text);
    setEditError("");
  }

  function cancelEditMessage() {
    setEditingMessageId(null);
    setEditError("");
  }

  async function handleSaveEditMessage() {
    const text = editDraft.trim();
    if (!text || !active) return;
    setEditError("");
    setEditBusy(true);
    try {
      await onEditMessage(active.id, active.messages, editingMessageId, text);
      setEditingMessageId(null);
    } catch (err) {
      setEditError(err.message || "Couldn't save that edit. Try again.");
    } finally {
      setEditBusy(false);
    }
  }

  async function handleDeleteMessage(message) {
    if (!active || !window.confirm("Delete this message? This can't be undone.")) return;
    await onDeleteMessage(active.id, active.messages, message.id);
  }

  async function handleDeleteThread() {
    if (!active || !window.confirm("Delete this whole conversation? This can't be undone.")) return;
    setThreadDeleteBusy(true);
    try {
      await onDeleteThread(active.id);
      setActiveId(null);
    } finally {
      setThreadDeleteBusy(false);
    }
  }

  async function handleAsk(e) {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title || !newCounterpartId) return;
    const counterpart = counterparts.find((c) => c.id === newCounterpartId);
    if (!counterpart) return;
    setAskError("");
    setAskBusy(true);
    try {
      if (isTutor) {
        await onNewQuestion({ studentUid: counterpart.id, studentName: counterpart.name, title, files: newFiles });
      } else {
        await onNewQuestion({ tutorUid: counterpart.id, tutorName: counterpart.name, title, files: newFiles });
      }
      setNewTitle("");
      setNewCounterpartId("");
      setNewFiles([]);
      setAsking(false);
    } catch (err) {
      setAskError(err.message || "Couldn't send that. Try again.");
    } finally {
      setAskBusy(false);
    }
  }

  return (
    <div className="content-inner" style={{ height: "100%" }}>
      <div className="qna-layout">
        <div className="card qna-list-card">
          <div className="qna-list-heading">
            <span>{isTutor ? "Student questions" : "Your questions"}</span>
            <button type="button" className="qna-preview-toggle" onClick={() => setAsking((a) => !a)}>
              {asking ? "Cancel" : isTutor ? "+ New conversation" : "+ New question"}
            </button>
          </div>
          {asking && counterparts.length === 0 ? (
            <div className="qna-new-question-empty">
              {isTutor
                ? "You don't have any students on your roster yet. Add one from the Schedule page first."
                : "You don't have a tutor yet. Ask your tutor to add your email to their roster first."}
            </div>
          ) : (
            asking && (
              <form className="qna-new-question" onSubmit={handleAsk}>
                {askError && <div className="auth-error" style={{ margin: "0 0 8px 0" }}>{askError}</div>}
                <div className="qna-new-question-row">
                  <select value={newCounterpartId} onChange={(e) => setNewCounterpartId(e.target.value)} required>
                    <option value="" disabled>
                      {isTutor ? "Choose a student…" : "Choose a tutor…"}
                    </option>
                    {counterparts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <FileDropField files={newFiles} onChange={setNewFiles}>
                    <input
                      type="text"
                      placeholder={isTutor ? "What do you want to ask or share?" : "What's your question?"}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      autoFocus
                    />
                  </FileDropField>
                </div>
                <div className="qna-new-question-footer">
                  <span className="qna-compose-hint">Tip: wrap maths in $…$ (or $$…$$ for a centred equation) to render it.</span>
                  <button type="submit" className="btn btn-primary" disabled={askBusy}>
                    {isTutor ? "Start" : "Ask"}
                  </button>
                </div>
              </form>
            )
          )}
          <div className="qna-list-scroll">
            {threads.length === 0 ? (
              <div className="list-row list-row-empty">
                {isTutor ? "No questions yet." : "No questions yet — ask one above."}
              </div>
            ) : (
              threads.map((t) => (
                <button
                  key={t.id}
                  className={`qna-thread-row ${active && t.id === active.id ? "active" : ""}`}
                  onClick={() => setActiveId(t.id)}
                >
                  <div className="qna-thread-row-top">
                    {isTutor ? (
                      <PersonChip name={t.studentName} hue={hueForName(t.studentName)} />
                    ) : (
                      <TopicChip topic={t.topic} />
                    )}
                    <StatusPill status={t.status} />
                  </div>
                  <div className="qna-thread-title">
                    <MathText text={t.title} />
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="card qna-detail-card">
          {active ? (
            <>
              <div className="qna-detail-header">
                <div className="qna-detail-top">
                  {isTutor ? (
                    <PersonChip name={active.studentName} hue={hueForName(active.studentName)} />
                  ) : (
                    <TopicChip topic={active.topic} />
                  )}
                  <StatusPill status={active.status} />
                  <button
                    type="button"
                    className="link-btn"
                    style={{ marginLeft: "auto" }}
                    onClick={handleDeleteThread}
                    disabled={threadDeleteBusy}
                  >
                    Delete conversation
                  </button>
                </div>
                <div className="qna-detail-title serif">
                  <MathText text={active.title} />
                </div>
                <div className="qna-detail-sub">
                  {isTutor ? `From ${active.studentName}` : `Asked to ${active.tutorName}`}
                </div>
              </div>

              <div className="qna-messages" ref={scrollRef}>
                {active.messages.map((m) => {
                  const isTutorMsg = m.role === "tutor";
                  const isOwn = m.authorUid === profile.uid;
                  const hue = isTutorMsg ? null : hueForName(m.author);
                  return (
                    <div className="qna-message fade-up" key={m.id}>
                      <div
                        className="qna-avatar"
                        style={
                          isTutorMsg
                            ? { background: "#2E5BDB" }
                            : { background: `oklch(0.6 0.14 ${hue})` }
                        }
                      >
                        {initials(m.author)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="qna-message-head">
                          <span className="qna-message-name">{isOwn ? "You" : m.author}</span>
                          <span className="qna-role-tag">{isTutorMsg ? "Tutor" : "Student"}</span>
                          <span className="qna-message-time">
                            {formatMessageTime(m.time)}
                            {m.editedAt ? " (edited)" : ""}
                          </span>
                          {isOwn && editingMessageId !== m.id && (
                            <>
                              <button type="button" className="link-btn qna-message-action" onClick={() => startEditMessage(m)}>
                                Edit
                              </button>
                              <button type="button" className="link-btn qna-message-action" onClick={() => handleDeleteMessage(m)}>
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                        {editingMessageId === m.id ? (
                          <div className="qna-message-edit">
                            {editError && <div className="auth-error">{editError}</div>}
                            <textarea value={editDraft} onChange={(e) => setEditDraft(e.target.value)} rows={2} />
                            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                              <button className="btn btn-primary" onClick={handleSaveEditMessage} disabled={editBusy || !editDraft.trim()}>
                                Save
                              </button>
                              <button type="button" className="link-btn" onClick={cancelEditMessage}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={`qna-bubble ${isTutorMsg ? "tutor" : "student"}`}>
                            {m.text && <MathText text={m.text} />}
                            <AttachmentList attachments={m.attachments} label="Attachments" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="qna-compose">
                <div className="qna-compose-col">
                  <div className="qna-compose-toolbar">
                    <span className="qna-compose-hint">
                      Tip: wrap maths in $…$ (or $$…$$ for a centred equation) to render it.
                    </span>
                    <button
                      type="button"
                      className="qna-preview-toggle"
                      onClick={() => setPreview((p) => !p)}
                    >
                      {preview ? "Write" : "Preview"}
                    </button>
                  </div>
                  {postError && <div className="auth-error" style={{ margin: "0 0 8px 0" }}>{postError}</div>}
                  {preview ? (
                    <div className="qna-compose-preview">
                      {draft.trim() ? (
                        <MathText text={draft} />
                      ) : (
                        <span className="qna-compose-preview-empty">Nothing to preview yet.</span>
                      )}
                    </div>
                  ) : (
                    <FileDropField files={composeFiles} onChange={setComposeFiles}>
                      <textarea
                        placeholder={isTutor ? "Write your answer…" : "Ask a follow-up question…"}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={handleKeyDown}
                      />
                    </FileDropField>
                  )}
                </div>
                <button
                  className="btn btn-primary"
                  onClick={handlePost}
                  disabled={(!draft.trim() && composeFiles.length === 0) || postBusy}
                >
                  {isTutor ? "Send answer" : "Post question"}
                </button>
              </div>
            </>
          ) : (
            <div className="qna-empty-state">
              <Icon name="forum" />
              <p>{isTutor ? "Questions from your students will show up here." : "Ask your tutor a question to get started."}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
