// Only a verified success timestamp is public; connection state and errors stay private.
export function publicSync(settings){
 const candidates=[settings.hosted_tp?.last_success_at,settings.trainingpeaks_browser_sync?.status==='success'?settings.trainingpeaks_browser_sync.checked_at:null].filter(v=>typeof v==='string'&&Number.isFinite(Date.parse(v))).sort((a,b)=>Date.parse(b)-Date.parse(a));
 return {last_success_at:candidates[0]?new Date(candidates[0]).toISOString():null};
}
