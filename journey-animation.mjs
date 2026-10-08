// One clock drives the reveal, leading dot, and the hours at that point in history.
export function createJourneyAnimation(){
 let key='',frame=0;
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 let finish=()=>{};
 motion.addEventListener('change',()=>{if(motion.matches){cancelAnimationFrame(frame);finish();}});
 return function paint(j,label,ready=true){
  const next=JSON.stringify([j.start,j.end,label,ready,j.days.map(d=>d.cumulative)]);
  if(next===key)return;key=next;cancelAnimationFrame(frame);
  const total=document.getElementById('journeyTotal'),curve=document.getElementById('journeyCurve');
  total.setAttribute('aria-label',ready?j.hours.toFixed(1)+' hours logged, '+label:'Loading training hours');
  total.innerHTML='<strong aria-hidden="true"></strong><span aria-hidden="true"></span>';
  const number=total.querySelector('strong');total.querySelector('span').textContent='hours logged · '+label;
  const points=[[12,145],...j.days.map((d,i)=>[12+(i+1)/Math.max(1,j.days.length)*476,145-d.cumulative/Math.max(1,j.hours)*125])];
  const path=points.map(([x,y],i)=>(i?'L':'M')+x.toFixed(2)+' '+y.toFixed(2)).join(' ');
  curve.innerHTML='<svg viewBox="0 0 500 170" role="img" aria-label="Cumulative training hours"><defs><clipPath id="journeyReveal"><rect x="0" y="0" width="500" height="170"/></clipPath></defs><g clip-path="url(#journeyReveal)"><path d="'+path+' L488 160 L12 160 Z" fill="#e4ee78" opacity=".12"/><path d="'+path+'" fill="none" stroke="#e4ee78" stroke-width="3"/></g><circle r="5" fill="#e4ee78"/></svg>';
  const clip=curve.querySelector('rect'),dot=curve.querySelector('circle');
  function draw(p){
   const at=p*(points.length-1),i=Math.min(points.length-2,Math.floor(at)),fraction=at-i;
   const a=points[Math.max(0,i)],b=points[Math.max(0,i+1)];
   const x=a[0]+(b[0]-a[0])*fraction,y=a[1]+(b[1]-a[1])*fraction;
   const hours=p===1?j.hours:Math.max(0,(145-y)/125*Math.max(1,j.hours));
   number.textContent=hours.toFixed(1);clip.setAttribute('width',p===1?'500':String(x));dot.setAttribute('cx',x);dot.setAttribute('cy',y);
  }
  finish=()=>draw(ready?1:0);
  if(!ready){draw(0);return;}
  if(motion.matches||j.hours===0||points.length<2){finish();return;}
  draw(0);const started=performance.now(),duration=1800;
  function tick(now){const t=Math.min(1,(now-started)/duration);draw(1-Math.pow(1-t,3));if(t<1)frame=requestAnimationFrame(tick);}
  frame=requestAnimationFrame(tick);
 };
}
