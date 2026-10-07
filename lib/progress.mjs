import {completed, localDate, weekly, number} from './fitness.mjs';
export const SANTA_CRUZ = {date:'2026-09-13',title:'IRONMAN 70.3 Santa Cruz',swim:2275,t1:460,bike:10625,t2:120,run:6295,total:19775};
export function dateStart(range,today=localDate(),rows=[]) {
 if(range==='all')return rows.map(r=>r.date).filter(d=>d<=today).sort()[0]||today;
 if(range==='year')return today.slice(0,4)+'-01-01';
 const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-Number(range)+1);return d.toISOString().slice(0,10);
}
export function progressWeeks(rows,range,today=localDate()) {
 const start=dateStart(range,today,completed(rows));
 const a=new Date(start+'T12:00:00Z'),b=new Date(today+'T12:00:00Z');
 a.setUTCDate(a.getUTCDate()-(a.getUTCDay()+6)%7);b.setUTCDate(b.getUTCDate()-(b.getUTCDay()+6)%7);
 return weekly(rows.filter(r=>r.date>=start&&r.date<=today),today,Math.max(1,Math.round((b-a)/604800000)+1));
}
export function filterWorkouts(rows,{sport='All',status='completed',start='',end='',term='',sort='newest',privateDetails=false}={}) {
 const terms=term.trim().toLowerCase().split(/\s+/).filter(Boolean);
 return rows.filter(r=>(status==='all'||(r.status||'completed')===status||(status==='unrecorded'&&r.status==='planned'&&r.date<localDate()))&&(sport==='All'||r.type===sport||(sport==='Strength'&&r.strength>0))&&(!start||r.date>=start)&&(!end||r.date<=end)&&terms.every(t=>[r.date,r.title,r.type,r.source,privateDetails?r.summary:'',privateDetails?r.details:'',privateDetails?r.private_notes:'',privateDetails?(r.exercises||[]).map(e=>e.name).join(' '):''].join(' ').toLowerCase().includes(t))).sort((a,b)=>sort==='oldest'?a.date.localeCompare(b.date):sort==='duration'?number(b.duration_hours)-number(a.duration_hours):sort==='distance'?distance(b)-distance(a):b.date.localeCompare(a.date));
}
function distance(r){return number(r.bike_miles)+number(r.run_miles)+number(r.swim_yards)/1760;}
export function bestEfforts(rows,sport='All') {
 const actual=completed(rows).filter(r=>r.source!=='Notes'&&r.history_quality!=='reconstructed'&&number(r.duration_hours)>0);
 const ranked=(type,key)=>actual.filter(r=>(r.type===type||r.type==='Race')&&number(r[key])>0).sort((a,b)=>number(b[key])-number(a[key])).slice(0,3);
 const runNear=(miles)=>actual.filter(r=>r.type==='Run'&&Math.abs(number(r.run_miles)-miles)<=miles*.01).map(r=>({...r,effort_seconds:r.duration_hours*3600,effort_distance:r.run_miles})).sort((a,b)=>a.effort_seconds-b.effort_seconds).slice(0,3);
 const half=runNear(13.1094);
 if(actual.some(r=>r.type==='Race'&&r.date===SANTA_CRUZ.date&&/Santa Cruz/i.test(r.title)))half.push({date:SANTA_CRUZ.date,title:'Santa Cruz 70.3 · official run split',effort_seconds:SANTA_CRUZ.run,effort_distance:13.1,official:true});
 return [{sport:'Run',label:'5K session times',kind:'time',records:runNear(3.106856)},{sport:'Run',label:'Half marathon times',kind:'time',records:half.sort((a,b)=>a.effort_seconds-b.effort_seconds).slice(0,3)},{sport:'Bike',label:'Longest rides',kind:'bike_miles',records:ranked('Bike','bike_miles')},{sport:'Swim',label:'Longest swims',kind:'swim_yards',records:ranked('Swim','swim_yards')},{sport:'Run',label:'Longest runs',kind:'run_miles',records:ranked('Run','run_miles')}].filter(g=>sport==='All'||g.sport===sport);
}
export function clockTime(seconds){const n=Math.round(seconds);return [Math.floor(n/3600),Math.floor(n%3600/60),n%60].map(v=>String(v).padStart(2,'0')).join(':');}
