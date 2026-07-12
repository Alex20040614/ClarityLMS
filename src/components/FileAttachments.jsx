import React, { useState } from "react";
import { Icon } from "./Common.jsx";
import { formatFileSize } from "../data.js";

export function FilePicker({ files, onChange, label }) {
  return (
    <div>
      <label className="file-picker-btn">
        <Icon name="attach_file" />
        {label}
        <input
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={(e) => onChange(Array.from(e.target.files))}
        />
      </label>
      {files.length > 0 && (
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
      )}
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
