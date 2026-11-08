"""Run a remote deploy script over password SSH (MYDIET_SSH_PASS)."""
import os
import subprocess
import sys
import tempfile
import time

import paramiko

HOST = "87.107.190.112"
USER = "root"
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def connect():
    password = os.environ.get("MYDIET_SSH_PASS")
    if not password:
        sys.exit("Set MYDIET_SSH_PASS")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        HOST,
        username=USER,
        password=password,
        timeout=30,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def run(client, command, timeout=3600):
    print(f"\n>>> {command[:2000]}")
    stdin, stdout, stderr = client.exec_command(command, get_pty=True, timeout=timeout)
    channel = stdout.channel
    buf = ""
    while True:
        if channel.recv_ready():
            chunk = channel.recv(4096).decode(errors="replace")
            sys.stdout.buffer.write(chunk.encode("utf-8", errors="replace"))
            sys.stdout.buffer.flush()
            buf += chunk
        if channel.exit_status_ready():
            while channel.recv_ready():
                chunk = channel.recv(4096).decode(errors="replace")
                sys.stdout.buffer.write(chunk.encode("utf-8", errors="replace"))
                sys.stdout.buffer.flush()
            break
        time.sleep(0.2)
    code = channel.recv_exit_status()
    if code != 0:
        raise SystemExit(f"Remote command failed ({code})")
    return buf


def main():
    deploy_sh = sys.argv[1] if len(sys.argv) > 1 else "/tmp/mydiet-deploy.sh"
    with tempfile.NamedTemporaryFile(suffix=".tar.gz", delete=False) as tmp:
        archive_path = tmp.name
    subprocess.run(
        ["git", "archive", "--format=tar.gz", "-o", archive_path, "HEAD"],
        cwd=REPO_ROOT,
        check=True,
    )
    client = connect()
    sftp = client.open_sftp()
    sftp.put(archive_path, "/tmp/mydiet-src.tar.gz")
    os.remove(archive_path)
    local_script = os.path.join(os.path.dirname(__file__), "_mydiet_deploy.sh")
    with open(local_script, "rb") as fh:
        body = fh.read().replace(b"\r\n", b"\n")
    with sftp.open(deploy_sh, "wb") as remote:
        remote.write(body)
    sftp.chmod(deploy_sh, 0o700)
    sftp.close()
    run(client, f"bash -lc '{deploy_sh}'", timeout=7200)
    client.close()
    print("\nDEPLOY_FINISHED")


if __name__ == "__main__":
    main()
