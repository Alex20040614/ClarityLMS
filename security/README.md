# Security & Compliance Evidence — Clarity

This folder contains the evidence produced in response to Zoom Marketplace's "App Beta - Insufficient
Evidence" rejection (2026-07-07), which required, at minimum: evidence of an SSDLC, SAST & DAST scan
results, a Privacy Policy, TLS 1.2+ support, and any three of {penetration test summary, security
policy, incident management and response policy, vulnerability management procedures, infrastructure/
dependency management policy}.

## Mapping to Zoom's requirements

| Zoom requirement | Document |
|---|---|
| Evidence of SSDLC | [`policies/SSDLC.md`](policies/SSDLC.md) |
| SAST & DAST scan results | [`scans/SAST-DAST-summary.md`](scans/SAST-DAST-summary.md) (raw scan output in `scans/`) |
| Privacy Policy | [`policies/PRIVACY_POLICY.md`](policies/PRIVACY_POLICY.md) |
| TLS 1.2+ support | Verified in `scans/SAST-DAST-summary.md`, Section 3 |
| **Any 3 of the following:** | |
| — Security policy | [`policies/SECURITY_POLICY.md`](policies/SECURITY_POLICY.md) |
| — Incident management and response policy | [`policies/INCIDENT_RESPONSE.md`](policies/INCIDENT_RESPONSE.md) |
| — Vulnerability management procedures | [`policies/VULNERABILITY_MANAGEMENT.md`](policies/VULNERABILITY_MANAGEMENT.md) |
| (Penetration test summary — not included) | We do not have a third-party penetration test; the three items above were chosen instead, as permitted ("any three"). |
| (Infrastructure/dependency management policy — not included) | Dependency management practices are covered within Vulnerability Management Procedures rather than as a separate document. |

## Important note on honesty of this evidence

Every document here describes what is actually true of Clarity as of the date on each document, not an
idealized or aspirational state. Real findings (a dependency vulnerability, missing security headers,
two genuine CSP-related functional bugs found while testing the fix) are documented along with what was
fixed, what remains open, and why — see `policies/VULNERABILITY_MANAGEMENT.md` Sections 4-6 in
particular. Nothing here should be read as guaranteeing a level of security maturity Clarity has not
actually reached (e.g., there is no automated CI/CD, no third-party penetration test, and no
self-service data deletion feature yet — all called out explicitly in the relevant documents).

## Regenerating the scan evidence

- SAST: `semgrep scan --config auto --json --output security/scans/semgrep-results.json src functions`
  and `semgrep scan --config p/secrets --json --output security/scans/semgrep-secrets.json src functions`
- SCA: `npm audit` in both the repo root and `functions/`
- DAST: `docker run --rm -v "$(pwd)/security/scans/zap-report:/zap/wrk:rw" ghcr.io/zaproxy/zaproxy:stable zap-baseline.py -t https://parabola-6a220.web.app -r zap-baseline-report.html -J zap-baseline-report.json`
