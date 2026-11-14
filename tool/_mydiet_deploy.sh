#!/usr/bin/env bash
set -euo pipefail
: "${SABZINE_ROOT:?Set the absolute path to the reviewed Laravel release}"
: "${SABZINE_ENV_FILE:?Set an existing release environment file}"
cd "$SABZINE_ROOT"
test -f backend-laravel/artisan
test -f "$SABZINE_ENV_FILE"
if test -d backend; then
  echo "Refusing a release containing the retired backend tree." >&2
  exit 1
fi
docker compose --env-file "$SABZINE_ENV_FILE" -f backend-laravel/docker-compose.yml config --quiet
docker compose --env-file "$SABZINE_ENV_FILE" -f backend-laravel/docker-compose.yml build
echo "Images built. Run the reviewed data cutover and backup/restore procedure before changing production traffic."
echo "This script does not delete any database, volume, or existing deployment."
