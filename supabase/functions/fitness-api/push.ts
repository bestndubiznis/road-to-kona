import webpush from 'npm:web-push@3.6.7';
import { strengthDue, pushWindow, localDate } from './fitness.mjs';
const ok = (r: any) => { if (r.error) throw new Error(r.error.message); return r.data; };
export async function endpointHash(endpoint: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,'0')).join('');
}
export function validateSubscription(subscription: any) {
  const url = new URL(subscription?.endpoint);
  const host = url.hostname;
  if (url.protocol !== 'https:' || url.port || url.username || url.password || !(host === 'fcm.googleapis.com' || host === 'web.push.apple.com' || host === 'updates.push.services.mozilla.com' || host.endsWith('.notify.windows.com'))) throw new Error('Unsupported browser push service. Use Safari, Chrome, Edge, or Firefox.');
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(subscription.keys?.p256dh || '') || !/^[A-Za-z0-9_-]{20,30}$/.test(subscription.keys?.auth || '')) throw new Error('Invalid browser subscription keys.');
  return subscription;
}
export async function vapidKeys(db: any) {
  const current = ok(await db.from('fitness_settings').select('value').eq('key','vapid').maybeSingle());
  if (current) return current.value;
  const keys = webpush.generateVAPIDKeys();
  ok(await db.from('fitness_settings').upsert({ key:'vapid',value:keys }, { onConflict:'key',ignoreDuplicates:true }));
  return ok(await db.from('fitness_settings').select('value').eq('key','vapid').single()).value;
}
export async function sendPush(subscription: any, keys: any, test = false, custom: any = null) {
  validateSubscription(subscription);
  const request = webpush.generateRequestDetails(subscription, JSON.stringify(custom || {
    title: test ? 'Your fitness reminders are ready' : 'What did you lift today?',
    body: test ? 'Tap to open your private workout log.' : 'Your strength session is ready to log. Tap to add actual sets, reps, and weight.',
    url:'/?log=strength'
  }), { vapidDetails:{subject:'https://walkertokona.com',publicKey:keys.publicKey,privateKey:keys.privateKey}, TTL:21600 });
  const response = await fetch(request.endpoint, { method:'POST',headers:request.headers,body:new Uint8Array(request.body),redirect:'error',signal:AbortSignal.timeout(10000) });
  return response.status;
}
export async function sendSyncAlert(db:any,settings:any,alert:any){
 if(!alert)return {sent:0};const state=settings.hosted_tp||{},notified=state.alert_deliveries||{};
 const subscriptions=ok(await db.from('fitness_push_subscriptions').select('*'));let sent=0;
 if(!subscriptions.length||!settings.vapid)return {sent:0,connected:false};
 for(const row of subscriptions){
  if(notified[row.endpoint_hash]===alert.key)continue;
  let code=0;try{code=await sendPush(row.subscription,settings.vapid,false,{...alert,url:'/#connections',tag:'fitness-sync-attention'});}catch{}
  if(code>=200&&code<300){notified[row.endpoint_hash]=alert.key;sent++;}
  if(code===404||code===410)ok(await db.from('fitness_push_subscriptions').delete().eq('endpoint_hash',row.endpoint_hash));
 }
 ok(await db.from('fitness_settings').upsert({key:'hosted_tp',value:{...state,alert_deliveries:notified}}));return {sent,connected:true};
}
export async function sendDuePush(db: any, rows: any[], settings: any, now = new Date()) {
  if (!pushWindow(now)) return { due:false,sent:0 };
  if (!strengthDue(rows,localDate(now)).length) return { due:false,sent:0 };
  const subscriptions = ok(await db.from('fitness_push_subscriptions').select('*'));
  if (!subscriptions.length || !settings.vapid) return { due:true,sent:0,connected:false };
  const date = localDate(now); let sent = 0, failed = 0;
  for (const row of subscriptions) {
    const inserted = ok(await db.from('fitness_push_deliveries').upsert({date,endpoint_hash:row.endpoint_hash,status:'sending',attempts:1},{onConflict:'date,endpoint_hash',ignoreDuplicates:true}).select());
    let attempt = 1;
    if (!inserted.length) {
      const old = ok(await db.from('fitness_push_deliveries').select('*').eq('date',date).eq('endpoint_hash',row.endpoint_hash).single());
      if (old.status !== 'failed' || old.attempts >= 3) continue;
      attempt = old.attempts+1;
      const claimed = ok(await db.from('fitness_push_deliveries').update({status:'sending',attempts:attempt,updated_at:now.toISOString()}).eq('date',date).eq('endpoint_hash',row.endpoint_hash).eq('status','failed').select());
      if (!claimed.length) continue;
    }
    let status = 0;
    try { status = await sendPush(row.subscription,settings.vapid); } catch {}
    const delivered = status >= 200 && status < 300;
    if (status === 404 || status === 410) ok(await db.from('fitness_push_subscriptions').delete().eq('endpoint_hash',row.endpoint_hash));
    ok(await db.from('fitness_push_deliveries').update({status:delivered?'sent':'failed',error:delivered?null:'Push service HTTP '+status,attempts:attempt,updated_at:now.toISOString()}).eq('date',date).eq('endpoint_hash',row.endpoint_hash));
    if (delivered) sent++; else failed++;
  }
  return { due:true,sent,failed,connected:true };
}
