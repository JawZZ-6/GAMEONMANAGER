# Retro & Cyber GameON · CISI

Event administration and a separate read-only live tournament board. React/TypeScript, Node.js/Express, and local JSON files. Requires Node.js 22 or later.

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

Changes use a serial transaction queue, revision checks, and a flushed temporary file followed by replacement. The server keeps `event.last-good.json` and up to 50 prior snapshots in `backups`. Settings → Download JSON backup exports the complete event. CSV exports are available for participants, matches and money.

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

Online payments, public hosting, self-registration, SSO and email/SMS are outside this version.
