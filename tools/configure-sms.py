"""Read root-only provider credentials, validate them without sending an SMS."""
import pathlib,urllib.request,urllib.parse,json,os
root=pathlib.Path('/etc/sabzine')
def read(path):return dict(line.split('=',1) for line in path.read_text().splitlines() if '=' in line and not line.startswith('#'))
sms=read(root/'sms.env')
request=urllib.request.Request('https://rest.payamak-panel.com/api/SendSMS/GetCredit',data=urllib.parse.urlencode({'username':sms['MELIPAYAMAK_USERNAME'],'password':sms['MELIPAYAMAK_API_KEY']}).encode())
with urllib.request.urlopen(request,timeout=20) as response: result=json.load(response)
if int(result.get('RetStatus',0))!=1 or float(result.get('Value',-1))<0:raise RuntimeError('Provider rejected credentials')
path=root/'admin.env';env=read(path);env.update(sms);env['SMS_PROVIDER']='melipayamak'
path.write_text(''.join(f'{key}={value}\n' for key,value in env.items()));os.chmod(path,0o600)
print('SMS credentials validated; runtime configured')
