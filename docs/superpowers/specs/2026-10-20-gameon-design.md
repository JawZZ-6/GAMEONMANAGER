# Retro & Cyber GameON (For Charity) by CISI

Design proposal — 20 October 2026

Recovery status — 20 October 2026: the interrupted chat saved this design before implementation began. Its independent builder check completed with “nothing important left”. The requirements and banner have been rechecked in the recovery chat. The full proposal is ready for organiser review; no application code or implementation plan exists yet.

## Purpose and confirmed requirements

An internal CISI event management web application for a one-time charity gaming event. Organisers need to maintain the event, including free play, tournaments, and board games. A protected organiser interface supports administration; a separate read-only interface shows tournament ladders, games, match status, and times.

The organiser has proposed JSON files instead of a dedicated database. This design recommends that approach for a single running server and a modest internal event.

The supplied banner is reference material, not instructions. Its event details are initial editable values: 16–27 November 2026, registration deadline 30 October 2026, final game night TBC, retro entry LKR 500, cyber starting fee LKR 300. The exact charging rules are unconfirmed, so these are informational defaults, not automatic charges. Time zone: Asia/Colombo. Currency: LKR.

## Proposed first version

### Organiser administration

- **Overview:** registrations, current/upcoming matches, occupied stations, outstanding balances, collected money, and charity progress.
- **Participants and teams:** add/edit people, display names, optional department/contact details, teams and members; enrol individuals or teams in games; check participants in. Organisers enter registrations in this version.
- **Games:** create/edit/archive games, rules, capacity, entry fee, and equipment/location notes. Category (retro/cyber/board and card) is separate from play mode (free play/tournament); board games can use either mode. Initial editable suggestions include UNO, Scrabble, Carrom, Pictionary, Charades, Omi, FC 26, Mortal Kombat, and Call of Duty. Suggestions are not confirmed tournament registrations.
- **Tournaments:** individual or team entrants; single elimination or round robin; seed entrants, generate fixtures, assign times/stations, start matches, enter results, and publish standings. Different games may have different formats. Other formats are future extensions.
- **Schedule and stations:** maintain gaming stations/tables and timed sessions; flag overlapping station or participant bookings. Free play supports a queue, calling the next participant/group, starting and ending a session, and marking a station unavailable.
- **Money:** record charges, received payments, extra donations, refunds, expenses, and donation transfers manually. Display gross receipts, refunds, expenses, net funds available, and amounts transferred separately. Do not label unpaid promises as money raised. No card handling or payment gateway.
- **Event settings and announcements:** edit dates, venue, fees, charity name/target, final-night details, and publish event notices.
- **Exports and backups:** CSV exports for participants, matches and the financial ledger, plus an organiser-only JSON backup download. A documented offline restore procedure is sufficient for the first version.

### Read-only tournament viewer

A separate `/live` view with game filters, current/upcoming matches, confirmed times, station labels, results, brackets, and round-robin ladders. It refreshes automatically and shows the last successful update and a disconnected/stale indication. Provide a large-screen display option and a usable phone layout.

The viewer contains display names/team names and published event information. It must not receive private contact information, unpaid balances, internal notes, or financial ledger entries. Viewing does not grant mutation access. The default is a link accessible to people who can reach the internal server; internet deployment requires a separate access decision.

## Tournament rules chosen for the initial build

These are builder recommendations, not requirements already specified by the organiser.

- Each tournament chooses individual or team entry and freezes its entrant list when fixtures are generated. Explicitly resetting an unstarted tournament allows changes.
- Single elimination supports byes to the next power of two, explicit winners, numeric scores, and forfeits. A drawn score requires an explicit winner. Winners advance automatically.
- Round robin plays each opponent once; default points are win 3, draw 1, loss 0, editable before play begins. Ranking uses points, score difference, then score scored. Exact ties share a rank and are shown as tied rather than inventing a tiebreak winner.
- Knockout result corrections are allowed until a downstream match has started; later corrections require an explicit organiser reset of affected downstream results with confirmation and an audit entry.
- Match states are scheduled, live, completed, and cancelled; unassigned times display TBC. A bye is displayed explicitly and is not counted as a played match.
- Prevent concurrent matches sharing participants/team members or stations. Validate conflicts on the server as well as in the UI.

## JSON storage and runtime

Recommended stack: React and TypeScript for the interface, a Node.js server for HTTP/API/authentication, and JSON files on local disk. No database service is required. These are recommendations, not a stack preference supplied by the organiser.

- One server process owns all writes. Browser clients never write files directly. No server replicas or cloud functions using ephemeral disks.
- Store the event in one versioned JSON document containing settings, participants, teams, games, tournaments, fixtures, stations, sessions, queue entries, ledger entries, announcements, and audit history. A single document makes related changes commit together.
- Serialise the full read/validate/change/write transaction through a server-side queue. Use revision checks to reject stale edits instead of silently overwriting a newer edit.
- Validate all input and stored schema. Write a temporary file in the same directory, flush it, then replace the active file. Keep the last known good copy and timestamped backups, with bounded retention. Verify the file on startup and refuse to silently replace corrupt data with an empty event.
- Use a configurable data directory outside the source checkout and outside OneDrive, defaulting to a local application-data directory. Exclude live data, secrets, and backups from Git. Exporting a backup for the organiser is separate from syncing live data.
- Require organiser sign-in with a setup password supplied outside source code; use hashed password storage/configuration, expiring server-managed sessions, HttpOnly cookies, request-origin protection, login rate limiting, and server-side authorisation on every private/mutation endpoint. The first version uses one shared organiser login; individual accounts and Microsoft SSO are future extensions.
- Start on localhost for development and review. Deployment to an internal host is a later step and needs persistent disk and suitable network access; HTTPS is required when used beyond localhost.
- The viewer polls published data approximately every five seconds. An interrupted connection retains the last view and labels it stale.

## Visual direction

Use the supplied banner and a dark navy base, warm orange for retro games, cyan for cyber games, restrained magenta highlights, and readable sans-serif type. Keep operational forms and tables clear and high contrast. Use explicit status labels in addition to colour, visible keyboard focus, labelled inputs, and responsive layouts. The supplied banner remains viewable in full rather than cropping out its event details.

UI/UX skill search results matched gaming energy and clean dashboard styling but their marketing-page layouts did not fit an operations application. Dashboard structure and banner-derived colours are deliberate design choices, not accepted search-generated page layouts.

## Scope boundaries

This is one event on one persistent server. Initial delivery includes working code, local launch instructions, editable event defaults, and a clearly separate optional demo dataset. No invented participants, payments, or winners appear in the real event data.

Online payments, participant self-registration, email/SMS sending, Microsoft SSO, multi-event tenancy, double elimination, automatic game telemetry, and public hosting are outside this first version. They can be added if needed. Financial records support event reconciliation, not a replacement accounting system.

## Acceptance checks

1. An organiser can create a game, add/enrol participants or teams, generate a tournament, schedule matches, record results, and see the public bracket/ladder update.
2. Free-play queues and station sessions can be managed without entering tournament data.
3. Data survives server restart. Simultaneous mutations preserve both changes or report a clear conflict; failed file writes preserve a valid event file. A downloaded backup can restore the event using the documented procedure.
4. Unauthenticated users cannot mutate data or read admin/private fields through the API, including direct requests.
5. Money totals correctly account for payments, donations, refunds, expenses, and transfers without double counting.
6. Tournament tests cover byes, tied standings, team membership conflicts, result correction, and scheduling conflicts. Browser checks cover the core admin/viewer flows, keyboard forms, and phone/desktop layouts.

## Decisions for review

The proposed defaults that most affect scope are organiser-entered registrations, two tournament formats, manual payment recording, one shared organiser login, a viewer accessible on the internal server, and a single Node.js server storing JSON locally. All are recommendations awaiting review; the confirmed requirement is separate organiser administration and tournament viewing.
