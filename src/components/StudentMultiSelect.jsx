import React, { useEffect, useRef, useState } from "react";
import { Icon } from "./Common.jsx";
import { hueForName, initials } from "../data.js";

// A collapsible checkbox list for batch-selecting one or more students from the tutor's roster —
// used anywhere a tutor assigns something (a class, a task) to a group rather than a single student.
// Collapsed by default and shows the current picks as removable chips, so a large roster doesn't
// dominate the form; the tutor expands it only when they actually need to change the selection.
export default function StudentMultiSelect({ roster, selectedUids, onChange }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function toggle(uid) {
    if (selectedUids.includes(uid)) {
      onChange(selectedUids.filter((u) => u !== uid));
    } else {
      onChange([...selectedUids, uid]);
    }
  }

  const selected = roster.filter((r) => selectedUids.includes(r.studentUid));

  return (
    <div className="student-multiselect" ref={containerRef}>
      <button
        type="button"
        className="student-multiselect-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="student-multiselect-summary">
          {selected.length === 0 ? (
            <span className="student-multiselect-placeholder">Select students…</span>
          ) : (
            selected.map((r) => {
              const h = hueForName(r.studentName);
              return (
                <span key={r.studentUid} className="student-multiselect-chip">
                  <span className="avatar-dark" style={{ width: 20, height: 20, fontSize: 9, background: `oklch(0.6 0.14 ${h})` }}>
                    {initials(r.studentName)}
                  </span>
                  {r.studentName}
                  <span
                    className="student-multiselect-chip-remove"
                    role="button"
                    tabIndex={-1}
                    aria-label={`Remove ${r.studentName}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(r.studentUid);
                    }}
                  >
                    <Icon name="close" />
                  </span>
                </span>
              );
            })
          )}
        </div>
        <Icon name={open ? "expand_less" : "expand_more"} />
      </button>

      {open && (
        <div className="student-multiselect-list">
          {roster.map((r) => {
            const checked = selectedUids.includes(r.studentUid);
            return (
              <label key={r.studentUid} className={`student-multiselect-item ${checked ? "checked" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(r.studentUid)} />
                {r.studentName}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
