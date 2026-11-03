import { it } from 'node:test';
import assert from 'node:assert/strict';
import { requestDraft } from '../../src/ai/provider-request.js';
import { structuredDraftSchema } from '../../src/adapters/configured-ai.js';

it('bounds rate-limit retry and never retries uncertain network charges',async()=>{
 let calls=0;
 const send:typeof fetch=async()=>{calls++;return calls===1?new Response('',{status:429}):new Response('{}');};
 assert.equal(await requestDraft('https://example.test',{},send),'{}');assert.equal(calls,2);
 calls=0;
 await assert.rejects(requestDraft('https://example.test',{},async()=>{calls++;throw new Error('timeout');}),/provider_outcome_unknown/);
 assert.equal(calls,1);
 calls=0;
 await assert.rejects(requestDraft('https://example.test',{},async()=>{calls++;return new Response('',{status:401});}),/provider_authentication_failed/);
 assert.equal(calls,1);
 await assert.rejects(requestDraft('https://example.test',{},async()=>new Response('x'.repeat(1000001))),/too_large/);
});
it('requires AI alternative, complete slots and consistent primary calories',()=>{
 const option={title:'meal',portion:{quantity:1,unit:'serving',basis:'as_served'},calories:400,
 preparationMinutes:10,instructions:'prepare',ingredients:[{name:'food',quantity:100,unit:'g',basis:'raw'}]};
 const meal={mealType:'lunch',suggestedTime:'13:00',title:'meal',calories:400,notes:'',items:option.ingredients,primary:option,alternative:option};
 const week=(m:unknown[])=>({days:Array.from({length:7},()=>({meals:m}))});
 assert.equal(structuredDraftSchema.safeParse(week([meal])).success,true);
 assert.equal(structuredDraftSchema.safeParse(week([{...meal,alternative:undefined}])).success,false);
 assert.equal(structuredDraftSchema.safeParse(week([meal,meal])).success,false);
 assert.equal(structuredDraftSchema.safeParse(week([{...meal,calories:500}])).success,false);
});
