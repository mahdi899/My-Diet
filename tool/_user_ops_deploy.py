"""Upload the working tree pieces needed for the user-operations admin change and restart the API."""
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import time

import paramiko

HOST = "87.107.190.112"
USER = "root"
REPO = pathlib.Path(__file__).resolve().parent.parent

REMOTE = r"""
set -euo pipefail
tar -xzf /tmp/user-ops.tar.gz -C /opt/sabzine
mkdir -p /opt/sabzine/backend/admin-web /var/lib/sabzine/migrate-src
rsync -a --delete /opt/sabzine/admin/ /opt/sabzine/backend/admin-web/
rsync -a --delete --exclude node_modules --exclude dist /opt/sabzine/backend/ /var/lib/sabzine/migrate-src/
export BUILDKIT_PROGRESS=plain
docker build -f /opt/sabzine/backend/Dockerfile -t sabzine-admin:goal-cards /opt/sabzine
cd /etc/sabzine
docker compose --profile tools run --rm migrate
name=sabzine-admin
image=sabzine-admin:goal-cards
net=$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' "$name")
restart=$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$name")
ports=$(docker inspect -f '{{range $p, $conf := .HostConfig.PortBindings}}{{range $conf}}-p {{.HostIp}}:{{.HostPort}}:{{$p}} {{end}}{{end}}' "$name")
docker inspect -f '{{range .Config.Env}}{{println .}}{{end}}' "$name" > /tmp/sabzine-admin.env
chmod 600 /tmp/sabzine-admin.env
docker stop "$name"
docker rename "$name" sabzine-admin-prev
docker run -d --name "$name" --restart "$restart" --network "$net" --env-file /tmp/sabzine-admin.env $ports -v /opt/sabzine/backend/admin-web:/app/admin-web:ro "$image"
rm -f /tmp/sabzine-admin.env
code=000
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
  sleep 2
  code=$(curl -fsS -o /dev/null -w '%{http_code}' http://127.0.0.1:3003/health/live || true)
  [ "$code" = "200" ] && break
done
echo "health=$code"
if [ "$code" != "200" ]; then
  docker rm -f "$name" || true
  docker rename sabzine-admin-prev "$name"
  docker start "$name"
  echo ROLLBACK
  exit 1
fi
docker rm -f sabzine-admin-prev
echo USER_OPS_DEPLOYED
"""


def connect():
    password = os.environ.get("MYDIET_SSH_PASS")
    if not password:
        sys.exit("Set MYDIET_SSH_PASS")
    bind = os.environ.get("MYDIET_SSH_BIND")
    sock = socket.create_connection((HOST, 22), 20, source_address=(bind, 0)) if bind else None
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(HOST, username=USER, password=password, timeout=60, banner_timeout=60, auth_timeout=60, allow_agent=False, look_for_keys=False, sock=sock)
    return client


def main():
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        archive = tmp.name
    subprocess.run(["tar", "-czf", archive, "-C", str(REPO), "backend", "admin"], check=True)
    client = connect()
    sftp = client.open_sftp()
    sftp.put(archive, "/tmp/user-ops.tar.gz")
    os.remove(archive)
    with sftp.open("/tmp/user-ops-deploy.sh", "w") as remote:
        remote.write(REMOTE.replace("\r\n", "\n"))
    sftp.chmod("/tmp/user-ops-deploy.sh", 0o700)
    sftp.close()
    _stdin, stdout, _stderr = client.exec_command("bash /tmp/user-ops-deploy.sh", get_pty=True)
    channel = stdout.channel
    while True:
        if channel.recv_ready():
            sys.stdout.buffer.write(channel.recv(4096))
            sys.stdout.buffer.flush()
        else:
            time.sleep(0.2)
        if channel.exit_status_ready():
            while channel.recv_ready():
                sys.stdout.buffer.write(channel.recv(4096))
            break
    code = channel.recv_exit_status()
    client.close()
    if code != 0:
        sys.exit(code)


if __name__ == "__main__":
    main()
