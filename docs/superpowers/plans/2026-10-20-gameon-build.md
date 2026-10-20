# GameON Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Deliver the approved working local event-management application and a separate live viewer.

**Architecture:** React/TypeScript client, Express server, one versioned JSON event document. A serial transaction queue performs revision checking, validation and atomic replacement; private state is projected to an explicit public shape.

**Tech Stack:** Node 22+, TypeScript, React, Vite, Express, Zod, Vitest, Lucide icons.

**Spec:** ../specs/2026-10-20-gameon-design.md (approved by user 20 October 2026).

## Global Constraints
- Single persistent server; JSON data outside source and OneDrive.
- Asia/Colombo, LKR, editable banner defaults. Real data has no invented participants or receipts.
- Private admin endpoints require sessions; public data excludes contact details and finances.
- Native implementation in this chat followed by an independent review; user has authorised building without another planning handoff.

## Review Focus
- Non-power-of-two brackets and dependent result corrections preserve valid advancement (task 1).
- Team members overlap across teams or individual bookings (task 1).
- Stale writes, failed replacement and corrupt startup never erase good event data (task 2).
- Public projection and direct unauthenticated requests cannot expose private state (task 2).
- Keyboard forms, blank starting state and narrow screens remain usable (task 3).

### Task 1: Event domain and tournament rules
**Files:** shared/model.ts, shared/domain.ts, tests/domain.test.ts, package.json, tsconfig.json.
**Interfaces:** createEvent(): EventState; applyCommand(state, {type, payload}): void; publicEvent(state): PublicEvent; standings(state, tournamentId): Standing[]; moneySummary(state): MoneySummary.
- [ ] Write tests for entrants, byes, round-robin rankings, corrections, scheduling/team conflicts, money and public privacy.
- [ ] Run `npm test -- tests/domain.test.ts`; expect missing implementation failure.
- [ ] Implement typed validated state, defaults, commands and pure calculations.
- [ ] Run `npm test -- tests/domain.test.ts`; expect all assertions passing.

### Task 2: Durable storage and authenticated API
**Files:** server/store.ts, server/auth.ts, server/app.ts, server/index.ts, tests/server.test.ts.
**Interfaces:** JsonStore.open(dir); read(); transact(revision, command); close(). GET /api/session, POST /api/setup and /api/login, POST /api/logout, GET /api/state, POST /api/command {revision,type,payload}; GET /api/live; GET /api/export/:kind and /api/backup.
- [ ] Write integration tests for restart, stale revisions, failed file replacement, corrupt state, session/origin protection, public privacy and exports.
- [ ] Run `npm test -- tests/server.test.ts`; expect missing implementation failure.
- [ ] Implement exclusive process lock, queued durable storage, backups, hashed password setup, expiring sessions, login throttling, public and admin endpoints.
- [ ] Run `npm test`; expect full suite passing.

### Task 3: Admin and live application
**Files:** src/App.tsx, src/components.tsx, src/pages/*.tsx, src/styles.css, src/api.ts, src/main.tsx, index.html, vite.config.ts.
**Interfaces:** consumes task 2 endpoints and task 1 types/calculations. /live is read-only; /admin uses an authenticated application shell.
- [ ] Write/run browser flow acceptance script covering setup, participants, games, tournament results, viewer and mobile layout; missing UI is the initial failure.
- [ ] Build navy/orange/cyan interface with accessible labelled forms and responsive navigation; preserve full banner access.
- [ ] Implement all admin sections, revision-conflict recovery, exports, five-second live refresh with stale indication and display mode.
- [ ] Run `npm run build` and browser checks at desktop/phone widths; expect no type errors or horizontal page overflow, completed workflows persisted.

### Task 4: Delivery and independent review
**Files:** README.md, server/demo.ts, scripts/*, docs/superpowers/progress.md.
- [ ] Document local setup/start, shared login, internal HTTPS deployment, safe JSON backup restore and separate demo data.
- [ ] Run full tests and production build, review through a fresh reviewer, fix substantive findings with regression coverage.
- [ ] Start local preview and hand over working URLs. Preserve recovery ledger and source files; do not publish externally.

## Pre-flight
Task 1 types are consumed by tasks 2 and 3; all use a command API and shared IDs. Task 2 returns updated state after each mutation, including revision. No interface conflicts.
