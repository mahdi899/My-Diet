// Run after npm run build: node --test test/unit/campaign-links.spec.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { campaignInput, campaignDestination, CampaignRedirectController } from '../../dist/admin/campaign-links.controller.js';

test('campaign input rejects unsafe suffixes and arbitrary redirect destinations', () => {
  assert.deepEqual(campaignInput({name:'تلگرام',slug:'Telegram-Summer',source:'Telegram'}), {name:'تلگرام',slug:'telegram-summer',source:'telegram'});
  for (const slug of ['../demo', 'bad?x=1', 'https://evil.test', '-bad', 'bad--name', 'x'.repeat(65)])
    assert.throws(() => campaignInput({name:'test',slug,source:'telegram'}));
  assert.throws(() => campaignInput({name:'test',slug:'valid',source:'telegram',destination:'https://evil.test'}));
  assert.equal(campaignDestination('telegram','summer'), '/demo/?utm_source=telegram&utm_medium=campaign&utm_campaign=summer');
});

test('active links redirect with attribution, disabled links stop redirecting and neither is cached', async () => {
  let active=true, opens=0;
  const pool={query:async (sql,args)=>{
    assert.match(sql,/active=true/);
    if(!active)return {rows:[]};
    opens+=args[1];return {rows:[{source:'instagram',slug:'insta-summer'}]};
  }};
  const controller=new CampaignRedirectController(pool);
  const response=()=>({headers:{},set(headers){this.headers=headers;return this;},status(code){this.code=code;return this;},type(){return this;},send(body){this.body=body;return this;},redirect(code,url){this.code=code;this.url=url;return this;}});
  const first=await controller.open('insta-summer',response());
  assert.equal(first.code,302);assert.match(first.url,/utm_source=instagram/);assert.equal(opens,1);
  await controller.head('insta-summer',response());assert.equal(opens,1);
  active=false;
  const disabled=await controller.open('insta-summer',response());
  assert.equal(disabled.code,410);assert.equal(disabled.url,undefined);assert.equal(opens,1);
  for(const result of [first,disabled])assert.match(result.headers['Cache-Control'],/no-store/);
  active=true;assert.equal((await controller.open('insta-summer',response())).code,302);
});
