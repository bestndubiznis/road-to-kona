import {saveMobility} from './mobility-log.mjs';
import { dispatchSync, dispatchView, dispatchAlert } from './dispatch.mjs';
import { publicSync } from './public-sync.mjs';
import { publicPlans } from './public-plans.mjs';
import { createClient } from 'npm:@supabase/supabase-js@2.117.2';
import { publicWorkout, validateWorkout, parseCalendar, fromIntervals, localDate } from './fitness.mjs';
import { vapidKeys, endpointHash, validateSubscription, sendPush, sendDuePush, sendSyncAlert } from './push.ts';
import {parseTpExport,reconcileTp,syncAlert} from './tp-hosted.mjs';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-fitness-sync-key,x-fitness-runner-key', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
const db = createClient(Deno.env.get('SUPABASE_URL')!, keys.default || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: cors });
const check = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data; };
async function settings() { return Object.fromEntries((check(await db.from('fitness_settings').select('*')) || []).map((r: any) => [r.key, r.value])); }
const dispatchToken = () => Deno.env.get('GITHUB_SYNC_TOKEN') || '';
async function requestHosted(s:any,manual=false) {
  const cas = async (before:any,after:any) => check(await db.from('fitness_settings').update({value:after}).eq('key','hosted_dispatch').eq('value',JSON.stringify(before)).select('key')).length > 0;
  return dispatchSync({hosted:s.hosted_tp,state:s.hosted_dispatch||{},token:dispatchToken(),manual,claim:cas,finish:cas});
}
async function records() {
  const rows: any[] = [];
  // Range pagination avoids silently truncating a lifetime log at 1,000 rows.
  for (let from = 0; ; from += 1000) {
    const page = check(await db.from('fitness_workouts').select('*').order('id').range(from, from + 999));
    // Keep fully undone daily mobility records for safe retries, but out of all views and skipped-plan counts.
    rows.push(...page.filter((r:any)=>!(r.external_id?.startsWith('mobility-day:') && !(r.data.mobility_stretches||[]).length)).map((r: any) => ({ ...r.data, id: r.id, external_id: r.external_id })));
    if (page.length < 1000) return rows;
  }
}
async function isOwner(req: Request, s: any) {
  const token = req.headers.get('authorization')?.replace(/^Bearer /i, '');
  if (!token) return false;
  const { data, error } = await db.auth.getUser(token);
  return !error && data.user?.email_confirmed_at && data.user.email?.toLowerCase() === s.owner_email?.toLowerCase();
}
async function upsertExternal(row: any) {
  validateWorkout(row);
  const existing = check(await db.from('fitness_workouts').select('id,data').eq('external_id', row.external_id).maybeSingle());
  // Completed lifting sets and user notes survive subsequent calendar/device refreshes.
  if (existing) {
    if (row.status === 'planned' && existing.data.status !== 'planned') return;
    const data = { ...existing.data, ...row, exercises: existing.data.exercises || row.exercises, private_notes: existing.data.private_notes || '' };
    check(await db.from('fitness_workouts').update({ data, updated_at: new Date().toISOString() }).eq('id', existing.id));
  } else check(await db.from('fitness_workouts').insert({ external_id: row.external_id, data: row }));
}
async function remote(url: string, options: RequestInit = {}) {
  const r = await fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('Provider returned HTTP '+r.status+'. Check your connection settings.');
  return r;
}
function calendarUrl(value: string) {
  const url = new URL(value.replace(/^webcal:/i, 'https:'));
  if (url.protocol !== 'https:' || !(url.hostname === 'trainingpeaks.com' || url.hostname.endsWith('.trainingpeaks.com')) || url.port || url.username || url.password) throw new Error('Use your TrainingPeaks HTTPS or webcal calendar URL.');
  return url.toString();
}
async function sync(s: any) {
  const result: any = { at: new Date().toISOString(), calendar: s.tp_calendar ? 'pending' : 'not_connected', activities: s.intervals_key ? 'pending' : 'not_connected' };
  if (s.tp_calendar) {
    try {
      const events = parseCalendar(await (await remote(calendarUrl(s.tp_calendar))).text());
      const today = localDate();
      for (const event of events) if (event.date >= today) await upsertExternal(event);
      const old = (await records()).filter(r => r.external_id?.startsWith('tp-calendar:') && r.status === 'planned');
      const active = new Set(events.map((e: any) => e.external_id));
      // Only future prescriptions absent from the authoritative feed are removed.
      for (const r of old) if (r.date >= today && !active.has(r.external_id)) check(await db.from('fitness_workouts').update({ data: { ...r, status: 'skipped', cancelled_plan: true }, updated_at: new Date().toISOString() }).eq('id',r.id));
      result.calendar = 'connected'; result.planned = events.filter((r: any) => r.date >= today).length;
      result.strength_planned = events.filter((r: any) => r.date >= today && r.type === 'Strength').length;
    } catch { result.calendar = 'error'; result.calendar_error = 'Could not read the TrainingPeaks calendar. Check or renew its private URL.'; }
  }
  if (s.intervals_key && s.intervals_athlete) {
    try {
      const since = new Date(); since.setUTCDate(since.getUTCDate()-30);
      const url = 'https://intervals.icu/api/v1/athlete/'+encodeURIComponent(s.intervals_athlete)+'/activities?oldest='+since.toISOString().slice(0,10)+'&newest='+localDate();
      const activities = await (await remote(url, { headers: { Authorization: 'Basic '+btoa('API_KEY:'+s.intervals_key) } })).json();
      if (!Array.isArray(activities)) throw new Error('Unexpected activity response');
      const prior = await records(); let imported = 0;
      for (const activity of activities) {
        const row = fromIntervals(activity);
        // Deduplicate records already imported from TrainingPeaks/history by actual metrics.
        const duplicate = prior.find(r => r.status !== 'planned' && r.date === row.date && r.type === row.type && !r.external_id?.startsWith('intervals:') && Number(r.duration_hours) > 0 && Math.abs(Number(r.duration_hours)-row.duration_hours) < 0.015 && Math.abs(Number(r.bike_miles || 0)-row.bike_miles)<0.2 && Math.abs(Number(r.run_miles || 0)-row.run_miles)<0.1 && Math.abs(Number(r.swim_yards || 0)-row.swim_yards)<30);
        if (duplicate) continue;
        await upsertExternal(row); imported++;
      }
      result.activities = 'connected'; result.activities_seen = activities.length; result.imported = imported;
    } catch { result.activities = 'error'; result.activities_error = 'Could not read Intervals.icu. Check athlete ID and API key.'; }
  }
  check(await db.from('fitness_settings').upsert({ key: 'last_sync', value: result }));
  return result;
}
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const url = new URL(req.url);
    if (req.method === 'GET' && (!url.searchParams.get('resource') || url.searchParams.get('resource') === 'public')) {
      const rows = await records();
      return reply({ sync: publicSync(await settings()), plans: publicPlans(rows, localDate()), workouts: rows.filter(r => r.status !== 'planned' && r.status !== 'skipped' && r.public_progress !== false).map(publicWorkout) });
    }
    const s = await settings();
    const runnerKey=req.headers.get('x-fitness-runner-key');
    if(req.method==='POST'&&runnerKey){
      if(!s.hosted_tp?.key_hash||await endpointHash(runnerKey)!==s.hosted_tp.key_hash)return reply({error:'Invalid runner key.'},401);
      if(!s.hosted_tp.enabled)return reply({error:'Hosted sync is not enabled.'},403);
      const text=await req.text();if(text.length>2000000)return reply({error:'Request too large.'},413);const body=JSON.parse(text),now=new Date().toISOString();
      if(body.action==='hosted_import'){
        const today=localDate(),shift=(days:number)=>{const d=new Date(today+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
        const incoming=parseTpExport(String(body.csv||''),today);
        if(incoming.length>1000||incoming.some((r:any)=>r.date<shift(-22)||r.date>shift(15)))throw new Error('Export must cover only the recent and upcoming window.');
        const prior=check(await db.from('fitness_workouts').select('id,external_id,data').gte('data->>date',shift(-22)).lte('data->>date',shift(15)));
        const result=await reconcileTp(incoming,prior),applied=check(await db.rpc('fitness_apply_tp_changes',{changes:result.changes}));
        const state={...s.hosted_tp,status:result.reviews.length?'review_required':'success',checked_at:now,last_success_at:now,covered_from:shift(-21),covered_to:shift(14),applied,reviews:result.reviews,alert_deliveries:result.reviews.length?s.hosted_tp.alert_deliveries||{}:{}};
        check(await db.from('fitness_settings').upsert([{key:'hosted_tp',value:state},{key:'trainingpeaks_browser_sync',value:{status:'success',checked_at:now,covered_from:shift(-21),covered_to:shift(14),source:'GitHub Actions',applied}}]));
        return reply({saved:true,applied,review_count:result.reviews.length});
      }
      if(body.action==='hosted_report'){
        if(!['started','needs_login','error'].includes(body.status))throw new Error('Invalid sync status.');
        const next=body.status==='error'&&s.hosted_tp.status==='needs_login'?'needs_login':body.status==='started'?'running':body.status;
        const state={...s.hosted_tp,status:next,last_attempt_at:now};check(await db.from('fitness_settings').upsert({key:'hosted_tp',value:state}));
        return reply({reported:true});
      }
      return reply({error:'Runner only supports export import and health reporting.'},403);
    }
    const scheduled = !!s.sync_key && req.headers.get('x-fitness-sync-key') === s.sync_key;
    // Custom auth: a scheduler key only grants background sync and due reminders; every other private action needs a verified owner JWT.
    if (req.method === 'POST' && scheduled) {
      const body = await req.json();
      if (body.action === 'sync') return reply(await sync(s));
      if (body.action === 'tick') {
        const stale = !s.last_sync?.at || Date.now()-new Date(s.last_sync.at).getTime() > 55*60000;
        const result = stale ? await sync(s) : s.last_sync;
        // Keep notification delivery independent of a failed dispatch request.
        const push=await sendDuePush(db,await records(),s);
        let dispatch;try{dispatch=await requestHosted(s);}catch{dispatch={status:'dispatch_error'};}
        const fresh=await settings();
        return reply({sync:result,push,dispatch,sync_alert:await sendSyncAlert(db,fresh,syncAlert(fresh.hosted_tp)||dispatchAlert(fresh.hosted_tp,fresh.hosted_dispatch,!!dispatchToken()))});
      }
      return reply({ error: 'Scheduler only supports synchronization and due reminders.' },403);
    }
    if (!await isOwner(req,s)) return reply({ error: 'Sign in with the owner email to access the private log.' },401);
    if (req.method === 'GET') {
      const h=s.hosted_tp;return reply({ sync: publicSync(s), workouts: await records(), checkins: check(await db.from('fitness_checkins').select('date,data').order('date')), connections: { dispatch:dispatchView(s.hosted_tp,s.hosted_dispatch,!!dispatchToken()), calendar: !!s.tp_calendar, intervals: !!s.intervals_key, athlete: s.intervals_athlete || '', last_sync: s.last_sync || null,hosted:h?{enabled:!!h.enabled,status:h.status,last_success_at:h.last_success_at,last_attempt_at:h.last_attempt_at,applied:h.applied,reviews:h.reviews||[]}:null } });
    }
    if (req.method !== 'POST') return reply({ error: 'Method not allowed.' },405);
    if (Number(req.headers.get('content-length') || 0) > 2000000) return reply({ error: 'Request too large.' },413);
    const body = await req.json();
    if(body.action==='mobility_complete')return reply(await saveMobility(db,body));
    if(body.action==='hosted_sync_now')return reply(await requestHosted(s,true));
    if(body.action==='runner_key'){
      const key=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
      check(await db.from('fitness_settings').upsert({key:'hosted_tp',value:{...s.hosted_tp,key_hash:await endpointHash(key),enabled:false,status:'awaiting_setup'}}));return reply({key});
    }
    if(body.action==='hosted_enable'){
      if(!s.hosted_tp?.key_hash)throw new Error('Create the runner key first.');check(await db.from('fitness_settings').upsert({key:'hosted_tp',value:{...s.hosted_tp,enabled:!!body.enabled,status:body.enabled?'pending':'disabled',started_at:new Date().toISOString()}}));return reply({saved:true});
    }
    if (body.action === 'push_key') return reply({ publicKey:(await vapidKeys(db)).publicKey });
    if (body.action === 'subscribe') {
      const subscription = validateSubscription(body.subscription);
      check(await db.from('fitness_push_subscriptions').upsert({endpoint_hash:await endpointHash(subscription.endpoint),subscription}));
      return reply({ subscribed:true });
    }
    if (body.action === 'unsubscribe') {
      check(await db.from('fitness_push_subscriptions').delete().eq('endpoint_hash',await endpointHash(String(body.endpoint))));
      return reply({ unsubscribed:true });
    }
    if (body.action === 'push_test') {
      const row = check(await db.from('fitness_push_subscriptions').select('*').eq('endpoint_hash',await endpointHash(String(body.endpoint))).single());
      const status = await sendPush(row.subscription,await vapidKeys(db),true);
      if (status < 200 || status >= 300) throw new Error('Push service returned HTTP '+status+'. Try enabling notifications again.');
      return reply({ sent:true });
    }
    if (body.action === 'save') {
      const row = validateWorkout(body.workout); const id = row.id; delete row.id; delete row.external_id;
      row.title = String(row.title || row.type+' workout').slice(0,300);row.manual_actuals=row.status==='completed';
      if (id) check(await db.from('fitness_workouts').update({ data: row, updated_at: new Date().toISOString() }).eq('id',id));
      else check(await db.from('fitness_workouts').insert({ data: row }));
      return reply({ saved: true });
    }
    if (body.action === 'import') {
      if (!Array.isArray(body.workouts) || body.workouts.length > 1000) throw new Error('Import up to 1,000 workouts at a time.');
      body.workouts.forEach(validateWorkout);
      const prior = await records(); let imported = 0;
      for (const row of body.workouts) {
        const exact = prior.some(r => r.date===row.date && r.type===row.type && (r.title===row.title && Number(r.duration_hours)===Number(row.duration_hours) || (Number(r.duration_hours)>0 && Math.abs(Number(r.duration_hours)-Number(row.duration_hours))<0.001 && Math.abs(Number(r.bike_miles||0)-Number(row.bike_miles||0))<0.01 && Math.abs(Number(r.run_miles||0)-Number(row.run_miles||0))<0.01 && Math.abs(Number(r.swim_yards||0)-Number(row.swim_yards||0))<1)));
        if (exact) continue;
        const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([row.date,row.type,row.title,row.duration_hours,row.bike_miles,row.run_miles,row.swim_yards])));
        row.external_id = 'tp-csv:'+Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');
        await upsertExternal(row); prior.push(row); imported++;
      }
      return reply({ imported });
    }
    if (body.action === 'checkin') {
      const data = body.checkin;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date)) throw new Error('Choose a date.');
      for (const key of ['sleep_hours','weight','resting_hr','hrv','energy','soreness']) if (data[key] != null && (!Number.isFinite(Number(data[key])) || data[key]<0)) throw new Error('Recovery values must be zero or greater.');
      if (data.sleep_hours > 24 || data.energy > 5 || data.soreness > 5) throw new Error('Sleep must be 0–24 hours; energy and soreness use 1–5.');
      check(await db.from('fitness_checkins').upsert({ date: data.date, data, updated_at: new Date().toISOString() }));
      return reply({ saved: true });
    }
    if (body.action === 'connections') {
      const entries: any[] = [];
      if ('calendar' in body) entries.push({ key: 'tp_calendar', value: body.calendar ? calendarUrl(body.calendar.trim()) : '' });
      if ('intervals_key' in body) entries.push({ key: 'intervals_key', value: String(body.intervals_key).trim() });
      if ('athlete' in body) { if (body.athlete && !/^i?\d+$/.test(body.athlete)) throw new Error('Use the Intervals.icu athlete ID from Settings.'); entries.push({ key:'intervals_athlete',value:body.athlete }); }
      if (entries.length) check(await db.from('fitness_settings').upsert(entries));
      return reply({ saved: true });
    }
    if (body.action === 'sync') return reply(await sync(s));
    return reply({ error: 'Unknown action.' },400);
  } catch (e) { return reply({ error: e instanceof Error ? e.message : 'Request failed.' },400); }
});
