"""Sync admin/ to My Diet server (MYDIET_SSH_PASS or key)."""
import os
import pathlib
import socket
import subprocess
import sys
import tempfile

import paramiko

HOST = "87.107.190.112"
USER = "root"
REPO = pathlib.Path(__file__).resolve().parent.parent
ADMIN = REPO / "admin"
REMOTE_DIR = "/opt/sabzine/backend/admin-web"


def connect():
    key = pathlib.Path.home() / ".ssh" / "mydiet_server_ed25519"
    password = os.environ.get("MYDIET_SSH_PASS")
    if not password and not key.exists():
        sys.exit("Set MYDIET_SSH_PASS or fix SSH key on server")
    attempts = []
    if password:
        attempts.append({"password": password})
    if key.exists():
        attempts.append({"key_filename": str(key)})
    bind = os.environ.get("MYDIET_SSH_BIND")
    last_error = None
    for kwargs in attempts:
        try:
            sock = (
                socket.create_connection((HOST, 22), 20, source_address=(bind, 0))
                if bind
                else None
            )
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            client.connect(
                HOST,
                username=USER,
                timeout=60,
                banner_timeout=60,
                auth_timeout=60,
                allow_agent=False,
                look_for_keys=False,
                sock=sock,
                **kwargs,
            )
            return client
        except Exception as error:
            last_error = error
    raise SystemExit(last_error)


def main():
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        archive = tmp.name
    subprocess.run(
        ["tar", "-czf", archive, "-C", str(ADMIN.parent), "admin"],
        check=True,
    )
    client = connect()
    sftp = client.open_sftp()
    sftp.put(archive, "/tmp/admin-sync.tar.gz")
    os.remove(archive)
    cmd = (
        f"mkdir -p {REMOTE_DIR} && "
        f"tar -xzf /tmp/admin-sync.tar.gz -C /opt/sabzine --strip-components=0 && "
        f"rsync -a --delete /opt/sabzine/admin/ {REMOTE_DIR}/ && "
        "rm -f /tmp/admin-sync.tar.gz && "
        f"test -f {REMOTE_DIR}/ui.js && echo ADMIN_SYNC_OK"
    )
    stdin, stdout, stderr = client.exec_command(cmd, get_pty=True)
    print(stdout.read().decode(errors="replace"), end="")
    err = stderr.read().decode(errors="replace")
    if err:
        print(err, file=sys.stderr)
    code = stdout.channel.recv_exit_status()
    sftp.close()
    client.close()
    if code != 0:
        sys.exit(code)


if __name__ == "__main__":
    main()
