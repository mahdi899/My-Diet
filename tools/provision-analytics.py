"""Run as root on the production server; secrets stay in /etc/sabzine."""
import pathlib, secrets, subprocess, os

def run(*args, **kwargs):
    return subprocess.run(args, check=True, text=True, **kwargs)

root = pathlib.Path('/etc/sabzine')
envfile = root / 'umami.env'
if not envfile.exists():
    password = secrets.token_hex(32)
    sql = f"CREATE ROLE umami LOGIN PASSWORD '{password}';\nCREATE DATABASE umami OWNER umami;\n"
    run('docker', 'exec', '-i', 'sabzine-postgres', 'psql', '-U', 'sabzine', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', input=sql)
    envfile.write_text(f'DATABASE_URL=postgresql://umami:{password}@postgres:5432/umami\nAPP_SECRET={secrets.token_hex(32)}\nTWO_FACTOR_ENCRYPTION_KEY={secrets.token_hex(32)}\nDISABLE_TELEMETRY=1\n')
    os.chmod(envfile, 0o600)
image = run('docker', 'image', 'inspect', 'docker.umami.is/umami-software/umami:latest', '--format', '{{index .RepoDigests 0}}', capture_output=True).stdout.strip()
exists = subprocess.run(['docker', 'inspect', 'sabzine-umami'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
if not exists:
    run('docker', 'run', '-d', '--name', 'sabzine-umami', '--restart', 'unless-stopped', '--network', 'sabzine_default', '--network-alias', 'umami', '--env-file', str(envfile), '-p', '127.0.0.1:3002:3000', image)
print('Umami provisioned on loopback port 3002')
