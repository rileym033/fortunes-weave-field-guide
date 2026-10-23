'use strict';
/* Supports — track support conversations between any two characters. */
(function(){
const store=FG.store,D=FG.data;
let focus=null,mode='next',companyOnly=false,pairA=null,pairB=null,pairReturn=null;
const lvlFor=r=>FG.RANK_LEVEL[r];
const levelOf=(a,b)=>store.profile().supports[FG.pairKey(a,b)]?.level??null;

function setSeen(a,b,rank,on){
  const pr=FG.pair(a,b);if(!pr)return;
  const idx=pr.ranks.indexOf(rank);
  store.update(p=>{
    const key=FG.pairKey(a,b),cur=p.supports[key]||{seen:[],level:null};
    let seen=new Set(cur.seen);
    // Watching a rank implies the earlier ones; un-watching clears the later ones.
    pr.ranks.forEach((r,i)=>{if(on&&i<=idx)seen.add(r);if(!on&&i>=idx)seen.delete(r);});
    cur.seen=pr.ranks.filter(r=>seen.has(r));
    if(cur.seen.length||cur.level!==null)p.supports[key]=cur;else delete p.supports[key];
  });
}
function setLevel(a,b,level){
  store.update(p=>{
    const key=FG.pairKey(a,b),cur=p.supports[key]||{seen:[],level:null};
    cur.level=level;
    if(cur.seen.length||cur.level!==null)p.supports[key]=cur;else delete p.supports[key];
  });
}
FG.setSupportSeen=setSeen;

function statusLine(a,b){
  const next=FG.nextRank(a,b),lv=levelOf(a,b);
  if(!next)return {cls:'done',text:'All conversations viewed'};
  const need=lvlFor(next);
  if(lv!==null&&lv>=need)return {cls:'ready',text:`${next} ready to view · lv. ${lv}`};
  return {cls:'next',text:`Next: ${next} at lv. ${need}${lv!==null?` · now ${lv}`:''}`};
}
function pipsHTML(a,b){
  const pr=FG.pair(a,b),s=FG.seen(a,b);
  return `<div class="pips-row" role="group" aria-label="Conversations between ${esc(a)} and ${esc(b)}">${pr.ranks.map(r=>`<button type="button" class="pip r-${r}" data-rank="${r}" aria-pressed="${s.includes(r)}" aria-label="${r} conversation${s.includes(r)?', viewed':''}"><span><em>${r}</em></span></button>`).join('')}</div>`;
}
function rows(){
  if(!focus)return[];
  const team=FG.team();
  let list=(D.partners.get(focus)||[]).map(n=>({n,pr:FG.pair(focus,n),next:FG.nextRank(focus,n)}));
  if(companyOnly)list=list.filter(x=>FG.inCompany(x.n));
  if(mode==='next')list=list.filter(x=>x.next);
  if(mode==='done')list=list.filter(x=>!x.next);
  const rankOrder=r=>r?['C','B','A'].indexOf(r):9;
  list.sort((x,y)=>{
    if(mode==='next'){
      const rx=levelOf(focus,x.n)>=lvlFor(x.next)?0:1,ry=levelOf(focus,y.n)>=lvlFor(y.next)?0:1;
      if(rx!==ry)return rx-ry;
      const cx=FG.inCompany(x.n)?0:1,cy=FG.inCompany(y.n)?0:1;
      if(cx!==cy)return cx-cy;
      if(rankOrder(x.next)!==rankOrder(y.next))return rankOrder(x.next)-rankOrder(y.next);
    }
    return (FG.isLord(y.n)-FG.isLord(x.n))||(team.includes(y.n)-team.includes(x.n))||x.n.localeCompare(y.n);
  });
  return list;
}
function render(){
  if(!D.roster)return;
  if(!focus||!FG.everyone().includes(focus))focus=FG.lord();
  $('sp-focus-name').textContent=focus;
  const face=FG.portrait(focus);
  $('sp-focus-face').src=face;
  const art=FG.isLord(focus)?`art/${focus.toLowerCase()}.webp`:face;
  if($('sp-focus-art').getAttribute('src')!==art)$('sp-focus-art').setAttribute('src',art);
  $('supports-hero').classList.toggle('is-lord',FG.isLord(focus));
  $('supports-hero').dataset.route=FG.isLord(focus)?focus:'';
  const partners=D.partners.get(focus)||[];
  let total=0,done=0;partners.forEach(n=>{const pr=FG.pair(focus,n);total+=pr.ranks.length;done+=FG.seen(focus,n).length;});
  const pct=total?done/total:0;
  $('sp-ring').style.setProperty('--p',pct.toFixed(4));
  $('sp-pct').textContent=`${Math.round(pct*100)}%`;
  $('sp-progress').innerHTML=`<b>${done} of ${total}</b>conversations viewed`;
  const list=rows();
  $('sp-list').innerHTML=list.map((x,i)=>{
    const st=statusLine(focus,x.n),inC=FG.inCompany(x.n);
    return `<article class="bond${x.next?'':' complete'}${inC?'':' away'}" data-partner="${esc(x.n)}" style="--i:${i}">`+
      `<button type="button" class="bond-open" aria-label="${esc(x.n)}: ${esc(st.text)}. Open details"><span class="pf sm"><img src="${esc(FG.portrait(x.n))}" alt="" loading="lazy"></span>`+
      `<span class="bond-text"><b>${esc(x.n)}${inC?'':' <small class="guest">Guest</small>'}</b><small class="st ${st.cls}">${esc(st.text)}</small></span></button>`+
      pipsHTML(focus,x.n)+(x.next&&x.pr.hint?`<p class="hint-line"><svg class="ico" aria-hidden="true"><use href="#i-key"/></svg>${esc(x.pr.hint)}</p>`:'')+`</article>`;
  }).join('');
  $('sp-empty').hidden=list.length>0;
  $('sp-empty').textContent=!partners.length?`No support conversations are listed for ${focus}.`:mode==='done'?'Nothing fully viewed yet.':mode==='next'?'Every listed conversation here is viewed. ✦':'Nobody matches these filters.';
  const rules=D.supports?.rules;
  if(rules&&!$('sp-rules').childElementCount)$('sp-rules').innerHTML=[rules.levels,...(rules.howToRaise||[]),...(rules.caveats||[])].filter(Boolean).map(r=>`<li>${esc(r)}</li>`).join('');
}
FG.renderSupports=render;

$('sp-list').addEventListener('click',e=>{
  const row=e.target.closest('.bond');if(!row)return;
  const n=row.dataset.partner,pip=e.target.closest('.pip');
  if(pip){
    const r=pip.dataset.rank,on=pip.getAttribute('aria-pressed')!=='true';
    setSeen(focus,n,r,on);
    if(on){FG.toast(`${focus} & ${n}: ${r} viewed`);}
    const again=[...$('sp-list').querySelectorAll('.bond')].find(x=>x.dataset.partner===n);
    (again?.querySelector(`.pip[data-rank="${r}"]`)||$('sp-filter').querySelector('[aria-pressed="true"]')).focus();
    if(again&&on&&!fgReduced()){again.classList.add('sealed');}
  }else if(e.target.closest('.bond-open')){openPair(focus,n,()=>[...$('sp-list').querySelectorAll('.bond')].find(x=>x.dataset.partner===n)?.querySelector('.bond-open'));}
});
const fgReduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
$('sp-filter').addEventListener('click',e=>{
  const b=e.target.closest('[data-filter]');if(!b)return;mode=b.dataset.filter;
  $('sp-filter').querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));render();
});
$('sp-company-only').addEventListener('change',e=>{companyOnly=e.target.checked;render();});
$('sp-focus').addEventListener('click',()=>{
  FG.pickCharacter({title:'Whose bonds?',current:focus,returnFocus:$('sp-focus'),names:FG.everyone().filter(n=>(D.partners.get(n)||[]).length),
    badge:n=>{const ps=D.partners.get(n)||[];let t=0,d=0;ps.forEach(m=>{t+=FG.pair(n,m).ranks.length;d+=FG.seen(n,m).length;});return `<small class="pick-meta">${d}/${t}</small>`;}},
    name=>{focus=name;render();window.scrollTo({top:0,behavior:'auto'});});
});

/* ---------- Pair sheet ---------- */
function openPair(a,b,returnTo){pairA=a;pairB=b;const el=document.activeElement;pairReturn=returnTo||(()=>el);renderPair();FG.openSheet($('pair'));}
FG.openPair=(a,b,returnTo)=>{const wasOpen=$('detail').open;if(wasOpen)FG.closeSheet($('detail'));setTimeout(()=>openPair(a,b,returnTo||(()=>document.querySelector('.bottomnav [aria-current]'))),wasOpen?280:0);};
function renderPair(){
  const a=pairA,b=pairB,pr=FG.pair(a,b);if(!pr)return;
  const s=FG.seen(a,b),lv=levelOf(a,b),next=FG.nextRank(a,b);
  const kind={level:'Support level',story:'Story progress',recruit:'Recruitment',route:'Route',other:'Note'}[pr.hintKind]||'Note';
  $('pair-content').innerHTML=
    `<div class="pair-hero"><span class="pf"><img src="${esc(FG.portrait(a))}" alt=""></span><span class="pair-knot" aria-hidden="true"><svg class="ico"><use href="#i-bond"/></svg></span><span class="pf"><img src="${esc(FG.portrait(b))}" alt=""></span></div>`+
    `<h2 id="pair-title" class="pair-title">${esc(a)} <span>&amp;</span> ${esc(b)}</h2>`+
    `<p class="pair-sub">Highest listed: ${FG.rankGem(pr.maxRank)}${pr.certainty&&pr.certainty!=='matrix'&&pr.certainty!=='matrix+tracker'?' · <em>community-reported</em>':''}</p>`+
    `<ol class="rank-steps">${pr.ranks.map(r=>`<li class="${s.includes(r)?'on':''}${r===next?' next':''}"><button type="button" class="pip big r-${r}" data-rank="${r}" aria-pressed="${s.includes(r)}" aria-label="${r} conversation${s.includes(r)?', viewed':''}"><span><em>${r}</em></span></button><div><b>${r} conversation</b><small>${s.includes(r)?'Viewed':`Opens at support level ${lvlFor(r)}`}</small></div></li>`).join('')}</ol>`+
    (pr.hint?`<div class="hint-box"><span class="eyebrow"><svg class="ico" aria-hidden="true"><use href="#i-key"/></svg>${kind}</span><p>${esc(pr.hint)}</p></div>`:'')+
    `<div class="level-box"><div><b>Your support level</b><small>Optional — copy it from the game to see what’s ready.</small></div>`+
    `<div class="stepper" role="group" aria-label="Support level"><button type="button" class="mini" data-lv="-1" aria-label="Lower level"><svg class="ico" aria-hidden="true"><use href="#i-minus"/></svg></button><output id="pair-level" aria-live="polite">${lv===null?'—':lv}</output><button type="button" class="mini" data-lv="1" aria-label="Raise level"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button></div></div>`+
    (!FG.inCompany(a)||!FG.inCompany(b)?`<p class="note">${esc([a,b].filter(n=>!FG.inCompany(n)).join(' and '))} ${[a,b].filter(n=>!FG.inCompany(n)).length>1?'aren’t':'isn’t'} marked as in your company in this save file.</p>`:'')+
    `<div class="md-actions"><button type="button" class="goldbtn" id="pair-meal"><svg class="ico" aria-hidden="true"><use href="#i-meal"/></svg>Plan a meal for them</button></div>`;
}
$('pair-content').addEventListener('click',e=>{
  const pip=e.target.closest('.pip'),lvb=e.target.closest('[data-lv]');
  if(pip){const r=pip.dataset.rank,on=pip.getAttribute('aria-pressed')!=='true';setSeen(pairA,pairB,r,on);renderPair();$('pair-content').querySelector(`.pip[data-rank="${r}"]`)?.focus();}
  else if(lvb){
    const cur=levelOf(pairA,pairB),d=+lvb.dataset.lv;
    let next=cur===null?(d>0?1:null):cur+d;
    if(next!==null&&next<1)next=null;if(next!==null&&next>5)next=5;
    setLevel(pairA,pairB,next);renderPair();$('pair-content').querySelector(`[data-lv="${d}"]`)?.focus();
  }else if(e.target.closest('#pair-meal')){
    const a=pairA,b=pairB;pairReturn=()=>$('meals-heading');FG.closeSheet($('pair'));FG.planMeal?.([a,b]);
  }
});
FG.wireSheet($('pair'),$('close-pair'),()=>{
  if(FG.currentTab()==='supports')render();
  const el=typeof pairReturn==='function'?pairReturn():null;
  (el&&document.contains(el)?el:document.querySelector('.bottomnav [aria-current]'))?.focus({preventScroll:true});
});

FG.onSupportsShown=()=>{FG.ready.then(render);};
FG.supportsFocus=name=>{focus=name;};
let lastLord=null;
FG.onProfileChange.push(()=>{
  const l=FG.lord();if(l!==lastLord){if(lastLord!==null)focus=l;lastLord=l;}
  if(FG.currentTab()==='supports')render();
  if($('pair').open)renderPair();
});
FG.ready.then(()=>{lastLord=FG.lord();});
})();
