import {test} from 'node:test';
import assert from 'node:assert/strict';
import {OnboardingSubmissionsController} from '../../src/admin/onboarding-web.controller.js';
import {loadEnv} from '../../src/config/env.js';
import {decryptText} from '../../src/common/field-crypto.js';
test('lead submission encrypts clinical answers and normalizes phone grouping',async()=>{
 const writes:unknown[][]=[];
 const pool={query:async(_sql:string,values:unknown[])=>{writes.push(values);return {rowCount:1,rows:[]};}};
 const env=loadEnv({DATABASE_URL:'postgres://unused',NODE_ENV:'test',FIELD_KEY:'independent-test-secret'});
 const controller=new OnboardingSubmissionsController(pool as never,env,{importVerifiedDemo:async()=>false} as never);
 const body={id:crypto.randomUUID(),phone:'09120000099',goal:'weight_loss',answers:Array.from({length:27},()=>({question:'test',answer:'private medical text'}))};
 await controller.save(body);await controller.save({...body,id:crypto.randomUUID(),phone:'+989120000099'});
 assert.equal(writes[0][1],writes[1][1]);
 assert(!JSON.stringify(writes[0]).includes('private medical text'));
 assert.equal(decryptText(String(writes[0][2]),env.FIELD_KEY),'+989120000099');
 assert.equal(JSON.parse(decryptText(String(writes[0][4]),env.FIELD_KEY)).length,27);
 await assert.rejects(controller.save({...body,answers:[]}));
});
