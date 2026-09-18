const M=window.PACK_MANIFEST;
window.QUIZ_PACKS=window.QUIZ_PACKS||{};
const $=id=>document.getElementById(id);
const screens=["home","categories","wrongBook","quiz"];
const LS_PREFIX="eq3_bits_";
let selectedLevel=null,selectedPackKey=null,currentPool=[],queue=[],current=null,reviewMode=false,sessionScore=0,streak=0,tries=0,locked=false;

function show(id){screens.forEach(s=>$(s).classList.toggle("hidden",s!==id));window.scrollTo(0,0)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function levelKeys(){return [...new Set(Object.keys(M).map(k=>k.split(":")[0]))]}
function getPackKeys(level){return Object.keys(M).filter(k=>k.startsWith(level+":"))}
function bytesForTarget(t){return Math.ceil(t/8)}
function b64ToBytes(s,len){const out=new Uint8Array(len);if(!s)return out;try{const bin=atob(s);for(let i=0;i<Math.min(bin.length,len);i++)out[i]=bin.charCodeAt(i)}catch(e){}return out}
function bytesToB64(arr){let s="";const step=8192;for(let i=0;i<arr.length;i+=step)s+=String.fromCharCode(...arr.subarray(i,i+step));return btoa(s)}
function bitArray(packKey){const t=M[packKey].target;return b64ToBytes(localStorage.getItem(LS_PREFIX+packKey),bytesForTarget(t))}
function hasDone(packKey,n){const b=bitArray(packKey);return !!(b[n>>3]&(1<<(n&7)))}
function markDone(packKey,n){const b=bitArray(packKey);b[n>>3]|=(1<<(n&7));localStorage.setItem(LS_PREFIX+packKey,bytesToB64(b))}
function popcnt8(x){x=x-((x>>1)&0x55);x=(x&0x33)+((x>>2)&0x33);return (x+(x>>4))&0x0F}
function doneCount(packKey){const b=bitArray(packKey);let n=0;for(const x of b)n+=popcnt8(x);return n}

function openDB(){return new Promise((res,rej)=>{const r=indexedDB.open("EnglishQuizV3",1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains("wrong"))db.createObjectStore("wrong",{keyPath:"key"})};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)})}
async function wrongAll(){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction("wrong","readonly"),r=tx.objectStore("wrong").getAll();r.onsuccess=()=>res(r.result||[]);r.onerror=()=>rej(r.error)})}
async function wrongPut(packKey,n){const db=await openDB(),key=packKey+"#"+n;return new Promise((res,rej)=>{const tx=db.transaction("wrong","readwrite"),st=tx.objectStore("wrong"),g=st.get(key);g.onsuccess=()=>{const old=g.result;st.put({key,packKey,n,count:(old?.count||0)+1,last:Date.now()})};tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}
async function wrongDelete(packKey,n){const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction("wrong","readwrite");tx.objectStore("wrong").delete(packKey+"#"+n);tx.oncomplete=()=>res();tx.onerror=()=>rej(tx.error)})}

function loadPack(packKey){return new Promise((resolve,reject)=>{if(window.QUIZ_PACKS[packKey])return resolve(window.QUIZ_PACKS[packKey]);const s=document.createElement("script");s.src=M[packKey].file+"?v=3";s.onload=()=>resolve(window.QUIZ_PACKS[packKey]||[]);s.onerror=reject;document.head.appendChild(s)})}

async function renderHome(){
  const wrong=(await wrongAll()).length;
  let done=0;Object.keys(M).forEach(k=>done+=doneCount(k));
  $("homeProgress").textContent=done.toLocaleString()+" / 190,000";
  $("homeWrong").textContent=wrong.toLocaleString()+"개";$("wrongMeta").textContent=wrong.toLocaleString()+"개 저장됨";
  const grid=$("levelGrid");grid.innerHTML="";
  const labels={middle:"중등",high:"고등",college:"대학",advanced:"심화",conversation:"원어민 일상 프리토킹"};
  for(const level of levelKeys()){
    const keys=getPackKeys(level),target=keys.reduce((s,k)=>s+M[k].target,0),dc=keys.reduce((s,k)=>s+doneCount(k),0);
    const b=document.createElement("button");b.className="menuBtn";
    b.innerHTML=`<b>${labels[level]||level}</b><span class="desc">${keys.map(k=>M[k].categoryLabel).join(" · ")}</span><div class="progress"><i style="width:${target?dc/target*100:0}%"></i></div><div class="meta"><span>진행 ${dc.toLocaleString()}/${target.toLocaleString()}</span><span>${target?Math.floor(dc/target*100):0}%</span></div>`;
    b.addEventListener("click",()=>openCategories(level,labels[level]||level));grid.appendChild(b)
  }
}
async function showHome(){await renderHome();show("home")}
async function openCategories(level,label){
  selectedLevel=level;$("catTitle").textContent=label;const grid=$("categoryGrid");grid.innerHTML="";
  for(const k of getPackKeys(level)){
    const p=M[k],done=doneCount(k),pct=Math.floor(done/p.target*100);
    const b=document.createElement("button");b.className="menuBtn";
    b.innerHTML=`<b>${p.categoryLabel}</b><span class="desc">${p.desc}</span><div class="progress"><i style="width:${pct}%"></i></div><div class="meta"><span>진행 ${done.toLocaleString()}/${p.target.toLocaleString()} (${pct}%)</span><span>현재 데이터 ${p.available.toLocaleString()}개</span></div>`;
    b.addEventListener("click",()=>startPack(k));grid.appendChild(b)
  }
  show("categories")
}
async function startPack(packKey){
  selectedPackKey=packKey;reviewMode=false;sessionScore=0;streak=0;
  currentPool=await loadPack(packKey);
  if(!currentPool.length){alert("이 데이터팩에는 아직 문제가 없습니다.");return}
  let unseen=currentPool.filter(x=>!hasDone(packKey,x.n));
  queue=shuffle(unseen.length?unseen:currentPool);
  $("quizModeLabel").textContent=M[packKey].levelLabel+" · "+M[packKey].categoryLabel;
  $("quizBack").onclick=()=>openCategories(selectedLevel,M[packKey].levelLabel);show("quiz");nextQuestion()
}
function allMeanings(){const out=[];for(const arr of Object.values(window.QUIZ_PACKS))for(const x of arr)out.push(x.meaning);return out}
function wrongChoices(x){
  let pool=currentPool.map(i=>i.meaning).filter(m=>m!==x.meaning);
  if(pool.length<3)pool=pool.concat(allMeanings().filter(m=>m!==x.meaning));
  return shuffle([...new Set(pool)]).slice(0,3)
}
function nextQuestion(){
  if(!queue.length){$("feedback").textContent="현재 내려받은 데이터팩을 모두 풀었습니다.";return}
  current=queue.shift();tries=0;locked=false;renderQuestion()
}
function renderQuestion(){
  $("word").textContent=current.term;$("pron").textContent=current.pron;$("badge").textContent=M[selectedPackKey].categoryLabel;
  $("feedback").textContent="";$("learn").classList.add("hidden");$("nextBtn").classList.add("hidden");
  const done=doneCount(selectedPackKey),target=M[selectedPackKey].target,pct=Math.floor(done/target*100);
  $("quizProgress").textContent=reviewMode?`오답 복습 · 남은 문제 ${queue.length+1}`:`진행 ${done.toLocaleString()}/${target.toLocaleString()} (${pct}%)`;
  $("quizBar").style.width=reviewMode?`${Math.floor((1-(queue.length+1)/Math.max(1,currentPool.length))*100)}%`:`${pct}%`;
  $("sessionScore").textContent=`정답 ${sessionScore} · 연속 ${streak}`;
  const opts=shuffle([current.meaning,...wrongChoices(current)]);const box=$("choices");box.innerHTML="";
  opts.forEach((o,i)=>{const b=document.createElement("button");b.className="choice";b.textContent=`${i+1}. ${o}`;b.onclick=()=>pick(b,o);box.appendChild(b)})
}
function showLearn(){
  $("learn").classList.remove("hidden");
  $("core").innerHTML=`<b>${current.term}</b> <span class="small">${current.pron}</span> = ${current.meaning}`;
  $("structure").innerHTML=`<b>뜻 구조</b> · ${current.structure}`;
  $("mnemonic").innerHTML=`<b>암기법</b> · ${current.mnemonic}`;
  $("association").innerHTML=`<b>연상법</b> · ${current.association}`;
  $("related").innerHTML=`<b>같이 외우기</b><div class="chips">${(current.related||[]).map(x=>`<span class="chip">${x.term} <span class="small">${x.pron}</span> = ${x.meaning}</span>`).join("")}</div>`
}
function reveal(){document.querySelectorAll(".choice").forEach(b=>{b.disabled=true;if(b.textContent.replace(/^\d+\.\s*/,"")===current.meaning)b.classList.add("correct")})}
async function pick(btn,val){
  if(locked)return;tries++;
  if(val===current.meaning){
    locked=true;sessionScore++;streak++;btn.classList.add("correct");document.querySelectorAll(".choice").forEach(x=>x.disabled=true);
    markDone(selectedPackKey,current.n);
    if(reviewMode&&tries===1)await wrongDelete(selectedPackKey,current.n);
    $("feedback").textContent=reviewMode&&tries===1?"오답노트에서 제거했습니다.":"아래 정리까지 보고 다음 문제로 넘어가세요.";showLearn();$("nextBtn").classList.remove("hidden")
  }else{
    btn.classList.add("wrong");btn.disabled=true;streak=0;await wrongPut(selectedPackKey,current.n);
    if(tries===1)$("feedback").textContent="한 번 더 도전해보세요.";
    else{locked=true;markDone(selectedPackKey,current.n);reveal();$("feedback").textContent="오답노트에 저장했습니다. 아래 정리로 외워보세요.";showLearn();$("nextBtn").classList.remove("hidden")}
  }
  $("sessionScore").textContent=`정답 ${sessionScore} · 연속 ${streak}`
}
async function openWrongBook(){
  const rows=await wrongAll(),box=$("wrongList");box.innerHTML="";$("reviewAllBtn").disabled=!rows.length;$("reviewAllBtn").style.opacity=rows.length?1:.45;
  if(!rows.length)box.innerHTML='<div class="empty">현재 오답이 없습니다.</div>';
  else for(const r of rows.slice().sort((a,b)=>b.last-a.last)){
    await loadPack(r.packKey);const x=(window.QUIZ_PACKS[r.packKey]||[]).find(v=>v.n===r.n);if(!x)continue;
    const div=document.createElement("div");div.className="wrongItem";div.innerHTML=`<strong>${x.term} <span class="small">${x.pron}</span></strong><span>${M[r.packKey].levelLabel} · ${M[r.packKey].categoryLabel} · ${x.meaning} · 오답 ${r.count}회</span>`;box.appendChild(div)
  }
  show("wrongBook")
}
async function startWrongReview(){
  const rows=await wrongAll();if(!rows.length)return openWrongBook();
  const grouped={};for(const r of rows)(grouped[r.packKey]??=[]).push(r);
  const pool=[];for(const [pk,rs] of Object.entries(grouped)){await loadPack(pk);for(const r of rs){const x=(window.QUIZ_PACKS[pk]||[]).find(v=>v.n===r.n);if(x)pool.push({...x,_packKey:pk})}}
  if(!pool.length)return openWrongBook();
  reviewMode=true;sessionScore=0;streak=0;currentPool=pool;queue=shuffle(pool);
  $("quizModeLabel").textContent="오답 복습";$("quizBack").onclick=openWrongBook;show("quiz");
  const originalNext=nextQuestion;
  nextQuestion=function(){if(!queue.length){openWrongBook();return}current=queue.shift();selectedPackKey=current._packKey;tries=0;locked=false;renderQuestion()};
  nextQuestion();
  $("nextBtn").onclick=nextQuestion
}
$("nextBtn").onclick=nextQuestion;
$("wrongBtn").onclick=openWrongBook;$("homeBtn").onclick=showHome;$("wrongHomeBtn").onclick=showHome;$("reviewAllBtn").onclick=startWrongReview;
renderHome();

if("serviceWorker" in navigator){
  let reloading=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloading){reloading=true;location.reload()}});
  window.addEventListener("load",async()=>{try{const r=await navigator.serviceWorker.register("./sw.js");r.update()}catch(e){}})
}
