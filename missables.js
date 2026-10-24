'use strict';
/* Missables — swipeable lord routes with per-route palettes and checklists.
   Viewed notes and the chosen route live in the active save file. */
let missables=[],routes=[],routeIndex=0,filterMode=FG.prefs?.get('missablesFilter')==='unviewed'?'unviewed':'all';
/* Which Part the Missables tab shows. Part I keeps the per-lord carousel; the other Parts are one timeline. */
let mPart=null,partINotes='';
const PART_COPY=[
  {numeral:'✦',name:'Prologue',sub:j=>'Shared by every path'},
  {numeral:'I',name:'Part I',sub:j=>''},
  {numeral:'II',name:'Part II',sub:j=>j.warLord?`Led by ${j.warLord}`:'One lord leads'},
  {numeral:'III',name:'Part III',sub:j=>'Your whole company'}];
const isLater=()=>mPart!==null&&mPart!==1;
const laterKey=e=>JSON.stringify(['later',e.id]);
const laterViewed=()=>new Set(store.journey().viewed);
/* Viewed marks are shared by every save file (one game, one set of marks). */
let viewed=new Set(store.viewed());
let profileId=store.profile().id;
/* Only missable scenes count towards progress; paralogues and side quests are listed but not counted. */
const counts=e=>e.type==='scene';
const TYPE_TAG={paralogue:'Paralogue',quest:'Side quest'};
const dueBy=e=>{const m=String(e.deadline||'').match(/\bby (\d{1,2} [A-Z][a-z]+)/);return m?m[1]:/end of Part I, Chapter 12/.test(e.deadline||'')?'Ch. 12':'';};
const andList=a=>a.length<2?a.join(''):`${a.slice(0,-1).join(', ')} and ${a[a.length-1]}`;
/* Which kinds of Part I notes to list (remembered on this device). Scenes are always counted. */
let showTypes=new Set(FG.prefs?.get('missablesTypes')||['scene','paralogue','quest']);
FG.onProfileChange.push(()=>{
  const p=store.profile(),switched=p.id!==profileId;
  profileId=p.id;viewed=new Set(store.viewed());
  paintPartTabs();
  if(isLater()){if(isMissablesVisible())renderMissables({animate:false});return;}
  if(!routes.length)return;
  const i=routes.indexOf(p.route);
  if(i>=0&&i!==routeIndex)selectRoute(i,{scroll:isMissablesVisible(),animate:false,persist:false});
  else renderMissables({animate:false});
  if(switched&&!isMissablesVisible())pendingScrollFix=true;
});
let pendingScrollFix=false;

/* Side quests that carry over between paths (sources confirm it for ordinary requests) share one mark across paths;
   others (e.g. recruitment requests) are marked per path and show where they were done. */
const questSlug=e=>String(e.id).replace(/^[a-z]+-p1-quest-/,'');
const sceneKey=e=>e.type==='quest'&&e.persistsAcrossPaths?JSON.stringify(['quest',questSlug(e)]):JSON.stringify([e.route,e.id]);
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
const routeStats=route=>{const rows=routeEntries(route).filter(counts);return{done:rows.filter(e=>viewed.has(sceneKey(e))).length,total:rows.length};};
/* The same paralogue appears on several paths; show where it has already been cleared. */
function clearedElsewhere(e){
  if(e.type==='paralogue'&&e.owner)return missables.filter(x=>x.type==='paralogue'&&x.owner===e.owner&&x.route!==e.route&&viewed.has(sceneKey(x))).map(x=>x.route);
  if(e.type==='quest'&&!e.persistsAcrossPaths)return missables.filter(x=>x.type==='quest'&&x.route!==e.route&&questSlug(x)===questSlug(e)&&viewed.has(sceneKey(x))).map(x=>x.route);
  return[];
}
/* Where a side quest was done (marks are shared by quest, so this just names the path it was ticked on). */
const otherPathsWith=e=>e.type==='quest'?missables.filter(x=>x.type==='quest'&&x.route!==e.route&&questSlug(x)===questSlug(e)).map(x=>x.route):[];
const lordPortrait=route=>FG.portrait(route);
const isMissablesVisible=()=>!$('missables-view').hidden;
/* Record one mark at a time so other open tabs merge rather than overwrite. */
function persistViewed(key,on){store.setViewed(key,on);}

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
      slide.querySelector('.lord-count').innerHTML=`<b>${done} of ${total}</b>scenes viewed`;
    }
    tabs.children[i]?.querySelector('.tab-prog i').style.setProperty('--p',(p*100).toFixed(1)+'%');
  });
  const route=currentRoute();if(!route)return;
  const {done,total}=routeStats(route);
  $('missables-progress').textContent=`${done} of ${total} scenes viewed`;
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
  if(isMissablesVisible()&&!isLater())FG.setTheme(route);
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
  if(mPart===null)mPart=store.journey().part;
  paintPartTabs();applyPart({animate:false});
  if(isLater())return;
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
function elsewhereHTML(e){
  const at=clearedElsewhere(e);if(!at.length)return '';
  const verb=e.type==='quest'?'Done':'Cleared';
  return `<span class="cleared-elsewhere" aria-label="${verb} on ${esc(at.join(' and '))}’s path"><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>${verb} on ${at.map(r=>`<img src="${esc(lordPortrait(r))}" alt="">`).join('')}${esc(at.length===1?`${at[0]}’s path`:`${at.length} paths`)}</span>`;
}
function rowHTML(e,i){
  const done=viewed.has(sceneKey(e)),para=e.type==='paralogue',quest=e.type==='quest',face=para&&e.portrait?e.portrait:quest&&e.owner?FG.portrait(e.owner):'';
  return `<article class="missable-row${para?' paralogue':''}${quest?' quest':''}${done?' is-viewed':''}" data-id="${esc(e.id)}" style="--i:${i}">`+
    `<label class="missable-check"><input type="checkbox" aria-label="${quest?'Done':'Viewed'}: ${esc(e.title)}"${done?' checked':''}><span class="seal" aria-hidden="true"><svg class="ico"><use href="#i-check"/></svg></span></label>`+
    `<button class="missable-title">${face?`<span class="p-face"><img src="${esc(face)}" alt="${esc(e.owner)} portrait" width="40" height="46"></span>`:quest?'<span class="q-mark" aria-hidden="true"><svg class="ico"><use href="#i-scroll"/></svg></span>':''}`+
    `<span><span class="t-text">${esc(e.title)}</span>${TYPE_TAG[e.type]?`<small>${TYPE_TAG[e.type]}${quest&&dueBy(e)?` · by ${esc(dueBy(e))}`:''}</small>`:''}${elsewhereHTML(e)}</span></button>`+
    `<span class="missable-more" aria-hidden="true"><svg class="ico"><use href="#i-chev-r"/></svg></span></article>`;
}
function renderMissables({animate=true}={}){
  if(isLater())return renderLater({animate});
  const route=currentRoute();if(!route)return;
  const routeRows=routeEntries(route);
  paintTypeChips(routeRows);
  const rows=routeRows.filter(e=>showTypes.has(e.type)&&(filterMode==='all'||!viewed.has(sceneKey(e))));
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
  if(isLater()){
    const e=row&&(FG.data.later||[]).find(x=>x.id===row.dataset.id);if(!e)return;
    store.setSharedViewed(laterKey(e),input.checked);
    row.classList.toggle('is-viewed',input.checked);row.classList.remove('just-sealed');
    if(input.checked&&!reduceMotion()){void row.offsetWidth;row.classList.add('just-sealed');}
    laterProgress();
    if(filterMode==='unviewed'&&input.checked){row.classList.add('missable-row-leaving');input.disabled=true;setTimeout(()=>renderMissables({animate:false}),reduceMotion()?0:300);}
    return;
  }
  const entry=row&&missables.find(e=>e.route===currentRoute()&&e.id===row.dataset.id);if(!entry)return;
  const key=sceneKey(entry);
  if(input.checked)viewed.add(key);else viewed.delete(key);
  persistViewed(key,input.checked);
  row.classList.toggle('is-viewed',input.checked);
  row.classList.remove('just-sealed');
  if(input.checked&&!reduceMotion()){void row.offsetWidth;row.classList.add('just-sealed');}
  updateProgress();
  const {done,total}=routeStats(currentRoute());
  if(input.checked&&counts(entry)&&total&&done===total)FG.toast(`${currentRoute()}’s scenes complete ✦`);
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
const entryDone=e=>e.part!=null&&e.part!==1?laterViewed().has(laterKey(e)):viewed.has(sceneKey(e));
const TYPE_LABEL={scene:'Scene',paralogue:'Paralogue',recruit:'Recruitment',item:'Item',quest:'Quest'};
function sceneDetailHTML(entry){
  const para=entry.type==='paralogue',done=entryDone(entry),later=entry.part!=null&&entry.part!==1;
  if(later){
    const sources=Array.isArray(entry.sources)?entry.sources.filter(url=>typeof url==='string'&&url.startsWith('https://')):[];
    return `<div class="md-tags"><span class="md-tag part">${esc(FG.partName(entry.part))}</span>${entry.route&&entry.route!=='All'?`<span class="md-tag route">${esc(entry.route)}</span>`:''}${entry.chapter?`<span class="md-tag">Chapter ${esc(entry.chapter)}</span>`:''}<span class="md-tag${para?' para':''}">${esc(TYPE_LABEL[entry.type]||'Note')}</span></div>`+
      `<div class="md-hero">${entry.owner&&FG.portrait(entry.owner)?`<span class="p-face"><img src="${esc(FG.portrait(entry.owner))}" alt="${esc(entry.owner)} portrait"></span>`:''}<h2 id="missables-detail-title">${esc(entry.title)}</h2></div>`+
      (entry.certainty==='uncertain'?'<p class="warning">Uncertain — requirements need confirmation.</p>':'')+
      `<dl class="facts">${FIELDS.map(f=>`<dt><svg class="ico" aria-hidden="true"><use href="#${FIELD_META[f][1]}"/></svg>${FIELD_META[f][0]}</dt><dd>${esc(entry[f]||'Not verified')}</dd>`).join('')}</dl>`+
      `<div class="md-actions"><button type="button" id="missables-detail-toggle" class="${done?'ghostbtn':'goldbtn'}" aria-pressed="${done}">${done?'✓ Viewed · tap to undo':'Mark as viewed'}</button></div>`+
      (sources.length?`<details class="missable-sources"><summary>Sources — unfiltered pages may contain spoilers</summary><ul>${sources.map((url,i)=>`<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source ${i+1}</a></li>`).join('')}</ul></details>`:'');
  }
  const sources=Array.isArray(entry.sources)?entry.sources.filter(url=>typeof url==='string'&&url.startsWith('https://')):[];
  const quest=entry.type==='quest',face=para&&entry.portrait?entry.portrait:quest&&entry.owner?FG.portrait(entry.owner):'',elsewhere=clearedElsewhere(entry);
  return `<div class="md-tags"><span class="md-tag route">${esc(entry.route)}</span><span class="md-tag">Chapter ${esc(entry.chapter)}</span>${para?'<span class="md-tag para">Paralogue</span>':quest?'<span class="md-tag para">Side quest</span>':''}</div>`+
    `<div class="md-hero">${face?`<span class="p-face"><img src="${esc(face)}" alt="${esc(entry.owner)} portrait"></span>`:''}<h2 id="missables-detail-title">${esc(entry.title)}</h2></div>`+
    (elsewhere.length?`<p class="good-note"><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>Already ${quest?'done':'cleared'} on ${esc(elsewhere.map(r=>`${r}’s`).join(' and '))} path${elsewhere.length>1?'s':''}${quest?'.':' — one clear is usually enough for what it unlocks.'}</p>`:'')+
    (entry.certainty==='uncertain'?'<p class="warning">Uncertain — requirements need confirmation.</p>':'')+
    (quest&&entry.reward?`<p class="note"><b>Reward:</b> ${esc(entry.reward)}</p>`:'')+
    (quest&&otherPathsWith(entry).length?`<p class="note">Also offered on ${esc(andList(otherPathsWith(entry).map(r=>`${r}’s`)))} path${otherPathsWith(entry).length>1?'s':''}. ${entry.persistsAcrossPaths?'Completed requests carry over between paths, so one tick covers all of them.':'Guides don’t confirm this one carries over, so it’s ticked per path.'}</p>`:'')+
    `<dl class="facts">${FIELDS.map(f=>`<dt><svg class="ico" aria-hidden="true"><use href="#${FIELD_META[f][1]}"/></svg>${FIELD_META[f][0]}</dt><dd>${esc(entry[f]||'Not verified')}</dd>`).join('')}</dl>`+
    `<div class="md-actions"><button type="button" id="missables-detail-toggle" class="${done?'ghostbtn':'goldbtn'}" aria-pressed="${done}">${done?`✓ ${quest?'Done':'Viewed'} · tap to undo`:quest?'Mark as done':'Mark as viewed'}</button></div>`+
    (sources.length?`<details class="missable-sources"><summary>Sources — unfiltered pages may contain spoilers</summary><ul>${sources.map((url,i)=>`<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Source ${i+1}</a></li>`).join('')}</ul></details>`:'');
}
function bindDetailToggle(entry){
  $('missables-detail-toggle').onclick=()=>{
    const later=entry.part!=null&&entry.part!==1,now=!entryDone(entry);
    if(later)store.setSharedViewed(laterKey(entry),now);
    else{const key=sceneKey(entry);if(now)viewed.add(key);else viewed.delete(key);persistViewed(key,now);}
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
  document.querySelector('#missables-detail .dialogtop .eyebrow').textContent=`${FG.partName(entry.part??1)} · Requirements`;
  $('missables-detail-content').innerHTML=sceneDetailHTML(entry);
  bindDetailToggle(entry);
  FG.openSheet($('missables-detail'));
}
list.addEventListener('click',event=>{
  const button=event.target.closest('.missable-title');if(!button)return;
  const id=button.closest('.missable-row').dataset.id;
  const entry=isLater()?(FG.data.later||[]).find(e=>e.id===id):missables.find(e=>e.route===currentRoute()&&e.id===id);
  if(entry)openSceneDetail(entry,button);
});
FG.wireSheet($('missables-detail'),$('close-missables'),()=>{(activeSceneButton&&document.contains(activeSceneButton)?activeSceneButton:focusFilter())?.focus?.({preventScroll:true});});

$('missables-filter').addEventListener('click',e=>{
  const b=e.target.closest('[data-filter]');if(!b||b.disabled)return;
  filterMode=b.dataset.filter;FG.prefs?.set('missablesFilter',filterMode);
  $('missables-filter').querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));
  renderMissables();
});

/* ---------- Note-type chips (Part I) ---------- */
const TYPE_CHIPS=[['scene','Scenes'],['paralogue','Paralogues'],['quest','Side quests']];
function paintTypeChips(rows){
  const box=$('type-chips');if(!box)return;
  if(!box.childElementCount)box.innerHTML=TYPE_CHIPS.map(([k,l])=>`<button type="button" class="type-chip" data-type="${k}" aria-pressed="true"><span class="tc-mark" aria-hidden="true"><svg class="ico"><use href="#i-check"/></svg></span>${l}<b></b></button>`).join('');
  box.querySelectorAll('[data-type]').forEach(b=>{
    const k=b.dataset.type,n=rows.filter(e=>e.type===k).length,left=rows.filter(e=>e.type===k&&!viewed.has(sceneKey(e))).length;
    b.setAttribute('aria-pressed',String(showTypes.has(k)));b.hidden=!n;
    b.querySelector('b').textContent=left===n?n:`${left}/${n}`;
    b.setAttribute('aria-label',`${TYPE_CHIPS.find(t=>t[0]===k)[1]}: ${left} of ${n} not done${showTypes.has(k)?', shown':', hidden'}`);
  });
}
$('type-chips')?.addEventListener('click',e=>{
  const b=e.target.closest('[data-type]');if(!b)return;
  const k=b.dataset.type;if(showTypes.has(k)){if(showTypes.size>1)showTypes.delete(k);else return;}else showTypes.add(k);
  FG.prefs?.set('missablesTypes',[...showTypes]);renderMissables({animate:false});
  $('type-chips').querySelector(`[data-type="${k}"]`)?.focus();
});

/* ---------- Parts: Prologue, Part II and Part III ---------- */
const partTabs=$('part-tabs');
function paintPartTabs(){
  const j=store.journey();
  if(!partTabs.childElementCount)partTabs.innerHTML=PART_COPY.map((c,n)=>`<button type="button" role="tab" class="part-tab" id="part-tab-${n}" data-mpart="${n}" aria-selected="false" aria-controls="missables-list"><b>${c.numeral}</b><span>${c.name}</span><svg class="ico" aria-hidden="true"><use href="#i-lock"/></svg></button>`).join('');
  [...partTabs.children].forEach(t=>{
    const n=+t.dataset.mpart,sealed=n>j.part;
    t.classList.toggle('sealed',sealed);t.querySelector('.ico').style.display=sealed?'':'none';
    t.setAttribute('aria-selected',String(n===mPart));t.tabIndex=n===mPart?0:-1;
    t.setAttribute('aria-label',`${PART_COPY[n].name}${sealed?', sealed until you reach it':''}`);
    t.setAttribute('aria-controls',sealed?'sealed-card':'missables-list');
  });
}
function applyPart({animate=true}={}){
  const later=isLater(),j=store.journey(),view=$('missables-view');
  view.classList.toggle('later-part',later);
  const stage=$('part-stage');stage.hidden=!later;
  $('missables-eyebrow').textContent=later?`${PART_COPY[mPart].name} · Missable notes`:'Part I · Scenes, paralogues & quests';
  $('missables-footnote').textContent=later?'Check off viewed notes · Shared by every save file — after Part I the game is one timeline.':'Check off viewed notes · Saved automatically in this save file, separately for each route.';
  if(later){
    const c=PART_COPY[mPart];
    stage.style.setProperty('--pg',['#9fd8cf','#f0c76a','#ff7a5c','#a9b8ff'][mPart]);
    const art=mPart===2&&j.warLord&&ART[j.warLord]?`<img class="ps-art" src="${ART[j.warLord].src}" alt="" style="object-position:${ART[j.warLord].pos}" decoding="async">`:'';
    stage.innerHTML=`${art}<div class="motes" aria-hidden="true"></div><span class="ps-numeral" aria-hidden="true">${c.numeral}</span><span class="ps-name">${c.name}</span>${c.sub(j)?`<p class="ps-sub">${esc(c.sub(j))}</p>`:''}`;
    FG.seedMotes(stage.querySelector('.motes'),8);
    if(isMissablesVisible())FG.setTheme(mPart>=2&&j.warLord?j.warLord:FG.lord());
    FG.loadLater().then(()=>{if(isLater())renderLater({animate});});
  }else{
    $('sealed-card').hidden=true;list.hidden=false;filterButtons.forEach(b=>{b.disabled=!routes.length;});
    $('missables-coverage').textContent=partINotes;
    if(isMissablesVisible()&&currentRoute())FG.setTheme(currentRoute());
    if(routes.length){renderMissables({animate});requestAnimationFrame(()=>{scrollToIndex(routeIndex,false);paintParallax();});}
  }
}
function laterRows(){
  const j=store.journey();
  /* Chapter order, then the order the notes are written in (sources list them in play order). */
  const all=FG.data.later||[];
  return all.filter(e=>e.part===mPart&&FG.laterVisible(e,j)).sort((a,b)=>(+a.chapterOrder||0)-(+b.chapterOrder||0)||all.indexOf(a)-all.indexOf(b));
}
function laterProgress(){
  const rows=laterRows().filter(counts),seen=laterViewed(),done=rows.filter(e=>seen.has(laterKey(e))).length;
  $('missables-progress').textContent=rows.length?`${done} of ${rows.length} scenes viewed`:'No scenes to count in this Part';
  $('missables-bar-fill').style.setProperty('--p',(rows.length?done/rows.length*100:0)+'%');
}
function renderLater({animate=true}={}){
  const j=store.journey(),sealed=mPart>j.part,card=$('sealed-card');
  card.hidden=!sealed;list.hidden=sealed;$('part-stage').hidden=sealed;
  list.setAttribute('aria-labelledby',`part-tab-${mPart}`);
  filterButtons.forEach(b=>{b.disabled=sealed;});
  if(sealed){
    $('sealed-title').textContent=`Sealed until ${PART_COPY[mPart].name}`;
    $('sealed-text').textContent=`Your journey is at ${FG.partName(j.part)}. When you get there, update it in More — nothing here hints at what’s ahead.`;
    $('missables-progress').textContent='';$('missables-bar-fill').style.setProperty('--p','0%');$('missables-empty').hidden=true;
    $('missables-coverage').textContent='';
    FG.paintJourneyPills?.();return;
  }
  const all=laterRows(),seen=laterViewed();
  $('missables-coverage').textContent=(FG.data.laterNotes?.[String(mPart)]||[]).join(' ');
  const rows=all.filter(e=>filterMode==='all'||!seen.has(laterKey(e)));
  /* (Only scenes count towards the progress figure, as in Part I.) */
  laterProgress();
  $('missables-empty').hidden=rows.length>0;
  $('missables-empty').textContent=all.length?'All listed notes viewed.':'No verified notes for this Part yet. This does not confirm there are none.';
  const groups=[];
  rows.forEach(e=>{const g=groups[groups.length-1],ch=e.chapter||'—';if(g&&g.chapter===ch)g.rows.push(e);else groups.push({chapter:ch,rows:[e]});});
  let i=0;
  list.classList.toggle('no-anim',!animate);
  list.innerHTML=groups.map(g=>`<section class="chapter-group" aria-label="Chapter ${esc(g.chapter)}"><h2 class="chapter-head"><span>Chapter</span><b class="chapter-num">${esc(g.chapter)}</b><small>${g.rows.length} ${g.rows.length===1?'note':'notes'}</small></h2>${g.rows.map(e=>{
    const done=seen.has(laterKey(e)),para=e.type==='paralogue',face=e.owner&&FG.revealed(e.owner)?FG.portrait(e.owner):'';
    return `<article class="missable-row${para?' paralogue':''}${done?' is-viewed':''}" data-id="${esc(e.id)}" style="--i:${i++}">`+
      `<label class="missable-check"><input type="checkbox" aria-label="Viewed: ${esc(e.title)}"${done?' checked':''}><span class="seal" aria-hidden="true"><svg class="ico"><use href="#i-check"/></svg></span></label>`+
      `<button class="missable-title">${face?`<span class="p-face"><img src="${esc(face)}" alt="${esc(e.owner)} portrait" width="40" height="46"></span>`:''}`+
      `<span><span class="t-text">${esc(e.title)}</span><small>${esc([TYPE_LABEL[e.type]||'',e.route&&e.route!=='All'?e.route:''].filter(Boolean).join(' · '))}</small></span></button>`+
      `<span class="missable-more" aria-hidden="true"><svg class="ico"><use href="#i-chev-r"/></svg></span></article>`;}).join('')}</section>`).join('');
}
partTabs.addEventListener('click',e=>{
  const t=e.target.closest('[data-mpart]');if(!t)return;
  const n=+t.dataset.mpart;if(n===mPart)return;
  mPart=n;filterMode='all';$('missables-filter').querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.filter==='all')));
  paintPartTabs();applyPart();FG.haptic?.();
  if(n>store.journey().part&&!reduceMotion()){const c=$('sealed-card');c.classList.remove('shake');void c.offsetWidth;c.classList.add('shake');}
});
partTabs.addEventListener('keydown',e=>{
  const keys={ArrowRight:mPart+1,ArrowLeft:mPart-1,Home:0,End:3};if(!(e.key in keys))return;e.preventDefault();
  const n=Math.max(0,Math.min(3,keys[e.key]));partTabs.children[n].click();partTabs.children[n].focus();
});
store.on('change',e=>{
  if(activeEntry&&activeEntry.part!=null&&activeEntry.part!==1&&!FG.laterVisible(activeEntry)){FG.closeSheet($('missables-detail'));$('missables-detail-content').innerHTML='';activeEntry=null;}
  if(e?.source==='journey'||e?.source==='tab'){paintPartTabs();if(isMissablesVisible()&&isLater())applyPart({animate:false});}
});

/* ---------- Load ---------- */
$('missables-progress').textContent='Opening field notes…';
const filterButtons=[...$('missables-filter').querySelectorAll('button')];
/* Show the remembered All / Unviewed choice. */
filterButtons.forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.filter===filterMode)));
filterButtons.forEach(b=>{b.disabled=true;});
let missablesRequested=false;
FG.loadMissables=()=>{
 if(missablesRequested)return;
 missablesRequested=true;
 Promise.all([fetch(`./missables.json?v=${FG.DATA_V||'1'}`).then(r=>{if(!r.ok)throw Error('Notes unavailable');return r.json();}),
   fetch(`./data/missables-quests.json?v=${FG.DATA_V||'1'}`).then(r=>r.ok?r.json():{entries:[]}).catch(()=>({entries:[]}))]).then(([d,q])=>{
  if(Array.isArray(q.entries))d={...d,entries:[...d.entries,...q.entries.filter(e=>e&&e.type==='quest'&&d.routes.includes(e.route))],coverageNotes:[...d.coverageNotes,...(q.coverageNotes||[])]};
  if(!Array.isArray(d.routes)||!Array.isArray(d.entries)||!Array.isArray(d.coverageNotes)||!d.entries.every(e=>e&&typeof e.id==='string'&&typeof e.route==='string'&&typeof e.title==='string'&&typeof e.chapter==='string'&&Number.isFinite(+e.chapterOrder)&&['scene','paralogue','quest'].includes(e.type)))throw Error('Invalid notes');
  missables=d.entries;
  routes=d.routes.filter(r=>typeof r==='string');
  if(!routes.length)routes=[...new Set(missables.map(e=>e.route))];
  buildStage();
  const want=store.profile().route,start=routes.indexOf(want)>=0?routes.indexOf(want):Math.max(0,routes.indexOf(FG.lord()));
  routeIndex=-1;
  selectRoute(start,{scroll:false,animate:false,persist:false});
  if(isMissablesVisible())FG.onMissablesShown();
  partINotes=d.coverageNotes.join(' ');if(!isLater())$('missables-coverage').textContent=partINotes;
  filterButtons.forEach(b=>{b.disabled=false;});
}).catch(()=>{$('missables-load-error').hidden=false;$('missables-progress').textContent='Notes unavailable';});
};
if(isMissablesVisible())FG.loadMissables();
