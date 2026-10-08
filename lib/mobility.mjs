import {completed,localDate} from './fitness.mjs';
import {exerciseMuscles} from './muscles.mjs';
import {STRETCHES} from './mobility-catalog.mjs';
export {STRETCHES};
export function mobilityRoutine(rows,date=localDate()){
 const actual=completed(rows).filter(r=>r.date===date&&r.type!=='Mobility'),reasons=new Map();
 const add=(groups,reason)=>groups.forEach(g=>{const a=reasons.get(g)||new Set();a.add(reason);reasons.set(g,a);});
 for(const r of actual){
  if(['Run','Walk','Hike'].includes(r.type)||Number(r.run_miles)>0)add(['calves','hips','glutes','hamstrings'],r.type==='Race'?'race run':r.type.toLowerCase());
  if(r.type==='Bike'||Number(r.bike_miles)>0)add(['hips','quads','glutes'],r.type==='Race'?'race bike':'bike');
  if(r.type==='Swim'||Number(r.swim_yards)>0)add(['shoulders','chest','back'],'swim');
  for(const e of r.exercises||[])if((e.sets||[]).some(s=>s.kind!=='warmup'&&(Number(s.reps)>0||Number(s.seconds)>0)))add(exerciseMuscles(e.name),'logged lifting');
 }
 const candidates=STRETCHES.filter(s=>s.id!=='bent-calf').map(s=>({...s,reasons:[...new Set(s.groups.flatMap(g=>[...(reasons.get(g)||[])]))]})).filter(s=>s.reasons.length);
 // Alternate upper/lower regions for mixed days rather than crowding out swimming work.
 const lower=candidates.filter(s=>s.groups.some(g=>['calves','hips','quads','glutes','hamstrings'].includes(g))),upper=candidates.filter(s=>!lower.includes(s)),routine=[];
 while(routine.length<5&&(lower.length||upper.length)){if(lower.length)routine.push(lower.shift());if(upper.length&&routine.length<5)routine.push(upper.shift());}
 return {actualCount:actual.length,routine,unmapped:actual.length>0&&!routine.length};
}
