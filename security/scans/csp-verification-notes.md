# CSP / Security Header Verification Notes

**Date:** 2026-07-07

After adding the Content-Security-Policy and related headers to `firebase.json`, the live deployment at
`https://parabola-6a220.web.app` was exercised end-to-end (via automated browser sessions) to confirm
no functionality broke, and browser console output was monitored for CSP violation reports.

## First pass — found and fixed one real issue

- KaTeX (used for rendering maths notation) embeds one fallback font as a `data:font/woff2;base64,...`
  URI directly in its CSS. The initial `font-src 'self' https://fonts.gstatic.com` directive blocked
  this, logging a CSP violation in the browser console.
- Fix: added `data:` to the `font-src` directive. Redeployed and re-verified (see below).

## Second pass — clean

Verified against the live production URL:

- Page loads with `networkidle` and no console errors.
- Google Fonts (`Hanken Grotesk`, `Source Serif 4`) render correctly (checked via
  `getComputedStyle(...).fontFamily` on rendered elements, not just "the page didn't crash").
- Full signup flow (Firebase Authentication, email/password) completes successfully.
- A tutor account can add a student to their roster (real Firestore write) and create a class (real
  Firestore write + read-back rendering in the UI).
- **Zero CSP violations logged** during any of the above.

## Third pass — Google Sign-In popup, second real issue found and fixed

The Google Sign-In **popup** flow was specifically tested (up to the point of reaching Google's actual
consent screen — completing a real login isn't possible from unattended browser automation, but the
entire client-side popup mechanics up to that handoff were verified).

- **First attempt failed**: the popup never opened. Console showed
  `Loading the script 'https://apis.google.com/js/api.js' violates ... "script-src 'self'"` — Firebase
  Authentication's popup flow dynamically loads Google's own auth helper script, which the initial
  `script-src 'self'` directive blocked.
- **Fix**: added `https://apis.google.com` and `https://www.gstatic.com` to `script-src`, and
  `https://parabola-6a220.firebaseapp.com` (the app's actual Firebase Auth domain, a different origin
  from the `.web.app` hosting domain) to both `frame-src` and `connect-src`.
- **Re-verified**: the popup now opens and correctly reaches
  `https://parabola-6a220.firebaseapp.com/__/auth/handler?...providerId=google.com`, Firebase's own
  auth handler, which would proceed to Google's real consent screen. Zero CSP violations logged.
- The `Cross-Origin-Opener-Policy: same-origin-allow-popups` value was deliberately chosen (per Firebase
  Authentication's own documented guidance) specifically because it's the value known not to break
  `signInWithPopup`-style flows, unlike a stricter `same-origin` policy. No COOP-related console errors
  were observed in any pass.

All three passes combined (font/CSS loading, core Firestore-backed features, and the Google Sign-In
popup mechanics) came back clean on the final CSP configuration.
