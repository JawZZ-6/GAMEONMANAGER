# Individual Game Registration Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this focused extension with tests first.

**Goal:** Let a participant register for one or more individual games alongside the existing five bundle choices.

**Architecture:** Reuse registration, participants, capacity checks, durable transaction queue and ledger. Add an optional registration type while preserving legacy bundle request hashes and stored records. Individual prices come from editable per-game play options; zero means unconfigured and cannot be purchased. A one-time catalogue upgrade adds the user's supplied games/formats/prices without replacing existing participant or financial records.

**Tech Stack:** Existing React, Express, TypeScript, Zod and Vitest.

**Spec:** User requested an individual-game registration option. Implementation decisions: choose any nonempty set of distinct active tournament or free-play games, select one priced format for each, save the price/format/duration/roster snapshot, and record the total as an unpaid charge. Existing one-registration-per-email, privacy, deadline, capacity and uncertain-response recovery rules remain. The user supplied and confirmed the price table below. A group entry includes the main registrant and named companions. Create participant records for companions, reuse the same named person across selections within this submission, and create one team per roster/name for team-priced options. Teams and free-play bookings still need organiser scheduling.

## Global Constraints

- Preserve real participant records, payments and bundle purchases.
- No new dependencies or payment gateway.
- Do not interpret unset fees as free registration or invent prices.
- Keep code in the requested GameON repository on a feature branch.

## Review Focus

- Legacy bundle retries must retain their original hash and receipt.
- A request cannot evade three-game bundle rules by changing registration type.
- Individual totals must be computed by the server and retain purchase prices.
- A last available place is shared by both registration types atomically.
- Changing registration mode clears choices but preserves contact details and pending-request recovery.

### Task 1: Model, pricing and durable API

Files: `shared/model.ts`, `shared/registration.ts`, `server/store.ts`, `server/app.ts`; registration domain/server tests.

- [x] Cover single/multiple entries, exact totals, invalid/missing prices, price changes, stored snapshots, mixed-mode capacity competition and legacy request replay.
- [x] Implement optional registration type, per-game catalogue fees, validated selections, price snapshots and backward-compatible hashing/exports.
- [x] Run registration domain/server tests; all pass, including individual replay after edits, closure and restart.

### Task 2: Public and organiser interfaces

Files: `src/pages/Register.tsx`, `src/pages/Registrations.tsx`, `src/pages/Manage.tsx`, `src/styles.css`, UI tests and README.

- [x] Cover individual selection/total, unpriced games, mode changes, receipt and organiser display with interaction tests.
- [x] Add mode controls, per-game selection/pricing, receipt breakdown and accurate organiser fee/registration labels; document the workflow in README.
- [x] Run full tests/build and browser-check desktop/mobile using temporary data.
- [x] Configure only prices explicitly supplied by the user and record verification.
- [x] Stop the temporary test server and start the normal production app on port 4310; confirm the public page without submitting sample data.
- [ ] Optional follow-up: a fresh independent review. Local review and automated/browser verification were completed; no second-agent review was run in this continuation.

## Continuation - 21 October 2026

The individual-registration implementation was already present in the uncommitted
worktree. Completed the remaining test coverage, browser acceptance checks and
documentation without replacing that work. Added four UI regressions and one
durable API regression. See `docs/registration-verification.md` for evidence and
runtime status. No sample records or price changes were written to the real event.

## Confirmed price table and catalogue

| Category | Option | Players included | Charge |
|---|---|---:|---:|
| Board/card/party | Single entry | 1 | LKR 500 per person |
| Console tournament | Single play, 1 vs 1 | 1 entrant | LKR 700 per person |
| Console tournament | Multiplayer, 2 vs 2 | one 2-player team | LKR 1,200 per team |
| PC tournament | Free-for-all | 1 | LKR 300 per person |
| PC tournament | Multiplayer, 2 vs 2 | one 2-player team | LKR 1,000 per team |
| Console free play | Single play, 1 hour | 1 | LKR 400 per booking |
| Console free play | Head-to-head, 1 hour | 2 | LKR 700 per booking |
| Console free play | Team play, 1 hour | 4 | LKR 1,000 per booking |
| PC free play | Single play, 1 hour | 1 | LKR 350 per booking |

Console tournaments: Mortal Kombat and FC 26. PC tournament: Call of Duty.

Console free play: FC 26, Watch Dogs: Legion, Red Dead Redemption 2, Assassin’s Creed Valhalla, GTA: San Andreas, Need for Speed Heat.

PC free play: Dying Light 1, Dying Light 2, Call of Duty: Modern Warfare (2019–2023), Red Dead Redemption 2, Forza Horizon 6, God of War (2018), God of War Ragnarök.

Add an Individual play options tab for organiser price/format edits. Keep bundle rules and prices unchanged; bundles continue to use tournament games only. Companion names/IDs stay out of catalogue and public live projections unless deliberately published as tournament entrants. The main registrant owns the total charge.
