'use strict';
/* Missables — swipeable lord routes with per-route palettes and checklists.
   Viewed notes and the chosen route live in the active save file. */
let missables=[],routes=[],routeIndex=0,filterMode='all';
let viewed=new Set(store.profile().viewed);
let profileId=store.profile().id;
FG.onProfileChange.push(()=>{
  const p=store.profile(),switched=p.id!==profileId;
  profileId=p.id;viewed=new Set(p.viewed);
  if(!routes.length)return;
  const i=routes.indexOf(p.route);
  if(i>=0&&i!==routeIndex)selectRoute(i,{scroll:isMissablesVisible(),animate:false,persist:false});
  else renderMissables({animate:false});
  if(switched&&!isMissablesVisible())pendingScrollFix=true;
});
let pendingScrollFix=false;

const sceneKey=e=>JSON.stringify([e.route,e.id]);
const ROMAN=['I','II','III','IV','V','VI','VII','VIII'];
const ART={
  Cai:{src:'art/cai.webp',pos:'14% 50%',lift:'22%'},
  Dietrich:{src:'art/dietrich.webp',pos:'70% 50%',lift:'0%'},
  Theodora:{src:'art/theodora.webp',pos:'47% 50%',lift:'20%'},
  Leda:{src:'art/leda.webp',pos:'40% 50%',lift:'19%'}
};
const FIELDS=['location','contact','trigger','prerequisites','deadline'];
const FIELD_META={location:['Location','i-pin'],contact:['Contact','i-person'],trigger:['Trigger','i-spark'],prerequisites:['Prerequisites','i-key'],deadline:['Deadline','i-clock']};
const track=$('route-carousel'),tabs=$('route-tabs'),pager=$('route-pager'),list=$('missables-list');

const currentRoute=()=>routes[routeIndex];
const routeEntries=route=>missables.filter(e=>e.route===route).sort((a,b)=>a.chapterOrder-b.chapterOrder||a.title.localeCompare(b.title));
const routeStats=route=>{const rows=routeEntries(route);return{done:rows.filter(e=>viewed.has(sceneKey(e))).length,total:rows.length};};
const lordPortrait=route=>FG.portrait(route);
const isMissablesVisible=()=>!$('missables-view').hidden;
/* Record one mark at a time so other open tabs merge rather than overwrite. */
function persistViewed(key,on){store.update(p=>{const s=new Set(p.viewed);if(on)s.add(key);else s.delete(key);p.viewed=[...s];},{quiet:true});}

/* ---------- Stage ---------- */
function buildStage(){
  track.innerHTML=routes.map((r,i)=>{
    const art=ART[r];
    return `<div class="lord-slide" data-route="${esc(r)}" role="group" aria-roledescription="slide" aria-label="${esc(r)}’s route, ${i+1} of ${routes.length}" aria-hidden="true">`+
      (art?`<div class="lord-art-wrap"><img class="lord-art" src="${art.src}" alt="" style="object-position:${art.pos};--lift:${art.lift}" decoding="async" draggable="false"></div>`:'')+
      `<div class="lord-tint" aria-hidden="true"></div>`+
      `<div class="lord-copy"><p class="eyebrow"><span class="eyebrow-gem" aria-hidden="true"></span>Route ${ROMAN[i]||i+1} · Part I</p><p class="lord-name">${esc(r)}</p>`+
      `<div class="lord-meta"><span class="ring-wrap" aria-hidden="true"><svg class="ring" viewBox="0 0 46 46"><circle class="track" cx="23" cy="23" r="18"/><circle class="fill" cx="23" cy="23" r="18"/></svg><b class="ring-pct"></b></span><span class="lord-count"></span></div></div>`+
    `</div>`;
  }).join('');
  tabs.innerHTML=routes.map((r,i)=>{
    const face=lordPortrait(r);
    return `<button type="button" role="tab" id="route-tab-${i}" data-route="${esc(r)}" aria-selected="false" aria-controls="missables-list" tabindex="-1">`+
      `<span class="tab-face">${face?`<img src="${esc(face)}" alt="" draggable="false">`:''}</span><span>${esc(r)}</span><span class="tab-prog" aria-hidden="true"><i></i></span></button>`;
  }).join('');
  pager.innerHTML=routes.map(()=>'<i></i>').join('');
}

function updateProgress(){
  routes.forEach((r,i)=>{
    const {done,total}=routeStats(r),p=total?done/total:0,slide=track.children[i];
    if(slide){
      slide.querySelector('.ring').style.setProperty('--p',p.toFixed(4));
      slide.querySelector('.ring-pct').textContent=`${Math.round(p*100)}%`;
      slide.querySelector('.lord-count').innerHTML=`<b>${done} of ${total}</b>notes viewed`;
    }
    tabs.children[i]?.querySelector('.tab-prog i').style.setProperty('--p',(p*100).toFixed(1)+'%');
  });
  const route=currentRoute();if(!route)return;
  const {done,total}=routeStats(route);
  $('missables-progress').textContent=`${done} of ${total} viewed`;
  $('missables-bar-fill').style.setProperty('--p',(total?done/total*100:0)+'%');
}

/* Parallax: art drifts slower than the swipe, copy fades by distance. */
function paintParallax(){
  if(reduceMotion())return;
  const w=track.clientWidth||1,pos=track.scrollLeft/w;
  [...track.children].forEach((slide,i)=>{
    const off=Math.max(-1.2,Math.min(1.2,i-pos));
    const art=slide.querySelector('.lord-art-wrap'),copy=slide.querySelector('.lord-copy');
    if(art)art.style.transform=`translate3d(${(off*-38).toFixed(2)}%,0,0)`;
    if(copy){copy.style.transform=`translate3d(${(off*60).toFixed(1)}px,0,0)`;copy.style.opacity=String(Math.max(0,1-Math.abs(off)*1.6));}
  });
}

function selectRoute(index,{scroll=true,animate=true,persist=true}={}){
  index=Math.max(0,Math.min(routes.length-1,index));
  const changed=index!==routeIndex;
  routeIndex=index;
  const route=currentRoute();
  if(persist&&isMissablesVisible()&&store.profile().route!==route)store.update(p=>{p.route=route;},{quiet:true});
  [...tabs.children].forEach((t,i)=>{t.setAttribute('aria-selected',String(i===index));t.tabIndex=i===index?0:-1;});
  [...pager.children].forEach((d,i)=>d.classList.toggle('on',i===index));
  [...track.children].forEach((s,i)=>{
    s.classList.toggle('is-active',i===index);
    if(i===index)s.removeAttribute('aria-hidden');else s.setAttribute('aria-hidden','true');
    if(i===index&&changed&&animate&&!reduceMotion()){s.classList.remove('flash');void s.offsetWidth;s.classList.add('flash');}
  });
  $('route-prev').disabled=index===0;$('route-next').disabled=index===routes.length-1;
  list.setAttribute('aria-labelledby',`route-tab-${index}`);
  if(isMissablesVisible())FG.setTheme(route);
  if(changed)$('route-status').textContent=`${route}’s route`;
  renderMissables({animate:changed&&animate});
  if(scroll)scrollToIndex(index,animate);
}

let programmaticUntil=0;
function scrollToIndex(index,smooth=true){
  const left=index*track.clientWidth;
  if(Math.abs(track.scrollLeft-left)<2)return;
  programmaticUntil=performance.now()+(smooth?900:80);
  track.scrollTo({left,behavior:smooth&&!reduceMotion()?'smooth':'auto'});
}

let scrollRafM=0,settleTimer=0;
track.addEventListener('scroll',()=>{
  if(!isMissablesVisible())return;
  if(!scrollRafM)scrollRafM=requestAnimationFrame(()=>{
    scrollRafM=0;paintParallax();
    if(performance.now()<programmaticUntil)return;
    const i=Math.round(track.scrollLeft/(track.clientWidth||1));
    if(i!==routeIndex)selectRoute(i,{scroll:false});
  });
  clearTimeout(settleTimer);
  settleTimer=setTimeout(()=>{
    if(!isMissablesVisible())return;
    programmaticUntil=0;
    const i=Math.round(track.scrollLeft/(track.clientWidth||1));
    if(i!==routeIndex)selectRoute(i,{scroll:false});
  },160);
},{passive:true});
addEventListener('resize',()=>{if(isMissablesVisible()){scrollToIndex(routeIndex,false);paintParallax();}});

track.addEventListener('keydown',e=>{
  if(e.key==='ArrowRight'){e.preventDefault();selectRoute(routeIndex+1);}
  else if(e.key==='ArrowLeft'){e.preventDefault();selectRoute(routeIndex-1);}
});
/* At the first/last lord a sideways swipe has nothing to scroll; cancel it so the
   browser cannot turn it into back/forward navigation. Vertical drags are untouched. */
let edgeTouch=null;
track.addEventListener('touchstart',e=>{
  const t=e.touches[0],max=track.scrollWidth-track.clientWidth;
  edgeTouch=e.touches.length===1?{x:t.clientX,y:t.clientY,atStart:track.scrollLeft<=1,atEnd:track.scrollLeft>=max-1}:null;
},{passive:true});
track.addEventListener('touchmove',e=>{
  if(!edgeTouch||!e.cancelable)return;
  const t=e.touches[0],dx=t.clientX-edgeTouch.x,dy=t.clientY-edgeTouch.y;
  if(Math.abs(dx)<=Math.abs(dy))return;
  if((dx>0&&edgeTouch.atStart&&track.scrollLeft<=1)||(dx<0&&edgeTouch.atEnd&&track.scrollLeft>=track.scrollWidth-track.clientWidth-1))e.preventDefault();
},{passive:false});
track.addEventListener('touchend',()=>{edgeTouch=null;},{passive:true});
$('route-prev').addEventListener('click',()=>selectRoute(routeIndex-1));
$('route-next').addEventListener('click',()=>selectRoute(routeIndex+1));
tabs.addEventListener('click',e=>{const t=e.target.closest('[role="tab"]');if(t)selectRoute([...tabs.children].indexOf(t));});
tabs.addEventListener('keydown',e=>{
  const keys={ArrowRight:routeIndex+1,ArrowLeft:routeIndex-1,Home:0,End:routes.length-1};
  if(!(e.key in keys))return;
  e.preventDefault();selectRoute(keys[e.key]);tabs.children[routeIndex]?.focus();
});

FG.onMissablesShown=()=>{
  FG.loadMissables();
  if(routes.length){
    const i=routes.indexOf(store.profile().route);
    if(i>=0&&i!==routeIndex)selectRoute(i,{scroll:false,animate:false,persist:false});
    programmaticUntil=performance.now()+400;pendingScrollFix=false;
  }
  const route=currentRoute();
  if(route)FG.setTheme(route);
  requestAnimationFrame(()=>{scrollToIndex(routeIndex,false);paintParallax();});
};

/* ---------- Checklist ---------- */
function rowHTML(e,i){
  const done=viewed.has(sceneKey(e)),para=e.type==='paralogue';
  return `<article class="missable-row${para?' paralogue':''}${done?' is-viewed':''}" data-id="${esc(e.id)}" style="--i:${i}">`+
    `<label class="missable-check"><input type="checkbox" aria-label="Viewed: ${esc(e.title)}"${done?' checked':''}><span class="seal" aria-hidden="true"><svg class="ico"><use href="#i-check"/></svg></span></label>`+
    `<button class="missable-title">${para&&e.portrait?`<span class="p-face"><img src="${esc(e.portrait)}" alt="${esc(e.owner)} portrait" width="40" height="46"></span>`:''}`+
    `<span><span class="t-text">${esc(e.title)}</span>${para?'<small>Paralogue</small>':''}</span></button>`+
    `<span class="missable-more" aria-hidden="true"><svg class="ico"><use href="#i-chev-r"/></svg></span></article>`;
}
function renderMissables({animate=true}={}){
  const route=currentRoute();if(!route)return;
  const routeRows=routeEntries(route);
  const rows=routeRows.filter(e=>filterMode==='all'||!viewed.has(sceneKey(e)));
  updateProgress();
  $('missables-empty').hidden=rows.length>0;
  $('missables-empty').textContent=routeRows.length?'All listed notes viewed.':'No verified notes available for this route. This does not confirm there are none.';
  const groups=[];
  rows.forEach(e=>{const g=groups[groups.length-1];if(g&&g.chapter===e.chapter)g.rows.push(e);else groups.push({chapter:e.chapter,rows:[e]});});
  let i=0;
  list.classList.toggle('no-anim',!animate);
  list.innerHTML=groups.map(g=>`<section class="chapter-group" aria-label="Chapter ${esc(g.chapter)}"><h2 class="chapter-head"><span>Chapter</span><b class="chapter-num">${esc(g.chapter)}</b><small>${g.rows.length} ${g.rows.length===1?'note':'notes'}</small></h2>${g.rows.map(e=>rowHTML(e,i++)).join('')}</section>`).join('');
}
function focusFilter(){$('missables-filter').querySelector('[aria-pressed="true"]')?.focus();}

list.addEventListener('change',event=>{
  const input=event.target;if(!input.matches('.missable-check input'))return;
  const row=input.closest('.missable-row');
  const entry=row&&missables.find(e=>e.route===currentRoute()&&e.id===row.dataset.id);if(!entry)return;
  const key=sceneKey(entry);
  if(input.checked)viewed.add(key);else viewed.delete(key);
  persistViewed(key,input.checked);
  row.classList.toggle('is-viewed',input.checked);
  row.classList.remove('just-sealed');
  if(input.checked&&!reduceMotion()){void row.offsetWidth;row.classList.add('just-sealed');}
  updateProgress();
  const {done,total}=routeStats(currentRoute());
  if(input.checked&&total&&done===total)FG.toast(`${currentRoute()}’s notes complete ✦`);
  if(filterMode==='unviewed'&&input.checked){
    row.classList.add('missable-row-leaving');input.disabled=true;
    setTimeout(()=>{
      const hadFocus=row.contains(document.activeElement);
      renderMissables({animate:false});
      if(hadFocus)focusFilter();
    },reduceMotion()?0:300);
  }
});

let activeSceneButton=null,activeEntry=null;
function sceneDetailHTML(entry){
  const para=entry.type==='paralogue',done=viewed.has(sceneKey(entry));
  const sources=Array.isArray(entry.sources)?entry.sources.filter(url=>typeof url==='string'&&url.startsWith('https://')):[];
  return `<div class="md-tags"><span class="md-tag route">${esc(entry.route)}</span><span class="md-tag">Chapter ${esc(entry.chapter)}</span>${para?'<span class="md-tag para">Paralogue</span>':''}</div>`+
    `<div class="md-hero">${para&&entry.portrait?`<span class="p-face"><img src="${esc(entry.portrait)}" alt="${esc(entry.owner)} portrait"></span>`:''}<h2 id="missables-detail-title">${esc(entry.title)}</h2></div>`+
    (entry.certainty==='uncertain'?'<p class="warning">Uncertain — requirements need confirmation.</p>':'')+
    `<dl class="facts">${FIELDS.map(f=>`<dt><svg class="ico" aria-hidden="true"><use href="#${FIELD_META[f][1]}"/></svg>${FIELD_META[f][0]}</dt><dd>${esc(entry[f]||'Not verified')}</dd>`).join('')}</dl>`+
    `<div class="md-actions"><button type="button" id="missables-detail-toggle" class="${done?'ghostbtn':'goldbtn'}" aria-pressed="${done}">${done?'✓ Viewed · tap to undo':'Mark as viewed'}</button></div>`+
    (sources.length?`<details class="missable-sources"><summary>Sources — unfiltered pages may contain spoilers</summary><ul>${sources.map((url,i)=>`<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source ${i+1}</a></li>`).join('')}</ul></details>`:'');
}
function bindDetailToggle(entry){
  $('missables-detail-toggle').onclick=()=>{
    const key=sceneKey(entry),now=!viewed.has(key);
    if(now)viewed.add(key);else viewed.delete(key);
    persistViewed(key,now);
    renderMissables({animate:false});
    const replacement=[...list.querySelectorAll('.missable-row')].find(r=>r.dataset.id===entry.id);
    activeSceneButton=replacement?.querySelector('.missable-title')||null;
    $('missables-detail-content').innerHTML=sceneDetailHTML(entry);
    bindDetailToggle(entry);
    $('missables-detail-toggle').focus();
    if(now)FG.toast('Marked as viewed');
  };
}
function openSceneDetail(entry,button){
  activeSceneButton=button;activeEntry=entry;
  $('missables-detail-content').innerHTML=sceneDetailHTML(entry);
  bindDetailToggle(entry);
  FG.openSheet($('missables-detail'));
}
list.addEventListener('click',event=>{
  const button=event.target.closest('.missable-title');if(!button)return;
  const entry=missables.find(e=>e.route===currentRoute()&&e.id===button.closest('.missable-row').dataset.id);
  if(entry)openSceneDetail(entry,button);
});
FG.wireSheet($('missables-detail'),$('close-missables'),()=>{(activeSceneButton&&document.contains(activeSceneButton)?activeSceneButton:focusFilter())?.focus?.({preventScroll:true});});

$('missables-filter').addEventListener('click',e=>{
  const b=e.target.closest('[data-filter]');if(!b||b.disabled)return;
  filterMode=b.dataset.filter;
  $('missables-filter').querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  renderMissables();
});

/* ---------- Load ---------- */
$('missables-progress').textContent='Opening field notes…';
const filterButtons=[...$('missables-filter').querySelectorAll('button')];
filterButtons.forEach(b=>{b.disabled=true;});
let missablesRequested=false;
FG.loadMissables=()=>{
 if(missablesRequested)return;
 missablesRequested=true;
 fetch('./missables.json').then(r=>{if(!r.ok)throw Error('Notes unavailable');return r.json();}).then(d=>{
  if(!Array.isArray(d.routes)||!Array.isArray(d.entries)||!Array.isArray(d.coverageNotes)||!d.entries.every(e=>e&&typeof e.id==='string'&&typeof e.route==='string'&&typeof e.title==='string'&&typeof e.chapter==='string'&&Number.isFinite(e.chapterOrder)&&['scene','paralogue'].includes(e.type)))throw Error('Invalid notes');
  missables=d.entries;
  routes=d.routes.filter(r=>typeof r==='string');
  if(!routes.length)routes=[...new Set(missables.map(e=>e.route))];
  buildStage();
  const want=store.profile().route,start=routes.indexOf(want)>=0?routes.indexOf(want):Math.max(0,routes.indexOf(FG.lord()));
  routeIndex=-1;
  selectRoute(start,{scroll:false,animate:false,persist:false});
  if(isMissablesVisible())FG.onMissablesShown();
  $('missables-coverage').textContent=d.coverageNotes.join(' ');
  filterButtons.forEach(b=>{b.disabled=false;});
}).catch(()=>{$('missables-load-error').hidden=false;$('missables-progress').textContent='Notes unavailable';});
};
if(isMissablesVisible())FG.loadMissables();
