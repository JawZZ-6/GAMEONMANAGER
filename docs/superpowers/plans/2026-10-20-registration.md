# Participant Registration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Public participant registration with five priced bundles and private organiser records.

**Architecture:** Add schema collections and a focused registration domain module. Use the existing JSON transaction queue for an atomic public registration endpoint. Add a public React page and organiser registration/offer management.

**Tech Stack:** React, TypeScript, Express, Zod, Vitest; no new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-20-registration-design.md`

## Global Constraints

- Preserve real event data and organiser credentials; use temporary test data.
- One bundle per participant; exact prices 1200/1200/1600/1400/1600 LKR.
- All dates Asia/Colombo; payments recorded manually.
- Work in the user-requested root on `codex/participant-registration`.

## Review Focus

- Existing JSON with customised game IDs must load without resetting records.
- Simultaneous last-place registrations must permit only one purchase.
- Failed response/retry and server restart must not create a second charge.
- Edited offer prices or closed registration must be respected at submission.
- Contact fields and registration identifiers must stay out of public projections.

### Task 1: Registration model, offers and validation

Files: `shared/model.ts`, `shared/registration.ts`, `shared/domain.ts`, `shared/errors.ts`, `tests/registration.test.ts`.

Interfaces: `addRegistrationDefaults(state): EventState`, `registrationCatalogue(state, now?): RegistrationCatalogue`, `applyRegistration(state,input,hash,now?): Registration`, `registrationReceipt(registration): RegistrationReceipt`.

- [x] Write tests for exact offers, legacy upgrade, selection rules, deadline, price, duplicate email, capacity, privacy and unpaid balances; run and observe failures.
- [x] Add schemas, one-time defaults, catalogue and validated atomic domain changes; organiser `bundle.save` keeps purchase snapshots immutable.
- [x] Run `npm.cmd test -- tests/registration.test.ts tests/domain.test.ts`; expected all pass.

### Task 2: Durable public API

Files: `server/store.ts`, `server/app.ts`, `tests/registration-server.test.ts`.

Interfaces: `JsonStore.register(input): Promise<RegistrationReceipt>`; GET `/api/registration`; POST `/api/register` accepts only registration input and returns only receipt.

- [x] Write failing API tests for public access, origin, malformed requests, idempotency/restart, concurrent capacity, write rollback and protected exports.
- [x] Implement queue-backed registration, bounded throttling and private registration CSV.
- [x] Run `npm.cmd test -- tests/registration-server.test.ts tests/server.test.ts`; expected all pass.

### Task 3: Participant and organiser screens

Files: `src/pages/Register.tsx`, `src/pages/Registrations.tsx`, `src/App.tsx`, `src/pages/Manage.tsx`, `src/pages/Live.tsx`, `src/styles.css`, `tests/registration-ui.test.tsx`, `README.md`, `.gitignore`.

- [x] Write failing interaction tests for fixed/flexible bundles, selection resets, retained values and retry IDs, receipt, organiser payment and offer controls.
- [x] Build accessible responsive public form, receipt and organiser records/offer management. Add email/phone fields and navigation links.
- [x] Run full tests and production build; browser-check public desktop/mobile and organiser flow on temporary data.
- [x] Review full diff with a fresh reviewer, resolve material findings, document verification and leave code ready in the requested root.

## Progress

- Baseline: 22 tests pass. No changes made to real data.
- Decision: retain the requested repository location and use a feature branch instead of relocating into a worktree; no further design questions per approved defaults.

- Task 1 complete: 11 registration domain tests and 11 existing domain tests pass.
- Task 2 complete: 7 registration API/storage tests and 7 existing server tests pass.
- Task 3 complete: 6 registration UI tests; production build and desktop/mobile browser check pass.
- Review: one P2 uncertain-response recovery issue reproduced with a failing UI test, then fixed. Frozen-payload receipt recovery works after closure/capacity changes. No other actionable review findings.
- Browser: temporary data only; mixed bundle created at LKR 1,400, admin payment settles the balance, Brainpower selection tested at 390px. No horizontal page overflow.
