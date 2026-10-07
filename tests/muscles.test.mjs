import test from 'node:test';
import assert from 'node:assert/strict';
import {muscleSummary,exerciseMuscles,muscleScore} from '../lib/muscles.mjs';
test('only completed in-range actuals contribute; cardio does not invent sets',()=>{
 const rows=[{date:'2026-10-05',type:'Bike',duration_hours:1},{date:'2026-10-06',type:'Swim',status:'planned'},{date:'2026-01-01',type:'Run'}];
 const {groups}=muscleSummary(rows,{start:'2026-10-01',end:'2026-10-06'});
 assert.equal(groups.quads.sessions,1);assert.equal(groups.quads.sets,0);assert.equal(groups.shoulders.sessions,0);
});
test('mixed triathlon history contributes sports once per session without invented splits',()=>{
 const {groups}=muscleSummary([{date:'2026-09-13',type:'Race',bike_miles:56,run_miles:13.1,swim_yards:2112}],{end:'2026-10-06'});
 assert.deepEqual(groups.core.sports,{Swim:1,Bike:1,Run:1});assert.equal(groups.core.sessions,1);assert.equal(groups.core.sets,0);
});
test('private working sets map compound movements; warmups and unknown names excluded',()=>{
 const row={date:'2026-10-06',type:'Strength',exercises:[{name:'Squat',sets:[{reps:5,kind:'warmup'},{reps:5},{reps:5}]},{name:'Mystery movement',sets:[{reps:8}]}]};
 const privateResult=muscleSummary([row],{privateDetails:true,end:'2026-10-06'});
 assert.equal(privateResult.groups.quads.sets,2);assert.equal(privateResult.groups.glutes.sets,2);assert.equal(privateResult.unmapped,1);
 assert.equal(muscleSummary([row],{end:'2026-10-06'}).groups.quads.sets,0);
 assert.deepEqual(exerciseMuscles('DB Romanian deadlift'),['hamstrings','glutes','back']);
});

test('both counts mixed sessions once and mode-specific latest dates follow period',()=>{
 const rows=[{date:'2026-10-04',type:'Bike',exercises:[{name:'Squat',sets:[{seconds:30},{reps:5}]}]},{date:'2026-10-06',type:'Strength',exercises:[{name:'Squat',sets:[{reps:5}]}]}];
 const g=muscleSummary(rows,{privateDetails:true,start:'2026-10-01',end:'2026-10-06'}).groups.quads;
 assert.equal(muscleScore(g,'both'),2);assert.equal(muscleScore(g,'strength'),3);assert.equal(muscleScore(g,'endurance'),1);assert.equal(g.enduranceLast,'2026-10-04');assert.equal(g.strengthLast,'2026-10-06');
 const recent=muscleSummary(rows,{privateDetails:true,start:'2026-10-05',end:'2026-10-06'}).groups.quads;assert.equal(muscleScore(recent,'both'),1);assert.equal(recent.enduranceLast,null);
});
