import {dateStart, progressWeeks, filterWorkouts, bestEfforts, clockTime, SANTA_CRUZ} from './lib/progress.mjs';
import { parseWorkoutNote } from './lib/note-parser.mjs';
import { setupPush } from './push.mjs';
import { number, localDate, completed, totals, weekly, strengthHistory, trainingPeaksCsv, validateWorkout } from './lib/fitness.mjs';
const $ = id => document.getElementById(id), C = window.FITNESS_CONFIG;
const fmt = (n, d=0) => number(n).toLocaleString(undefined,{maximumFractionDigits:d});
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty = (date, options={month:'short',day:'numeric'}) => new Date(date+'T12:00:00').toLocaleDateString('en-US',options);
const sportIcon = type => ({Swim:'≈',Bike:'◎',Run:'↗',Strength:'↔',Race:'⚑',Walk:'↗',Hike:'△',Mobility:'↝'}[type] || '○');
const status = (id,text,error=false) => { $(id).textContent=text; $(id).className='form-status '+(error?'error':'success'); };
const auth = window.supabase?.createClient(C.supabaseUrl,C.publishableKey);
let session = null, owner = false, rows = window.WORKOUTS || [], checkins = [], connections = {}, active='All', visible=15, editing=null, importRows=[], refreshVersion=0, parsedNote=null, notificationPending=new URLSearchParams(location.search).get('log')==='strength';
async function api(action, body={}) {
  const url=C.apiUrl+(action==='public'?'?resource=public':action==='private'?'?resource=private':'');
  const r=await fetch(url,{method:['public','private'].includes(action)?'GET':'POST',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})},...(!['public','private'].includes(action)?{body:JSON.stringify({action,...body})}:{}),signal:AbortSignal.timeout(45000)});
  const data=await r.json(); if(!r.ok) throw new Error(data.error || 'Could not load the log.'); return data;
}
function rangeRows() {
 const range=$('range').value, today=localDate(); if(range==='all') return rows;
 const d=new Date(today+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-Number(range)+1);
 const start=range==='year'?today.slice(0,4)+'-01-01':d.toISOString().slice(0,10);
 return rows.filter(r=>r.date>=start && r.date<=today);
}
function paintProgress() {
 const t=totals(rangeRows()); $('stats').innerHTML=[['sessions',t.sessions,'','Sessions logged'],['hours',t.hours,'hr','Training time'],['bike',t.bike,'mi','On the bike'],['run',t.run,'mi','Run & walk'],['swim',t.swim,'yd','In the water'],['strength',t.strength,'','Strength sessions']].map(([key,value,unit,label])=>`<div class="stat"><div class="stat-value">${fmt(value,['hours','bike','run'].includes(key)?1:0)} <small>${unit}</small></div><div class="stat-label">${label}</div></div>`).join('');
 const weeks=progressWeeks(rows,$('range').value), max=Math.max(1,...weeks.map(w=>w.endurance+w.strength)); $('chartScale').textContent=fmt(max,1)+' hr';
 $('volumeChart').innerHTML=weeks.map(w=>{const total=w.endurance+w.strength; return `<div class="bar-wrap" tabindex="0" role="img" aria-label="Week of ${pretty(w.date)}: ${fmt(total,1)} hours, ${w.sessions} sessions" title="Week of ${pretty(w.date)} · ${fmt(total,1)} hr · ${w.sessions} sessions"><div class="bar-label">${total?fmt(total,1):''}</div><div class="bar-stack" style="height:${total/max*83}%"><div class="bar-part strength" style="height:${total?w.strength/total*100:0}%"></div><div class="bar-part endurance" style="height:${total?w.endurance/total*100:0}%"></div></div></div>`;}).join('');
 $('chartPeriod').textContent=$('range').selectedOptions[0].textContent.toUpperCase()+' · WEEKLY HOURS';$('volumeChart').style.setProperty('--week-count',weeks.length);$('chartStart').textContent=pretty(dateStart($('range').value,localDate(),completed(rows))); $('chartEnd').textContent=pretty(weeks.at(-1).date);
 const d=new Date(localDate()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-29);const since=d.toISOString().slice(0,10), recent=completed(rows).filter(r=>r.date>=since && r.date<=localDate()), rt=totals(recent);
 $('recentStats').innerHTML=[['Sessions',rt.sessions],['Hours logged',fmt(rt.hours,1)],['Strength sessions',rt.strength]].map(([label,value])=>`<div class="recent-row"><span>${label}</span><strong>${value}</strong></div>`).join('');
 $('recentNote').textContent=recent.length?'Latest logged session: '+pretty(recent.map(r=>r.date).sort().at(-1))+'.':'No sessions logged in the last 30 days. Add a workout or connect a source to keep the record current.';
}
function paintStrength() {
 const names=owner?[...new Set(completed(rows).flatMap(r=>(r.exercises||[]).map(e=>e.name)))].sort():[];
 const selected=$('exerciseSelect').value; $('exerciseSelect').innerHTML=names.length?names.map(n=>`<option>${esc(n)}</option>`).join(''):'<option>No sets logged yet</option>';
 if(names.includes(selected)) $('exerciseSelect').value=selected; $('exerciseSelect').disabled=!names.length;
 $('strengthSummary').innerHTML=`<div class="metric-pills"><span>${totals(rows).strength} strength sessions recorded</span>${owner?`<span>${names.length} exercises with sets</span>`:''}</div>`;
 paintLift();
}
function paintLift() {
 if(!owner){$('strengthChart').innerHTML='<div class="empty"><span class="empty-icon">↔</span>Sign in to see your private lifting history.<br>Your public progress includes strength session totals.</div>';return;}
 const history=strengthHistory(rows,$('exerciseSelect').value);
 if(!history.length){$('strengthChart').innerHTML='<div class="empty"><span class="empty-icon">↔</span>Your earlier strength notes are preserved.<br>Log sets and reps to start tracking lift progression.</div>';return;}
 $('strengthChart').innerHTML='<table class="strength-history"><thead><tr><th>DATE</th><th>TOP LOAD</th><th>WORK VOLUME</th><th>EST. 1RM*</th></tr></thead><tbody>'+history.slice(-8).map(h=>`<tr><td>${pretty(h.date)}</td><td>${h.unit==='bodyweight'?'Bodyweight':fmt(h.best,1)+' '+h.unit}</td><td>${fmt(h.volume)} ${h.unit==='bodyweight'?'':h.unit+' × reps'}</td><td>${h.estimatedMax?fmt(h.estimatedMax,1)+' '+h.unit:'—'}</td></tr>`).join('')+'</tbody></table>';
 $('strengthChart').title='Estimated 1RM uses Epley on working sets of 1–10 reps. It is not a measured maximum.';
}
function paintTabs() {
 const types=['All',...new Set(completed(rows).map(r=>r.type))]; if(totals(rows).strength && !types.includes('Strength'))types.push('Strength');
 $('typeTabs').innerHTML=types.map(t=>`<button class="tab ${t===active?'active':''}" aria-pressed="${t===active}">${esc(t)}</button>`).join('');
 [...$('typeTabs').children].forEach(b=>b.onclick=()=>{active=b.textContent;visible=15;paintTabs();paintLog();});
}
function workoutMeta(r) {
 return [r.duration_hours?fmt(r.duration_hours*60,1)+' min':null,r.bike_miles?fmt(r.bike_miles,1)+' mi bike':null,r.run_miles?fmt(r.run_miles,1)+' mi run / walk':null,r.swim_yards?fmt(r.swim_yards)+' yd swim':null,r.strength && r.type!=='Strength'?'+ strength':null,owner && r.rpe?'RPE '+r.rpe:null].filter(Boolean).join(' · ') || 'Duration not recorded';
}
function paintLog() {
 const filtered=filterWorkouts(rows,{sport:active,status:owner?$('logStatus').value:'completed',start:$('logFrom').value,end:$('logTo').value,term:$('search').value,sort:$('logSort').value,privateDetails:owner});
 $('logCount').textContent=Math.min(visible,filtered.length)+' of '+filtered.length+' matching workouts';$('showAll').hidden=filtered.length<=visible;
 $('workoutList').innerHTML=filtered.slice(0,visible).map(r=>`<article class="workout-row"><div class="workout-date"><b>${pretty(r.date)}</b>${r.date.slice(0,4)}</div><div class="sport-icon ${r.type==='Strength'?'strength':''}" aria-hidden="true">${sportIcon(r.type)}</div><div><h3>${esc(r.title)}${r.status==='planned'?' <span class="badge">'+(r.date<localDate()?'No actuals recorded':'Planned')+'</span>':r.status==='skipped'?' <span class="badge">Skipped</span>':''}</h3><div class="workout-meta">${esc(workoutMeta(r))}</div></div><div class="workout-actions"><span class="workout-source">${esc(r.source || 'Manual')}</span>${owner?`<button class="text-button edit-workout" data-id="${esc(r.id)}">Edit ↗</button>`:''}</div>${owner?`<details class="private-details"><summary>Private notes & sets</summary><p>${esc([r.summary,r.details,r.private_notes].filter(Boolean).join('\n')) || 'No notes recorded.'}</p>${(r.exercises||[]).map(e=>`<strong>${esc(e.name)} · ${esc(e.unit)}</strong><table class="sets-read"><tr><th>Set</th><th>Reps</th><th>Load</th><th>Effort</th></tr>${e.sets.map((s,i)=>`<tr><td>${i+1}${s.kind==='warmup'?' · warm-up':''}</td><td>${esc(s.reps)}</td><td>${e.unit==='bodyweight'?'BW':esc(s.weight)+' '+esc(e.unit)}</td><td>${s.rpe||'—'}</td></tr>`).join('')}</table>`).join('')}</details>`:''}</article>`).join('')||'<div class="empty">No workouts match this view.</div>';
 $('loadMore').hidden=filtered.length<=visible; document.querySelectorAll('.edit-workout').forEach(b=>b.onclick=()=>openWorkout(rows.find(r=>r.id===b.dataset.id)));
}
function paintPlans() {
 const planned=rows.filter(r=>r.status==='planned' && r.date>=localDate()).sort((a,b)=>a.date.localeCompare(b.date)).slice(0,12);
 $('plannedList').innerHTML=planned.length?planned.map(r=>`<article class="plan-card"><div class="eyebrow">${pretty(r.date)} · ${esc(r.type)}</div><h3>${esc(r.title)}</h3><p class="fine">${esc(r.source)}</p><button class="button outline small complete-plan" data-id="${r.id}">Log actual workout ↗</button></article>`).join(''):'<p class="muted">Connect your TrainingPeaks calendar below, or add a prescription. Only verified planned strength days will trigger a lifting check-in.</p>';
 document.querySelectorAll('.complete-plan').forEach(b=>b.onclick=()=>openWorkout({...rows.find(r=>r.id===b.dataset.id),status:'completed'}));
}
function paintRecovery() {
 $('recoveryList').innerHTML=checkins.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10).map(({date,data:r})=>`<div class="recovery-row"><strong>${pretty(date)}</strong>${[['sleep_hours','h sleep'],['energy','/5 energy'],['soreness','/5 soreness'],['weight',' '+(r.weight_unit||'lb')],['resting_hr',' bpm resting'],['hrv',' ms HRV']].filter(([k])=>r[k]!=null).map(([k,u])=>'<span>'+esc(r[k])+u+'</span>').join('')}</div>`).join('')||'<p class="fine">No recovery check-ins yet. Log only the metrics you find useful.</p>';
}
function paintEndurance() {
 const sport=$('enduranceSport').value, sessions=completed(rows).filter(r=>r.type===sport && r.source!=='Notes' && r.history_quality!=='reconstructed').sort((a,b)=>b.date.localeCompare(a.date)).slice(0,10);
 const pace=r=>{const distance=sport==='Run'?r.run_miles:sport==='Swim'?r.swim_yards/100:0;if(!distance||!r.duration_hours)return '—';const seconds=Math.round(r.duration_hours*3600/distance);return Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0')+(sport==='Swim'?' /100 yd':' /mi');};
 $('enduranceHistory').innerHTML=sessions.length?'<div class="table-scroll"><table class="strength-history"><thead><tr><th>DATE</th><th>'+ (sport==='Bike'?'AVG POWER':'SESSION PACE') +'</th><th>AVG HR</th><th>EFFORT</th></tr></thead><tbody>'+sessions.map(r=>'<tr><td>'+pretty(r.date)+'</td><td>'+(sport==='Bike'?(r.average_power?fmt(r.average_power)+' W':'—'):pace(r))+'</td><td>'+(r.average_hr?fmt(r.average_hr)+' bpm':'—')+'</td><td>'+(r.rpe?'RPE '+r.rpe:'—')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Log an endurance session with measured duration and distance to start comparing performance.</p>';
}
function paintConnections() {
 $('calendarBadge').textContent=connections.calendar?'Connected':'Not connected';$('intervalsBadge').textContent=connections.intervals?'Connected':'Optional';$('athleteId').value=connections.athlete||'';
 const sync=connections.last_sync;$('syncStatus').textContent=sync?'Last sync: '+new Date(sync.at).toLocaleString('en-US',{timeZone:'America/Los_Angeles'})+' Pacific. '+(sync.calendar_error||'')+' '+(sync.activities_error||'')+(sync.calendar==='connected'?' '+sync.planned+' upcoming prescriptions; '+sync.strength_planned+' identified as strength.':''):'Connect a source to enable hourly background syncing.';
}
function render() {
 $('signIn').textContent=owner?'My private log ↗':'Private log ↗'; $('modeLabel').textContent=owner?'YOUR PRIVATE LOG':'PUBLIC PROGRESS';$('ownerBadge').hidden=!owner;$('signOut').hidden=!session;if(notificationPending&&!session&&!$('loginDialog').open)$('loginDialog').showModal();
 document.querySelectorAll('.private-section').forEach(el=>el.hidden=!owner);paintProgress();paintBest();paintStrength();paintTabs();paintLog();if(owner){paintPlans();paintRecovery();paintEndurance();paintConnections();push.refresh();if(notificationPending){notificationPending=false;setTimeout(openNotificationWorkout,0);}}
}
async function refresh() {
 const version=++refreshVersion, token=session?.access_token;
 try {const data=await api(session?'private':'public');if(version!==refreshVersion || token!==session?.access_token)return;owner=!!session;rows=data.workouts;checkins=data.checkins||[];connections=data.connections||{};$('dataStatus').textContent=completed(rows).length+' completed sessions · '+(owner?'Private details visible only to you.':'Detailed logs stay private.');if(owner)$('loginDialog').close();}
 catch(e){if(version!==refreshVersion || token!==session?.access_token)return;owner=false;rows=window.WORKOUTS||[];checkins=[];connections={};$('dataStatus').textContent=session?'Sign-in could not unlock the owner log. '+e.message:'Showing saved historical totals. Live data is temporarily unavailable.';if(session)status('loginStatus',e.message,true);}
 render();
}
function requireOwner(action) {if(owner){action();return;} $('loginDialog').showModal();}
function openWorkout(row=null,type=null,planned=false) {
 editing=row?structuredClone(row):null; $('workoutForm').reset();$('exerciseEditor').replaceChildren();$('workoutSaveStatus').textContent='';parsedNote=null;$('notePreview').hidden=true;$('applyParsedNote').hidden=true;
 $('workoutDate').value=row?.date||localDate();$('workoutType').value=type||row?.type||'Strength';$('workoutStatus').value=planned?'planned':row?.status||'completed';$('workoutTitle').value=row?.title||'';
 $('workoutHeading').textContent=row?'Update workout.':planned?'Add a prescription.':'Log a workout.';
 for(const [id,key,scale] of [['workoutMinutes','duration_hours',60],['bikeMiles','bike_miles',1],['runMiles','run_miles',1],['swimYards','swim_yards',1],['workoutRpe','rpe',1],['averageHr','average_hr',1],['averagePower','average_power',1],['elevation','elevation_feet',1],['workoutTss','tss',1]])$(id).value=row?.[key]?Number((row[key]*scale).toFixed(3)):'';
 $('workoutNotes').value=row?.private_notes||'';$('publicProgress').checked=row?.public_progress!==false;
 for(const exercise of row?.exercises||[]) addExercise(exercise);
 if(!row && $('workoutType').value==='Strength')addExercise();$('workoutDialog').showModal();
}
function addExercise(exercise={name:'',unit:'lb',sets:[{reps:'',weight:'',rpe:'',kind:'working'}]}) {
 const div=document.createElement('div');div.className='exercise-edit';div.innerHTML=`<div class="exercise-top"><input class="exercise-name" required aria-label="Exercise name" placeholder="Exercise, e.g. squat" value="${esc(exercise.name)}"><select class="exercise-unit" required aria-label="Load unit"><option value="">Choose unit</option><option>lb</option><option>kg</option><option>bodyweight</option></select><button class="remove remove-exercise" type="button" aria-label="Remove exercise">×</button></div><div class="set-head"><span>#</span><span>Reps</span><span>Load</span><span>RPE</span><span>Kind</span><span></span></div><div class="set-list"></div><button type="button" class="text-button add-set">+ Add set</button>`;
 div.querySelector('.exercise-unit').value=exercise.unit;div.querySelector('.exercise-unit').onchange=()=>{const bw=div.querySelector('.exercise-unit').value==='bodyweight';for(const input of div.querySelectorAll('.weight')){input.required=!bw;input.disabled=bw;if(bw)input.value=0;}};div.querySelector('.remove-exercise').onclick=()=>div.remove();div.querySelector('.add-set').onclick=()=>addSet(div);$('exerciseEditor').appendChild(div);
 for(const set of exercise.sets||[])addSet(div,set);
}
function addSet(div,set={reps:'',weight:'',rpe:'',kind:'working'}) {
 const el=document.createElement('div');el.className='set-edit';el.innerHTML=`<span>${div.querySelectorAll('.set-edit').length+1}</span><input class="reps" type="number" min="1" max="1000" step="1" required aria-label="Reps" value="${esc(set.reps)}"><input class="weight" type="number" required min="0" step="0.25" aria-label="Load" value="${esc(set.weight)}"><input class="rpe" type="number" min="1" max="10" step="0.5" aria-label="Set effort" value="${esc(set.rpe??'')}"><select class="set-kind" aria-label="Set kind"><option value="working">Work</option><option value="warmup">Warm-up</option></select><button type="button" class="remove" aria-label="Remove set">×</button>`;
 const bw=div.querySelector('.exercise-unit').value==='bodyweight';el.querySelector('.weight').required=!bw;el.querySelector('.weight').disabled=bw;if(bw)el.querySelector('.weight').value=0;el.querySelector('select').value=set.kind||'working';el.querySelector('button').onclick=()=>{el.remove();div.querySelectorAll('.set-edit').forEach((r,i)=>r.firstElementChild.textContent=i+1);};div.querySelector('.set-list').appendChild(el);
}
function readExercises() {return [...$('exerciseEditor').children].map(div=>({name:div.querySelector('.exercise-name').value.trim(),unit:div.querySelector('.exercise-unit').value,sets:[...div.querySelectorAll('.set-edit')].map(s=>({reps:Number(s.querySelector('.reps').value),weight:Number(s.querySelector('.weight').value),rpe:s.querySelector('.rpe').value?Number(s.querySelector('.rpe').value):null,kind:s.querySelector('.set-kind').value}))}));}
$('parseNote').onclick=()=>{parsedNote=parseWorkoutNote($('workoutNotes').value);$('notePreview').hidden=false;$('applyParsedNote').hidden=!parsedNote.exercises.length;$('notePreview').innerHTML=parsedNote.exercises.length?'<h3>Proposed exercise rows</h3>'+parsedNote.exercises.map(e=>'<p><strong>'+esc(e.name)+'</strong> · '+e.sets.map(s=>s.reps+' reps'+(s.weight!==''?' at '+s.weight+' '+esc(e.unit||'(unit needed)'):' (load needed)')).join(' · ')+'</p>').join(''):'<p>No set patterns found yet. Try “squats 3 sets of 5 at 135 lb,” or enter sets below.</p>';if(parsedNote.issues.length)$('notePreview').innerHTML+='<div class="fine">'+parsedNote.issues.map(esc).join('<br>')+'</div>';if(parsedNote.unparsed.length)$('notePreview').innerHTML+='<p class="fine">Other details remain in your original note: '+esc(parsedNote.unparsed.join(' · '))+'</p>';};
$('applyParsedNote').onclick=()=>{if(!parsedNote)return;for(const div of [...$('exerciseEditor').children])if(!div.querySelector('.exercise-name').value.trim())div.remove();for(const e of parsedNote.exercises)addExercise(e);$('applyParsedNote').hidden=true;$('notePreview').innerHTML='<p class="fine">Exercise rows added below. Review loads and units, then save. Your original note is preserved.</p>';};
$('workoutForm').onsubmit=async e=>{e.preventDefault();$('saveWorkout').disabled=true;try{const workout=validateWorkout({...editing,date:$('workoutDate').value,type:$('workoutType').value,title:$('workoutTitle').value||$('workoutType').value+' workout',status:$('workoutStatus').value,duration_hours:number($('workoutMinutes').value)/60,bike_miles:number($('bikeMiles').value),run_miles:number($('runMiles').value),swim_yards:number($('swimYards').value),strength:$('workoutType').value==='Strength'||$('exerciseEditor').children.length?1:editing?.strength||0,rpe:$('workoutRpe').value?Number($('workoutRpe').value):null,average_hr:$('averageHr').value?Number($('averageHr').value):null,average_power:$('averagePower').value?Number($('averagePower').value):null,elevation_feet:$('elevation').value?Number($('elevation').value):null,tss:$('workoutTss').value?Number($('workoutTss').value):null,exercises:readExercises(),private_notes:$('workoutNotes').value,public_progress:$('publicProgress').checked,source:editing?.source||'Manual'});await api('save',{workout});await refresh();$('workoutDialog').close();}catch(e){status('workoutSaveStatus',e.message,true);}finally{$('saveWorkout').disabled=false;}};
$('addExercise').onclick=()=>addExercise();for(const id of ['addHero','addStrength','addWorkout'])$(id).onclick=()=>requireOwner(()=>openWorkout(null,id==='addStrength'?'Strength':null));$('addPlan').onclick=()=>openWorkout(null,'Strength',true);
$('signIn').onclick=()=>owner?$('plans').scrollIntoView():$('loginDialog').showModal();$('signOut').onclick=async()=>{await auth.auth.signOut();session=null;owner=false;rows=window.WORKOUTS||[];checkins=[];connections={};render();await refresh();};
$('loginForm').onsubmit=async e=>{e.preventDefault();if(!auth)return status('loginStatus','Sign-in is temporarily unavailable.',true);const button=e.submitter;button.disabled=true;try{const {error}=await auth.auth.signInWithOtp({email:$('email').value,options:{emailRedirectTo:C.siteUrl}});if(error)throw error;status('loginStatus','Check your email for a sign-in link. Only the owner email can unlock this log.');}catch(e){status('loginStatus',e.message,true);}finally{button.disabled=false;}};
$('useMagicLink').onclick=async()=>{try{const link=new URL($('magicLink').value), params=new URLSearchParams(link.hash.slice(1));const token=link.searchParams.get('token_hash')||link.searchParams.get('token');let result;if(params.has('access_token'))result=await auth.auth.setSession({access_token:params.get('access_token'),refresh_token:params.get('refresh_token')});else if(token)result=await auth.auth.verifyOtp({token_hash:token,type:'magiclink'});else throw new Error('Paste the complete sign-in link from your email.');if(result.error)throw result.error;session=result.data.session;$('magicLink').value='';await refresh();}catch(e){status('loginStatus',e.message,true);}};
$('range').onchange=paintProgress;$('search').oninput=()=>{visible=15;paintLog();};$('loadMore').onclick=()=>{visible+=15;paintLog();};$('exerciseSelect').onchange=paintLift;$('enduranceSport').onchange=paintEndurance;
$('addRecovery').onclick=()=>{$('recoveryForm').reset();$('recoveryDate').value=localDate();$('recoveryStatus').textContent='';$('recoveryDialog').showModal();};
$('recoveryForm').onsubmit=async e=>{e.preventDefault();const button=e.submitter;button.disabled=true;try{const checkin={date:$('recoveryDate').value,weight_unit:$('weightUnit').value,notes:$('recoveryNotes').value};for(const [id,key]of [['sleepHours','sleep_hours'],['energy','energy'],['soreness','soreness'],['bodyWeight','weight'],['restingHr','resting_hr'],['hrv','hrv']])checkin[key]=$(id).value?Number($(id).value):null;await api('checkin',{checkin});await refresh();$('recoveryDialog').close();}catch(e){status('recoveryStatus',e.message,true);}finally{button.disabled=false;}};
async function saveConnection(body){try{await api('connections',body);await api('sync');await refresh();$('calendarUrl').value='';$('intervalsKey').value='';}catch(e){$('syncStatus').textContent=e.message;}}
$('calendarForm').onsubmit=async e=>{e.preventDefault();if(!$('calendarUrl').value)return;const b=e.submitter;b.disabled=true;await saveConnection({calendar:$('calendarUrl').value});b.disabled=false;};$('intervalsForm').onsubmit=async e=>{e.preventDefault();if(!$('intervalsKey').value||!$('athleteId').value)return;const b=e.submitter;b.disabled=true;await saveConnection({athlete:$('athleteId').value,intervals_key:$('intervalsKey').value});b.disabled=false;};$('disconnectCalendar').onclick=()=>saveConnection({calendar:''});$('disconnectIntervals').onclick=()=>saveConnection({intervals_key:'',athlete:''});
$('syncNow').onclick=async()=>{const b=$('syncNow');b.disabled=true;$('syncStatus').textContent='Syncing…';try{await api('sync');await refresh();}catch(e){$('syncStatus').textContent=e.message;}finally{b.disabled=false;}};
$('csvFile').onchange=async()=>{importRows=[];$('confirmImport').hidden=true;try{const file=$('csvFile').files[0];if(!file)return;if(file.size>2000000)throw new Error('Choose a CSV smaller than 2 MB.');importRows=trainingPeaksCsv(await file.text());if(!importRows.length)throw new Error('No workouts found.');$('importPreview').innerHTML='<p class="fine">'+importRows.length+' rows ready to review. Existing matching sessions will be skipped.</p><div class="import-table">'+importRows.slice(0,12).map(r=>esc(r.date+' · '+r.type+' · '+r.title+' · '+fmt(r.duration_hours*60,1)+' min')).join('<br>')+'</div>';$('confirmImport').hidden=false;}catch(e){$('importPreview').textContent=e.message;}};
$('confirmImport').onclick=async()=>{const b=$('confirmImport');b.disabled=true;try{const result=await api('import',{workouts:importRows});await refresh();$('importPreview').textContent=result.imported+' new workouts imported.';b.hidden=true;importRows=[];}catch(e){$('importPreview').textContent=e.message;}finally{b.disabled=false;}};
for(const button of document.querySelectorAll('[data-close]'))button.onclick=()=>$(button.dataset.close).close();
function openNotificationWorkout(){requireOwner(()=>{const plan=rows.find(r=>r.date===localDate() && r.status==='planned' && (r.type==='Strength'||r.strength>0));openWorkout(plan?{...plan,status:'completed'}:null,'Strength');});}
const push=setupPush({api,requireOwner,openLog:()=>{notificationPending=true;if(owner){notificationPending=false;openNotificationWorkout();}else $('loginDialog').showModal();}});
render();
if(auth){const result=await auth.auth.getSession();session=result.data.session;auth.auth.onAuthStateChange((_event,newSession)=>{session=newSession;if(!session){owner=false;rows=window.WORKOUTS||[];checkins=[];connections={};render();}setTimeout(()=>refresh(),0);});}
await refresh();

function paintBest(){
 $('bestEfforts').innerHTML=bestEfforts(rows,$('bestSport').value).map(g=>'<article class="panel effort-card"><div class="eyebrow">'+esc(g.sport)+'</div><h3>'+esc(g.label)+'</h3>'+(g.records.length?'<ol>'+g.records.map(r=>'<li><div><strong>'+(g.kind==='time'?clockTime(r.effort_seconds):fmt(r[g.kind],g.kind==='swim_yards'?0:1)+' '+(g.kind==='swim_yards'?'yd':'mi'))+'</strong><span>'+pretty(r.date,{month:'short',day:'numeric',year:'numeric'})+'</span></div><p>'+esc(r.title)+(g.kind==='time'?' · '+fmt(r.effort_distance,2)+' mi'+(r.official?' · official split':' · whole-session time'):' · '+(r.type==='Race'&&r.date===SANTA_CRUZ.date?clockTime(SANTA_CRUZ[g.sport.toLowerCase()])+' official split':clockTime(r.duration_hours*3600)+(r.type==='Race'?' combined race time':'')))+'</p></li>').join('')+'</ol>':'<p class="muted">No qualifying recorded session yet.</p>')+'</article>').join('');
}
$('bestSport').onchange=paintBest;
$('logRange').onchange=()=>{const r=$('logRange').value;if(r==='custom')return;$('logFrom').value=r==='all'?'':dateStart(r);$('logTo').value=r==='all'?'':localDate();visible=15;paintLog();};
for(const id of ['logFrom','logTo'])$(id).onchange=()=>{$('logRange').value='custom';visible=15;paintLog();};
for(const id of ['logSort','logStatus'])$(id).onchange=()=>{visible=15;paintLog();};
$('showAll').onclick=()=>{visible=Infinity;paintLog();};
$('clearFilters').onclick=()=>{active='All';visible=15;for(const id of ['search','logFrom','logTo'])$(id).value='';$('logRange').value='all';$('logSort').value='newest';$('logStatus').value='completed';paintTabs();paintLog();};
