import React, { useRef, useState } from "react";
import { Icon } from "./Common.jsx";
import { formatFileSize } from "../data.js";

function FileChipList({ files, onChange }) {
  if (files.length === 0) return null;
  return (
    <div className="file-list">
      {files.map((f, i) => (
        <div className="file-chip" key={`${f.name}-${i}`}>
          <Icon name="description" />
          <span className="file-chip-name">{f.name}</span>
          <span className="file-chip-size">{formatFileSize(f.size)}</span>
          <button
            type="button"
            className="file-chip-remove"
            onClick={() => onChange(files.filter((_, idx) => idx !== i))}
            aria-label="Remove file"
          >
            <Icon name="close" />
          </button>
        </div>
      ))}
    </div>
  );
}

// Wraps a textarea/input (passed as children) so files can be dropped directly onto it, with a
// small attach button sitting beside it for click-to-browse — used wherever notes/messages and
// file attachments are composed together in one action, instead of a separate drop-zone box.
export function FileDropField({ files, onChange, children }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  function addFiles(fileList) {
    onChange([...files, ...Array.from(fileList)]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div className="file-drop-field">
      <div
        className={`file-drop-row ${dragOver ? "drag-over" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {children}
        <button
          type="button"
          className="file-attach-side-btn"
          onClick={() => inputRef.current?.click()}
          aria-label="Attach files"
        >
          <Icon name="attach_file" />
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      <FileChipList files={files} onChange={onChange} />
    </div>
  );
}

export function FilePicker({ files, onChange, label }) {
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList) {
    onChange([...files, ...Array.from(fileList)]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  }

  return (
    <div
      className={`file-drop-zone ${dragOver ? "drag-over" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <label className="file-picker-btn">
        <Icon name="attach_file" />
        {label}
        <input
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => addFiles(e.target.files)}
        />
      </label>
      <div className="file-drop-hint">or drag &amp; drop files here</div>
      <FileChipList files={files} onChange={onChange} />
    </div>
  );
}

function AttachmentRow({ file, onRemove }) {
  const [busy, setBusy] = useState(false);

  async function handleRemove() {
    setBusy(true);
    try {
      await onRemove(file);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="file-chip">
      <Icon name="description" />
      <a className="file-chip-link" href={file.url} target="_blank" rel="noreferrer">
        {file.name}
      </a>
      <span className="file-chip-size">{formatFileSize(file.size)}</span>
      {onRemove && (
        <button type="button" className="file-chip-remove" onClick={handleRemove} disabled={busy} aria-label="Remove attachment">
          <Icon name="close" />
        </button>
      )}
    </div>
  );
}

// Set onRemove to allow removing individual files (e.g. a tutor removing their own
// class materials or task attachments). Omit it for read-only lists, like a student's
// view of a tutor's materials, or a tutor viewing a student's submission.
export function AttachmentList({ attachments, label, onRemove }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <div>
      <div className="task-attachments-label">{label}</div>
      <div className="file-list">
        {attachments.map((f, i) => (
          <AttachmentRow key={`${f.path || f.name}-${i}`} file={f} onRemove={onRemove} />
        ))}
      </div>
    </div>
  );
}
