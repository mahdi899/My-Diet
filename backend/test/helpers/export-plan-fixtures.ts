import {writeFile,mkdir} from 'node:fs/promises';
import {z} from 'zod';
import {parseDays,assertPublishable} from '../../src/plans/domain/draft.js';
import {optionSchema,requireApprovedOptions} from '../../src/plans/options.js';

const uuid = (n:number) => '11111111-1111-4111-8111-'+String(n).padStart(12,'0');
const option = (kind:string,n:number) => ({optionId:uuid(n),kind,title:'عدسی',portion:{quantity:1,unit:'serving',basis:'as_served'},calories:300,preparationMinutes:20,instructions:'توضیح پخت',ingredients:[{name:'عدس',quantity:80,unit:'g',basis:'raw'}],approved:true});
const valid = () => ({days:Array.from({length:7},(_,i)=>({meals:[{mealUid:uuid(i+1),mealType:'lunch',suggestedTime:'12:30',title:'عدسی',calories:300,notes:'',items:[{name:'عدس',quantity:80,unit:'g'}],options:['primary','ai_alternative','specialist_alternative'].map((kind,n)=>option(kind,100+i*3+n))}]}))});
const cases:unknown[]=[null,{},[],{days:[]},valid(),{days:Array.from({length:7},()=>({meals:[]}))}];
function changed(edit:(meal:Record<string,any>,body:ReturnType<typeof valid>)=>void) {const body=valid();edit(body.days[0]!.meals[0]!,body);cases.push(body);}
for(const [key,values] of Object.entries({mealType:['صبحانه','میان‌وعده','bad'],title:['  عدسی  ','',1,'x'.repeat(121)],calories:[0,-1,1.5,5001,'300'],notes:['x'.repeat(501),null],suggestedTime:['24:00',true,'',null],items:[[],null,[{name:' x ',quantity:'2.5',unit:' g '}]],options:[null,[],[{...option('primary',100),extra:true}]]})) {
  for(const value of values) changed(meal=>{meal[key]=value;});
}
changed(meal=>{delete meal.options;meal.items=[{name:' x ',quantity:'2.5',unit:' g '}];});
changed(meal=>{delete meal.options;meal.items=[{name:'x',quantity:'0x10',unit:null}];});
changed(meal=>{meal.options![0]!.portion.quantity=0;});
changed(meal=>{meal.options![0]!.ingredients[0]!.unit='bad';});
changed(meal=>{meal.options![0]!.title='  عدسی  ';});
changed(meal=>{meal.options![0]!.calories=301;});
changed(meal=>{meal.options![1]!.kind='primary';});
changed(meal=>{meal.options!.pop();});
changed(meal=>{meal.options![2]!.approved=false;});
changed((meal,body)=>{body.days[1]!.meals[0]!.mealUid=meal.mealUid;});
changed((meal,body)=>{body.days[1]!.meals[0]!.options![0]!.optionId=meal.options![0]!.optionId;});
changed((_,body)=>{body.days[1]!.meals=[];});
const vectors=cases.map(input=>{try {const parsed=parseDays(input);let publishError:unknown=null;try{const days=parsed.map(meals=>({meals}));assertPublishable(days);for(const day of days)for(const meal of day.meals)requireApprovedOptions(meal.options);}catch(error){const e=error as any;publishError={status:e.status,code:e.code,messageFa:e.messageFa};}return {input,parsed,publishError};}catch(error){const e=error as any;return {input,error:{status:e.status,code:e.code,messageFa:e.messageFa}};}});
const destination='../backend-laravel/app/Modules/Plans/Infrastructure/resources';
await mkdir(destination,{recursive:true});
await writeFile(destination+'/option-schema.json',JSON.stringify(z.toJSONSchema(optionSchema),null,2)+'\n');
await writeFile('../backend-laravel/tests/Fixtures/node-plans.json',JSON.stringify(vectors,null,2)+'\n');
console.log('Exported '+vectors.length+' actual Node plan vectors.');
