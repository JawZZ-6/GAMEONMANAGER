# Deploying GameON to a Hetzner server

One small Ubuntu 24.04 server (for example Hetzner CX22) is plenty. GameON runs as a single Node.js
process behind Caddy, which provides HTTPS. Event data is a set of JSON files on the server's disk.

Files used here: [`deploy/gameon.service`](../deploy/gameon.service),
[`deploy/Caddyfile`](../deploy/Caddyfile) and [`deploy/gameon.env.example`](../deploy/gameon.env.example).

## 1. One-time server setup

1. Point an `A` record for your event subdomain (for example `gameon.yourcompany.com`) at the server.
2. Install Node.js 22 or later (NodeSource or `nvm`) and Caddy (the official package repository at
   <https://caddyserver.com/docs/install>).
3. Open only SSH and web traffic: `ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable`.
4. Create the service user and copy the project to `/opt/gameon`, without `node_modules` or `dist`:

   ```bash
   useradd --system --home /opt/gameon --shell /usr/sbin/nologin gameon
   ```

5. Install **all** dependencies and build. Do not use `--omit=dev`: `tsx`, which starts the server, is a
   development dependency.

   ```bash
   cd /opt/gameon && npm ci && npm run build
   ```

## 2. Configure and start

```bash
cp /opt/gameon/deploy/gameon.env.example /etc/gameon.env && chmod 600 /etc/gameon.env
nano /etc/gameon.env      # set GAMEON_ORIGIN and GAMEON_ADMIN_PASSWORD
cp /opt/gameon/deploy/gameon.service /etc/systemd/system/
cp /opt/gameon/deploy/Caddyfile /etc/caddy/Caddyfile && nano /etc/caddy/Caddyfile   # set your domain
systemctl daemon-reload && systemctl enable --now gameon && systemctl reload caddy
journalctl -u gameon -n 30
```

The log should show `GameON event:` and no warnings. Then:

1. Open `https://your-domain/admin` and sign in with the password from `GAMEON_ADMIN_PASSWORD`.
2. Remove that line from `/etc/gameon.env` and run `systemctl restart gameon`. The password hash now
   lives in `/var/lib/gameon/auth.json`.
3. Open **Event settings** and fill in the venue, charity, dates, registration deadline and fees. Check
   prices and places in **Registrations & bundles**.

Initial password setup through the web page only works on `localhost`, which is why the first start uses
`GAMEON_ADMIN_PASSWORD`.

### Settings that must be right

| Setting | Why it matters |
|---|---|
| `GAMEON_ORIGIN` | Must be the exact public address. If it differs, every registration is rejected with "Request origin was not accepted". |
| `GAMEON_TRUST_PROXY=1` | Lets GameON see each visitor's real address. Without it, all visitors share one rate limit and one sign-in lockout. |
| `HOST=127.0.0.1` | Keeps the Node port private. Only Caddy should be reachable from the internet. |

An office network usually appears as one public address. Registration therefore allows 300 attempts per
minute per address, and organiser sign-in locks an address after 10 wrong passwords for 15 minutes
(correct sign-ins are not counted). `systemctl restart gameon` clears any lockout.

## 3. Rehearse before announcing

Rehearse on the final address and from a phone on mobile data, then return to a clean event.

1. `systemctl stop gameon && cp /var/lib/gameon/event.json /root/event.clean.json && systemctl start gameon`
2. Register a test player (an individual game and a bundle), record a payment, open `/live`, and download a
   backup and a registrations CSV from the organiser area.
3. Reset to the clean event, keeping the organiser password:

   ```bash
   systemctl stop gameon
   rm -rf /var/lib/gameon/backups /var/lib/gameon/event.last-good.json
   cp /root/event.clean.json /var/lib/gameon/event.json
   chown gameon:gameon /var/lib/gameon/event.json && systemctl start gameon
   ```

## 4. Backups

GameON keeps `event.last-good.json` and the last 50 snapshots in `/var/lib/gameon/backups`. That is
history for roughly the last 50 changes and lives on the same disk, so it does not protect you from losing
the server or from a mistake noticed late.

- Enable Hetzner **Backups** for the server.
- Download **Settings → Download JSON backup** each morning and evening of the registration period and
  before every event day. It contains private contact and payment records; keep it somewhere access-controlled.
- Restore: `systemctl stop gameon`, copy a known-good JSON over `/var/lib/gameon/event.json`
  (keep `auth.json`), `chown gameon:gameon` it, `systemctl start gameon`, then check participants and money.

## 5. Running it

| Task | Command |
|---|---|
| Live logs | `journalctl -u gameon -f` |
| Restart (graceful) | `systemctl restart gameon` |
| Update the code | copy the new files, then `cd /opt/gameon && npm ci && npm run build && systemctl restart gameon` |
| Check it is up | `curl -s https://your-domain/api/live` returns JSON |

systemd restarts GameON automatically if it crashes. A `server.lock` left by a crash or power loss is
detected and removed automatically on the next start. If a lock is held by a process that is still running,
GameON refuses to start so two servers never write to the same data.

Set up an external uptime monitor (for example UptimeRobot, free) on `https://your-domain/api/live`.

## 6. Launch checklist

- [ ] `https://your-domain/register` loads over HTTPS and a real registration from a phone succeeds.
- [ ] Rehearsal data has been reset and `/var/lib/gameon/event.json` shows `"registrations": []`.
- [ ] Organiser password works; `GAMEON_ADMIN_PASSWORD` has been removed from `/etc/gameon.env`.
- [ ] Event settings, prices, places and the registration deadline are confirmed.
- [ ] Hetzner Backups are on and the first JSON backup has been downloaded.
- [ ] Uptime monitor is active.
- [ ] The announcement tells people how to pay and whom to contact. The receipt only says "Contact an
      organiser to arrange payment" and does not name anyone.
- [ ] People know to save their receipt reference. Email is not verified and no confirmation email is sent.
