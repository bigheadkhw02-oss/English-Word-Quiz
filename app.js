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
function ipaToKorean(ipa){
 let raw=String(ipa||"").trim();if(!raw)return "";
 raw=raw.split(/[;,]/)[0].replace(/[\/\[\]()]/g,"").replace(/[ˈˌ.]/g,"").replace(/:/g,"ː").trim();
 const multi=["tʃ","dʒ","eɪ","aɪ","ɔɪ","aʊ","oʊ","əʊ","ɪə","eə","ʊə","iː","uː","ɑː","ɔː","ɜː","ɝ","ɚ"];
 const consonants=new Set(["p","b","t","d","k","g","f","v","θ","ð","s","z","ʃ","ʒ","h","tʃ","dʒ","m","n","ŋ","l","r","ɹ","j","w"]);
 const vowels={
  "iː":["이"],"i":["이"],"ɪ":["이"],"e":["에"],"ɛ":["에"],"æ":["애"],
  "ɑː":["아"],"ɑ":["아"],"ɒ":["오"],"ɔː":["오"],"ɔ":["오"],"ʌ":["어"],"ɜː":["어"],"ə":["어"],"ɝ":["어"],"ɚ":["어"],
  "uː":["우"],"u":["우"],"ʊ":["우"],"eɪ":["에","이"],"aɪ":["아","이"],"ɔɪ":["오","이"],"aʊ":["아","우"],"oʊ":["오","우"],"əʊ":["오","우"],"ɪə":["이","어"],"eə":["에","어"],"ʊə":["우","어"]
 };
 const onset={"p":"ㅍ","b":"ㅂ","t":"ㅌ","d":"ㄷ","k":"ㅋ","g":"ㄱ","f":"ㅍ","v":"ㅂ","θ":"ㅅ","ð":"ㄷ","s":"ㅅ","z":"ㅈ","ʃ":"ㅅ","ʒ":"ㅈ","h":"ㅎ","tʃ":"ㅊ","dʒ":"ㅈ","m":"ㅁ","n":"ㄴ","ŋ":"ㅇ","l":"ㄹ","r":"ㄹ","ɹ":"ㄹ"};
 const coda={"p":"ㅂ","b":"ㅂ","t":"ㅅ","d":"ㄷ","k":"ㄱ","g":"ㄱ","f":"ㅂ","v":"ㅂ","θ":"ㅅ","ð":"ㄷ","s":"ㅅ","z":"ㅅ","ʃ":"ㅅ","ʒ":"ㅅ","m":"ㅁ","n":"ㄴ","ŋ":"ㅇ","l":"ㄹ"};
 const lead={"ㄱ":0,"ㄲ":1,"ㄴ":2,"ㄷ":3,"ㄸ":4,"ㄹ":5,"ㅁ":6,"ㅂ":7,"ㅃ":8,"ㅅ":9,"ㅆ":10,"ㅇ":11,"ㅈ":12,"ㅉ":13,"ㅊ":14,"ㅋ":15,"ㅌ":16,"ㅍ":17,"ㅎ":18};
 const med={"아":0,"애":1,"야":2,"얘":3,"어":4,"에":5,"여":6,"예":7,"오":8,"와":9,"왜":10,"외":11,"요":12,"우":13,"워":14,"웨":15,"위":16,"유":17,"으":18,"의":19,"이":20};
 const tail={"":0,"ㄱ":1,"ㄲ":2,"ㄳ":3,"ㄴ":4,"ㄵ":5,"ㄶ":6,"ㄷ":7,"ㄹ":8,"ㄺ":9,"ㄻ":10,"ㄼ":11,"ㄽ":12,"ㄾ":13,"ㄿ":14,"ㅀ":15,"ㅁ":16,"ㅂ":17,"ㅄ":18,"ㅅ":19,"ㅆ":20,"ㅇ":21,"ㅈ":22,"ㅊ":23,"ㅋ":24,"ㅌ":25,"ㅍ":26,"ㅎ":27};
 function syl(o,v,c=""){
  o=(o in lead)?o:"ㅇ";c=(c in tail)?c:"";if(!(v in med))return v;
  return String.fromCharCode(0xAC00+(lead[o]*21+med[v])*28+tail[c])
 }
 function tokenise(word){
  const out=[];
  for(let i=0;i<word.length;){
   let hit="";for(const m of multi){if(word.startsWith(m,i)){hit=m;break}}
   if(hit){out.push(hit);i+=hit.length;continue}
   const ch=word[i];if(consonants.has(ch)||vowels[ch])out.push(ch);i++;
  }
  return out
 }
 function glideVowel(glide,v){
  if(glide==="j"){
   const first=v[0];const m={"아":"야","애":"얘","어":"여","에":"예","오":"요","우":"유","이":"이"}[first]||first;return [m,...v.slice(1)]
  }
  if(glide==="w"){
   const first=v[0];const m={"아":"와","애":"왜","어":"워","에":"웨","오":"워","우":"우","이":"위"}[first]||first;return [m,...v.slice(1)]
  }
  return v
 }
 function renderSyllable(onsetTok,vowelSeq,codaTok){
  let seq=[...vowelSeq],o="ㅇ";
  if(onsetTok){
   if(Array.isArray(onsetTok)){
    const base=onsetTok[0],gl=onsetTok[1];o=onset[base]||"ㅇ";seq=glideVowel(gl,seq)
   }else if(onsetTok==="j"||onsetTok==="w"){seq=glideVowel(onsetTok,seq)}
   else o=onset[onsetTok]||"ㅇ";
  }
  let txt="";for(let q=0;q<seq.length;q++)txt+=syl(q===0?o:"ㅇ",seq[q],q===seq.length-1&&codaTok?(coda[codaTok]||""):"");return txt
 }
 function epenthetic(c){
  if(c==="r"||c==="ɹ")return "";
  if(c==="j")return "이";if(c==="w")return "우";
  return syl(onset[c]||"ㅇ","으")
 }
 function convertWord(word){
  const t=tokenise(word);if(!t.length)return "";
  const vp=[];for(let i=0;i<t.length;i++)if(vowels[t[i]])vp.push(i);if(!vp.length)return "";
  const syll=[];
  for(let vi=0;vi<vp.length;vi++){
   const vpos=vp[vi],prevV=vi?vp[vi-1]:-1,nextV=vi+1<vp.length?vp[vi+1]:t.length;
   let before=t.slice(prevV+1,vpos).filter(x=>consonants.has(x));
   let after=t.slice(vpos+1,nextV).filter(x=>consonants.has(x));
   let onsetTok=null,codaTok=null,prefix="",suffix="";
   if(before.length){
    if(before.length>=2&&(before.at(-1)==="j"||before.at(-1)==="w")){const base=before.at(-2);onsetTok=[base,before.at(-1)];before=before.slice(0,-2)}
    else{onsetTok=before.pop()}
    if(vi===0){for(const c of before)prefix+=epenthetic(c)}
    else if(before.length){/* handled as the previous syllable's coda/extra cluster */}
   }
   if(vi===vp.length-1){
    let finals=after.filter(c=>c!=="r"&&c!=="ɹ");
    if(finals.length===1)codaTok=finals[0];
    else if(finals.length>=2){
     const pair=finals.slice(-2).join("");
     if(["nt","nd","mp","ŋk","ld"].includes(pair)){codaTok=finals.at(-2);suffix+=epenthetic(finals.at(-1));finals=finals.slice(0,-2)}
     else if(pair==="st"){suffix+="스"+epenthetic("t");finals=finals.slice(0,-2)}
     else{codaTok=finals.shift();for(const c of finals)suffix+=epenthetic(c);finals=[]}
    }
   }else if(after.length>=2){
    let cluster=[...after];
    if(cluster.at(-1)==="j"||cluster.at(-1)==="w")cluster=cluster.slice(0,-2);else cluster=cluster.slice(0,-1);
    cluster=cluster.filter(c=>c!=="r"&&c!=="ɹ");
    if(cluster.length){codaTok=cluster.shift();for(const c of cluster)suffix+=epenthetic(c)}
   }
   syll.push(prefix+renderSyllable(onsetTok,vowels[t[vpos]],codaTok)+suffix)
  }
  return syll.join("")
 }
 return raw.split(/\s+/).map(convertWord).filter(Boolean).join(" ")
}
function koreanPron(pron){return ipaToKorean(pron)}
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
  const cachedKo=await kvGet("oekd-v6-ko-v6.2");
  if(cachedKo?.length){catalog=cachedKo;$("dictState").textContent=catalog.length.toLocaleString()+"개";$("dataNotice").textContent=`영한사전 ${catalog.length.toLocaleString()}개 + 내장 숙어·구동사·회화가 준비됐습니다.`;return catalog}
  const cached=await kvGet("oekd-v6");
  if(cached?.length){catalog=cached.map(x=>({...x,pron:koreanPron(x.pron)}));await kvSet("oekd-v6-ko-v6.2",catalog);$("dictState").textContent=catalog.length.toLocaleString()+"개";$("dataNotice").textContent=`영한사전 ${catalog.length.toLocaleString()}개 + 내장 숙어·구동사·회화가 준비됐습니다.`;return catalog}
  try{
   const c=new AbortController(),timer=setTimeout(()=>c.abort(),30000);
   const r=await fetch(OEKD_URL,{cache:"no-cache",signal:c.signal});clearTimeout(timer);
   if(!r.ok)throw Error("download");
   const raw=await r.json(),arr=[];
   for(const [term,v] of Object.entries(raw)){
    const meaning=String(v.meaning_ko||"").trim();if(!meaning)continue;
    arr.push({term:String(term).trim(),meaning,pron:koreanPron(v.ipa||""),pos:String(v.pos||""),cefr:String(v.cefr||"").toUpperCase(),rank:Number(v.freq_rank)||999999});
   }
   catalog=arr;await kvSet("oekd-v6-ko-v6.2",arr);
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
const PREFIXES=[
 ["under","아래·부족하게"],["inter","사이·상호"],["trans","가로질러·넘어"],["super","위·초과"],["sub","아래·하위"],["anti","반대"],["over","지나치게·위로"],["pre","미리"],["post","뒤·이후"],["mis","잘못"],["dis","반대·분리"],["non","~이 아닌"],["re","다시"],["un","반대·부정"],["con","함께·완전히"],["com","함께"],["co","함께"]
];
const SUFFIXES=[
 ["ization","~화하는 과정"],["ational","~에 관한"],["ability","~할 수 있는 성질"],["ibility","~할 수 있는 성질"],["tion","동작·과정·상태의 명사"],["sion","동작·상태의 명사"],["ment","결과·상태의 명사"],["ness","성질·상태의 명사"],["ity","성질·상태의 명사"],["able","~할 수 있는"],["ible","~할 수 있는"],["ful","~이 많은"],["less","~이 없는"],["ous","~한 성질의"],["ive","~하는 성질의"],["al","~에 관한"],["ly","~하게"],["ize","~하게 만들다"],["ify","~하게 만들다"],["ist","사람·전문가"],["ism","사상·체계"],["ship","상태·관계"],["hood","상태·시기"],["er","~하는 사람·도구"],["or","~하는 사람·도구"]
];
const ROOTS=[
 ["cept","잡다·받다"],["spect","보다"],["dict","말하다"],["scrib","쓰다"],["script","쓰다"],["port","나르다"],["tract","끌다"],["ject","던지다"],["duc","이끌다"],["duct","이끌다"],["form","형태"],["struct","세우다·구성하다"],["press","누르다"],["gress","가다"],["vert","돌리다"],["vers","돌리다"],["vis","보다"],["vid","보다"],["phon","소리"],["photo","빛"],["graph","쓰다·그리다"],["log","말·학문"],["bio","생명"],["geo","땅"],["chron","시간"],["therm","열"],["tele","멀리"],["micro","작은"],["macro","큰"],["auto","스스로"],["manu","손"],["ped","발"],["cred","믿다"],["cap","잡다"],["tain","잡다·유지하다"],["ten","잡다·유지하다"],["ven","오다"],["vent","오다"],["mit","보내다"],["miss","보내다"],["aud","듣다"],["rupt","깨지다"],["mov","움직이다"],["mot","움직이다"],["fac","만들다"],["fect","만들다"],["fin","끝"],["term","끝·경계"],["numer","수"],["equ","같다"],["simil","비슷하다"]
];
const PARTICLES={up:"위로·완료",down:"아래로·감소",out:"밖으로·완전히",in:"안으로·참여",on:"계속·접촉",off:"떼어냄·중단",over:"넘어·다시 검토",through:"통과·끝까지",away:"멀리·제거",back:"뒤로·되돌림",around:"주변·이리저리",into:"안으로",across:"가로질러",along:"함께·계속",about:"주변·관련",for:"목적·대상",with:"함께",from:"출발·분리",to:"방향",at:"지점",by:"곁·수단"};
const SPECIAL_MEMORY={
 "washbowl":{structure:"wash(씻다) + bowl(그릇·대야) → 씻을 때 쓰는 대야",mnemonic:"wash + bowl을 그대로 붙여 보세요. ‘씻는(wash) 대야(bowl)’ = 세숫대야입니다.",association:"물을 받은 대야에 얼굴을 씻는 장면을 떠올리고, 대야 표면에 WASHBOWL이라고 적혀 있다고 상상하세요."},
 "concept":{structure:"con-(함께) + cept(잡다) → 여러 생각을 함께 잡아 만든 핵심 생각",mnemonic:"con(함께) + cept(잡다) → 여러 생각을 한데 ‘잡아’ 정리한 것이 concept = 개념입니다.",association:"화이트보드에 흩어진 아이디어를 하나의 큰 원으로 묶고 그 원에 CONCEPT라고 쓰는 장면을 떠올리세요."}
};
function hnum(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function primaryMeaning(x){return String(x.meaning||"").split(/[,;/]/)[0].trim()}
function cleanPos(p){p=String(p||"").toLowerCase();if(p.includes("verb"))return"verb";if(p.includes("noun"))return"noun";if(p.includes("adjective")||p==="adj")return"adjective";if(p.includes("adverb")||p==="adv")return"adverb";return p}
function getCatalogMap(){if(!catalog)return null;if(!getCatalogMap.cache||getCatalogMap.n!==catalog.length){getCatalogMap.cache=new Map(catalog.map(v=>[norm(v.term),v]));getCatalogMap.n=catalog.length}return getCatalogMap.cache}
function splitCompound(term){
 const t=norm(term);if(!/^[a-z]{6,}$/.test(t))return null;const m=getCatalogMap();if(!m)return null;
 let best=null;for(let i=3;i<=t.length-3;i++){const a=t.slice(0,i),b=t.slice(i);const A=m.get(a),B=m.get(b);if(A&&B){const score=(A.rank||999999)+(B.rank||999999);if(!best||score<best.score)best={a,b,A,B,score}}}
 return best
}
function analyzeMorph(term){
 const t=norm(term).replace(/[^a-z]/g,"");if(!t)return null;const sp=SPECIAL_MEMORY[t];if(sp)return {special:sp};
 const compound=splitCompound(t);if(compound)return {compound};
 let pre=null,suf=null,root=null;
 for(const [a,d] of PREFIXES)if(t.startsWith(a)&&t.length>a.length+3){pre=[a,d];break}
 for(const [a,d] of SUFFIXES)if(t.endsWith(a)&&t.length>a.length+3){suf=[a,d];break}
 for(const [a,d] of ROOTS)if(t.includes(a)&&t.length>=a.length+2){root=[a,d];break}
 if(pre||suf||root)return {pre,suf,root};return null
}
function morphStructure(x){
 const a=analyzeMorph(x.term),primary=primaryMeaning(x);if(a?.special)return a.special.structure;
 if(a?.compound){const {a:l,b:r,A,B}=a.compound;return `${l}(${primaryMeaning(A)}) + ${r}(${primaryMeaning(B)}) → ‘${primary}’`}
 if(a){const bits=[];if(a.pre)bits.push(`${a.pre[0]}-(${a.pre[1]})`);if(a.root)bits.push(`${a.root[0]}(${a.root[1]})`);if(a.suf)bits.push(`-${a.suf[0]}(${a.suf[1]})`);if(bits.length)return bits.join(" + ")+` → ‘${primary}’`}
 return `${x.pos?`품사 ${x.pos} · `:""}핵심 뜻은 ‘${primary}’입니다.`
}
function mnemonicFor(x,cat){
 const primary=primaryMeaning(x),t=x.term,a=analyzeMorph(t);if(a?.special)return a.special.mnemonic;
 if(cat==="phrasal"){
  const parts=norm(t).split(" "),particle=parts.slice(1).find(v=>PARTICLES[v]);
  return particle?`${parts[0]} + ${particle}(${PARTICLES[particle]})의 방향감을 먼저 떠올린 뒤, 표현 전체를 ‘${primary}’로 묶으세요.`:`${t}를 단어별로 떼지 말고 한 덩어리로 ‘${primary}’라고 기억하세요.`
 }
 if(cat==="idiom")return `관용표현 “${t}” 전체에 ‘${primary}’라는 한글 자막을 붙인다고 생각하세요. 직역보다 통째 암기가 우선입니다.`;
 if(cat==="phrase")return `실제 대화에서 “${t}”를 말하는 순간 상대에게 전달되는 뜻이 ‘${primary}’라고 통째로 연결하세요.`;
 if(a?.compound){const {a:l,b:r,A,B}=a.compound;return `${l}(${primaryMeaning(A)}) + ${r}(${primaryMeaning(B)})를 합쳐 ‘${primary}’로 연결하면 철자와 뜻을 동시에 잡을 수 있습니다.`}
 if(a){const bits=[];if(a.pre)bits.push(`${a.pre[0]}=${a.pre[1]}`);if(a.root)bits.push(`${a.root[0]}=${a.root[1]}`);if(a.suf)bits.push(`${a.suf[0]}=${a.suf[1]}`);if(bits.length)return `${bits.join(", ")}로 쪼개서 보고 마지막에 ‘${primary}’로 합치세요.`}
 const variants=[
  `영어 철자 “${t}” 위에 ‘${primary}’라는 뜻표를 붙인다고 생각하고, 소리 내어 3번 연결하세요.`,
  `“${primary}”를 떠올린 직후 ${t}를 말하는 순서로 외우세요. 뜻→영어 역방향 연결이 기억을 더 단단하게 만듭니다.`,
  `${t}의 첫 글자 ${String(t)[0]?.toUpperCase()||""}를 ‘${primary}’의 시작 신호로 정하고 한 묶음으로 기억하세요.`,
  `카드 앞면에 ${t}, 뒷면에 ‘${primary}’만 적었다고 상상하고 1초 안에 뒤집어 맞히는 방식으로 연결하세요.`,
  `문장 빈칸에 ${t}가 들어가면 뜻이 ‘${primary}’가 된다고 기억하세요. 철자보다 의미 회상을 먼저 훈련합니다.`
 ];return variants[hnum(t)%variants.length]
}
function associationFor(x,cat){
 const p=primaryMeaning(x),t=x.term,pos=cleanPos(x.pos);const a=analyzeMorph(t);if(a?.special)return a.special.association;
 if(cat==="phrasal")return `짧은 영상처럼 떠올리세요: 누군가 실제로 ‘${p}’하고, 행동이 끝나는 순간 화면에 “${t}”가 크게 뜹니다.`;
 if(cat==="idiom")return `대화 말풍선에 “${t}”가 나오고 바로 아래 자막에 ‘${p}’가 뜨는 장면을 한 컷으로 기억하세요.`;
 if(cat==="phrase")return `카페·거리·직장 같은 실제 대화 장면에서 상대에게 “${t}”라고 말하고, 상대가 ‘${p}’라는 뜻으로 이해하는 모습을 떠올리세요.`;
 const variants={
  noun:[`사진 한 장을 떠올리세요. ‘${p}’가 눈앞에 있고 그 아래 영어 이름표가 “${t}”입니다.`,`사전 그림처럼 ‘${p}’을 중앙에 놓고 바로 밑에 “${t}” 라벨을 붙인 장면을 기억하세요.`],
  verb:[`짧은 영상으로 누군가 ‘${p}’하는 동작을 떠올리고, 그 동작이 시작되는 순간 “${t}” 자막을 띄우세요.`,`사람이 실제로 ‘${p}’하는 순간을 정지화면으로 만들고 화면 한가운데 “${t}”를 표시하세요.`],
  adjective:[`같은 대상을 전·후로 비교해 한쪽이 ‘${p}’ 상태가 된 장면을 만들고 그쪽에 “${t}” 스티커를 붙이세요.`,`무언가가 딱 ‘${p}’해 보이는 장면을 고르고, 그 특징을 가리키는 화살표 끝에 “${t}”를 쓰세요.`],
  adverb:[`어떤 행동이 ‘${p}’ 방식으로 진행되는 장면을 떠올리고, 행동 위에 “${t}” 자막을 겹치세요.`,`동작의 방식이 ‘${p}’로 바뀌는 순간 화면 구석에 “${t}” 표시가 켜진다고 상상하세요.`]
 };
 const arr=variants[pos]||[`‘${p}’라는 상황을 한 장면으로 만들고, 그 장면 속 가장 눈에 띄는 곳에 “${t}”를 써 두세요.`,`머릿속 플래시카드에서 ‘${p}’ 장면과 “${t}” 철자가 동시에 보이게 한 컷으로 묶으세요.`];return arr[hnum(t+"assoc")%arr.length]
}
function tokenizeMeaning(s){return [...new Set(String(s||"").toLowerCase().replace(/[()~·]/g," ").split(/[\s,;/]+/).map(v=>v.trim()).filter(v=>v.length>=2))]}
function commonPrefixLen(a,b){a=norm(a);b=norm(b);let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return i}
function relatedScore(a,b){
 let s=0;const ap=cleanPos(a.pos),bp=cleanPos(b.pos);if(ap&&bp&&ap===bp)s+=2;
 const A=tokenizeMeaning(a.meaning),B=new Set(tokenizeMeaning(b.meaning));for(const k of A)if(B.has(k))s+=6;
 const ma=analyzeMorph(a.term),mb=analyzeMorph(b.term);
 if(ma?.root&&mb?.root&&ma.root[0]===mb.root[0])s+=10;if(ma?.pre&&mb?.pre&&ma.pre[0]===mb.pre[0])s+=3;if(ma?.suf&&mb?.suf&&ma.suf[0]===mb.suf[0])s+=3;
 const cp=commonPrefixLen(a.term,b.term);if(cp>=5)s+=5;else if(cp>=4)s+=3;
 const aw=new Set(norm(a.term).split(" "));const bw=norm(b.term).split(" ");for(const w of bw)if(w.length>=3&&aw.has(w))s+=5;
 return s
}
function getRelated(cur){
 const candidates=currentPool.filter(x=>uid(x)!==uid(cur)).map(x=>({x,s:relatedScore(cur,x)}));
 candidates.sort((a,b)=>b.s-a.s||Math.abs((a.x.rank||999999)-(cur.rank||999999))-Math.abs((b.x.rank||999999)-(cur.rank||999999))||String(a.x.term).localeCompare(String(b.x.term)));
 let out=candidates.filter(v=>v.s>0).slice(0,2).map(v=>v.x);
 if(out.length<2){for(const v of candidates){if(out.length>=2)break;if(!out.some(x=>uid(x)===uid(v.x)))out.push(v.x)}}
 return out
}
function decorate(x,pack,cat){
 const primary=primaryMeaning(x);
 let structure="";
 if(cat==="derived")structure=morphStructure(x);
 else if(cat==="phrasal")structure="동사와 뒤의 부사·전치사가 결합하면서 원래 동사와 다른 하나의 뜻을 만듭니다.";
 else if(cat==="idiom")structure="단어별 직역보다 표현 전체가 가진 관용적 뜻을 한 덩어리로 익히는 항목입니다.";
 else if(cat==="phrase")structure="실제 대화에서 문장 전체를 그대로 꺼내 쓰는 표현입니다.";
 else structure=morphStructure(x);
 return {...x,pack,cat,structure,mnemonic:mnemonicFor(x,cat),association:associationFor(x,cat),primary}
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
 const pals=getRelated(current);$("related").innerHTML=`<b>같이 외우기</b><div class="chips">${pals.map(x=>`<span class="chip">${x.term} = ${x.meaning}</span>`).join("")}</div>`
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
 else rows.sort((a,b)=>b.last-a.last).forEach(r=>{const d=document.createElement("div");d.className="wrongItem";d.innerHTML=`<strong>${r.term} <span class="small">${koreanPron(r.pron)||""}</span></strong><span>${r.meaning} · 오답 ${r.count}회</span>`;box.appendChild(d)});
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

if("serviceWorker" in navigator){let reloading=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloading){reloading=true;location.reload()}});window.addEventListener("load",async()=>{try{const r=await navigator.serviceWorker.register("./sw.js?v=6.2");await r.update()}catch(e){}})}
