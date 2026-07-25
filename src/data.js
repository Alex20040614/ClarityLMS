// Topic -> hue mapping used across chips, dots, calendar blocks.
export const TOPIC_HUES = {
  Quadratics: 255,
  "Quadratic Equations": 255,
  Algebra: 255,
  Trigonometry: 165,
  Calculus: 300,
  "Intro to Calculus": 300,
  Probability: 68,
  Vectors: 18,
  Logarithms: 288,
  "Mixed revision": 228,
  "New assignment": 205,
};

export function hueForTopic(topic) {
  return TOPIC_HUES[topic] ?? 235;
}

// Small deterministic hash so each person gets a stable, distinct hue.
export function hueForName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return h;
}

export function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Shortens a long email for compact display, e.g. "alexander.smith@gmail.com" -> "alexander.s…@gmail.com",
// keeping the domain intact since that's usually more useful for telling accounts apart than the tail of the local part.
export function truncateEmail(email, maxLocalChars = 10) {
  const at = email.indexOf("@");
  if (at === -1 || at <= maxLocalChars) return email;
  return `${email.slice(0, maxLocalChars)}…${email.slice(at)}`;
}

// Formats an ISO date string ("YYYY-MM-DD") as e.g. "Mon, 16 Jun". Legacy fallback only —
// prefer formatClassDay(classItem), which is timezone-aware.
export function formatClassDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// ---------- Recurring classes ----------

export const RECURRENCE_OPTIONS = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Every 2 weeks" },
];

export const RECURRENCE_MAX_COUNT = 52;

function toISODate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Expands a start date ("YYYY-MM-DD") plus a recurrence rule into the list of dates the series
// should occupy. Built from the date's local parts (not `new Date("YYYY-MM-DD")`, which parses as
// UTC and can slip a day) so the weekday never drifts. "none" yields a single date.
export function recurrenceDates(startDate, frequency, count) {
  if (!startDate) return [];
  const total = frequency === "none" ? 1 : Math.max(1, Math.min(count || 1, RECURRENCE_MAX_COUNT));
  const [y, m, d] = startDate.split("-").map(Number);
  if (!y || !m || !d) return [];
  const dates = [];
  for (let i = 0; i < total; i++) {
    const dt = new Date(y, m - 1, d);
    if (frequency === "daily") dt.setDate(dt.getDate() + i);
    else if (frequency === "weekly") dt.setDate(dt.getDate() + i * 7);
    else if (frequency === "biweekly") dt.setDate(dt.getDate() + i * 14);
    dates.push(toISODate(dt));
  }
  return dates;
}

// ---------- Booking / availability ----------

export const SLOT_MINUTES = 30;
export const DAY_SLOT_COUNT = (24 * 60) / SLOT_MINUTES; // 48 half-hour slots per day
export const REQUEST_DURATION_OPTIONS = [30, 60, 90, 120];

// Weekdays are indexed 0=Mon … 6=Sun (Monday-first, matching the week calendar), which differs from
// JS's Date.getDay() where 0=Sun. mondayWeekday() converts between them.
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function mondayWeekday(date) {
  const d = date.getDay();
  return d === 0 ? 6 : d - 1;
}

export function slotIndexToTime(i) {
  const mins = i * SLOT_MINUTES;
  return `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
}

// ["00:00", "00:30", … "23:30"]
export const DAY_SLOT_TIMES = Array.from({ length: DAY_SLOT_COUNT }, (_, i) => slotIndexToTime(i));

// Key for one cell of a tutor's recurring weekly template, e.g. "0-09:30" (Monday 09:30).
export function weeklySlotKey(weekday, time) {
  return `${weekday}-${time}`;
}

// Absolute ms-epoch instant of a slot: the given calendar day (a Date at local midnight) at the
// slot's HH:MM, in the current viewer's local timezone — the same convention classes use for startAt.
export function slotStartMs(dayDate, time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(dayDate);
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

export function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

// True if [startMs, endMs) collides with any of the tutor's busy blocks ({ startAt, duration }).
export function overlapsBusy(busy, startMs, endMs) {
  return (busy || []).some((b) =>
    rangesOverlap(startMs, endMs, b.startAt, b.startAt + (b.duration || 60) * 60000)
  );
}

// True if every 30-min slot a class of `duration` would occupy is in the tutor's weekly template.
// A booking that would cross midnight is rejected (returns false) to keep each class within one day.
export function rangeTemplateAvailable(availableSet, dayDate, startTime, duration) {
  const startIdx = DAY_SLOT_TIMES.indexOf(startTime);
  if (startIdx < 0) return false;
  const needed = duration / SLOT_MINUTES;
  const weekday = mondayWeekday(dayDate);
  for (let k = 0; k < needed; k++) {
    const idx = startIdx + k;
    if (idx >= DAY_SLOT_COUNT) return false; // would spill past midnight
    if (!availableSet.has(weeklySlotKey(weekday, DAY_SLOT_TIMES[idx]))) return false;
  }
  return true;
}

// Resolves a class's start instant as an absolute ms-epoch timestamp. Classes created after the
// timezone fix store `startAt` directly (computed in the scheduling tutor's own local timezone at
// creation time, so it's already an unambiguous absolute instant). Older classes only have naive
// date/time strings, so as a fallback we interpret those in the CURRENT VIEWER's local timezone —
// not perfectly correct if tutor and student are in different zones, but it's the best guess
// available for data that predates timezone tracking.
export function classStartMs(classItem) {
  if (classItem.startAt) return classItem.startAt;
  if (!classItem.date || !classItem.time) return null;
  const d = new Date(`${classItem.date}T${classItem.time}`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// Returns the first class in `existingClasses` whose time overlaps the proposed
// [startMs, startMs + durationMin) window, or null if the slot is free — used to stop a tutor
// double-booking themselves. Pass ignoreId to skip a class being rescheduled in place.
export function findClassConflict(existingClasses, startMs, durationMin, ignoreId = null) {
  if (startMs == null) return null;
  const endMs = startMs + (Number(durationMin) || 60) * 60000;
  for (const c of existingClasses) {
    if (ignoreId && c.id === ignoreId) continue;
    const cStart = classStartMs(c);
    if (cStart == null) continue;
    const cEnd = cStart + (Number(c.duration) || 60) * 60000;
    if (rangesOverlap(startMs, endMs, cStart, cEnd)) return c;
  }
  return null;
}

// Returns a class's attendees as [{uid, name}, ...]. Classes now store a `students` array (a class
// can have multiple attendees), but older classes only have a single `studentUid`/`studentName` —
// this normalizes both shapes so display code never has to care which one it's looking at.
export function classStudents(classItem) {
  if (classItem.students) return classItem.students;
  if (classItem.studentUid) return [{ uid: classItem.studentUid, name: classItem.studentName }];
  return [];
}

// Joins a class's attendee names for display, e.g. "Alice Chen" or "Alice Chen, Bo Diaz".
export function classStudentNames(classItem) {
  return classStudents(classItem)
    .map((s) => s.name)
    .join(", ");
}

// A class counts as "upcoming" until 5 minutes after its start time.
export function isClassUpcoming(classItem, now = Date.now()) {
  const startMs = classStartMs(classItem);
  if (startMs == null) return true;
  return now < startMs + 5 * 60 * 1000;
}

// Formats a class's day in the current viewer's own local timezone, e.g. "Mon, 16 Jun".
export function formatClassDay(classItem) {
  const startMs = classStartMs(classItem);
  if (startMs == null) return formatClassDate(classItem.date);
  return new Date(startMs).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// Formats just a class's start time (no end/range), rendered in the current viewer's own local timezone.
export function formatClassStartTime(classItem) {
  const startMs = classStartMs(classItem);
  if (startMs == null) return classItem.time || "";
  return new Date(startMs).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
}

// Formats a class's start–end time as e.g. "15:30 – 16:15", rendered in the current viewer's own
// local timezone (so a tutor and student in different timezones each see their own correct time).
// Classes created before duration was required have no stored duration, so those fall back to an
// assumed 60 minutes. If the class runs past midnight in the viewer's timezone, the end time is
// marked "(+1d)" so it isn't misread as earlier than the start.
export function formatTimeRange(classItem) {
  const startMs = classStartMs(classItem);
  if (startMs == null) return "";
  const duration = Number(classItem.duration) || 60;
  const start = new Date(startMs);
  const end = new Date(startMs + duration * 60 * 1000);
  const fmt = (d) => d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const sameDay = start.toDateString() === end.toDateString();
  return sameDay ? `${fmt(start)} – ${fmt(end)}` : `${fmt(start)} – ${fmt(end)} (+1d)`;
}

// Formats a duration in minutes as e.g. "45 min" or "1 hr 30 min".
export function formatDuration(minutes) {
  const mins = Number(minutes);
  if (!mins) return "";
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rest = mins % 60;
  const hrLabel = `${hrs} hr${hrs === 1 ? "" : "s"}`;
  return rest === 0 ? hrLabel : `${hrLabel} ${rest} min`;
}

// Formats an hours balance for display, e.g. "1.5 hrs", "0 hrs", "-2 hrs". Trims trailing zeros so
// whole numbers read cleanly while fractional lesson lengths (0.25, 1.5) still show.
export function formatHours(hours) {
  const n = Math.round((Number(hours) || 0) * 100) / 100;
  const label = Number.isInteger(n) ? String(n) : String(n);
  return `${label} ${Math.abs(n) === 1 ? "hr" : "hrs"}`;
}

// Formats a byte count as e.g. "480 B", "12.3 KB", "1.4 MB".
export function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Resolves a task's due instant as an absolute ms-epoch timestamp, same approach as classStartMs:
// prefer the timezone-safe `dueAt`, falling back to naive string interpretation for older tasks.
export function taskDueMs(task) {
  if (task.dueAt) return task.dueAt;
  if (!task.dueDate) return null;
  const d = new Date(`${task.dueDate}T${task.dueTime || "23:59"}`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// Formats just a task's due day (no time), rendered in the viewer's own local timezone — used to
// group task history entries by the date they were due.
export function formatTaskDueDay(task) {
  const dueMs = taskDueMs(task);
  if (dueMs == null) return "No due date";
  return new Date(dueMs).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

// Returns a short due label (rendered in the current viewer's own local timezone) plus a colour
// tone ("red" overdue, "amber" due soon, "green" submitted/reviewed, "muted" otherwise).
export function taskDueInfo(task) {
  if (task.status === "reviewed") return { label: "Reviewed", tone: "green" };
  if (task.status === "submitted") return { label: "Submitted", tone: "green" };
  const dueMs = taskDueMs(task);
  if (dueMs == null) return { label: "", tone: "muted" };
  const d = new Date(dueMs);
  const label =
    d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" }) +
    ", " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", hour12: false });
  const diffMs = dueMs - Date.now();
  if (diffMs < 0) return { label: `Overdue · ${label}`, tone: "red" };
  if (diffMs < 24 * 60 * 60 * 1000) return { label: `Due soon · ${label}`, tone: "amber" };
  return { label, tone: "muted" };
}

// Formats a ms-epoch timestamp as a short relative/absolute time for chat messages.
export function formatMessageTime(ms) {
  if (!ms) return "";
  const diffMs = Date.now() - ms;
  if (diffMs < 60_000) return "Just now";
  const d = new Date(ms);
  const isToday = d.toDateString() === new Date().toDateString();
  if (isToday) return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// True once the tutor has answered (thread status "answered") AND the student has already opened
// the thread since that answer arrived — i.e. there's nothing new left for the student to see here.
export function studentHasSeenAnswer(thread) {
  if (thread.status !== "answered") return false;
  const lastMessage = thread.messages?.[thread.messages.length - 1];
  if (!lastMessage) return false;
  return Boolean(thread.studentSeenAt) && thread.studentSeenAt >= lastMessage.time;
}

// ---------- AI Tutor ----------

export const AI_SYSTEM_PROMPT =
  "You are Clarity, an AI study coach for a high-school maths student. Don't just give final answers — coach their thinking. Break problems into steps, ask one guiding question, model good study habits, and show how to prompt AI well. Keep replies under 110 words, warm and plain (no markdown headers). Write maths notation as LaTeX wrapped in $ for inline or $$ for display (e.g. $x^2$), never as plain ASCII like x^2 or unicode superscripts. End by inviting their next step.";

export const AI_FALLBACK_REPLY =
  "Let's not jump straight to the answer — that's how we actually learn it. Here's how I'd tackle this:\n\n1. Write down what you know and what the question is really asking.\n2. Try the first step yourself, then tell me where you get stuck.\n3. We'll check each step together and I'll give hints, not the solution.\n\nWant to start with step 1? Share your working and I'll nudge you in the right direction.";

export const AI_GREETING =
  "Hi! I'm your AI study coach. I won't just hand you answers — I'll help you understand the maths and learn to study with AI. What are we working on today?";

export const AI_TITLE_PROMPT =
  "Summarise this tutoring conversation into a concise title of at most 6 words for a chat-history list. Capture the specific maths topic. Write any maths notation as LaTeX wrapped in single $ (e.g. $x^2$), never as plain ASCII or unicode. Reply with only the title — no surrounding quotes, no trailing punctuation, no explanation.";

export const SUGGESTED_PROMPTS = [
  "Make me a study plan for quadratics this week",
  "Quiz me on the trig identities I need for the test",
  "Explain completing the square like I'm 15",
  "Check my reasoning on this probability question",
];

export const PROMPT_TIPS = [
  {
    icon: "route",
    title: "Ask for steps, not answers",
    body: 'Say "guide me" or "don\'t give the final answer yet" so you do the thinking.',
  },
  {
    icon: "edit_note",
    title: "Show your attempt",
    body: "Share your working — feedback that targets your reasoning is far more useful.",
  },
  {
    icon: "quiz",
    title: 'Finish with "quiz me"',
    body: "Test recall before a test instead of just re-reading notes.",
  },
];
