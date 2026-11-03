import { createHash } from 'node:crypto';
export interface IngredientInput {name:string;quantity:number|null;unit:string|null;basis:string;category?:string;source:string}
export interface ShoppingItem {key:string;name:string;originalLabels:string[];quantity:number|null;unit:string|null;basis:string;category:string;incomplete:boolean;sources:string[]}
export function normalizedLabel(value:string):string{return value.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\s\u200c]+/g,' ').trim().toLowerCase();}
const units:Record<string,{unit:string;factor:number}>={g:{unit:'g',factor:1},'گرم':{unit:'g',factor:1},kg:{unit:'g',factor:1000},'کیلوگرم':{unit:'g',factor:1000},
 ml:{unit:'ml',factor:1},'میلی لیتر':{unit:'ml',factor:1},l:{unit:'ml',factor:1000},'لیتر':{unit:'ml',factor:1000},
 piece:{unit:'piece',factor:1},'عدد':{unit:'piece',factor:1},serving:{unit:'serving',factor:1},cup:{unit:'cup',factor:1},tbsp:{unit:'tbsp',factor:1},tsp:{unit:'tsp',factor:1}};
export function aggregateIngredients(inputs:IngredientInput[]):ShoppingItem[]{
 const result=new Map<string,ShoppingItem>();
 for(const input of inputs){
  const label=normalizedLabel(input.name),unitLabel=normalizedLabel(input.unit??'');
  const mapped=Object.hasOwn(units,unitLabel)?units[unitLabel]:undefined;
  const known=!!label&&!!mapped&&input.quantity!==null&&Number.isFinite(input.quantity)&&input.quantity>0&&input.basis!=='unknown';
  const category=input.category??'other';
  const key=createHash('sha256').update(JSON.stringify([label,mapped?.unit??input.unit,input.basis,category,known?null:input.source])).digest('hex');
  const calculated=input.quantity!==null&&Number.isFinite(input.quantity)&&input.quantity>0?input.quantity*(mapped?.factor??1):null;
  const quantity=calculated!==null&&Number.isFinite(calculated)?calculated:null;
  const old=result.get(key);
  if(old){old.quantity=old.quantity===null||quantity===null?null:Math.round((old.quantity+quantity)*1e6)/1e6;
   if(old.quantity!==null&&!Number.isFinite(old.quantity)){old.quantity=null;old.incomplete=true;}
   if(!old.originalLabels.includes(input.name))old.originalLabels.push(input.name);old.sources.push(input.source);
  }else result.set(key,{key,name:input.name,originalLabels:[input.name],quantity,unit:mapped?.unit??input.unit,basis:input.basis,category,incomplete:!known,sources:[input.source]});
 }
 return [...result.values()].sort((a,b)=>a.category.localeCompare(b.category)||a.key.localeCompare(b.key));
}
