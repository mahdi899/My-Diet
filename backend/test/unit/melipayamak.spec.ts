import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MelipayamakSmsProvider} from '../../src/adapters/melipayamak.js';
import {loadEnv} from '../../src/config/env.js';
const env=loadEnv({DATABASE_URL:'postgres://unused',NODE_ENV:'test',SMS_PROVIDER:'melipayamak',MELIPAYAMAK_USERNAME:'test-user',MELIPAYAMAK_API_KEY:'private-test-key',MELIPAYAMAK_FROM:'500000'});
test('Meli sends OTP and credentials only in HTTPS body and requires a receipt',async()=>{
 const provider=new MelipayamakSmsProvider(env,(async(url,options)=>{assert.equal(url,'https://rest.payamak-panel.com/api/SendSMS/SendSMS');const body=options!.body as URLSearchParams;assert.equal(body.get('password'),'private-test-key');assert(body.get('text')?.includes('654321'));return new Response(JSON.stringify({RetStatus:1,Value:'123456789012345'}));}) as typeof fetch);
 await provider.sendOtp('+989120000099','654321');
 const rejected=new MelipayamakSmsProvider(env,(async()=>new Response(JSON.stringify({RetStatus:1,Value:'-1'}))) as typeof fetch);
 await assert.rejects(rejected.sendOtp('+989120000099','654321'),/SMS dispatch unavailable/);
 await assert.rejects(provider.sendOtp('+989120000099','1234'));
});
