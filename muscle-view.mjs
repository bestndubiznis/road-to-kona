import {MUSCLES,muscleSummary,muscleScore} from './lib/muscles.mjs?v=map3';
import {dateStart} from './lib/progress.mjs';
import {localDate,completed,totals} from './lib/fitness.mjs';
const paths={
 front:{shoulders:['M64 81 Q42 84 39 111 L60 108 72 92 Z','M136 81 Q158 84 161 111 L140 108 128 92 Z'],chest:['M73 92 L96 94 97 126 Q80 139 63 122 L63 110 Z','M127 92 L104 94 103 126 Q120 139 137 122 L137 110 Z'],biceps:['M40 116 L58 113 58 145 46 166 34 158 Z','M160 116 L142 113 142 145 154 166 166 158 Z'],triceps:['M31 118 L37 117 31 158 26 162 Z','M169 118 L163 117 169 158 174 162 Z'],core:['M72 137 L95 134 96 189 87 216 68 191 Z','M128 137 L105 134 104 189 113 216 132 191 Z'],quads:['M66 220 L90 222 97 248 88 307 70 311 61 274 Z','M134 220 L110 222 103 248 112 307 130 311 139 274 Z'],calves:['M70 327 L87 325 86 348 76 387 66 388 Z','M130 327 L113 325 114 348 124 387 134 388 Z']},
 back:{shoulders:['M64 81 Q42 84 39 111 L60 108 72 92 Z','M136 81 Q158 84 161 111 L140 108 128 92 Z'],back:['M77 77 L98 88 97 134 82 153 65 113 Z','M123 77 L102 88 103 134 118 153 135 113 Z','M67 138 L96 153 96 197 77 205 Z','M133 138 L104 153 104 197 123 205 Z'],triceps:['M40 117 L59 114 54 151 42 166 33 157 Z','M160 117 L141 114 146 151 158 166 167 157 Z'],glutes:['M70 210 L96 207 97 239 87 251 64 242 Z','M130 210 L104 207 103 239 113 251 136 242 Z'],hamstrings:['M64 250 L89 257 96 273 87 312 69 313 61 280 Z','M136 250 L111 257 104 273 113 312 131 313 139 280 Z'],calves:['M69 328 L87 327 88 349 78 379 66 380 Z','M131 328 L113 327 112 349 122 379 134 380 Z']}
};
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function figure(side,groups,mode,selected){
 const max=Math.max(1,...Object.values(groups).map(g=>muscleScore(g,mode)));
 return `<div class="body-figure"><span class="eyebrow">${side==='front'?'FRONT':'BACK'}</span><svg viewBox="0 0 200 425" aria-label="${side} muscle groups"><g class="body-base"><ellipse cx="100" cy="43" rx="23" ry="29"/><path d="M86 68 L84 78 Q57 77 43 88 L30 128 19 181 14 201 21 212 31 198 41 165 60 130 64 191 57 233 56 278 65 324 60 382 57 405 83 405 89 377 94 327 100 279 106 327 111 377 117 405 143 405 140 382 135 324 144 278 143 233 136 191 140 130 159 165 169 198 179 212 186 201 181 181 170 128 157 88 Q143 77 116 78 L114 68 Z"/></g>${Object.entries(paths[side]).map(([key,ds])=>{const value=muscleScore(groups[key],mode),level=value?Math.min(4,Math.ceil(value/max*4)):0;return `<g class="muscle-region level-${level} ${selected===key?'selected':''}" data-muscle="${key}" tabindex="0" role="button" aria-label="${MUSCLES[key]}: ${value} ${mode==='strength'?'associated working sets':mode==='both'?'training sessions':'activity exposures'}" aria-pressed="${selected===key}"><title>${MUSCLES[key]} · ${value}</title>${ds.map(d=>`<path d="${d}"/>`).join('')}</g>`;}).join('')}</svg></div>`;
}
export function createMuscleMap({getRows,isOwner}){
 const $=id=>document.getElementById(id);let selected='quads';
 try{const preferences=JSON.parse(localStorage.getItem('fitness-muscle-view')||'{}');if(['endurance','strength','both'].includes(preferences.mode))$('muscleMode').value=preferences.mode;if(['all','7','30','90'].includes(preferences.range))$('muscleRange').value=preferences.range;if(MUSCLES[preferences.selected])selected=preferences.selected;}catch{}
 function paint(){
  const currentMode=$('muscleMode').value,range=$('muscleRange').value,start=range==='all'?'':dateStart(range),end=localDate(),rows=getRows(),result=muscleSummary(rows,{start,end,privateDetails:true}),groups=result.groups,g=groups[selected];
  try{localStorage.setItem('fitness-muscle-view',JSON.stringify({mode:currentMode,range,selected}));}catch{}
  $('muscleFigures').innerHTML=figure('front',groups,currentMode,selected)+figure('back',groups,currentMode,selected);
  $('muscleButtons').innerHTML=Object.entries(MUSCLES).map(([k,name])=>`<button type="button" class="muscle-chip ${selected===k?'active':''}" data-muscle="${k}" aria-pressed="${selected===k}">${name}</button>`).join('');
  const lifting=currentMode==='strength',both=currentMode==='both',unit=lifting?'working sets':both?'training sessions':'activity exposures';
  $('muscleScale').textContent='Color = '+unit;
  const sports=Object.entries(g.sports),recent=completed(rows).filter(r=>r.date>=start&&r.date<=end),t=totals(recent);
  const enduranceBlock=`<h4>Endurance exposure</h4><div class="muscle-sports">${sports.map(([sport,count])=>`<div><span>${sport}</span><strong>${count} sessions</strong></div>`).join('')||'<p class="fine">No endurance exposure recorded in this period.</p>'}</div>`;
  const exerciseCounts=new Map();for(const e of g.exercises)exerciseCounts.set(e.name,(exerciseCounts.get(e.name)||0)+e.sets);
  const liftingBlock=`<h4>Lifting work</h4><div class="muscle-sports">${[...exerciseCounts].map(([name,count])=>`<div><span>${escape(name)}</span><strong>${count} sets</strong></div>`).join('')||'<p class="fine">No mapped lifting sets recorded in this period.</p>'}</div>`;
  const explanation=lifting?'Recorded working sets from exercises associated with this muscle. Timed holds count as sets; warm-ups are excluded. Compound lifts can involve several groups.':both?'Unique completed sessions involving this muscle through endurance or lifting. A mixed session counts once here; sport exposures and working sets are shown separately below.':'Completed sessions in sports commonly involving this muscle. A triathlon can contribute exposure to several sports. These associations do not measure muscle growth.';
  const last=lifting?g.strengthLast:both?g.last:g.enduranceLast;
  $('muscleDetail').innerHTML=`<div class="eyebrow">${escape($('muscleRange').selectedOptions[0].textContent)} · ${lifting?'Lifting':both?'Both':'Endurance'}</div><h3>${MUSCLES[selected]}</h3><div class="muscle-value">${muscleScore(g,currentMode)} <small>${unit}</small></div><p>${explanation}</p>${lifting?liftingBlock:both?enduranceBlock+liftingBlock:enduranceBlock}<p class="fine">Last ${lifting?'lifting':both?'associated':'endurance'} activity: ${last||'none recorded in this period'}.</p>`;
  const workingSets=recent.reduce((n,r)=>n+(r.exercises||[]).reduce((m,e)=>m+(e.sets||[]).filter(s=>s.kind!=='warmup'&&(Number(s.reps)>0||Number(s.seconds)>0)).length,0),0);
  const liftingSessions=recent.filter(r=>r.type==='Strength'||Number(r.strength)>0||(r.exercises||[]).length).length;
  const enduranceStats=`<span><strong>${t.swim.toLocaleString()}</strong> yd swim</span><span><strong>${t.bike.toFixed(1)}</strong> mi bike</span><span><strong>${t.run.toFixed(1)}</strong> mi run / walk</span>`;
  const liftingStats=`<span><strong>${liftingSessions}</strong> lifting sessions</span><span><strong>${workingSets}</strong> working sets</span>`;
  $('muscleHistory').innerHTML=lifting?liftingStats:both?liftingStats+enduranceStats:enduranceStats;
  $('muscleCaveat').textContent=`Darker color means more ${unit} relative to other groups in the selected period. This map shows recorded training, not measured growth, recovery readiness, or a population percentile.`+(lifting||both?` ${result.undetailed} strength sessions have no detailed sets; ${result.unmapped} exercise entries could not be mapped. Nothing is guessed.`:'');
  document.querySelectorAll('[data-muscle]').forEach(el=>{const choose=()=>{selected=el.dataset.muscle;paint();};el.onclick=choose;if(el.tagName.toLowerCase()==='g')el.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose();document.querySelector(`#muscleButtons [data-muscle="${selected}"]`).focus();}};});
 }
 $('muscleMode').onchange=paint;$('muscleRange').onchange=paint;return {paint};
}
