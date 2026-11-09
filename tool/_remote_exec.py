import os
import sys

import paramiko

host = "87.107.190.112"
user = "root"
password = os.environ.get("MYDIET_SSH_PASS")
if not password:
    sys.exit("MYDIET_SSH_PASS not set")

pub = (
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIO1lDYKdLMBTJ5IrnoXC/l8pwtVX92OmM3Dyybsyn6o0 "
    "mydiet-deploy-windows"
)

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(
    host,
    username=user,
    password=password,
    timeout=30,
    allow_agent=False,
    look_for_keys=False,
)

script = sys.argv[1] if len(sys.argv) > 1 else "hostname; whoami"
if script == "__INSTALL_KEY__":
    script = f"""
mkdir -p /root/.ssh && chmod 700 /root/.ssh
grep -F 'mydiet-deploy-windows' /root/.ssh/authorized_keys >/dev/null || echo '{pub}' >> /root/.ssh/authorized_keys
chmod 600 /root/.ssh/authorized_keys
echo KEY_OK
"""

stdin, stdout, stderr = client.exec_command(script, get_pty=True)
out = stdout.read().decode(errors="replace")
err = stderr.read().decode(errors="replace")
if out:
    print(out, end="")
if err:
    print(err, end="", file=sys.stderr)
code = stdout.channel.recv_exit_status()
client.close()
sys.exit(code)
