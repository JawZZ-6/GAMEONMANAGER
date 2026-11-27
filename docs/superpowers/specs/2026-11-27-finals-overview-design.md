# Finals Day overview for /live

## Why
Every league match has been played. The overview still shows the league weeks: a countdown that only says
"League stage complete", stat tiles (results in, waiting, matches today), What's at stake, Highlights, and league
cards with progress bars. On Tuesday 1 Dec people open /live to follow the finals, so the overview should show
the finals.

## What it shows (finals mode)
- **Hero: Finals Day, Tue 1 Dec.** A countdown to the next session: The Showdown (12 PM, Paradise Room), then
  Game Night (from 6 PM). After 6 PM it reads "Game Night is on". The running order is listed with no times.
- **One tile per final, in running order:**
  1. **The Showdown** (secret event): its four seats, then "After game n of 2" with the leader and points, then
     the winner. Links to `#/classified`.
  2. **FFA Grand Final**: the three finalists plus "Showdown winner" (or their name), "Game n of 3", then the
     champion. Links to `#/ffa`.
  3. **2v2 Grand Final**: Harin & Jawahar vs Tharindu & Viraj, then the score and champion. Links to `#/2v2`.
  4. **Champion of Champions** (secret event): the 2v2 champions and Andrew & Miran, the running points, then
     the champion. Links to `#/classified`.
- **A secret event that has not been revealed** shows as a locked "Classified File 0n" tile. It uses only the
  teaser line the Classified tab already shows, never the event's name, format or players. It links to
  `#/classified`.
- **Champions wall**: FFA, 2v2, Challenger 2v2 (already Andrew & Miran), The Showdown and Champion of Champions.
  Each secret one shows only once revealed.
- **Organisers** still get the "Waiting for a result" list, limited to the finals.

## What goes
In finals mode: the stat tiles, What's at stake, Highlights, and the league event cards. The FFA, 2v2,
Challenger, Schedule and Players pages are unchanged and keep the full league tables.

## How
- `viewOverview()` in `server/live/cod.html` switches to finals mode on its own once every league match has a
  result. With any league match still open (as in the 25 Nov test fixture), today's overview is unchanged.
- The tiles read existing state: `sdTable()` and `champion('ch')`, the FFA final games and `champion('ffa')`,
  `F-2V2` and `champion('t2')`, `cocTable()` and `champion('coc')`, `revealed('duel')` and `revealed('e2')`.
  No new data and no server change.
- Game Night's start goes in `GN` as "from 6 PM".

## Constraints
- **No exact game times.** Game Night says only "from 6 PM", and no final gets its own time. *My call:* the
  Showdown keeps its 12 PM, since it is a separate session that has already been announced.
- **Secrets stay secret.** Before a reveal, nothing on the overview names a secret event or its format.
  Existing secrecy tests are extended to the finals overview.
- Works at phone width. It reuses the existing card styles (`gcard`, `wtile`, `coc-board`).

## Approaches considered
1. **Switch automatically when the leagues are complete** (picked): live as soon as it ships, nothing to click.
2. Organiser switch: manual control, but needs a new saved setting and a button.
3. Replace the league overview for good: least code, but drops the league view and its tests.

## Tests
- Finals mode with the live 27 Nov results: the tiles are in order, the Showdown seats appear, Champion of
  Champions is a locked teaser while `e2` is hidden, there are no game times, and the league sections are gone.
- With `e2` revealed: the Champion of Champions tile shows its line-up and running points.
- The 25 Nov fixture still renders the league overview.
