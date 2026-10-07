import {parseCsv,number,validateWorkout} from './fitness.mjs';
export function parseTpExport(csv,today){
 const raw=parseCsv(csv);if(!raw.length||!('TimeTotalInHours' in raw[0])||!('WorkoutDay' in raw[0]))throw new Error('Unexpected TrainingPeaks export format');
 return raw.filter(r=>!['Notes','Note','Day Off','Rest'].includes(r.WorkoutType)&&!/^OFF$|^rest day$/i.test(r.Title)).map(r=>{
  const type=/strength|weight/i.test(r.WorkoutType)?'Strength':/bike|cycle/i.test(r.WorkoutType)?'Bike':/run/i.test(r.WorkoutType)?'Run':/swim/i.test(r.WorkoutType)?'Swim':/walk/i.test(r.WorkoutType)?'Walk':'Other';
  const done=r.WorkoutDay<=today&&(number(r.TimeTotalInHours)>0||number(r.DistanceInMeters)>0),distance=done?number(r.DistanceInMeters):0;
  const data=validateWorkout({date:r.WorkoutDay,type,title:r.Title||type+' workout',status:done?'completed':'planned',source:'TrainingPeaks hosted export',duration_hours:done?number(r.TimeTotalInHours):0,bike_miles:type==='Bike'?distance/1609.344:0,run_miles:['Run','Walk'].includes(type)?distance/1609.344:0,swim_yards:type==='Swim'?distance/.9144:0,strength:type==='Strength'?1:0,planned_duration_hours:number(r.PlannedDuration),planned_distance_meters:number(r.PlannedDistanceInMeters),average_power:done&&r.PowerAverage?number(r.PowerAverage):null,average_hr:done&&r.HeartRateAverage?number(r.HeartRateAverage):null,tss:done&&r.TSS?number(r.TSS):null,rpe:done&&r.Rpe?number(r.Rpe):null,public_progress:done,completion_review:!done&&r.WorkoutDay<today,trainingpeaks_export:r});
  data.details=[r.WorkoutDescription,r.CoachComments,r.AthleteComments].filter(Boolean).join('\n\n');return data;
 });
}
const sourceKey=r=>[r.WorkoutDay,r.WorkoutType,r.Title||''].join('|');
export async function tpExternal(row){
 const s=sourceKey(row.trainingpeaks_export),digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
 return 'tp-export:'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,24);
}
export async function reconcileTp(incoming,prior){
 const changes=[],reviews=[],seen=new Set(),counts=new Map();for(const r of incoming){const k=sourceKey(r.trainingpeaks_export);counts.set(k,(counts.get(k)||0)+1);}
 for(const row of incoming){
  const raw=row.trainingpeaks_export,key=sourceKey(raw),external_id=await tpExternal(row);
  if(counts.get(key)>1){if(!seen.has(key))reviews.push({date:row.date,type:row.type,reason:'Multiple same-title sessions need review'});seen.add(key);continue;}
  const alternate=prior.some(r=>(r.data.duplicate_source_records||[]).some(s=>sourceKey(s)===key));if(alternate)continue;
  const matches=prior.filter(r=>r.external_id===external_id||r.data.trainingpeaks_export&&sourceKey(r.data.trainingpeaks_export)===key);
  if(matches.length>1){reviews.push({date:row.date,type:row.type,reason:'Multiple existing matches'});continue;}
  let old=matches[0];
  if(!old){
   const same=prior.filter(r=>r.data.date===row.date&&r.data.type===row.type&&r.data.status!=='skipped');
   // Missing stable source IDs require review, rather than doubling history or manually logged actuals.
   if(same.some(r=>!r.data.trainingpeaks_export)||same.some(r=>row.status==='completed'&&r.data.status==='completed'&&Math.abs(number(r.data.duration_hours)-row.duration_hours)<.04)){
    reviews.push({date:row.date,type:row.type,reason:'Possible existing or duplicate session'});continue;
   }
  }
  const coach={trainingpeaks_export:raw,planned_duration_hours:row.planned_duration_hours,planned_distance_meters:row.planned_distance_meters};
  let data=old?{...old.data,...coach}:row;
  if(old&&old.data.status!=='skipped'&&!(row.status==='planned'&&old.data.status!=='planned')){
   // Only source-managed actuals are refreshed; manual edits switch source and keep their measurements.
   if(old.data.status==='planned'||/TrainingPeaks.*export/.test(old.data.source||''))data={...old.data,...row,private_notes:old.data.private_notes||'',exercises:old.data.exercises||[],public_progress:old.data.status==='planned'&&row.status==='completed'?true:old.data.public_progress!==false};
  }
  if(!old)data.private_notes='';
  if(old&&JSON.stringify(old.data)===JSON.stringify(data))continue;
  changes.push({id:old?.id||null,external_id:old?.external_id||external_id,data,expected:old?.data||null});
 }
 // A moved/deleted plan remains visible for review; absence alone never marks a completed workout skipped.
 return {changes,reviews};
}
export function syncAlert(state,now=new Date()){
 if(!state?.enabled)return null;
 if(state.status==='needs_login')return {key:'needs_login',title:'TrainingPeaks needs attention',body:'Open your private fitness log to update the hosted sign-in or review the login problem.'};
 if(['error','review_required'].includes(state.status))return {key:state.status,title:'Fitness sync needs attention',body:state.status==='review_required'?'Some new activities need review before they can be added. Open your private fitness log.':'The TrainingPeaks check failed. Open your private fitness log to review it.'};
 if(now-new Date(state.last_success_at||state.started_at||now)>36*3600000)return {key:'stale',title:'TrainingPeaks sync is overdue',body:'No successful hosted check in over 36 hours. Open your private fitness log to review the connection.'};
 return null;
}
