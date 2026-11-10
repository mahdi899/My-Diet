"""Deploy doctor portal at /doctor/ (admin + doctor static, API bootstrap, nginx)."""
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
KEY = pathlib.Path.home() / ".ssh" / "id_ed25519"

REMOTE_SH = r"""set -euo pipefail
mkdir -p /opt/sabzine/backend/admin-web /opt/sabzine/backend/doctor-web
tar -xzf /tmp/doctor-portal.tgz -C /opt/sabzine
rsync -a --delete /opt/sabzine/admin/ /opt/sabzine/backend/admin-web/
rsync -a --delete /opt/sabzine/doctor/ /opt/sabzine/backend/doctor-web/
cp /opt/sabzine/tool/deploy-tracking.py /etc/sabzine/deploy-tracking.py
export BUILDKIT_PROGRESS=plain
docker build -f /opt/sabzine/backend/Dockerfile -t sabzine-admin:tracking /opt/sabzine
python3 /etc/sabzine/deploy-tracking.py
curl -fsS -o /dev/null -w 'doctor_index=%{http_code}\n' http://127.0.0.1:3003/doctor/
curl -fsS -o /dev/null -w 'health_live=%{http_code}\n' http://127.0.0.1:3003/health/live
rm -f /tmp/doctor-portal.tgz
echo DOCTOR_PORTAL_DEPLOY_OK
"""


def connect():
    if not KEY.exists():
        sys.exit(f"Missing SSH key: {KEY}")
    sock = socket.create_connection((HOST, 22), 30)
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username=USER,
        key_filename=str(KEY),
        timeout=60,
        banner_timeout=60,
        auth_timeout=60,
        allow_agent=False,
        look_for_keys=False,
        sock=sock,
    )
    return client


def main():
    with tempfile.NamedTemporaryFile(suffix=".tgz", delete=False) as tmp:
        archive = tmp.name
    paths = ["admin", "doctor", "backend/Dockerfile", "backend/src/bootstrap.ts", "tool/deploy-tracking.py"]
    subprocess.run(
        ["tar", "-czf", archive, "-C", str(REPO)] + paths,
        check=True,
    )
    client = connect()
    sftp = client.open_sftp()
    sftp.put(archive, "/tmp/doctor-portal.tgz")
    os.remove(archive)
    sftp.close()
    stdin, stdout, stderr = client.exec_command(f"bash -lc {repr(REMOTE_SH)}", get_pty=True, timeout=7200)
    channel = stdout.channel
    while True:
        if channel.recv_ready():
            chunk = channel.recv(8192).decode(errors="replace")
            sys.stdout.buffer.write(chunk.encode("utf-8", errors="replace"))
            sys.stdout.buffer.flush()
        if channel.exit_status_ready():
            while channel.recv_ready():
                chunk = channel.recv(8192).decode(errors="replace")
                sys.stdout.buffer.write(chunk.encode("utf-8", errors="replace"))
                sys.stdout.buffer.flush()
            break
        time.sleep(0.2)
    code = channel.recv_exit_status()
    client.close()
    if code != 0:
        sys.exit(code)
    verify = subprocess.run(
        ["curl", "-fsS", "-o", "/dev/null", "-w", "%{http_code}", "https://my-diet.ir/doctor/"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    print("public_doctor=", verify.stdout.strip() or verify.stderr)


if __name__ == "__main__":
    main()
