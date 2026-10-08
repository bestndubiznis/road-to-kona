const messages = {
 setup_required:'On-demand checks need a one-time server connection. Finish setup in TrainingPeaks connection settings.',
 paused:'TrainingPeaks checks are paused. Enable the hosted check in connection settings.',
 idle:'Automatic checks every two hours, 7:30 a.m.–9:30 p.m. Pacific. You can also request a check here.',
 dispatching:'Requesting a TrainingPeaks check…',
 queued:'Check requested. Waiting for the hosted runner to start; this page will update automatically.',
 running:'Checking TrainingPeaks for completed workouts and coach plans…',
 success:'TrainingPeaks check completed. The latest saved workouts are loaded.',
 delayed:'This check is taking longer than expected. The last successful sync time has not changed. You can retry.',
 connection_error:'GitHub access needs attention. Renew GITHUB_SYNC_TOKEN in server settings, then try again.',
 dispatch_error:'Could not confirm that GitHub accepted the check. Wait for the retry time below before requesting another.',
 needs_login:'TrainingPeaks sign-in needs attention. Update the hosted credentials in connection settings.',
 error:'The TrainingPeaks check failed. See connection settings; your saved workout history is unchanged.'
};
export function createSyncControls({api,refresh,owner}) {
 const $=id=>document.getElementById(id);
 $('lastSynced').insertAdjacentHTML('afterend','<div id="manualSync" hidden><button id="checkTrainingPeaks" type="button" class="button outline small">Check TrainingPeaks now</button><p id="manualSyncStatus" class="fine" role="status" aria-live="polite"></p></div>');
 let state={},timer=null,pollStarted=0,requesting=false;
 function stop(){clearTimeout(timer);timer=null;pollStarted=0;}
 async function request(){
  if(!owner()||requesting)return;
  requesting=true;stop();$('manualSyncStatus').textContent='Requesting a TrainingPeaks check…';$('hostedRequestStatus').textContent='Requesting a TrainingPeaks check…';
  for(const id of ['checkTrainingPeaks','syncNow'])$(id).disabled=true;
  try{state=await api('hosted_sync_now');await refresh();}
  catch(e){$('manualSyncStatus').textContent=e.message;$('hostedRequestStatus').textContent=e.message;}
  finally{requesting=false;paint(state,true);}
 }
 function paint(next={},keepMessage=false){
  state=next;$('manualSync').hidden=!owner();
  if(!owner()){stop();return;}
  const cooldown=Date.parse(state.retry_at||'')>Date.now();
  const pending=['queued','dispatching','running'].includes(state.status);
  const text=(messages[state.status]||'Refresh to check sync status.')+(cooldown?' Another request is available after '+new Date(state.retry_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'.':'');
  if(!keepMessage){$('manualSyncStatus').textContent=text;$('hostedRequestStatus').textContent=text;}
  $('dispatchSetup').hidden=!!state.configured;
  for(const id of ['checkTrainingPeaks','syncNow'])$(id).disabled=requesting||cooldown||state.status==='paused';
  if(pending&&!timer){
   if(!pollStarted)pollStarted=Date.now();
   if(Date.now()-pollStarted<20*60000)timer=setTimeout(async()=>{timer=null;if(owner()&&!document.hidden)await refresh();else paint(state);},15000);
  }else if(!pending)stop();
 }
 $('checkTrainingPeaks').onclick=request;$('syncNow').onclick=request;
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&owner()&&pollStarted)refresh();});
 return {paint};
}
