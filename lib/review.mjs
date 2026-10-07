import {completed,totals,number,localDate} from './fitness.mjs';
export function shift(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekReview(rows,today=localDate(),offset=0){const d=new Date(today+'T12:00:00Z');const start=shift(today,-((d.getUTCDay()+6)%7)+offset*7),end=shift(start,6),actual=completed(rows).filter(r=>r.date>=start&&r.date<=end&&r.date<=today),prior=completed(rows).filter(r=>r.date>=shift(start,-7)&&r.date<start);const sets=actual.reduce((n,r)=>n+(r.exercises||[]).reduce((m,e)=>m+(e.sets||[]).filter(s=>s.kind!=='warmup').length,0),0);return {start,end,actual,totals:totals(actual),prior:totals(prior),sets,plans:rows.filter(r=>r.status==='planned'&&r.date>=start&&r.date<=end),skipped:rows.filter(r=>r.status==='skipped'&&r.date>=start&&r.date<=end).length};}
export function enduranceCompare(rows,sport,today=localDate()){
 const valid=completed(rows).filter(r=>r.type===sport&&r.source!=='Notes'&&r.history_quality!=='reconstructed'&&number(r.average_hr)>0&&number(r.duration_hours)>0&&r.date<=today).sort((a,b)=>b.date.localeCompare(a.date));
 const latest=valid[0];if(!latest)return {latest:null,comparisons:[]};
 const measure=r=>sport==='Bike'?number(r.average_power):sport==='Run'?number(r.run_miles)/number(r.duration_hours):number(r.swim_yards)/number(r.duration_hours);
 const metric=measure(latest);if(!metric)return {latest,comparisons:[]};
 const comparisons=valid.slice(1).filter(r=>r.date<latest.date&&r.date>=shift(latest.date,-90)&&measure(r)>0&&Math.abs(measure(r)/metric-1)<=.1&&Math.abs(r.duration_hours/latest.duration_hours-1)<=.25).slice(0,8);
 const mean=comparisons.length?comparisons.reduce((n,r)=>n+number(r.average_hr),0)/comparisons.length:null;
 return {latest,comparisons,mean,delta:mean==null?null:latest.average_hr-mean};
}
export function repeatNote(note,rows){
 if(!/same as (?:last time|my last workout|last workout)/i.test(note))return null;
 const prior=completed(rows).filter(r=>(r.exercises||[]).length).sort((a,b)=>b.date.localeCompare(a.date))[0];
 if(!prior)return {exercises:[],issues:['No previous lifting session with sets is available.'],unparsed:[note],original:note};
 const exercises=structuredClone(prior.exercises),issues=['Copied sets from '+prior.date+'. Review every exercise before saving.'];
 const change=/but\s+(\d+(?:\.\d+)?)\s*(lb|lbs|kg|s)?\s+(?:on|for)\s+(.+?)(?:[.!]|$)/i.exec(note);
 if(change){const target=change[3].trim().toLowerCase(),matches=exercises.filter(e=>e.name.toLowerCase().includes(target));if(matches.length===1&&['lb','lbs','kg'].includes(change[2])){matches[0].unit=change[2]==='kg'?'kg':'lb';for(const s of matches[0].sets)s.weight=Number(change[1]);}else issues.push('Change needs clarification: '+change[0]+'. Original loads are unchanged; edit the preview rows.');}
 return {exercises,issues,unparsed:change?[]:[note],original:note};
}
