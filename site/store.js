'use strict';
/* Field Guide save files — automatic, local-first persistence.
   Every change is written immediately to localStorage and mirrored to IndexedDB.
   No save/load buttons: the newest valid copy is restored on launch.
   Changes are recorded as small operations so two open tabs merge instead of
   overwriting each other: when another tab's newer state arrives without one of
   our recent operations, that operation is re-applied on top of it.
   Support conversations are shared by every save file (they carry across routes in the game too);
   a copy is also written into each profile so older versions of the guide never lose them.
   The journey (which Part you're in, which Part I paths are complete) is one timeline shared by every
   save file — the files only split for the four Part I paths.
   Missable notes marked as viewed are shared the same way as supports (one game, one set of marks);
   each profile still gets a copy so older versions of the guide keep them. */
(function(){
const FG=window.FG=window.FG||{};
const KEY='fwfg-save-v2';
/* Older builds of the guide don't know the journey and drop it when they save, so it also lives under its own key. */
const JKEY='fwfg-journey-v3';
const V1={roster:'theodora-field-guide-v1',missables:'theodora-missables-v1',route:'theodora-missables-route-v1'};
const LORDS=['Cai','Dietrich','Theodora','Leda'];
const OP_MEMORY=400,OP_TTL=30*60*1000;
const listeners={};
const emit=(type,detail)=>(listeners[type]||[]).forEach(fn=>{try{fn(detail);}catch(e){console.error(e);}});
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const strArr=a=>Array.isArray(a)?a.filter(x=>typeof x==='string'&&x.length<300).slice(0,5000):[];

function normSupports(obj){
  const out={};
  if(obj&&typeof obj==='object')for(const [k,v] of Object.entries(obj)){
    if(typeof k!=='string'||!v||typeof v!=='object')continue;
    const seen=strArr(v.seen).filter(r=>['C','B','A'].includes(r));
    const level=Number.isInteger(v.level)&&v.level>=0&&v.level<=5?v.level:null;
    if(seen.length||level!==null)out[k]={seen:['C','B','A'].filter(r=>seen.includes(r)),level};
  }
  return out;
}
/* Union of viewed ranks, highest recorded level — nothing a save file knew is ever dropped. */
function mergeSupports(...maps){
  const out={};
  for(const m of maps)for(const [k,v] of Object.entries(m||{})){
    const cur=out[k]||{seen:[],level:null};
    const seen=new Set([...cur.seen,...v.seen]);
    out[k]={seen:['C','B','A'].filter(r=>seen.has(r)),level:v.level===null?cur.level:cur.level===null?v.level:Math.max(cur.level,v.level)};
  }
  return out;
}
/* Where the player is in the game. Defaults to Part I (where Bri was when this shipped). */
function normJourney(j){
  j=j&&typeof j==='object'?j:{};
  const part=Number.isInteger(j.part)&&j.part>=0&&j.part<=3?j.part:1;
  const paths=strArr(j.paths);
  return{part,paths:LORDS.filter(l=>paths.includes(l)),warLord:LORDS.includes(j.warLord)?j.warLord:null,
    viewed:strArr(j.viewed),set:!!j.set};
}
function normProfile(p){
  if(!p||typeof p!=='object'||typeof p.id!=='string'||!LORDS.includes(p.lord))return null;
  const supports=normSupports(p.supports);
  const seats=Array.isArray(p.meal?.seats)?p.meal.seats.slice(0,3).map(s=>typeof s==='string'?s:null):[p.lord,null,null];
  while(seats.length<3)seats.push(null);
  return{id:p.id,name:String(p.name||`${p.lord}’s journey`).slice(0,40),lord:p.lord,
    createdAt:+p.createdAt||Date.now(),updatedAt:+p.updatedAt||Date.now(),
    wishlist:strArr(p.wishlist),recruited:strArr(p.recruited),viewed:strArr(p.viewed),
    supports,meal:{seats},route:LORDS.includes(p.route)?p.route:p.lord,
    chapter:Number.isInteger(p.chapter)&&p.chapter>=1&&p.chapter<=12?p.chapter:null};
}
function normState(s){
  if(!s||typeof s!=='object'||s.schema!==2||!s.profiles||typeof s.profiles!=='object')return null;
  const profiles={};
  for(const p of Object.values(s.profiles)){const n=normProfile(p);if(n)profiles[n.id]=n;}
  const ids=Object.keys(profiles);if(!ids.length)return null;
  const supports=mergeSupports(normSupports(s.supports),...Object.values(profiles).map(p=>p.supports));
  const viewed=[...new Set([...strArr(s.viewed),...Object.values(profiles).flatMap(p=>p.viewed)])];
  for(const p of Object.values(profiles)){delete p.supports;delete p.viewed;}
  return{schema:2,savedAt:+s.savedAt||0,activeId:profiles[s.activeId]?s.activeId:ids[0],profiles,supports,viewed,
    journey:normJourney(s.journey),migratedV1:!!s.migratedV1,ops:strArr(s.ops).slice(-OP_MEMORY)};
}
const parse=text=>{try{return normState(JSON.parse(text));}catch{return null;}};
function journeyBackup(){try{const j=JSON.parse(localStorage.getItem(JKEY)||'null');return j&&j.set?normJourney(j):null;}catch{return null;}}
/* A state written by an older build has no journey (set:false): keep the one we know. */
function keepJourney(other,known){if(!other.journey.set&&known&&known.set)other.journey=JSON.parse(JSON.stringify(known));return other;}
function newProfile(lord,name,recruited=[]){
  const t=Date.now();
  return normProfile({id:uid(),name:name||`${lord}’s journey`,lord,createdAt:t,updatedAt:t,wishlist:[],recruited:strArr(recruited),viewed:[],supports:{},meal:{seats:[lord,null,null]},route:lord});
}

/* ---- v1 migration (read-only: v1 keys are left untouched) ---- */
function fromV1(){
  let roster=null,viewed=null,route=null;
  try{roster=JSON.parse(localStorage.getItem(V1.roster)||'null');}catch{}
  try{viewed=JSON.parse(localStorage.getItem(V1.missables)||'null');}catch{}
  try{route=localStorage.getItem(V1.route);}catch{}
  const p=newProfile('Theodora');
  if(roster&&Array.isArray(roster.wishlist))p.wishlist=strArr(roster.wishlist);
  if(roster&&Array.isArray(roster.recruited))p.recruited=strArr(roster.recruited);
  if(Array.isArray(viewed))p.viewed=strArr(viewed);
  if(LORDS.includes(route))p.route=route;
  return p;
}

/* ---- backends ---- */
let lsOK=true;
function lsRead(){try{return localStorage.getItem(KEY);}catch{lsOK=false;return null;}}
function lsWrite(text){try{localStorage.setItem(KEY,text);lsOK=true;return true;}catch{lsOK=false;return false;}}
let dbp=null;
function db(){
  if(dbp)return dbp;
  dbp=new Promise((resolve,reject)=>{
    if(!('indexedDB' in window)){reject(Error('no idb'));return;}
    let req;
    try{req=indexedDB.open('fwfg',1);}catch(e){reject(e);return;}
    req.onupgradeneeded=()=>req.result.createObjectStore('kv');
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
    setTimeout(()=>reject(Error('idb timeout')),4000);
  });
  dbp.catch(()=>{});
  return dbp;
}
async function idbRead(){
  try{const d=await db();return await new Promise(res=>{const r=d.transaction('kv').objectStore('kv').get('state');r.onsuccess=()=>res(r.result||null);r.onerror=()=>res(null);});}
  catch{return null;}
}
async function idbWrite(text){
  try{const d=await db();await new Promise((res,rej)=>{const tx=d.transaction('kv','readwrite');tx.objectStore('kv').put(text,'state');tx.oncomplete=res;tx.onerror=()=>rej(tx.error);});return true;}
  catch{return false;}
}

/* ---- boot ---- */
let state=parse(lsRead());
if(state)keepJourney(state,journeyBackup());
if(!state){
  const p=fromV1();
  delete p.supports;
  const viewed=p.viewed;delete p.viewed;
  state={schema:2,savedAt:0,activeId:p.id,profiles:{[p.id]:p},supports:{},viewed,journey:normJourney(null),migratedV1:true,ops:[]};
}
let activeId=state.activeId;               // per-tab: another tab switching files doesn't yank this one
let idbOK=null,persisted=null,lastSaved=state.savedAt||0,dirtyIdb=0,idbPending=false;
const myOps=[];                            // {id,at,apply}

function serialize(){
  const profiles={};
  for(const [id,p] of Object.entries(state.profiles))profiles[id]={...p,supports:state.supports,viewed:state.viewed};
  return JSON.stringify({...state,activeId,profiles});
}
function save(){
  state.savedAt=Math.max(Date.now(),(state.savedAt||0)+1);
  const text=serialize();
  const okLS=lsWrite(text);
  if(state.journey.set)try{localStorage.setItem(JKEY,JSON.stringify(state.journey));}catch{}
  clearTimeout(dirtyIdb);idbPending=true;
  dirtyIdb=setTimeout(()=>idbWrite(text).then(ok=>{idbOK=ok;idbPending=false;emit('health',health());}),250);
  lastSaved=state.savedAt;
  emit('saved',health());
  if(persisted===null)requestPersist();
}
function flush(){clearTimeout(dirtyIdb);const text=serialize();lsWrite(text);if(state.journey.set)try{localStorage.setItem(JKEY,JSON.stringify(state.journey));}catch{}idbWrite(text).then(ok=>{idbOK=ok;idbPending=false;});}
addEventListener('pagehide',flush);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flush();});

/* Adopt a newer state written elsewhere, re-applying any of our operations it lacks. */
function adopt(other,source){
  const have=new Set(other.ops);
  const cutoff=Date.now()-OP_TTL;
  const missing=myOps.filter(o=>o.at>cutoff&&!have.has(o.id));
  keepJourney(other,state.journey.set?state.journey:journeyBackup());
  state=other;
  if(!state.profiles[activeId])activeId=state.activeId;
  lastSaved=state.savedAt;
  if(missing.length){missing.forEach(o=>{o.apply(state);state.ops.push(o.id);});trimOps();save();}
  emit('change',{source});
}
function syncFromDisk(){
  const text=lsRead();if(!text)return;
  const other=parse(text);
  if(other&&other.savedAt>state.savedAt)adopt(other,'tab');
}
function trimOps(){if(state.ops.length>OP_MEMORY)state.ops=state.ops.slice(-OP_MEMORY);}
function commit(apply,source='local',quiet=false){
  syncFromDisk();
  const op={id:uid(),at:Date.now(),apply};
  apply(state);
  myOps.push(op);if(myOps.length>OP_MEMORY)myOps.shift();
  state.ops.push(op.id);trimOps();
  save();
  if(!quiet)emit('change',{source});
}
const onProfile=(pid,fn)=>st=>{const p=st.profiles[pid];if(!p)return;fn(p);p.updatedAt=Date.now();};

async function requestPersist(){
  persisted=false;
  try{if(navigator.storage?.persisted)persisted=await navigator.storage.persisted();
      if(!persisted&&navigator.storage?.persist)persisted=await navigator.storage.persist();}catch{}
  emit('health',health());
}
/* Reconcile with the IndexedDB mirror: whichever copy is newer wins. */
idbRead().then(text=>{
  const other=text?parse(text):null;
  if(text!==null)idbOK=true;
  if(other&&other.savedAt>(state.savedAt||0)){adopt(other,'restore');lsWrite(serialize());}
  else if(state.savedAt===0)save();
  else idbWrite(serialize()).then(ok=>{idbOK=ok;emit('health',health());});
});
/* Other open tabs stay in step. */
addEventListener('storage',e=>{
  if(e.key!==KEY||!e.newValue)return;
  const other=parse(e.newValue);
  if(other&&other.savedAt>state.savedAt)adopt(other,'tab');
});

/* saved = at least one durable copy succeeded; pending = only the mirror is still being written. */
function health(){
  const durable=lsOK||idbOK===true;
  return{local:lsOK,mirror:idbOK,durable,pending:!lsOK&&idbPending&&idbOK!==false,persisted,
    standalone:matchMedia('(display-mode: standalone)').matches||navigator.standalone===true,lastSaved};
}

/* ---- public API ---- */
const store={
  LORDS,
  on(type,fn){(listeners[type]=listeners[type]||[]).push(fn);},
  profile(){return state.profiles[activeId]||state.profiles[state.activeId]||Object.values(state.profiles)[0];},
  profiles(){return Object.values(state.profiles).sort((a,b)=>b.updatedAt-a.updatedAt);},
  health,
  /* fn must read the profile it is given (it may be replayed on a newer copy). */
  update(fn,{quiet=false}={}){commit(onProfile(store.profile().id,fn),'local',quiet);},
  /* Explicit set operations merge cleanly between tabs. */
  setMember(list,name,on){commit(onProfile(store.profile().id,p=>{const a=p[list].filter(n=>n!==name);p[list]=on?[...a,name]:a;}));},
  /* Bulk version: one operation, so it merges between tabs like a single tap. */
  setMembers(list,names,on){const set=new Set(names);commit(onProfile(store.profile().id,p=>{const a=p[list].filter(n=>!set.has(n));p[list]=on?[...a,...names]:a;}));},
  toggle(list,name){const added=!store.profile()[list].includes(name);store.setMember(list,name,added);return added;},
  /* Shared support progress (all save files). */
  supports(){return state.supports;},
  updateSupports(fn,{quiet=false}={}){commit(st=>{fn(st.supports);},'local',quiet);},
  /* Shared Part I missable marks (all save files). */
  viewed(){return state.viewed;},
  setViewed(key,on){commit(st=>{const s=new Set(st.viewed);if(on)s.add(key);else s.delete(key);st.viewed=[...s];},'local',true);},
  /* Shared journey (all save files). */
  journey(){return state.journey;},
  updateJourney(fn,{quiet=false}={}){commit(st=>{fn(st.journey);st.journey.set=true;},'journey',quiet);},
  /* Prologue / Part II / Part III notes are one timeline, so their marks are shared too. */
  setSharedViewed(key,on){commit(st=>{const s=new Set(st.journey.viewed);if(on)s.add(key);else s.delete(key);st.journey.viewed=[...s];},'local',true);},
  create(lord,name,recruited=[]){
    const p=newProfile(lord,name,recruited);delete p.supports;delete p.viewed;
    commit(st=>{if(!st.profiles[p.id])st.profiles[p.id]=JSON.parse(JSON.stringify(p));},'switch',true);
    activeId=p.id;state.activeId=p.id;save();emit('change',{source:'switch'});return p;
  },
  switchTo(id){if(!state.profiles[id]||id===activeId)return;activeId=id;state.activeId=id;save();emit('change',{source:'switch'});},
  rename(id,name){const n=String(name).trim().slice(0,40);if(!n||!state.profiles[id])return;commit(onProfile(id,p=>{p.name=n;}));},
  remove(id){
    if(!state.profiles[id]||Object.keys(state.profiles).length<2)return false;
    commit(st=>{if(Object.keys(st.profiles).length>1)delete st.profiles[id];},'switch',true);
    if(!state.profiles[activeId]){activeId=store.profiles()[0].id;state.activeId=activeId;save();}
    emit('change',{source:'switch'});return true;
  },
  /* Optional transfer code for moving to another device. */
  exportCode(){return 'TFG2.'+btoa(unescape(encodeURIComponent(serialize())));},
  importCode(code){
    const c=String(code).replace(/\s+/g,'');
    const m2=c.match(/^TFG2\.([A-Za-z0-9+/=]{8,4000000})$/),m1=c.match(/^TFG1\.([A-Za-z0-9+/=]{8,400000})$/);
    let incoming=[],incomingState=null,incomingViewed=[];
    if(m2){const s=normState(JSON.parse(decodeURIComponent(escape(atob(m2[1])))));if(!s)throw Error('shape');incoming=Object.values(s.profiles);incomingState=s;}
    else if(m1){
      const p=JSON.parse(decodeURIComponent(escape(atob(m1[1]))));
      if(!p||p.app!=='theodora-field-guide'||p.v!==1)throw Error('shape');
      const n=newProfile('Theodora','Imported journey');delete n.supports;n.wishlist=strArr(p.wishlist);n.recruited=strArr(p.recruited);incoming=[n];incomingViewed=strArr(p.viewed);
    }else throw Error('format');
    const incomingSupports=incomingState?incomingState.supports:{};
    commit(st=>{
      for(const p of incoming){const ex=st.profiles[p.id];if(ex&&ex.updatedAt>=p.updatedAt)continue;st.profiles[p.id]=JSON.parse(JSON.stringify(p));}
      st.supports=mergeSupports(st.supports,incomingSupports);
      st.viewed=[...new Set([...st.viewed,...(incomingState?incomingState.viewed:incomingViewed)])];
      /* A device that never set its journey adopts the imported one. */
      if(incomingState?.journey?.set&&!st.journey.set)st.journey=JSON.parse(JSON.stringify(incomingState.journey));
    },'switch',true);
    activeId=incoming[0].id;state.activeId=activeId;save();emit('change',{source:'switch'});
    return incoming.length;
  },
  _flush:flush
};
FG.store=store;
})();
