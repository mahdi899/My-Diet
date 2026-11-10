#!/usr/bin/env bash
set -euo pipefail

PUB1='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIAxOUCpPbuXWEATP7dKO71pB6yGyjXfEx6sRQlAH8q4L mydiet-vps'
PUB2='ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO1lDYKdLMBTJ5IrnoXC/l8pwtVX92OmM3Dyybsyn6o0 mydiet-deploy-windows'
mkdir -p /root/.ssh
chmod 700 /root/.ssh
printf '%s\n%s\n' "$PUB1" "$PUB2" > /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys

cd /opt/sabzine
if [[ ! -f /tmp/mydiet-src.done ]]; then
  tar -xzf /tmp/mydiet-src.tar.gz -C /opt/sabzine
  test -f /opt/sabzine/onboarding/quiz.html
  test -f /opt/sabzine/backend/package.json

  # Marketing site (keep server-specific demo tracking config)
  rsync -a --delete \
    --exclude 'onboarding/' \
    "sabzine site/" /var/www/my-diet/

  mkdir -p /var/www/my-diet/onboarding
  rsync -a --delete \
    --exclude 'tracking-config.js' \
    onboarding/ /var/www/my-diet/onboarding/

  chown -R www-data:www-data /var/www/my-diet
  find /var/www/my-diet -type f -exec chmod 644 {} +
  find /var/www/my-diet -type d -exec chmod 755 {} +

  rsync -a --delete \
    --exclude node_modules \
    --exclude dist \
    backend/ /var/lib/sabzine/migrate-src/

  mkdir -p /opt/sabzine/backend/admin-web /opt/sabzine/backend/doctor-web
  rsync -a --delete admin/ /opt/sabzine/backend/admin-web/
  rsync -a --delete doctor/ /opt/sabzine/backend/doctor-web/
  touch /tmp/mydiet-src.done
fi

export BUILDKIT_PROGRESS=plain
docker build -t sabzine-admin:tracking /opt/sabzine/backend

cd /etc/sabzine
docker compose --profile tools run --rm migrate

python3 /etc/sabzine/deploy-tracking.py

docker ps --format '{{.Names}}|{{.Image}}|{{.Status}}'
curl -fsS -o /dev/null -w 'health_live=%{http_code}\n' http://127.0.0.1:3003/health/live || true
