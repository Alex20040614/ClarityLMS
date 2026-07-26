# Clarity

Clarity is a maths tutoring platform connecting tutors and students: scheduling classes, assigning
and submitting tasks, asking and answering questions with LaTeX support, and an AI study coach.

## Features

- **Accounts** — email/password and Google sign-in, password reset, role chosen at signup (tutor or
  student).
- **Roster & hours** — tutors add students by email and track each student's remaining tutoring
  hours; booking or creating a class deducts hours automatically (cancelling refunds them), with a
  manual editor and a low/negative-balance warning when booking past what's left.
- **Schedule** — tutors create classes (single or multiple students at once), attach materials, and
  add a meeting link (Zoom, Google Meet, or any other provider) for students to join. A week-view
  calendar shows upcoming classes, timezone-safe for every viewer.
- **Booking & availability** — tutors paint a recurring weekly availability template on a drag (or
  tap, on touch devices) grid; students request a class in an open slot; the tutor accepts (with
  automatic schedule-conflict and insufficient-hours checks) or declines, and students can cancel a
  pending request.
- **Tasks** — tutors assign tasks (to one or many students at once) with a due date, notes, and file
  attachments; students submit with their own notes and files. Completed/reviewed tasks move into a
  per-student task history view.
- **Q&A** — threaded questions and answers between a tutor and a student, with LaTeX rendering
  (wrap maths in `$...$` or `$$...$$`), file attachments of any type, drag-and-drop onto the message
  box, message editing/deletion, and whole-conversation deletion.
- **Dashboard** — a role-specific overview: upcoming classes, tasks due/to review, and questions
  awaiting a reply or recently answered. Tutors also get an end-of-day debrief modal summarizing
  today's classes.
- **Profile** — edit your display name, upload and crop/reposition a photo, or pick from a set of
  preset avatar icons.
- **AI Tutor** — a Gemini-powered study coach that guides students through problems rather than just
  giving answers, with persisted chat history (start new chats, revisit or delete past ones).
- **Mobile-friendly** — a responsive layout across every page: a collapsible nav drawer, stacking
  grids, single-pane Q&A/AI Tutor views on narrow screens, and touch support on the availability
  grid.
- **Privacy Policy** — a public page at `/privacy`, reachable without signing in.

## Tech stack

- **Frontend**: React 18 + Vite. No router library — the current view is local component state kept
  in sync with the browser URL/history (`pushState` + `popstate`) so a refresh or the back button
  lands back on the same page.
- **Backend**: Firebase — Authentication, Firestore, Storage, all governed by security rules that
  enforce access is scoped to the actual tutor/student participants of each class, task, or thread
- **Maths rendering**: KaTeX
- **AI**: Google Gemini (`gemini-2.5-flash`) via direct REST calls from the client

There is no backend server or Cloud Functions component — everything runs as a static frontend
talking directly to Firebase and the Gemini API.

## Getting started

### Prerequisites

- Node.js 18+
- A Firebase project with **Authentication** (Email/Password and Google providers enabled),
  **Firestore**, and **Storage** turned on
- (Optional) A Google Gemini API key, for the AI Tutor feature

### Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` with your Firebase project's web app config (Project Settings → General → Your apps)
and, optionally, a Gemini API key:

```
VITE_GEMINI_API_KEY=

VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

If `VITE_GEMINI_API_KEY` is left blank, the AI Tutor falls back to a static reply instead of failing.

### Run locally

```bash
npm run dev
```

### Build for production

```bash
npm run build
npm run preview   # preview the production build locally
```

## Deploying

This project deploys to Firebase Hosting, with Firestore and Storage security rules deployed
alongside it:

```bash
npm run build
firebase deploy --only hosting,firestore:rules,storage
```

(Requires the [Firebase CLI](https://firebase.google.com/docs/cli) and being logged in with
`firebase login`, with `.firebaserc` pointing at your project.)

## Project structure

```
src/
  auth/          Firebase Authentication hook and error helpers
  components/    Shared UI (Sidebar, Header, WeeklyAvailabilityGrid, PhotoCropModal,
                 ClassDetailModal, DailyDebriefModal, file attachments, etc.)
  hooks/         Small reusable hooks (e.g. a live-updating "now" clock)
  services/      Firestore/Storage access — classroom.js, tasks.js, qna.js, ai.js, aiChat.js,
                 availability.js, classRequests.js, profile.js
  views/         Top-level pages (Dashboard, Schedule, Booking, Tasks, QnA, AITutor, Profile,
                 Privacy Policy, auth)
  data.js        Formatting helpers, topic/hue mappings, the AI system prompt
  firebase.js    Firebase app initialization
public/          Static assets copied as-is into the build (favicon, etc.)
firestore.rules  Firestore security rules
storage.rules    Storage security rules
security/        Security & compliance documentation (SSDLC, policies, scan results)
```

## Data model (Firestore)

- `users` — account profile: name, email, role (`tutor` or `student`), photo URL
- `rosterLinks` — tutor–student pairings, including the student's remaining-hours balance
- `classes` — scheduled classes; `students`/`studentUids` support multiple attendees per class
- `classRequests` — a student's request to book a class in an open slot, with status
  (`pending`/`accepted`/`declined`) and who resolved it
- `availability` — one document per tutor: their recurring weekly availability template and a
  privacy-safe "busy" feed derived from their classes
- `tasks` — one document per student per assignment, even when assigned to a group at once
- `qnaThreads` — a tutor–student Q&A conversation, with messages stored as an array field on the
  thread document
- `aiChats` — a user's persisted AI Tutor conversation history

## Security

Firestore and Storage rules restrict every document/file to its actual participants (the tutor and
student(s) involved), verified server-side — never trusted to the client. See
[`security/README.md`](security/README.md) for the fuller security and compliance documentation,
including a real SAST/DAST scan history and known open items.
