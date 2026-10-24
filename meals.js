'use strict';
/* Meals — seat three, see every pair's next conversation, get guest + dish suggestions. */
(function(){
const store=FG.store,D=FG.data;
const SEAT_POS=[{x:150,y:44},{x:52,y:196},{x:248,y:196}];
const PREF_SCORE={love:2,like:1,neutral:0,dislike:-2};
const PREF_ICON={love:'♥',like:'✓',neutral:'–',dislike:'✕'};
let prefsWishlist=false,hideNo=false,prevSeats=null,prevPairs=new Set(),wasFull=false;

const seats=()=>store.profile().meal.seats.slice();
function setSeats(next){store.update(p=>{p.meal.seats=next.slice(0,3);});}
FG.planMeal=names=>{
  const lord=FG.lord(),want=[...new Set(names)];
  let next=want.includes(lord)||want.length>=3?want:[lord,...want];
  next=next.slice(0,3);while(next.length<3)next.push(null);
  setSeats(next);FG.setTab('meals');
};

function pairInfo(a,b){
  const pr=FG.pair(a,b);
  if(!pr)return{has:false,text:'No support conversations listed'};
  const next=FG.nextRank(a,b),lv=store.supports()[FG.pairKey(a,b)]?.level??null;
  if(!next)return{has:true,done:true,text:'Every listed conversation viewed',max:pr.maxRank};
  const need=FG.RANK_LEVEL[next];
  return{has:true,next,need,lv,ready:lv!==null&&lv>=need,remaining:pr.ranks.length-FG.seen(a,b).length,max:pr.maxRank,
    text:lv!==null&&lv>=need?`${next} ready to view`:`Next: ${next} at support level ${need}`};
}
function prefOf(name,dishId){
  const p=D.meals?.preferences?.[name];if(!p)return null;
  for(const k of ['love','like','neutral','dislike'])if(p[k]?.includes(dishId))return k;
  return null;
}
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
function recommend(){
  const seated=seats().filter(Boolean),p=store.profile(),lord=p.lord;
  const pool=FG.everyone().filter(n=>!seated.includes(n));
  return pool.map(n=>{
    let score=0;const reasons=[];
    seated.forEach(s=>{
      const info=pairInfo(n,s);
      if(info.has&&!info.done){score+=10+info.remaining*3+(info.ready?12:0)+(info.next==='C'?2:0);reasons.push({cls:info.ready?'ready':'bond',text:`${s}: ${info.ready?`${info.next} ready`:`next ${info.next}`}`});}
      else if(info.has&&info.done){score+=1;}
    });
    const rt=FG.routeOf(n);
    const wished=p.wishlist.includes(n)&&!p.recruited.includes(n);
    if(wished&&seated.includes(lord)){score+=prefsWishlist?60:8;reasons.push({cls:'wish',text:`Wishlist · needs lv. ${rt?.support??'?'}`});}
    else if(wished&&prefsWishlist){score+=30;reasons.push({cls:'wish',text:'Wishlist'});}
    if(D.meals&&seated.length){
      const perfect=dishRanking([...seated,n]).filter(x=>x.reactions.every(r=>r.pref==='love'||r.pref==='like')).length;
      if(perfect){score+=Math.min(perfect,4)*1.5;reasons.push({cls:'food',text:`${perfect} dish${perfect===1?'':'es'} everyone likes`});}
    }
    return{n,score,reasons,status:FG.statusKey(rt),inCompany:FG.inCompany(n)};
  }).filter(x=>!(hideNo&&x.status==='no'))
    .filter(x=>x.score>0||!seated.length)
    .sort((a,b)=>b.score-a.score||(b.inCompany-a.inCompany)||a.n.localeCompare(b.n)).slice(0,12);
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
    return `<button type="button" class="meal-pair ${!info.has?'none':info.done?'done':info.ready?'ready':'open'}" data-pa="${esc(a)}" data-pb="${esc(b)}"><span class="mp-faces"><img src="${esc(FG.portrait(a))}" alt=""><img src="${esc(FG.portrait(b))}" alt=""></span><span class="mp-text"><b>${esc(a)} &amp; ${esc(b)}</b><small>${esc(info.text)}</small></span>${info.has?FG.rankGem(info.done?info.max:info.next,info.done):''}</button>`;}).join('')
    :`<p class="note center">${filled.length?'Add another guest to see how this table’s bonds line up.':'Tap a seat to invite someone.'}</p>`;
}
function renderRecs(){
  const seated=seats().filter(Boolean),recs=recommend(),full=seats().every(Boolean);
  $('rec-count').textContent=full?'Table full':`${recs.length} suggestions`;
  $('rec-why').textContent=!seated.length?'Seat your lord first — most meals include them.':
    `Ranked by unwatched conversations with ${seated.join(seated.length>1?' and ':'')}${D.meals?', plus food everyone enjoys':''}.`;
  $('rec-list').innerHTML=recs.map((x,i)=>
    `<article class="rec" style="--i:${i}"><button type="button" class="rec-open" data-info="${esc(x.n)}" aria-label="${esc(x.n)} field note"><span class="pf sm"><img src="${esc(FG.portrait(x.n))}" alt="" loading="lazy"></span></button>`+
    `<div class="rec-text"><b>${esc(x.n)}${x.inCompany?'':' <small class="guest">Guest</small>'}</b><div class="reasons">${x.reasons.slice(0,3).map(r=>`<span class="reason ${r.cls}">${esc(r.text)}</span>`).join('')||'<span class="reason">No listed conversations with this table</span>'}</div></div>`+
    `<button type="button" class="seat-add" data-add="${esc(x.n)}" ${full?'disabled':''} aria-label="Seat ${esc(x.n)}"><svg class="ico" aria-hidden="true"><use href="#i-plus"/></svg></button></article>`).join('')||'<p class="unknown">No suggestions with these filters.</p>';
}
function renderDishes(){
  const seated=seats().filter(Boolean),block=$('dish-block');
  if(!D.meals||!D.meals.dishes?.length){block.hidden=true;return;}
  block.hidden=false;
  const ranked=dishRanking(seated).slice(0,8);
  $('dish-count').textContent=ranked.filter(x=>x.perfect).length?`${ranked.filter(x=>x.perfect).length} perfect`:'';
  $('dish-list').innerHTML=!seated.length?'<p class="note">Seat guests to see what they’d enjoy.</p>':ranked.length?ranked.map(x=>
    `<div class="dish${x.perfect?' perfect':''}"><div class="dish-name"><b>${esc(x.d.name)}</b>${x.perfect?'<span class="perfect-tag">Perfect meal</span>':''}${x.d.price?`<small>${esc(x.d.price)}G</small>`:''}</div>`+
    `<div class="dish-faces">${x.reactions.map(r=>`<span class="df ${r.pref||'unknown'}" title="${esc(r.n)}: ${r.pref||'unknown'}"><img src="${esc(FG.portrait(r.n))}" alt=""><i aria-hidden="true">${r.pref?PREF_ICON[r.pref]:'?'}</i><span class="sr-only">${esc(r.n)} ${r.pref||'unknown'}</span></span>`).join('')}</div></div>`).join('')
    :'<p class="note">No food preferences are recorded for this table yet.</p>';
  if(D.meals.coverage)$('dish-list').insertAdjacentHTML('beforeend',`<p class="note">${esc(D.meals.coverage)}</p>`);
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
    FG.pickCharacter({title:`Seat ${i+1}`,current:s[i],exclude:s.filter((n,j)=>n&&j!==i),returnFocus:()=>$('seats').querySelector(`[data-seat="${i}"]`)},name=>{const t=seats();t[i]=name;setSeats(t);});
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
$('rec-wishlist').addEventListener('change',e=>{prefsWishlist=e.target.checked;renderRecs();});
$('rec-company').addEventListener('change',e=>{hideNo=e.target.checked;renderRecs();});

FG.onMealsShown=()=>{FG.ready.then(()=>{render();FG.loadMeals().then(()=>{if(FG.currentTab()==='meals')render();});});};
FG.onProfileChange.push(()=>{if(FG.currentTab()==='meals')render();});
})();
