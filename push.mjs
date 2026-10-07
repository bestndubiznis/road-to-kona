export function setupPush({api, requireOwner, openLog}) {
  const $=id=>document.getElementById(id);
  const supported='serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
  const registration='serviceWorker' in navigator && window.isSecureContext?navigator.serviceWorker.register('./sw.js').then(()=>navigator.serviceWorker.ready):Promise.resolve(null);
  registration.catch(()=>{});
  const status=message=>$('pushStatus').textContent=message;
  async function current() {const r=await registration;return r?.pushManager?.getSubscription();}
  async function refresh() {
    if(!supported){$('enablePush').disabled=true;status('Open the site on your phone. On iPhone, add it to the Home Screen first, then open it from that icon.');return;}
    try {const subscription=await current();const enabled=!!subscription && Notification.permission==='granted';$('enablePush').hidden=enabled;$('disablePush').hidden=!enabled;$('testPush').hidden=!enabled;status(enabled?'Enabled on this device. Tap “Send a test notification” to verify delivery.':'Enable on the device where you want your 8:30 p.m. reminders.');}catch{status('Notifications are not available in this browser. Try Safari, Chrome, Edge, or Firefox.');}
  }
  $('enablePush').onclick=()=>requireOwner(async()=>{
    if(!supported)return;
    const button=$('enablePush');button.disabled=true;
    // Permission is requested directly from the user's tap, before any asynchronous network work.
    const permission=Notification.requestPermission();
    try {
      if(await permission!=='granted')throw new Error('Notifications were not allowed. You can change this in your browser or phone settings.');
      const {publicKey}=await api('push_key');
      const base=publicKey.replace(/-/g,'+').replace(/_/g,'/');const bytes=Uint8Array.from(atob(base.padEnd(Math.ceil(base.length/4)*4,'=')),c=>c.charCodeAt(0));
      const r=await registration;let subscription=await r.pushManager.getSubscription();
      if(!subscription)subscription=await r.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
      await api('subscribe',{subscription:subscription.toJSON()});await refresh();status('Enabled. Use “Send a test notification” to check your phone. Reminders appear on prescribed strength days at 8:30 p.m. Pacific.');
    }catch(e){status(e.message);}finally{button.disabled=false;}
  });
  $('testPush').onclick=async()=>{const button=$('testPush');button.disabled=true;try{const subscription=await current();if(!subscription)throw new Error('Enable notifications first.');await api('push_test',{endpoint:subscription.endpoint});status('Test sent. Your phone or browser should show a fitness reminder.');}catch(e){status(e.message);}finally{button.disabled=false;}};
  $('disablePush').onclick=async()=>{try{const subscription=await current();if(subscription){await api('unsubscribe',{endpoint:subscription.endpoint});await subscription.unsubscribe();}await refresh();status('Notifications are off on this device.');}catch(e){status(e.message);}};
  navigator.serviceWorker?.addEventListener('message',event=>{if(event.data?.type==='open-strength-log')openLog();});
  return {refresh};
}
