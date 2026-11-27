# Finals Day Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once every league match has a result, the /live overview shows Finals Day: a countdown, one tile per final (secret events included), and the champions wall.

**Architecture:** `viewOverview()` in `server/live/cod.html` returns `viewFinals()` when `FINALS()` is true. The tiles read the existing scoring state, so no data or server changes are needed.

**Tech Stack:** vanilla JS in `server/live/cod.html`, vitest + jsdom tests.

**Spec:** `docs/superpowers/specs/2026-11-27-finals-overview-design.md`

## Global Constraints
- No exact game times. Game Night reads "from 6 PM". Only The Showdown shows its time (12 PM), and only once it is revealed.
- Before a reveal, the overview never names a secret event, its format, its time or its players.
- Reuse the existing card styles (`gcard`, `top3`, `wall`/`wtile`, `champ`), and keep the layout working at phone width.

## Review Focus
- The Showdown is hidden: nothing about the Showdown appears, including no 12 PM and no "Showdown winner" seat. The countdown goes straight to Game Night.
- No finals played yet: tiles show the line-ups, and Champion of Champions shows the "To be decided" teams.
- After 6 PM on Tue 1 Dec: no countdown, and the panel reads "Game Night is on".
- All titles decided: the panel reads "Every title decided".
- Leagues are not complete (the 25 Nov fixture): the league overview is unchanged.

---

### Task 1: Finals Day overview

**Files:**
- Modify: `server/live/cod.html` (add `GN.sd`, `GN.night`, `FINALS`, `viewFinals`; make `viewOverview` branch; add `.ftile` CSS)
- Create: `tests/fixtures/cod-results-2026-11-27.json` (the live results, all leagues complete)
- Test: `tests/cod-finals-overview.test.ts`

**Interfaces:**
- Produces: `FINALS(): boolean`, `viewFinals(): string`, and tiles `<a class="gcard card ftile" data-final="sd|ffa|t2|coc">` with a locked variant `.ftile.locked`.

- [ ] **Step 1: Write failing tests** in `tests/cod-finals-overview.test.ts`:
  - `FINALS()` is false on the 25 Nov fixture, and its overview still contains "Highlights".
  - 27 Nov, nothing revealed: tiles are `[sd, ffa, t2, coc]`, with `sd` and `coc` locked. No `/showdown|champion of champions|duel|play-in|12 PM/i`. No "Results in", "What’s at stake" or "Highlights".
  - 27 Nov, Showdown revealed: the `sd` tile lists Harin, Aqeela, Tharindu, Pasindu and links to `#/classified`. The `ffa` tile has "Showdown winner". The only times on the page are `12 PM` and `6 PM`.
  - The `e2` reveal: the `coc` tile names Andrew & Miran and links to `#/classified`. Once both CoC games are played, the champions wall shows the champion.
- [ ] **Step 2: Run** `npx vitest run tests/cod-finals-overview.test.ts`. Expect it to fail because `FINALS` is not defined.
- [ ] **Step 3: Implement** the code described under Architecture.
- [ ] **Step 4: Run** `npx vitest run`. Expect all tests to pass.
- [ ] **Step 5: Check** the page in the browser at desktop and phone width.
