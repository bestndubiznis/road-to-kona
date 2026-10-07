import test from 'node:test';import assert from 'node:assert/strict';
import {parseTpExport,reconcileTp,syncAlert} from '../lib/tp-hosted.mjs';
const csv='Title,WorkoutType,WorkoutDay,TimeTotalInHours,DistanceInMeters,PlannedDuration,WorkoutDescription\nLift,Strength,2026-10-06,,,0.5,Three prescribed sets\nRunning,Run,2026-10-05,0.5,5000,0.5,Easy run';
test('hosted export distinguishes prescriptions from actuals; no invented lifting sets',()=>{
 const [plan,run]=parseTpExport(csv,'2026-10-06');assert.equal(plan.status,'planned');assert.equal(plan.duration_hours,0);assert.equal(plan.exercises,undefined);assert.equal(run.status,'completed');assert.equal(run.duration_hours,.5);
});
test('matching source actual refresh preserves user notes, sets and visibility',async()=>{
 const row=parseTpExport(csv,'2026-10-06')[1],old={id:'x',external_id:'history:153',data:{...row,source:'TrainingPeaks browser export',private_notes:'My own note',exercises:[{name:'Squat',sets:[{reps:5}]}],public_progress:false}};
 const {changes}=await reconcileTp([{...row,duration_hours:.6}],[old]);assert.equal(changes[0].external_id,'history:153');assert.equal(changes[0].data.private_notes,'My own note');assert.equal(changes[0].data.public_progress,false);assert.equal(changes[0].data.exercises.length,1);
});
test('known alternate recordings and ambiguous matches never double totals',async()=>{
 const row=parseTpExport(csv,'2026-10-06')[1];let r=await reconcileTp([row],[{id:'x',data:{date:row.date,type:row.type,status:'completed',duplicate_source_records:[row.trainingpeaks_export]}}]);assert.equal(r.changes.length,0);
 r=await reconcileTp([row,row],[]);assert.equal(r.changes.length,0);assert.equal(r.reviews.length,1);
 r=await reconcileTp([row],[{id:'x',data:{date:row.date,type:'Run',duration_hours:.5,status:'completed',source:'Manual'}}]);assert.equal(r.changes.length,0);assert.equal(r.reviews.length,1);
});
test('cloud alerts cover login errors and runner silence, with setup grace',()=>{
 const now=new Date('2026-10-07T20:00:00Z');assert.equal(syncAlert({enabled:false,status:'error'},now),null);assert.equal(syncAlert({enabled:true,started_at:now.toISOString()},now),null);
 assert.equal(syncAlert({enabled:true,status:'needs_login'},now).key,'needs_login');assert.equal(syncAlert({enabled:true,last_success_at:'2026-10-05T01:00:00Z'},now).key,'stale');
});
