import {appRoute} from './lib/app-navigation.mjs';
import {weekReview} from './lib/review.mjs';
import {localDate,completed,number} from './lib/fitness.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons={home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',week:'<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18"/>',progress:'<path d="M4 4v16h17M7 15l4-5 4 2 5-7"/>',log:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',more:'<circle cx="12" cy="12" r="8"/><path d="M8 12h.01M12 12h.01M16 12h.01"/>'};
export function createPhoneApp({onRefresh}={}){
 const enabled=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||new URLSearchParams(location.search).get('app')==='1';
 if(!enabled)return {paint(){}};
 document.body.classList.add('phone-app');
 document.querySelector('main').insertAdjacentHTML('afterbegin','<div class="app-page-heading"><div class="eyebrow">WALKER WELLS</div><h1 id="appPageTitle">Overview</h1><button id="appRefresh" class="app-refresh" aria-label="Refresh synced workouts" type="button">↻</button></div><nav id="appSubnav" class="app-subnav" aria-label="Section navigation"></nav><section id="appHome"><div id="appWeekSummary"></div><div class="app-actions" id="appQuickActions"><a href="#mobility" class="button outline">Mobility ↗</a></div><div class="app-home-links"><a href="#weekAhead"><strong>This week’s plan</strong><span>Completed & upcoming →</span></a><a href="#muscles"><strong>Muscle map</strong><span>Endurance & lifting →</span></a></div><div class="app-recent-heading"><h3>Latest workouts</h3><a href="#log">View all →</a></div><div id="appRecent"></div></section><section id="appMore"><h2>Your settings</h2><p id="appAccountNote" class="muted"></p><div class="app-settings-links"><a href="#account">Account & password <span>→</span></a><a href="#notifications">Phone notifications <span>→</span></a><a href="#connections">TrainingPeaks connection <span>→</span></a><a href="#recovery">Recovery check-ins <span>→</span></a></div></section>');
 $('appQuickActions').prepend($('mobileLog'));$('mobileLog').className='button dark';$('mobileLog').textContent='+ Log a lift';
 const nav=document.querySelector('.mobile-nav');nav.className='mobile-nav app-tabs';nav.setAttribute('aria-label','App navigation');nav.innerHTML=Object.entries({home:'Home',week:'Week',progress:'Progress',log:'Log',more:'More'}).map(([id,name])=>'<a href="#'+({week:'weekAhead',more:'appMore'}[id]||id)+'" data-app-tab="'+id+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+icons[id]+'</svg><span>'+name+'</span></a>').join('');
 $('appRefresh').onclick=async()=>{const button=$('appRefresh');button.disabled=true;try{await onRefresh?.();}finally{button.disabled=false;}};
 const sync=$('lastSynced');$('appHome').append(sync);sync.classList.add('app-sync');
 let owner=false,lastSection='',positions=new Map();
 const sublinks={week:[['weekAhead','Week'],['mobility','Mobility']],progress:[['progress','Overview'],['muscles','Muscles'],['strength','Strength'],['best','Best efforts'],['milestones','Milestones']]};
 function route(){
 let [tab,section]=appRoute(location.hash);if($(section)?.classList.contains('private-section')&&!owner){tab='more';section='appMore';}
 const changed=section!==lastSection;if(changed&&lastSection)positions.set(lastSection,scrollY);
 document.body.dataset.appTab=tab;
 document.querySelectorAll('main>section').forEach(el=>el.classList.toggle('app-active',el.id===section));
 document.querySelectorAll('[data-app-tab]').forEach(el=>{const selected=el.dataset.appTab===tab;el.classList.toggle('active',selected);if(selected)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
 $('appPageTitle').textContent={home:'Overview',week:'Your week',progress:'Your progress',log:'Training log',more:'Settings'}[tab];
 $('appSubnav').innerHTML=(sublinks[tab]||[]).map(([id,name])=>'<a href="#'+id+'" '+(section===id?'aria-current="page"':'')+'>'+name+'</a>').join('')+(tab==='more'&&section!=='appMore'?'<a href="#appMore">← All settings</a>':'');$('appSubnav').hidden=!$('appSubnav').innerHTML;
 if(section==='mobility')$('mobility').querySelector('details').open=true;
 if(changed){lastSection=section;requestAnimationFrame(()=>scrollTo({top:positions.get(section)||0,behavior:'instant'}));}
 }
 addEventListener('hashchange',route);
 route();
 return {paint(rows,isOwner,live){owner=isOwner;const w=weekReview(rows),today=localDate();
 $('appWeekSummary').innerHTML='<div class="app-week-card"><div class="eyebrow">THIS WEEK · '+new Date(today+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</div><div class="app-week-hours">'+w.totals.hours.toFixed(1)+'<span>hours logged</span></div><div class="app-week-metrics"><span><b>'+w.totals.sessions+'</b> workouts</span><span><b>'+w.sets+'</b> lifting sets</span></div><div class="app-week-days">'+Array.from({length:7},(_,i)=>{const d=new Date(w.start+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+i);const date=d.toISOString().slice(0,10),done=w.actual.some(r=>r.date===date);return '<span class="'+(done?'done ':'')+(date===today?'today':'')+'"><i>'+['M','T','W','T','F','S','S'][i]+'</i><b aria-label="'+date+': '+(done?'Workout logged':date>today?'Upcoming':'No workout recorded')+'">'+(done?'✓':'·')+'</b></span>';}).join('')+'</div>'+(!live?'<p class="fine">Saved history · live data unavailable</p>':'')+'</div>';
 $('appRecent').innerHTML=completed(rows).filter(r=>r.date<=today).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map(r=>'<a class="app-recent-card" href="#log"><span class="app-sport-icon">'+({Run:'↗',Bike:'◎',Swim:'≈',Strength:'↔'}[r.type]||'○')+'</span><span><b>'+esc(r.type)+'</b><small>'+new Date(r.date+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})+'</small></span><strong>'+ (number(r.duration_hours)?Math.round(r.duration_hours*60)+' min':'—')+'</strong></a>').join('')||'<p class="muted">No completed workouts yet.</p>';
 $('appAccountNote').textContent=owner?'Signed in. Manage your account and connections here.':'Sign in using the button above to manage your account, notifications, and connections.';document.querySelector('.app-settings-links').hidden=!owner;
 route();}};
}
