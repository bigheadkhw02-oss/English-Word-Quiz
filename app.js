const DATA=window.QUIZ_DATA;
const STORE_KEY="englishQuizV2Progress";
const $=id=>document.getElementById(id);
const screens=["home","categories","wrongBook","quiz"];
let selectedLevel=null,selectedCategory=null,currentPool=[],queue=[],current=null;
let reviewMode=false,sessionScore=0,streak=0,tries=0,locked=false;

function loadState(){
  try{return JSON.parse(localStorage.getItem(STORE_KEY))||{completed:{},wrong:{}}}
  catch(e){return {completed:{},wrong:{}}}
}
let state=loadState();
function saveState(){localStorage.setItem(STORE_KEY,JSON.stringify(state))}
function show(id){screens.forEach(s=>$(s).classList.toggle("hidden",s!==id));window.scrollTo(0,0)}
function shuffle(a){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function allItems(){
  const out=[];
  Object.entries(DATA).forEach(([lk,l])=>Object.entries(l.categories).forEach(([ck,c])=>c.items.forEach(item=>out.push({...item,level:lk,category:ck}))));
  return out;
}
function itemMap(){const m={};allItems().forEach(x=>m[x.id]=x);return m}
function categoryKey(l,c){return `${l}:${c}`}
function completedSet(l,c){return new Set(state.completed[categoryKey(l,c)]||[])}
function wrongIds(){return Object.keys(state.wrong||{})}
function categoryStats(l,c){
  const items=DATA[l].categories[c].items,total=items.length,done=completedSet(l,c).size;
  const ids=new Set(items.map(x=>x.id));
  const wrong=wrongIds().filter(id=>ids.has(id)).length;
  return {total,done,wrong,pct:total?Math.round(done/total*100):0}
}
function levelStats(l){
  let total=0,done=0,wrong=0;
  Object.keys(DATA[l].categories).forEach(c=>{const s=categoryStats(l,c);total+=s.total;done+=s.done;wrong+=s.wrong});
  return {total,done,wrong,pct:total?Math.round(done/total*100):0}
}
function renderHome(){
  const grid=$("levelGrid");grid.innerHTML="";
  let grandTotal=0,grandDone=0;
  Object.entries(DATA).forEach(([lk,l])=>{
    const s=levelStats(lk);grandTotal+=s.total;grandDone+=s.done;
    const b=document.createElement("button");b.className="menuBtn";
    b.innerHTML=`<b>${l.label}</b><span class="desc">${Object.values(l.categories).map(x=>x.label).join(" · ")}</span><div class="progress"><i style="width:${s.pct}%"></i></div><div class="meta"><span>진행 ${s.done}/${s.total} (${s.pct}%)</span><span>오답 ${s.wrong}</span></div>`;
    b.onclick=()=>openCategories(lk);grid.appendChild(b);
  });
  $("homeProgress").textContent=`${grandDone} / ${grandTotal}`;
  $("homeWrong").textContent=`${wrongIds().length}개`;
  $("wrongMeta").textContent=`${wrongIds().length}개 저장됨`;
}
function showHome(){renderHome();show("home")}
function openCategories(l){
  selectedLevel=l;$("catTitle").textContent=DATA[l].label;
  const grid=$("categoryGrid");grid.innerHTML="";
  Object.entries(DATA[l].categories).forEach(([ck,c])=>{
    const s=categoryStats(l,ck),b=document.createElement("button");b.className="menuBtn";
    b.innerHTML=`<b>${c.label}</b><span class="desc">${c.desc}</span><div class="progress"><i style="width:${s.pct}%"></i></div><div class="meta"><span>진행 ${s.done}/${s.total} (${s.pct}%)</span><span>오답 ${s.wrong}</span></div>`;
    b.onclick=()=>startCategory(l,ck);grid.appendChild(b);
  });
  show("categories");
}
function startCategory(l,c){
  selectedLevel=l;selectedCategory=c;reviewMode=false;sessionScore=0;streak=0;
  currentPool=DATA[l].categories[c].items.map(x=>({...x,level:l,category:c}));
  const done=completedSet(l,c);
  let unseen=currentPool.filter(x=>!done.has(x.id));
  queue=shuffle(unseen.length?unseen:currentPool);
  $("quizModeLabel").textContent=`${DATA[l].label} · ${DATA[l].categories[c].label}`;
  $("quizBack").onclick=()=>openCategories(l);
  show("quiz");nextQuestion();
}
function openWrongBook(){
  const map=itemMap(),ids=wrongIds();
  $("reviewAllBtn").disabled=ids.length===0;
  $("reviewAllBtn").style.opacity=ids.length?1:.45;
  const box=$("wrongList");box.innerHTML="";
  if(!ids.length){box.innerHTML=`<div class="empty">현재 오답이 없습니다.<br>틀린 문제는 자동으로 여기에 저장됩니다.</div>`}
  else ids.forEach(id=>{
    const x=map[id];if(!x)return;
    const div=document.createElement("div");div.className="wrongItem";
    div.innerHTML=`<strong>${x.term} <span class="small">${x.pron}</span></strong><span>${DATA[x.level].label} · ${DATA[x.level].categories[x.category].label} · ${x.meaning}</span>`;
    box.appendChild(div);
  });
  show("wrongBook");
}
function startWrongReview(){
  const map=itemMap();
  currentPool=wrongIds().map(id=>map[id]).filter(Boolean);
  if(!currentPool.length){openWrongBook();return}
  reviewMode=true;sessionScore=0;streak=0;queue=shuffle(currentPool);
  $("quizModeLabel").textContent="오답 복습";
  $("quizBack").onclick=openWrongBook;
  show("quiz");nextQuestion();
}
function markCompleted(x){
  const k=categoryKey(x.level,x.category);
  const s=new Set(state.completed[k]||[]);s.add(x.id);state.completed[k]=[...s];saveState();
}
function markWrong(x){
  state.wrong[x.id]=(state.wrong[x.id]||0)+1;saveState();
}
function clearWrong(x){delete state.wrong[x.id];saveState()}
function wrongChoices(x){
  let pool=currentPool.map(i=>i.meaning).filter(m=>m!==x.meaning);
  if(pool.length<3) pool=allItems().map(i=>i.meaning).filter(m=>m!==x.meaning);
  return shuffle([...new Set(pool)]).slice(0,3);
}
function nextQuestion(){
  if(!queue.length){
    if(reviewMode){
      openWrongBook();return;
    }
    queue=shuffle(currentPool);
  }
  current=queue.shift();tries=0;locked=false;renderQuestion();
}
function renderQuestion(){
  $("word").textContent=current.term;$("pron").textContent=current.pron;
  $("badge").textContent=DATA[current.level].categories[current.category].label;
  $("feedback").textContent="";$("learn").classList.add("hidden");$("nextBtn").classList.add("hidden");
  const s=categoryStats(current.level,current.category);
  if(reviewMode){
    const remain=wrongIds().length;
    $("quizProgress").textContent=`오답 ${remain}개 남음`;
    $("quizBar").style.width=`${currentPool.length?Math.round((currentPool.length-queue.length-1)/currentPool.length*100):0}%`;
  }else{
    $("quizProgress").textContent=`진행 ${s.done}/${s.total} (${s.pct}%)`;
    $("quizBar").style.width=`${s.pct}%`;
  }
  $("sessionScore").textContent=`정답 ${sessionScore} · 연속 ${streak}`;
  const opts=shuffle([current.meaning,...wrongChoices(current)]);
  const box=$("choices");box.innerHTML="";
  opts.forEach((o,i)=>{const b=document.createElement("button");b.className="choice";b.textContent=`${i+1}. ${o}`;b.onclick=()=>pick(b,o);box.appendChild(b)});
}
function showLearn(){
  $("learn").classList.remove("hidden");
  $("core").innerHTML=`<b>${current.term}</b> <span class="small">${current.pron}</span> = ${current.meaning}`;
  $("structure").innerHTML=`<b>뜻 구조</b> · ${current.structure}`;
  $("mnemonic").innerHTML=`<b>암기법</b> · ${current.mnemonic}`;
  $("association").innerHTML=`<b>연상법</b> · ${current.association}`;
  $("related").innerHTML=`<b>같이 외우기</b><div class="chips">${current.related.map(x=>`<span class="chip">${x.term} <span class="small">${x.pron}</span> = ${x.meaning}</span>`).join("")}</div>`;
}
function reveal(){
  document.querySelectorAll(".choice").forEach(b=>{b.disabled=true;if(b.textContent.replace(/^\d+\.\s*/,"")===current.meaning)b.classList.add("correct")});
}
function pick(btn,val){
  if(locked)return;tries++;
  if(val===current.meaning){
    locked=true;sessionScore++;streak++;btn.classList.add("correct");
    document.querySelectorAll(".choice").forEach(x=>x.disabled=true);
    markCompleted(current);
    if(reviewMode && tries===1) clearWrong(current);
    $("feedback").textContent=reviewMode&&tries===1?"이번에는 바로 맞혔습니다. 오답노트에서 제거됩니다.":"아래 정리까지 보고 다음 문제로 넘어가세요.";
    showLearn();$("nextBtn").classList.remove("hidden");
  }else{
    btn.classList.add("wrong");btn.disabled=true;streak=0;markWrong(current);
    if(tries===1){$("feedback").textContent="한 번 더 도전해보세요."}
    else{
      locked=true;markCompleted(current);reveal();
      $("feedback").textContent=reviewMode?"아직 오답노트에 유지됩니다. 다음 복습 때 다시 나옵니다.":"오답노트에 저장했습니다. 아래 정리로 외워보세요.";
      showLearn();$("nextBtn").classList.remove("hidden");
    }
  }
  $("sessionScore").textContent=`정답 ${sessionScore} · 연속 ${streak}`;
  if(!reviewMode){
    const s=categoryStats(current.level,current.category);
    $("quizProgress").textContent=`진행 ${s.done}/${s.total} (${s.pct}%)`;
    $("quizBar").style.width=`${s.pct}%`;
  }
}
$("nextBtn").onclick=nextQuestion;
renderHome();

if("serviceWorker" in navigator){
  let reloading=false;
  navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloading){reloading=true;location.reload()}});
  window.addEventListener("load",async()=>{try{const r=await navigator.serviceWorker.register("./sw.js");r.update()}catch(e){}});
}
