'use strict';
/* Journey — the loom in More. One timeline shared by every save file:
   Prologue → Part I (four Flame Lord paths) → Part II (one lord leads) → Part III.
   Drag the shuttle along the thread or tap a medallion; the guide reveals what that point of the game allows
   and tallies what changed. All motion is decorative and switches off under prefers-reduced-motion. */
(function(){
const store=FG.store,D=FG.data,LORDS=store.LORDS;
const calm=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const PARTS=[
  {n:0,name:'Prologue',numeral:'✦',sub:'The opening chapters, before the paths divide'},
  {n:1,name:'Part I',numeral:'I',sub:'Four Flame Lord paths · twelve chapters each'},
  {n:2,name:'Part II',numeral:'II',sub:'One lord leads · opens after you finish a path'},
  {n:3,name:'Part III',numeral:'III',sub:'Opens once Part II is complete'}];
const LORD_GLOW={Cai:'#a87bff',Dietrich:'#d23a4c',Theodora:'#e8ac4c',Leda:'#ff5b47'};
const PART_GLOW=['#9fd8cf','#f0c76a','#ff7a5c','#a9b8ff'];

/* ---------- Haptics: iPhone (Safari 18+) ticks when a native switch toggles; Android uses vibrate. ---------- */
let hapticLabel=null;
FG.haptic=(kind='tick')=>{
  try{
    if(navigator.vibrate){navigator.vibrate(kind==='success'?[12,40,18]:kind==='heavy'?24:8);return;}
    if(!hapticLabel){
      hapticLabel=document.createElement('label');hapticLabel.setAttribute('aria-hidden','true');hapticLabel.className='haptic';
      hapticLabel.innerHTML='<input type="checkbox" switch tabindex="-1">';document.body.appendChild(hapticLabel);
    }
    hapticLabel.click();
    if(kind==='success')setTimeout(()=>hapticLabel.click(),90);
  }catch{}
};

/* ---------- Later missables (Prologue, Part II, Part III) — shared by every save file ---------- */
FG.laterReady=null;
FG.loadLater=()=>FG.laterReady||(FG.laterReady=fetch(`data/missables-later.json?v=${FG.DATA_V}`).then(r=>r.ok?r.json():{entries:[]}).catch(()=>({entries:[]})).then(d=>{D.later=Array.isArray(d.entries)?d.entries:[];D.laterNotes=d.coverageNotes&&typeof d.coverageNotes==='object'&&!Array.isArray(d.coverageNotes)?d.coverageNotes:{};return D.later;}));
/* A later note is shown once its Part is reached; route-specific Part II/III notes follow the lord who led Part II. */
FG.laterVisible=(e,j=store.journey())=>{
  if(e.part>j.part||(e.minJourney!=null&&j.part<e.minJourney))return false;
  if(e.route==='All'||!LORDS.includes(e.route))return true;
  if(e.part===2)return j.warLord===e.route;
  return j.warLord===e.route||j.paths.includes(e.route);
};

/* ---------- What a journey unlocks (for the tally after a change) ---------- */
function snapshot(j){
  const lord=FG.lord(),open=new Set(),chars=new Set(),miss=new Set();
  (D.roster?.characters||[]).forEach(c=>{if(c.reveal&&FG.revealed(c.name,j))chars.add(c.name);});
  (D.supports?.pairs||[]).forEach(p=>{
    if(!FG.revealed(p.a,j)||!FG.revealed(p.b,j))return;
    const seen=FG.seen(p.a,p.b);
    p.ranks.forEach(r=>{if(!seen.includes(r)&&!FG.rankGate(p,r,j,lord))open.add(`${p.a}|${p.b}|${r}`);});
  });
  (D.later||[]).forEach(e=>{if(FG.laterVisible(e,j))miss.add(e.id);});
  return{open,chars,miss};
}
const diff=(a,b)=>[...b].filter(x=>!a.has(x));

/* ---------- Markup ---------- */
const root=$('journey');
function stationHTML(p){
  return `<button type="button" role="radio" class="station" data-part="${p.n}" aria-checked="false" aria-label="${p.name}">`+
    `<span class="st-gem" aria-hidden="true"><span class="st-face"><b>${p.numeral}</b></span><svg class="st-lock ico"><use href="#i-lock"/></svg></span>`+
    `<span class="st-name">${p.name}</span></button>`;
}
function threadSVG(){
  /* Two strands that bulge apart between stations and cross at each one — a woven band. */
  let a='M0 22',b='M0 22';
  for(let i=0;i<3;i++){const x=i*100;a+=` C${x+28} 6 ${x+72} 6 ${x+100} 22`;b+=` C${x+28} 38 ${x+72} 38 ${x+100} 22`;}
  return `<svg class="loom-thread" viewBox="0 0 300 44" preserveAspectRatio="none" aria-hidden="true" focusable="false">`+
    `<defs><clipPath id="loom-clip" clipPathUnits="userSpaceOnUse"><rect id="loom-clip-rect" x="-4" y="-10" width="0" height="64"/></clipPath>`+
    `<linearGradient id="loom-gold" x1="0" x2="1"><stop offset="0" stop-color="#8e6c2c"/><stop offset=".5" stop-color="#fff1c4"/><stop offset="1" stop-color="#e2c27a"/></linearGradient></defs>`+
    `<path class="lt-base" d="${a}"/><path class="lt-base" d="${b}"/>`+
    `<g clip-path="url(#loom-clip)"><path class="lt-gold" d="${a}"/><path class="lt-gold b" d="${b}"/><path class="lt-glint" d="${a}"/><path class="lt-glint b" d="${b}"/></g></svg>`;
}
function build(){
  root.innerHTML=
    `<div class="jr-aura" aria-hidden="true"></div><canvas class="jr-sparks" aria-hidden="true"></canvas>`+
    `<p class="eyebrow"><span class="eyebrow-gem" aria-hidden="true"></span>Your journey</p>`+
    `<h2 id="journey-title" class="jr-title"><span class="jr-numeral" id="jr-numeral" aria-hidden="true"></span><span class="jr-name" id="jr-name"></span></h2>`+
    `<p class="jr-sub" id="jr-sub"></p>`+
    `<div class="loom" id="loom" role="radiogroup" aria-labelledby="journey-title">${threadSVG()}<span class="shuttle" id="shuttle" aria-hidden="true"><i></i></span>${PARTS.map(stationHTML).join('')}</div>`+
    `<p class="jr-help">Drag the shuttle or tap a Part — the guide reveals only what that point of the game allows. Shared by every save file.</p>`+
    `<div class="jr-block" id="jr-paths"><p class="jr-label">Part I paths you’ve completed</p><div class="path-row" id="path-row">`+
      LORDS.map(l=>`<button type="button" class="path-token" data-path="${l}" aria-pressed="false" style="--lc:${LORD_GLOW[l]}"><span class="pt-ring" aria-hidden="true"><img src="${esc(FG.portrait(l))}" alt=""><i class="pt-flame"></i><span class="pt-seal"><svg class="ico"><use href="#i-check"/></svg></span></span><span class="pt-name">${l}</span><small class="pt-state">Not yet</small></button>`).join('')+
    `</div></div>`+
    `<div class="jr-block" id="jr-war" hidden><p class="jr-label">Who leads Part II?</p><div class="war-row" id="war-row" role="radiogroup" aria-label="Lord leading Part II"></div></div>`+
    `<ul class="jr-ledger" id="jr-ledger" aria-live="polite"></ul>`;
  wireLoom();wirePaths();
}

/* ---------- Paint ---------- */
let shown=null,progress=null;      // progress: 0..3 along the thread (float while moving)
function paint({ceremony=false,from=null}={}){
  const j=store.journey(),P=PARTS[j.part];
  root.dataset.part=j.part;
  root.style.setProperty('--pg',PART_GLOW[j.part]);
  if(shown!==j.part&&!moving){
    const num=$('jr-numeral'),name=$('jr-name');
    num.textContent=P.numeral;name.textContent=P.name;$('jr-sub').textContent=P.sub;
    if(ceremony&&!calm()){[num,name,$('jr-sub')].forEach(el=>{el.classList.remove('stamp');void el.offsetWidth;el.classList.add('stamp');});}
    shown=j.part;
  }
  root.querySelectorAll('.station').forEach(b=>{
    const n=+b.dataset.part;
    b.setAttribute('aria-checked',String(n===j.part));b.tabIndex=n===j.part?0:-1;
    b.classList.toggle('done',n<j.part);b.classList.toggle('current',n===j.part);b.classList.toggle('sealed',n>j.part);
    b.setAttribute('aria-label',`${PARTS[n].name}${n<j.part?', complete':n===j.part?', current':', not reached'}`);
  });
  if(progress===null||!moving)setProgress(j.part);
  $('jr-paths').hidden=j.part<1;
  root.querySelectorAll('.path-token').forEach(t=>{
    const on=j.paths.includes(t.dataset.path);t.setAttribute('aria-pressed',String(on));t.classList.toggle('lit',on);
    t.querySelector('.pt-state').textContent=on?'Complete':'Not yet';
    t.setAttribute('aria-label',`${t.dataset.path}’s path: ${on?'complete':'not complete'}`);
  });
  const war=$('jr-war');war.hidden=j.part<2;
  if(j.part>=2){
    const can=j.paths.length?j.paths:LORDS;
    const tabStop=can.includes(j.warLord)?j.warLord:can[0];
    $('war-row').innerHTML=can.map(l=>`<button type="button" role="radio" class="war-chip${l===j.warLord?' on':''}" data-war="${l}" aria-checked="${l===j.warLord}" tabindex="${l===tabStop?0:-1}" style="--lc:${LORD_GLOW[l]}"><span class="pf sm"><img src="${esc(FG.portrait(l))}" alt=""></span>${l}</button>`).join('');
  }
  FG.paintJourneyPills();
}
FG.paintJourneyPills=()=>{
  const j=store.journey(),label=FG.partName(j.part)+(j.part===1&&j.paths.length?` · ${j.paths.length} path${j.paths.length>1?'s':''} done`:'');
  document.querySelectorAll('[data-journey-pill]').forEach(b=>{const t=b.querySelector('.jp-text');if(!t)return;t.textContent=label;b.setAttribute('aria-label',`Journey: ${label}. Change in More`);b.dataset.part=j.part;});
};
document.addEventListener('click',e=>{
  if(!e.target.closest('[data-journey-pill]'))return;
  FG.setTab('about');
  const h=$('journey-title');h.tabIndex=-1;h.focus({preventScroll:true});
  requestAnimationFrame(()=>{root.scrollIntoView({block:'start',behavior:calm()?'auto':'smooth'});root.classList.remove('beckon');void root.offsetWidth;root.classList.add('beckon');});
});

/* ---------- The thread ---------- */
let geom=null;
function measure(){
  const loom=$('loom'),st=[...loom.querySelectorAll('.station')];
  const lr=loom.getBoundingClientRect();
  const xs=st.map(b=>{const r=b.querySelector('.st-gem').getBoundingClientRect();return r.left+r.width/2-lr.left;});
  geom={left:lr.left,x0:xs[0],x3:xs[3],xs};
  const svg=loom.querySelector('.loom-thread');svg.style.left=xs[0]+'px';svg.style.width=(xs[3]-xs[0])+'px';
}
function setProgress(v){
  progress=Math.max(0,Math.min(3,v));
  if(!geom)measure();
  const span=geom.x3-geom.x0,x=geom.x0+span*progress/3;
  $('loom-clip-rect').setAttribute('width',(progress*100+4).toFixed(2));
  const sh=$('shuttle');sh.style.transform=`translate3d(${x.toFixed(1)}px,0,0)`;
  root.style.setProperty('--prog',(progress/3).toFixed(4));
}
addEventListener('resize',()=>{if(!$('about').hidden&&root.childElementCount){geom=null;measure();setProgress(progress??store.journey().part);}});

/* ---------- Motion: a damped spring carries the shuttle; each medallion it passes pulses ---------- */
let moving=false,raf=0,lastIdx=null;
function passPulse(i){
  const b=root.querySelector(`.station[data-part="${i}"]`);if(!b||calm())return;
  b.classList.remove('pass');void b.offsetWidth;b.classList.add('pass');FG.haptic();
}
function trackCrossings(v){const i=Math.round(v);if(lastIdx!==null&&i!==lastIdx){const step=i>lastIdx?1:-1;for(let k=lastIdx+step;k!==i+step;k+=step)passPulse(k);}lastIdx=i;}
function springTo(target,done){
  cancelAnimationFrame(raf);
  if(calm()){setProgress(target);moving=false;done?.();return;}
  let x=progress??target,v=0,t0=performance.now();moving=true;lastIdx=Math.round(x);
  const k=150,c=19;
  const step=t=>{
    const dt=Math.min(.032,(t-t0)/1000);t0=t;
    for(let i=0;i<2;i++){const a=-k*(x-target)-c*v;v+=a*dt/2;x+=v*dt/2;}
    setProgress(x);trackCrossings(x);
    if(Math.abs(x-target)<.002&&Math.abs(v)<.01){setProgress(target);moving=false;done?.();return;}
    raf=requestAnimationFrame(step);
  };
  raf=requestAnimationFrame(step);
}

/* ---------- Choosing a Part ---------- */
function choose(n){
  const j=store.journey(),old=j.part;
  if(n===old){springTo(n);return;}
  const was=JSON.parse(JSON.stringify(j));
  moving=true;                       // the shuttle is about to travel: let it, then stamp the new Part on arrival
  store.updateJourney(st=>{
    st.part=n;
    /* Part II begins from a completed path: if none is marked, assume this save file's lord. */
    if(n>=2&&!st.paths.length)st.paths=[FG.lord()];
    if(n>=2&&(!st.warLord||!st.paths.includes(st.warLord)))st.warLord=st.paths.includes(FG.lord())?FG.lord():st.paths[0];
  });
  springTo(n,()=>arrive(n,n>old));
  FG.loadLater().then(()=>ledger(snapshot(was),snapshot(store.journey()),n>old,n));
}
function arrive(n,forward){
  const b=root.querySelector(`.station[data-part="${n}"]`);
  paint({ceremony:true});
  FG.haptic(forward?'success':'heavy');
  if(calm()||!b)return;
  b.classList.remove('arrive','retreat');void b.offsetWidth;b.classList.add(forward?'arrive':'retreat');
  sparks(b.querySelector('.st-gem'),forward?{n:46,color:PART_GLOW[n],power:1}:{n:18,color:'#c9d3d6',power:.45,fall:true});
  root.classList.remove('flare');void root.offsetWidth;root.classList.add('flare');
}

function wireLoom(){
  const loom=$('loom');
  loom.addEventListener('click',e=>{const b=e.target.closest('.station');if(b&&!dragged)choose(+b.dataset.part);});
  loom.addEventListener('keydown',e=>{
    const j=store.journey(),keys={ArrowRight:j.part+1,ArrowUp:j.part+1,ArrowLeft:j.part-1,ArrowDown:j.part-1,Home:0,End:3};
    if(!(e.key in keys))return;e.preventDefault();
    const n=Math.max(0,Math.min(3,keys[e.key]));choose(n);
    requestAnimationFrame(()=>loom.querySelector(`.station[data-part="${n}"]`)?.focus());
  });
  /* Drag: the shuttle follows the finger, the gold thread weaves behind it, medallions tick as it passes. */
  let drag=null,dragged=false;
  loom.addEventListener('pointerdown',e=>{
    if(e.button>0)return;
    measure();
    drag={x:e.clientX,y:e.clientY,id:e.pointerId,v:0,lx:e.clientX,lt:performance.now(),live:false};dragged=false;
  });
  loom.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
    if(!drag.live){if(Math.abs(dx)<7||Math.abs(dx)<Math.abs(dy))return;drag.live=true;dragged=true;loom.setPointerCapture(e.pointerId);loom.classList.add('dragging');cancelAnimationFrame(raf);moving=true;lastIdx=Math.round(progress);}
    const span=geom.x3-geom.x0,x=e.clientX-geom.left;
    const now=performance.now();drag.v=(e.clientX-drag.lx)/Math.max(1,now-drag.lt);drag.lx=e.clientX;drag.lt=now;
    let v=(x-geom.x0)/span*3;
    if(v<0)v=-Math.pow(-v,.6)*.25;if(v>3)v=3+Math.pow(v-3,.6)*.25;   // rubber-band past the ends
    setProgress(Math.max(-.25,Math.min(3.25,v)));progress=v;trackCrossings(Math.max(0,Math.min(3,v)));
  });
  const end=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const live=drag.live,vel=drag.v;drag=null;loom.classList.remove('dragging');
    if(!live)return;
    const span=geom.x3-geom.x0,proj=progress+vel*3/span*140;    // a flick carries a little further
    choose(Math.max(0,Math.min(3,Math.round(proj))));
    setTimeout(()=>{dragged=false;},0);
  };
  loom.addEventListener('pointerup',end);loom.addEventListener('pointercancel',end);
}

/* ---------- Part I paths and the Part II lord ---------- */
function wirePaths(){
  $('path-row').addEventListener('click',e=>{
    const t=e.target.closest('.path-token');if(!t)return;
    const lord=t.dataset.path,j=store.journey(),on=!j.paths.includes(lord);
    if(!on&&j.part>=2&&j.paths.length===1){
      FG.toast('Part II starts from a completed path');
      if(!calm()){t.classList.remove('shake');void t.offsetWidth;t.classList.add('shake');}
      FG.haptic('heavy');return;
    }
    const was=JSON.parse(JSON.stringify(j));
    store.updateJourney(st=>{
      const s=new Set(st.paths);if(on)s.add(lord);else s.delete(lord);st.paths=LORDS.filter(l=>s.has(l));
      if(st.part>=2&&!st.paths.includes(st.warLord))st.warLord=st.paths[0]||null;
    });
    paint();
    if(on){
      FG.haptic('success');
      if(!calm()){t.classList.remove('ignite','douse');void t.offsetWidth;t.classList.add('ignite');sparks(t.querySelector('.pt-ring'),{n:30,color:LORD_GLOW[lord],power:.8,rise:true});FG.wash(lord,t);}
      FG.toast(`${lord}’s path complete`);
    }else if(!calm()){t.classList.remove('ignite','douse');void t.offsetWidth;t.classList.add('douse');}
    FG.loadLater().then(()=>ledger(snapshot(was),snapshot(store.journey()),on,null));
  });
  $('war-row').addEventListener('keydown',e=>{
    const chips=[...$('war-row').querySelectorAll('[data-war]')],i=chips.indexOf(e.target.closest('[data-war]'));if(i<0)return;
    const to={ArrowRight:i+1,ArrowDown:i+1,ArrowLeft:i-1,ArrowUp:i-1,Home:0,End:chips.length-1}[e.key];if(to===undefined)return;
    e.preventDefault();chips[(to+chips.length)%chips.length].click();
  });
  $('war-row').addEventListener('click',e=>{
    const c=e.target.closest('[data-war]');if(!c)return;
    const lord=c.dataset.war,j=store.journey();if(j.warLord===lord)return;
    const was=JSON.parse(JSON.stringify(j));
    store.updateJourney(st=>{st.warLord=lord;if(!st.paths.includes(lord))st.paths=LORDS.filter(l=>st.paths.includes(l)||l===lord);});
    paint();FG.haptic();
    const chip=$('war-row').querySelector(`[data-war="${lord}"]`);
    if(chip&&!calm()){chip.classList.add('crown');FG.wash(lord,chip);}
    chip?.focus();
    FG.loadLater().then(()=>ledger(snapshot(was),snapshot(store.journey()),true,null));
  });
}

/* ---------- The tally: what this change revealed or sealed ---------- */
function ledger(before,after,forward,part){
  const opened=diff(before.open,after.open).length,closed=diff(after.open,before.open).length;
  const met=diff(before.chars,after.chars),hid=diff(after.chars,before.chars).length;
  const missIn=diff(before.miss,after.miss).length,missOut=diff(after.miss,before.miss).length;
  const lines=[];
  if(opened)lines.push(['open',opened,opened===1?'support conversation now open':'support conversations now open']);
  if(missIn)lines.push(['miss',missIn,missIn===1?'missable note unsealed':'missable notes unsealed']);
  if(met.length)lines.push(['meet',met.length,met.length===1?'new face in the guide':'new faces in the guide',met]);
  if(closed)lines.push(['seal',closed,forward?(closed===1?'conversation closes at this point':'conversations close at this point'):(closed===1?'conversation waits for a later point':'conversations wait for a later point')]);
  if(missOut)lines.push(['seal',missOut,missOut===1?'missable note sealed again':'missable notes sealed again']);
  if(hid)lines.push(['seal',hid,hid===1?'character hidden again':'characters hidden again']);
  const ul=$('jr-ledger');
  if(!lines.length){ul.innerHTML=part!==null?`<li class="lg-quiet"><svg class="ico" aria-hidden="true"><use href="#i-spark"/></svg>Nothing new to reveal at this point.</li>`:'';return;}
  ul.innerHTML=lines.map(([k,n,label,faces],i)=>`<li class="lg-${k}" style="--i:${i}"><svg class="ico" aria-hidden="true"><use href="#${k==='seal'?'i-lock':'i-spark'}"/></svg><b data-n="${n}">${calm()?n:0}</b><span>${label}</span>`+
    (faces?`<span class="lg-faces">${faces.slice(0,6).map((f,k2)=>`<img src="${esc(FG.portrait(f))}" alt="${esc(f)}" style="--k:${k2}">`).join('')}</span>`:'')+`</li>`).join('');
  if(!calm())ul.querySelectorAll('b[data-n]').forEach((b,i)=>setTimeout(()=>FG.countTo(b,+b.dataset.n),260+i*140));
}

/* ---------- Sparks: a small canvas particle system over the journey card ---------- */
let ctx=null,parts=[],sparkRaf=0;
function sparks(el,{n=30,color='#f0c76a',power=1,fall=false,rise=false}={}){
  if(calm()||!el)return;
  const cv=root.querySelector('.jr-sparks'),rr=root.getBoundingClientRect(),er=el.getBoundingClientRect();
  const dpr=Math.min(3,devicePixelRatio||1);
  if(cv.width!==Math.round(rr.width*dpr)||cv.height!==Math.round(rr.height*dpr)){cv.width=Math.round(rr.width*dpr);cv.height=Math.round(rr.height*dpr);}
  ctx=cv.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);
  const cx=er.left+er.width/2-rr.left,cy=er.top+er.height/2-rr.top;
  for(let i=0;i<n;i++){
    const a=rise?(-Math.PI/2+(Math.random()-.5)*1.6):Math.random()*Math.PI*2,s=(fall?.6:1.4+Math.random()*3.2)*power;
    parts.push({x:cx+Math.cos(a)*er.width*.3,y:cy+Math.sin(a)*er.height*.3,vx:Math.cos(a)*s,vy:Math.sin(a)*s-(rise?1.2:fall?-.4:.8),
      life:0,max:42+Math.random()*34,r:.8+Math.random()*2.1,color:Math.random()<.35?'#fff6dc':color,tw:Math.random()*6});
  }
  if(!sparkRaf)sparkRaf=requestAnimationFrame(tick);
}
function tick(){
  const cv=root.querySelector('.jr-sparks');ctx.clearRect(0,0,cv.width,cv.height);
  ctx.globalCompositeOperation='lighter';
  parts=parts.filter(p=>p.life<p.max);
  for(const p of parts){
    p.life++;p.x+=p.vx;p.y+=p.vy;p.vx*=.955;p.vy=p.vy*.955+.06;
    const k=1-p.life/p.max,a=Math.max(0,k)*(.65+.35*Math.sin(p.life*.5+p.tw));
    ctx.globalAlpha=a;ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;
    ctx.beginPath();ctx.arc(p.x,p.y,p.r*(.6+k*.6),0,Math.PI*2);ctx.fill();
  }
  ctx.globalAlpha=1;ctx.shadowBlur=0;
  sparkRaf=parts.length?requestAnimationFrame(tick):0;
  if(!sparkRaf)ctx.clearRect(0,0,cv.width,cv.height);
}

/* ---------- Boot ---------- */
build();
FG.renderJourney=()=>{if($('about').hidden)return;geom=null;measure();paint();};
FG.onJourneyShown=()=>{geom=null;requestAnimationFrame(()=>{measure();paint();});FG.loadLater();};
store.on('change',e=>{
  if(!root.childElementCount)return;
  if(e?.source==='tab'||e?.source==='restore')$('jr-ledger').innerHTML='';
  if(e?.source!=='journey'||!moving)paint();
});
FG.ready.then(()=>{FG.paintJourneyPills();});
FG.paintJourneyPills();
})();
