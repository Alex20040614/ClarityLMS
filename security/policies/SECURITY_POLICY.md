# Security Policy — Clarity

**Last updated:** 2026-07-07
**Owner:** Haoze Li

## 1. Purpose

This policy states the security controls Clarity commits to maintaining, and the process for
reporting a suspected vulnerability. It reflects controls actually in place, not aspirational goals.

## 2. Data classification

- **Authentication credentials**: managed entirely by Firebase Authentication; Clarity never stores
  passwords itself.
- **Third-party OAuth tokens** (Zoom access/refresh tokens): treated as the most sensitive data class
  Clarity holds, since possession of a valid token grants the ability to act on a tutor's Zoom account.
- **Personal data**: names, email addresses, and role (tutor/student) for account holders; class and
  task content (titles, notes, file attachments) associated with tutor-student relationships;
  Q&A message content between tutors and students.

## 3. Access control

- All data access is mediated by Firebase Authentication plus Firestore/Storage Security Rules, which
  are enforced server-side and cannot be bypassed by a compromised or malicious client.
- Access is scoped to the minimum necessary relationship: a user can only read/write documents where
  they are a named participant (tutor or enrolled student) — verified in rules, not application code.
- The `zoomConnections` collection, holding encrypted OAuth tokens, denies all direct client
  read/write access. It is reachable only through specific Cloud Functions using the Admin SDK.
- Secrets (Zoom client secret, token-encryption key) are stored in Google Cloud Secret Manager with
  access limited to the Cloud Functions service identity that needs them, and are never present in
  source control, build artifacts, or client-side code.

## 4. Data protection

- **In transit**: all connections (Hosting, Cloud Functions, Firestore/Storage, and calls to the Zoom
  API) use HTTPS with a TLS 1.2 minimum, enforced by Google's front-end infrastructure and verified
  directly against the production endpoints.
- **At rest**: all Firestore and Storage data is encrypted at rest by default (Google-managed
  encryption). Zoom OAuth tokens receive an additional application-layer encryption pass
  (AES-256-GCM) before being written, so a Firestore-level data exposure alone would not disclose
  usable tokens.

## 5. Vulnerability scanning

- Static Application Security Testing (SAST) is run against the full application codebase using
  Semgrep's community rule sets (including a dedicated secrets-detection pass) before security-relevant
  releases.
- Dependency vulnerabilities are checked via `npm audit` against both the frontend and Cloud Functions
  package trees.
- Findings and remediation status are tracked in `security/scans/` and the Vulnerability Management
  Procedures document.

## 6. Incident response

Suspected security incidents are handled per the Incident Management and Response Policy
(`security/policies/INCIDENT_RESPONSE.md`).

## 7. Reporting a vulnerability

Security issues can be reported to **alexliwork123@gmail.com**. Reports are acknowledged and triaged
as described in the Incident Management and Response Policy.

## 8. Policy review

This policy is reviewed whenever a material change is made to authentication, authorization, or
third-party integrations (such as the Zoom integration), and at minimum every 12 months.
