import json, os, pathlib, secrets, subprocess, uuid

root = pathlib.Path('/etc/sabzine')
settings = root / 'tracking.json'
def sql(database, text):
    return subprocess.run(['docker','exec','-i','sabzine-postgres','psql','-U','sabzine','-d',database,'-v','ON_ERROR_STOP=1'],input=text,text=True,check=True,capture_output=True)
if not settings.exists():
    password = secrets.token_urlsafe(32)
    website_id = str(uuid.uuid4())
    sql('umami', f"CREATE EXTENSION IF NOT EXISTS pgcrypto; UPDATE public.\"user\" SET password=crypt('{password}',gen_salt('bf',10)) WHERE username='admin'; INSERT INTO website(website_id,name,domain,user_id) SELECT '{website_id}','My Diet Onboarding','my-diet.ir',user_id FROM public.\"user\" WHERE username='admin';")
    settings.write_text(json.dumps({'websiteId':website_id,'username':'admin','password':password}))
    os.chmod(settings,0o600)
config = json.loads(settings.read_text())
reader = root / 'analytics-reader.env'
if not reader.exists():
    password = secrets.token_hex(32)
    sql('umami', f"CREATE ROLE umami_reports LOGIN PASSWORD '{password}'; GRANT CONNECT ON DATABASE umami TO umami_reports; GRANT USAGE ON SCHEMA public TO umami_reports; GRANT SELECT ON website_event,event_data,session TO umami_reports;")
    reader.write_text(f'ANALYTICS_DATABASE_URL=postgresql://umami_reports:{password}@postgres:5432/umami\nANALYTICS_WEBSITE_ID={config["websiteId"]}\n')
    os.chmod(reader,0o600)
pathlib.Path('/var/www/my-diet/onboarding/tracking-config.js').write_text('window.MYDIET_TRACKING='+json.dumps({'websiteId':config['websiteId']})+';\n')
print('Analytics website and read-only reporting role ready')
