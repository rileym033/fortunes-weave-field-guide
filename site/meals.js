'use strict';
/* Meals — seat three, see every pair's next conversation, get trio and guest suggestions (food is extra info). */
(function(){
const store=FG.store,D=FG.data;
const SEAT_POS=[{x:150,y:44},{x:52,y:196},{x:248,y:196}];
const PREF_SCORE={love:2,like:1,neutral:0,dislike:-2};
const PREF_ICON={love:'♥',like:'✓',neutral:'–',dislike:'✕'};
const MP=FG.prefs.get('meals')||{};
let prefsWishlist=!!MP.wishlist,recruitedOnly=!!MP.recruitedOnly,prevSeats=null,prevPairs=new Set(),wasFull=false;

/* A seated guest the journey hasn't revealed yet shows as an empty seat; the saved name is kept for later. */
const rawSeats=()=>store.profile().meal.seats.slice();
const shown=n=>!!n&&(FG.isLord(n)||(FG.data.byName.has(n)&&FG.revealed(n)));
const seats=()=>rawSeats().map(n=>shown(n)?n:null);
function setSeats(next){const raw=rawSeats();store.update(p=>{p.meal.seats=next.slice(0,3).map((n,i)=>n===null&&raw[i]&&!shown(raw[i])?raw[i]:n);});}
FG.planMeal=names=>{
  const lord=FG.lord(),want=[...new Set(names)];
  let next=want.includes(lord)||want.length>=3?want:[lord,...want];
  next=next.slice(0,3);while(next.length<3)next.push(null);
  setSeats(next);FG.setTab('meals');
};

/* What a meal would do for a pair: uses FG.pairOutlook (unwatched ranks whose window hasn't passed). */
function pairInfo(a,b){
  const o=FG.pairOutlook(a,b);
  if(!o)return{has:false,text:'No support conversations listed'};
  if(o.done)return{has:true,done:true,text:'Every listed conversation viewed',max:o.pr.maxRank};
  if(o.passed)return{has:true,done:true,passed:true,text:'Locked out — the window has passed',max:o.pr.maxRank};
  return{has:true,next:o.next,need:o.need,lv:o.lv,ready:o.ready,gate:o.gate,remaining:o.open.length,max:o.pr.maxRank,
    text:o.ready?`${o.next} ready to view`:o.gate?`Next: ${o.next} · ${o.gate.short}`:`Next: ${o.next} at support level ${o.need}${o.lv>1?` · now ${o.lv}`:''}`};
}
/* Short line for a recommendation: "Olympia: B ready", "Sirocco: C at lv. 2 (now 1)", "+2 more". */
function bondLine(n,s){
  const i=pairInfo(n,s);if(!i.has||i.done)return null;
  return{cls:i.ready?'ready':i.gate?'later':'bond',partner:s,pips:FG.rankPipsHTML(n,s),
    text:i.ready?`${i.next} ready`:i.gate?`${i.next} ${i.gate.short}`:`${i.next} at lv. ${i.need}${i.lv>1?` · now ${i.lv}`:''}`};
}
/* One row per partner: face, C·B·A gems, what's next. */
const bondRow=r=>`<div class="bond-row br-${r.cls}"><img src="${esc(FG.portrait(r.partner))}" alt=""><span class="br-name">${esc(r.partner)}</span>${r.pips}<span class="br-next">${esc(r.text)}</span></div>`;
/* How much a meal is worth for one pair. Ready-to-watch scenes first, then how many scenes are still open. */
const edgeCache=new Map();
function edge(a,b){
  const k=FG.pairKey(a,b);if(edgeCache.has(k))return edgeCache.get(k);
  const i=pairInfo(a,b),v=!i.has||i.done?0:(i.ready?12:0)+i.remaining*3+(!i.gate&&i.need-i.lv<=1?2:0)+(i.next==='C'?1:0);
  edgeCache.set(k,v);return v;
}
function prefOf(name,dishId){
  const p=D.meals?.preferences?.[name];if(!p)return null;
  for(const k of ['love','like','neutral','dislike'])if(p[k]?.includes(dishId))return k;
  return null;
}
/* Food is extra information only — it never affects who is recommended. */
function dishRanking(people){
  const m=D.meals;if(!m||!m.dishes?.length||!people.length)return[];
  return m.dishes.map(d=>{
    const reactions=people.map(n=>({n,pref:prefOf(n,d.id)}));
    const known=reactions.filter(r=>r.pref);
    const score=known.reduce((s,r)=>s+PREF_SCORE[r.pref],0);
    const perfect=reactions.length===3&&reactions.every(r=>r.pref==='love'||r.pref==='like');
    return{d,reactions,score,perfect,unknown:reactions.length-known.length};
  }).filter(x=>x.reactions.some(r=>r.pref)).sort((a,b)=>(b.perfect-a.perfect)||b.score-a.score||a.unknown-b.unknown||a.d.name.localeCompare(b.d.name));
}
/* Everyone who can sit at this table now (Eshmel never can; Guests need a gift first). */
function pool(){
  const p=store.profile();
  return FG.everyone().filter(n=>FG.mealGuest(n)).filter(n=>!recruitedOnly||FG.inCompany(n,p));
}
const wishBonus=n=>{const p=store.profile();return p.wishlist.includes(n)&&!p.recruited.includes(n)?(prefsWishlist?40:4):0;};
const companyBonus=n=>FG.inCompany(n)?1:0;
/* Trios: three people who all still have scenes with each other. With 0 or 1 seated, suggest whole trios. */
function trios(seated,limit=4){
  const P=pool().filter(n=>!seated.includes(n)),out=[];
  if(seated.length===1){
    const s=seated[0],near=P.filter(n=>edge(s,n)>0);
    for(let i=0;i<near.length;i++)for(let k=i+1;k<near.length;k++){
      const x=near[i],y=near[k],xy=edge(x,y);if(!xy)continue;
      out.push({names:[s,x,y],score:edge(s,x)+edge(s,y)+xy+wishBonus(x)+wishBonus(y)+companyBonus(x)+companyBonus(y)});
    }
  }else if(!seated.length){
    for(let i=0;i<P.length;i++)for(let k=i+1;k<P.length;k++){
      const a=P[i],b=P[k],ab=edge(a,b);if(!ab)continue;
      for(let m=k+1;m<P.length;m++){const c=P[m],ac=edge(a,c),bc=edge(b,c);if(!ac||!bc)continue;
        out.push({names:[a,b,c],score:ab+ac+bc+wishBonus(a)+wishBonus(b)+wishBonus(c)+companyBonus(a)+companyBonus(b)+companyBonus(c)});}
    }
  }
  return out.sort((x,y)=>y.score-x.score||x.names.join().localeCompare(y.names.join())).slice(0,limit);
}
/* One-at-a-time suggestions. With two seated, anyone who still has scenes with BOTH completes a trio and goes first. */
function recommend(){
  const seated=seats().filter(Boolean),p=store.profile(),lord=p.lord;
  return pool().filter(n=>!seated.includes(n)).map(n=>{
    const lines=seated.map(s=>bondLine(n,s)).filter(Boolean),links=lines.length;
    let score=seated.reduce((t,s)=>t+edge(n,s),0)+wishBonus(n)+companyBonus(n);
    const trio=seated.length===2&&links===2;
    if(trio)score+=50;
    const reasons=[...(trio?[{cls:'trio',text:'Completes a trio'}]:[])];
    if(p.wishlist.includes(n)&&!p.recruited.includes(n))reasons.push({cls:'wish',text:seated.includes(lord)?`Wishlist · needs lv. ${FG.routeOf(n)?.support??'?'} with ${lord}`:'Wishlist'});
    return{n,score,reasons,lines,trio,links,inCompany:FG.inCompany(n,p)};
  }).filter(x=>seated.length?x.links>0:x.score>0)
    .sort((a,b)=>b.score-a.score||(b.inCompany-a.inCompany)||FG.byGameOrder(a.n,b.n)).slice(0,12);
}

function renderTable(){
  const s=seats(),filled=s.filter(Boolean),first=prevSeats===null;
  $('seats').innerHTML=s.map((n,i)=>{
    const pos=SEAT_POS[i],fresh=n&&!first&&prevSeats[i]!==n;
    return `<div class="seat${n?' filled':''}${fresh?' fresh':''}" style="--x:${pos.x/3}%;--y:${pos.y/2.5}%">`+
      (n?`<button type="button" class="seat-btn" data-seat="${i}" aria-label="Seat ${i+1}: ${esc(n)}. Change"><span class="pf"><img src="${esc(FG.portrait(n))}" alt=""></span><span class="seat-name">${esc(n)}</span></button>`+
         `<button type="button" class="seat-x" data-clear-seat="${i}" aria-label="Remove ${esc(n)} from the table"><svg class="ico" aria-hidden="true"><use href="#i-close"/></svg></button>`
        :`<button type="button" class="seat-btn empty" data-seat="${i}" aria-label="Seat ${i+1}: empty. Choose a guest"><span class="pf"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></span><span class="seat-name">Empty seat</span></button>`)+
    `</div>`;
  }).join('');
  // Threads between seated guests: gold when a conversation is waiting.
  let svg='';const nowPairs=new Set();
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){
    if(!s[i]||!s[j])continue;
    const info=pairInfo(s[i],s[j]),a=SEAT_POS[i],b=SEAT_POS[j],key=FG.pairKey(s[i],s[j]);
    nowPairs.add(key);
    const cls=!info.has?'none':info.done?'done':info.ready?'ready':'open',isNew=!first&&!prevPairs.has(key);
    const mx=(a.x+b.x)/2,my=(a.y+b.y)/2+(i===0?-6:10);
    const d=`M${a.x} ${a.y} Q${(mx+150)/2} ${(my+125)/2} ${b.x} ${b.y}`;
    const solid=cls==='open'||cls==='ready';
    svg+=`<path class="thread ${cls}${isNew?(solid?' fresh':' fade'):''}" d="${d}"/>`;
    if(solid)svg+=`<circle class="spark ${cls}" r="2.6"><animateMotion dur="2.8s" ${isNew?'begin="0.9s"':''} repeatCount="indefinite" path="${d}"/></circle>`+
                  `<circle class="spark ${cls}" r="1.8" opacity=".75"><animateMotion dur="2.8s" begin="${isNew?2.3:-1.4}s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path="${d}"/></circle>`;
    if(info.has&&!info.done)svg+=`<g class="thread-gem ${cls}${isNew?' fresh':''}" transform="translate(${mx} ${my})"><g class="gem-in"><rect x="-11" y="-11" width="22" height="22" rx="4" transform="rotate(45)"/><text y="4.5" text-anchor="middle">${info.next}</text></g></g>`;
  }
  $('table-links').innerHTML=svg;
  $('table-links').querySelectorAll('.thread.fresh').forEach(t=>{try{t.style.setProperty('--len',Math.ceil(t.getTotalLength())+'');}catch{}});
  const full=s.every(Boolean);
  $('table-stage').classList.toggle('full',full);
  if(full&&!wasFull&&!first){const h=document.querySelector('.hearth');h.classList.remove('flare');void h.offsetWidth;h.classList.add('flare');}
  wasFull=full;prevSeats=s.slice();prevPairs=nowPairs;
  const pairs=[];
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)if(s[i]&&s[j])pairs.push([s[i],s[j]]);
  $('meal-pairs').innerHTML=pairs.length?pairs.map(([a,b])=>{const info=pairInfo(a,b);
    return `<button type="button" class="meal-pair ${!info.has?'none':info.passed?'passed':info.done?'done':info.ready?'ready':'open'}" data-pa="${esc(a)}" data-pb="${esc(b)}"><span class="mp-faces"><img src="${esc(FG.portrait(a))}" alt=""><img src="${esc(FG.portrait(b))}" alt=""></span><span class="mp-text"><b>${esc(a)} &amp; ${esc(b)}</b><small>${esc(info.text)}</small></span>${info.has?FG.rankPipsHTML(a,b):''}</button>`;}).join('')
    :`<p class="note center">${filled.length?'Add another guest to see how this table’s bonds line up.':'Tap a seat to invite someone.'}</p>`;
}
function trioCard(t,i,seated){
  const [a,b,c]=t.names,pairs=[[a,b],[a,c],[b,c]];
  return `<article class="trio" style="--i:${i}">`+
    `<div class="trio-faces" aria-hidden="true">${t.names.map((n,k)=>`<img src="${esc(FG.portrait(n))}" alt="" style="--k:${k}"${seated.includes(n)?' class="seated"':''}>`).join('')}<svg viewBox="0 0 60 52"><path d="M30 6 L6 46 L54 46 Z"/></svg></div>`+
    `<div class="trio-text"><b>${t.names.map(esc).join(' · ')}</b><span class="trio-tag">Trio · every pair has scenes</span>`+
    `<ul class="trio-lines">${pairs.map(([x,y])=>{const i=pairInfo(x,y);return `<li class="${i.ready?'ready':i.gate?'later':''}"><span class="tl-names">${esc(x)} &amp; ${esc(y)}</span>${FG.rankPipsHTML(x,y)}<em>${esc(i.ready?`${i.next} ready`:i.gate?`${i.next} · ${i.gate.short}`:`${i.next} at lv. ${i.need}`)}</em></li>`;}).join('')}</ul></div>`+
    `<button type="button" class="seat-trio goldbtn small" data-trio="${esc(t.names.join('|'))}" aria-label="Seat ${esc(t.names.join(', '))}">Seat</button></article>`;
}
function renderRecs(){
  edgeCache.clear();
  const seated=seats().filter(Boolean),full=seats().every(Boolean);
  const ts=full||seated.length>=2?[]:trios(seated);
  $('trio-block').hidden=!ts.length;
  $('trio-why').textContent=seated.length?`${seated[0]} plus two people who all still have support scenes with each other — every pair at the table gains.`:'Three people who all still have support scenes with each other — every pair at the table gains.';
  $('trio-list').innerHTML=ts.map((t,i)=>trioCard(t,i,seated)).join('');
  const recs=full?[]:recommend();
  $('rec-count').textContent=full?'Table full':`${recs.length} suggestions`;
  $('rec-why').textContent=full?'Remove a guest to see suggestions.':!seated.length?'Seat someone, or pick a trio above. Suggestions rank who still has support scenes with your table — scenes ready to watch first.':
    seated.length===2?`Anyone who still has scenes with both ${seated[0]} and ${seated[1]} completes a trio and comes first.`:
    `Ranked by support scenes still open with ${seated[0]} — ready-to-watch first, then how many are left.`;
  $('rec-list').innerHTML=recs.map((x,i)=>
    `<article class="rec${x.trio?' trio-pick':''}" style="--i:${i}"><button type="button" class="rec-open" data-info="${esc(x.n)}" aria-label="${esc(x.n)} field note"><span class="pf sm"><img src="${esc(FG.portrait(x.n))}" alt="" loading="lazy"></span></button>`+
    `<div class="rec-text"><b>${esc(x.n)}${x.inCompany?'':' <small class="guest">Guest</small>'}</b>${x.reasons.length?`<div class="reasons">${x.reasons.map(r=>`<span class="reason ${r.cls}">${esc(r.text)}</span>`).join('')}</div>`:''}`+
      `${x.lines.length?`<div class="bond-rows">${x.lines.map(bondRow).join('')}</div>`:''}</div>`+
    `<button type="button" class="seat-add" data-add="${esc(x.n)}" ${full?'disabled':''} aria-label="Seat ${esc(x.n)}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button></article>`).join('')||(full?'':'<p class="unknown">No one here still has open support scenes with this table.</p>');
}
/* Food is just extra information: a small, collapsed line of icons. */
function renderDishes(){
  const seated=seats().filter(Boolean),box=$('food-box');
  if(!D.meals||!D.meals.dishes?.length||seated.length<2){box.hidden=true;$('dish-list').innerHTML='';return;}
  box.hidden=false;
  const ranked=dishRanking(seated),perfect=ranked.filter(x=>x.perfect);
  $('food-sum').innerHTML=`<svg class="ico" aria-hidden="true"><use href="#i-meal"/></svg>Food${perfect.length?` · <b>${perfect.length}</b> everyone likes`:''}`;
  $('dish-list').innerHTML=ranked.slice(0,6).map(x=>
    `<div class="dish-mini${x.perfect?' perfect':''}"><span class="dm-name">${esc(x.d.name)}</span><span class="dm-faces">${x.reactions.map(r=>`<i class="dm ${r.pref||'unknown'}" title="${esc(r.n)}: ${r.pref||'unknown'}" aria-label="${esc(r.n)}: ${r.pref||'unknown'}">${r.pref?PREF_ICON[r.pref]:'?'}</i>`).join('')}</span></div>`).join('')+
    `<p class="note">Just for fun — food doesn’t change who’s recommended. ${esc(D.meals.coverage||'')}</p>`;
}
function renderRules(){
  const rules=D.meals?.rules||['Up to three meals a week at the inn, each for three characters.','A Guest must have received one of your gifts before they can be invited.','The more all three enjoy the dish, the more their bonds grow.'];
  $('meal-rules').innerHTML=rules.map(r=>`<li>${esc(r)}</li>`).join('');
}
function render(){
  if(!D.roster)return;
  renderTable();renderRecs();renderDishes();renderRules();
}

$('seats').addEventListener('click',e=>{
  const clear=e.target.closest('[data-clear-seat]'),seat=e.target.closest('[data-seat]');
  if(clear){const i=+clear.dataset.clearSeat,s=seats();s[i]=null;setSeats(s);$('seats').querySelector(`[data-seat="${i}"]`)?.focus();return;}
  if(seat){
    const i=+seat.dataset.seat,s=seats();
    const others=s.filter((n,j)=>n&&j!==i);
    FG.pickCharacter({title:`Seat ${i+1}`,current:s[i],exclude:others,names:FG.everyone().filter(n=>FG.mealGuest(n)),returnFocus:()=>$('seats').querySelector(`[data-seat="${i}"]`),
      badge:n=>{edgeCache.clear();const k=others.filter(o=>pairInfo(n,o).has&&!pairInfo(n,o).done).length;return others.length?`<small class="pick-meta${k===others.length?' all':''}">${k}/${others.length} bonds</small>`:'';}},
      name=>{const t=seats();t[i]=name;setSeats(t);});
  }
});
$('rec-list').addEventListener('click',e=>{
  const add=e.target.closest('[data-add]'),info=e.target.closest('[data-info]');
  if(add){
    const s=seats(),i=s.indexOf(null);if(i<0)return;
    const from=add.closest('.rec')?.querySelector('.rec-open img');
    s[i]=add.dataset.add;setSeats(s);FG.toast(`${add.dataset.add} takes a seat`);
    const seatBtn=$('seats').querySelector(`[data-seat="${i}"]`);
    FG.fly(from,seatBtn?.querySelector('img'));
    seatBtn?.focus({preventScroll:true});
  }
  else if(info&&FG.data.byName.has(info.dataset.info))FG.showDetail(info.dataset.info);
});
$('meal-pairs').addEventListener('click',e=>{const b=e.target.closest('[data-pa]');if(!b||!FG.pair(b.dataset.pa,b.dataset.pb))return;const pa=b.dataset.pa,pb=b.dataset.pb;
  FG.openPair(pa,pb,()=>[...$('meal-pairs').querySelectorAll('[data-pa]')].find(x=>x.dataset.pa===pa&&x.dataset.pb===pb));});
const saveMp=()=>FG.prefs.set('meals',{wishlist:prefsWishlist,recruitedOnly});
$('rec-wishlist').checked=prefsWishlist;$('rec-company').checked=recruitedOnly;
$('rec-wishlist').addEventListener('change',e=>{prefsWishlist=e.target.checked;saveMp();renderRecs();});
$('rec-company').addEventListener('change',e=>{recruitedOnly=e.target.checked;saveMp();renderRecs();});
/* Seat a whole trio: keep whoever is already seated, fill the rest. */
$('trio-list').addEventListener('click',e=>{
  const b=e.target.closest('[data-trio]');if(!b)return;
  const names=b.dataset.trio.split('|'),cur=seats(),keep=cur.filter(n=>n&&names.includes(n)),add=names.filter(n=>!keep.includes(n));
  const next=cur.map(n=>n&&names.includes(n)?n:null);add.forEach(n=>{const i=next.indexOf(null);if(i>=0)next[i]=n;});
  /* The card re-renders when seats change, so fly from stand-ins left where its faces were. */
  const stand=[...b.closest('.trio').querySelectorAll('.trio-faces img')].map(img=>{const r=img.getBoundingClientRect(),c=img.cloneNode();
    Object.assign(c.style,{position:'fixed',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',opacity:'0',pointerEvents:'none',margin:'0'});document.body.appendChild(c);return c;});
  setSeats(next);FG.toast(`${names.join(', ')} sit down together`);FG.haptic?.('success');
  next.forEach((n,i)=>{if(add.includes(n)){const seat=$('seats').querySelector(`[data-seat="${i}"] img`);setTimeout(()=>FG.fly(stand[names.indexOf(n)],seat),i*90);}});
  setTimeout(()=>stand.forEach(c=>c.remove()),1200);
  $('seats').querySelector('[data-seat]')?.focus({preventScroll:true});
});

FG.onMealsShown=()=>{FG.ready.then(()=>{render();FG.loadMeals().then(()=>{if(FG.currentTab()==='meals')render();});});};
/* Redraw even while hidden, so nothing the journey has re-sealed lingers in the page. */
FG.onProfileChange.push(()=>{if(FG.data.roster)render();});
})();
