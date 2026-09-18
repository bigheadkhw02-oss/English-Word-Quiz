const SOURCE_URL="https://raw.githubusercontent.com/jhseo1211/open-english-korean-dict/refs/heads/main/dict/words.json";
const SOURCE_KEY="oekd-2026-v1";
const $=id=>document.getElementById(id);
const screens=["home","categories","wrongBook","quiz"];
const LEVELS=[
  ["middle","중등"],["high","고등"],["college","대학"],["advanced","심화"],["conversation","원어민 일상 프리토킹"]
];
const CAT_META={
  word:["기본 단어","공개 사전의 실제 단어를 난이도별로 분류"],
  idiom:["숙어","여러 단어가 한 덩어리 의미를 이루는 표현"],
  derived:["파생어","접두사·접미사로 확장된 단어"],
  phrasal:["구동사","동사 + 부사/전치사 표현"],
  phrase:["일상 표현","실제 대화에서 쓸 수 있는 다단어 표현"]
};
let catalog=null,buckets=null,selectedLevel=null,selectedCat=null,currentPool=[],queue=[],current=null,reviewMode=false,sessionScore=0,streak=0,tries=0,locked=false;

function show(id){screens.forEach(s=>$(s).classList.toggle("hidden",s!==id));window.scrollTo(0,0)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open("EnglishQuizV4",1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("kv"))db.createObjectStore("kv");if(!db.objectStoreNames.contains("wrong"))db.createObjectStore("wrong",{keyPath:"key"})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function kvGet(k){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction("kv","readonly"),r=tx.objectStore("kv").get(k);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function kvSet(k,v){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction("kv","readwrite");tx.objectStore("kv").put(v,k);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function wrongAll(){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction("wrong","readonly"),r=tx.objectStore("wrong").getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function wrongPut(x){const db=await openDB(),key=x.pack+"#"+x.id;return new Promise((res,rej)=>{const tx=db.transaction("wrong","readwrite"),st=tx.objectStore("wrong"),g=st.get(key);g.onsuccess=()=>{const old=g.result;st.put({key,pack:x.pack,id:x.id,term:x.term,pron:x.pron,meaning:x.meaning,count:(old?.count||0)+1,last:Date.now()})};tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}
async function wrongDelete(x){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction("wrong","readwrite");tx.objectStore("wrong").delete(x.pack+"#"+x.id);tx.oncomplete=res;tx.onerror=()=>rej(tx.error)})}

async function ensureCatalog(){
  if(catalog)return catalog;
  $("dataNotice").textContent="사전 데이터를 준비하는 중입니다. 처음 한 번만 시간이 조금 걸릴 수 있습니다.";
  const cached=await kvGet(SOURCE_KEY);
  if(cached&&cached.length){catalog=cached;$("dataNotice").textContent=`사전 데이터 ${catalog.length.toLocaleString()}개를 기기에서 불러왔습니다.`;return catalog}
  const r=await fetch(SOURCE_URL,{cache:"no-cache"});
  if(!r.ok)throw new Error("사전 다운로드 실패");
  const raw=await r.json(),arr=[];
  for(const [word,v] of Object.entries(raw)){
    const meaning=(v.meaning_ko||"").trim();
    if(!meaning)continue;
    arr.push({
      term:word.trim(),
      meaning,
      pron:(v.ipa||"").trim(),
      pos:(v.pos||"").trim(),
      cefr:(v.cefr||"").trim().toUpperCase(),
      rank:Number.isFinite(+v.freq_rank)?+v.freq_rank:9999999
    });
  }
  catalog=arr;await kvSet(SOURCE_KEY,catalog);
  $("dataNotice").textContent=`실제 사전 데이터 ${catalog.length.toLocaleString()}개 저장 완료. 다음부터는 다시 받을 필요가 없습니다.`;
  return catalog
}
const CEF={A1:0,A2:1,B1:2,B2:3,C1:4,C2:5};
function difficultyList(list){
  const byFreq=[...list].sort((a,b)=>a.rank-b.rank);
  const pos=new Map(byFreq.map((x,i)=>[x.term,i/Math.max(1,byFreq.length-1)]));
  return [...list].sort((a,b)=>{
    const sa=(CEF[a.cefr]??2.5)*.62+(pos.get(a.term)??1)*5*.38;
    const sb=(CEF[b.cefr]??2.5)*.62+(pos.get(b.term)??1)*5*.38;
    return sa-sb||a.rank-b.rank
  })
}
function detectAffix(w){
  const rules=[
    ["un","접두사 un-: 반대·부정"],["re","접두사 re-: 다시"],["dis","접두사 dis-: 반대·분리"],["pre","접두사 pre-: 미리"],["mis","접두사 mis-: 잘못"],
    ["tion","접미사 -tion: 동작·과정·상태의 명사"],["sion","접미사 -sion: 동작·상태의 명사"],["ment","접미사 -ment: 결과·상태의 명사"],["ness","접미사 -ness: 성질·상태의 명사"],
    ["ity","접미사 -ity: 성질·상태의 명사"],["able","접미사 -able: ~할 수 있는"],["ible","접미사 -ible: ~할 수 있는"],["ful","접미사 -ful: ~이 많은"],["less","접미사 -less: ~이 없는"],
    ["ous","접미사 -ous: ~한 성질의"],["ive","접미사 -ive: ~하는 성질의"],["al","접미사 -al: ~에 관한"],["ly","접미사 -ly: 주로 부사형"],["ize","접미사 -ize: ~하게 만들다"],["ify","접미사 -ify: ~하게 만들다"],
    ["er","접미사 -er: 사람·도구 또는 비교급"],["ist","접미사 -ist: 사람·전문가"],["ism","접미사 -ism: 사상·체계"],["ship","접미사 -ship: 상태·관계"],["hood","접미사 -hood: 상태·시기"]
  ];
  const x=w.toLowerCase();
  for(const [a,d] of rules){
    if(a.length<=3&&["un","re","dis","pre","mis"].includes(a)){if(x.startsWith(a)&&x.length>a.length+3)return d}
    else if(x.endsWith(a)&&x.length>a.length+3)return d
  }
  return ""
}
function isPhrasal(x){
  if(!x.term.includes(" "))return false;
  const parts=x.term.toLowerCase().split(/\s+/);
  const particles=new Set(["up","down","out","in","on","off","over","away","back","through","around","along","by","for","with","into","after","across","apart","aside","about","against"]);
  return /verb/i.test(x.pos)&&parts.length<=4&&parts.slice(1).some(p=>particles.has(p))
}
function decorate(x,pack,idx,cat){
  const primary=x.meaning.split(/[,;/]/)[0].trim();
  let structure="";
  if(cat==="derived"){structure=detectAffix(x.term)||`파생 형태를 원형·접사와 함께 묶어서 보는 단어입니다.`}
  else if(cat==="phrasal")structure="동사와 뒤의 부사·전치사를 한 덩어리로 보아야 뜻이 잡힙니다.";
  else if(cat==="idiom")structure="단어를 하나씩 직역하기보다 표현 전체의 의미를 통째로 익히는 편이 좋습니다.";
  else if(cat==="phrase")structure="실제 대화에서는 문장 전체를 한 덩어리 표현으로 기억하는 것이 효율적입니다.";
  else structure=`품사 ${x.pos||"정보 없음"} · 핵심 뜻은 ‘${primary}’입니다.`;
  return {...x,id:idx,pack,structure,
    mnemonic:`“${x.term}”과 “${primary}”를 한 쌍으로 소리 내어 연결해 보세요.`,
    association:`‘${primary}’이 실제로 나타나는 장면을 한 컷처럼 떠올려 보세요.`
  }
}
async function buildBuckets(){
  if(buckets)return buckets;
  const all=await ensureCatalog();
  const singles=all.filter(x=>/^[A-Za-z][A-Za-z'-]*$/.test(x.term));
  const ordered=difficultyList(singles).slice(0,40000);
  const levelSlices={
    middle:ordered.slice(0,10000),high:ordered.slice(10000,20000),
    college:ordered.slice(20000,30000),advanced:ordered.slice(30000,40000)
  };
  const derived=difficultyList(singles.filter(x=>detectAffix(x.term)));
  const derivedSlices={
    middle:derived.slice(0,10000),high:derived.slice(10000,20000),
    college:derived.slice(20000,30000),advanced:derived.slice(30000,40000)
  };
  const multi=all.filter(x=>x.term.includes(" ")&&x.term.split(/\s+/).length<=8);
  const phrasal=difficultyList(multi.filter(isPhrasal));
  const idioms=difficultyList(multi.filter(x=>!isPhrasal(x)));
  function split4(arr){const n=Math.ceil(arr.length/4);return {middle:arr.slice(0,n),high:arr.slice(n,2*n),college:arr.slice(2*n,3*n),advanced:arr.slice(3*n)}}
  const ph4=split4(phrasal),id4=split4(idioms);
  const phrases=difficultyList(multi).slice(0,10000);
  buckets={};
  for(const [lv] of LEVELS){
    if(lv==="conversation"){
      buckets[lv]={phrase:phrases,idiom:idioms.slice(0,10000),phrasal:phrasal.slice(0,10000)}
    }else{
      buckets[lv]={word:levelSlices[lv]||[],derived:derivedSlices[lv]||[],idiom:id4[lv]||[],phrasal:ph4[lv]||[]}
    }
  }
  return buckets
}
function packKey(l,c){return l+":"+c}
function completedKey(pack){return "eq4_done_"+pack}
function doneSet(pack){try{return new Set(JSON.parse(localStorage.getItem(completedKey(pack))||"[]"))}catch(e){return new Set()}}
function markDone(x){const s=doneSet(x.pack);s.add(x.id);localStorage.setItem(completedKey(x.pack),JSON.stringify([...s]))}
function levelLabel(l){return LEVELS.find(x=>x[0]===l)?.[1]||l}
async function renderHome(){
  const B=await buildBuckets(),wr=(await wrongAll()).length,grid=$("levelGrid");grid.innerHTML="";
  let totalDone=0,totalAvail=0;
  for(const [lv,label] of LEVELS){
    const cats=Object.keys(B[lv]||{}),avail=cats.reduce((s,c)=>s+B[lv][c].length,0);
    const done=cats.reduce((s,c)=>s+Math.min(doneSet(packKey(lv,c)).size,B[lv][c].length),0);
    totalDone+=done;totalAvail+=avail;
    const b=document.createElement("button");b.className="menuBtn";
    b.innerHTML=`<b>${label}</b><span class="desc">${cats.map(c=>CAT_META[c]?.[0]||c).join(" · ")}</span><div class="progress"><i style="width:${avail?done/avail*100:0}%"></i></div><div class="meta"><span>실데이터 ${avail.toLocaleString()}문제</span><span>진행 ${done.toLocaleString()}/${avail.toLocaleString()}</span></div>`;
    b.onclick=()=>openCategories(lv);grid.appendChild(b)
  }
  $("homeProgress").textContent=`${totalDone.toLocaleString()} / ${totalAvail.toLocaleString()}`;
  $("homeWrong").textContent=wr.toLocaleString()+"개";$("wrongMeta").textContent=wr.toLocaleString()+"개 저장됨"
}
async function openCategories(lv){
  selectedLevel=lv;const B=await buildBuckets();$("catTitle").textContent=levelLabel(lv);const grid=$("categoryGrid");grid.innerHTML="";
  for(const [cat,arr] of Object.entries(B[lv])){
    const p=packKey(lv,cat),done=Math.min(doneSet(p).size,arr.length),target=10000;
    const b=document.createElement("button");b.className="menuBtn";b.disabled=arr.length<4;
    b.innerHTML=`<b>${CAT_META[cat]?.[0]||cat}</b><span class="desc">${CAT_META[cat]?.[1]||""}</span><div class="progress"><i style="width:${arr.length?done/arr.length*100:0}%"></i></div><div class="meta"><span>실데이터 ${arr.length.toLocaleString()} / 목표 ${target.toLocaleString()}</span><span>진행 ${done.toLocaleString()}/${arr.length.toLocaleString()}</span></div>`;
    b.onclick=()=>startCategory(lv,cat);grid.appendChild(b)
  }
  show("categories")
}
async function startCategory(lv,cat){
  const B=await buildBuckets();selectedLevel=lv;selectedCat=cat;reviewMode=false;sessionScore=0;streak=0;
  const p=packKey(lv,cat);currentPool=B[lv][cat].map((x,i)=>decorate(x,p,i,cat));
  const done=doneSet(p);let unseen=currentPool.filter(x=>!done.has(x.id));queue=shuffle(unseen.length?unseen:currentPool);
  $("quizModeLabel").textContent=`${levelLabel(lv)} · ${CAT_META[cat][0]}`;$("quizBack").onclick=()=>openCategories(lv);show("quiz");nextQuestion()
}
function wrongChoices(x){let pool=currentPool.map(v=>v.meaning).filter(m=>m!==x.meaning);if(pool.length<3)pool=catalog.map(v=>v.meaning).filter(m=>m!==x.meaning);return shuffle([...new Set(pool)]).slice(0,3)}
function nextQuestion(){if(!queue.length){$("feedback").textContent="이 목록의 현재 실데이터를 한 바퀴 모두 풀었습니다.";return}current=queue.shift();tries=0;locked=false;renderQuestion()}
function renderQuestion(){
  $("word").textContent=current.term;$("pron").textContent=current.pron||"";$("badge").textContent=CAT_META[selectedCat]?.[0]||"오답 복습";
  $("feedback").textContent="";$("learn").classList.add("hidden");$("nextBtn").classList.add("hidden");
  const done=doneSet(current.pack).size,total=currentPool.length,pct=total?Math.floor(Math.min(done,total)/total*100):0;
  $("quizProgress").textContent=reviewMode?`오답 복습 · 남은 ${queue.length+1}`:`진행 ${Math.min(done,total).toLocaleString()}/${total.toLocaleString()} (${pct}%)`;
  $("quizBar").style.width=(reviewMode?Math.floor((1-(queue.length+1)/Math.max(1,total))*100):pct)+"%";
  $("sessionScore").textContent=`정답 ${sessionScore} · 연속 ${streak}`;
  const opts=shuffle([current.meaning,...wrongChoices(current)]),box=$("choices");box.innerHTML="";
  opts.forEach((o,i)=>{const b=document.createElement("button");b.className="choice";b.textContent=`${i+1}. ${o}`;b.onclick=()=>pick(b,o);box.appendChild(b)})
}
function showLearn(){
  $("learn").classList.remove("hidden");const primary=current.meaning.split(/[,;/]/)[0].trim();
  $("core").innerHTML=`<b>${current.term}</b> <span class="small">${current.pron||""}</span> = ${current.meaning}`;
  $("structure").innerHTML=`<b>뜻 구조</b> · ${current.structure}`;
  $("mnemonic").innerHTML=`<b>암기법</b> · ${current.mnemonic}`;
  $("association").innerHTML=`<b>연상법</b> · ${current.association}`;
  const pals=shuffle(currentPool.filter(x=>x.id!==current.id)).slice(0,2);
  $("related").innerHTML=`<b>함께 복습</b><div class="chips">${pals.map(x=>`<span class="chip">${x.term} <span class="small">${x.pron||""}</span> = ${x.meaning}</span>`).join("")}</div>`
}
function reveal(){document.querySelectorAll(".choice").forEach(b=>{b.disabled=true;if(b.textContent.replace(/^\d+\.\s*/,"")===current.meaning)b.classList.add("correct")})}
async function pick(btn,val){
  if(locked)return;tries++;
  if(val===current.meaning){
    locked=true;sessionScore++;streak++;btn.classList.add("correct");document.querySelectorAll(".choice").forEach(x=>x.disabled=true);markDone(current);
    if(reviewMode&&tries===1)await wrongDelete(current);
    $("feedback").textContent=reviewMode&&tries===1?"오답노트에서 제거했습니다.":"아래 정리까지 보고 다음 문제로 넘어가세요.";showLearn();$("nextBtn").classList.remove("hidden")
  }else{
    btn.classList.add("wrong");btn.disabled=true;streak=0;await wrongPut(current);
    if(tries===1)$("feedback").textContent="한 번 더 도전해보세요.";
    else{locked=true;markDone(current);reveal();$("feedback").textContent="오답노트에 저장했습니다. 아래 정리로 외워보세요.";showLearn();$("nextBtn").classList.remove("hidden")}
  }
  $("sessionScore").textContent=`정답 ${sessionScore} · 연속 ${streak}`
}
async function openWrongBook(){
  const rows=await wrongAll(),box=$("wrongList");box.innerHTML="";$("reviewAllBtn").disabled=!rows.length;$("reviewAllBtn").style.opacity=rows.length?1:.45;
  if(!rows.length)box.innerHTML='<div class="empty">현재 오답이 없습니다.</div>';
  else rows.sort((a,b)=>b.last-a.last).forEach(r=>{const d=document.createElement("div");d.className="wrongItem";d.innerHTML=`<strong>${r.term} <span class="small">${r.pron||""}</span></strong><span>${r.meaning} · 오답 ${r.count}회</span>`;box.appendChild(d)});
  show("wrongBook")
}
async function startWrongReview(){
  const rows=await wrongAll();if(!rows.length)return openWrongBook();
  const B=await buildBuckets(),pool=[];
  for(const r of rows){
    const [lv,cat]=r.pack.split(":"),arr=B[lv]?.[cat]||[],x=arr[r.id];
    if(x)pool.push({...decorate(x,r.pack,r.id,cat),_cat:cat})
  }
  if(!pool.length)return openWrongBook();
  reviewMode=true;sessionScore=0;streak=0;currentPool=pool;queue=shuffle(pool);$("quizModeLabel").textContent="오답 복습";$("quizBack").onclick=openWrongBook;show("quiz");
  nextQuestion=function(){if(!queue.length){openWrongBook();return}current=queue.shift();selectedCat=current._cat||current.pack.split(":")[1];tries=0;locked=false;renderQuestion()};
  $("nextBtn").onclick=nextQuestion;nextQuestion()
}
$("nextBtn").onclick=nextQuestion;$("wrongBtn").onclick=openWrongBook;$("homeBtn").onclick=renderHomeAndShow;$("wrongHomeBtn").onclick=renderHomeAndShow;$("reviewAllBtn").onclick=startWrongReview;
async function renderHomeAndShow(){await renderHome();show("home")}
(async()=>{try{await renderHome()}catch(e){$("dataNotice").textContent="사전 데이터를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 앱을 다시 실행해 주세요."}})();

if("serviceWorker" in navigator){
  let reloading=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloading){reloading=true;location.reload()}});
  window.addEventListener("load",async()=>{try{const r=await navigator.serviceWorker.register("./sw.js");r.update()}catch(e){}})
}