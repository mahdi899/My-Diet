"""Provision the staff-only gateway after building sabzine-admin:tracking."""
import pathlib, os, secrets, subprocess

root=pathlib.Path('/etc/sabzine')
def run(*args):subprocess.run(args,check=True)
def readenv(path):return dict(line.split('=',1) for line in path.read_text().splitlines() if '=' in line and not line.startswith('#'))
env=root/'admin.env'
if not env.exists():
    db=readenv(root/'.env')
    values={'NODE_ENV':'staging','APP_ROLE':'api','PORT':'3000','DATABASE_URL':f'postgresql://sabzine:{db["POSTGRES_PASSWORD"]}@postgres:5432/sabzine','SMS_PROVIDER':'kavenegar','PAYMENT_GATEWAY':'zarinpal','AI_PROVIDER':'configured','PUSH_PROVIDER':'fcm','LOG_LEVEL':'warn','RUN_MIGRATIONS':'false','JWT_SECRET':secrets.token_hex(32),'OTP_PEPPER':secrets.token_hex(32),'FIELD_KEY':secrets.token_hex(32),'CORS_ORIGINS':'https://my-diet.ir,https://www.my-diet.ir'}
    values.update(readenv(root/'analytics-reader.env'))
    env.write_text(''.join(f'{k}={v}\n' for k,v in values.items()));os.chmod(env,0o600)
existing=subprocess.run(['docker','inspect','sabzine-admin'],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0
if existing:run('docker','rm','-f','sabzine-admin')
run('docker','run','-d','--name','sabzine-admin','--restart','unless-stopped','--network','sabzine_default','--env-file',str(env),'-v','/opt/sabzine/backend/admin-web:/app/admin-web:ro','-p','127.0.0.1:3003:3000','sabzine-admin:tracking')
site=pathlib.Path('/etc/nginx/sites-available/my-diet.ir')
backup=site.with_name('my-diet.ir.pre-tracking')
if not backup.exists():backup.write_text(site.read_text())
snippet='''
    # My Diet analytics/admin
    location = /admin { return 302 /admin/; }
    location ^~ /admin/ {
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        add_header Cache-Control "no-store" always;
    }
    location ^~ /v1/admin/ {
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        add_header Cache-Control "no-store" always;
    }
    location ~ ^/v1/auth/(admin/login|refresh|logout|totp|otp/request|otp/verify)$ {
        limit_except POST { deny all; }
        proxy_pass http://127.0.0.1:3003;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        add_header Cache-Control "no-store" always;
    }
    location /v1/ { return 404; }
    location = /health/live { proxy_pass http://127.0.0.1:3003; }
    location = /insights/script.js {
        proxy_pass http://127.0.0.1:3002/script.js;
        proxy_set_header Host $host;
        add_header Cache-Control "no-store" always;
    }
    location = /insights/api/send {
        limit_except POST { deny all; }
        client_max_body_size 16k;
        proxy_pass http://127.0.0.1:3002/api/send;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $mydiet_analytics_ip;
        proxy_set_header X-Real-IP $mydiet_analytics_ip;
        add_header Cache-Control "no-store" always;
    }
    location /insights/ { return 404; }
'''
text=site.read_text()
if 'location ~ ^/v1/public/articles' not in text:
    text=text.replace('    location / {', '''    location ~ ^/v1/public/articles(?:/[a-z0-9-]+)?$ {
        limit_except GET HEAD { deny all; }
        proxy_pass http://127.0.0.1:3003;
        add_header Cache-Control "no-store" always;
    }
    location / {''',1)
    site.write_text(text)
if 'location ^~ /go/' not in text:
    text=text.replace('    location / {', '''    location ^~ /go/ {
        limit_except GET HEAD { deny all; }
        proxy_pass http://127.0.0.1:3003;
        proxy_hide_header Cache-Control;
        add_header Cache-Control "private, no-store, no-cache, max-age=0" always;
        add_header CDN-Cache-Control "no-store" always;
        add_header Surrogate-Control "no-store" always;
    }
    location / {''',1)
    site.write_text(text)
text=text.replace('(admin/login|refresh|logout|totp)$','(admin/login|refresh|logout|totp|otp/request|otp/verify)$')
if 'location ~ ^/v1/demo/submissions/' not in text:
    text=text.replace('    location /v1/ {', '''    location ~ ^/v1/demo/submissions/[a-fA-F0-9-]+/verify$ {
        limit_except POST { deny all; }
        proxy_pass http://127.0.0.1:3003;
        add_header Cache-Control "private, no-store" always;
    }
    location /v1/ {''')
    site.write_text(text)
text=text.replace('proxy_set_header X-Forwarded-Proto https;\n        proxy_set_header X-Forwarded-For $mydiet_analytics_ip;', 'proxy_set_header X-Forwarded-Proto https;')
text=text.replace('proxy_set_header X-Forwarded-Proto https;', 'proxy_set_header X-Forwarded-Proto https;\n        proxy_set_header X-Forwarded-For $mydiet_analytics_ip;')
site.write_text(text)
if 'location = /v1/demo/submissions' not in text:
    text=text.replace('    location /v1/ {', '''    location = /v1/demo/submissions {
        limit_except POST { deny all; }
        limit_req zone=demo_leads burst=10 nodelay;
        client_max_body_size 128k;
        proxy_pass http://127.0.0.1:3003;
        add_header Cache-Control "private, no-store" always;
    }
    location /v1/ {''')
    site.write_text(text)
if '# My Diet analytics/admin' not in text:
    site.write_text(text.replace('    location / {',snippet+'\n    location / {',1))
pathlib.Path('/etc/nginx/conf.d/mydiet-analytics.conf').write_text('''map $http_ar_real_ip $mydiet_analytics_ip {
    default $remote_addr;
    ~^[0-9.]+$ $http_ar_real_ip;
    ~^[0-9a-fA-F:]+$ $http_ar_real_ip;
}
limit_req_zone $mydiet_analytics_ip zone=demo_leads:10m rate=10r/m;
''')
run('nginx','-t');run('systemctl','reload','nginx')
pathlib.Path('/usr/local/sbin/sabzine-db-backup').write_text('''#!/usr/bin/env bash
set -euo pipefail
backup_dir=/var/backups/sabzine/postgres
install -d -m 700 "$backup_dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
for database in sabzine umami; do
  tmp="$backup_dir/.$database-$stamp.dump.tmp"
  docker exec sabzine-postgres pg_dump --username sabzine --dbname "$database" --format=custom > "$tmp"
  chmod 600 "$tmp"
  mv "$tmp" "$backup_dir/$database-$stamp.dump"
done
find "$backup_dir" -maxdepth 1 -type f -name '*.dump' -mtime +14 -delete
''')
os.chmod('/usr/local/sbin/sabzine-db-backup',0o700)
run('/usr/local/sbin/sabzine-db-backup')
print('Staff panel and analytics gateway deployed')
