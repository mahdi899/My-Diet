import {writeFile} from 'node:fs/promises';
import {SPEC_QUESTIONS,activeQuestions,missingRequired,type CanonicalAnswers,type TrackId} from '../../src/onboarding/spec.js';
import {canonicalToSubmission,legacyToCanonical,profilePreferences} from '../../src/onboarding/mapper.js';
import {deriveProfile,factsOf} from '../../src/onboarding/profile.js';
import {validateSubmission} from '../../src/questionnaire/schema.js';
import {mealSlots,planEnergy,assessSafety} from '../../src/nutrition/engine.js';

function fill(track:TrackId,overrides:CanonicalAnswers={}) {
  const answers:CanonicalAnswers={name:'کاربر آزمایشی',age:34,sex:'female',height_cm:165,weight_kg:80,target_weight_kg:track==='weight_gain'?90:68,pregnancy_week:20,pre_pregnancy_weight_kg:62,months_postpartum:4,sleep_wake:{sleep:23,wake:7},life_stage:'pregnant',...overrides};
  for(let round=0;round<6;round++) for(const q of activeQuestions(track,answers)) {
    if(answers[q.key]==null) {
      const options=q.options??[];
      if(q.kind==='text')answers[q.key]='توضیح آزمایشی';
      else if(q.kind==='number'||q.kind==='age')answers[q.key]=q.default??q.min??1;
      else if(q.kind==='single')answers[q.key]=options[0]!.code;
      else if(q.kind==='multi'||q.kind==='dish_picker')answers[q.key]=[(options.find(option=>option.code==='none')??options[0])!.code];
    }
    if(q.followUp) {
      const value=answers[q.key]; const codes=Array.isArray(value)?value:[String(value)];
      if(codes.some(code=>q.followUp!.whenCodes.includes(code)) && answers[q.followUp.key]==null) answers[q.followUp.key]='جزئیات آزمایشی';
    }
  }
  return answers;
}
const cases:[TrackId,CanonicalAnswers][]=[['weight_loss',{}],['weight_gain',{}],['pregnancy',{}],['detox',{}],
  ['pregnancy',{life_stage:'breastfeeding',lactation_goal:'gradual_loss'}],['pregnancy',{pregnancy_week:32,babies:'twins'}],
  ['weight_loss',{conditions:['diabetes'],medications:'yes',medications_text:'داروی آزمایشی',allergies:['dairy'],allergies_text:'شیر'}],
  ['weight_gain',{unintended_loss:'significant'}],['weight_loss',{loss_pace:'fast',sex:'male',age:65}],['weight_loss',{height_cm:175,weight_kg:50,target_weight_kg:45}],
  ['detox',{diet_style:'vegan',sleep_wake:{sleep:1,wake:6},meals_per_day:'2'}]];
const canonical=cases.map(([track,overrides])=>{
  const answers=fill(track,overrides); const submission=canonicalToSubmission(track,answers);const validated=validateSubmission(submission);
  return {track,answers,missing:missingRequired(track,answers),submission,validated,preferences:profilePreferences(track,answers),facts:factsOf(track,answers),
    profile:deriveProfile({track,stored:validated.answers,riskFlags:validated.riskFlags,preferences:profilePreferences(track,answers),canonical:answers})};
});
const legacy=SPEC_QUESTIONS.flatMap(q=>{
  const values=q.options?.map(option=>option.label)??[q.kind==='sleep_wake'?'خواب ۲۳ — بیداری ۷':q.kind==='number'?'۷۵٫۵':q.kind==='age'?'۳۵':'متن آزمایشی'];
  return values.map(answer=>{const items=[{key:q.key,question:q.demoTitles?.[0]??q.title,answer}];return {items,result:legacyToCanonical('weight_loss',items)};});
});
const energy=[];
for(const track of ['weight_loss','weight_gain','pregnancy','detox'] as const) for(const sex of ['male','female'] as const) for(const weightKg of [45,80,150]) {
  const input={track,sex,weightKg,age:35,heightCm:170,targetWeightKg:track==='weight_gain'?160:40,activity:'light',exercise:'3_4',lifeStage:'pregnant',pregnancyWeek:30,babies:'multiple',lossPace:'fast'};
  const result=planEnergy(input); const safetyInput={track,bmi:result.bmi,health:['diabetes','medication'],riskFlags:[],targetWeightKg:40,heightCm:170};
  energy.push({input,result,safetyInput,safety:assessSafety(safetyInput),slots:mealSlots(result.targetKcal,4,5)});
}
await writeFile(process.argv[2]!,JSON.stringify({canonical,legacy,energy},null,2)+'\n');
console.log(`Exported ${canonical.length} intake, ${legacy.length} legacy and ${energy.length} energy cases from Node.`);
