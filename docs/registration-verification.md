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

## Individual registration continuation - 21 October 2026

- Recovered the unfinished individual-registration plan and existing uncommitted
  implementation. Its initial 40 registration tests and TypeScript check passed.
- Added four UI tests: unpriced/disabled/full games; totals across categories and
  itemised receipts; locked registration modes and exact-roster response recovery;
  organiser purchase snapshots and current play-option prices.
- Added a durable API test: the same individual request, even with reordered
  selections, recovers its original receipt after option edits, registration
  closure and store restart. A changed companion cannot reuse the request ID.
- Browser acceptance used the production build on port 4312 with a newly created
  temporary data directory, not the real event or persistent demo directory.
- At 1440px, selected UNO and the FC 26 two-player team option. The total was
  LKR 1,700. Submitted at 390px; receipt showed the two line items and Payment
  pending. The phone page and receipt had a 375px content/client width with no
  horizontal document overflow. Long PC free-play names wrapped visibly.
- Organiser view showed the companion and team, two participant records, one team
  and one unpaid charge. Editing the current team price to LKR 1,350 left the
  original purchase at LKR 1,200 and the total at LKR 1,700.
- Catalogue and unpublished live output contained neither the test companion name
  nor email. Companion IDs were already covered by public receipt tests.
- Read-only parsing and migration of the real event preserved participant, team
  and ledger collections. No sample participants, payments or price edits were
  added to it. No authentication files were read or changed for this check.
- README and plan now describe individual games, confirmed prices, editable play
  options, roster handling, immutable purchases and manual organiser scheduling.
- Final checks: **67 tests passed across seven files**; the production
  TypeScript/Vite build passed. The 11 server registration tests were rerun after
  making the new individual test payload explicit for TypeScript. Whitespace
  validation passed, with only Git's existing LF-to-CRLF notice.
- Stopped the isolated test server and started the normal production app at
  `http://127.0.0.1:4310/register`. A read-only browser check confirmed individual
  mode and selectable board games. No real registration was submitted.
- No fresh independent second-agent review was run in this continuation.
