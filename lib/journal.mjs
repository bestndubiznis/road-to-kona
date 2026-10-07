import {completed,localDate,number} from './fitness.mjs';
import {dateStart} from './progress.mjs';
export function daysBetween(start,end){const days=[];for(let d=new Date(start+'T12:00:00Z');d.toISOString().slice(0,10)<=end;d.setUTCDate(d.getUTCDate()+1))days.push(d.toISOString().slice(0,10));return days;}
export function journalData(rows,range='all',today=localDate()){
 const start=dateStart(range,today,completed(rows));const actual=completed(rows).filter(r=>r.date>=start&&r.date<=today);
 const byDay=new Map();const sports=new Map();for(const r of actual){const d=byDay.get(r.date)||{hours:0,sessions:0};d.hours+=number(r.duration_hours);d.sessions++;byDay.set(r.date,d);sports.set(r.type,(sports.get(r.type)||0)+number(r.duration_hours));}
 let cumulative=0;const days=daysBetween(start,today).map(date=>{const d=byDay.get(date)||{hours:0,sessions:0};cumulative+=d.hours;return {date,...d,cumulative};});
 return {start,end:today,days,hours:cumulative,activeDays:byDay.size,sports:[...sports].sort((a,b)=>b[1]-a[1])};
}
export function weekDays(today=localDate(),offset=0){const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7+offset*7);const start=d.toISOString().slice(0,10);d.setUTCDate(d.getUTCDate()+6);return daysBetween(start,d.toISOString().slice(0,10));}
