import React, { useEffect, useReducer, useRef } from "react";
import { DAY_SLOT_TIMES, WEEKDAY_LABELS, weeklySlotKey } from "../data.js";

const ROW_HEIGHT = 18; // keep in sync with .avail-cell height in styles.css

// Where to park the scroll on first render: an hour before the tutor's earliest available slot, or
// 08:00 if the template is empty — so a fresh grid opens on working hours, not dead midnight rows.
function initialScrollTop(available) {
  let earliestIdx = 16; // 08:00
  for (const key of available) {
    const time = key.slice(key.indexOf("-") + 1);
    const idx = DAY_SLOT_TIMES.indexOf(time);
    if (idx >= 0) earliestIdx = Math.min(earliestIdx, idx);
  }
  const target = Math.max(0, earliestIdx - 2);
  return target * ROW_HEIGHT;
}

// The tutor's recurring weekly template: a 7-day × 48-slot grid. Click or click-drag to paint slots
// available/unavailable; the drag's direction (add vs remove) is fixed by the first cell pressed, so
// sweeping across a block sets them all the same way — like painting availability in Outlook. Changes
// are held locally during a drag and committed once on release via onChange(nextSlotKeys).
export default function WeeklyAvailabilityGrid({ available, onChange, disabled }) {
  const setRef = useRef(new Set(available));
  const dragRef = useRef(null); // { mode: "add" | "remove" } while a drag is in progress
  const dirtyRef = useRef(false);
  const scrollRef = useRef(null);
  const scrolledRef = useRef(false);
  const [, bump] = useReducer((n) => n + 1, 0);

  // Park the scroll on working hours once, on first mount.
  useEffect(() => {
    if (scrolledRef.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = initialScrollTop(Array.from(setRef.current));
    scrolledRef.current = true;
  });

  // Adopt external updates (e.g. the live snapshot echoing our own write, or a "Clear all") except
  // mid-drag, when the local paint is the source of truth until release.
  useEffect(() => {
    if (!dragRef.current) {
      setRef.current = new Set(available);
      bump();
    }
  }, [available]);

  useEffect(() => {
    function endDrag() {
      if (dragRef.current && dirtyRef.current) onChange(Array.from(setRef.current));
      dragRef.current = null;
      dirtyRef.current = false;
    }
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [onChange]);

  function paint(key, mode) {
    const has = setRef.current.has(key);
    if (mode === "add" && has) return;
    if (mode === "remove" && !has) return;
    if (mode === "add") setRef.current.add(key);
    else setRef.current.delete(key);
    dirtyRef.current = true;
    bump();
  }

  // Mouse supports the click-and-sweep gesture (paint committed on the later window "pointerup").
  // Touch/pen can't reuse that gesture — a drag across cells is indistinguishable from the user
  // trying to scroll the grid — so a touch tap instead toggles just that one cell and commits
  // immediately, leaving native scrolling untouched.
  function handleDown(e, key) {
    if (disabled) return;
    const mode = setRef.current.has(key) ? "remove" : "add";
    if (e.pointerType === "mouse") {
      dragRef.current = { mode };
      paint(key, mode);
    } else {
      paint(key, mode);
      onChange(Array.from(setRef.current));
    }
  }

  function handleEnter(key) {
    if (dragRef.current) paint(key, dragRef.current.mode);
  }

  const set = setRef.current;

  return (
    <div className="avail-grid-wrap" ref={scrollRef}>
      <div className="avail-grid">
        <div className="avail-grid-corner" />
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="avail-grid-daylabel">
            {label}
          </div>
        ))}
        {DAY_SLOT_TIMES.map((time) => {
          const isHour = time.endsWith(":00");
          return (
            <React.Fragment key={time}>
              <div className={`avail-grid-timelabel ${isHour ? "hour" : ""}`}>{isHour ? time : ""}</div>
              {WEEKDAY_LABELS.map((_, weekday) => {
                const key = weeklySlotKey(weekday, time);
                const on = set.has(key);
                return (
                  <div
                    key={key}
                    className={`avail-cell ${on ? "on" : ""} ${isHour ? "hour" : ""}`}
                    onPointerDown={(e) => handleDown(e, key)}
                    onPointerEnter={() => handleEnter(key)}
                    role="button"
                    aria-pressed={on}
                    aria-label={`${WEEKDAY_LABELS[weekday]} ${time} ${on ? "available" : "unavailable"}`}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
