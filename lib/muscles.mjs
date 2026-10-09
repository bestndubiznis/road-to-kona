import {findExercise} from './exercise-catalogue.mjs?v=catalogue1';
import {completed, number, localDate} from './fitness.mjs';
export const MUSCLES = {shoulders:'Shoulders',chest:'Chest',back:'Back',biceps:'Biceps',triceps:'Triceps',core:'Core',glutes:'Glutes',quads:'Quads',hamstrings:'Hamstrings',calves:'Calves'};
// Broad movement associations: cardio exposure is never converted into lifting sets.
export const SPORT_MUSCLES = {Swim:['shoulders','back','chest','triceps','core'],Bike:['quads','glutes','hamstrings','calves','core'],Run:['quads','glutes','hamstrings','calves','core'],Walk:['quads','glutes','hamstrings','calves'],Hike:['quads','glutes','hamstrings','calves','core']};
export function exerciseMuscles(name='') {return [...(findExercise(name)?.muscles||[])];}
export function muscleSummary(rows,{start='',end=localDate(),privateDetails=false}={}) {
 const groups=Object.fromEntries(Object.keys(MUSCLES).map(k=>[k,{sets:0,sessions:0,last:null,strengthLast:null,enduranceLast:null,sports:{},exercises:[]} ]));
 let unmapped=0,undetailed=0;const unmappedNames=new Set();
 for(const r of completed(rows).filter(r=>r.date>=start&&r.date<=end)) {
  const touched=new Set();
  if(privateDetails)for(const e of r.exercises||[]) {
   const sets=(e.sets||[]).filter(s=>s.kind!=='warmup'&&(number(s.reps)>0||number(s.seconds)>0)).length, keys=exerciseMuscles(e.name);
   if(!keys.length&&sets){unmapped++;unmappedNames.add(e.name);}
   for(const key of keys){groups[key].sets+=sets;if(sets){touched.add(key);groups[key].strengthLast=!groups[key].strengthLast||r.date>groups[key].strengthLast?r.date:groups[key].strengthLast;groups[key].exercises.push({date:r.date,name:e.name,sets,unit:e.unit});}}
  }
  if((r.type==='Strength'||number(r.strength)>0)&&!(r.exercises||[]).length)undetailed++;
  // Multi-sport sessions contribute one exposure per relevant sport, never an invented time split.
  const sports=new Set(SPORT_MUSCLES[r.type]?[r.type]:[]);
  if(number(r.swim_yards)>0)sports.add('Swim');if(number(r.bike_miles)>0)sports.add('Bike');if(number(r.run_miles)>0&&!['Walk','Hike'].includes(r.type))sports.add('Run');
  for(const sport of sports)for(const key of SPORT_MUSCLES[sport]){groups[key].sports[sport]=(groups[key].sports[sport]||0)+1;groups[key].enduranceLast=!groups[key].enduranceLast||r.date>groups[key].enduranceLast?r.date:groups[key].enduranceLast;touched.add(key);}
  for(const key of touched){groups[key].sessions++;groups[key].last=!groups[key].last||r.date>groups[key].last?r.date:groups[key].last;}
 }
 return {groups,unmapped,undetailed,unmappedNames:[...unmappedNames]};
}
export function muscleScore(group,mode){return mode==='strength'?group.sets:mode==='both'||mode==='recent'?group.sessions:Object.values(group.sports).reduce((a,b)=>a+b,0);}
