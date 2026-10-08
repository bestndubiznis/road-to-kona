const minute = 60000;
const time = value => Date.parse(value || '') || 0;
export function latestSlot(now = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone:'America/Los_Angeles', year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hourCycle:'h23' }).formatToParts(now).map(x=>[x.type,x.value]));
  const minutes = Number(p.hour)*60+Number(p.minute);
  if (minutes < 450 || minutes >= 1410) return null;
  const slotMinute = Math.min(1290,450+Math.floor((minutes-450)/120)*120);
  return new Date(now.getTime()-(minutes-slotMinute)*minute-Number(p.second)*1000-now.getMilliseconds()).toISOString();
}
export function dispatchView(hosted = {}, state = {}, configured = false, now = new Date()) {
  const requested = time(state.requested_at), success = time(hosted.last_success_at);
  let status = !configured?'setup_required':!hosted.enabled?'paused':'idle';
  if (configured && hosted.enabled && requested) {
    status = success >= requested ? 'success' : state.status || 'idle';
    if (success < requested && time(hosted.last_attempt_at) >= requested) {
      if (['error','needs_login'].includes(hosted.status)) status = hosted.status;
      else if (hosted.status === 'running') status = 'running';
    }
    if (['queued','dispatching','running'].includes(status) && now.getTime()-requested >= 20*minute) status = 'delayed';
  }
  return { configured, status, requested_at:state.requested_at || null, last_success_at:hosted.last_success_at || null, retry_at:state.retry_at || null };
}
export function shouldDispatch(hosted, state, manual, now = new Date()) {
  if (!hosted?.enabled) return 'paused';
  if (hosted.status==='running' && now.getTime()-time(hosted.last_attempt_at)<20*minute) return 'busy';
  if (time(state.retry_at)>now.getTime()) return 'cooldown';
  if (manual) return null;
  if (hosted.status==='needs_login') return 'needs_login';
  const slot = latestSlot(now);
  if (!slot || time(hosted.last_success_at)>=time(slot)) return 'not_due';
  if (state.slot===slot && state.attempts>=2) return 'retry_limit';
  return null;
}
// The database compare-and-swap grants one request a lease, including across devices.
export async function dispatchSync({hosted={},state={},token,manual=false,now=new Date(),claim,finish,fetcher=fetch}) {
  if (!token) return {...dispatchView(hosted,state,false,now),reason:'setup_required'};
  const reason = shouldDispatch(hosted,state,manual,now);
  if (reason) return {...dispatchView(hosted,state,true,now),reason};
  const slot = latestSlot(now);
  const next = {request_id:crypto.randomUUID(),requested_at:now.toISOString(),retry_at:new Date(now.getTime()+20*minute).toISOString(),slot,attempts:state.slot===slot?(state.attempts||0)+1:1,status:'dispatching'};
  if (!await claim(state,next)) return {...dispatchView(hosted,state,true,now),reason:'busy'};
  let status = 'queued';
  try {
    const response = await fetcher('https://api.github.com/repos/bestndubiznis/road-to-kona/actions/workflows/trainingpeaks-sync.yml/dispatches', {
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},
      body:JSON.stringify({ref:'main'})
    });
    if (!response.ok) status = [401,403,404].includes(response.status)?'connection_error':'dispatch_error';
  } catch { status = 'dispatch_error'; }
  const final = {...next,status}; await finish(next,final);
  return dispatchView(hosted,final,true,now);
}
export function dispatchAlert(hosted,state,configured,now=new Date()) {
  if (!configured || !hosted?.enabled) return null;
  const view = dispatchView(hosted,state,true,now);
  if (['connection_error','dispatch_error','delayed'].includes(view.status)) return {key:'dispatch_'+view.status,title:'TrainingPeaks check needs attention',body:view.status==='connection_error'?'The automatic check could not connect to GitHub. Open connection settings to renew its access.':'The requested TrainingPeaks check has not completed. Open connection settings to review or retry it.'};
  return null;
}
