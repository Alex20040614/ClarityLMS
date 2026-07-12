# Secure Software Development Lifecycle (SSDLC) — Clarity

**Last updated:** 2026-07-07
**Owner:** Haoze Li (sole developer)
**Applies to:** Clarity web application (frontend), Cloud Functions backend, and the Zoom integration specifically.

## 1. Overview

Clarity is a small maths-tutoring web application built on React/Vite (frontend) and Firebase
(Authentication, Firestore, Storage, Cloud Functions). This document describes the actual practices
followed during development, not an aspirational framework — every item below reflects the current
state of the codebase and tooling as of this writing.

## 2. Source control and change management

- All application source code is tracked in a local Git repository (initialized 2026-07-07).
  `.gitignore` excludes `node_modules`, build output (`dist`), `.env`/`.env.local`, and Firebase debug
  logs, so no dependency artifacts or secrets are ever committed.
- Secrets (Zoom OAuth client ID/secret, token-encryption key) are never stored in source files or
  environment files checked into the repository. They are provisioned directly into Google Cloud
  Secret Manager via the Firebase CLI (`firebase functions:secrets:set`) and referenced in code only
  via `defineSecret(...)`, which resolves the value at runtime inside the Cloud Functions execution
  environment.
- Environment-specific frontend configuration (Firebase project config, OAuth client ID, redirect URI)
  is supplied via Vite env files (`.env`, not committed) and consumed through `import.meta.env`.

## 3. Environments

- **Production**: the live Firebase project (`parabola-6a220`), serving the frontend from Firebase
  Hosting (`https://parabola-6a220.web.app`) and the backend from Cloud Functions (2nd gen, Node.js 20,
  `us-central1`).
- **Local development**: the same Firebase project's Firestore/Storage/Auth/Functions are used directly
  (no local emulator suite is currently in use); the frontend runs via `vite dev` on `localhost` during
  active development.

## 4. Secure coding practices

- **Authentication**: all user-facing data access goes through Firebase Authentication (email/password
  and Google OAuth). No custom session/token handling exists in application code.
- **Authorization**: enforced server-side via Firestore Security Rules and Storage Security Rules —
  never trusted to the client. Rules are participant-scoped (e.g., a class is only readable by its
  tutor or one of its enrolled students, verified via `resource.data.tutorUid` / `studentUids`
  array-membership checks) and immutable-field checks prevent a client from rewriting ownership fields
  on update.
- **Least-privilege collections**: the `zoomConnections` collection (holding encrypted Zoom OAuth
  tokens) has `allow read, write: if false` in Firestore rules — no client, authenticated or not, can
  read or write it directly. It is only ever touched by the Cloud Functions backend using the Admin SDK,
  which bypasses security rules by design and is the sole trusted access path.
- **Secrets handling**: the Zoom OAuth client secret and the token-encryption key are stored exclusively
  in Secret Manager and injected into Cloud Functions at invocation time via `defineSecret`. They are
  never logged, never returned in API responses, and never present in client-side code or bundles.
- **Sensitive data at rest**: Zoom access/refresh tokens are encrypted at the application layer
  (AES-256-GCM, random IV per value, authenticated) before being written to Firestore, in addition to
  Firestore's own default at-rest encryption. See `security/scans/SAST-DAST-summary.md` for detail.
- **Transport security**: all traffic (Firebase Hosting, Cloud Functions, Firestore/Storage APIs, and
  calls to the Zoom API) is served exclusively over HTTPS; Google's front-end infrastructure enforces a
  TLS 1.2 minimum for all of these endpoints (verified empirically — see SAST/DAST summary).

## 5. Dependency management

- Dependencies are managed via `npm` with committed lockfiles (`package-lock.json`) for both the
  frontend and the `functions` codebase, ensuring reproducible installs.
- `npm audit` is run against both codebases as part of this review process (see Vulnerability
  Management Procedures) and will be run on a recurring basis going forward, not only during incident
  response.

## 6. Testing before release

- Given the current team size (one developer), testing is manual and scenario-driven rather than an
  automated CI test suite: new features are exercised end-to-end in a real browser (including
  multi-account scenarios — e.g., a tutor and multiple student accounts interacting concurrently) before
  being considered complete.
- Static analysis (SAST) and dependency scanning are run before each security-relevant release (see
  `security/scans/`).
- Firestore/Storage security rule changes are deployed via `firebase deploy --only firestore:rules` /
  `firebase deploy --only storage` and manually verified against real authenticated sessions for each
  affected role (tutor/student) before being considered complete.

## 7. Deployment

- Deployments are performed directly via the Firebase CLI (`firebase deploy`), scoped to only the
  targets that changed (`functions`, `hosting`, `firestore:rules`, `storage`) to minimize blast radius
  of any single deploy.
- There is currently no automated CI/CD pipeline; deploys are performed manually by the developer.
  This is a known gap for a single-developer project at this stage and is tracked as a future
  improvement (see Vulnerability Management Procedures, Section 5).

## 8. Roadmap / known gaps

This document is intentionally honest about current limitations rather than describing an idealized
process:

- No automated CI/CD pipeline or automated test suite yet — planned as the team/user base grows.
- No formal code review process, since there is currently one developer. If additional developers
  join, pull-request-based review will be introduced before merge.
- Runtime for Cloud Functions is Node.js 20, which Google has deprecated (end-of-support 2026-10-30);
  an upgrade to a supported runtime is tracked (see Vulnerability Management Procedures).
