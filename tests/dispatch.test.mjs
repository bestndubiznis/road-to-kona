import test from 'node:test';
import assert from 'node:assert/strict';
import {latestSlot,shouldDispatch,dispatchSync,dispatchView,dispatchAlert} from '../supabase/functions/fitness-api/dispatch.mjs';
const now=new Date('2026-10-08T04:30:00Z'),hosted={enabled:true,last_success_at:'2026-10-07T21:30:00Z'};
test('Pacific slots include both 9:30 targets, handle DST, and sleep overnight',()=>{
 assert.equal(latestSlot(new Date('2026-10-07T16:30:00Z')),'2026-10-07T16:30:00.000Z');
 assert.equal(latestSlot(now),'2026-10-08T04:30:00.000Z');
 assert.equal(latestSlot(new Date('2026-12-08T05:45:17.123Z')),'2026-12-08T05:30:00.000Z');
 assert.equal(latestSlot(new Date('2026-11-01T17:30:00Z')),'2026-11-01T17:30:00.000Z');
 assert.equal(latestSlot(new Date('2026-03-08T16:30:00Z')),'2026-03-08T16:30:00.000Z');
 assert.equal(latestSlot(new Date('2026-10-08T14:29:00Z')),null);
 assert.equal(latestSlot(new Date('2026-10-08T06:30:00Z')),null);
});
test('successful slots are skipped; failures have bounded retries and cooldown',()=>{
 assert.equal(shouldDispatch({...hosted,last_success_at:now.toISOString()},{},false,now),'not_due');
 assert.equal(shouldDispatch(hosted,{slot:latestSlot(now),attempts:2},false,now),'retry_limit');
 assert.equal(shouldDispatch(hosted,{retry_at:'2026-10-08T04:40:00Z'},true,now),'cooldown');
 assert.equal(shouldDispatch({...hosted,status:'needs_login'},{},false,now),'needs_login');
 assert.equal(shouldDispatch({enabled:false},{},true,now),'paused');
 assert.equal(shouldDispatch({...hosted,status:'running',last_attempt_at:now.toISOString()},{},true,now),'busy');
});
test('no token means no request, and a queued request is never a successful import',async()=>{
 const result=await dispatchSync({hosted,state:{},now,claim:()=>assert.fail()});
 assert.equal(result.status,'setup_required');
 assert.equal(dispatchView(hosted,{requested_at:now.toISOString(),status:'queued'},true,now).status,'queued');
 assert.equal(dispatchView({...hosted,last_success_at:'2026-10-08T04:32:00Z'},{requested_at:now.toISOString(),status:'queued'},true,now).status,'success');
});
test('concurrent taps dispatch only once and retain cooldown',async()=>{
 let claimed=false,calls=0,stored;
 const options={hosted,state:{},token:'fake-test-token',manual:true,now,
 claim:async(_,next)=>{if(claimed)return false;claimed=true;stored=next;return true;},
 finish:async(_,next)=>{stored=next;},
 fetcher:async(url,init)=>{calls++;assert.match(url,/road-to-kona\/actions\/workflows\/trainingpeaks-sync.yml\/dispatches$/);assert.deepEqual(JSON.parse(init.body),{ref:'main'});return {ok:true};}};
 const results=await Promise.all([dispatchSync(options),dispatchSync(options)]);
 assert.equal(calls,1);assert.equal(results[0].status,'queued');assert.equal(results[1].reason,'busy');assert.equal(stored.retry_at,'2026-10-08T04:50:00.000Z');
});
test('credential errors and uncertain network outcomes surface without leaking responses',async()=>{
 for(const [fetcher,expected] of [[async()=>({ok:false,status:403,text:()=> 'secret detail'}),'connection_error'],[async()=>{throw new Error('secret detail');},'dispatch_error']]){
  const result=await dispatchSync({hosted,state:{},token:'fake-test-token',now,claim:async()=>true,finish:async()=>{},fetcher});
  assert.equal(result.status,expected);assert.ok(!JSON.stringify(result).includes('secret'));assert.ok(dispatchAlert(hosted,{...result,status:expected},true,now));
 }
});
test('stalled requests alert, fresh success clears them, paused connection stays quiet',()=>{
 const state={status:'queued',requested_at:'2026-10-08T04:00:00Z'};
 assert.equal(dispatchView(hosted,state,true,now).status,'delayed');assert.ok(dispatchAlert(hosted,state,true,now));
 assert.equal(dispatchAlert({...hosted,last_success_at:'2026-10-08T04:29:00Z'},state,true,now),null);
 assert.equal(dispatchAlert({enabled:false},state,true,now),null);
});
