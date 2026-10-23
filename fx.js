'use strict';
/* Field Guide v2 — motion helpers. Everything here is decorative and switches off
   under prefers-reduced-motion. */
(function(){
const FG=window.FG=window.FG||{};
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
let uid=0;

/* ---------- Woven threads: two sine strands that draw open, then drift in opposite directions ---------- */
const wave=(n,up)=>{let d='';for(let i=0;i<n;i++)d+=up?'c33 -11 67 -11 100 0c33 11 67 11 100 0':'c33 11 67 11 100 0c33 -11 67 -11 100 0';return d;};
function weaveSVG({bead=true,knot=true}={}){
  const id=++uid,s1=`M-200 12${wave(4,true)}`,s2=`M-200 12${wave(4,false)}`,track=`M0 12${wave(2,true)}`,track2=`M0 12${wave(2,false)}`;
  return `<svg class="weave2" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true" focusable="false">`+
    `<defs><linearGradient id="wf${id}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".18" stop-color="#fff"/><stop offset=".82" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`+
    `<mask id="wm${id}" maskUnits="userSpaceOnUse" x="0" y="-6" width="400" height="36"><rect x="0" y="-6" width="400" height="36" fill="url(#wf${id})"/></mask>`+
    `<clipPath id="wc${id}"><rect class="wclip" x="0" y="-6" width="400" height="36"/></clipPath></defs>`+
    `<g clip-path="url(#wc${id})"><g mask="url(#wm${id})">`+
      `<g class="wflow a"><path class="s1" d="${s1}"/></g><g class="wflow b"><path class="s2" d="${s2}"/></g>`+
      (bead?`<circle class="bead" r="2.4"><animateMotion dur="4.8s" repeatCount="indefinite" path="${track}"/></circle>`+
            `<circle class="bead dim" r="1.7"><animateMotion dur="4.8s" begin="-2.4s" repeatCount="indefinite" path="${track2}"/></circle>`:'')+
    `</g></g>`+(knot?`<path class="knot" d="M200 5.5 203 12 200 18.5 197 12Z"/>`:'')+`</svg>`;
}
FG.weaveSVG=weaveSVG;
function mountWeaves(root=document){root.querySelectorAll('[data-weave]:not([data-woven])').forEach(el=>{el.innerHTML=weaveSVG({bead:el.dataset.weave!=='plain',knot:el.dataset.weave!=='bond'});el.dataset.woven='1';});}
FG.mountWeaves=mountWeaves;
/* Replay the draw-open whenever a woven heading comes back into view (e.g. on tab switch). */
FG.replayWeaves=root=>{if(calm())return;root.querySelectorAll('.weave2 .wclip').forEach(r=>{r.style.animation='none';void r.getBBox();r.style.animation='';});};
/* SMIL beads ignore CSS pausing, so pause them while their weave is off screen. */
const weaveIO='IntersectionObserver' in window?new IntersectionObserver(es=>es.forEach(e=>{const s=e.target;try{e.isIntersecting?s.unpauseAnimations():s.pauseAnimations();}catch{}})):null;
FG.observeWeaves=root=>{if(!weaveIO)return;root.querySelectorAll('.weave2').forEach(s=>weaveIO.observe(s));};

/* ---------- Number count-up ---------- */
FG.countTo=(el,value)=>{
  const to=Number(value),from=parseInt(el.textContent,10);
  if(!Number.isFinite(to)){el.textContent=value;return;}
  if(calm()||!Number.isFinite(from)||from===to){el.textContent=to;return;}
  const t0=performance.now(),dur=650;
  cancelAnimationFrame(el._raf);
  const step=t=>{const k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=Math.round(from+(to-from)*e);if(k<1)el._raf=requestAnimationFrame(step);};
  el._raf=requestAnimationFrame(step);
};

/* ---------- Lord colour wash: a ripple of the new lord's colour from a point ---------- */
const LORD_GLOW={Cai:'#a87bff',Dietrich:'#d23a4c',Theodora:'#e8ac4c',Leda:'#ff5b47'};
FG.wash=(lord,origin)=>{
  if(calm()||!LORD_GLOW[lord])return;
  const r=origin?.getBoundingClientRect?.(),x=r&&r.width?r.left+r.width/2:innerWidth/2,y=r&&r.height?r.top+r.height/2:innerHeight*.3;
  const R=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
  const el=document.createElement('div');el.className='lord-wash';el.setAttribute('aria-hidden','true');
  el.style.background=`radial-gradient(circle at ${x}px ${y}px, ${LORD_GLOW[lord]}cc 0, ${LORD_GLOW[lord]}55 35%, transparent 70%)`;
  document.body.appendChild(el);
  const a=el.animate([{clipPath:`circle(0px at ${x}px ${y}px)`,opacity:.75},{clipPath:`circle(${R}px at ${x}px ${y}px)`,opacity:0}],{duration:1100,easing:'cubic-bezier(.16,1,.3,1)'});
  a.onfinish=a.oncancel=()=>el.remove();
};

/* ---------- Sparkle burst on an element ---------- */
FG.burst=(el,delay=0)=>{
  if(calm()||!el)return;
  el.style.setProperty('--burst-delay',`${delay}ms`);
  el.classList.remove('burst');void el.offsetWidth;el.classList.add('burst');
  setTimeout(()=>el.classList.remove('burst'),900+delay);
};

/* ---------- Fly a portrait from one element to another (FLIP) ---------- */
FG.fly=(fromImg,toImg)=>{
  if(calm()||!fromImg||!toImg)return;
  const a=fromImg.getBoundingClientRect(),b=toImg.getBoundingClientRect();
  if(!a.width||!b.width||b.bottom<0||b.top>innerHeight)return;
  const ghost=fromImg.cloneNode();ghost.className='fly-ghost';ghost.removeAttribute('loading');
  Object.assign(ghost.style,{left:a.left+'px',top:a.top+'px',width:a.width+'px',height:a.height+'px'});
  document.body.appendChild(ghost);
  toImg.style.opacity='0';
  const dx=b.left-a.left,dy=b.top-a.top,s=b.width/a.width;
  const arc=Math.min(-60,dy*.35);
  const anim=ghost.animate([
    {transform:'translate(0,0) scale(1)',borderRadius:'12px',opacity:1},
    {transform:`translate(${dx*.5}px,${dy*.5+arc}px) scale(${(1+s)/2*1.15})`,borderRadius:'40%',opacity:1,offset:.55},
    {transform:`translate(${dx}px,${dy}px) scale(${s})`,borderRadius:'50%',opacity:1}
  ],{duration:720,easing:'cubic-bezier(.45,0,.2,1)'});
  anim.onfinish=anim.oncancel=()=>{ghost.remove();toImg.style.opacity='';FG.burst(toImg.closest('.seat'));};
};
})();
