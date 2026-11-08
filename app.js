/* Souffle — application. Tout est stocké dans ce navigateur (localStorage). */
"use strict";

/* ============================================================
   État, migration, sauvegarde
   ============================================================ */
const KEY = "souffle.v1";
const MIN_PER_CIG_LIFE = 20;   // estimation UCL 2024
const MIN_PER_CIG_SMOKE = 6;   // temps moyen passé à fumer une cigarette (estimation)

const ROLL_DEFAULTS={pouchPrice:22, perPouch:45, extrasMonth:5};
function blank(){
  return {v:2, profile:null, log:[], missions:{}, seen:{}, best:{game:0},
          health:{entries:{}, baseline:null}, ui:{tab:"today", range:"30", prog:"body"}, theme:"auto"};
}
function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }
function migrate(s){
  const b=blank(), o={...b, ...s, health:{...b.health, ...(s.health||{})}, ui:{...b.ui, ...(s.ui||{})}, best:{...b.best, ...(s.best||{})}};
  if(Array.isArray(s.cravings)){
    o.log=(o.log||[]).concat(s.cravings.flatMap(c=> c.ok
      ? [{id:uid(), at:c.at, type:"envie", ok:true}]
      : [{id:uid(), at:c.at, type:"envie", ok:false},{id:uid(), at:c.at, type:"cigarette", n:1}]));
    delete o.cravings;
  }
  const p=o.profile;
  if(p){
    if(!Array.isArray(p.rewards)){
      p.rewards = p.rewardPrice>0 ? [{id:uid(), name:p.rewardName||"Ma récompense", price:p.rewardPrice}] : [];
    }
    delete p.rewardName; delete p.rewardPrice;
    p.reasons = p.reasons||[];
    p.kind = p.kind||"pack";
    for(const k in ROLL_DEFAULTS) if(p[k]==null) p[k]=ROLL_DEFAULTS[k];
  }
  if(!["today","stats","prog","health","me"].includes(o.ui.tab)) o.ui.tab = o.ui.tab==="body" ? "prog" : "today";
  o.v=2;
  return o;
}
/* Chargement prudent : une copie brute est gardée avant toute migration,
   et en cas d'erreur les données ne sont jamais écrasées. */
let LOAD_FAILED=false;
function load(){
  let raw=null;
  try{ raw=localStorage.getItem(KEY); }catch(e){}
  if(!raw) return blank();
  try{ localStorage.setItem(KEY+".prev", raw); }catch(e){}
  try{ const s=JSON.parse(raw); if(s&&typeof s==="object") return migrate(s); }
  catch(e){ LOAD_FAILED=true; try{ localStorage.setItem(KEY+".rescue-"+Date.now(), raw); }catch(_){} console.error(e); }
  return blank();
}
let S = load();
function save(){ if(LOAD_FAILED) return; try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
save();

/* Thème */
function applyTheme(){
  const t=S.theme||"auto";
  if(t==="auto") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme",t);
  const dark = t==="dark" || (t==="auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark?"#0B1218":"#E7EDF1");
  return dark;
}
let DARK = applyTheme();
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>{ DARK=applyTheme(); render(true); });

/* ============================================================
   Formatage
   ============================================================ */
const fEUR = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:2});
const fEUR0 = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR",maximumFractionDigits:0});
const fInt = new Intl.NumberFormat("fr-FR",{maximumFractionDigits:0});
const eur = (v,r)=>(r?fEUR0:fEUR).format(v);
const int = v => fInt.format(Math.floor(v));
const dec = (v,d)=> v==null ? "—" : v.toLocaleString("fr-FR",{minimumFractionDigits:d,maximumFractionDigits:d});
const esc = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function dur(ms){
  const s=Math.max(0,Math.floor(ms/1000)), d=Math.floor(s/86400), h=Math.floor(s%86400/3600), m=Math.floor(s%3600/60);
  if(d>=365){ const y=Math.floor(d/365), rd=d%365; return y+" an"+(y>1?"s":"")+(rd?" "+rd+" j":""); }
  if(d>0) return d+" j"+(h?" "+h+" h":"");
  if(h>0) return h+" h "+String(m).padStart(2,"0");
  return m+" min";
}
function clock(ms){
  const s=Math.floor(ms/1000)%86400;
  return `${String(Math.floor(s/3600)).padStart(2,"0")} h ${String(Math.floor(s%3600/60)).padStart(2,"0")} min ${String(s%60).padStart(2,"0")} s`;
}
const dayKey = (d=new Date()) => d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const startOfDay = t => { const d=new Date(t); d.setHours(0,0,0,0); return d.getTime(); };
const fDate = t => new Date(t).toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
const fDateLong = t => new Date(t).toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
const fTime = t => new Date(t).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});
function toLocalInput(d){ const z=new Date(d.getTime()-d.getTimezoneOffset()*6e4); return z.toISOString().slice(0,16); }
function parseNum(v){
  if(v==null) return null;
  const m=String(v).replace(/\s| | /g,"").match(/-?\d+(?:[.,]\d+)?/);
  if(!m) return null; const n=parseFloat(m[0].replace(",",".")); return isFinite(n)?n:null;
}
const plural = (n,one,many)=> n>1?many:one;

/* Paquets ou tabac à rouler */
function pricePerCig(p){
  if(p.kind==="roll"){
    const base=p.perPouch>0?p.pouchPrice/p.perPouch:0;
    const extra=p.perDay>0?(p.extrasMonth||0)/30.4/p.perDay:0;   // feuilles et filtres
    return base+extra;
  }
  return p.perPack>0?p.packPrice/p.perPack:0;
}
function W(p=S.profile){
  return p&&p.kind==="roll"
    ? {one:"roulée", One:"Roulée", many:"roulées", Many:"Roulées", packs:"blagues"}
    : {one:"cigarette", One:"Cigarette", many:"cigarettes", Many:"Cigarettes", packs:"paquets"};
}
function habitsHTML(d, mode){
  const ob=mode==="ob", A=ob?"data-o":"data-f";
  const st=(f,l,a,b)=> ob?obStepper(f,l,a,b):stepper(f,l,a,b,d[f]);
  const roll=d.kind==="roll";
  const num=(f,label,mode2)=>`<label class="field"><span>${label}</span><input class="inp tnum" inputmode="${mode2||"decimal"}" ${A}="${f}" value="${String(d[f]??"").replace(".",",")}"></label>`;
  return `<div class="field" style="margin-top:${ob?"20px":"0"}"><span>Tu fumes</span><div class="seg full">
      <button class="${roll?"":"on"}" data-act="${ob?"obkind":"kind"}" data-v="pack">Des paquets</button>
      <button class="${roll?"on":""}" data-act="${ob?"obkind":"kind"}" data-v="roll">Du tabac à rouler</button></div></div>
    ${st("perDay",roll?"Roulées par jour":"Cigarettes par jour",1,80)}
    ${roll?num("pouchPrice","Prix d'une blague (€)")+st("perPouch","Roulées par blague",10,150)+num("extrasMonth","Feuilles et filtres (€ par mois)")
          :num("packPrice","Prix du paquet (€)")+st("perPack","Cigarettes par paquet",10,50)}
    ${st("years","Années de tabac",0,60)}`;
}

/* ============================================================
   Calculs
   ============================================================ */
const quitT = ()=> new Date(S.profile.quitDate).getTime();
const sinceQuit = ()=> S.log.filter(e=>e.at>=quitT());
const smokedCount = ()=> sinceQuit().filter(e=>e.type==="cigarette").reduce((a,e)=>a+(e.n||1),0);
const cravings = ()=> sinceQuit().filter(e=>e.type==="envie");
const resistedCount = ()=> cravings().filter(e=>e.ok).length;
const missionsDone = ()=> Object.keys(S.missions).length;

function stats(now=Date.now()){
  const p=S.profile, quit=quitT(), el=Math.max(0,now-quit), days=el/DAY;
  const ppc=pricePerCig(p);
  const smoked=smokedCount();
  const expected=days*p.perDay;
  const avoided=Math.max(0,expected-smoked);
  const money=avoided*ppc;
  return {quit, el, days, ppc, smoked, expected, avoided, money,
    perDayMoney:p.perDay*ppc, yearly:p.perDay*365*ppc, lifetime:p.perDay*365*ppc*p.years,
    life:avoided*MIN_PER_CIG_LIFE*MIN, smokeTime:avoided*MIN_PER_CIG_SMOKE*MIN, packs:p.kind==="roll"?(p.perPouch>0?avoided/p.perPouch:0):(p.perPack>0?avoided/p.perPack:0),
    before: now<quit};
}
/** Clarté du ciel : progression sur une échelle log, de 0 (arrêt) à 1 (15 ans). */
function clarity(el){ return Math.min(1, Math.log(1+el/(20*MIN))/Math.log(1+15*365*DAY/(20*MIN))); }
const nextMilestone = el => MILESTONES.find(m=>m.after>el);
const reached = el => MILESTONES.filter(m=>m.after<=el).length;

/** Objectifs d'épargne : l'argent remplit le 1er objectif, puis le suivant. */
function rewardsProgress(money){
  let left=money;
  return (S.profile.rewards||[]).map(r=>{
    const got=Math.min(r.price, Math.max(0,left)); left-=r.price;
    const missing=r.price-got;
    return {...r, got, prog:r.price>0?got/r.price:0, missing};
  });
}

/** Trophées : état + date (estimée pour l'argent et les cigarettes). */
function badgeState(){
  const s=stats(), rate=s.perDayMoney/DAY, cigRate=S.profile.perDay/DAY;
  const res=cravings().filter(e=>e.ok).sort((a,b)=>a.at-b.at);
  const mis=Object.values(S.missions).sort((a,b)=>a-b);
  const nSync=Object.keys(S.health.entries).length;
  const syncDays=Object.values(S.health.entries).map(e=>e.at).sort((a,b)=>a-b);
  return BADGES.map(b=>{
    let cur=0, at=null;
    if(b.kind==="time"){ cur=s.el; if(cur>=b.v) at=s.quit+b.v; }
    else if(b.kind==="money"){ cur=s.money; if(cur>=b.v) at=rate>0? s.quit+b.v/rate : Date.now(); }
    else if(b.kind==="cigs"){ cur=s.avoided; if(cur>=b.v) at=cigRate>0? s.quit+b.v/cigRate : Date.now(); }
    else if(b.kind==="resisted"){ cur=res.length; if(cur>=b.v) at=res[b.v-1].at; }
    else if(b.kind==="missions"){ cur=mis.length; if(cur>=b.v) at=mis[b.v-1]; }
    else if(b.kind==="sync"){ cur=nSync; if(cur>=b.v) at=syncDays[b.v-1]||Date.now(); }
    const sub = b.kind==="cigs" ? W().many+" évitées" : b.sub;
    return {...b, sub, cur, got:at!=null, at, prog:Math.min(1,cur/b.v)};
  });
}

/* ============================================================
   Santé : import depuis le Raccourci (#rhr=…&hrv=…)
   ============================================================ */
const METRICS = [
  {k:"rhr", title:"Pouls au repos", unit:"bpm", dec:0, lower:true, icon:"heart", why:"La nicotine accélère le cœur. Sans elle, ton pouls au repos baisse."},
  {k:"hrv", title:"Variabilité cardiaque", unit:"ms", dec:0, lower:false, icon:"wave", why:"Plus elle est haute, moins ton système nerveux est sous tension. Elle remonte après l'arrêt."},
  {k:"o2", title:"Oxygène sanguin", unit:"%", dec:1, lower:false, icon:"drop", why:"Le monoxyde de carbone prenait la place de l'oxygène. Il s'en va, l'oxygène revient."},
  {k:"rr", title:"Fréquence respiratoire", unit:"resp/min", dec:1, lower:true, icon:"lungs", why:"Des bronches qui se dégagent, c'est une respiration plus calme."},
  {k:"steps", title:"Pas par jour", unit:"pas", dec:0, lower:false, icon:"walk", why:"Plus de souffle, plus d'envie de bouger. Et bouger aide contre les envies."},
];
function importFromHash(){
  const h=location.hash.replace(/^#/,"");
  if(!h || !/(^|&)(rhr|hrv|o2|rr|pas7|pas)=/.test(h)) return false;
  const p=new URLSearchParams(h), e={};
  const rhr=parseNum(p.get("rhr")), hrv=parseNum(p.get("hrv")), rr=parseNum(p.get("rr"));
  let o2=parseNum(p.get("o2")); if(o2!=null && o2<=1.5) o2*=100;
  let steps=null;
  if(p.has("pas7")){ const v=parseNum(p.get("pas7")); if(v!=null) steps=v/7; } else if(p.has("pas")) steps=parseNum(p.get("pas"));
  if(rhr!=null&&rhr>25&&rhr<200) e.rhr=rhr;
  if(hrv!=null&&hrv>0&&hrv<400) e.hrv=hrv;
  if(o2!=null&&o2>50&&o2<=100) e.o2=o2;
  if(rr!=null&&rr>4&&rr<60) e.rr=rr;
  if(steps!=null&&steps>=0&&steps<200000) e.steps=steps;
  history.replaceState(null,"",location.pathname+location.search);
  if(!Object.keys(e).length){ toast("Aucune valeur lisible reçue du Raccourci"); return false; }
  e.at=Date.now();
  S.health.entries[dayKey()]=e;
  if(!S.health.baseline) S.health.baseline={...e, day:dayKey()};
  else METRICS.forEach(m=>{ if(S.health.baseline[m.k]==null && e[m.k]!=null) S.health.baseline[m.k]=e[m.k]; });
  save(); toast("Données de ta montre à jour");
  return true;
}
function healthSeries(k){
  return Object.keys(S.health.entries).sort().map(d=>({d, t:new Date(d+"T12:00").getTime(), v:S.health.entries[d][k]})).filter(x=>x.v!=null);
}

/* ============================================================
   Rendu
   ============================================================ */
const $app=document.getElementById("app");
let timer=null;

function render(keepScroll){
  clearInterval(timer); timer=null;
  if(!S.profile){ renderOnboarding(); return; }
  const t=S.ui.tab;
  let html="";
  if(t==="today") html=viewToday();
  else if(t==="stats") html=viewStats();
  else if(t==="prog") html=viewProgress();
  else if(t==="health") html=viewHealth();
  else html=viewMe();
  html+=tabsBar(t);
  $app.innerHTML=html;
  bindCharts($app);
  if(!keepScroll){ const v=$app.querySelector(".page"); if(v) v.classList.add("view-in"); }
  if(t==="today"){ HERO_ENTER=!keepScroll; tick(); timer=setInterval(tick,1000); checkUnlocks(); }
  if(!keepScroll) window.scrollTo(0,0);
}
function tabsBar(t){
  const tabs=[["today","Aujourd'hui","today"],["stats","Stats","stats"],["prog","Progrès","trophy"],["health","Santé","watch"],["me","Toi","user"]];
  const ti=Math.max(0,tabs.findIndex(x=>x[0]===t));
  return `<nav class="tabs" aria-label="Navigation"><div class="in" style="--ti:${ti}"><span class="pill" aria-hidden="true"></span>${tabs.map(([k,l,i])=>`<button class="tab ${t===k?"on":""}" data-tab="${k}" aria-current="${t===k?"page":"false"}">${icon(i,24)}<span>${l}</span></button>`).join("")}</div></nav>`;
}
function ringSVG(prog, onGlass){
  const r=24, c=2*Math.PI*r, off=c*(1-Math.max(.003,Math.min(1,prog)));
  const bg=onGlass?"rgba(255,255,255,.25)":"var(--fill)", fg=onGlass?"#fff":"var(--air)";
  return `<svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="${r}" fill="none" stroke="${bg}" stroke-width="6"/><circle class="pg" cx="28" cy="28" r="${r}" fill="none" stroke="${fg}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/></svg>`;
}
let HERO_ENTER=false;
const REDUCED=()=>matchMedia("(prefers-reduced-motion: reduce)").matches;
const set=(id,txt)=>{ const el=document.getElementById(id); if(el && el.textContent!==txt) el.textContent=txt; };

/* ---------- Ciel ---------- */
function mix(a,b,t){ return a.map((v,i)=>Math.round(v+(b[i]-v)*t)); }
const rgb=a=>`rgb(${a.join(",")})`;
function skyVars(c){
  const L={top:[[98,106,112],[30,104,196]], mid:[[124,132,137],[62,142,220]], low:[[150,157,161],[112,178,234]]};
  const D={top:[[22,25,29],[5,18,40]], mid:[[36,40,44],[12,38,74]], low:[[50,54,58],[26,62,106]]};
  const P=DARK?D:L, e=Math.pow(c,.8);
  return {top:rgb(mix(P.top[0],P.top[1],e)), mid:rgb(mix(P.mid[0],P.mid[1],e)), low:rgb(mix(P.low[0],P.low[1],e)),
          sun:Math.max(0,(c-.22)/.78)*(DARK?.35:1), smoke:.9*Math.pow(1-c,1.3)};
}
function paintSky(el, c){
  if(!el) return; const v=skyVars(c);
  el.style.setProperty("--sky-top",v.top); el.style.setProperty("--sky-mid",v.mid); el.style.setProperty("--sky-low",v.low);
  el.style.setProperty("--sun-o",v.sun.toFixed(3)); el.style.setProperty("--smoke-o",v.smoke.toFixed(3));
}
const SMOKE='<div class="sun"></div><div class="smoke s1"></div><div class="smoke s2"></div><div class="smoke s3"></div><div class="smoke s4"></div>';

/* ---------- Aujourd'hui (esprit Météo) ---------- */
function viewToday(){
  const p=S.profile, s=stats(), w=W();
  const day=Math.floor(s.days)+1;
  const mission = !s.before && day<=30 ? MISSIONS[day-1] : null;
  const rs=p.reasons||[];
  const bs=badgeState(), got=bs.filter(b=>b.got).sort((a,b)=>b.at-a.at);
  const rw=rewardsProgress(s.money);
  const res=resistedCount(), env=cravings().length;
  let i=0; const I=()=>`style="--i:${i++}"`;
  const go=(label)=>`<span class="go">${label}${icon("chevron",13)}</span>`;
  return `
  <div class="skybg" id="sky">${SMOKE}</div>
  <main class="today">
    <header class="hero ${HERO_ENTER?"enter":""}" id="hero"></header>
    <div class="stagger">
      <section class="glass" ${I()} aria-label="Argent économisé">
        <div class="gh">${icon("coin")} Économisé</div>
        <div class="gbig tnum" id="t-money"></div>
        <div class="gsub" style="padding-top:4px">${eur(s.perDayMoney)} de plus chaque jour, ${eur(s.yearly,true)} par an</div>
      </section>
      <div class="tiles" ${I()}>
        <section class="glass"><div class="gh">${icon("nocig")} ${w.Many} évitées</div><div class="gmid tnum" id="t-cigs"></div><div class="gsub" id="t-packs"></div></section>
        <section class="glass"><div class="gh">${icon("heart")} Vie regagnée</div><div class="gmid" id="t-life"></div><div class="gsub">estimation, ~${MIN_PER_CIG_LIFE} min par ${w.one}</div></section>
      </div>
      <button class="glass" ${I()} data-goto="prog" data-prog="body"><div class="gh">${icon("lungs")} Ton corps ${go("Tout voir")}</div><div id="t-next"></div></button>
      ${mission?`<section class="glass" ${I()}><div class="gh">${icon("check")} Mission du jour ${day} <button class="go" data-goto="prog" data-prog="plan">Programme${icon("chevron",13)}</button></div>
        <div class="row" style="align-items:flex-start"><div class="grow"><div class="h3">${esc(mission.title)}</div><div class="gtext" style="margin-top:4px">${esc(mission.text)}</div></div>
        <button class="gcheck ${S.missions[day]?"on":""}" data-act="mission" data-day="${day}" aria-label="${S.missions[day]?"Mission faite":"Marquer comme faite"}">${S.missions[day]?icon("check",18):""}</button></div></section>`:""}
      <div class="tiles" ${I()}>
        <button class="glass" data-goto="stats"><div class="gh">${icon("flame")} Envies</div><div class="gmid tnum">${res}</div><div class="gsub">${env?`vaincues sur ${env}, soit ${Math.round(res/env*100)} %`:"vaincues. Le SOS est là quand il faut."}</div></button>
        <button class="glass" data-goto="prog" data-prog="badges"><div class="gh">${icon("trophy")} Trophées</div><div class="gmid tnum">${got.length}<span style="font-size:18px;opacity:.7"> / ${bs.length}</span></div>
          <div class="medals" style="margin-top:auto;padding-top:8px">${got.slice(0,4).map(b=>`<i>${icon(b.icon,16)}</i>`).join("")}</div></button>
      </div>
      ${rs.length?`<section class="glass" ${I()}><div class="gh">${icon("sparkle")} Pourquoi tu fais ça</div><p class="gquote" style="margin:0" id="t-reason"></p></section>`:""}
      ${rw.length?`<section class="glass" ${I()}><div class="gh">${icon("gift")} Tes objectifs <button class="go" data-goto="me">Modifier${icon("chevron",13)}</button></div>
        ${rw.map((r,k)=>`<div style="${k?"margin-top:14px":""}"><div class="row" style="margin-bottom:8px"><div class="grow"><div class="h3">${esc(r.name)}</div>
          <div class="gtext" style="font-size:14px" id="t-rw-${k}">${rwLine(r,s)}</div></div><div class="tnum" style="font-weight:600" id="t-rwp-${k}">${Math.floor(r.prog*100)} %</div></div>
          <div class="bar"><i id="t-rwb-${k}" style="width:${r.prog*100}%"></i></div></div>`).join("")}</section>`:""}
      ${healthTeaser(I())}
    </div>
  </main>
  <div class="dock"><div class="in">
    <button class="btn ember" data-act="sos">${icon("flame",20)} J'ai envie de fumer</button>
    <button class="btn note" data-act="journal" aria-label="Noter dans le journal">${icon("plus",22)}</button>
  </div></div>`;
}
function rwLine(r,s){
  if(r.missing<=0) return "C'est payé. Va te l'offrir.";
  if(r.got<=0 && r.prog===0 && s.perDayMoney>0){
    const list=S.profile.rewards||[], idx=list.findIndex(x=>x.id===r.id);
    const before=list.slice(0,idx).reduce((a,x)=>a+x.price,0)-s.money;
    if(before>0) return `${eur(r.price,true)}, après l'objectif précédent`;
  }
  return s.perDayMoney>0 ? `${eur(r.missing,true)} restants, encore ${dur(r.missing/s.perDayMoney*DAY)}` : `${eur(r.missing,true)} restants`;
}
function countUp(el, to, ms=900){
  if(!el) return; if(REDUCED()){ el.textContent=String(to); return; }
  const t0=performance.now();
  const step=t=>{ const k=Math.min(1,(t-t0)/ms), e=1-Math.pow(1-k,3); el.textContent=String(Math.round(to*e)); if(k<1) requestAnimationFrame(step); else el.dataset.done=1; };
  requestAnimationFrame(step);
}
function tick(){
  const p=S.profile; if(!p) return;
  const s=stats(), name=(p.firstName||"").trim(), hero=document.getElementById("hero");
  if(!hero) return;
  const c=s.before?0:clarity(s.el);
  paintSky(document.getElementById("sky"),c);
  if(s.before){
    hero.innerHTML=`<div class="who">${name?esc(name)+", ta":"Ta"} dernière ${W().one} dans</div>
      <div class="big" style="font-size:64px;margin-top:10px">${dur(s.quit-Date.now())}</div>
      <div class="sub">Prépare-toi : jette les briquets, préviens tes proches.</div>`;
  }else{
    const d=Math.floor(s.days), n=reached(s.el);
    if(!hero.dataset.ready){
      hero.dataset.ready=1;
      hero.innerHTML=`<div class="who">${name?esc(name):"Sans fumer"}</div>
        <div class="big tnum" id="t-days">0</div>
        <div class="unit" id="t-du"></div>
        <div class="sub" id="t-clock"></div>
        <div class="steps" id="t-steps"></div>`;
      if(HERO_ENTER) countUp(document.getElementById("t-days"),d); else { const e=document.getElementById("t-days"); e.textContent=String(d); e.dataset.done=1; }
    }
    const de=document.getElementById("t-days"); if(de&&de.dataset.done) set("t-days",String(d));
    set("t-du",`${plural(d,"jour","jours")} sans fumer`);
    set("t-clock",clock(s.el));
    set("t-steps",`${n} ${plural(n,"étape","étapes")} du corps sur ${MILESTONES.length}`);
  }
  set("t-money",eur(s.money)); set("t-cigs",int(s.avoided)); set("t-life",dur(s.life));
  set("t-packs",`${dec(s.packs,1)} ${W().packs}`);
  const nx=document.getElementById("t-next"), m=nextMilestone(s.el);
  if(nx){
    const html = m ? `<div class="row"><div class="ring">${ringSVG(s.el/m.after,true)}<div class="in">${icon(m.icon,20)}</div></div>
      <div class="grow"><div class="h3">${m.title}</div><div class="gtext" style="font-size:15px">à ${m.label}, dans ${dur(m.after-s.el)}</div></div></div>`
      : `<div class="h3">Toutes les étapes sont franchies.</div>`;
    if(nx.dataset.h!==html){
      const old=nx.querySelector("circle.pg");
      nx.dataset.h=html; nx.innerHTML=html;
      const pg=nx.querySelector("circle.pg");
      if(pg && !old && !REDUCED()){ const off=pg.getAttribute("stroke-dashoffset"); pg.style.strokeDashoffset=pg.getAttribute("stroke-dasharray"); requestAnimationFrame(()=>requestAnimationFrame(()=>{ pg.style.strokeDashoffset=off; })); }
    }
  }
  const rs=p.reasons||[]; if(rs.length) set("t-reason","« "+rs[Math.floor(s.days)%rs.length]+" »");
  rewardsProgress(s.money).forEach((r,i)=>{
    set("t-rw-"+i,rwLine(r,s)); set("t-rwp-"+i,Math.floor(r.prog*100)+" %");
    const b=document.getElementById("t-rwb-"+i); if(b) b.style.width=(r.prog*100)+"%";
  });
}
function healthTeaser(attr=""){
  const b=S.health.baseline, keys=Object.keys(S.health.entries).sort();
  if(!b||keys.length<2) return "";
  const l=S.health.entries[keys[keys.length-1]];
  if(b.rhr==null||l.rhr==null) return "";
  const d=l.rhr-b.rhr; if(d>-0.5) return "";
  return `<button class="glass" ${attr} data-goto="health"><div class="gh">${icon("watch")} Apple Watch <span class="go">Santé${icon("chevron",13)}</span></div>
    <div class="row"><div class="gmid">−${dec(-d,0)}<span style="font-size:18px"> bpm</span></div><div class="gtext grow" style="font-size:15px">Ton pouls au repos a baissé depuis ta première mesure.</div></div></button>`;
}

/* ---------- Stats ---------- */
function viewStats(){
  const s=stats(), range=S.ui.range;
  const now=Date.now();
  const from = range==="all" ? s.quit : Math.max(s.quit, startOfDay(now)-(+range-1)*DAY);
  const L=S.log.filter(e=>e.at>=from);
  const env=L.filter(e=>e.type==="envie"), ok=env.filter(e=>e.ok).length;
  const cig=L.filter(e=>e.type==="cigarette").reduce((a,e)=>a+(e.n||1),0);
  const subs=L.filter(e=>e.type==="substitut");
  const ints=env.filter(e=>e.intensity).map(e=>e.intensity);
  const avgInt=ints.length?ints.reduce((a,b)=>a+b,0)/ints.length:null;

  let h=`<div class="page"><div class="head"><h1 class="h1">Tes chiffres</h1>
    <p class="lead">Calculés à partir de ton journal et de tes habitudes d'avant.</p></div>
    <div class="seg full" role="tablist">${[["7","7 jours"],["30","30 jours"],["all","Depuis l'arrêt"]].map(([k,l])=>`<button class="${range===k?"on":""}" data-act="range" data-v="${k}">${l}</button>`).join("")}</div>`;

  /* Bilan */
  h+=`<section class="section"><div class="st"><h2 class="h2">Bilan depuis l'arrêt</h2></div><div class="kpis">
    <div class="kpi"><div class="meta">Économisé</div><div class="v">${eur(s.money,true)}</div><div class="meta">${eur(s.perDayMoney)} par jour</div></div>
    <div class="kpi"><div class="meta">${W().Many} évitées</div><div class="v">${int(s.avoided)}</div><div class="meta">${dec(s.packs,1)} ${W().packs}</div></div>
    <div class="kpi"><div class="meta">Temps pas passé à fumer</div><div class="v">${dur(s.smokeTime)}</div><div class="meta">~${MIN_PER_CIG_SMOKE} min par ${W().one}</div></div>
    <div class="kpi"><div class="meta">Vie regagnée</div><div class="v">${dur(s.life)}</div><div class="meta">estimation, ~${MIN_PER_CIG_LIFE} min par ${W().one}</div></div>
  </div>${s.smoked?`<p class="meta" style="padding:10px 6px 0;margin:0">${s.smoked} ${plural(s.smoked,W().one+" fumée a été déduite",W().many+" fumées ont été déduites")} du calcul.</p>`:""}</section>`;

  /* Envies */
  h+=`<section class="section"><div class="st"><h2 class="h2">Tes envies</h2><button class="linkbtn" data-act="journal">Noter</button></div>`;
  if(!env.length && !cig){
    h+=`<div class="block empty"><div class="h3">Aucune envie notée sur la période</div>
      <p class="small" style="margin:6px 0 16px">Chaque fois que tu passes par le SOS ou que tu notes une envie, elle apparaît ici : heures à risque, déclencheurs, évolution.</p>
      <button class="btn air" data-act="journal">${icon("plus",20)} Noter une envie</button></div></section>`;
  }else{
    h+=`<div class="kpis">
      <div class="kpi"><div class="meta">Envies notées</div><div class="v">${env.length}</div><div class="meta">${perDayTxt(env.length,from)}</div></div>
      <div class="kpi"><div class="meta">Vaincues</div><div class="v">${env.length?Math.round(ok/env.length*100):0} %</div><div class="meta">${ok} sur ${env.length}</div></div>
      <div class="kpi"><div class="meta">${W().Many} fumées</div><div class="v">${cig}</div><div class="meta">${cig?"sur la période":"aucune, bravo"}</div></div>
      <div class="kpi"><div class="meta">Intensité moyenne</div><div class="v">${avgInt?dec(avgInt,1):"—"}<span class="meta"> / 5</span></div><div class="meta">${intTrend(env)}</div></div>
    </div>`;
    const ins=insights(env,L,from);
    if(ins.length) h+=`<div style="margin-top:10px;display:grid;gap:8px">${ins.map(t=>`<div class="insight">${icon("bulb",20)}<div>${t}</div></div>`).join("")}</div>`;

    /* Par jour */
    const days=dayBuckets(from,now);
    const useWeeks=days.length>45;
    const buckets=useWeeks?weekBuckets(days):days;
    buckets.forEach(b=>{ b.a=0; b.b=0; });
    L.forEach(e=>{ const b=buckets.find(x=>e.at>=x.t0&&e.at<x.t1); if(!b) return;
      if(e.type==="envie"&&e.ok) b.a++; if(e.type==="cigarette") b.b+=(e.n||1); });
    buckets.forEach(b=>b.tip=`<b>${b.label}</b><br>${b.a} ${plural(b.a,"envie vaincue","envies vaincues")}<br>${b.b} ${plural(b.b,W().one+" fumée",W().many+" fumées")}`);
    const every=Math.ceil(buckets.length/7);
    h+=`<div class="block" style="margin-top:10px"><div class="h3">${useWeeks?"Par semaine":"Par jour"}</div>
      <div class="legend"><span><i style="background:var(--air)"></i>Envies vaincues</span><span><i style="background:var(--ember)"></i>${W().Many} fumées</span></div>
      ${columns({data:buckets.map((b,i)=>({label:b.short, axis:i%every===0?b.short:"", a:b.a, b:b.b, tip:b.tip})), height:150})}
      ${tableHTML([useWeeks?"Semaine":"Jour","Vaincues","Fumées"], buckets.filter(b=>b.a||b.b).map(b=>[b.label,b.a,b.b]))}</div>`;

    /* Heures */
    const hours=Array.from({length:24},(_,i)=>({i,n:0}));
    env.forEach(e=>hours[new Date(e.at).getHours()].n++);
    const peak=peakWindow(hours);
    h+=`<div class="block"><div class="h3">Heures à risque</div>
      <p class="meta" style="margin:2px 0 0">${peak?`Ton pic : entre ${peak.a} h et ${peak.b} h`:"Envies par heure de la journée"}</p>
      ${columns({data:hours.map(x=>({label:x.i+" h", axis:x.i%6===0?x.i+" h":"", a:x.n, tip:`<b>${x.i} h – ${x.i+1} h</b><br>${x.n} ${plural(x.n,"envie","envies")}`})), height:130,
        colors:["var(--air)"], highlight:peak?(d,i)=>i>=peak.a&&i<peak.b:null})}
      ${tableHTML(["Heure","Envies"], hours.filter(x=>x.n).map(x=>[x.i+" h",x.n]))}</div>`;

    /* Jours de la semaine */
    const wd=["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"].map(l=>({l,n:0}));
    env.forEach(e=>wd[(new Date(e.at).getDay()+6)%7].n++);
    const topD=wd.reduce((a,b)=>b.n>a.n?b:a,wd[0]);
    h+=`<div class="block"><div class="h3">Jours de la semaine</div>
      ${columns({data:wd.map(x=>({label:x.l, a:x.n, tip:`<b>${x.l}</b><br>${x.n} ${plural(x.n,"envie","envies")}`})), height:120, colors:["var(--air)"], highlight:topD.n?(d)=>d.label===topD.l:null})}</div>`;

    /* Déclencheurs */
    const tr={}; L.filter(e=>e.trigger&&(e.type==="envie"||e.type==="cigarette")).forEach(e=>tr[e.trigger]=(tr[e.trigger]||0)+1);
    const trList=Object.entries(tr).sort((a,b)=>b[1]-a[1]).slice(0,8);
    h+=`<div class="block"><div class="h3">Déclencheurs</div>`;
    h+= trList.length ? hbars({data:trList.map(([k,v])=>({label:TRIGGER_LABEL[k]||k, v, tip:`<b>${TRIGGER_LABEL[k]||k}</b><br>${v} fois`}))})
      : `<p class="small ink2" style="margin:6px 0 0">Ajoute un déclencheur quand tu notes une envie pour voir ce qui revient le plus.</p>`;
    h+=`</div>`;

    /* Intensité */
    const id=dayBuckets(from,now).map(b=>{ const v=env.filter(e=>e.intensity&&e.at>=b.t0&&e.at<b.t1).map(e=>e.intensity); return v.length?{t:b.t0+DAY/2,v:v.reduce((a,c)=>a+c,0)/v.length,tip:`<b>${b.label}</b><br>Intensité ${dec(v.reduce((a,c)=>a+c,0)/v.length,1)} / 5`}:null; }).filter(Boolean);
    if(id.length>=2) h+=`<div class="block"><div class="h3">Intensité des envies</div><p class="meta" style="margin:2px 0 0">Moyenne par jour, sur 5</p>
      ${line({points:id, height:130, color:"var(--ember)", yFmt:v=>dec(v,0), xFmt:fDate, domain:[1,5]})}</div>`;

    if(subs.length){
      const sb={}; subs.forEach(e=>sb[e.sub||"autre"]=(sb[e.sub||"autre"]||0)+(e.n||1));
      h+=`<div class="block"><div class="h3">Substituts utilisés</div>${hbars({data:Object.entries(sb).sort((a,b)=>b[1]-a[1]).map(([k,v])=>({label:SUB_LABEL[k]||k,v,tip:`<b>${SUB_LABEL[k]||k}</b><br>${v}`}))})}</div>`;
    }
    h+=`</section>`;
  }

  /* Argent */
  const pts=[], span=Math.max(DAY, now-s.quit), stepT=span/40;
  for(let t=s.quit;t<=now;t+=stepT){ const sm=S.log.filter(e=>e.type==="cigarette"&&e.at>=s.quit&&e.at<=t).reduce((a,e)=>a+(e.n||1),0);
    const v=Math.max(0,(t-s.quit)/DAY*S.profile.perDay-sm)*s.ppc; pts.push({t,v,tip:`<b>${fDate(t)}</b><br>${eur(v,true)}`}); }
  pts.push({t:now,v:s.money,tip:`<b>Aujourd'hui</b><br>${eur(s.money)}`});
  const proj=[30,90,180,365].map(d=>({t:s.quit+d*DAY,v:s.money+Math.max(0,s.quit+d*DAY-now)/DAY*s.perDayMoney})).filter(p=>p.t>now).slice(0,1).map(p=>({...p,tip:`<b>${fDate(p.t)}</b><br>${eur(p.v,true)} (projection)`}));
  h+=`<section class="section"><div class="st"><h2 class="h2">Ton argent</h2></div>
    <div class="block"><div class="h3">Cumulé depuis l'arrêt</div><p class="meta" style="margin:2px 0 0">Trait plein : réel. Pointillés : si tu continues.</p>
    ${line({points:pts, proj, height:160, color:"var(--sun)", zero:true, yFmt:v=>tickFmt(v)+" €", xFmt:fDate})}</div>
    <div class="block rows">${[["1 mois",30],["6 mois",182],["1 an",365],["5 ans",1826],["10 ans",3652]].map(([l,d])=>{
      const v=d*s.perDayMoney; const reachedT=s.quit+d*DAY;
      return `<div class="row"><div class="grow"><div class="h3">À ${l}</div><div class="meta">${reachedT<=now?"atteint":"le "+new Date(reachedT).toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</div></div>
        <div class="display" style="font-size:22px;font-weight:680">${eur(v,true)}</div></div>`;}).join("")}
      <div class="row"><div class="grow"><div class="h3">Avant l'arrêt</div><div class="meta">${S.profile.years} ans de tabac, estimation</div></div><div class="display" style="font-size:22px;font-weight:680;color:var(--ember)">${eur(s.lifetime,true)}</div></div>
    </div></section>`;

  /* Journal */
  const all=[...S.log].sort((a,b)=>b.at-a.at), recent=all.slice(0,S.ui.jall?400:12);
  h+=`<section class="section"><div class="st"><h2 class="h2">Journal</h2><button class="linkbtn" data-act="journal">Ajouter</button></div>
    <div class="block rows">${recent.length?recent.map(entryRow).join(""):`<p class="small ink2" style="margin:0">Rien pour l'instant.</p>`}</div>
    ${all.length>12?`<button class="btn soft" style="margin-top:10px" data-act="jall">${S.ui.jall?"Afficher moins":`Tout afficher (${all.length})`}</button>`:""}</section></div>`;
  return h;
}
function perDayTxt(n,from){ const d=Math.max(1,(Date.now()-from)/DAY); return dec(n/d,1)+" par jour"; }
function intTrend(env){
  const v=env.filter(e=>e.intensity).sort((a,b)=>a.at-b.at); if(v.length<4) return "sur 5";
  const h=Math.floor(v.length/2), a=v.slice(0,h).reduce((s,e)=>s+e.intensity,0)/h, b=v.slice(h).reduce((s,e)=>s+e.intensity,0)/(v.length-h);
  return b<a-.2?"en baisse":b>a+.2?"en hausse":"stable";
}
function peakWindow(hours){
  const tot=hours.reduce((a,x)=>a+x.n,0); if(tot<3) return null;
  let best=0, bi=0; for(let i=0;i<22;i++){ const v=hours[i].n+hours[i+1].n+hours[i+2].n; if(v>best){best=v;bi=i;} }
  return {a:bi, b:bi+3, n:best};
}
function dayBuckets(from,now){
  const out=[]; for(let t=startOfDay(from); t<=now; t+=DAY){ const t1=startOfDay(t+DAY*1.5);
    out.push({t0:t, t1, label:fDate(t), short:new Date(t).getDate()+""}); if(out.length>400) break; }
  return out;
}
function weekBuckets(days){
  const w=[]; for(let i=0;i<days.length;i+=7){ const c=days.slice(i,i+7); w.push({t0:c[0].t0, t1:c[c.length-1].t1, label:"Sem. du "+c[0].label, short:c[0].label}); }
  return w;
}
function insights(env,L,from){
  const out=[];
  const tr={}; L.filter(e=>e.trigger).forEach(e=>tr[e.trigger]=(tr[e.trigger]||0)+1);
  const top=Object.entries(tr).sort((a,b)=>b[1]-a[1])[0];
  if(top && top[1]>=2) out.push(`Ton déclencheur n°1 : <b>${(TRIGGER_LABEL[top[0]]||top[0]).toLowerCase()}</b> (${top[1]} fois). Prépare une parade précise pour ce moment-là.`);
  const now=Date.now(), w1=env.filter(e=>e.at>now-7*DAY).length, w0=env.filter(e=>e.at>now-14*DAY&&e.at<=now-7*DAY).length;
  if(w0>=3 && w1<w0) out.push(`Cette semaine : <b>${w1}</b> ${plural(w1,"envie","envies")} contre ${w0} la semaine d'avant. Ça baisse.`);
  const hours=Array.from({length:24},(_,i)=>({i,n:0})); env.forEach(e=>hours[new Date(e.at).getHours()].n++);
  const p=peakWindow(hours); if(p && p.n>=3) out.push(`Tes envies se concentrent entre <b>${p.a} h et ${p.b} h</b>. Prévois une activité à ce moment-là.`);
  return out.slice(0,3);
}
function entryRow(e){
  const t=e.type;
  const ic = t==="envie" ? (e.ok?`<div class="chip-ic air">${icon("flame",18)}</div>`:`<div class="chip-ic ember">${icon("flame",18)}</div>`)
    : t==="cigarette" ? `<div class="chip-ic ember">${icon("cig",18)}</div>` : `<div class="chip-ic">${icon("pill",18)}</div>`;
  const title = t==="envie" ? (e.ok?"Envie vaincue":"Envie non vaincue") : t==="cigarette" ? ((e.n||1)>1?`${e.n} ${W().many} fumées`:W().One+" fumée") : `Substitut${e.sub?" : "+(SUB_LABEL[e.sub]||e.sub).toLowerCase():""}`;
  const bits=[fDate(e.at)+", "+fTime(e.at)];
  if(e.intensity) bits.push("intensité "+e.intensity+"/5");
  if(e.trigger) bits.push((TRIGGER_LABEL[e.trigger]||e.trigger).toLowerCase());
  return `<div class="row entry">${ic}<div class="grow"><div class="h3" style="font-size:15px">${title}</div><div class="meta">${esc(bits.join(", "))}</div>
    ${e.note?`<div class="small ink2" style="margin-top:2px">${esc(e.note)}</div>`:""}</div>
    <button class="del" data-act="delentry" data-id="${e.id}" aria-label="Supprimer">${icon("trash",18)}</button></div>`;
}

/* ---------- Progrès ---------- */
function viewProgress(){
  const tab=S.ui.prog, s=stats();
  let h=`<div class="page"><div class="head"><div class="row"><h1 class="h1 grow">Progrès</h1>
      <button class="btn sm soft" data-act="share">${icon("share",18)} Partager</button></div></div>
    <div class="seg full">${[["body","Ton corps"],["badges","Trophées"],["plan","Programme"]].map(([k,l])=>`<button class="${tab===k?"on":""}" data-act="prog" data-v="${k}">${l}</button>`).join("")}</div>`;
  if(tab==="body"){
    const el=s.el, nx=nextMilestone(el);
    h+=`<p class="lead" style="padding:16px 6px 4px">${reached(el)} ${plural(reached(el),"étape franchie","étapes franchies")} sur ${MILESTONES.length}. Repères de l'OMS et de Tabac Info Service.</p>
      <div class="block" style="margin-top:10px">${MILESTONES.map(m=>{
        const pr=Math.min(1,el/m.after), done=pr>=1, cur=!done&&nx&&nx.id===m.id;
        return `<div class="ms ${done?"done":cur?"cur":"todo"}"><div class="dot">${icon(done?"check":m.icon,18)}</div>
          <div class="grow"><div class="row"><span class="when grow">${m.label}${done?", le "+fDate(s.quit+m.after):""}</span>${cur?`<span class="when tnum">${Math.floor(pr*100)} %</span>`:""}</div>
          <div class="h3" style="margin-top:2px">${m.title}</div><div class="small ink2" style="margin-top:2px">${m.detail}</div>
          ${cur?`<div class="bar" style="margin-top:10px;height:6px"><i style="width:${pr*100}%"></i></div><div class="meta" style="margin-top:6px">encore ${dur(m.after-el)}</div>`:""}</div></div>`;}).join("")}</div>`;
  }else if(tab==="badges"){
    const bs=badgeState(), n=bs.filter(b=>b.got).length;
    h+=`<div style="padding:16px 6px 4px"><div class="display" style="font-size:44px;font-weight:720;line-height:1">${n}<span class="ash" style="font-size:22px"> / ${bs.length}</span></div>
      <div class="bar" style="margin-top:12px"><i style="width:${n/bs.length*100}%"></i></div></div>`;
    [["time","Temps sans fumer"],["money","Argent économisé"],["cigs",W().Many+" évitées"],["resisted","Envies vaincues"],["missions","Programme"],["sync","Apple Watch"]].forEach(([k,l])=>{
      const list=bs.filter(b=>b.kind===k);
      h+=`<section class="section"><div class="st"><h2 class="h2">${l}</h2><span class="meta">${list.filter(b=>b.got).length} / ${list.length}</span></div>
        <div class="badges">${list.map(b=>`<div class="badge ${b.got?"got":""} ${b.kind}"><div class="medal">${icon(b.icon,22)}</div>
          <div class="t">${esc(b.title)}</div><div class="s">${b.got?(b.at?fDate(b.at):""):esc(b.sub)}</div>
          ${!b.got?`<div class="bar p"><i style="width:${b.prog*100}%"></i></div>`:""}</div>`).join("")}</div></section>`;
    });
  }else{
    const day=s.before?0:Math.floor(s.days)+1, done=missionsDone();
    h+=`<p class="lead" style="padding:16px 6px 4px">30 jours, une action concrète par jour, inspirée des thérapies cognitives et comportementales. ${done} ${plural(done,"mission faite","missions faites")}.</p>
      <div class="block rows" style="margin-top:10px">${MISSIONS.map(m=>{
        const ok=!!S.missions[m.day], open=m.day<=day, cur=m.day===day;
        return `<div class="row" style="align-items:flex-start;${!open?"opacity:.55":""}">
          <button class="icon-btn" ${open?"":"disabled"} style="${ok?"background:var(--air);color:#fff":cur?"box-shadow:inset 0 0 0 2px var(--air);background:var(--paper)":""}" data-act="mission" data-day="${m.day}" aria-label="Jour ${m.day}">${ok?icon("check",18):`<span class="display" style="font-weight:700;font-size:15px">${m.day}</span>`}</button>
          <div class="grow"><div class="h3">${esc(m.title)}${cur?` <span class="meta" style="color:var(--air);font-weight:650">aujourd'hui</span>`:""}</div>
          ${open?`<p class="small ink2" style="margin:3px 0 0">${esc(m.text)}</p>`:`<p class="meta" style="margin:3px 0 0">Débloquée le jour ${m.day}</p>`}</div></div>`;}).join("")}</div>`;
  }
  return h+`</div>`;
}

/* ---------- Santé ---------- */
const SITE_URL=location.origin+location.pathname;
function shortcutGuide(){
  return `<a class="btn air" style="margin-top:12px" href="Souffle.shortcut" download="Souffle.shortcut">${icon("download",20)} Installer le Raccourci Souffle</a>
    <ol class="small" style="padding-left:20px;margin:12px 0 0;line-height:1.55">
    <li style="margin:8px 0">Touche le bouton ci-dessus. Si Safari le télécharge, ouvre-le depuis les téléchargements (flèche ↓), puis <b>Ajouter le raccourci</b>.</li>
    <li style="margin:8px 0">Dans <b>Raccourcis</b>, lance <b>Souffle</b> une fois et autorise l'accès à Santé (pouls au repos, variabilité, oxygène, respiration, pas) et l'ouverture du site.</li>
    <li style="margin:8px 0">Appui long sur le raccourci, <b>Détails</b> (ⓘ), puis <b>Ajouter à l'écran d'accueil</b>, avec l'icône Souffle. Chaque ouverture met tes données à jour.</li>
    <li style="margin:8px 0">En option : onglet <b>Automatisation</b>, <b>Heure de la journée</b>, 21:00, <b>Exécuter immédiatement</b>, raccourci Souffle.</li></ol>
    <a class="btn soft" style="margin-top:14px" href="icone-raccourci.png" target="_blank" rel="noopener">${icon("download",20)} Icône Souffle (appui long, Enregistrer)</a>
    <details style="margin-top:14px"><summary class="small ink2">Le faire à la main</summary>
    <ol class="small" style="padding-left:20px;margin:8px 0 0;line-height:1.55">
    <li style="margin:8px 0">Ouvre l'app <b>Raccourcis</b>, touche <b>＋</b> et nomme le raccourci <b>Souffle</b>.</li>
    <li style="margin:8px 0">Ajoute <b>Rechercher des échantillons de santé</b>. Type : <b>Fréquence cardiaque au repos</b>. Filtre : <b>Date de début est dans les derniers 7 jours</b>.</li>
    <li style="margin:8px 0">Juste dessous, ajoute <b>Calculer les statistiques</b>, puis <b>Moyenne</b>. Son résultat, c'est <i>Moyenne 1</i>.</li>
    <li style="margin:8px 0">Refais ces deux actions pour <b>Variabilité de la fréquence cardiaque</b> (Moyenne 2), <b>Saturation en oxygène</b> (Moyenne 3) et <b>Fréquence respiratoire</b> (Moyenne 4).</li>
    <li style="margin:8px 0">Une dernière fois pour <b>Nombre de pas</b>, avec <b>Somme</b> au lieu de Moyenne.</li>
    <li style="margin:8px 0">Ajoute l'action <b>URL</b> avec l'adresse ci-dessous. Remplace chaque <b>[…]</b> par la variable correspondante.
      <code style="display:block;margin-top:8px;padding:12px;border-radius:12px;background:var(--paper2);font-size:12.5px;word-break:break-all;user-select:all;-webkit-user-select:all">${esc(SITE_URL)}#rhr=[Moyenne 1]&amp;hrv=[Moyenne 2]&amp;o2=[Moyenne 3]&amp;rr=[Moyenne 4]&amp;pas7=[Somme]</code></li>
    <li style="margin:8px 0">Ajoute <b>Ouvrir les URL</b>. Lance le raccourci une fois et autorise l'accès à Santé.</li>
    <li style="margin:8px 0">Touche <b>ⓘ</b>, puis <b>Ajouter à l'écran d'accueil</b>, avec l'icône Souffle. Cette icône devient ton appli : chaque ouverture met tes données à jour.</li>
    <li style="margin:8px 0">En option : <b>Automatisation</b>, <b>Heure de la journée</b>, 21:00, <b>Exécuter immédiatement</b>, raccourci Souffle.</li></ol></details>`;
}
function viewHealth(){
  const keys=Object.keys(S.health.entries).sort(), b=S.health.baseline;
  let h=`<div class="page"><div class="head"><h1 class="h1">Santé</h1>`;
  if(!keys.length){
    return h+`<p class="lead">Ton corps change avant que tu le sentes. Relie ton Apple Watch en 2 minutes : un Raccourci tout prêt s'en charge.</p></div>
      <div class="block"><div class="h3">Mise en place</div>${shortcutGuide()}</div>
      <p class="meta" style="padding:12px 6px">Les valeurs passent dans la fin de l'adresse, après le #. Cette partie n'est jamais envoyée à un serveur : tout reste sur ton iPhone.</p></div>`;
  }
  const last=S.health.entries[keys[keys.length-1]];
  let impr=0, comp=0;
  const cards=METRICS.map(m=>{
    const ser=healthSeries(m.k); if(!ser.length) return "";
    const now=ser[ser.length-1].v, ref=b?b[m.k]:null;
    let badge="";
    if(ref!=null && ser.length>1){ const d=now-ref; comp++; const good=Math.abs(d)<1e-9?null:(m.lower?d<0:d>0); if(good) impr++;
      const col=good===true?"var(--ok)":good===false?"var(--ember)":"var(--ash)";
      const pct=ref?Math.abs(d/ref*100):0;
      badge=`<span class="small" style="font-weight:650;color:${col}">${d>0?"+":"−"}${dec(Math.abs(d),m.dec)} ${m.unit} (${dec(pct,0)} %)</span>`; }
    const vals=ser.map(x=>x.v), mn=Math.min(...vals), mx=Math.max(...vals);
    return `<div class="block"><div class="row"><div class="chip-ic air">${icon(m.icon,20)}</div><div class="grow"><div class="h3">${m.title}</div>${badge||`<span class="meta">Première mesure</span>`}</div></div>
      <div class="row" style="margin-top:14px;gap:22px">
        <div><div class="meta">1re mesure</div><div class="display" style="font-size:26px;font-weight:650;color:var(--ink2)">${dec(ref,m.dec)}</div></div>
        <div><div class="meta">Maintenant</div><div class="display" style="font-size:26px;font-weight:700">${dec(now,m.dec)} <span class="meta">${m.unit}</span></div></div></div>
      ${ser.length>1?line({points:ser.map(x=>({t:x.t,v:x.v,tip:`<b>${fDate(x.t)}</b><br>${dec(x.v,m.dec)} ${m.unit}`})), ref, refLabel:"1re mesure", height:140, yFmt:v=>dec(v,m.dec), xFmt:fDate})
        :`<p class="meta" style="margin:12px 0 0">La courbe apparaît dès ta deuxième journée.</p>`}
      ${ser.length>2?`<p class="meta" style="margin:8px 0 0">Min ${dec(mn,m.dec)}, max ${dec(mx,m.dec)} sur ${ser.length} jours.</p>`:""}
      <p class="small ink2" style="margin:10px 0 0">${m.why}</p>
      ${tableHTML(["Jour",m.unit], ser.slice().reverse().map(x=>[fDate(x.t),dec(x.v,m.dec)]))}</div>`;
  }).join("");
  h+= comp&&impr ? `<p class="lead" style="color:var(--ok);font-weight:600">${impr} ${plural(impr,"indicateur va","indicateurs vont")} déjà dans le bon sens.</p>`
    : `<p class="lead">Moyennes sur 7 jours envoyées par ton Raccourci. Reviens chaque jour : la courbe se construit.</p>`;
  h+=`<p class="meta" style="margin:6px 0 0">Mis à jour ${fDateLong(last.at)} à ${fTime(last.at)}</p></div>${cards}
    <p class="meta" style="padding:12px 6px">Comparaison avec ta première mesure (${b?fDate(new Date(b.day+"T12:00")):"—"}). Ce sont des tendances, pas un diagnostic.</p>
    <details class="block"><summary class="h3" style="cursor:pointer">Revoir la mise en place du Raccourci</summary>${shortcutGuide()}</details></div>`;
  return h;
}

/* ---------- Toi ---------- */
function viewMe(){
  const p=S.profile;
  return `<div class="page"><div class="head"><h1 class="h1">Toi</h1><p class="lead">Tes infos restent sur ce téléphone.</p></div>
  <div class="block">
    <label class="field" style="margin-top:0"><span>Prénom</span><input class="inp" data-f="firstName" value="${esc(p.firstName)}" autocomplete="given-name"></label>
    <label class="field"><span>Dernière cigarette</span><input class="inp" type="datetime-local" data-f="quitDate" value="${toLocalInput(new Date(p.quitDate))}"></label>
  </div>
  <section class="section"><div class="st"><h2 class="h2">Tes habitudes d'avant</h2></div><div class="block">
    ${habitsHTML(p,"me")}
    <p class="meta" style="margin:12px 0 0">Coût d'une ${W().one} : ${eur(pricePerCig(p))}.</p>
  </div></section>
  <section class="section"><div class="st"><h2 class="h2">Tes raisons</h2></div><div class="block">
    <div class="rows">${(p.reasons||[]).map((r,i)=>`<div class="row"><div class="grow">${esc(r)}</div><button class="del" data-act="delreason" data-i="${i}" aria-label="Supprimer">${icon("x",18)}</button></div>`).join("")||`<p class="small ink2" style="margin:0">Ajoute ce qui te motive. Elles s'affichent sur l'accueil et pendant le SOS.</p>`}</div>
    <div class="row" style="margin-top:12px"><input class="inp grow" id="newreason" placeholder="Ajouter une raison"><button class="btn air" style="width:54px;flex:none;padding:0" data-act="addreason" aria-label="Ajouter">${icon("plus",22)}</button></div>
  </div></section>
  <section class="section"><div class="st"><h2 class="h2">Tes objectifs d'épargne</h2></div><div class="block">
    <div class="rows">${(p.rewards||[]).map((r,i)=>`<div class="row"><div class="chip-ic sun">${icon("gift",20)}</div><div class="grow"><div class="h3">${esc(r.name)}</div><div class="meta">${eur(r.price,true)}</div></div>
      <button class="del" data-act="delreward" data-i="${i}" aria-label="Supprimer">${icon("x",18)}</button></div>`).join("")||`<p class="small ink2" style="margin:0">Choisis à quoi servira l'argent que tu ne brûles plus.</p>`}</div>
    <div class="row" style="margin-top:12px;gap:8px"><input class="inp grow" id="rwname" placeholder="Je m'offre…"><input class="inp tnum" id="rwprice" inputmode="numeric" placeholder="€" style="width:86px"><button class="btn air" style="width:54px;flex:none;padding:0" data-act="addreward" aria-label="Ajouter">${icon("plus",22)}</button></div>
    <p class="meta" style="margin:10px 0 0">L'argent remplit le premier objectif, puis le suivant.</p>
  </div></section>
  <section class="section"><div class="st"><h2 class="h2">Apparence</h2></div><div class="seg full">${[["auto","Automatique"],["light","Clair"],["dark","Sombre"]].map(([k,l])=>`<button class="${(S.theme||"auto")===k?"on":""}" data-act="theme" data-v="${k}">${l}</button>`).join("")}</div></section>
  <section class="section"><div class="st"><h2 class="h2">Aide, pour de vrai</h2></div><div class="block">
    <a class="btn air" href="tel:3989">${icon("phone",20)} Appeler Tabac Info Service, 39 89</a>
    <a class="btn soft" style="margin-top:10px" href="https://www.tabac-info-service.fr" target="_blank" rel="noopener">tabac-info-service.fr</a>
    <p class="small ink2" style="margin:12px 0 0">Des tabacologues gratuits par téléphone. Les substituts nicotiniques sont remboursés sur prescription (médecin, infirmier, sage-femme…) : avec, les chances de réussir sont nettement meilleures.</p>
  </div></section>
  <section class="section"><div class="st"><h2 class="h2">Tes données</h2></div><div class="block">
    <p class="small ink2" style="margin:0 0 12px">Tout est stocké dans Safari sur ce téléphone. Fais une sauvegarde de temps en temps.</p>
    <button class="btn soft" data-act="export">${icon("download",20)} Exporter une sauvegarde</button>
    <label class="btn soft" style="margin-top:10px">${icon("upload",20)} Restaurer une sauvegarde<input type="file" accept="application/json,.json" id="importfile" class="hide"></label>
    <button class="btn line" style="margin-top:10px" data-act="restart">Recommencer à partir de maintenant</button>
    <button class="btn line" style="margin-top:10px;color:var(--ember)" data-act="erase">Tout effacer</button>
  </div></section>
  <p class="meta" style="padding:18px 6px 0">Étapes du corps : OMS et Tabac Info Service. Vie regagnée : estimation d'environ 20 minutes par cigarette (University College London, 2024). Souffle ne remplace pas un avis médical.</p>
  </div>`;
}
function stepper(f,label,mn,mx,val){
  return `<div class="field"><span>${label}</span><div class="stepper"><b>${val}</b><div class="pm">
    <button data-act="step" data-f="${f}" data-d="-1" data-min="${mn}" data-max="${mx}" aria-label="Moins">−</button>
    <button data-act="step" data-f="${f}" data-d="1" data-min="${mn}" data-max="${mx}" aria-label="Plus">+</button></div></div></div>`;
}

/* ---------- Trophées débloqués ---------- */
function checkUnlocks(){
  const fresh=badgeState().filter(b=>b.got && !S.seen[b.id]);
  if(!fresh.length) return;
  fresh.forEach(b=>S.seen[b.id]=1); save();
  if(S.ui.silentUnlock){ delete S.ui.silentUnlock; save(); return; }
  const b=fresh.sort((a,c)=>c.at-a.at)[0];
  const el=document.createElement("div"); el.className="unlock";
  el.innerHTML=`<div class="card"><div class="medal" style="${b.kind==="money"?"background:linear-gradient(160deg,var(--sun),#F4CF6B)":b.kind==="resisted"?"background:linear-gradient(160deg,var(--ember),#F59A6A)":""}">${icon(b.icon,40)}</div>
    <div class="meta">Nouveau trophée</div><div class="h1" style="margin-top:4px">${esc(b.title)}</div><p class="ink2" style="margin:6px 0 20px">${esc(b.sub)}${fresh.length>1?`, et ${fresh.length-1} autre${fresh.length>2?"s":""}`:""}</p>
    <button class="btn air" data-act="closeunlock">Continuer</button></div>`;
  document.body.appendChild(el);
}

/* ============================================================
   Journal (feuille modale)
   ============================================================ */
let J=null;
function openJournal(preset){
  J={type:"envie", ok:true, intensity:3, trigger:null, n:1, sub:"gomme", note:"", at:null, ...(preset||{})};
  renderJournal();
}
function renderJournal(){
  let el=document.getElementById("jmodal");
  if(!el){ el=document.createElement("div"); el.id="jmodal"; el.className="modal"; document.body.appendChild(el); }
  const t=J.type;
  el.innerHTML=`<div class="panel" role="dialog" aria-label="Noter dans le journal"><div class="grab"></div>
    <div class="row" style="margin-bottom:14px"><h2 class="h2 grow">Noter</h2><button class="icon-btn" data-act="jclose" aria-label="Fermer">${icon("x",20)}</button></div>
    <div class="seg full">${[["envie","Une envie"],["cigarette","Une "+W().one],["substitut","Un substitut"]].map(([k,l])=>`<button class="${t===k?"on":""}" data-act="jtype" data-v="${k}">${l}</button>`).join("")}</div>
    ${t==="envie"?`
      <div class="field"><span>Intensité</span><div class="scale">${[1,2,3,4,5].map(i=>`<button class="${J.intensity===i?"on":""}" data-act="jint" data-v="${i}">${i}</button>`).join("")}</div></div>
      <div class="field"><span>Et alors ?</span><div class="seg full"><button class="${J.ok?"on":""}" data-act="jok" data-v="1">Je n'ai pas fumé</button><button class="${!J.ok?"on":""}" data-act="jok" data-v="0">J'ai fumé</button></div></div>`:""}
    ${t==="cigarette"?`<div class="field"><span>Combien</span><div class="stepper"><b>${J.n}</b><div class="pm"><button data-act="jn" data-d="-1">−</button><button data-act="jn" data-d="1">+</button></div></div></div>
      <p class="small ink2" style="margin:10px 2px 0">Un faux pas n'efface pas tes progrès. Elles seront déduites de tes ${W().many} évitées et de l'argent, pour des chiffres honnêtes.</p>`:""}
    ${t==="substitut"?`<div class="field"><span>Lequel</span><div class="chips">${SUBSTITUTES.map(([k,l])=>`<button class="chip ${J.sub===k?"on":""}" data-act="jsub" data-v="${k}">${l}</button>`).join("")}</div></div>`:""}
    ${t!=="substitut"?`<div class="field"><span>Déclencheur</span><div class="chips">${TRIGGERS.map(([k,l])=>`<button class="chip ${J.trigger===k?"on":""}" data-act="jtrig" data-v="${k}">${l}</button>`).join("")}</div></div>`:""}
    <label class="field"><span>Note (facultatif)</span><textarea class="inp" id="jnote" rows="2" placeholder="Où tu étais, ce que tu ressentais…">${esc(J.note)}</textarea></label>
    <label class="field"><span>Quand</span><input class="inp" type="datetime-local" id="jat" value="${toLocalInput(J.at?new Date(J.at):new Date())}"></label>
    <button class="btn air" style="margin-top:18px" data-act="jsave">Enregistrer</button></div>`;
}
function closeJournal(){ const el=document.getElementById("jmodal"); if(el) el.remove(); J=null; }
function saveJournal(){
  const note=(document.getElementById("jnote")||{}).value||"";
  const atv=(document.getElementById("jat")||{}).value;
  const at=atv?new Date(atv).getTime():Date.now();
  const base={id:uid(), at, note:note.trim()||undefined};
  if(J.type==="envie"){
    S.log.push({...base, type:"envie", ok:J.ok, intensity:J.intensity, trigger:J.trigger||undefined});
    if(!J.ok) S.log.push({id:uid(), at, type:"cigarette", n:1, trigger:J.trigger||undefined});
  }else if(J.type==="cigarette") S.log.push({...base, type:"cigarette", n:J.n, trigger:J.trigger||undefined});
  else S.log.push({...base, type:"substitut", sub:J.sub, n:1});
  save(); closeJournal(); toast("Noté dans ton journal"); render(true);
}

/* ============================================================
   SOS
   ============================================================ */
const PHASES=[["Inspire",4,1],["Bloque",4,1],["Expire lentement",6,.45]];
const SURF=[
  "Remarque l'envie. Ne la combats pas, regarde-la.",
  "Où est-elle dans ton corps ? La gorge, la poitrine, les mains ?",
  "Elle monte comme une vague. C'est normal.",
  "Respire doucement. Tu n'as rien à faire, juste observer.",
  "La vague arrive à son sommet. Elle ne peut pas monter plus haut.",
  "Elle commence déjà à redescendre.",
  "Chaque envie que tu surfes rend la suivante plus faible.",
  "Encore quelques respirations. Tu es en train de gagner.",
  "La vague est passée. Toi, tu es toujours là.",
];
let SOS=null;
function openSOS(){
  const el=document.createElement("div"); el.className="sos"; el.id="sos";
  document.body.appendChild(el);
  SOS={mode:"coach", start:performance.now(), raf:0, ph:-1, enc:-1, done:false, entry:null, game:null, tip:Math.floor(Math.random()*TECHNIQUES.length), coach:newCoach()};
  renderSOS(); buzz(25); cStart();
}
function sosLines(){
  const p=S.profile, s=stats(), L=["Une envie dure 3 à 5 minutes. Tu es déjà dedans."];
  (p.reasons||[]).forEach(r=>L.push("« "+r+" »"));
  if(!s.before){ L.push(`${int(s.days)} ${plural(Math.floor(s.days),"jour","jours")}. Tu ne vas pas les jeter pour 5 minutes.`); L.push(`${eur(s.money,true)} gardés. Une cigarette ne vaut pas ça.`); }
  L.push("Bois un grand verre d'eau froide juste après.");
  L.push("Chaque envie que tu bats rend la suivante plus faible.");
  return L;
}
function renderSOS(){
  const el=document.getElementById("sos"); if(!el) return;
  cancelAnimationFrame(SOS.raf); if(SOS.game) stopGame();
  if(SOS.entry){ el.innerHTML=sosResultHTML(); return; }
  const m=SOS.mode;
  let stage="";
  if(m==="coach") stage=`<div class="coach"><div class="chat" id="cchat"></div><div class="cchoices" id="cchoices"></div></div>`;
  else if(m==="breath") stage=`<div class="breath"><div class="o g"></div><div class="o f" id="bf"></div><div class="lbl"><span id="bl">Inspire</span><span class="n" id="bn">4</span></div></div>
     <div class="enc" id="enc" style="margin-top:26px"></div>`;
  else if(m==="surf") stage=`<svg class="wave" viewBox="0 0 400 90" preserveAspectRatio="none"><path id="wv" fill="none" stroke="rgba(255,255,255,.85)" stroke-width="3" stroke-linecap="round"/></svg>
     <div class="surf" id="surf"></div>`;
  else if(m==="game") stage=`<div class="row" style="width:100%;justify-content:space-between;margin-bottom:10px"><span class="display" style="font-size:20px;font-weight:650">Dissipe la fumée</span><span class="tnum" id="gs">0</span></div>
     <div class="game" id="game"></div><p class="small" style="opacity:.85;margin:10px 0 0">Touche les nuages avant qu'ils grossissent. Record : ${S.best.game||0}</p>`;
  else{ const t=TECHNIQUES[SOS.tip%TECHNIQUES.length];
    stage=`<div class="tipcard"><div class="meta" style="color:rgba(255,255,255,.75)">Technique ${SOS.tip%TECHNIQUES.length+1} sur ${TECHNIQUES.length}</div><div class="h2" style="margin-top:6px">${t.title}</div>
      <p style="margin:10px 0 0;font-size:17px;line-height:1.5">${t.text}</p></div>
      <button class="btn white sm" style="margin-top:18px" data-act="sostip">Une autre technique</button>`; }
  el.innerHTML=`<div class="top"><button class="icon-btn" data-act="sosclose" aria-label="Fermer">${icon("x",20)}</button>
      <span class="tnum" id="sr" style="font-weight:650;font-size:17px">3:00</span></div>
    <div class="seg full sosmodes" style="margin-top:12px">${[["coach","Coach"],["breath","Respirer"],["surf","Surfer"],["game","Jeu"],["tip","Astuces"]].map(([k,l])=>`<button class="${m===k?"on":""}" data-act="sosmode" data-v="${k}">${l}</button>`).join("")}</div>
    <div class="stage ${m==="coach"?"stage-coach":""}">${stage}</div>
    ${m==="coach"?`<div class="row" style="justify-content:center;gap:22px"><button class="ghost" style="margin:6px 0 0" data-act="sosok">C'est passé</button><button class="ghost" style="margin:6px 0 0" data-act="sosslip">J'ai fumé</button></div>`
      :`<button class="btn white" data-act="sosok" id="sok">C'est passé, je n'ai pas fumé</button>
    <button class="ghost" data-act="sosslip">J'ai fumé</button>`}`;
  if(m==="game") startGame();
  if(m==="surf") SOS.surf0=performance.now();
  if(m==="coach") renderCoach();
  SOS.ph=-1; SOS.enc=-1;
  SOS.raf=requestAnimationFrame(sosLoop);
}
function sosLoop(t){
  if(!SOS||SOS.entry) return;
  const el=(t-SOS.start)/1000, rem=Math.max(0,180-el);
  set("sr", rem>0? Math.floor(rem/60)+":"+String(Math.floor(rem%60)).padStart(2,"0") : "0:00");
  if(!SOS.done && rem<=0){ SOS.done=true; set("sok","L'envie est passée"); buzz([30,60,30]); }
  const C=SOS.coach;
  if(C && C.timerEnd){
    const left=Math.max(0,C.timerEnd-Date.now());
    set("ctime", Math.floor(left/60000)+":"+String(Math.floor(left/1000)%60).padStart(2,"0"));
    const bar=document.getElementById("cbar"); if(bar) bar.style.width=(100-left/(C.timerLen*10))+"%";
    if(left<=0){ const f=C.onTimer; C.timerEnd=null; C.onTimer=null; C.choices=null; buzz([20,40,20]);
      if(SOS.mode!=="coach"){ SOS.mode="coach"; renderSOS(); } if(f) f(); }
  }
  if(SOS.mode==="breath"){
    const cyc=14; let x=el%cyc, i=0; while(x>=PHASES[i][1]){ x-=PHASES[i][1]; i++; }
    if(i!==SOS.ph){ SOS.ph=i; const f=document.getElementById("bf");
      if(f){ f.style.transitionDuration=PHASES[i][1]+"s"; f.style.transform="scale("+PHASES[i][2]+")"; }
      set("bl",PHASES[i][0]); buzz(i===1?10:18); }
    set("bn",String(Math.max(1,Math.ceil(PHASES[i][1]-x))));
    const ei=Math.floor(el/11);
    if(ei!==SOS.enc){ SOS.enc=ei; const L=sosLines(), e=document.getElementById("enc");
      if(e){ e.style.opacity=0; setTimeout(()=>{ e.textContent=L[ei%L.length]; e.style.opacity=1; },300); } }
  }else if(SOS.mode==="surf"){
    const el=(t-(SOS.surf0||SOS.start))/1000;
    const k=Math.min(SURF.length-1,Math.floor(el/9));
    if(k!==SOS.enc){ SOS.enc=k; const e=document.getElementById("surf"); if(e){ e.style.opacity=0; setTimeout(()=>{ e.textContent=SURF[k]; e.style.opacity=1; },350); } }
    const amp = 34*Math.sin(Math.min(1,el/80)*Math.PI)+4;   // la vague monte puis redescend
    const w=document.getElementById("wv");
    if(w){ let d="M0,"+45; for(let xx=0;xx<=400;xx+=8){ d+=` L${xx},${(45-amp*Math.sin(xx/34+el*1.6)*Math.exp(-Math.pow((xx-200)/170,2))).toFixed(1)}`; } w.setAttribute("d",d); }
  }
  SOS.raf=requestAnimationFrame(sosLoop);
}
function sosResultHTML(){
  const e=SOS.entry, n=resistedCount();
  return `<div class="top"><span></span><button class="icon-btn" data-act="sosclose" aria-label="Fermer">${icon("x",20)}</button></div>
    <div class="stage" style="justify-content:flex-start;padding-top:6vh;overflow:auto">
      <div style="width:84px;height:84px;border-radius:50%;background:rgba(255,255,255,.22);display:grid;place-items:center;margin-bottom:16px">${icon(e.ok?"check":"wind",40)}</div>
      <div class="h1" style="color:#fff">${e.ok?"Envie battue.":"Ce n'est pas un échec."}</div>
      <p style="margin:10px 0 0;font-size:17px;max-width:380px;opacity:.95">${e.ok?`${n} ${plural(n,"envie vaincue","envies vaincues")} depuis l'arrêt. Ton cerveau apprend à chaque fois.`
        :"Un faux pas n'efface pas ce que ton corps a déjà réparé. Repère ce qui a déclenché l'envie, et on repart."}</p>
      ${e.intensity&&e.after!=null?`<p class="display" style="margin:14px 0 0;font-size:20px;font-weight:650">Intensité ${e.intensity} → ${e.after}</p>`:""}
      ${!e.ok&&e.trigger&&TRIGGER_COACH[e.trigger]?`<div class="tipcard" style="margin-top:20px"><div class="small" style="font-weight:650;opacity:.85">La prochaine fois (${(TRIGGER_LABEL[e.trigger]||"").toLowerCase()})</div><p style="margin:6px 0 0">${TRIGGER_COACH[e.trigger].act}</p></div>`:""}
      ${heavyCravings()?`<div class="tipcard" style="margin-top:14px"><p style="margin:0">Tes envies sont souvent fortes ces derniers jours. Ce n'est pas un manque de volonté : un tabacologue (39 89, gratuit) ou ton médecin peuvent t'aider avec des substituts bien dosés.</p></div>`:""}
      <div style="width:100%;max-width:420px;text-align:left;margin-top:26px">
        <div class="small" style="font-weight:600;margin-bottom:8px;opacity:.9">Intensité de l'envie</div>
        <div class="scale">${[1,2,3,4,5].map(i=>`<button style="${e.intensity===i?"background:#fff;color:#16222B":"background:rgba(255,255,255,.18);color:#fff"}" data-act="sint" data-v="${i}">${i}</button>`).join("")}</div>
        <div class="small" style="font-weight:600;margin:18px 0 8px;opacity:.9">Ce qui l'a déclenchée</div>
        <div class="chips">${TRIGGERS.map(([k,l])=>`<button class="chip" style="${e.trigger===k?"background:#fff;color:#16222B":"background:rgba(255,255,255,.18);color:#fff"}" data-act="strig" data-v="${k}">${l}</button>`).join("")}</div>
      </div></div>
    ${e.ok?"":`<a class="btn" href="tel:3989" style="background:rgba(255,255,255,.2);color:#fff;margin-bottom:10px">${icon("phone",20)} Parler à un tabacologue, 39 89</a>`}
    <button class="btn white" data-act="sosclose">Terminer</button>`;
}
function sosResult(ok){
  const at=Date.now(), secs=Math.round((performance.now()-SOS.start)/1000);
  const entry={id:uid(), at, type:"envie", ok, sos:secs};
  const cd=SOS.coach&&SOS.coach.d;
  if(cd){ if(cd.intensity) entry.intensity=cd.intensity; if(cd.after!=null) entry.after=cd.after; if(cd.trigger) entry.trigger=cd.trigger; if(cd.thought) entry.thought=cd.thought; if(cd.intensity) entry.coach=true; }
  S.log.push(entry);
  if(!ok) S.log.push({id:uid(), at, type:"cigarette", n:1, link:entry.id, trigger:entry.trigger});
  save(); SOS.entry=entry; if(SOS.coach){ SOS.coach.dead=true; } cancelAnimationFrame(SOS.raf); if(SOS.game) stopGame();
  buzz(ok?[30,50,30]:60); renderSOS();
}
function updateSOSEntry(k,v){
  const e=S.log.find(x=>x.id===SOS.entry.id); if(!e) return;
  e[k]= e[k]===v ? undefined : v; SOS.entry=e;
  if(k==="trigger"){ const c=S.log.find(x=>x.link===e.id); if(c) c.trigger=e.trigger; }
  save(); renderSOS();
}
/* ---------- Coach ---------- */
function newCoach(){ return {msgs:[], choices:null, typing:false, d:{}, round:1, timerEnd:null, timerLen:0, onTimer:null, q:Promise.resolve(), dead:false}; }
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function fill(t){
  const s=stats(), w=W(), n=resistedCount();
  return t.replace(/\{dur\}/g,dur(s.el)).replace(/\{money\}/g,eur(s.money,true)).replace(/\{years\}/g,S.profile.years)
    .replace(/\{resisted\}/g,`${n} ${plural(n,"envie","envies")}`).replace(/\{one\}/g,w.one).replace(/\{many\}/g,w.many);
}
function alive(C){ return SOS && SOS.coach===C && !C.dead; }
function cSay(lines){
  const C=SOS.coach; lines=[].concat(lines);
  C.q=C.q.then(async()=>{
    for(const l of lines){
      if(!alive(C)) return;
      C.typing=true; renderCoach();
      await sleep(REDUCED()?120:Math.min(1500,420+l.length*13));
      if(!alive(C)) return;
      C.typing=false; C.msgs.push({who:"c",t:l}); renderCoach();
    }
  });
}
function cAsk(choices){ const C=SOS.coach; C.q=C.q.then(()=>{ if(alive(C)){ C.choices=choices; renderCoach(); } }); }
function cThen(fn){ const C=SOS.coach; C.q=C.q.then(()=>{ if(alive(C)) fn(); }); }
function cPick(i){
  const C=SOS&&SOS.coach, ch=C&&C.choices&&C.choices[i]; if(!ch) return;
  C.choices=null; C.msgs.push({who:"u",t:ch.label}); renderCoach(); buzz(8); ch.fn();
}
function renderCoach(){
  if(!SOS||SOS.mode!=="coach") return;
  const C=SOS.coach, chat=document.getElementById("cchat"), ch=document.getElementById("cchoices"); if(!chat) return;
  chat.innerHTML=`<div class="sysline">Coach guidé, inspiré des méthodes des tabacologues. Pour parler à un vrai spécialiste : <a href="tel:3989">39 89</a>.</div>`+
    C.msgs.map(m=> m.who==="t"
      ? `<div class="bub c timer"><div class="row" style="gap:10px"><span>${m.done?"Deux minutes passées":"Je reste avec toi"}</span><span class="grow"></span><b class="tnum" ${m.done?"":'id="ctime"'}>${m.done?"✓":"2:00"}</b></div>${m.done?"":`<div class="tbar"><i id="cbar"></i></div>`}</div>`
      : `<div class="bub ${m.who}">${esc(m.t)}</div>`).join("")+
    (C.typing?`<div class="bub c typing" aria-label="Le coach écrit"><i></i><i></i><i></i></div>`:"");
  ch.innerHTML=(C.choices||[]).map((c,i)=>`<button data-act="cpick" data-i="${i}">${esc(c.label)}</button>`).join("");
  chat.scrollTop=chat.scrollHeight;
}
function topTrigger(){
  const tr={}; cravings().filter(e=>e.trigger).forEach(e=>tr[e.trigger]=(tr[e.trigger]||0)+1);
  const t=Object.entries(tr).sort((a,b)=>b[1]-a[1])[0]; return t&&t[1]>=2?t[0]:null;
}
function inPeakHour(){
  const h=Array.from({length:24},(_,i)=>({i,n:0})); cravings().forEach(e=>h[new Date(e.at).getHours()].n++);
  const p=peakWindow(h), now=new Date().getHours(); return p&&p.n>=4&&now>=p.a&&now<p.b;
}
function heavyCravings(){
  const r=cravings().filter(e=>e.at>Date.now()-7*DAY), ints=r.filter(e=>e.intensity).map(e=>e.intensity);
  return r.length>=10 && ints.length>=5 && ints.reduce((a,b)=>a+b,0)/ints.length>=3.5;
}
const intensityChoices=fn=>[1,2,3,4,5].map(i=>({label:`${i}, ${INTENSITY_LABEL[i].toLowerCase()}`, fn:()=>fn(i)}));

function cStart(){
  const name=(S.profile.firstName||"").trim();
  cSay([`Je suis là${name?", "+name:""}.`,
    "Une envie, c'est une vague : elle monte, atteint un pic, puis redescend. Souvent en quelques minutes. On la traverse ensemble, étape par étape.",
    "Là, tout de suite, elle est forte comment, sur 5 ?"]);
  cAsk(intensityChoices(cIntensity));
}
function cIntensity(i){
  const C=SOS.coach; C.d.intensity=i;
  cSay(i>=4?`D'accord, ${INTENSITY_LABEL[i].toLowerCase()}. C'est exactement le moment où ça se joue, et tu as tout ce qu'il faut pour la passer.`
     : i===3?"Forte, mais tu es plus fort qu'elle. On s'en occupe."
     : "Ok. Une envie comme ça se gère bien. On la prend quand même au sérieux.");
  const top=topTrigger();
  cSay(["Qu'est-ce qui se passe autour de toi, là ?"].concat(top?[`D'après ton journal, chez toi c'est souvent : ${(TRIGGER_LABEL[top]||"").toLowerCase()}.`]:[]));
  const list=top?[[top,TRIGGER_LABEL[top]]].concat(TRIGGERS.filter(t=>t[0]!==top)):TRIGGERS;
  cAsk(list.map(([k,l])=>({label:k==="autre"?"Je ne sais pas":l, fn:()=>cTrigger(k)})));
}
function cTrigger(k){
  const C=SOS.coach; C.d.trigger=k; const tc=TRIGGER_COACH[k]||TRIGGER_COACH.autre;
  cSay([tc.why].concat(inPeakHour()?["Et c'est aussi ton heure à risque d'après tes stats. Normal que ce soit plus dur maintenant."]:[]));
  cSay("Et dans ta tête, là, ça dit quoi ?");
  cAsk(THOUGHTS.map(([k2,l])=>({label:l, fn:()=>cThought(k2)})));
}
function cThought(k){
  const C=SOS.coach; C.d.thought=k; const t=THOUGHTS.find(x=>x[0]===k);
  cSay(t[2].map(fill));
  const rs=S.profile.reasons||[];
  if(rs.length){
    const r=rs[Math.floor(Math.random()*rs.length)];
    cSay([`Tu m'as dit pourquoi tu arrêtes : « ${r} »`,"C'est toujours vrai ?"]);
    cAsk(["Oui","Plus que jamais","Je ne sais plus"].map(l=>({label:l, fn:()=>cReason(l)})));
  }else cThen(cFacts);
}
function cReason(ans){
  if(ans==="Je ne sais plus") cSay(["C'est normal d'en douter pendant une envie : c'est l'envie qui parle, pas toi.","On ne prend aucune décision pendant une envie. Dans dix minutes, tu retrouveras pourquoi tu fais ça."]);
  else cSay(ans==="Plus que jamais"?"Alors accroche-toi à ça. C'est plus fort que n'importe quelle envie.":"Alors garde-la en tête. C'est elle qui compte, pas l'envie.");
  cThen(cFacts);
}
function cFacts(){
  const s=stats(), w=W(), lines=[];
  if(!s.before) lines.push(`Depuis l'arrêt : ${dur(s.el)} sans fumer, ${eur(s.money,true)} gardés, ${int(s.avoided)} ${w.many} pas fumées.`);
  const b=S.health.baseline, keys=Object.keys(S.health.entries).sort();
  if(b&&keys.length>1){ const l=S.health.entries[keys[keys.length-1]]; if(b.rhr!=null&&l.rhr!=null&&l.rhr<b.rhr-.5) lines.push(`Et ta montre le voit : ton pouls au repos a baissé de ${dec(b.rhr-l.rhr,0)} bpm.`); }
  if(lines.length) cSay(lines);
  cThen(cAction);
}
function cAction(){
  const C=SOS.coach, tc=TRIGGER_COACH[C.d.trigger]||TRIGGER_COACH.autre;
  cSay(["On laisse passer deux minutes. Pendant ce temps :", tc.act]);
  cAsk([{label:"C'est parti", fn:()=>cTimer(120)},{label:"Respirer avec le guide", fn:()=>{ cTimer(120); SOS.mode="breath"; renderSOS(); }}]);
}
function cTimer(sec){
  const C=SOS.coach;
  C.msgs.push({who:"t"}); C.timerLen=sec; C.timerEnd=Date.now()+sec*1000;
  C.onTimer=()=>{ C.msgs.forEach(m=>{ if(m.who==="t") m.done=true; }); renderCoach(); cRecheck(); };
  C.choices=[{label:"Ça va déjà mieux", fn:()=>{ const f=C.onTimer; C.timerEnd=null; C.onTimer=null; if(f) f(); }}];
  renderCoach();
}
function cRecheck(){
  cSay("Et maintenant, elle est à combien ?");
  cAsk(intensityChoices(cAfter));
}
function cAfter(i2){
  const C=SOS.coach, i=C.d.intensity; C.d.after=i2;
  if(i2<i || i2<=1){
    cSay([i2<i?`Elle est passée de ${i} à ${i2}. Tu viens de prouver que tu peux la faire redescendre sans fumer.`:"Elle est au plus bas. Bien joué.",
      "Chaque envie traversée comme ça affaiblit la suivante. C'est comme ça que ton cerveau se libère de la nicotine."]);
    cAsk([{label:"C'est passé, je n'ai pas fumé", fn:()=>sosResult(true)}]);
  }else if(C.round===1){
    C.round=2;
    cSay([i2>i?"Elle est montée. Ça arrive, surtout dans les premiers jours, et ça ne veut pas dire que tu vas craquer.":"Elle tient bon. Ça arrive, et ça ne veut pas dire que tu vas craquer.",
      "On change d'outil. Lequel te parle le plus ?"]);
    cAsk(SECOND_TOOLS.map(([k,l])=>({label:l, fn:()=>cTool(k)})));
  }else{
    const mins=Math.max(1,Math.round((performance.now()-SOS.start)/60000));
    cSay([`Tu tiens depuis ${mins} minute${mins>1?"s":""}. C'est déjà une victoire.`,
      "Si les envies restent aussi fortes, ce n'est pas un manque de volonté : c'est ton corps qui a besoin d'aide. Un tabacologue (39 89, gratuit) ou ton médecin peuvent t'aider à ajuster des substituts. Ça change vraiment la donne."]);
    cAsk([{label:"Appeler le 39 89", fn:()=>{ location.href="tel:3989"; cAsk([{label:"J'ai tenu", fn:()=>sosResult(true)},{label:"J'ai fumé", fn:()=>sosResult(false)}]); }},
      {label:"Je tiens, ça passe", fn:()=>sosResult(true)},{label:"J'ai fumé", fn:()=>sosResult(false)}]);
  }
}
function cTool(k){
  const t=SECOND_TOOLS.find(x=>x[0]===k);
  cSay(t[2]);
  cThen(()=>{
    if(k==="surf"){ cTimer(120); SOS.mode="surf"; renderSOS(); }
    else if(k==="game"){ cTimer(90); SOS.mode="game"; renderSOS(); }
    else cTimer(120);
  });
}

function closeSOS(){ if(SOS){ cancelAnimationFrame(SOS.raf); if(SOS.game) stopGame(); } SOS=null; const el=document.getElementById("sos"); if(el) el.remove(); render(true); }

/* Mini-jeu : dissipe la fumée */
function startGame(){
  const box=document.getElementById("game"); if(!box) return;
  const g={score:0, items:[], iv:0, raf:0, t0:performance.now()};
  SOS.game=g;
  const spawn=()=>{
    const r=box.getBoundingClientRect(), size=46+Math.random()*24;
    const d=document.createElement("div"); d.className="puff";
    const it={el:d, x:size/2+Math.random()*(r.width-size), y:size/2+Math.random()*(r.height-size), s:size, born:performance.now()};
    d.style.left=it.x+"px"; d.style.top=it.y+"px"; d.style.width=d.style.height=size+"px";
    d.addEventListener("pointerdown",ev=>{ ev.preventDefault(); if(it.dead) return; it.dead=true; g.score++; set("gs",String(g.score)); d.classList.add("pop"); buzz(8); setTimeout(()=>d.remove(),200); });
    box.appendChild(d); g.items.push(it);
  };
  g.iv=setInterval(()=>{ spawn(); if(Math.random()<.35) spawn(); }, 650);
  const loop=t=>{
    g.items.forEach(it=>{ if(it.dead) return; const age=(t-it.born)/1000; const sc=1+age*.55;
      it.el.style.transform=`translate(-50%,-50%) scale(${sc})`; it.el.style.opacity=Math.max(0,1-age/4.5);
      if(age>4.5){ it.dead=true; it.el.remove(); } });
    g.items=g.items.filter(it=>!it.dead);
    g.raf=requestAnimationFrame(loop);
  };
  g.raf=requestAnimationFrame(loop);
}
function stopGame(){
  const g=SOS&&SOS.game; if(!g) return;
  clearInterval(g.iv); cancelAnimationFrame(g.raf);
  if(g.score>(S.best.game||0)){ S.best.game=g.score; save(); }
  SOS.game=null;
}
function buzz(p){ try{ navigator.vibrate&&navigator.vibrate(p); }catch(e){} }

/* ============================================================
   Carte de progrès à partager
   ============================================================ */
async function shareCard(){
  const s=stats(), W=1080, H=1350, cv=document.createElement("canvas"); cv.width=W; cv.height=H;
  const x=cv.getContext("2d");
  try{ await document.fonts.ready; }catch(e){}
  const c=s.before?0:clarity(s.el), v=skyVarsFixed(c);
  const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,v.top); g.addColorStop(.6,v.mid); g.addColorStop(1,v.low);
  x.fillStyle=g; x.fillRect(0,0,W,H);
  const sun=x.createRadialGradient(W-140,160,10,W-140,160,420); sun.addColorStop(0,`rgba(255,244,214,${.9*v.sun})`); sun.addColorStop(1,"rgba(255,226,160,0)");
  x.fillStyle=sun; x.fillRect(0,0,W,H);
  for(let i=0;i<6;i++){ x.fillStyle=`rgba(120,126,130,${.35*v.smoke})`; x.beginPath(); x.ellipse(120+i*170,260+((i*137)%380),260,80,0,0,7); x.fill(); }
  const F='"Bricolage Grotesque", system-ui, sans-serif';
  x.fillStyle="#fff"; x.textBaseline="alphabetic";
  x.font=`600 44px ${F}`; x.fillText("Souffle",80,120);
  const d=Math.floor(s.days);
  x.font=`760 400px ${F}`; x.fillText(String(d),64,560);
  x.font=`600 64px ${F}`; x.fillText(d>1?"jours sans fumer":"jour sans fumer",84,660);
  x.fillStyle="rgba(255,255,255,.94)"; roundRect(x,64,820,W-128,420,48); x.fill();
  x.fillStyle="#16222B";
  const col=(lbl,val,cx,cy)=>{ x.font=`500 34px system-ui, sans-serif`; x.fillStyle="#4A5864"; x.fillText(lbl,cx,cy); x.font=`700 76px ${F}`; x.fillStyle="#16222B"; x.fillText(val,cx,cy+86); };
  col("Économisé",eur(s.money,true),120,920); col(W().Many+" évitées",int(s.avoided),580,920);
  col("Vie regagnée",dur(s.life),120,1110); col("Étapes du corps",reached(s.el)+" / "+MILESTONES.length,580,1110);
  const blob=await new Promise(r=>cv.toBlob(r,"image/png"));
  const file=new File([blob],"souffle-"+d+"-jours.png",{type:"image/png"});
  if(navigator.canShare && navigator.canShare({files:[file]})){
    try{ await navigator.share({files:[file], title:"Souffle", text:`${d} ${d>1?"jours":"jour"} sans fumer.`}); }catch(e){}
  }else{
    const u=URL.createObjectURL(blob), a=document.createElement("a"); a.href=u; a.download=file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(u),3000);
  }
}
function skyVarsFixed(c){ const keep=DARK; DARK=false; const v=skyVars(c); DARK=keep; return v; }
function roundRect(x,X,Y,w,h,r){ x.beginPath(); x.moveTo(X+r,Y); x.arcTo(X+w,Y,X+w,Y+h,r); x.arcTo(X+w,Y+h,X,Y+h,r); x.arcTo(X,Y+h,X,Y,r); x.arcTo(X,Y,X+w,Y,r); x.closePath(); }

/* ============================================================
   Onboarding
   ============================================================ */
let OB={step:0, d:{firstName:"", now:true, quitDate:null, kind:"pack", perDay:15, packPrice:12.5, perPack:20, ...ROLL_DEFAULTS, years:10, reasons:["","",""], rwName:"", rwPrice:""}};
const PH=["Retrouver du souffle pour mes ateliers","Ne plus sentir la cigarette","Me prouver que j'en suis capable"];
function renderOnboarding(){
  const d=OB.d, st=OB.step, N=5;
  let body="";
  if(st===0) body=`<div class="welcome-sky sky" id="wsky">${SMOKE}<img src="logo.png" alt="" width="92" height="92"></div>
    <h1 class="h1" style="font-size:42px">Souffle.</h1>
    <p class="lead">Le ciel est enfumé. À chaque heure sans cigarette, il se dégage un peu. Cette appli est faite pour une seule personne : toi. Pas de compte, rien ne quitte ton téléphone.</p>
    <label class="field"><span>Ton prénom</span><input class="inp" data-o="firstName" autocomplete="given-name" value="${esc(d.firstName)}"></label>`;
  else if(st===1) body=`<h1 class="h1">La dernière.</h1><p class="lead">Quand as-tu fumé ta dernière cigarette ? Ou quand vas-tu la fumer ?</p>
    <div class="seg full" style="margin-top:20px"><button class="${d.now?"on":""}" data-act="obnow" data-v="1">Maintenant</button><button class="${d.now?"":"on"}" data-act="obnow" data-v="0">Choisir une date</button></div>
    ${d.now?`<p class="small ink2" style="margin:14px 4px 0">Le compteur démarre dès que tu valides.</p>`
      :`<label class="field"><span>Date et heure</span><input class="inp" type="datetime-local" data-o="quitDate" value="${d.quitDate||toLocalInput(new Date())}"></label>`}`;
  else if(st===2){ const y=d.perDay*365*pricePerCig(d);
    body=`<h1 class="h1">Tes habitudes.</h1><p class="lead">Pour calculer exactement ce que tu gagnes. C'est entre toi et toi.</p>
    ${habitsHTML(d,"ob")}
    <div class="block flat" style="margin-top:18px"><div class="meta">Ça te coûtait</div><div class="display" style="font-size:32px;font-weight:700" id="oby">${eur(y,true)} par an</div>
      <div class="small ink2" id="obl">${eur(y*d.years,true)} partis en fumée depuis le début.</div></div>`; }
  else if(st===3) body=`<h1 class="h1">Tes raisons.</h1><p class="lead">Avec tes mots. Souffle te les remettra sous les yeux pile quand l'envie arrive.</p>
    ${[0,1,2].map(i=>`<label class="field"><span>Raison ${i+1}</span><textarea class="inp" rows="2" data-o="reason" data-i="${i}" placeholder="${PH[i]}">${esc(d.reasons[i])}</textarea></label>`).join("")}`;
  else body=`<h1 class="h1">Ta récompense.</h1><p class="lead">L'argent que tu ne brûles plus va quelque part. Tu pourras en ajouter d'autres ensuite.</p>
    <label class="field"><span>Je m'offre…</span><input class="inp" data-o="rwName" placeholder="Un casque, un week-end…" value="${esc(d.rwName)}"></label>
    <label class="field"><span>Prix (€)</span><input class="inp tnum" inputmode="numeric" data-o="rwPrice" placeholder="300" value="${esc(d.rwPrice)}"></label>
    <p class="small ink2" style="margin:14px 4px 0" id="obr">${obRewardHint()}</p>`;
  $app.innerHTML=`<div class="onb"><div class="prog">${Array.from({length:N},(_,i)=>`<i class="${i<=st?"on":""}"></i>`).join("")}</div>
    <div class="body">${body}</div>
    <div class="foot">${st>0?`<button class="btn soft back" data-act="obback" aria-label="Retour">‹</button>`:""}<button class="btn air" data-act="obnext">${st===N-1?"Commencer":"Continuer"}</button></div></div>`;
  if(st===0){ const w=document.getElementById("wsky"), t0=performance.now();
    const loop=t=>{ if(!document.body.contains(w)) return; const ph=((t-t0)/9000)%1, c=ph<.75?ph/.75:1-(ph-.75)/.25; paintSky(w,Math.max(0,Math.min(1,c))); requestAnimationFrame(loop); };
    if(matchMedia("(prefers-reduced-motion: reduce)").matches) paintSky(w,.4); else requestAnimationFrame(loop); }
}
function obStepper(f,label,mn,mx){
  return `<div class="field"><span>${label}</span><div class="stepper"><b>${OB.d[f]}</b><div class="pm">
    <button data-act="obstep" data-f="${f}" data-d="-1" data-min="${mn}" data-max="${mx}" aria-label="Moins">−</button>
    <button data-act="obstep" data-f="${f}" data-d="1" data-min="${mn}" data-max="${mx}" aria-label="Plus">+</button></div></div></div>`;
}
function obRewardHint(){
  const d=OB.d, perDay=d.perDay*pricePerCig(d), price=parseNum(d.rwPrice)||0;
  if(!price||!perDay) return "Mets un prix pour voir dans combien de temps elle est à toi.";
  return `À toi dans <b>${Math.ceil(price/perDay)} jours</b> sans fumer.`;
}
function finishOnboarding(){
  const d=OB.d, price=parseNum(d.rwPrice)||0;
  S.profile={firstName:d.firstName.trim(),
    quitDate:(d.now||!d.quitDate)?new Date().toISOString():new Date(d.quitDate).toISOString(),
    kind:d.kind, perDay:d.perDay, packPrice:d.packPrice, perPack:d.perPack,
    pouchPrice:d.pouchPrice, perPouch:d.perPouch, extrasMonth:d.extrasMonth, years:d.years,
    reasons:d.reasons.map(r=>r.trim()).filter(Boolean),
    rewards:price>0?[{id:uid(), name:d.rwName.trim()||"Ma récompense", price}]:[]};
  S.ui.tab="today"; S.ui.silentUnlock=true; save(); render();
}

/* ============================================================
   Toast
   ============================================================ */
function toast(msg){ document.querySelectorAll(".toast").forEach(t=>t.remove());
  const t=document.createElement("div"); t.className="toast"; t.setAttribute("role","status"); t.textContent=msg; document.body.appendChild(t); setTimeout(()=>t.remove(),2400); }

/* ============================================================
   Événements
   ============================================================ */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
document.addEventListener("click",e=>{
  const tb=e.target.closest("[data-tab]"); if(tb){ S.ui.tab=tb.dataset.tab; save(); render(); return; }
  const go=e.target.closest("[data-goto]"); if(go){ S.ui.tab=go.dataset.goto; if(go.dataset.prog) S.ui.prog=go.dataset.prog; save(); render(); return; }
  const b=e.target.closest("[data-act]"); if(!b) return;
  const a=b.dataset.act, v=b.dataset.v;
  switch(a){
    case "sos": openSOS(); break;
    case "sosclose": closeSOS(); break;
    case "sosok": sosResult(true); break;
    case "sosslip": sosResult(false); break;
    case "sosmode": SOS.mode=v; renderSOS(); break;
    case "cpick": cPick(+b.dataset.i); break;
    case "sostip": SOS.tip++; renderSOS(); break;
    case "sint": updateSOSEntry("intensity",+v); break;
    case "strig": updateSOSEntry("trigger",v); break;
    case "journal": openJournal(); break;
    case "jclose": closeJournal(); break;
    case "jtype": J.type=v; J.note=(document.getElementById("jnote")||{}).value||""; renderJournal(); break;
    case "jint": J.intensity=+v; renderJournal(); break;
    case "jok": J.ok=v==="1"; renderJournal(); break;
    case "jn": J.n=clamp(J.n+ +b.dataset.d,1,40); renderJournal(); break;
    case "jsub": J.sub=v; renderJournal(); break;
    case "jtrig": J.note=(document.getElementById("jnote")||{}).value||""; J.trigger=J.trigger===v?null:v; renderJournal(); break;
    case "jsave": saveJournal(); break;
    case "delentry": { const id=b.dataset.id; if(confirm("Supprimer cette entrée du journal ?")){ S.log=S.log.filter(x=>x.id!==id && x.link!==id); save(); render(true);} break; }
    case "range": S.ui.range=v; save(); render(true); break;
    case "jall": S.ui.jall=!S.ui.jall; save(); render(true); break;
    case "prog": S.ui.prog=v; save(); render(true); break;
    case "mission": { const d=+b.dataset.day; if(S.missions[d]) delete S.missions[d]; else { S.missions[d]=Date.now(); buzz(15); } save(); render(true); break; }
    case "share": shareCard(); break;
    case "closeunlock": b.closest(".unlock").remove(); break;
    case "theme": S.theme=v; save(); DARK=applyTheme(); render(true); break;
    case "step": { const f=b.dataset.f; S.profile[f]=clamp(S.profile[f]+ +b.dataset.d, +b.dataset.min, +b.dataset.max); save(); render(true); break; }
    case "addreason": { const i=document.getElementById("newreason"), t=(i.value||"").trim(); if(t){ S.profile.reasons.push(t); save(); render(true);} break; }
    case "delreason": S.profile.reasons.splice(+b.dataset.i,1); save(); render(true); break;
    case "addreward": { const n=document.getElementById("rwname").value.trim(), p=parseNum(document.getElementById("rwprice").value);
      if(n&&p>0){ S.profile.rewards.push({id:uid(), name:n, price:p}); save(); render(true);} else toast("Indique un nom et un prix"); break; }
    case "delreward": S.profile.rewards.splice(+b.dataset.i,1); save(); render(true); break;
    case "restart": if(confirm("Recommencer maintenant ? Ce que ton corps a réparé ne disparaît pas : on remet juste le compteur à zéro.")){ S.profile.quitDate=new Date().toISOString(); S.ui.tab="today"; save(); render(); } break;
    case "erase": if(confirm("Effacer toutes tes données Souffle ? C'est définitif.")){ const th=S.theme; S=blank(); S.theme=th; save(); OB.step=0; render(); } break;
    case "export": { const blob=new Blob([JSON.stringify(S,null,2)],{type:"application/json"}), u=URL.createObjectURL(blob), l=document.createElement("a");
      l.href=u; l.download="souffle-sauvegarde-"+dayKey()+".json"; document.body.appendChild(l); l.click(); l.remove(); setTimeout(()=>URL.revokeObjectURL(u),2000); break; }
    case "obnext": if(OB.step<4){ OB.step++; renderOnboarding(); window.scrollTo(0,0);} else finishOnboarding(); break;
    case "obback": OB.step=Math.max(0,OB.step-1); renderOnboarding(); break;
    case "obkind": OB.d.kind=v; renderOnboarding(); break;
    case "kind": S.profile.kind=v; save(); render(true); break;
    case "obnow": OB.d.now=v==="1"; if(!OB.d.now&&!OB.d.quitDate) OB.d.quitDate=toLocalInput(new Date()); renderOnboarding(); break;
    case "obstep": { const f=b.dataset.f; OB.d[f]=clamp(OB.d[f]+ +b.dataset.d, +b.dataset.min, +b.dataset.max); renderOnboarding(); break; }
  }
});
document.addEventListener("input",e=>{
  const t=e.target;
  if(t.dataset.o){
    const k=t.dataset.o;
    if(k==="reason") OB.d.reasons[+t.dataset.i]=t.value;
    else if(k==="packPrice"||k==="pouchPrice"||k==="extrasMonth"){ const n=parseNum(t.value); if(n!=null||k==="extrasMonth"){ OB.d[k]=n||0; const y=OB.d.perDay*365*pricePerCig(OB.d); set("oby",eur(y,true)+" par an"); set("obl",eur(y*OB.d.years,true)+" partis en fumée depuis le début."); } }
    else if(k==="rwPrice"){ OB.d.rwPrice=t.value; const r=document.getElementById("obr"); if(r) r.innerHTML=obRewardHint(); }
    else OB.d[k]=t.value;
  }
  if(t.dataset.f && S.profile){
    const k=t.dataset.f;
    if(k==="packPrice"||k==="pouchPrice"||k==="extrasMonth"){ const n=parseNum(t.value); if(n!=null) S.profile[k]=n; else if(k==="extrasMonth") S.profile[k]=0; }
    else if(k==="quitDate"){ if(t.value) S.profile.quitDate=new Date(t.value).toISOString(); }
    else S.profile[k]=t.value;
    save();
  }
});
document.addEventListener("change",e=>{
  if(e.target.id==="importfile" && e.target.files[0]){
    e.target.files[0].text().then(txt=>{
      try{ const d=JSON.parse(txt); if(!d||!("profile" in d)) throw 0; S=migrate(d); save(); DARK=applyTheme(); toast("Sauvegarde restaurée"); render(); }
      catch(_){ toast("Ce fichier n'est pas une sauvegarde Souffle"); }
    });
  }
});
document.addEventListener("keydown",e=>{
  if(e.key==="Enter" && e.target.id==="newreason"){ e.preventDefault(); document.querySelector('[data-act="addreason"]').click(); }
  if(e.key==="Escape"){ if(document.getElementById("jmodal")) closeJournal(); }
});
document.addEventListener("pointerdown",e=>{ if(e.target.classList&&e.target.classList.contains("modal")) closeJournal(); });
window.addEventListener("hashchange",()=>{ if(importFromHash() && S.profile) render(true); });
document.addEventListener("visibilitychange",()=>{ if(!document.hidden && S.profile && S.ui.tab==="today") tick(); });
try{ navigator.storage&&navigator.storage.persist&&navigator.storage.persist(); }catch(e){}

importFromHash();
render();
