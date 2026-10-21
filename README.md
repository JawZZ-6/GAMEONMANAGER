# Retro & Cyber GameON · CISI

Event administration, public participant registration and a read-only live tournament board. React/TypeScript, Node.js/Express, and local JSON files. Requires Node.js 22 or later.

## Run

Open PowerShell:

```powershell
cd "C:\Users\JZJ\Downloads\WORK-001\WORK\Java\GameON"
npm.cmd ci
npm.cmd run build
npm.cmd start
```

Dependencies and the production build are already present on this computer, so normally only `npm.cmd start` is needed. Keep the terminal open. Ctrl+C stops the server. Run only one server against each data directory.

- Organisers: http://127.0.0.1:4310/admin
- Live tournament viewer: http://127.0.0.1:4310/live
- Public participant registration: http://127.0.0.1:4310/register
- Registrations and bundle management: http://127.0.0.1:4310/admin/registrations
- Development with automatic UI updates: `npm.cmd run dev`
- Separate sample event on port 4311: `npm.cmd run demo`
- Tests: `npm.cmd test`

On a fresh event, choose an organiser password of at least 12 characters on the local setup screen. The shared organiser password is stored as a salted hash; sessions expire after eight hours or a server restart. Existing data and the password survive a source-folder move.

## Event data and backups

The real event is stored outside the repository and outside OneDrive:

```text
%LOCALAPPDATA%\CISI-GameON\event\event.json
```

The demo uses `%LOCALAPPDATA%\CISI-GameON\demo` and does not populate the real event. Set `GAMEON_DATA_DIR` to use a different persistent local directory; do not point two server processes at the same directory. `auth.json` in that directory contains the password hash. Do not commit it.

Changes use a serial transaction queue, revision checks, and a flushed temporary file followed by replacement. The server keeps `event.last-good.json` and up to 50 prior snapshots in `backups`. Settings → Download JSON backup exports the complete event. CSV exports are available for participants, registrations, matches and money.

### Offline restore

1. Stop the server with Ctrl+C. Keep a copy of the current `event.json` somewhere safe before replacing anything.
2. Choose a known-good downloaded JSON backup or a snapshot from `backups`. The JSON must have schemaVersion 1 and all event collections. Do not edit it while the server is running.
3. Copy that backup to the data directory as `event.json`. Keep `auth.json` to preserve the organiser password.
4. Restart the server. It validates the stored schema; invalid/corrupt files cause startup to fail rather than creating an empty event. Check participants, fixtures and money before resuming administration.

If a crash leaves `server.lock`, read its `pid` and verify that no GameON server is still using this directory before removing only that lock file. A normal Ctrl+C shutdown removes the lock automatically.

## Event workflow

1. Review Event settings, game rules, fees and charity target. Banner fees are informational until a charge is entered.
2. Register people and teams, then create a tournament with individual or team entry.
3. Open Entrants and select in seed order; generate fixtures. Single elimination supports byes and forfeits. Round robin uses editable win/draw/loss points and shared ranks for exact ties.
4. Add stations, schedule fixtures and record results. Publish a tournament to show it on `/live`.
5. For casual play, create a game in free-play mode, add groups to its queue, call a group and start/end its session.
6. Record charges, payments, donations, refunds, expenses and charity transfers in Money. Charges are not cash received. Void mistakes and record a replacement.

If another organiser changes data while a form is open, its original revision is retained and stale saves are rejected. Reopen the editor to review current values, or use Reload latest values in Settings before reapplying edits. Result changes that introduce booking conflicts are rejected; reschedule the affected later fixture first. Changing a winner after dependent play began requires explicit downstream-result reset.

Archiving a game can prevent editing its existing tournaments; unpublish those tournaments before archiving, or temporarily unarchive the game. The viewer refreshes every five seconds and retains its last successful data if a fetch fails.

## Internal hosting

The default binds only to this computer. For internal network access, use one persistent server behind a trusted HTTPS reverse proxy. Set `GAMEON_ORIGIN` to the exact browser-facing HTTPS origin and `HOST` to the required bind address; `PORT` defaults to 4310. Complete password setup on localhost first, or supply `GAMEON_ADMIN_PASSWORD` securely on first startup. Do not commit credentials. The live viewer is read-only but accessible to anyone who can reach the server; contacts, the financial ledger and audit history are excluded from its API.

Online payments, SSO and email/SMS are outside this version. Deploying the service to Hetzner remains a separate step.

## Registration, individual games and bundles

After updating the code, stop the old server with Ctrl+C, run `npm.cmd run build`,
and start it again with `npm.cmd start`. Reload open browser tabs.

Share `/register` on your event subdomain. Participants enter their name, email,
department/organisation and optional phone, then choose individual games or one
bundle. Switching modes clears game choices but retains contact details.

### Individual games

Participants can select one or more distinct games across board games, console
tournaments, PC tournaments, console free play and PC free play. Choose one
priced play option for each game. The initial confirmed prices are:

| Category | Play option | Price |
|---|---|---:|
| Board, card and party games | Single entry | LKR 500 per person |
| Console tournament | Single play, 1 vs 1 | LKR 700 per person |
| Console tournament | Multiplayer, one 2-player team | LKR 1,200 per team |
| PC tournament | Free-for-all | LKR 300 per person |
| PC tournament | Multiplayer, one 2-player team | LKR 1,000 per team |
| Console free play | Single play, 1 hour | LKR 400 per booking |
| Console free play | Head-to-head, 2 players, 1 hour | LKR 700 per booking |
| Console free play | Team play, 4 players, 1 hour | LKR 1,000 per booking |
| PC free play | Single play, 1 hour | LKR 350 per booking |

Group entries include the registrant. Enter companion names and, for team-priced
entries, a team name. A companion named consistently across selected games gets
one participant record within that registration. Team-priced entries create a
team; the registrant owns the single total charge, not each companion.

In **Registrations & bundles**, open **Individual play options** to filter by
game, add or edit formats, set prices, player counts and durations, or disable an
option. Zero means the price is unconfirmed and cannot be purchased. The fee in
**The games** is only a reference, not the registration price. New custom games
need play options before individual registration is available.

Receipts and organiser records retain the purchased format, duration, roster and
price even after an option is edited. If an offer changes before submission,
refresh and review the updated option before confirming. Capacity counts every
included player. Registration does not schedule a station or timed session:
organisers still add tournament entrants and arrange free-play queues/bookings.

### Bundles

| Bundle | Included games | Price |
|---|---|---:|
| Social | UNO + Pictionary + Charades | LKR 1,200 |
| Brainpower | Chess + Scrabble + Omi | LKR 1,200 |
| Arcade | Any 3 video game tournaments | LKR 1,600 |
| Best of Both Worlds | 2 board games + 1 console game | LKR 1,400 |
| Ultimate Gamer | 1 board game + 2 console games | LKR 1,600 |

Retro and board categories count as board/card/party games; cyber counts as
video game tournaments under the existing bundle rules. Bundles exclude
free-play games. Games are distinct within a bundle. Available places include
existing participant, team and tournament
enrolments, counting each person once. Organisers still choose teams and add
entrants to tournaments before generating fixtures.

### Payments and administration

A successful submission creates the participant, game enrolments, a registration
snapshot and an **unpaid charge** together. No payment is collected online. In
**Registrations & bundles**, find a participant and select **Record payment** only
when money has been received. The balance is the participant's total across the
Money ledger; receipts and exported registrations retain the original purchase
prices and game names. Individual registration exports include play options and
companion/team details. Edit participant information in **People & teams**.

The **Bundle offers** tab lets organisers edit offer names/prices and enable or
disable an offer. These changes apply to future registrations. Settings controls
the public registration switch and deadline. Registration closes at midnight
after the deadline in Asia/Colombo; to extend it, update the date and open switch.
Refresh event data in the admin header to load registrations received since the
page opened.

Existing JSON files receive the default offers, Chess and the confirmed
individual-play catalogue on load, preserving existing records and game IDs.
The individual catalogue upgrade runs once and retains later organiser edits.
The next normal save persists this upgrade through the existing backup
mechanism. If a fixed bundle's games were renamed or removed
before upgrading, that offer is unavailable until its game references are
reconciled in the data; custom bundle composition is not editable in this version.

One public registration per email is accepted. Existing entries must be handled
by an organiser. Submissions use an idempotency ID to prevent duplicate charges.
If a response is lost, keep the page open and use **Check previous registration**
to recover the original receipt, even if registration has closed or the games
are now full. Refreshing or closing the browser tab loses that recovery control;
an organiser can locate the saved registration by email. Email ownership is not
verified and automatic email/SMS confirmation is not sent.

The public APIs expose only offers, games, remaining places and the submitter's
receipt. They never list contact details or private registration records. The
POST endpoint validates the configured Origin and applies a 60-attempts/minute
limit per socket IP. Behind a reverse proxy that is a shared limit; configure
additional proxy-side abuse protection to suit your event traffic. Do not expose
the Node port directly. Keep `GAMEON_ORIGIN` equal to the public HTTPS subdomain.
