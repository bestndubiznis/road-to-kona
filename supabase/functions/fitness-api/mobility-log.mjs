import {STRETCHES} from './mobility-catalog.mjs';
import {validateWorkout,localDate} from './fitness.mjs';
export function mobilityUpdate(prior, input, now=new Date()) {
 const date=String(input.date||'');
 validateWorkout({date,type:'Mobility',status:'completed'});
 if(date>localDate(now))throw new Error('Only log mobility you have already completed.');
 const stretch=STRETCHES.find(s=>s.id===input.stretch_id);
 if(!stretch||typeof input.completed!=='boolean')throw new Error('Choose a valid stretch and completion state.');
 const seconds=Number(input.seconds_per_side);
 if(input.completed&&(!Number.isInteger(seconds)||seconds<1||seconds>600))throw new Error('Enter 1–600 seconds per side.');
 const list=[...(prior?.mobility_stretches||[])];
 const index=list.findIndex(s=>s.id===stretch.id);
 if(input.completed){
  const entry={id:stretch.id,name:stretch.name,seconds_per_side:seconds,sides:stretch.sides,completed_at:list[index]?.completed_at||now.toISOString()};
  if(index<0)list.push(entry);else list[index]=entry;
 }else if(index>=0)list.splice(index,1);
 return {...prior,date,type:'Mobility',title:'Daily mobility',source:'Mobility log',manual_actuals:true,status:list.length?'completed':'skipped',mobility_stretches:list,duration_hours:list.reduce((n,s)=>n+s.seconds_per_side*s.sides,0)/3600,bike_miles:0,run_miles:0,swim_yards:0,strength:0,exercises:[],public_progress:prior?.public_progress!==false,private_notes:prior?.private_notes||''};
}
// Optimistic updates preserve different stretches saved concurrently from two devices.
export async function saveMobility(db,input,now=new Date()) {
 const key='mobility-day:'+String(input.date||'');
 const checked=r=>{if(r.error)throw new Error(r.error.message);return r.data;};
 for(let attempt=0;attempt<4;attempt++){
  const row=checked(await db.from('fitness_workouts').select('id,data').eq('external_id',key).maybeSingle());
  const data=mobilityUpdate(row?.data,input,now);
  if(!row&&!data.mobility_stretches.length)return {saved:true};
  const result=row?await db.from('fitness_workouts').update({data,updated_at:now.toISOString()}).eq('id',row.id).eq('data',JSON.stringify(row.data)).select('id'):await db.from('fitness_workouts').insert({external_id:key,data}).select('id');
  if(result.error?.code==='23505')continue;
  if(checked(result).length)return {saved:true};
 }
 throw new Error('Another device updated this session. Refresh and try again.');
}
