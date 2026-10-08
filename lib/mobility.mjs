import {completed,localDate} from './fitness.mjs';
import {exerciseMuscles} from './muscles.mjs';
export const STRETCHES=[
 {id:'calf',name:'Wall calf stretch',groups:['calves'],instructions:'Face a wall with your hands supported. Step one foot back, keep that heel down and the back knee straight, and gently bend the front knee. Switch legs.',sides:2},
 {id:'bent-calf',name:'Bent-knee calf stretch',groups:['calves'],instructions:'With hands on a wall and one foot behind you, keep the back heel down and gently bend both knees. Use a small movement. Switch legs.',sides:2},
 {id:'hip',name:'Half-kneeling hip flexor stretch',groups:['hips','quads'],instructions:'Kneel on a cushion with the other foot forward. Keep your torso upright, gently tuck your pelvis and squeeze the back-leg glute. Shift forward slightly without arching your lower back. Switch sides.',sides:2},
 {id:'quad',name:'Supported quad stretch',groups:['quads'],instructions:'Hold a wall or chair. Bend one knee and gently hold that ankle behind you, keeping your knees near each other and your torso upright. Do not pull into knee pain. Switch legs.',sides:2},
 {id:'glute',name:'Seated figure-four stretch',groups:['glutes'],instructions:'Sit on a stable chair. Place one ankle over the opposite thigh, keeping the foot relaxed. Hinge forward gently with a long back; do not press the knee down. Switch sides.',sides:2},
 {id:'hamstring',name:'Seated hamstring stretch',groups:['hamstrings'],instructions:'Sit near the edge of a stable chair. Extend one leg with the heel down and knee slightly bent. Keeping your back long, hinge forward a little from your hips. Switch legs.',sides:2},
 {id:'chest',name:'Gentle doorway chest stretch',groups:['chest','triceps'],instructions:'Rest one forearm against a doorframe with your elbow below shoulder height. Step or turn forward slightly until you feel a gentle chest stretch. Keep the shoulder relaxed. Switch sides.',sides:2},
 {id:'shoulder',name:'Cross-body shoulder stretch',groups:['shoulders','biceps'],instructions:'Bring one arm across your chest below shoulder height. Support it gently with your other arm above the elbow, keeping both shoulders relaxed. Switch arms.',sides:2},
 {id:'back',name:'Supported back and lat stretch',groups:['back','core'],instructions:'Place both hands on a stable counter. Step back and hinge at the hips, with knees soft, letting your chest lower gently between your arms. Keep your lower back comfortable.',sides:1}
];
export function mobilityRoutine(rows,date=localDate()){
 const actual=completed(rows).filter(r=>r.date===date),reasons=new Map();
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
