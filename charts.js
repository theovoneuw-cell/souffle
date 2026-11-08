/* Souffle — graphiques SVG légers, avec infobulle au toucher et tableau associé. */
"use strict";

const CH = {};      // registre : id -> {pts:[{x,y,tip}]}
let chartSeq = 0;
const VW = 340;     // largeur du viewBox (mise à l'échelle uniforme)

function niceMax(v){
  if(v<=0) return 1;
  const p=Math.pow(10,Math.floor(Math.log10(v))), n=v/p;
  return (n<=1?1:n<=2?2:n<=2.5?2.5:n<=5?5:10)*p;
}
function tickFmt(v){
  if(v>=10000) return (v/1000).toLocaleString("fr-FR",{maximumFractionDigits:0})+" k";
  return v.toLocaleString("fr-FR",{maximumFractionDigits:v<10&&v%1?1:0});
}
function topRounded(x,y,w,h,r){
  if(h<=0) return "";
  r=Math.min(r,w/2,h);
  return `M${x},${y+h}V${y+r}Q${x},${y} ${x+r},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h}Z`;
}
function rightRounded(x,y,w,h,r){
  if(w<=0) return "";
  r=Math.min(r,h/2,w);
  return `M${x},${y}H${x+w-r}Q${x+w},${y} ${x+w},${y+r}V${y+h-r}Q${x+w},${y+h} ${x+w-r},${y+h}H${x}Z`;
}
function tableHTML(head, rows){
  return `<details class="tbl"><summary>Voir les chiffres</summary><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead>
    <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></details>`;
}

/**
 * Colonnes (simples ou empilées à 2 séries).
 * data: [{label, a, b?, tip, axis?}]  — a = série 1 (bas), b = série 2 (haut)
 */
function columns({data, height=150, colors=["var(--air)","var(--ember)"], highlight=null, labelEvery=1, yFmt=tickFmt}){
  const id="c"+(++chartSeq), H=height, L=26, R=4, T=10, B=22;
  const n=data.length, pw=VW-L-R, slot=pw/Math.max(1,n);
  const bw=Math.max(3,Math.min(24,slot-2));
  const max=niceMax(Math.max(1,...data.map(d=>(d.a||0)+(d.b||0))));
  const y=v=>T+(H-T-B)*(1-v/max);
  let g="";
  [0,.5,1].forEach(f=>{ const v=max*f, yy=y(v);
    g+=`<line x1="${L}" x2="${VW-R}" y1="${yy}" y2="${yy}" stroke="var(--hair)" stroke-width="1"/>`;
    g+=`<text class="axis" x="${L-6}" y="${yy+3.5}" text-anchor="end">${yFmt(v)}</text>`; });
  const pts=[];
  data.forEach((d,i)=>{
    const cx=L+slot*i+slot/2, x=cx-bw/2, a=d.a||0, b=d.b||0;
    const base=y(0);
    const ha=base-y(a), hb=base-y(b);
    const ca = highlight && !highlight(d,i) ? "var(--hair)" : colors[0];
    if(b>0 && a>0){
      g+=`<rect x="${x}" y="${base-ha}" width="${bw}" height="${ha}" fill="${ca}"/>`;
      g+=`<path d="${topRounded(x,base-ha-hb,bw,Math.max(0,hb-2),Math.min(4,bw/2))}" fill="${colors[1]}"/>`;
    }else if(a>0){
      g+=`<path d="${topRounded(x,base-ha,bw,ha,Math.min(4,bw/2))}" fill="${ca}"/>`;
    }else if(b>0){
      g+=`<path d="${topRounded(x,base-hb,bw,hb,Math.min(4,bw/2))}" fill="${colors[1]}"/>`;
    }
    if(d.axis!=null || i%labelEvery===0) g+=`<text class="axis" x="${cx}" y="${H-6}" text-anchor="middle">${d.axis!=null?d.axis:d.label}</text>`;
    pts.push({x:cx, y:y(a+b), tip:d.tip});
  });
  CH[id]={pts, H};
  return `<div class="chart" data-id="${id}"><svg viewBox="0 0 ${VW} ${H}" role="img">${g}<line x1="${L}" x2="${VW-R}" y1="${y(0)}" y2="${y(0)}" stroke="var(--ash)" stroke-width="1" opacity=".5"/>
    <rect class="hit" x="${L}" y="0" width="${pw}" height="${H}" fill="transparent"/></svg><div class="tip"></div></div>`;
}

/** Barres horizontales classées. data: [{label, v, tip}] */
function hbars({data, color="var(--air)", fmt=v=>v}){
  const id="c"+(++chartSeq), row=34, H=data.length*row, LW=118, R=40;
  const max=Math.max(1,...data.map(d=>d.v));
  let g="";
  const pts=[];
  data.forEach((d,i)=>{
    const yy=i*row+7, h=20, w=(VW-LW-R)*d.v/max;
    g+=`<text x="0" y="${yy+14.5}" font-size="13.5" fill="var(--ink2)" font-family="var(--text)">${d.label}</text>`;
    g+=`<path d="${rightRounded(LW,yy,Math.max(2,w),h,4)}" fill="${color}"/>`;
    g+=`<text x="${LW+Math.max(2,w)+8}" y="${yy+14.5}" font-size="13" font-weight="600" fill="var(--ink)" font-family="var(--text)">${fmt(d.v)}</text>`;
    pts.push({x:LW+w/2, y:yy, tip:d.tip, row:i});
  });
  CH[id]={pts, H, rows:row};
  return `<div class="chart" data-id="${id}"><svg viewBox="0 0 ${VW} ${H}" role="img">${g}<rect class="hit" x="0" y="0" width="${VW}" height="${H}" fill="transparent"/></svg><div class="tip"></div></div>`;
}

/**
 * Courbe dans le temps. points: [{t, v, tip}] ; ref: valeur de référence ; proj: [{t,v,tip}] en pointillés.
 */
function line({points, height=160, color="var(--air)", ref=null, refLabel="", proj=null, yFmt=tickFmt, xFmt=null, zero=false, domain=null}){
  const id="c"+(++chartSeq), H=height, L=34, R=10, T=14, B=22;
  const all=points.concat(proj||[]);
  if(points.length<1) return "";
  const t0=Math.min(...all.map(p=>p.t)), t1=Math.max(...all.map(p=>p.t));
  const vals=all.map(p=>p.v).concat(ref!=null?[ref]:[]);
  let mn=zero?0:Math.min(...vals), mx=Math.max(...vals);
  if(domain){ mn=domain[0]; mx=domain[1]; }
  else if(!zero){ const pad=(mx-mn)*.15||Math.abs(mx)*.05||1; mn-=pad; mx+=pad; } else mx=niceMax(mx);
  const x=t=> t1===t0 ? L+(VW-L-R)/2 : L+(VW-L-R)*(t-t0)/(t1-t0);
  const y=v=>T+(H-T-B)*(1-(v-mn)/(mx-mn));
  let g="";
  [0,.5,1].forEach(f=>{ const v=mn+(mx-mn)*f, yy=y(v);
    g+=`<line x1="${L}" x2="${VW-R}" y1="${yy}" y2="${yy}" stroke="var(--hair)" stroke-width="1"/>`;
    g+=`<text class="axis" x="${L-6}" y="${yy+3.5}" text-anchor="end">${yFmt(v)}</text>`; });
  if(ref!=null){
    const yy=y(ref);
    g+=`<line x1="${L}" x2="${VW-R}" y1="${yy}" y2="${yy}" stroke="var(--ember)" stroke-width="1.2" stroke-dasharray="4 4" opacity=".85"/>`;
    if(refLabel) g+=`<text x="${VW-R}" y="${yy-5}" text-anchor="end" font-size="11" fill="var(--ink2)" font-family="var(--text)">${refLabel}</text>`;
  }
  const P=points.map(p=>[x(p.t),y(p.v)]);
  if(P.length>1){
    const d=P.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join("");
    g+=`<path d="${d}L${P[P.length-1][0]},${y(zero?0:mn)}L${P[0][0]},${y(zero?0:mn)}Z" fill="${color}" opacity=".10"/>`;
    g+=`<path d="${d}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  if(proj && proj.length){
    const last=P[P.length-1], Q=[last].concat(proj.map(p=>[x(p.t),y(p.v)]));
    g+=`<path d="${Q.map((p,i)=>(i?"L":"M")+p[0].toFixed(1)+","+p[1].toFixed(1)).join("")}" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="5 5" opacity=".6"/>`;
  }
  const lp=P[P.length-1];
  g+=`<circle cx="${lp[0]}" cy="${lp[1]}" r="5.5" fill="var(--paper)"/><circle cx="${lp[0]}" cy="${lp[1]}" r="4" fill="${color}"/>`;
  if(xFmt){
    g+=`<text class="axis" x="${L}" y="${H-6}" text-anchor="start">${xFmt(t0)}</text>`;
    g+=`<text class="axis" x="${VW-R}" y="${H-6}" text-anchor="end">${xFmt(t1)}</text>`;
  }
  const pts=points.map((p,i)=>({x:P[i][0], y:P[i][1], tip:p.tip})).concat((proj||[]).map(p=>({x:x(p.t),y:y(p.v),tip:p.tip})));
  CH[id]={pts, H, line:true, color};
  return `<div class="chart" data-id="${id}"><svg viewBox="0 0 ${VW} ${H}" role="img">${g}
    <line class="xh" x1="0" x2="0" y1="${T}" y2="${H-B}" stroke="var(--ash)" stroke-width="1" opacity="0"/>
    <circle class="xd" r="4" fill="${color}" stroke="var(--paper)" stroke-width="2" opacity="0"/>
    <rect class="hit" x="0" y="0" width="${VW}" height="${H}" fill="transparent"/></svg><div class="tip"></div></div>`;
}

/* Infobulles : toucher ou survol, point le plus proche. */
function bindCharts(root=document){
  root.querySelectorAll(".chart[data-id]").forEach(el=>{
    if(el._bound) return; el._bound=true;
    const c=CH[el.dataset.id]; if(!c) return;
    const svg=el.querySelector("svg"), tip=el.querySelector(".tip"), xh=el.querySelector(".xh"), xd=el.querySelector(".xd");
    const show=e=>{
      const r=svg.getBoundingClientRect(), sx=VW/r.width;
      const px=(e.clientX-r.left)*sx, py=(e.clientY-r.top)*sx;
      let best=null, bd=1e9;
      c.pts.forEach(p=>{ const d=c.rows? Math.abs(py-(p.y+10)) : Math.abs(px-p.x); if(d<bd){bd=d;best=p;} });
      if(!best||!best.tip){ hide(); return; }
      tip.innerHTML=best.tip; tip.classList.add("on");
      const left=Math.min(r.width-60,Math.max(60,best.x/sx)), top=(best.y/sx)-8;
      tip.style.left=left+"px"; tip.style.top=Math.max(14,top)+"px";
      if(xh){ xh.setAttribute("x1",best.x); xh.setAttribute("x2",best.x); xh.setAttribute("opacity",".6"); }
      if(xd){ xd.setAttribute("cx",best.x); xd.setAttribute("cy",best.y); xd.setAttribute("opacity","1"); }
    };
    const hide=()=>{ tip.classList.remove("on"); if(xh) xh.setAttribute("opacity","0"); if(xd) xd.setAttribute("opacity","0"); };
    svg.addEventListener("pointerdown",show);
    svg.addEventListener("pointermove",e=>{ if(e.pointerType==="mouse"||e.buttons) show(e); });
    svg.addEventListener("pointerleave",hide);
    svg.addEventListener("pointerup",e=>{ if(e.pointerType!=="mouse") setTimeout(hide,1800); });
  });
}
