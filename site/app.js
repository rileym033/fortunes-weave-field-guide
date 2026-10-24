'use strict';
/* Field Guide v2 — shell, data, save files, Company (tri-state filters), field notes. */
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const FG=window.FG=window.FG||{};
const store=FG.store;
const LORDS=store.LORDS;
const RANKS=['C','B','A'];
const RANK_LEVEL={C:2,B:3,A:4};
FG.onProfileChange=[];
/* Filter and view preferences stay on this device (not in the save files). */
FG.prefs=(()=>{const K='fwfg-ui-v3';let o={};try{o=JSON.parse(localStorage.getItem(K)||'{}')||{};}catch{}
  return{get:k=>o[k],set:(k,v)=>{o[k]=v;try{localStorage.setItem(K,JSON.stringify(o));}catch{}}};})();
FG.onDataReady=[];

/* ---------- Theme ---------- */
const THEME_COLORS={'':'#0b272b',Cai:'#131a4a',Dietrich:'#161d2d',Theodora:'#30160e',Leda:'#3b0d16'};
FG.setTheme=name=>{
  const theme=name&&THEME_COLORS[name]?name:'';
  if(document.documentElement.dataset.theme===theme)return;
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]').setAttribute('content',THEME_COLORS[theme]);
};
const HERO_ART={Cai:{pos:'14% 50%',lift:'-26%'},Dietrich:{pos:'70% 50%',lift:'-6%'},Theodora:{pos:'48% 50%',lift:'-25%'},Leda:{pos:'40% 50%',lift:'-24%'}};

/* ---------- Gold dust ---------- */
FG.seedMotes=(el,count=10)=>{
  if(!el||el.childElementCount)return;
  let html='';
  for(let i=0;i<count;i++){const r=Math.random;html+=`<i style="--x:${(r()*100).toFixed(1)}%;--s:${(2+r()*3.6).toFixed(1)}px;--d:${(8+r()*9).toFixed(1)}s;--delay:${(-r()*16).toFixed(1)}s;--dx:${Math.round(r()*70-35)}px;--o:${(.3+r()*.55).toFixed(2)}"></i>`;}
  el.innerHTML=html;
};
document.querySelectorAll('.motes').forEach(m=>FG.seedMotes(m));
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('offscreen',!e.isIntersecting)));
  document.querySelectorAll('.hero,.lord-stage,.page-hero,.table-stage').forEach(el=>io.observe(el));
}

/* ---------- Toast ---------- */
let toastTimer=0;
FG.toast=message=>{
  const t=$('toast');t.textContent=message;t.hidden=false;
  t.style.animation='none';void t.offsetWidth;t.style.animation='';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},2300);
};

/* ---------- Bottom sheets ---------- */
FG.openSheet=dialog=>{
  dialog.classList.remove('closing');dialog.style.transform='';
  if(!dialog.open)dialog.showModal();
  dialog.scrollTop=0;document.body.style.overflow='hidden';
};
FG.closeSheet=dialog=>{
  if(!dialog.open||dialog.classList.contains('closing'))return;
  if(reduceMotion()){dialog.close();return;}
  dialog.classList.add('closing');
  let finished=false;
  const done=()=>{if(finished)return;finished=true;dialog.removeEventListener('animationend',onEnd);dialog.classList.remove('closing');dialog.style.transform='';if(dialog.open)dialog.close();};
  const onEnd=e=>{if(e.target===dialog)done();};
  dialog.addEventListener('animationend',onEnd);setTimeout(done,330);
};
FG.wireSheet=(dialog,closeButton,onClose)=>{
  closeButton.addEventListener('click',()=>FG.closeSheet(dialog));
  dialog.addEventListener('cancel',e=>{e.preventDefault();FG.closeSheet(dialog);});
  dialog.addEventListener('click',e=>{
    const r=dialog.getBoundingClientRect();
    if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))FG.closeSheet(dialog);
  });
  dialog.addEventListener('close',()=>{dialog.classList.remove('closing','dragging');dialog.style.transform='';if(!document.querySelector('dialog[open]'))document.body.style.overflow='';onClose?.();});
  let startY=null,lastY=0,lastT=0,velocity=0;
  const down=e=>{if(e.button>0||e.target.closest('button,a,input'))return;startY=lastY=e.clientY;lastT=performance.now();velocity=0;dialog.classList.add('dragging');e.currentTarget.setPointerCapture?.(e.pointerId);};
  const move=e=>{if(startY===null)return;const now=performance.now();velocity=(e.clientY-lastY)/Math.max(1,now-lastT);lastY=e.clientY;lastT=now;dialog.style.transform=`translateY(${Math.max(0,e.clientY-startY)}px)`;};
  const up=e=>{
    if(startY===null)return;
    const dy=Math.max(0,e.clientY-startY);startY=null;dialog.classList.remove('dragging');
    if(dy>110||(dy>24&&velocity>.55)){FG.closeSheet(dialog);return;}
    dialog.style.transition='transform .35s cubic-bezier(.16,1,.3,1)';dialog.style.transform='';setTimeout(()=>{dialog.style.transition='';},380);
  };
  dialog.querySelectorAll('.sheet-grip,.dialogtop').forEach(h=>{h.addEventListener('pointerdown',down);h.addEventListener('pointermove',move);h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);});
};

/* ---------- Data ---------- */
const D=FG.data={roster:null,supports:null,meals:null,byName:new Map(),pairs:new Map(),partners:new Map()};
/* Bumped with each data release so phones never pair new code with cached old data. */
const DATA_V='42';
FG.DATA_V=DATA_V;
const getJSON=url=>fetch(`${url}?v=${DATA_V}`).then(r=>{if(!r.ok)throw Error(url);return r.json();});
FG.pairKey=(a,b)=>a<b?`${a}|${b}`:`${b}|${a}`;
FG.pair=(a,b)=>D.pairs.get(FG.pairKey(a,b));
FG.portrait=name=>D.byName.get(name)?.portrait||D.roster?.lordPortraits?.[name]||(LORDS.includes(name)?`portraits/${name.toLowerCase()}.webp`:'');
FG.isLord=name=>LORDS.includes(name);
FG.lord=()=>store.profile().lord;
FG.team=(lord=FG.lord())=>D.roster?.teams?.[lord]||[];
/* A later-story character's recruitment stays sealed until the journey reaches the Part where they can join. */
const sealedRecruit=(c,j=store.journey())=>c?.recruitPart!=null&&j.part<c.recruitPart;
const SEALED_RT={status:'Sealed',sealed:true,support:null,renown:null,materials:'—',gold:'—',steps:[],find:null,window:'Sealed until later in your journey'};
FG.routeOf=(name,lord=FG.lord(),j=store.journey())=>{const c=D.byName.get(name),rt=c?.routes?.[lord]||null;return rt&&sealedRecruit(c,j)?SEALED_RT:rt;};
/* ---------- Journey gates (shared by every save file) ---------- */
const ROMAN_PART=['Prologue','Part I','Part II','Part III'];
FG.partName=n=>ROMAN_PART[n]||`Part ${n}`;
FG.journey=()=>store.journey();
/* Later-story characters stay out of every list until the journey reaches the point where you meet them. */
FG.revealed=(name,j=store.journey())=>{
  const r=D.byName.get(name)?.reveal;if(!r)return true;
  if(j.part!==r.part)return j.part>r.part;
  return !r.path||j.paths.includes(r.path);
};
FG.characters=(j=store.journey())=>(D.roster?.characters||[]).filter(c=>FG.revealed(c.name,j));
FG.everyone=()=>[...LORDS,...FG.characters().map(c=>c.name)];
/* Is a support rank open at this point of the journey? null = open; otherwise why not (short + long text). */
/* Who can be in the army at this point: Part I = this save file's path; Part II = the lord leading it; Part III = everyone
   recruitable on a completed path, plus the lords. Rules come from research (supports.json → viewing.army) with these defaults. */
FG.available=(name,j=store.journey(),lord=FG.lord())=>{
  const A=D.supports?.viewing?.army||{};
  if(j.part===0)return false;
  const war=j.warLord||lord;
  if(LORDS.includes(name)){if(j.part===1)return name===lord||!!A.otherLordsInPartI;if(j.part===2)return name===war||!!A.otherLordsInPartII;return true;}
  const c=D.byName.get(name);if(!c||!FG.revealed(name,j))return false;
  if(LORDS.some(L=>c.routes[L]?.status==='Prologue'))return j.part>=(A.prologueFromPart??2);
  if(j.part===1)return FG.canJoin(name,lord,j);
  if(j.part===2)return FG.canJoin(name,war,j);
  if(LORDS.some(L=>c.routes[L]?.status==='Later'))return LORDS.some(L=>FG.canJoin(name,L,j));   // later recruits join in Part III
  const paths=A.allRecruitsInPartIII||!j.paths.length?LORDS:j.paths;
  return paths.some(L=>FG.canJoin(name,L,j));
};
const awayText=(n,j,lord)=>j.part===1?(LORDS.includes(n)?`${n}’s path only`:`${n} can’t join on ${lord}’s path`):j.part===2?`${n} isn’t in ${j.warLord||lord}’s army`:`${n} isn’t in your army yet`;
/* opts.pathOnly: ignore this save file's recruits and chapter (used to compare paths);
   opts.assume: treat this character as recruited (used to show what recruiting them would open). */
FG.rankGate=(pr,r,j=store.journey(),lord=FG.lord(),opts={})=>{
  const g=pr.gates?.[r]||{},min=g.minPart??pr.parts?.[r]??1,P=FG.partName;
  const rules=D.supports?.viewing||{};
  if(j.part<min)return{short:`opens in ${P(min)}`,text:`Opens in ${P(min)}`,part:true};
  if(g.maxPart!=null&&j.part>g.maxPart)return{short:`closed after ${P(g.maxPart)}`,text:`Only viewable up to ${P(g.maxPart)}`,part:true};
  if(Array.isArray(rules.closedParts)&&rules.closedParts.includes(j.part))return{short:`not during ${P(j.part)}`,text:`Conversations can’t be viewed during ${P(j.part)}`};
  if(g.path&&j.part===1&&lord!==g.path)return{short:`${g.path}’s path only`,text:`Only on ${g.path}’s path`};
  if(g.paths&&j.part===1&&!g.paths.includes(lord)){const t=g.paths.map(l=>`${l}’s`).join(' or ');return{short:`${t} path only`,text:`Only on ${t} path`};}
  if(g.notPath&&j.part===1&&lord===g.notPath)return{short:`not on ${lord}’s path`,text:`Not viewable on ${lord}’s path`};
  if(g.pathComplete&&!j.paths.includes(g.pathComplete))return{short:`after ${g.pathComplete}’s path`,text:`After completing ${g.pathComplete}’s path`};
  if(g.warLord&&j.part>=2&&j.warLord!==g.warLord)return{short:`${g.warLord} leading Part II`,text:`Only with ${g.warLord} leading Part II`};
  for(const [x,y,r2] of g.after||[])if(!FG.seen(x,y).includes(r2))return{short:`after ${x} & ${y}’s ${r2}`,text:`Watch ${x} & ${y}’s ${r2} conversation first`};
  for(const [x,y,r2] of g.before||[])if(FG.seen(x,y).includes(r2))return{short:`closed by ${x} & ${y}’s ${r2}`,text:`Closes once ${x} & ${y}’s ${r2} conversation is watched`};
  for(const n of [pr.a,pr.b])if(n&&!FG.available(n,j,lord)){const t=awayText(n,j,lord);return{short:t,text:t,away:n};}
  /* Part I: chapter windows (when your chapter is set) and recruits — at least one of the two must be recruited,
     some conversations need both (checked in game). */
  if(!opts.pathOnly&&j.part===1){
    const p=store.profile(),ch=p.chapter,first=D.supports?.viewing?.firstChapter||4;
    if(ch!=null){
      if(ch<first)return{short:`inns open in Chapter ${first}`,text:`Supports can be viewed from Chapter ${first} — you’re on Chapter ${ch}`};
      if(g.fromCh&&ch<g.fromCh)return{short:`from Chapter ${g.fromCh}`,text:`Opens in Chapter ${g.fromCh} — you’re on Chapter ${ch}`};
      if(g.untilCh&&ch>g.untilCh)return{short:`closed after Chapter ${g.untilCh}`,text:`Only until the end of Chapter ${g.untilCh} — you’re on Chapter ${ch}`,missed:true};
    }
    const out=[pr.a,pr.b].filter(n=>n!==opts.assume&&!FG.inCompany(n,p));
    if(g.both&&out.length){const t=`recruit ${out.join(' & ')} first`;return{short:t,text:`Needs both recruited — recruit ${out.join(' and ')} first`,recruit:out};}
    if(out.length===2)return{short:`recruit ${pr.a} or ${pr.b}`,text:`Recruit ${pr.a} or ${pr.b} first`,recruit:out};
  }
  return null;
};
/* Unwatched conversations this character has with your company that you can actually view on this path now. */
FG.unseenWithCompany=(name,p=store.profile())=>{
  let n=0;
  (D.partners.get(name)||[]).forEach(m=>{
    if(m===name||!FG.inCompany(m,p))return;
    const pr=FG.pair(name,m),seen=FG.seen(name,m);
    pr.ranks.forEach(r=>{if(!seen.includes(r)&&!FG.rankGate(pr,r,undefined,undefined,{assume:name}))n++;});
  });
  return n;
};
/* Why recruiting someone on this Part I path is worth it. Part I only. */
FG.recommendation=(name,p=store.profile())=>{
  const j=store.journey(),L=p.lord,out={unseen:0,exclusive:0,only:false,easier:false,score:0,reasons:[],recommended:false};
  if(!D.byName.has(name)||!FG.revealed(name,j))return out;
  out.unseen=FG.unseenWithCompany(name,p);
  if(out.unseen)out.reasons.push(['bond',`${out.unseen} unwatched support${out.unseen===1?'':'s'} with your company`]);
  if(j.part!==1)return out;                 /* recruiting advice is for the Part I paths */
  const sk=statusKey(FG.routeOf(name,L));
  if(!(sk==='optional'||sk==='tutorial')||FG.inCompany(name,p))return out;
  /* Supports viewable on this path but on no other Part I path. */
  (D.partners.get(name)||[]).forEach(m=>{
    const pr=FG.pair(name,m),seen=FG.seen(name,m);
    pr.ranks.forEach(r=>{if(!seen.includes(r)&&!FG.rankGate(pr,r,j,L,{pathOnly:true})&&LORDS.every(O=>O===L||FG.rankGate(pr,r,j,O,{pathOnly:true})))out.exclusive++;});
  });
  const here=FG.routeOf(name,L),others=LORDS.filter(O=>O!==L&&FG.canJoin(name,O,j)).map(O=>FG.routeOf(name,O));
  out.only=!others.length;
  if(others.length&&here.support!=null&&here.renown!=null){
    const s0=Math.min(...others.map(o=>o.support??99)),r0=Math.min(...others.map(o=>o.renown??99));
    out.easier=here.support<=s0&&here.renown<=r0&&(here.support<s0||here.renown<r0);
  }
  const pl=(n,w)=>`${n} ${w}${n===1?'':'s'}`;
  if(out.exclusive)out.reasons.push(['excl',`${pl(out.exclusive,'support')} only on ${L}’s path`]);
  if(out.only)out.reasons.push(['only',`Only joins on ${L}’s path`]);
  if(out.easier)out.reasons.push(['easy',`Easiest to recruit on ${L}’s path`]);
  if(out.reasons[0]?.[0]==='bond')out.reasons.push(out.reasons.shift());   /* the unwatched count reads best last */
  out.score=out.exclusive*4+(out.only?6:0)+(out.easier?3:0)+Math.min(out.unseen,8);
  out.recommended=out.exclusive>0||out.only||out.score>=6;
  return out;
};
FG.recommendOn=()=>FG.prefs.get('recommend')!==false;

/* Visible pairs only: both characters revealed and the pair itself not sealed. */
FG.rebuildPartners=()=>{
  D.partners=new Map();
  if(!D.supports)return;
  const j=store.journey();
  D.supports.pairs.forEach(p=>{
    if(!FG.revealed(p.a,j)||!FG.revealed(p.b,j))return;
    for(const [x,y] of [[p.a,p.b],[p.b,p.a]]){if(!D.partners.has(x))D.partners.set(x,[]);D.partners.get(x).push(y);}
  });
  const o=FG.orderIndex;D.partners.forEach(list=>list.sort((a,b)=>o(a)-o(b)));
};
/* The game's own unit order ("Details" sort). Unknown names fall back to the end, alphabetically. */
FG.orderIndex=name=>{const i=D.order?.get(name);return i===undefined?1e4:i;};
FG.byGameOrder=(a,b)=>FG.orderIndex(a)-FG.orderIndex(b)||a.localeCompare(b);
/* Who is automatically in a lord's army when a new save file starts. */
FG.startingTeam=lord=>{
  const auto=D.roster?.startingParty?.[lord];
  if(Array.isArray(auto))return auto.filter(n=>D.byName.has(n));
  return[...new Set([...FG.team(lord),...(D.roster?.characters||[]).filter(c=>/automatic team/i.test(c.routes[lord]?.status||'')).map(c=>c.name)])];
};
/* In your company = your lord, their starting team, or someone you marked recruited. */
FG.inCompany=(name,p=store.profile())=>name===p.lord||FG.team(p.lord).includes(name)||p.recruited.includes(name);
FG.seen=(a,b)=>store.supports()[FG.pairKey(a,b)]?.seen||[];
FG.nextRank=(a,b)=>{const pr=FG.pair(a,b);if(!pr)return null;const s=FG.seen(a,b);return pr.ranks.find(r=>!s.includes(r))||null;};
FG.RANK_LEVEL=RANK_LEVEL;
/* Some conversations list their own support level; otherwise C/B/A open at 2/3/4. */
FG.rankLevel=(pr,r)=>pr?.levels?.[r]||RANK_LEVEL[r];
FG.ready=Promise.all([getJSON('data/roster.json'),getJSON('data/supports.json')]).then(([roster,supports])=>{
  D.roster=roster;D.supports=supports;
  roster.characters.forEach(c=>D.byName.set(c.name,c));
  D.order=new Map((roster.order||[]).map((n,i)=>[n,i]));
  supports.pairs.forEach(p=>D.pairs.set(FG.pairKey(p.a,p.b),p));
  FG.rebuildPartners();
});
FG.mealsReady=null;
FG.loadMeals=()=>FG.mealsReady||(FG.mealsReady=getJSON('data/meals.json').then(m=>{D.meals=m;return m;}).catch(()=>{D.meals=null;return null;}));

/* ---------- Company: tri-state filters ---------- */
let tab='all',ascending=true,activeName=null;
const filterState=new Map();               // "group:key" -> 'inc' | 'exc'
/* "Later" recruits (e.g. the rivals) become ordinary optional recruits once the journey reaches their Part. */
const laterPart=rt=>{const m=String(rt?.window||'').match(/Part (I{1,3})\b/);return m?m[1].length:3;};
FG.laterPart=laterPart;
const statusKey=(rt,j=store.journey())=>!rt?'unknown':rt.sealed?'sealed':rt.status==='Yes'?'optional':rt.status==='No'?'no':rt.status==='Prologue'?'prologue':rt.status==='Later'?(j.part>=laterPart(rt)?'optional':'later'):/tutorial/i.test(rt.status)?'tutorial':'auto';
const JOINS=new Set(['optional','auto','tutorial']);
/* Can this character be in a lord's army (Part I path) at this point of the journey? */
FG.canJoin=(name,lord=FG.lord(),j=store.journey())=>JOINS.has(statusKey(FG.routeOf(name,lord,j),j));
const STATUS_LABEL={optional:'Optional recruit',auto:'Automatic team',tutorial:'Tutorial recruit',prologue:'Prologue companion',later:'Later recruit',no:'Not recruitable',sealed:'Recruitment sealed',unknown:'No data for this route'};
const STATUS_SHORT={optional:'Optional',auto:'Team',tutorial:'Tutorial',prologue:'Prologue',later:'Later',no:'No',sealed:'Sealed',unknown:'—'};
const STATUS_CLASS={optional:'s-optional',auto:'s-auto',tutorial:'s-tutorial',prologue:'s-auto',later:'s-tutorial',no:'s-no',sealed:'s-no',unknown:'s-no'};
FG.statusKey=statusKey;FG.STATUS_LABEL=STATUS_LABEL;FG.STATUS_CLASS=STATUS_CLASS;
const hasItems=rt=>!!rt&&!!rt.materials&&!/^(none listed|—|-)$/i.test(rt.materials.trim());
const hasGold=rt=>!!rt&&/\d/.test(rt.gold||'');
const hasExtra=rt=>!!rt&&Array.isArray(rt.steps)&&rt.steps.length>0;
function filterGroups(){
  const lord=FG.lord(),teamAll=[lord,...FG.team(lord)];
  return[
    {id:'status',label:'Recruitment',opts:[['optional','Optional recruit'],['auto','Automatic team'],['tutorial','Tutorial recruit'],['prologue','Prologue companion'],['later','Later recruit'],['no','Not recruitable']],test:(c,k)=>{const sk=statusKey(FG.routeOf(c.name));return sk===k||(k==='later'&&sk==='sealed');}},
    {id:'marks',label:'Your marks',opts:[['wishlist','Wishlist'],['recruited','Recruited']],test:(c,k)=>store.profile()[k].includes(c.name)},
    {id:'partner',label:`Supports with ${lord}’s team`,opts:[...teamAll.map(n=>[n,n,true]),['none','No team supports listed']],
      test:(c,k)=>k==='none'?!teamAll.some(n=>n!==c.name&&FG.pair(c.name,n)):c.name!==k&&!!FG.pair(c.name,k)},
    {id:'needs',label:'Requirements',opts:[['items','Needs items'],['gold','Needs gold'],['extra','Extra conditions']],
      test:(c,k)=>{const rt=FG.routeOf(c.name);return k==='items'?hasItems(rt):k==='gold'?hasGold(rt):hasExtra(rt);}}
  ];
}
const triLabel=s=>s==='inc'?'showing only':s==='exc'?'hidden':'not filtered';
function renderFilterGroups(){
  $('filter-groups').innerHTML=filterGroups().map(g=>`<fieldset class="tri-group"><legend>${esc(g.label)}</legend><div class="tri-row">${g.opts.map(([k,label,face])=>{
    const s=filterState.get(`${g.id}:${k}`)||'off';
    return `<button type="button" class="tri" data-f="${esc(g.id)}:${esc(k)}" data-state="${s}" aria-label="${esc(label)}: ${triLabel(s)}">`+
      `<span class="tri-mark" aria-hidden="true"><svg class="ico"><use href="#${s==='exc'?'i-ban':'i-check'}"/></svg></span>`+
      (face?`<img class="tri-face" src="${esc(FG.portrait(k))}" alt="">`:'')+`<span class="tri-text">${esc(label)}</span></button>`;}).join('')}</div></fieldset>`).join('');
}
function renderActiveFilters(){
  const labels=new Map();
  filterGroups().forEach(g=>g.opts.forEach(([k,label])=>labels.set(`${g.id}:${k}`,label)));
  const chips=[...filterState].filter(([k])=>labels.has(k)).map(([k,s])=>`<button type="button" class="af ${s}" data-clear="${esc(k)}" aria-label="Remove filter: ${esc(labels.get(k))} ${triLabel(s)}"><svg class="ico" aria-hidden="true"><use href="#${s==='exc'?'i-ban':'i-check'}"/></svg>${esc(labels.get(k))}<svg class="ico x" aria-hidden="true"><use href="#i-close"/></svg></button>`);
  const terms=$('search').value.trim().split(/\s+/).filter(t=>/^[-−]./.test(t));
  $('active-filters').innerHTML=chips.join('')+(chips.length>1?'<button type="button" class="af clear" data-clear="*">Clear all</button>':'');
  $('active-filters').hidden=!chips.length;
  const n=chips.length+terms.length+($('sort').value!=='game'||!ascending?1:0);
  $('filter-count').hidden=!n;$('filter-count').textContent=n;
}
/* Your filters, sort and recommendations switch are remembered on this device. */
function saveFilters(){FG.prefs.set('company',{f:[...filterState],sort:$('sort').value,asc:ascending});}
(()=>{const c=FG.prefs.get('company');if(!c)return;
  if(Array.isArray(c.f))c.f.forEach(([k,v])=>{if(typeof k==='string'&&(v==='inc'||v==='exc'))filterState.set(k,v);});
  if([...$('sort').options].some(o=>o.value===c.sort))$('sort').value=c.sort;
  ascending=c.asc!==false;})();
$('rec-toggle').checked=FG.recommendOn();
$('rec-toggle').addEventListener('change',e=>{FG.prefs.set('recommend',e.target.checked);render({animate:false});if($('detail').open&&activeName)showDetail(activeName,false);});
$('filter-groups').addEventListener('click',e=>{
  const b=e.target.closest('.tri');if(!b)return;
  const k=b.dataset.f,s=filterState.get(k)||'off',next={off:'inc',inc:'exc',exc:'off'}[s];
  if(next==='off')filterState.delete(k);else filterState.set(k,next);saveFilters();
  renderFilterGroups();render({animate:false});
  const nb=$('filter-groups').querySelector(`[data-f="${CSS.escape(k)}"]`);
  if(nb){nb.focus();if(!reduceMotion())nb.classList.add('bump');}
});
$('active-filters').addEventListener('click',e=>{
  const b=e.target.closest('[data-clear]');if(!b)return;
  if(b.dataset.clear==='*')filterState.clear();else filterState.delete(b.dataset.clear);saveFilters();
  renderFilterGroups();render({animate:false});
  ($('active-filters').querySelector('[data-clear]')||$('search')).focus();
});

function sortValue(c,key){
  const rt=FG.routeOf(c.name);
  if(key==='game')return FG.orderIndex(c.name);
  if(key==='recommend'){const r=FG.recommendation(c.name);return r.recommended?-r.score:r.score?1000-r.score:null;}
  if(key==='name')return c.name;
  if(key==='supports')return[FG.lord(),...FG.team()].filter(n=>n!==c.name&&FG.pair(c.name,n)).length;
  if(key==='gold'){if(!rt||rt.gold==='—')return null;const m=String(rt.gold).replaceAll(',','').match(/\d+/);return m?Number(m[0]):0;}
  if(key==='status')return rt?rt.status:null;
  return rt?rt[key]:null;
}
function filtered(){
  if(!D.roster)return[];
  const words=$('search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const inc=words.filter(w=>!/^[-−]/.test(w)),exc=words.filter(w=>/^[-−]./.test(w)).map(w=>w.slice(1));
  const groups=filterGroups(),key=$('sort').value;
  return FG.characters().filter(c=>{
    const rt=FG.routeOf(c.name),hay=`${c.name} ${rt?.materials||''}`.toLowerCase();
    if(inc.some(w=>!hay.includes(w)))return false;
    if(exc.some(w=>hay.includes(w)))return false;
    for(const g of groups){
      const ins=g.opts.filter(([k])=>filterState.get(`${g.id}:${k}`)==='inc'),exs=g.opts.filter(([k])=>filterState.get(`${g.id}:${k}`)==='exc');
      if(ins.length&&!ins.some(([k])=>g.test(c,k)))return false;
      if(exs.some(([k])=>g.test(c,k)))return false;
    }
    return true;
  }).sort((a,b)=>{
    const av=sortValue(a,key),bv=sortValue(b,key);
    if(av==null&&bv==null)return FG.byGameOrder(a.name,b.name);
    if(av==null)return 1;if(bv==null)return -1;
    const c=typeof av==='number'?av-bv:String(av).localeCompare(String(bv));
    return c*(ascending?1:-1)||FG.byGameOrder(a.name,b.name);
  });
}
const rankGem=(rank,done=false)=>`<b class="rank-gem r-${/^[ABCS]$/.test(rank)?rank:'A'}${done?' done':''}">${esc(rank)}</b>`;
FG.rankGem=rankGem;
function teamChips(name){
  const lord=FG.lord(),others=[lord,...FG.team(lord)].filter(n=>n!==name);
  const chips=others.filter(n=>FG.pair(name,n)).map(n=>{const pr=FG.pair(name,n),all=pr.ranks.every(r=>FG.seen(name,n).includes(r));return `<span class="chip${all?' complete':''}">${esc(n)} ${rankGem(pr.maxRank,all)}</span>`;});
  return chips.length?chips.join(''):'<span class="unknown">No team supports listed</span>';
}
const sealBadge='<span class="seal-badge" aria-hidden="true"><svg class="ico"><use href="#i-seal"/></svg></span>';
function cardFlags(name){
  const rec=FG.recommendation(name),on=FG.recommendOn()&&rec.recommended;
  if(!rec.unseen&&!on)return '';
  return `<span class="card-flags">`+(on?`<span class="rec-badge"><svg class="ico" aria-hidden="true"><use href="#i-spark"/></svg>Recommended</span>`:'')+
    (rec.unseen?`<span class="unseen-pill" aria-label="${rec.unseen} unwatched support${rec.unseen===1?'':'s'} with your company"><svg class="ico" aria-hidden="true"><use href="#i-bond"/></svg>${rec.unseen}</span>`:'')+`</span>`;
}
function recSection(name){
  const rec=FG.recommendation(name);
  if(!rec.reasons.length||(!FG.recommendOn()&&!rec.unseen))return '';
  const reasons=FG.recommendOn()?rec.reasons:rec.reasons.filter(([k])=>k==='bond');
  return `<dt><svg class="ico" aria-hidden="true"><use href="#i-spark"/></svg>${rec.recommended&&FG.recommendOn()?'Why recruit here':'On this path'}</dt><dd><ul class="rec-reasons">${reasons.map(([k,t])=>`<li class="rr-${k}">${esc(t)}</li>`).join('')}</ul></dd>`;
}
function cardHTML(c,i){
  const p=store.profile(),rt=FG.routeOf(c.name),sk=statusKey(rt),wished=p.wishlist.includes(c.name),recruited=p.recruited.includes(c.name),picked=selecting&&selected.has(c.name);
  return `<article class="card${recruited?' is-recruited':''}${picked?' is-picked':''}" data-name="${esc(c.name)}" style="--i:${i}">`+
    `<button class="open-card" data-open="${esc(c.name)}" ${selecting?`aria-pressed="${picked}" aria-label="Select ${esc(c.name)}"`:`aria-label="View ${esc(c.name)} details"`}>`+
      (selecting?`<span class="pick-mark" aria-hidden="true"><svg class="ico"><use href="#i-check"/></svg></span>`:'')+
      `<span class="pf"><img src="${esc(c.portrait)}" alt="" width="68" height="82" loading="lazy" decoding="async">${recruited?sealBadge:''}</span>`+
      `<span class="cardtext"><span class="card-name">${esc(c.name)}</span><span class="status ${STATUS_CLASS[sk]}">${STATUS_LABEL[sk]}</span>${recruited?'<span class="recruited-mark"><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>Recruited</span>':''}`+
      cardFlags(c.name)+
      `<span class="numbers"><span>Support lv.<b>${rt?.support??'—'}</b></span><span>Renown<b>${rt?.renown??'—'}</b></span></span></span>`+
    `</button>`+
    `<button class="star" aria-label="Wishlist ${esc(c.name)}" aria-pressed="${wished}"><svg class="ico" aria-hidden="true"><use href="#i-star"/></svg></button>`+
    `<div class="chips">${teamChips(c.name)}</div></article>`;
}
function render({animate=true}={}){
  if(!D.roster)return;
  const rows=filtered(),cards=$('cards');
  cards.classList.toggle('no-anim',!animate);
  cards.classList.toggle('selecting',selecting);
  cards.innerHTML=rows.map(cardHTML).join('');
  if(selecting)paintBulk(rows);
  $('count').textContent=`${rows.length} of ${FG.characters().length}`;
  $('empty').hidden=rows.length!==0;
  $('direction').textContent=ascending?'↑ Ascending':'↓ Descending';
  renderActiveFilters();
}
let heroPainted=false;
function updateHero(){
  const p=store.profile(),lord=p.lord;
  document.documentElement.dataset.lord=lord;
  $('hero-lord').textContent=`${lord}’s`;
  const art=$('hero-art'),cfg=HERO_ART[lord],src=`art/${lord.toLowerCase()}.webp`;
  if(art.getAttribute('src')!==src){
    art.setAttribute('src',src);
    if(heroPainted&&!reduceMotion()){const w=art.parentElement;w.classList.remove('swap');void w.offsetWidth;w.classList.add('swap');}
  }
  heroPainted=true;
  art.style.objectPosition=cfg.pos;art.style.translate=`0 ${cfg.lift}`;
  $('save-chip-name').textContent=p.name;
  $('save-chip-face').src=FG.portrait(lord);
  $('legend-lord').textContent=`Support lv. = with ${lord}`;
  if(!D.roster)return;
  const joinable=FG.characters().filter(c=>FG.canJoin(c.name));
  FG.countTo($('stat-recruitable'),joinable.filter(c=>!FG.inCompany(c.name,p)).length);
  FG.countTo($('stat-wishlist'),p.wishlist.length);
  FG.countTo($('stat-recruited'),p.recruited.length);
  const done=joinable.filter(c=>p.recruited.includes(c.name)).length;
  $('hero-bar-fill').style.setProperty('--p',(joinable.length?done/joinable.length*100:0)+'%');
}
function reset(){$('search').value='';filterState.clear();$('sort').value='game';ascending=true;saveFilters();$('view-title').textContent='The company';renderFilterGroups();render();}
$('search').addEventListener('input',()=>render({animate:false}));
$('sort').addEventListener('change',()=>{saveFilters();render();});
$('direction').onclick=()=>{ascending=!ascending;saveFilters();render();};
$('reset').onclick=reset;$('empty-reset').onclick=reset;
$('filters-toggle').onclick=()=>{
  const open=$('filters').hidden;$('filters').hidden=!open;$('filters-toggle').setAttribute('aria-expanded',String(open));
  /* The open panel scrolls with the page (not sticky), so bring its top into view. */
  if(open){const t=$('roster-toolbar').getBoundingClientRect().top;if(t<0||t>innerHeight*.5)$('roster-toolbar').scrollIntoView({block:'start',behavior:reduceMotion()?'auto':'smooth'});}
};

/* ---------- Navigation ---------- */
const VIEWS={all:'roster-view',supports:'supports-view',meals:'meals-view',missables:'missables-view',about:'about'};
const VIEW_HEADINGS={all:'hero-title',supports:'supports-heading',meals:'meals-heading',missables:'missables-heading',about:'about-title'};
function moveInk(){
  const nav=document.querySelector('.bottomnav'),ink=nav.querySelector('.nav-ink'),b=nav.querySelector('[aria-current]');
  if(!b)return;ink.style.setProperty('--x',b.offsetLeft+'px');ink.style.setProperty('--w',b.offsetWidth+'px');
  if(!ink.classList.contains('ready'))requestAnimationFrame(()=>ink.classList.add('ready'));
}
function setTab(next,moveFocus=false){
  if(next!=='all'&&selecting)setSelecting(false);
  tab=next;
  document.querySelectorAll('.bottomnav [data-tab]').forEach(b=>{if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  Object.entries(VIEWS).forEach(([k,id])=>{$(id).hidden=k!==tab;});
  if(tab==='missables')FG.onMissablesShown?.();else FG.setTheme(FG.lord());
  if(tab==='supports')FG.onSupportsShown?.();
  if(tab==='meals')FG.onMealsShown?.();
  if(tab==='about'){renderFiles();FG.onJourneyShown?.();}
  if(tab==='all')render();
  moveInk();window.scrollTo(0,0);
  const cur=document.querySelector('.bottomnav [aria-current]');if(cur&&!reduceMotion()){cur.classList.remove('hop');void cur.offsetWidth;cur.classList.add('hop');}
  FG.replayWeaves?.($(VIEWS[tab]));
  if(moveFocus){const h=$(VIEW_HEADINGS[tab]);h.tabIndex=-1;h.focus({preventScroll:true});}
}
FG.setTab=setTab;
FG.currentTab=()=>tab;
document.querySelectorAll('.bottomnav [data-tab]').forEach(button=>button.addEventListener('click',e=>setTab(button.dataset.tab,e.detail===0)));
document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>{
  filterState.clear();
  const j=button.dataset.jump;
  if(j==='wishlist'||j==='recruited')filterState.set(`marks:${j}`,'inc');
  /* Can join = recruitable right now and not already in your company. */
  if(j==='joinable')['status:no','status:later','status:prologue','status:auto','marks:recruited'].forEach(k=>filterState.set(k,'exc'));
  $('view-title').textContent={joinable:'Can join',wishlist:'Your wishlist',recruited:'Your recruits'}[j];saveFilters();
  renderFilterGroups();setTab('all');
  requestAnimationFrame(()=>document.querySelector('.listmeta').scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'}));
}));
addEventListener('resize',moveInk);
document.fonts?.ready.then(moveInk);moveInk();

const stickies=[...document.querySelectorAll('.toolbar,.route-tabs-wrap')];
let scrollRaf=0;
addEventListener('scroll',()=>{
  if(scrollRaf)return;
  scrollRaf=requestAnimationFrame(()=>{
    scrollRaf=0;
    for(const el of stickies){if(el.offsetParent===null)continue;const top=parseFloat(getComputedStyle(el).top)||0;el.classList.toggle('stuck',scrollY>40&&el.getBoundingClientRect().top<=top+.5);}
    if(!reduceMotion()&&!$('roster-view').hidden&&scrollY<600)document.querySelector('.hero-art-wrap').style.transform=`translate3d(0,${(scrollY*.28).toFixed(1)}px,0)`;
  });
},{passive:true});

/* ---------- Cards ---------- */
$('cards').addEventListener('click',e=>{
  const star=e.target.closest('.star'),open=e.target.closest('[data-open]');
  if(selecting&&open){
    const name=open.dataset.open,card=open.closest('.card'),on=!selected.has(name);
    if(on)selected.add(name);else selected.delete(name);
    card.classList.toggle('is-picked',on);open.setAttribute('aria-pressed',String(on));
    if(on&&!reduceMotion()){card.classList.remove('pick-pop');void card.offsetWidth;card.classList.add('pick-pop');}
    FG.haptic?.();paintBulk();return;
  }
  if(star){
    const name=star.closest('.card').dataset.name,added=store.toggle('wishlist',name);
    const next=[...document.querySelectorAll('.card')].find(c=>c.dataset.name===name)?.querySelector('.star');
    if(next){next.focus();if(added&&!reduceMotion()){next.classList.add('pop');setTimeout(()=>next.classList.remove('pop'),600);}}else $('view-title').focus();
    if(added)FG.toast(`${name} added to wishlist`);
  }else if(open)showDetail(open.dataset.open);
});
$('view-title').tabIndex=-1;

/* ---------- Company: select several cards and update them at once ---------- */
let selecting=false;const selected=new Set();
function paintBulk(rows){
  const shown=rows||filtered();
  const n=selected.size,bar=$('bulk-bar');
  $('bulk-count').textContent=n?`${n} selected`:'Tap cards to select';
  $('bulk-all').textContent=shown.length&&shown.every(c=>selected.has(c.name))?'Clear':'All shown';
  bar.querySelectorAll('[data-bulk]').forEach(b=>{b.disabled=!n;});
}
function setSelecting(on){
  selecting=on;selected.clear();
  $('select-toggle').setAttribute('aria-pressed',String(on));
  $('select-toggle').textContent=on?'Done':'Select';
  document.body.classList.toggle('bulk-open',on);
  $('bulk-bar').hidden=!on;
  if(on&&!reduceMotion()){const b=$('bulk-bar');b.classList.remove('rise');void b.offsetWidth;b.classList.add('rise');}
  if(on)requestAnimationFrame(()=>document.body.style.setProperty('--bulk-h',$('bulk-bar').offsetHeight+'px'));
  render({animate:false});
  if(on)paintBulk();
}
FG.setSelecting=setSelecting;
$('select-toggle').addEventListener('click',()=>setSelecting(!selecting));
$('bulk-done').addEventListener('click',()=>{setSelecting(false);$('select-toggle').focus();});
$('bulk-all').addEventListener('click',()=>{
  const shown=filtered(),all=shown.length&&shown.every(c=>selected.has(c.name));
  if(all)selected.clear();else shown.forEach(c=>selected.add(c.name));
  render({animate:false});
});
$('bulk-team').addEventListener('click',()=>{
  FG.startingTeam(FG.lord()).filter(n=>FG.revealed(n)).forEach(n=>selected.add(n));
  render({animate:false});FG.toast(`${FG.lord()}’s starting team selected`);
});
$('bulk-bar').addEventListener('click',e=>{
  const b=e.target.closest('[data-bulk]');if(!b||!selected.size)return;
  const names=[...selected],[list,on]={recruit:['recruited',true],unrecruit:['recruited',false],wish:['wishlist',true],unwish:['wishlist',false]}[b.dataset.bulk];
  const before=new Set(store.profile()[list]);
  store.setMembers(list,names,on);
  const changed=names.filter(n=>before.has(n)!==on);
  selected.clear();render({animate:false});
  /* Stamp the cards that changed, one after another. */
  if(!reduceMotion())[...document.querySelectorAll('.card')].filter(c=>changed.includes(c.dataset.name)).forEach((c,i)=>{c.style.setProperty('--k',i);c.classList.add(on?'bulk-stamp':'bulk-unstamp');setTimeout(()=>c.classList.remove('bulk-stamp','bulk-unstamp'),900+i*45);});
  FG.haptic?.('success');
  $('bulk-all').focus({preventScroll:true});
  const what={recruit:'marked recruited',unrecruit:'unmarked',wish:'added to wishlist',unwish:'removed from wishlist'}[b.dataset.bulk];
  FG.toast(changed.length?`${changed.length} ${changed.length===1?'character':'characters'} ${what}`:'Already up to date');
});

/* ---------- Character field note ---------- */
function lordTable(c){
  const cur=FG.lord();
  return `<div class="by-lord" role="table" aria-label="Requirements for each lord"><div class="bl-row bl-head" role="row"><span role="columnheader">Lord</span><span role="columnheader">Status</span><span role="columnheader">Sup.</span><span role="columnheader">Ren.</span></div>`+
    LORDS.map(l=>{const rt=FG.routeOf(c.name,l),sk=statusKey(rt);return `<div class="bl-row${l===cur?' cur':''}" role="row" data-route="${l}"><span role="cell" class="bl-lord"><img src="${esc(FG.portrait(l))}" alt="">${l}</span><span role="cell" class="status ${STATUS_CLASS[sk]}">${STATUS_SHORT[sk]}</span><span role="cell"><b>${rt?.support??'—'}</b></span><span role="cell"><b>${rt?.renown??'—'}</b></span></div>`;}).join('')+`</div>`;
}
function bondsSection(name){
  const team=FG.team();
  const partners=(D.partners.get(name)||[]).slice().sort((a,b)=>(FG.isLord(b)-FG.isLord(a))||(team.includes(b)-team.includes(a))||FG.byGameOrder(a,b));
  if(!partners.length)return '<p class="unknown">No support conversations listed.</p>';
  return `<div class="mini-bonds">${partners.map(n=>{const pr=FG.pair(name,n),s=FG.seen(name,n);return `<button type="button" class="mini-bond" data-pair="${esc(name)}|${esc(n)}"><img src="${esc(FG.portrait(n))}" alt="" loading="lazy"><span>${esc(n)}</span><span class="pips" aria-label="${s.length} of ${pr.ranks.length} viewed">${['C','B','A'].map(r=>`<i class="${!pr.ranks.includes(r)?'gap':s.includes(r)?'on':''}">${r}</i>`).join('')}</span></button>`;}).join('')}</div>`;
}
function foodSection(name){
  const m=D.meals;if(!m)return '';
  const pref=m.preferences?.[name];if(!pref)return '';
  const dish=id=>m.dishes.find(d=>d.id===id)?.name||id;
  const line=(k,label)=>pref[k]?.length?`<p class="food-line"><span class="food-tag ${k}">${label}</span>${pref[k].map(dish).map(esc).join(', ')}</p>`:'';
  const body=line('love','Loves')+line('like','Likes')+line('dislike','Dislikes');
  return body?`<dt><svg class="ico" aria-hidden="true"><use href="#i-meal"/></svg>At the table</dt><dd>${body}</dd>`:'';
}
/* Steps the guide can check for you: Part gates (journey) and paralogues marked viewed in any save file. */
function stepMet(t){
  const j=store.journey(),part=t.match(/^Reach (Part (I{1,3}))\b/);
  if(part)return j.part>=part[2].length?'reached':'';
  const para=t.match(/^Clear (.+?)’s paralogue/);
  if(para){const tag=`-paralogue-${para[1].toLowerCase().replace(/\s+/g,'-')}"`;return store.viewed().some(k=>k.includes(tag))?'cleared':'';}
  return '';
}
function recruitSteps(rt,sk){
  if(sk==='sealed')return '<span class="unknown">Sealed until later in your journey — nothing here hints at what’s ahead.</span>';
  if(!rt||sk==='no')return '<span class="unknown">Not recruitable on this route.</span>';
  const steps=rt.steps||[];
  if((sk==='auto'||sk==='prologue')&&!steps.length)return 'Joins automatically.';
  /* Levels only matter when the guide lists them (later recruits usually join without them). */
  const base=rt.support!=null||rt.renown!=null?`<li class="step-base">Reach support level <b>${rt.support??'—'}</b> with ${esc(FG.lord())} and renown <b>${rt.renown??'—'}</b></li>`:'';
  return `<ol class="steps">${base}${steps.map(t=>{const met=stepMet(t);return `<li${met?' class="met"':''}>${esc(t)}${met?`<span class="met-tag"><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>${esc(met)}</span>`:''}</li>`;}).join('')}</ol>`+(steps.length||!base?'':'<p class="note">No extra steps listed — the levels above are enough.</p>');
}
function showDetail(name,open=true){
  const c=D.byName.get(name);if(!c||!FG.revealed(name))return;
  activeName=name;const focused=document.activeElement?.id;
  const p=store.profile(),rt=FG.routeOf(name),sk=statusKey(rt),wished=p.wishlist.includes(name),recruited=p.recruited.includes(name);
  $('detail-content').innerHTML=
    `<div class="detailhero"><span class="pf"><img src="${esc(c.portrait)}" alt="${esc(name)} portrait">${recruited?sealBadge:''}</span><div><h2 id="detail-name">${esc(name)}</h2><span class="status ${STATUS_CLASS[sk]}">${STATUS_LABEL[sk]}</span><p class="route-note">On ${esc(p.lord)}’s route</p></div></div>`+
    `<div class="medallions"><div class="medal"><b>${rt?.support??'—'}</b><span>Support lv. with ${esc(p.lord)}</span></div><div class="medal"><b>${rt?.renown??'—'}</b><span>Required renown</span></div></div>`+
    (rt?.certainty==='conflict'?'<p class="warning">Guides disagree on part of this requirement — double-check in game.</p>':'')+
    `<dl class="facts">`+(rt?.window||rt?.chapter?`<dt><svg class="ico" aria-hidden="true"><use href="#i-clock"/></svg>When</dt><dd>${esc(rt.window||`From Chapter ${rt.chapter}`)}</dd>`:'')+
    (rt?.find?`<dt><svg class="ico" aria-hidden="true"><use href="#i-pin"/></svg>Where</dt><dd>${esc(rt.find)}</dd>`:'')+
    `<dt><svg class="ico" aria-hidden="true"><use href="#i-scroll"/></svg>Materials</dt><dd>${esc(rt?.materials??'—')}</dd>`+
    `<dt><svg class="ico" aria-hidden="true"><use href="#i-coin"/></svg>Gold</dt><dd>${esc(rt?.gold??'—')}</dd>`+
    recSection(name)+
    `<dt><svg class="ico" aria-hidden="true"><use href="#i-spark"/></svg>How to recruit</dt><dd>${recruitSteps(rt,sk)}</dd>`+
    `<dt><svg class="ico" aria-hidden="true"><use href="#i-company"/></svg>Every lord</dt><dd>${lordTable(c)}</dd>`+
    `<dt><svg class="ico" aria-hidden="true"><use href="#i-bond"/></svg>Support conversations</dt><dd>${bondsSection(name)}</dd>`+
    foodSection(name)+`</dl>`+
    `<p class="note">Ranks show the highest listed conversation, not recruitment levels. No entry is not confirmed absence.</p>`+
    `<div class="detailactions"><button id="detail-wishlist" class="ghostbtn" aria-pressed="${wished}">${wished?'★ Wishlisted':'☆ Wishlist'}</button>`+
    `<button id="detail-recruited" class="${recruited?'ghostbtn':'goldbtn'}" aria-pressed="${recruited}">${recruited?'✓ Recruited':'Mark recruited'}</button></div>`;
  $('detail-wishlist').onclick=()=>{if(store.toggle('wishlist',name))FG.toast(`${name} added to wishlist`);};
  $('detail-recruited').onclick=()=>{if(store.toggle('recruited',name))FG.toast(`${name} joined the company`);};
  $('detail-content').querySelectorAll('[data-pair]').forEach(b=>b.onclick=()=>{const [a,x]=b.dataset.pair.split('|');FG.openPair?.(a,x);});
  if(open){
    FG.openSheet($('detail'));
    FG.loadMeals().then(()=>{if($('detail').open&&activeName===name&&D.meals?.preferences?.[name])showDetail(name,false);});
  }else if(focused)$(focused)?.focus();
}
FG.showDetail=showDetail;
FG.wireSheet($('detail'),$('close-detail'),()=>{
  const card=[...document.querySelectorAll('.card')].find(c=>c.dataset.name===activeName);
  card?.querySelector('.open-card').focus({preventScroll:true});
});

/* ---------- Character picker (shared by Supports and Meals) ---------- */
let pickerCb=null,pickerOpts={};
FG.pickCharacter=(opts,cb)=>{
  pickerCb=cb;pickerOpts=opts||{};
  $('picker-title').textContent=pickerOpts.title||'Choose a character';
  $('picker-search').value='';renderPicker();FG.openSheet($('picker'));
  if(matchMedia('(hover:hover)').matches)setTimeout(()=>$('picker-search').focus(),60);
};
function renderPicker(){
  const q=$('picker-search').value.trim().toLowerCase();
  const names=(pickerOpts.names||FG.everyone()).filter(n=>FG.isLord(n)||FG.revealed(n)).filter(n=>!q||n.toLowerCase().includes(q)).filter(n=>!(pickerOpts.exclude||[]).includes(n));
  const group=n=>FG.isLord(n)?0:FG.inCompany(n)?1:2;
  names.sort((a,b)=>group(a)-group(b)||FG.byGameOrder(a,b));
  const label=['Lords','In your company','Everyone else'];
  let html='',last=-1;
  names.forEach(n=>{
    const g=group(n);if(g!==last){html+=`<p class="picker-group">${label[g]}</p>`;last=g;}
    html+=`<button type="button" class="pick${n===pickerOpts.current?' cur':''}" data-pick="${esc(n)}"><span class="pf sm"><img src="${esc(FG.portrait(n))}" alt="" loading="lazy"></span><span class="pick-name">${esc(n)}</span>${pickerOpts.badge?pickerOpts.badge(n):''}</button>`;
  });
  $('picker-grid').innerHTML=html||'<p class="unknown">Nobody by that name.</p>';
}
$('picker-search').addEventListener('input',renderPicker);
$('picker-grid').addEventListener('click',e=>{const b=e.target.closest('[data-pick]');if(!b)return;const cb=pickerCb;pickerCb=null;FG.closeSheet($('picker'));cb?.(b.dataset.pick);});
FG.wireSheet($('picker'),$('close-picker'),()=>{const f=pickerOpts.returnFocus;pickerOpts={};const el=typeof f==='function'?f():f;if(el&&document.contains(el))el.focus({preventScroll:true});});

/* ---------- Save files ---------- */
const ago=t=>{const s=Math.round((Date.now()-t)/1000);if(s<10)return 'just now';if(s<60)return `${s}s ago`;const m=Math.round(s/60);if(m<60)return `${m} min ago`;const h=Math.round(m/60);if(h<24)return `${h} h ago`;return new Date(t).toLocaleDateString();};
function fileStats(p){
  return `${p.recruited.length} recruited · ${p.wishlist.length} wishlisted`;
}
function fileHTML(p,active){
  return `<div class="file${active?' active':''}" data-file="${esc(p.id)}">`+
    `<button type="button" class="file-open" data-switch="${esc(p.id)}" aria-label="${active?'Current file':'Continue'}: ${esc(p.name)}"><span class="pf sm"><img src="${esc(FG.portrait(p.lord))}" alt=""></span>`+
    `<span class="file-text">${active?'<span class="file-badge">Playing</span>':''}<b>${esc(p.name)}</b><small>${esc(p.lord)}’s route · ${fileStats(p)}</small><small class="file-time">Saved ${ago(p.updatedAt)}</small></span></button>`+
    `<div class="file-actions"><button type="button" class="mini" data-rename="${esc(p.id)}" aria-label="Rename ${esc(p.name)}"><svg class="ico" aria-hidden="true"><use href="#i-edit"/></svg></button>`+
    `<button type="button" class="mini danger" data-delete="${esc(p.id)}" aria-label="Delete ${esc(p.name)}"><svg class="ico" aria-hidden="true"><use href="#i-trash"/></svg></button></div></div>`;
}
function renderFiles(){
  const cur=store.profile().id,html=store.profiles().map(p=>fileHTML(p,p.id===cur)).join('');
  $('files-list').innerHTML=html;$('files-inline').innerHTML=html;
  $('new-file-lords').innerHTML=LORDS.map(l=>`<button type="button" class="lord-btn" data-new="${l}" data-route="${l}"><span class="pf sm"><img src="${esc(FG.portrait(l))}" alt=""></span><span>${l}</span></button>`).join('');
  const h=store.health();
  $('save-health').textContent=!h.local&&!h.mirror?'Storage is blocked in this browser (Private Browsing?) — progress lasts only until you close the page.':
    `Saved automatically ${ago(h.lastSaved||Date.now())}${h.standalone?' · Home Screen app':''}${h.persisted?' · protected storage':''}.`;
}
FG.renderFiles=renderFiles;
let pendingDelete=null;
function filesClick(e){
  const sw=e.target.closest('[data-switch]'),rn=e.target.closest('[data-rename]'),del=e.target.closest('[data-delete]'),nw=e.target.closest('[data-new]');
  if(sw){
    if(sw.dataset.switch!==store.profile().id){store.switchTo(sw.dataset.switch);FG.toast(`Continuing ${store.profile().name}`);}
    if($('files').open)FG.closeSheet($('files'));
  }else if(rn){
    const id=rn.dataset.rename,row=rn.closest('.file'),p=store.profiles().find(x=>x.id===id);
    row.querySelector('.file-text b').outerHTML=`<input class="rename" value="${esc(p.name)}" maxlength="40" aria-label="Save file name">`;
    const input=row.querySelector('.rename');input.focus();input.select();
    const commit=()=>{store.rename(id,input.value);renderFiles();};
    input.addEventListener('click',ev=>ev.stopPropagation());
    input.addEventListener('keydown',ev=>{if(ev.key==='Enter'){ev.preventDefault();input.blur();}if(ev.key==='Escape'){input.value=p.name;input.blur();}});
    input.addEventListener('blur',commit,{once:true});
  }else if(del){
    const id=del.dataset.delete;
    if(store.profiles().length<2){FG.toast('Keep at least one save file');return;}
    if(pendingDelete!==id){pendingDelete=id;del.classList.add('confirm');del.setAttribute('aria-label','Tap again to delete');FG.toast('Tap the bin again to delete');setTimeout(()=>{if(pendingDelete===id){pendingDelete=null;renderFiles();}},3000);return;}
    pendingDelete=null;store.remove(id);FG.toast('Save file deleted');
  }else if(nw){
    const lord=nw.dataset.new,taken=new Set(store.profiles().map(p=>p.name));
    let name=`${lord}’s journey`,i=2;while(taken.has(name))name=`${lord}’s journey ${i++}`;
    const team=FG.startingTeam(lord);
    store.create(lord,name,team);FG.toast(team.length?`New file: ${name} · starting team recruited`:`New file: ${name}`);if($('files').open)FG.closeSheet($('files'));
  }
}
$('files-list').addEventListener('click',filesClick);
$('files-inline').addEventListener('click',filesClick);
$('new-file-lords').addEventListener('click',filesClick);
$('save-chip').addEventListener('click',()=>{renderFiles();FG.openSheet($('files'));});
FG.wireSheet($('files'),$('close-files'),()=>$('save-chip').focus({preventScroll:true}));

/* Auto-save indicator */
/* Visual only: routine saves are not announced; failures surface in #storage-warning. */
function paintSaveState(h){
  /* Saving is automatic, so the chip stays quiet unless saving actually fails. */
  const failing=!h.durable&&!h.pending,s=$('save-state');
  s.hidden=!failing;
  $('save-chip').setAttribute('aria-label',`Save file: ${store.profile().name}.${failing?' Not saved.':''} Open save files`);
  $('storage-warning').hidden=!failing;
}
store.on('saved',h=>paintSaveState(h));
store.on('health',h=>{paintSaveState(h);if(tab==='about')renderFiles();});

/* ---------- Transfer code ---------- */
const backupStatus=msg=>{$('backup-status').textContent=msg;};
$('backup-copy').addEventListener('click',async()=>{
  const code=store.exportCode();
  try{await navigator.clipboard.writeText(code);backupStatus('Code copied. Paste it into this guide on your other device.');FG.toast('Transfer code copied');}
  catch{$('backup-restore').hidden=false;$('backup-restore-toggle').setAttribute('aria-expanded','true');$('backup-input').value=code;$('backup-input').focus();$('backup-input').select();backupStatus('Copying was blocked — the code is selected above. Copy it manually.');}
});
$('backup-restore-toggle').addEventListener('click',()=>{const open=$('backup-restore').hidden;$('backup-restore').hidden=!open;$('backup-restore-toggle').setAttribute('aria-expanded',String(open));if(open)$('backup-input').focus();});
$('backup-apply').addEventListener('click',()=>{
  let n;try{n=store.importCode($('backup-input').value);}catch{backupStatus('That doesn’t look like a Field Guide code. Nothing was changed.');return;}
  backupStatus(`Added ${n} save file${n===1?'':'s'}. You’re now playing ${store.profile().name}.`);$('backup-input').value='';
});

/* ---------- React to save-file changes ---------- */
let lastLord=null;
function refreshAll(){
  const lord=FG.lord();
  FG.rebuildPartners();
  if(lord!==lastLord){
    if(lastLord!==null){for(const k of [...filterState.keys()])if(k.startsWith('partner:'))filterState.delete(k);saveFilters();}
    lastLord=lord;renderFilterGroups();
  }
  updateHero();
  if(tab!=='missables')FG.setTheme(lord);
  if(tab==='all')render({animate:false});
  if(tab==='about'||$('files').open)renderFiles();
  if(activeName&&!FG.revealed(activeName)){FG.closeSheet($('detail'));$('detail-content').innerHTML='';activeName=null;}
  else if($('detail').open&&activeName)showDetail(activeName,false);
  if($('picker').open)renderPicker();
  FG.onProfileChange.forEach(fn=>fn());
}
store.on('change',refreshAll);
store.on('change',e=>{if(e?.source==='switch')FG.wash(FG.lord(),$('files').open?$('files').querySelector('.file.active')||$('save-chip'):$('save-chip'));});
FG.setTheme(FG.lord());
FG.mountWeaves(document);FG.observeWeaves(document);
updateHero();
FG.ready.then(()=>{lastLord=FG.lord();renderFilterGroups();updateHero();render();FG.onDataReady.forEach(fn=>fn());})
  .catch(()=>{$('load-error').hidden=false;$('count').textContent='Roster unavailable';});
