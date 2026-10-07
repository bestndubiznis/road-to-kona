import {journalData,weekDays} from './lib/journal.mjs';
import {localDate,number} from './lib/fitness.mjs';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=d=>new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
const colors={Run:'#cf714f',Bike:'#608a7c',Swim:'#669ec0',Strength:'#c7ab49',Race:'#806b9c'};
export function setupJournal(){
 document.querySelector('.hero h1').innerHTML='Training &amp;<br><em>progress.</em>';
 document.querySelector('.hero-art').removeAttribute('aria-hidden');document.querySelector('.hero-art').innerHTML='<div class="eyebrow">TOTAL TRAINING TIME</div><div id="journeyTotal"></div><div id="journeyCurve"></div><p id="journeyCaption"></p>';
 document.querySelector('.hero-note').textContent='SWIM / BIKE / RUN / LIFT';
 const progress=$('progress');progress.before(Object.assign(document.createElement('div'),{className:'period-dock',innerHTML:'<div><strong>Explore the history</strong><span> One period for progress, muscles, strength & the log</span></div><div id="periodControl"></div>'}));
 $('periodControl').append($('range').closest('label'));
 $('range').insertAdjacentHTML('beforeend','<option value="7">Last 7 days</option><option value="180">Last 6 months</option>');
 document.querySelector('.snapshot .eyebrow').textContent='IN THIS PERIOD';
 progress.insertAdjacentHTML('beforeend','<div class="journal-grid"><article class="panel"><div class="eyebrow">THE HABIT BEHIND THE NUMBERS</div><h3>A calendar of effort.</h3><p id="calendarCaption" class="fine"></p><div class="calendar-scroll"><div id="effortCalendar" class="effort-calendar"></div></div><p class="fine">Each square is a day. Darker = more recorded time. Tap for details.</p><p id="calendarDetail" class="calendar-detail" aria-live="polite">Select a day to explore.</p></article><article class="panel"><div class="eyebrow">MANY WAYS TO GET STRONGER</div><h3>How the time adds up.</h3><div id="sportMix"></div><p class="fine">Time by recorded sport. Mixed workouts retain their recorded category.</p></article></div>');
 $('muscles').insertAdjacentHTML('beforebegin','<section id="weekAhead" class="section"><div class="section-heading"><div><div class="eyebrow">FOLLOW ALONG</div><h2>The week in motion.</h2><p class="muted">Completed work and what’s on the calendar.</p></div><label>Week<select id="planWeek"><option value="0">This week</option><option value="1">Next week</option></select></label></div><div id="publicWeek" class="public-week"></div><p class="fine">Basic plan details from the latest mirror. Plans can change and never count toward completed totals. An empty day means no record is available, not necessarily a rest day.</p></section>');
 $('muscleRange').closest('label').hidden=true;
 $('today').classList.add('private-section');$('today').hidden=true;
 document.querySelector('nav[aria-label="Main navigation"]').innerHTML='<a href="#progress">Progress</a><a href="#weekAhead">The week</a><a href="#muscles">Muscle map</a><a href="#log">The log</a><a href="#milestones">Milestones</a>';
 const mobile=document.querySelector('.mobile-nav');mobile.querySelector('a').href='#progress';mobile.querySelector('a').textContent='Progress';
 $('logRange').closest('label').hidden=true;
 $('logFrom').closest('label').childNodes[0].textContent='Narrow from';$('logTo').closest('label').childNodes[0].textContent='Narrow to';
 $('search').placeholder='Search sport, date, source, or exercise';
 try{const saved=localStorage.getItem('fitness-journal-range');if([...$('range').options].some(o=>o.value===saved))$('range').value=saved;}catch{}
}
export function paintJournal(rows,plans=[]){
 const j=journalData(rows,$('range').value),label=$('range').selectedOptions[0].textContent;
 $('journeyTotal').innerHTML='<strong>'+j.hours.toFixed(1)+'</strong><span>hours logged<br>'+esc(label)+'</span>';
 const points=j.days.map((d,i)=>[12+i/Math.max(1,j.days.length-1)*476,145-d.cumulative/Math.max(1,j.hours)*125]);
 const path=points.map(([x,y],i)=>(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)).join(' ');
 $('journeyCurve').innerHTML='<svg viewBox="0 0 500 170" role="img" aria-label="Cumulative training hours from '+j.start+' through '+j.end+'"><path d="'+path+' L488 160 L12 160 Z" fill="#e4ee78" opacity=".12"/><path d="'+path+'" fill="none" stroke="#e4ee78" stroke-width="3"/>'+points.filter((_,i)=>i===points.length-1).map(([x,y])=>'<circle cx="'+x+'" cy="'+y+'" r="5" fill="#e4ee78"/>').join('')+'</svg>';
 $('journeyCaption').textContent=date(j.start)+' — '+date(j.end)+' · cumulative completed hours';
 $('calendarCaption').textContent=j.activeDays+' days with recorded training across '+j.days.length+' calendar days · '+label;
 const offset=(new Date(j.start+'T12:00:00Z').getUTCDay()+6)%7;
 $('effortCalendar').innerHTML='<span class="calendar-spacer" style="grid-row:span '+Math.max(1,offset)+'" '+(!offset?'hidden':'')+'></span>'+j.days.map(d=>'<button class="effort-day effort-'+(d.hours?Math.min(4,Math.ceil(d.hours)):d.sessions?1:0)+'" data-date="'+d.date+'" aria-label="'+d.date+': '+d.sessions+' sessions, '+d.hours.toFixed(2)+' hours" title="'+date(d.date)+' · '+d.hours.toFixed(2)+' hr"></button>').join('');
 $('effortCalendar').querySelectorAll('button').forEach(b=>b.onclick=()=>{const d=j.days.find(d=>d.date===b.dataset.date);$('calendarDetail').textContent=date(d.date)+' · '+d.sessions+' recorded sessions · '+(d.hours*60).toFixed(0)+' minutes';});
 $('sportMix').innerHTML=j.sports.map(([sport,hours])=>'<div class="mix-row"><div><span>'+esc(sport)+'</span><strong>'+hours.toFixed(1)+' hr</strong></div><div class="mix-track"><i style="width:'+hours/Math.max(1,j.hours)*100+'%;background:'+(colors[sport]||'#888')+'"></i></div></div>').join('')||'<p>No completed time in this period.</p>';
 const days=weekDays(localDate(),Number($('planWeek').value));
 const all=[...rows,...plans];
 $('publicWeek').innerHTML=days.map(day=>{const sessions=all.filter(r=>r.date===day&&r.status!=='skipped');return '<article class="week-day '+(day===localDate()?'is-today':'')+'"><div class="eyebrow">'+new Date(day+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})+'</div><h3>'+date(day)+'</h3>'+sessions.map(r=>'<div class="week-session '+(r.status==='planned'?'is-plan':'')+'"><b>'+esc(r.type)+'</b><span>'+((r.status==='planned'?number(r.planned_duration_hours):number(r.duration_hours))?Math.round((r.status==='planned'?number(r.planned_duration_hours):number(r.duration_hours))*60)+' min':'Time not recorded')+'</span><small>'+(r.status==='planned'?'Planned':'✓ Completed')+'</small></div>').join('')+(!sessions.length?'<p class="fine">No record</p>':'')+'</article>';}).join('');
}
