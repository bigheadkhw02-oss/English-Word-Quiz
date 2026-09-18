const OEKD_URL="https://raw.githubusercontent.com/jhseo1211/open-english-korean-dict/refs/heads/main/dict/words.json";
const $=id=>document.getElementById(id);
const screens=["home","categories","wrongBook","quiz"];
const LEVELS=[
 ["middle","중등","기초 핵심 어휘부터"],
 ["high","고등","수능·독해 중심"],
 ["college","대학","대학·학술 어휘"],
 ["advanced","심화","고급·추상 어휘"],
 ["conversation","원어민 일상 프리토킹","실제 대화 표현"]
];
const CAT_META={
 word:["기본 단어","실제 영한 사전 단어"],
 derived:["파생어","접두사·접미사 구조로 학습"],
 idiom:["숙어","표현 전체의 뜻을 통째로 학습"],
 phrasal:["구동사","동사 + 부사/전치사 표현"],
 phrase:["일상 표현","실제 대화에서 바로 쓰는 표현"]
};
let catalog=null, buckets=null, loadPromise=null;
let selectedLevel=null,selectedCat=null,currentPool=[],queue=[],current=null;
let reviewMode=false,sessionScore=0,streak=0,tries=0,locked=false,reviewQueue=[];

function show(id){screens.forEach(s=>$(s).classList.toggle("hidden",s!==id));window.scrollTo(0,0)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function norm(s){return String(s||"").trim().toLowerCase().replace(/\s+/g," ")}
function levelLabel(l){return LEVELS.find(x=>x[0]===l)?.[1]||l}
function packKey(l,c){return l+":"+c}
function uid(x){return norm(x.term)+"|"+norm(x.meaning)}
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0).toString(36)}

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open("EnglishQuizV6",1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("kv"))db.createObjectStore("kv");if(!db.objectStoreNames.contains("wrong"))db.createObjectStore("wrong",{keyPath:"key"})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function kvGet(k){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction("kv","readonly"),r=t.objectStore("kv").get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function kvSet(k,v){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function wrongAll(){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction("wrong","readonly"),r=t.objectStore("wrong").getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function wrongPut(x){const db=await openDB(),key=x.pack+"#"+hash(uid(x));return new Promise((res,rej)=>{const t=db.transaction("wrong","readwrite"),st=t.objectStore("wrong"),g=st.get(key);g.onsuccess=()=>{const old=g.result;st.put({key,pack:x.pack,term:x.term,pron:x.pron||"",meaning:x.meaning,count:(old?.count||0)+1,last:Date.now()})};t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
async function wrongDelete(x){const db=await openDB(),key=x.pack+"#"+hash(uid(x));return new Promise((res,rej)=>{const t=db.transaction("wrong","readwrite");t.objectStore("wrong").delete(key);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}

const CEF={A1:0,A2:1,B1:2,B2:3,C1:4,C2:5};
function detectAffix(w){
 const x=w.toLowerCase();
 const pre=[["un","접두사 un-: 반대·부정"],["re","접두사 re-: 다시"],["dis","접두사 dis-: 반대·분리"],["pre","접두사 pre-: 미리"],["mis","접두사 mis-: 잘못"],["non","접두사 non-: ~이 아닌"],["over","접두사 over-: 지나치게"],["under","접두사 under-: 부족하게"]];
 const suf=[["tion","접미사 -tion: 동작·과정·상태의 명사"],["sion","접미사 -sion: 동작·상태의 명사"],["ment","접미사 -ment: 결과·상태의 명사"],["ness","접미사 -ness: 성질·상태의 명사"],["ity","접미사 -ity: 성질·상태의 명사"],["able","접미사 -able: ~할 수 있는"],["ible","접미사 -ible: ~할 수 있는"],["ful","접미사 -ful: ~이 많은"],["less","접미사 -less: ~이 없는"],["ous","접미사 -ous: ~한 성질의"],["ive","접미사 -ive: ~하는 성질의"],["al","접미사 -al: ~에 관한"],["ly","접미사 -ly: 주로 부사형"],["ize","접미사 -ize: ~하게 만들다"],["ify","접미사 -ify: ~하게 만들다"],["ist","접미사 -ist: 사람·전문가"],["ism","접미사 -ism: 사상·체계"],["ship","접미사 -ship: 상태·관계"],["hood","접미사 -hood: 상태·시기"]];
 for(const [a,d] of pre)if(x.startsWith(a)&&x.length>a.length+3)return d;
 for(const [a,d] of suf)if(x.endsWith(a)&&x.length>a.length+3)return d;
 return "";
}
function scoreWord(x){
 const c=CEF[x.cefr]??2.7;
 const r=Math.min(Number(x.rank)||999999,999999)/1000000;
 return c+r*1.5;
}
function splitByQuartiles(arr){
 const s=[...arr].sort((a,b)=>scoreWord(a)-scoreWord(b)),n=s.length;
 return {
  middle:s.slice(0,Math.ceil(n*.25)),
  high:s.slice(Math.ceil(n*.25),Math.ceil(n*.50)),
  college:s.slice(Math.ceil(n*.50),Math.ceil(n*.75)),
  advanced:s.slice(Math.ceil(n*.75))
 };
}
function dedupe(arr){
 const m=new Map();
 for(const x of arr){const k=uid(x);if(!m.has(k))m.set(k,x)}
 return [...m.values()];
}
async function loadDictionary(){
 if(catalog)return catalog;
 if(loadPromise)return loadPromise;
 loadPromise=(async()=>{
  $("dictState").textContent="불러오는 중";
  const cached=await kvGet("oekd-v6");
  if(cached?.length){catalog=cached;$("dictState").textContent=catalog.length.toLocaleString()+"개";$("dataNotice").textContent=`영한사전 ${catalog.length.toLocaleString()}개 + 내장 숙어·구동사·회화가 준비됐습니다.`;return catalog}
  try{
   const c=new AbortController(),timer=setTimeout(()=>c.abort(),30000);
   const r=await fetch(OEKD_URL,{cache:"no-cache",signal:c.signal});clearTimeout(timer);
   if(!r.ok)throw Error("download");
   const raw=await r.json(),arr=[];
   for(const [term,v] of Object.entries(raw)){
    const meaning=String(v.meaning_ko||"").trim();if(!meaning)continue;
    arr.push({term:String(term).trim(),meaning,pron:String(v.ipa||""),pos:String(v.pos||""),cefr:String(v.cefr||"").toUpperCase(),rank:Number(v.freq_rank)||999999});
   }
   catalog=arr;await kvSet("oekd-v6",arr);
   $("dictState").textContent=arr.length.toLocaleString()+"개";
   $("dataNotice").textContent=`영한사전 ${arr.length.toLocaleString()}개 + 내장 숙어·구동사·회화가 준비됐습니다.`;
   return catalog;
  }catch(e){
   catalog=CORE_DATA.fallbackWords.map(x=>({...x,cefr:"",rank:999999}));
   $("dictState").textContent="오프라인";
   $("dataNotice").classList.add("error");
   $("dataNotice").textContent="온라인 사전은 불러오지 못했지만 내장 데이터로 모든 메뉴를 사용할 수 있습니다. 인터넷 연결 후 앱을 다시 열면 48K 영한사전이 추가됩니다.";
   return catalog;
  }
 })();
 try{return await loadPromise}finally{loadPromise=null}
}
async function buildBuckets(){
 if(buckets)return buckets;
 const words=await loadDictionary();
 const singles=words.filter(x=>/^[A-Za-z][A-Za-z'-]*$/.test(x.term));
 let w4=splitByQuartiles(singles);
 // Limit online basic-word buckets to at most 10k each to keep mobile memory predictable.
 for(const k of ["middle","high","college","advanced"])w4[k]=w4[k].slice(0,10000);
 const derivedOnline=singles.filter(x=>detectAffix(x.term));
 let d4=splitByQuartiles(derivedOnline);
 const dFallback={middle:[],high:[],college:[],advanced:[]};
 for(const x of CORE_DATA.fallbackDerived)dFallback[x.level].push(x);
 for(const k of ["middle","high","college","advanced"])d4[k]=dedupe([...(d4[k]||[]),...dFallback[k]]).slice(0,10000);

 const idiomBy={middle:[],high:[],college:[],advanced:[]};
 const phBy={middle:[],high:[],college:[],advanced:[]};
 CORE_DATA.idioms.forEach(x=>idiomBy[x.level].push({...x,pron:""}));
 CORE_DATA.phrasal.forEach(x=>phBy[x.level].push({...x,pron:""}));

 // If remote dictionary failed, merge explicit fallback words by level.
 if(words===catalog && catalog.length<1000){
   const fw={middle:[],high:[],college:[],advanced:[]};
   CORE_DATA.fallbackWords.forEach(x=>fw[x.level].push(x));
   for(const k of ["middle","high","college","advanced"])w4[k]=dedupe([...(w4[k]||[]),...fw[k]]);
 }

 buckets={
  middle:{word:w4.middle,derived:d4.middle,idiom:idiomBy.middle,phrasal:phBy.middle},
  high:{word:w4.high,derived:d4.high,idiom:idiomBy.high,phrasal:phBy.high},
  college:{word:w4.college,derived:d4.college,idiom:idiomBy.college,phrasal:phBy.college},
  advanced:{word:w4.advanced,derived:d4.advanced,idiom:idiomBy.advanced,phrasal:phBy.advanced},
  conversation:{
   phrase:CORE_DATA.conversation.map(x=>({...x,pron:""})),
   idiom:CORE_DATA.idioms.filter(x=>x.conv).map(x=>({...x,pron:""})),
   phrasal:CORE_DATA.phrasal.filter(x=>x.conv).map(x=>({...x,pron:""}))
  }
 };
 return buckets;
}

function stateKey(pack){return "eq6state_"+pack}
function cycleState(pack){
 try{return JSON.parse(localStorage.getItem(stateKey(pack)))||{round:1,seen:[]}}
 catch(e){return {round:1,seen:[]}}
}
function saveCycle(pack,s){localStorage.setItem(stateKey(pack),JSON.stringify(s))}
function markSeen(x){
 const s=cycleState(x.pack),id=hash(uid(x));
 if(!s.seen.includes(id))s.seen.push(id);
 saveCycle(x.pack,s);
}
function decorate(x,pack,cat){
 const primary=String(x.meaning).split(/[,;/]/)[0].trim();
 let structure="";
 if(cat==="derived")structure=detectAffix(x.term)||"원형에 접두사·접미사가 붙어 의미나 품사가 확장된 단어입니다.";
 else if(cat==="phrasal")structure="동사와 뒤의 부사·전치사를 하나의 의미 단위로 기억하세요.";
 else if(cat==="idiom")structure="단어별 직역보다 표현 전체의 관용적 뜻을 한 덩어리로 익히세요.";
 else if(cat==="phrase")structure="실제 대화에서 문장 전체를 그대로 꺼내 쓰는 표현입니다.";
 else structure=`${x.pos?`품사 ${x.pos} · `:""}핵심 뜻은 ‘${primary}’입니다.`;
 return {...x,pack,cat,structure,
  mnemonic:`“${x.term}”을 보고 바로 “${primary}”가 떠오르게 짧게 여러 번 연결해 보세요.`,
  association:`‘${primary}’이 실제로 필요한 상황을 한 장면으로 떠올려 보세요.`
 };
}
function renderStaticHome(){
 const grid=$("levelGrid");grid.innerHTML="";
 for(const [lv,label,desc] of LEVELS){
  const b=document.createElement("button");b.className="menuBtn";
  b.innerHTML=`<b>${label}</b><span class="desc">${desc}</span><div class="meta"><span>${lv==="conversation"?"회화 데이터 내장":"단어 + 표현 학습"}</span><span>열기 →</span></div>`;
  b.onclick=()=>openCategories(lv);grid.appendChild(b)
 }
}
async function refreshWrongCount(){try{const n=(await wrongAll()).length;$("homeWrong").textContent=n.toLocaleString()+"개";$("wrongMeta").textContent=n.toLocaleString()+"개 저장됨"}catch(e){}}

async function openCategories(lv){
 selectedLevel=lv;$("catTitle").textContent=levelLabel(lv);show("categories");
 const notice=$("categoryNotice");notice.classList.remove("hidden","error");notice.textContent=lv==="conversation"?"내장 회화 데이터를 준비하는 중입니다…":"단어 사전과 내장 표현 데이터를 준비하는 중입니다…";
 try{
  const B=await buildBuckets(),grid=$("categoryGrid");grid.innerHTML="";notice.classList.add("hidden");
  for(const [cat,arr] of Object.entries(B[lv])){
   const pack=packKey(lv,cat),st=cycleState(pack),seen=Math.min(st.seen.length,arr.length),pct=arr.length?Math.floor(seen/arr.length*100):0;
   const b=document.createElement("button");b.className="menuBtn";
   b.innerHTML=`<b>${CAT_META[cat][0]}</b><span class="desc">${CAT_META[cat][1]}</span><div class="progress"><i style="width:${pct}%"></i></div><div class="meta"><span>${arr.length.toLocaleString()}문제</span><span>${st.round}회독 · ${seen.toLocaleString()}/${arr.length.toLocaleString()}</span></div>`;
   b.onclick=()=>startCategory(lv,cat);grid.appendChild(b)
  }
 }catch(e){notice.classList.add("error");notice.textContent="데이터를 준비하지 못했습니다. 홈으로 돌아갔다가 다시 시도해 주세요."}
}
async function startCategory(lv,cat){
 const B=await buildBuckets();selectedLevel=lv;selectedCat=cat;reviewMode=false;sessionScore=0;streak=0;
 const pack=packKey(lv,cat);currentPool=B[lv][cat].map(x=>decorate(x,pack,cat));
 const st=cycleState(pack),seen=new Set(st.seen);let unseen=currentPool.filter(x=>!seen.has(hash(uid(x))));
 if(!unseen.length&&currentPool.length){st.round++;st.seen=[];saveCycle(pack,st);unseen=[...currentPool]}
 queue=shuffle(unseen);
 $("quizModeLabel").textContent=`${levelLabel(lv)} · ${CAT_META[cat][0]}`;$("quizBack").onclick=()=>openCategories(lv);show("quiz");nextNormal()
}
function wrongChoices(x){
 let pool=currentPool.map(v=>v.meaning).filter(m=>m!==x.meaning);
 if(pool.length<3&&catalog)pool=pool.concat(catalog.map(v=>v.meaning).filter(m=>m!==x.meaning));
 return shuffle([...new Set(pool)]).slice(0,3)
}
function setQuestion(x){
 current=x;tries=0;locked=false;
 $("word").textContent=x.term;$("pron").textContent=x.pron||"";$("badge").textContent=CAT_META[x.cat]?.[0]||"오답 복습";
 $("feedback").textContent="";$("learn").classList.add("hidden");$("nextBtn").classList.add("hidden");
 const opts=shuffle([x.meaning,...wrongChoices(x)]),box=$("choices");box.innerHTML="";
 opts.forEach((o,i)=>{const b=document.createElement("button");b.className="choice";b.textContent=`${i+1}. ${o}`;b.onclick=()=>pick(b,o);box.appendChild(b)});
 updateQuizMeta()
}
function updateQuizMeta(){
 if(reviewMode){
  $("quizProgress").textContent=`오답 복습 · 남은 ${reviewQueue.length+1}`;
  const total=Math.max(1,currentPool.length),done=total-(reviewQueue.length+1);$("quizBar").style.width=Math.max(0,Math.floor(done/total*100))+"%";
 }else{
  const st=cycleState(current.pack),total=currentPool.length,seen=Math.min(st.seen.length,total),pct=total?Math.floor(seen/total*100):0;
  $("quizProgress").textContent=`${st.round}회독 · ${seen.toLocaleString()}/${total.toLocaleString()} (${pct}%)`;$("quizBar").style.width=pct+"%";
 }
 $("sessionScore").textContent=`정답 ${sessionScore} · 연속 ${streak}`
}
function nextNormal(){
 if(!queue.length){
  const st=cycleState(packKey(selectedLevel,selectedCat));st.round++;st.seen=[];saveCycle(packKey(selectedLevel,selectedCat),st);
  queue=shuffle([...currentPool]);
 }
 if(queue.length)setQuestion(queue.shift())
}
function nextReview(){
 if(!reviewQueue.length){openWrongBook();return}
 const x=reviewQueue.shift();selectedCat=x.cat;setQuestion(x)
}
function nextQuestion(){reviewMode?nextReview():nextNormal()}
function showLearn(){
 $("learn").classList.remove("hidden");$("core").innerHTML=`<b>${current.term}</b> <span class="small">${current.pron||""}</span> = ${current.meaning}`;
 $("structure").innerHTML=`<b>뜻 구조</b> · ${current.structure}`;$("mnemonic").innerHTML=`<b>암기법</b> · ${current.mnemonic}`;$("association").innerHTML=`<b>연상법</b> · ${current.association}`;
 const pals=shuffle(currentPool.filter(x=>uid(x)!==uid(current))).slice(0,2);$("related").innerHTML=`<b>같이 외우기</b><div class="chips">${pals.map(x=>`<span class="chip">${x.term} = ${x.meaning}</span>`).join("")}</div>`
}
function reveal(){document.querySelectorAll(".choice").forEach(b=>{b.disabled=true;if(b.textContent.replace(/^\d+\.\s*/,"")===current.meaning)b.classList.add("correct")})}
async function pick(btn,val){
 if(locked)return;tries++;
 if(val===current.meaning){
  locked=true;sessionScore++;streak++;btn.classList.add("correct");document.querySelectorAll(".choice").forEach(x=>x.disabled=true);
  if(!reviewMode)markSeen(current);if(reviewMode&&tries===1)await wrongDelete(current);
  $("feedback").textContent=reviewMode&&tries===1?"오답노트에서 제거했습니다.":"아래 정리까지 확인하고 다음 문제로 넘어가세요.";showLearn();$("nextBtn").classList.remove("hidden")
 }else{
  btn.classList.add("wrong");btn.disabled=true;streak=0;await wrongPut(current);
  if(tries===1)$("feedback").textContent="한 번 더 도전해보세요.";
  else{locked=true;if(!reviewMode)markSeen(current);reveal();$("feedback").textContent="오답노트에 저장했습니다. 아래 정리로 다시 기억해 보세요.";showLearn();$("nextBtn").classList.remove("hidden")}
 }
 updateQuizMeta()
}
function speakCurrent(){
 if(!current||!("speechSynthesis" in window))return;
 speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(current.term);u.lang="en-US";u.rate=.85;speechSynthesis.speak(u)
}
async function openWrongBook(){
 const rows=await wrongAll(),box=$("wrongList");box.innerHTML="";$("reviewAllBtn").disabled=!rows.length;$("reviewAllBtn").style.opacity=rows.length?1:.45;
 if(!rows.length)box.innerHTML='<div class="empty">현재 오답이 없습니다.</div>';
 else rows.sort((a,b)=>b.last-a.last).forEach(r=>{const d=document.createElement("div");d.className="wrongItem";d.innerHTML=`<strong>${r.term} <span class="small">${r.pron||""}</span></strong><span>${r.meaning} · 오답 ${r.count}회</span>`;box.appendChild(d)});
 show("wrongBook")
}
async function startWrongReview(){
 const rows=await wrongAll();if(!rows.length)return openWrongBook();const B=await buildBuckets(),lookup=new Map();
 for(const [lv,cats] of Object.entries(B))for(const [cat,arr] of Object.entries(cats)){const p=packKey(lv,cat);for(const x of arr){const d=decorate(x,p,cat);lookup.set(p+"#"+hash(uid(d)),d)}}
 const pool=[];for(const r of rows){const x=lookup.get(r.key);if(x)pool.push(x)}
 if(!pool.length)return openWrongBook();
 reviewMode=true;sessionScore=0;streak=0;currentPool=pool;reviewQueue=shuffle(pool);$("quizModeLabel").textContent="오답 복습";$("quizBack").onclick=openWrongBook;show("quiz");nextReview()
}

$("nextBtn").onclick=nextQuestion;$("speakBtn").onclick=speakCurrent;$("wrongBtn").onclick=openWrongBook;$("homeBtn").onclick=()=>show("home");$("wrongHomeBtn").onclick=()=>show("home");$("reviewAllBtn").onclick=startWrongReview;

renderStaticHome();refreshWrongCount();
// Start dictionary loading in the background, but UI does not depend on it.
setTimeout(()=>{loadDictionary().then(()=>{buckets=null}).catch(()=>{})},400);

if("serviceWorker" in navigator){let reloading=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloading){reloading=true;location.reload()}});window.addEventListener("load",async()=>{try{const r=await navigator.serviceWorker.register("./sw.js?v=6.0");await r.update()}catch(e){}})}
