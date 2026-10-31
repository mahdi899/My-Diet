import { it } from 'node:test';
import assert from 'node:assert/strict';
import { connectionSchema, campaignSchema } from '../../src/admin/integration-validation.js';
import { draftSchema } from '../../src/adapters/configured-ai.js';
import { encryptText, decryptText } from '../../src/common/field-crypto.js';

it('validates configurable AI connections and refuses local or insecure endpoints',()=>{
 const valid={name:'Example',apiKey:'test-only-key',baseUrl:'https://example.com/v1',model:'example-model'};
 assert.equal(connectionSchema.safeParse(valid).success,true);
 for(const baseUrl of ['http://example.com/v1','https://127.0.0.1/v1','https://localhost/v1','https://[::1]/v1','https://user:pass@example.com/v1'])assert.equal(connectionSchema.safeParse({...valid,baseUrl}).success,false);
 assert.equal(connectionSchema.safeParse({...valid,apiKey:'bad\nkey-value'}).success,false);
});
it('requires a device for test notifications and limits notification text',()=>{
 const draft={title:'آزمایش',body:'پیام آزمایشی',audience:'all'};
 assert.equal(campaignSchema.safeParse(draft).success,true);
 assert.equal(campaignSchema.safeParse({...draft,audience:'device'}).success,false);
 assert.equal(campaignSchema.safeParse({...draft,title:'x'.repeat(121)}).success,false);
 assert.equal(campaignSchema.safeParse({...draft,scheduledAt:'not-a-date'}).success,false);
});
it('validates model output before a specialist sees a draft',()=>{
 assert.equal(draftSchema.safeParse({days:[]}).success,false);
 assert.equal(draftSchema.safeParse({days:Array.from({length:7},()=>({meals:[{mealType:'breakfast',suggestedTime:'08:00',title:'صبحانه',calories:400,notes:'',items:[]}]}))}).success,true);
});
it('encrypts credentials even if supplied key resembles a ciphertext prefix',()=>{
 const secret='enc1:not-really-encrypted';const stored=encryptText(JSON.stringify(secret),'test-encryption-key');
 assert.ok(!stored.includes(secret));assert.equal(JSON.parse(decryptText(stored,'test-encryption-key')),secret);
});
