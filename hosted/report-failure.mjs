// Dependency-free fallback covers npm/browser installation failures too.
const key=process.env.FITNESS_RUNNER_KEY;
if(key)try{await fetch('https://mobesktajbsicjamgetc.supabase.co/functions/v1/fitness-api',{method:'POST',headers:{'Content-Type':'application/json','x-fitness-runner-key':key},body:JSON.stringify({action:'hosted_report',status:'error'}),signal:AbortSignal.timeout(20000)});}catch{}
