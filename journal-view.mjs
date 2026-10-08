import {createJourneyAnimation} from './journey-animation.mjs?v=journey2';
const paintJourney=createJourneyAnimation();
import {icon} from './lib/icons.mjs';
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
 progress.insertAdjacentHTML('beforeend','<div class="journal-grid"><article class="panel"><div class="eyebrow">THE HABIT BEHIND THE NUMBERS</div><h3>A calendar of effort.</h3><p id="calendarCaption" class="fine"></p><div class="calendar-scroll"><div class="calendar-labeled"><div class="weekday-labels" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div><div id="calendarMonths" class="calendar-months" aria-hidden="true"></div><div id="effortCalendar" class="effort-calendar"></div></div></div></div><p class="fine">Each square is a day. Darker = more recorded time. Tap for details.</p><p id="calendarDetail" class="calendar-detail" aria-live="polite">Select a day to explore.</p></article><article class="panel"><div class="eyebrow">MANY WAYS TO GET STRONGER</div><h3>How the time adds up.</h3><div id="sportMix"></div><p class="fine">Time by recorded sport. Mixed workouts retain their recorded category.</p></article></div>');
 $('muscles').insertAdjacentHTML('beforebegin','<section id="weekAhead" class="section"><div class="section-heading"><div><div class="eyebrow">FOLLOW ALONG</div><h2>The week in motion.</h2><p class="muted">Completed work and what’s on the calendar.</p></div><label>Week<select id="planWeek"><option value="-2">Two weeks ago</option><option value="-1">Last week</option><option value="0" selected>This week</option><option value="1">Next week</option></select></label></div><div id="publicWeek" class="public-week"></div><p class="fine">Basic plan details from the latest mirror. Plans can change and never count toward completed totals. An empty day means no record is available, not necessarily a rest day.</p></section>');
 $('publicWeek').after($('weeklyCards'));$('weeklyCards').classList.add('week-summary');$('weeklyCards').setAttribute('aria-live','polite');$('weeklyReview').remove();
 $('muscleRange').closest('label').hidden=true;
 $('today').classList.add('private-section');$('today').hidden=true;
 document.querySelector('nav[aria-label="Main navigation"]').innerHTML='<a href="#progress">Progress</a><a href="#weekAhead">The week</a><a href="#muscles">Muscle map</a><a href="#log">The log</a><a href="#milestones">Milestones</a>';
 const mobile=document.querySelector('.mobile-nav');mobile.querySelector('a').href='#progress';mobile.querySelector('a').textContent='Progress';
 $('logRange').closest('label').hidden=true;
 $('logFrom').closest('label').childNodes[0].textContent='Narrow from';$('logTo').closest('label').childNodes[0].textContent='Narrow to';
 $('search').placeholder='Search sport, date, source, or exercise';
 try{const saved=localStorage.getItem('fitness-journal-range');if([...$('range').options].some(o=>o.value===saved))$('range').value=saved;}catch{}
}
export function paintJournal(rows,plans=[],ready=true){
 const j=journalData(rows,$('range').value),label=$('range').selectedOptions[0].textContent;
 paintJourney(j,label,ready);
 $('journeyCaption').textContent=date(j.start)+' — '+date(j.end)+' · cumulative completed hours';
 $('calendarCaption').textContent=j.activeDays+' days with recorded training across '+j.days.length+' calendar days · '+label;
 const offset=(new Date(j.start+'T12:00:00Z').getUTCDay()+6)%7;
 const months=j.days.flatMap((d,i)=>i===0||d.date.slice(5,7)!==j.days[i-1].date.slice(5,7)?[{date:d.date,column:Math.floor((i+offset)/7)+1}]:[]);$('calendarMonths').style.gridTemplateColumns='repeat('+Math.ceil((j.days.length+offset)/7)+',15px)';$('calendarMonths').innerHTML=months.map((m,i)=>'<span style="grid-column:'+m.column+'">'+(i&&m.column-months[i-1].column<2?'':new Date(m.date+'T12:00:00').toLocaleDateString('en-US',{month:'short'}))+'</span>').join('');
 $('effortCalendar').innerHTML='<span class="calendar-spacer" style="grid-row:span '+Math.max(1,offset)+'" '+(!offset?'hidden':'')+'></span>'+j.days.map(d=>'<button class="effort-day effort-'+(d.hours?Math.min(4,Math.ceil(d.hours)):d.sessions?1:0)+'" data-date="'+d.date+'" aria-label="'+d.date+': '+d.sessions+' sessions, '+d.hours.toFixed(2)+' hours" title="'+date(d.date)+' · '+d.hours.toFixed(2)+' hr"></button>').join('');
 $('effortCalendar').querySelectorAll('button').forEach(b=>b.onclick=()=>{const d=j.days.find(d=>d.date===b.dataset.date);$('calendarDetail').textContent=date(d.date)+' · '+d.sessions+' recorded sessions · '+(d.hours*60).toFixed(0)+' minutes';});
 $('sportMix').innerHTML=j.sports.map(([sport,hours])=>'<div class="mix-row"><div><span>'+esc(sport)+'</span><strong>'+hours.toFixed(1)+' hr</strong></div><div class="mix-track"><i style="width:'+hours/Math.max(1,j.hours)*100+'%;background:'+(colors[sport]||'#888')+'"></i></div></div>').join('')||'<p>No completed time in this period.</p>';
 const days=weekDays(localDate(),Number($('planWeek').value));
 const all=[...rows,...plans];
 $('publicWeek').innerHTML=days.map(day=>{const sessions=all.filter(r=>r.date===day&&r.status!=='skipped');return '<article class="week-day '+(day===localDate()?'is-today':'')+'"><div class="eyebrow">'+new Date(day+'T12:00:00').toLocaleDateString('en-US',{weekday:'short'})+'</div><h3>'+date(day)+'</h3>'+sessions.map(r=>'<div class="week-session '+(r.status==='planned'?'is-plan':'')+'"><b>'+esc(r.type)+'</b><span>'+((r.status==='planned'?number(r.planned_duration_hours):number(r.duration_hours))?Math.round((r.status==='planned'?number(r.planned_duration_hours):number(r.duration_hours))*60)+' min':'Time not recorded')+'</span><small>'+(r.status==='planned'?'Planned':icon('check')+' Completed')+'</small></div>').join('')+(!sessions.length?'<p class="fine">No record</p>':'')+'</article>';}).join('');
}
