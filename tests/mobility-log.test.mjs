import test from 'node:test';
import assert from 'node:assert/strict';
import {mobilityUpdate,saveMobility} from '../supabase/functions/fitness-api/mobility-log.mjs';
import {publicWorkout,totals} from '../lib/fitness.mjs';
import {mobilityRoutine} from '../lib/mobility.mjs';
const now=new Date('2026-10-08T05:00:00Z'),date='2026-10-07';
const input={date,stretch_id:'calf',seconds_per_side:30,completed:true};
test('confirmed holds add actual seconds once and do not count as strength',()=>{
 let r=mobilityUpdate(null,input,now);r=mobilityUpdate(r,input,now);
 assert.equal(r.mobility_stretches.length,1);assert.equal(r.duration_hours,60/3600);
 r=mobilityUpdate(r,{...input,stretch_id:'back',seconds_per_side:45},now);
 assert.equal(r.duration_hours,105/3600);assert.equal(totals([r]).strength,0);assert.equal(totals([r]).sessions,1);
 assert.equal(mobilityRoutine([r],date).routine.length,0);
});
test('undo updates totals and empty sessions do not count; notes and privacy survive',()=>{
 let r=mobilityUpdate({private_notes:'private',public_progress:false},input,now);
 r=mobilityUpdate(r,{...input,completed:false},now);
 assert.equal(r.private_notes,'private');assert.equal(r.public_progress,false);assert.equal(r.status,'skipped');assert.equal(totals([r]).sessions,0);assert.equal(r.duration_hours,0);
});
test('public mobility details exclude private fields and completion timestamps',()=>{
 const r=mobilityUpdate({private_notes:'private'},input,now);r.mobility_stretches[0].secret='do not publish';
 const p=publicWorkout(r);assert.equal(p.mobility_stretches[0].seconds_per_side,30);
 assert.ok(!JSON.stringify(p).includes('private'));assert.ok(!JSON.stringify(p).includes('secret'));assert.equal(p.mobility_stretches[0].completed_at,undefined);
});
test('invalid dates, future completion, unknown stretches and invalid holds are rejected',()=>{
 for(const bad of [{date:'2026-02-30'},{date:'2026-10-09'},{stretch_id:'unknown'},{seconds_per_side:0},{seconds_per_side:601},{seconds_per_side:1.5},{completed:'yes'}])assert.throws(()=>mobilityUpdate(null,{...input,...bad},now));
});
test('simultaneous first completions merge into one daily session',async()=>{
 let row=null;
 const db={from(){let mode,values,expected;const q={select(){if(mode)return Promise.resolve(commit());return q;},eq(k,v){if(k==='data')expected=v;return q;},maybeSingle:async()=>({data:row?structuredClone(row):null}),insert(v){mode='insert';values=v;return q;},update(v){mode='update';values=v;return q;}};
 function commit(){if(mode==='insert'){if(row)return {error:{code:'23505'}};row={id:'daily',...structuredClone(values)};return {data:[{id:row.id}]};}if(expected!==JSON.stringify(row.data))return {data:[]};row={...row,...structuredClone(values)};return {data:[{id:row.id}]};}return q;}};
 await Promise.all([saveMobility(db,input,now),saveMobility(db,{...input,stretch_id:'back'},now)]);
 assert.equal(row.external_id,'mobility-day:'+date);assert.equal(row.data.mobility_stretches.length,2);assert.equal(row.data.duration_hours,90/3600);
});
test('Normatec minutes combine with stretches without losing either and undo independently',()=>{
 let row=mobilityUpdate(null,{date,stretch_id:'normatec',minutes:20,completed:true},now);
 assert.equal(row.duration_hours,0);assert.equal(row.strength,0);assert.equal(row.status,'completed');
 row=mobilityUpdate(row,input,now);assert.equal(row.duration_hours,1/60);
 row=mobilityUpdate(row,{date,stretch_id:'normatec',minutes:20,completed:true},now);assert.equal(row.duration_hours,1/60);
 assert.equal(publicWorkout(row).recovery_boots_minutes,20);
 row=mobilityUpdate(row,{date,stretch_id:'normatec',completed:false},now);assert.equal(row.duration_hours,1/60);assert.equal(row.mobility_stretches.length,1);
 assert.throws(()=>mobilityUpdate(null,{date,stretch_id:'normatec',minutes:0,completed:true},now));
});
