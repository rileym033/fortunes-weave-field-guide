'use strict';
/* Theodora’s Field Guide — shell, roster, sheets, backup. */
const $=id=>document.getElementById(id);
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduceMotion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
const FG=window.FG={};

/* ---------- Theme (route palettes) ---------- */
const THEME_COLORS={'':'#0b272b',Cai:'#131a4a',Dietrich:'#161d2d',Theodora:'#30160e',Leda:'#3b0d16'};
FG.setTheme=name=>{
  const theme=name&&THEME_COLORS[name]?name:'';
  if(document.documentElement.dataset.theme===theme)return;
  document.documentElement.dataset.theme=theme;
  document.querySelector('meta[name="theme-color"]').setAttribute('content',THEME_COLORS[theme]);
};

/* ---------- Gold dust ---------- */
FG.seedMotes=(el,count=10)=>{
  if(!el||el.childElementCount)return;
  let html='';
  for(let i=0;i<count;i++){
    const r=Math.random;
    html+=`<i style="--x:${(r()*100).toFixed(1)}%;--s:${(2+r()*3.6).toFixed(1)}px;--d:${(8+r()*9).toFixed(1)}s;--delay:${(-r()*16).toFixed(1)}s;--dx:${Math.round(r()*70-35)}px;--o:${(.3+r()*.55).toFixed(2)}"></i>`;
  }
  el.innerHTML=html;
};
document.querySelectorAll('.motes').forEach(m=>FG.seedMotes(m));
/* Decorative loops pause whenever their banner is scrolled away. */
if('IntersectionObserver' in window){
  const io=new IntersectionObserver(entries=>entries.forEach(e=>e.target.classList.toggle('offscreen',!e.isIntersecting)));
  document.querySelectorAll('.hero,.lord-stage').forEach(el=>io.observe(el));
}

/* ---------- Toast ---------- */
let toastTimer=0;
FG.toast=message=>{
  const t=$('toast');
  t.textContent=message;t.hidden=false;
  t.style.animation='none';void t.offsetWidth;t.style.animation='';
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>{t.hidden=true;},2300);
};

/* ---------- Bottom sheets (native <dialog>, animated, drag to dismiss) ---------- */
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
  dialog.addEventListener('animationend',onEnd);
  setTimeout(done,330);
};
FG.wireSheet=(dialog,closeButton,onClose)=>{
  closeButton.addEventListener('click',()=>FG.closeSheet(dialog));
  dialog.addEventListener('cancel',e=>{e.preventDefault();FG.closeSheet(dialog);});
  dialog.addEventListener('click',e=>{
    const r=dialog.getBoundingClientRect();
    if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))FG.closeSheet(dialog);
  });
  dialog.addEventListener('close',()=>{dialog.classList.remove('closing','dragging');dialog.style.transform='';document.body.style.overflow='';onClose?.();});
  let startY=null,lastY=0,lastT=0,velocity=0;
  const down=e=>{
    if(e.button>0||e.target.closest('button,a'))return;
    startY=lastY=e.clientY;lastT=performance.now();velocity=0;
    dialog.classList.add('dragging');e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const move=e=>{
    if(startY===null)return;
    const now=performance.now();velocity=(e.clientY-lastY)/Math.max(1,now-lastT);lastY=e.clientY;lastT=now;
    dialog.style.transform=`translateY(${Math.max(0,e.clientY-startY)}px)`;
  };
  const up=e=>{
    if(startY===null)return;
    const dy=Math.max(0,e.clientY-startY);startY=null;dialog.classList.remove('dragging');
    if(dy>110||(dy>24&&velocity>.55)){FG.closeSheet(dialog);return;}
    dialog.style.transition='transform .35s cubic-bezier(.16,1,.3,1)';dialog.style.transform='';
    setTimeout(()=>{dialog.style.transition='';},380);
  };
  dialog.querySelectorAll('.sheet-grip,.dialogtop').forEach(h=>{
    h.addEventListener('pointerdown',down);h.addEventListener('pointermove',move);
    h.addEventListener('pointerup',up);h.addEventListener('pointercancel',up);
  });
};

/* ---------- Roster state ---------- */
let data=[],tab='all',ascending=true,activeName=null;
const storageKey='theodora-field-guide-v1';
let collection={wishlist:[],recruited:[]};
try{
  const saved=JSON.parse(localStorage.getItem(storageKey)||'null');
  if(saved&&Array.isArray(saved.wishlist)&&Array.isArray(saved.recruited))collection=saved;
}catch{$('storage-warning').hidden=false;}
function save(){try{localStorage.setItem(storageKey,JSON.stringify(collection));}catch{$('storage-warning').hidden=false;}}
function toggle(kind,name){
  const items=collection[kind],adding=!items.includes(name);
  collection[kind]=adding?[...items,name]:items.filter(n=>n!==name);
  save();render({animate:false});updateStats();
  if($('detail').open)showDetail(name,false);
  return adding;
}
function sortValue(r,key){
  if(key==='supports')return r.supports.length;
  if(key==='gold'){if(r.gold==='—')return null;const m=r.gold.replaceAll(',','').match(/\d+/);return m?Number(m[0]):0;}
  return r[key];
}
function filtered(){
  const query=$('search').value.trim().toLowerCase(),status=$('status').value,partner=$('partner').value,key=$('sort').value;
  return data.filter(r=>{
    if(['wishlist','recruited'].includes(tab)&&!collection[tab].includes(r.name))return false;
    if(query&&!`${r.name} ${r.materials}`.toLowerCase().includes(query))return false;
    if(status==='yes'&&r.status==='No'||status==='optional'&&r.status!=='Yes'||status==='auto'&&r.status!=='Automatic team member'||status==='no'&&r.status!=='No')return false;
    if(partner==='none'&&r.supports.length)return false;
    if(!['all','none'].includes(partner)&&!r.supports.some(s=>s.partner===partner))return false;
    return true;
  }).sort((a,b)=>{
    const av=sortValue(a,key),bv=sortValue(b,key);
    if(av==null&&bv==null)return a.name.localeCompare(b.name);
    if(av==null)return 1;if(bv==null)return -1;
    const c=typeof av==='number'?av-bv:String(av).localeCompare(String(bv));
    return c*(ascending?1:-1)||a.name.localeCompare(b.name);
  });
}
const statusInfo=r=>r.status==='Yes'?['Optional recruit','s-optional']:r.status==='No'?['Not recruitable','s-no']:/tutorial/i.test(r.status)?['Tutorial recruit','s-tutorial']:['Automatic team','s-auto'];
const rankGem=rank=>`<b class="rank-gem r-${/^[ABCS]$/.test(rank)?rank:'A'}">${esc(rank)}</b>`;
const chips=r=>r.supports.length?r.supports.map(s=>`<span class="chip">${esc(s.partner)} ${rankGem(s.rank)}</span>`).join(''):'<span class="unknown">No team supports listed</span>';
const sealBadge='<span class="seal-badge" aria-hidden="true"><svg class="ico"><use href="#i-seal"/></svg></span>';
function cardHTML(r,i){
  const [label,cls]=statusInfo(r),wished=collection.wishlist.includes(r.name),recruited=collection.recruited.includes(r.name);
  return `<article class="card${recruited?' is-recruited':''}" data-name="${esc(r.name)}" style="--i:${i}">`+
    `<button class="open-card" data-open="${esc(r.name)}" aria-label="View ${esc(r.name)} details">`+
      `<span class="pf"><img src="${r.portrait}" alt="" width="68" height="82" decoding="async">${recruited?sealBadge:''}</span>`+
      `<span class="cardtext"><h2>${esc(r.name)}</h2><span class="status ${cls}">${label}</span>${recruited?'<span class="recruited-mark"><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg>Recruited</span>':''}`+
      `<span class="numbers"><span>Support lv.<b>${r.support??'—'}</b></span><span>Renown<b>${r.renown??'—'}</b></span></span></span>`+
    `</button>`+
    `<button class="star" aria-label="Wishlist ${esc(r.name)}" aria-pressed="${wished}"><svg class="ico" aria-hidden="true"><use href="#i-star"/></svg></button>`+
    `<div class="chips">${chips(r)}</div></article>`;
}
function render({animate=true}={}){
  const rows=filtered(),cards=$('cards');
  cards.classList.toggle('no-anim',!animate);
  cards.innerHTML=rows.map(cardHTML).join('');
  $('count').textContent=`${rows.length} of ${data.length}`;
  $('empty').hidden=rows.length!==0;
  $('direction').textContent=ascending?'↑ Ascending':'↓ Descending';
  document.querySelector('.filter-dot').hidden=$('status').value==='all'&&$('partner').value==='all'&&$('sort').value==='name'&&ascending;
}
function updateStats(){
  const joinable=data.filter(r=>r.status!=='No');
  $('stat-recruitable').textContent=data.length?joinable.length:'—';
  $('stat-wishlist').textContent=collection.wishlist.length;
  $('stat-recruited').textContent=collection.recruited.length;
  const done=joinable.filter(r=>collection.recruited.includes(r.name)).length;
  $('hero-bar-fill').style.setProperty('--p',(joinable.length?done/joinable.length*100:0)+'%');
}
function reset(){$('search').value='';$('status').value='all';$('partner').value='all';$('sort').value='name';ascending=true;render();}
$('search').addEventListener('input',()=>render({animate:false}));
['status','partner','sort'].forEach(id=>$(id).addEventListener('change',()=>render()));
$('direction').onclick=()=>{ascending=!ascending;render();};
$('reset').onclick=reset;$('empty-reset').onclick=reset;
$('filters-toggle').onclick=()=>{const open=$('filters').hidden;$('filters').hidden=!open;$('filters-toggle').setAttribute('aria-expanded',String(open));};

/* ---------- Navigation ---------- */
const TITLES={all:'The company',wishlist:'Your wishlist',recruited:'Your recruits'};
function moveInk(){
  const nav=document.querySelector('.bottomnav'),ink=nav.querySelector('.nav-ink'),b=nav.querySelector('[aria-current]');
  if(!b)return;
  ink.style.setProperty('--x',b.offsetLeft+'px');ink.style.setProperty('--w',b.offsetWidth+'px');
  if(!ink.classList.contains('ready'))requestAnimationFrame(()=>ink.classList.add('ready'));
}
const VIEW_HEADINGS={all:'hero-title',wishlist:'view-title',recruited:'view-title',missables:'missables-heading',about:'about-title'};
function setTab(next,moveFocus=false){
  tab=next;
  document.querySelectorAll('.bottomnav [data-tab]').forEach(b=>{if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  $('roster-view').hidden=['about','missables'].includes(tab);
  $('missables-view').hidden=tab!=='missables';
  $('about').hidden=tab!=='about';
  if(TITLES[tab])$('view-title').textContent=TITLES[tab];
  if(tab==='missables')FG.onMissablesShown?.();else FG.setTheme('');
  if(TITLES[tab])render();
  moveInk();
  window.scrollTo(0,0);
  if(moveFocus){const h=$(VIEW_HEADINGS[tab]);h.tabIndex=-1;h.focus({preventScroll:tab!=='wishlist'&&tab!=='recruited'});}
}
document.querySelectorAll('.bottomnav [data-tab]').forEach(button=>button.addEventListener('click',e=>setTab(button.dataset.tab,e.detail===0)));
document.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>{
  setTab(button.dataset.jump);
  requestAnimationFrame(()=>document.querySelector('.listmeta').scrollIntoView({behavior:reduceMotion()?'auto':'smooth',block:'start'}));
}));
addEventListener('resize',moveInk);
document.fonts?.ready.then(moveInk);
moveInk();

/* Sticky-state shading + gentle hero parallax */
const stickies=[...document.querySelectorAll('.toolbar,.route-tabs-wrap')];
let scrollRaf=0;
addEventListener('scroll',()=>{
  if(scrollRaf)return;
  scrollRaf=requestAnimationFrame(()=>{
    scrollRaf=0;
    for(const el of stickies){
      if(el.offsetParent===null)continue;
      const top=parseFloat(getComputedStyle(el).top)||0;
      el.classList.toggle('stuck',scrollY>40&&el.getBoundingClientRect().top<=top+.5);
    }
    if(!reduceMotion()&&!$('roster-view').hidden&&scrollY<600){
      const wrap=document.querySelector('.hero-art-wrap');
      wrap.style.transform=`translate3d(0,${(scrollY*.28).toFixed(1)}px,0)`;
    }
  });
},{passive:true});

/* ---------- Cards ---------- */
$('cards').addEventListener('click',e=>{
  const star=e.target.closest('.star'),open=e.target.closest('[data-open]');
  if(star){
    const name=star.closest('.card').dataset.name,added=toggle('wishlist',name);
    const next=[...document.querySelectorAll('.card')].find(c=>c.dataset.name===name)?.querySelector('.star');
    if(next){next.focus();if(added&&!reduceMotion()){next.classList.add('pop');setTimeout(()=>next.classList.remove('pop'),600);}}
    else $('view-title').focus();
    if(added)FG.toast(`${name} added to wishlist`);
  }else if(open)showDetail(open.dataset.open);
});
$('view-title').tabIndex=-1;

/* ---------- Character detail sheet ---------- */
function showDetail(name,open=true){
  const r=data.find(x=>x.name===name);if(!r)return;
  activeName=name;const focused=document.activeElement?.id;
  const [label,cls]=statusInfo(r),wished=collection.wishlist.includes(name),recruited=collection.recruited.includes(name);
  $('detail-content').innerHTML=
    `<div class="detailhero"><span class="pf"><img src="${r.portrait}" alt="${esc(r.name)} portrait">${recruited?sealBadge:''}</span><div><h2 id="detail-name">${esc(r.name)}</h2><span class="status ${cls}">${label}</span></div></div>`+
    `<div class="medallions"><div class="medal"><b>${r.support??'—'}</b><span>Required support lv.</span></div><div class="medal"><b>${r.renown??'—'}</b><span>Required renown</span></div></div>`+
    `<dl class="facts"><dt><svg class="ico" aria-hidden="true"><use href="#i-scroll"/></svg>Materials</dt><dd>${esc(r.materials)}</dd>`+
    `<dt><svg class="ico" aria-hidden="true"><use href="#i-coin"/></svg>Gold</dt><dd>${esc(r.gold)}</dd>`+
    `<dt><svg class="ico" aria-hidden="true"><use href="#i-spark"/></svg>Other conditions</dt><dd>${esc(r.notes)}</dd>`+
    `<dt><svg class="ico" aria-hidden="true"><use href="#i-person"/></svg>Team support scenes</dt><dd class="chips">${chips(r)}</dd></dl>`+
    `<p class="note">Chips show the highest listed conversation rank, not recruitment levels. No entry is not confirmed absence. See About for source caveats.</p>`+
    `<div class="detailactions"><button id="detail-wishlist" class="ghostbtn" aria-pressed="${wished}">${wished?'★ Wishlisted':'☆ Wishlist'}</button>`+
    `<button id="detail-recruited" class="${recruited?'ghostbtn':'goldbtn'}" aria-pressed="${recruited}">${recruited?'✓ Recruited':'Mark recruited'}</button></div>`+
    `<p class="note">Saved in this browser only · No cloud sync</p>`;
  $('detail-wishlist').onclick=()=>{if(toggle('wishlist',name))FG.toast(`${name} added to wishlist`);};
  $('detail-recruited').onclick=()=>{if(toggle('recruited',name))FG.toast(`${name} joined the company`);};
  if(open)FG.openSheet($('detail'));else if(focused)$(focused)?.focus();
}
FG.wireSheet($('detail'),$('close-detail'),()=>{
  const card=[...document.querySelectorAll('.card')].find(c=>c.dataset.name===activeName);
  card?.querySelector('.open-card').focus({preventScroll:true});
});

/* ---------- Backup & restore ---------- */
const MISSABLES_KEY='theodora-missables-v1';
function makeBackup(){
  let viewedList=FG.getViewed?.();
  if(!Array.isArray(viewedList)){try{viewedList=JSON.parse(localStorage.getItem(MISSABLES_KEY)||'[]');}catch{viewedList=[];}}
  const payload={app:'theodora-field-guide',v:1,wishlist:collection.wishlist,recruited:collection.recruited,viewed:Array.isArray(viewedList)?viewedList:[]};
  return 'TFG1.'+btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}
function parseBackup(code){
  const m=String(code).replace(/\s+/g,'').match(/^TFG1\.([A-Za-z0-9+/=]{8,200000})$/);
  if(!m)throw Error('format');
  const p=JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  const strings=a=>Array.isArray(a)&&a.length<5000&&a.every(x=>typeof x==='string'&&x.length<300);
  if(!p||p.app!=='theodora-field-guide'||p.v!==1||!strings(p.wishlist)||!strings(p.recruited)||!strings(p.viewed))throw Error('shape');
  return p;
}
const backupStatus=msg=>{$('backup-status').textContent=msg;};
$('backup-copy').addEventListener('click',async()=>{
  const code=makeBackup();
  try{await navigator.clipboard.writeText(code);backupStatus('Backup code copied. Keep it somewhere safe, like Notes.');FG.toast('Backup code copied');}
  catch{
    $('backup-restore').hidden=false;$('backup-restore-toggle').setAttribute('aria-expanded','true');
    $('backup-input').value=code;$('backup-input').focus();$('backup-input').select();
    backupStatus('Copying was blocked — the code is selected above. Copy it manually.');
  }
});
$('backup-restore-toggle').addEventListener('click',()=>{
  const open=$('backup-restore').hidden;$('backup-restore').hidden=!open;
  $('backup-restore-toggle').setAttribute('aria-expanded',String(open));
  if(open)$('backup-input').focus();
});
$('backup-apply').addEventListener('click',()=>{
  let p;
  try{p=parseBackup($('backup-input').value);}catch{backupStatus('That doesn’t look like a Field Guide backup code. Nothing was changed.');return;}
  try{
    localStorage.setItem(storageKey,JSON.stringify({wishlist:p.wishlist,recruited:p.recruited}));
    localStorage.setItem(MISSABLES_KEY,JSON.stringify(p.viewed));
  }catch{backupStatus('Browser storage is unavailable, so the backup could not be saved.');return;}
  backupStatus(`Restored ${p.recruited.length} recruits, ${p.wishlist.length} wishlisted and ${p.viewed.length} viewed notes. Reloading…`);
  setTimeout(()=>location.reload(),900);
});

/* ---------- Load ---------- */
fetch('data.json').then(r=>{if(!r.ok)throw Error('Roster load failed');return r.json();})
  .then(d=>{data=d;render();updateStats();})
  .catch(()=>{$('load-error').hidden=false;$('count').textContent='Roster unavailable';})
  .finally(()=>setTimeout(()=>FG.loadMissables?.(),600));
