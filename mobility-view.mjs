import {icon} from './lib/icons.mjs';
import {STRETCHES,mobilityRoutine} from './lib/mobility.mjs?v=mobility-log1';
import {localDate} from './lib/fitness.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createMobility({onSave}={}){
 $('weekAhead').insertAdjacentHTML('afterend',`<section id="mobility" class="section"><details class="panel mobility-panel"><summary><span><span class="eyebrow">AFTER TRAINING</span><h2>Mobility & recovery.</h2><span id="mobilityTeaser" class="muted">Based on completed workouts</span></span><span aria-hidden="true">${icon('plus')}</span></summary><div class="mobility-body"><label>Workout date<input id="mobilityDate" type="date" value="${localDate()}" max="${localDate()}"></label><p id="mobilityBasis" class="fine"></p><p class="fine">Start with warm muscles: after training, or after 5–10 minutes of easy movement. Hold gently for 30 seconds per side, breathe normally, and don’t bounce. Stop if it hurts; skip or swap anything uncomfortable. These suggestions support flexibility, not injury treatment or a recovery score.</p><p id="mobilityLogStatus" class="fine" role="status" aria-live="polite"></p><div id="mobilityCards" class="mobility-cards"></div><div class="mobility-timer"><div><strong id="mobilityClock">0:30</strong><span id="mobilityTimerLabel">Optional timer · one hold</span></div><button id="mobilityToggle" class="button outline" type="button">Start 30 seconds</button><button id="mobilityReset" class="text-button" type="button">Reset</button><span id="mobilityTimerStatus" role="status"></span></div><p class="fine">Repeat on the other side when indicated. When signed in, mark a stretch complete after doing the hold on all indicated sides. Only confirmed holds are added to your log. <a href="https://www.mayoclinic.org/healthy-lifestyle/fitness/in-depth/stretching/art-20047931" target="_blank" rel="noopener">Stretching guidance ↗</a></p></div></details></section>`);
 let owner=false,pending=new Set(),drafts=new Map(),overrides=new Map();
 let rows=[],live=false,signature='',running=false,remaining=30000,deadline=0,interval=null;
 function display(){const seconds=Math.ceil(remaining/1000);$('mobilityClock').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');$('mobilityToggle').textContent=running?'Pause':remaining===0?'Start again':remaining<30000?'Resume':'Start 30 seconds';}
 function stop(){if(interval)clearInterval(interval);interval=null;running=false;}
 function reset(){stop();remaining=30000;$('mobilityTimerStatus').textContent='';display();}
 function tick(){remaining=Math.max(0,deadline-Date.now());if(!remaining){stop();$('mobilityTimerStatus').textContent='Hold finished. Relax, then switch sides if needed.';}display();}
 $('mobilityToggle').onclick=()=>{if(running){remaining=Math.max(0,deadline-Date.now());stop();display();return;}if(!remaining)remaining=30000;deadline=Date.now()+remaining;running=true;$('mobilityTimerStatus').textContent='';interval=setInterval(tick,200);display();};$('mobilityReset').onclick=reset;
 function draw(){
 const focused=document.activeElement?.closest('[data-stretch]')?.dataset.stretch;
 const wasInput=document.activeElement?.classList.contains('mobility-seconds');
 $('mobilityCards').querySelectorAll('[data-stretch]').forEach(card=>{const input=card.querySelector('input');if(input&&!input.disabled)drafts.set(($('mobilityDate').dataset.drawnDate||$('mobilityDate').value)+':'+card.dataset.stretch,input.value);});
 $('mobilityDate').dataset.drawnDate=$('mobilityDate').value;

 const date=$('mobilityDate').value||localDate(),result=mobilityRoutine(rows,date),saved=rows.filter(r=>r.date===date&&r.type==='Mobility'&&r.status==='completed').flatMap(r=>r.mobility_stretches||[]);
 const savedById=new Map(saved.map(s=>[s.id,s]));
 const bootsMinutes=rows.filter(r=>r.date===date&&r.type==='Mobility'&&r.status==='completed').reduce((n,r)=>n+Number(r.recovery_boots_minutes||0),0);
 if(bootsMinutes)savedById.set('normatec',{seconds_per_side:bootsMinutes});
 const routine=live?result.routine.map((s,i)=>{const id=overrides.get(date+':'+i);return id?{...STRETCHES.find(x=>x.id===id),reasons:['your selection']}:s;}):[];
 for(const done of saved){if(!routine.some(s=>s.id===done.id)){const stretch=STRETCHES.find(s=>s.id===done.id);if(stretch)routine.push({...stretch,reasons:['your logged routine']});}}
 const unique=routine.filter((s,i)=>routine.findIndex(x=>x.id===s.id)===i);
 $('mobilityTeaser').textContent=unique.length?unique.length+' stretches'+(saved.length?' · '+saved.length+' completed':''):'Optional stretches from your workout history';
 $('mobilityBasis').textContent=!live?'Live workouts are unavailable. Reconnect before logging mobility.':!result.actualCount?'No completed training workouts recorded for '+date+'. A workout may not have synced yet.':result.unmapped?'Completed workouts are recorded, but there is not enough sport or exercise detail to tailor a routine.':date+' · Based on '+result.actualCount+' completed training workout'+(result.actualCount===1?'':'s')+'. Plans and mobility sessions are excluded from suggestions.';
 unique.push({id:'normatec',name:'Normatec boots',instructions:'Log the time you actually spent using your boots. Available on training and rest days. Boot time is logged separately from exercise time.',sides:1,reasons:[]});
 $('mobilityDate').disabled=pending.size>0;
 $('mobilityCards').innerHTML=unique.map((s,i)=>{const done=savedById.get(s.id),busy=pending.has(date+':'+s.id),boots=s.id==='normatec',seconds=done?.seconds_per_side??drafts.get(date+':'+s.id)??(boots?'':30);return `<article class="mobility-card ${done?'mobility-done':''}" data-stretch="${s.id}"><div class="eyebrow">${boots?'NIGHTLY RECOVERY':(i+1)+' / '+(s.sides===2?'EACH SIDE':'ONE HOLD')}${done?' · COMPLETED':''}</div><h3>${s.name}</h3><p>${s.instructions}</p>${boots?'':`<p class="fine">Suggested after: ${esc(s.reasons.join(', '))}.</p>`}${!done&&!boots?`<label>Swap stretch<select data-swap="${routine.findIndex(x=>x.id===s.id)}" aria-label="Swap ${s.name}" ${busy?'disabled':''}>${STRETCHES.map(a=>`<option value="${a.id}" ${a.id===s.id?'selected':''}>${a.name}</option>`).join('')}</select></label>`:''}${owner?`<label>${boots?'Minutes used':'Seconds '+(s.sides===2?'per side':'held')}<input class="mobility-seconds" type="number" inputmode="numeric" min="1" max="${boots?180:600}" step="1" required value="${esc(seconds)}" aria-label="${boots?'Minutes for':'Seconds for'} ${s.name}" ${done||busy?'disabled':''}></label><button type="button" class="button ${done?'outline':'dark'} small mobility-complete" aria-label="${done?'Undo completion of':'Mark complete:'} ${s.name}" ${busy||!live?'disabled':''}>${busy?'Saving…':done?'Undo completion':boots?'Log boots session':s.sides===2?'Mark both sides complete':'Mark complete'}</button>`:done?`<p class="fine">Logged: ${seconds} ${boots?'minutes':'seconds'+(s.sides===2?' per side':'')}.</p>`:'<p class="fine">Sign in to log completion.</p>'}</article>`;}).join('');
 $('mobilityCards').querySelectorAll('select').forEach(select=>select.onchange=()=>{overrides.set(date+':'+select.dataset.swap,select.value);reset();draw();});
 $('mobilityCards').querySelectorAll('.mobility-complete').forEach(button=>button.onclick=async()=>{
  if(!owner||!live)return;
  const card=button.closest('article'),id=card.dataset.stretch,done=savedById.has(id),input=card.querySelector('input');
  const key=date+':'+id;if(pending.has(key))return;
  if(!done&&!input.reportValidity())return;
  const seconds=Number(input.value);drafts.set(key,input.value);pending.add(key);card.querySelectorAll('input,select,button').forEach(el=>el.disabled=true);button.textContent='Saving…';card.setAttribute('aria-busy','true');$('mobilityDate').disabled=true;
  try{await onSave({date,stretch_id:id,...(id==='normatec'?{minutes:seconds}:{seconds_per_side:seconds}),completed:!done});$('mobilityLogStatus').textContent=done?'Completion removed; your totals have been updated.':'Saved '+(id==='normatec'?'Normatec boots':'stretch')+' for '+date+'.';}
  catch(e){$('mobilityLogStatus').textContent='Could not save: '+e.message;}
  finally{pending.delete(key);draw();}
 });
 if(wasInput&&focused){const input=$('mobilityCards').querySelector('[data-stretch="'+focused+'"] input');if(input&&!input.disabled)input.focus({preventScroll:true});}
 }
 $('mobilityDate').onchange=()=>{reset();signature='';$('mobilityLogStatus').textContent='';draw();};
 return {open(date){$('mobilityDate').value=date;signature='';draw();$('mobility').querySelector('details').open=true;location.hash='mobility';},paint(nextRows,available,isOwner=false){rows=nextRows;live=available;owner=isOwner;const next=JSON.stringify([localDate(),live,owner,rows.filter(r=>r.date===($('mobilityDate').value||localDate()))]);if(next!==signature){signature=next;draw();}}};
}
