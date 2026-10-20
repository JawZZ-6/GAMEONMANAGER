# Registration verification — 20 October 2026

- Full suite: **46 tests passed** across six files (`npm.cmd test`).
- Production TypeScript/Vite build: passed (`npm.cmd run build`).
- `git diff --check`: passed.
- Domain/API coverage: all five bundle prices and mixes, invalid inputs, duplicate
  emails, deadlines, unavailable/full games, private projections, legacy migration,
  simultaneous capacity claims, durable retry after restart and failed-write rollback.
- UI coverage: fixed/flexible choices, selection limits, retained fields, receipt,
  organiser controls and frozen-payload recovery after uncertain submission followed
  by registration closure. The latter reproduces and fixes the independent review's
  only actionable finding.
- Browser: production server on port 4312 using a separate temporary data directory.
  Registered Preview Player for UNO + Chess + FC 26 at LKR 1,400; receipt showed
  Payment pending; organiser recorded a sample payment and the balance showed Settled.
- Phone check: 390px viewport, Brainpower games and contact fields; document width
  equalled viewport content width (375px), with no horizontal page overflow.
- Screenshots: `docs/screenshots/registration-desktop.jpg` and
  `docs/screenshots/registration-mobile.jpg`.
- Read-only migration check against the real event confirmed participant count and
  ledger preservation and availability of all five offers. No sample records were
  added to the real event. The real local server was restarted with the new version.

Publication to Hetzner and online payment processing were not part of this change.
