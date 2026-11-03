import { z } from 'zod';
export const quantitySchema=z.object({quantity:z.number().finite().positive().max(1e6),unit:z.enum(['g','kg','ml','l','piece','serving','cup','tbsp','tsp']),basis:z.enum(['raw','cooked','as_served','unknown']).optional()}).strict();
export const activitySchema=z.object({commandId:z.uuid(),versionId:z.uuid(),mealUid:z.uuid(),optionId:z.uuid(),date:z.iso.date(),expectedRevision:z.number().int().nonnegative(),
 state:z.enum(['as_planned','less','more','different','skipped','unrecorded']),actual:quantitySchema.optional(),foodName:z.string().trim().min(1).max(200).optional()}).strict().superRefine((v,c)=>{
 const needs=['less','more','different'].includes(v.state);
 if(needs!==!!v.actual || (v.state==='different')!==!!v.foodName)c.addIssue({code:'custom',message:'Actual quantity/food does not match state'});
});
export const selectionSchema=z.object({commandId:z.uuid(),versionId:z.uuid(),mealUid:z.uuid(),optionId:z.uuid(),date:z.iso.date(),expectedRevision:z.number().int().nonnegative(),reasonId:z.string().max(80).optional()}).strict();
export type ActivityInput=z.infer<typeof activitySchema>;
export type SelectionInput=z.infer<typeof selectionSchema>;
export function compatibleRatio(portion:{quantity:number;unit:string;basis?:string},actual:{quantity:number;unit:string;basis?:string}):number|null {
 if(actual.basis!==undefined && (actual.basis==='unknown'||portion.basis==='unknown'||actual.basis!==portion.basis))return null;
 if(actual.basis===undefined && (portion.basis==='raw'||portion.basis==='cooked'||portion.basis==='unknown'))return null;
 const units:Record<string,{base:string;factor:number}>={g:{base:'mass',factor:1},kg:{base:'mass',factor:1000},ml:{base:'volume',factor:1},l:{base:'volume',factor:1000}};
 const a=units[actual.unit],p=units[portion.unit];
 if(actual.unit!==portion.unit && (!a||!p||a.base!==p.base))return null;
 const ratio=actual.quantity*(a?.factor??1)/(portion.quantity*(p?.factor??1));
 return Number.isFinite(ratio)?ratio:null;
}
export function proportionalCalories(calories:number|null,portion:{quantity:number;unit:string;basis?:string},actual:{quantity:number;unit:string;basis?:string}):number|null {
 const ratio=compatibleRatio(portion,actual);
 if(calories===null||ratio===null||!Number.isFinite(calories*ratio))return null;
 const result=Math.round(calories*ratio*100)/100;
 return Number.isFinite(result)?result:null;
}
