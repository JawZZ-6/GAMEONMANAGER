# Participant registration and bundles

Approved in chat: public registration with name, email, department/organisation,
optional phone, one bundle, game selection, participant enrolments and an unpaid
charge. The user approved proceeding without further design questions.

Extend the existing React/Express/JSON application in the requested repository.
Keep its navy/orange/cyan visual style and existing organiser authentication.

## Offers

| Bundle | Selection | LKR |
|---|---|---:|
| Social | UNO, Pictionary, Charades | 1,200 |
| Brainpower | Chess, Scrabble, Omi | 1,200 |
| Arcade | Any 3 distinct video game tournaments | 1,600 |
| Best of Both Worlds | 2 board/card/party games + 1 video game tournament | 1,400 |
| Ultimate Gamer | 1 board/card/party game + 2 video game tournaments | 1,600 |

## Behaviour and implementation decisions

- `/register` is public. `/live` remains public and read-only. Contact information,
  registration records, ledger and request identifiers remain organiser-only.
- The public page shows offers, eligible games/remaining places, deadline in
  Asia/Colombo, labelled contact fields, selection summary and exact amount due.
  Receipt says payment is pending and tells participants to contact organisers.
- Only active tournament games qualify. Retro/board categories count as board;
  cyber counts as console. Each game can appear only once per registration.
- Registration closes at the end of the configured deadline in Asia/Colombo;
  organisers can close/reopen it in Settings, subject to that deadline.
- Enrolments count participants directly enrolled or entered in individual/team
  tournaments or enrolled teams, without double-counting a person. Public capacity
  is enforced atomically. Brackets and team assignments remain organiser-managed.
- One public registration per email. No automatic linking to existing private
  participant records. Existing records can be handled by an organiser.
- Client prices are checked against server prices. Server creates the participant,
  snapshot registration and charge together. Failed writes preserve prior state.
- An idempotency UUID plus request hash prevents repeated submissions from making
  another participant or charge. A changed request using the same UUID is rejected.
- Public POST requires the configured Origin. Apply bounded in-memory request
  throttling, a honeypot and strict input validation. No external messaging.
- Add default bundles and Chess once for older saves, without resetting games,
  participants, money or settings. Match existing games by name for fixed bundles;
  unavailable fixed games make an offer unavailable. Retain schemaVersion 1 with
  additive defaults. The next ordinary save persists migration through backups.
- Organisers see registration reference, contact fields, bundle, games, balance,
  and can record a payment in the existing ledger. Offer names/prices/availability
  can be edited, with prior registrations retaining their purchase snapshot.
- No payment gateway, email verification, messages, cancellation workflow, or
  automatic tournament/bracket entry is included in this extension.

## Acceptance

All five bundles work; invalid selections/prices and over-capacity registrations
are refused server-side. Repeated and concurrent submissions cannot double-charge.
Existing saves reload and public responses contain no private information. Public
and organiser pages work at phone and desktop widths. Existing tests remain green.
