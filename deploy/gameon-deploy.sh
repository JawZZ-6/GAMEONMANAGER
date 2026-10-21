#!/bin/sh
# Install as /usr/local/bin/gameon-deploy (owned by root). GitHub Actions runs it over SSH as
# gameon-deploy through a forced command, passing the commit to deploy in SSH_ORIGINAL_COMMAND.
set -eu
APP=/var/www/gameon
export PATH=/opt/gameon-node/bin:$PATH

sha=${SSH_ORIGINAL_COMMAND:-}
printf '%s' "$sha" | grep -Eqx '[0-9a-f]{40}' || { echo "Expected a full commit SHA" >&2; exit 1; }

cd "$APP"
git fetch --quiet origin master
git merge-base --is-ancestor "$sha" origin/master || { echo "$sha is not on master" >&2; exit 1; }
git reset --quiet --hard "$sha"
npm ci --no-audit --no-fund

# Build beside the live files and swap, so visitors are not served a half-built site.
rm -rf dist.next dist.old
npm run build -- --outDir dist.next
[ -d dist ] && mv dist dist.old
mv dist.next dist
rm -rf dist.old

sudo -n /usr/bin/systemctl restart gameon
for i in 1 2 3 4 5 6 7 8 9 10; do
  curl -fsS -o /dev/null http://127.0.0.1:4310/api/live && { echo "GameON is live at $(git rev-parse --short HEAD)"; exit 0; }
  sleep 2
done
echo "GameON did not answer after restart; check: journalctl -u gameon -n 50" >&2
exit 1
