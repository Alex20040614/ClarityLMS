# Incident Management and Response Policy — Clarity

**Last updated:** 2026-07-07
**Owner:** Haoze Li

## 1. Purpose

Defines how Clarity detects, responds to, and communicates about a security incident — an event that
compromises the confidentiality, integrity, or availability of user data or the systems that hold it
(e.g., unauthorized access to an account, exposure of Zoom OAuth tokens, a Firestore rules
misconfiguration that leaks data across tutor/student boundaries).

## 2. Detection

Given the current scale (single developer, early-stage user base), detection relies on:

- **Google Cloud / Firebase built-in monitoring**: Cloud Functions error logs (via `firebase-functions/logger`,
  already used throughout `functions/index.js`), Firebase Authentication anomaly alerts, and Google
  Cloud's own infrastructure-level abuse detection.
- **Direct reports**: from tutors/students noticing unexpected behavior, or from the vulnerability
  reporting channel described in the Security Policy (alexliwork123@gmail.com).
- **Manual review**: periodic review of Firestore/Storage security rules and Cloud Functions logs,
  especially after any change to authentication, authorization, or the Zoom integration.

## 3. Severity classification

| Severity | Definition | Example |
|----------|------------|---------|
| Critical | Confirmed unauthorized access to user data or account credentials at scale | Zoom tokens or user PII exposed/exfiltrated; auth bypass allowing cross-account data access |
| High | A vulnerability that could plausibly lead to unauthorized access, not yet confirmed exploited | A Firestore rule gap allowing a user to read another user's documents |
| Medium | A vulnerability with limited blast radius or requiring unusual conditions to exploit | A dependency vulnerability in a library not reachable by untrusted input |
| Low | Best-practice gap with no direct exploit path identified | Missing security header, verbose error message |

## 4. Response process

1. **Contain**: for a confirmed Critical/High incident involving Zoom tokens, immediately revoke the
   affected connection(s) (`disconnectZoomAccount`-equivalent deletion of the `zoomConnections`
   document) and, if the Zoom app's own client secret may be compromised, rotate it immediately via
   Secret Manager (`firebase functions:secrets:set`) and redeploy.
2. **Assess scope**: identify which users/accounts/data are affected using Firestore document
   ownership fields and Cloud Functions logs.
3. **Remediate**: fix the underlying cause (code, rules, or configuration) and redeploy
   (`firebase deploy --only <affected target>`).
4. **Verify**: confirm the fix closes the gap (manual re-test of the affected flow, or a targeted
   Semgrep/rules test) before considering the incident closed.
5. **Notify**: affected users are notified directly (by email, using the address on file) as soon as
   practical once containment is confirmed, describing what happened, what data was involved, and what
   action (if any) they should take (e.g., reconnecting Zoom after a forced disconnect).

## 5. Timelines

Given the current single-developer operating model, target timelines are:

- **Acknowledgement** of a reported issue: within 48 hours.
- **Containment** of a confirmed Critical incident: as immediate as technically possible, typically
  within hours (revoking a Firestore document or a Secret Manager value is a fast operation).
- **User notification** for a confirmed data-exposure incident: within 72 hours of confirmation.

## 6. Post-incident

After any Critical or High severity incident, a brief written record is kept (what happened, root
cause, fix applied, date) so the same class of issue can be checked for elsewhere in the codebase. This
feeds into the Vulnerability Management Procedures' recurring-scan scope.

## 7. Contact

Reports and questions: **alexliwork123@gmail.com**.
