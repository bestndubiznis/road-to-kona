// Explicit public projection: no coach instructions, titles, notes, IDs or credentials.
export function publicPlans(rows,today){
 const first=new Date(today+'T12:00:00Z');first.setUTCDate(first.getUTCDate()-(first.getUTCDay()+6)%7);
 const start=first.toISOString().slice(0,10);first.setUTCDate(first.getUTCDate()+13);const end=first.toISOString().slice(0,10);
 return rows.filter(r=>r.status==='planned'&&r.date>=start&&r.date<=end).map(r=>({date:r.date,type:r.type,status:'planned',planned_duration_hours:Number.isFinite(Number(r.planned_duration_hours))?Math.max(0,Number(r.planned_duration_hours)):0}));
}
