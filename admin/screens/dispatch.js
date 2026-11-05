// 배정 보드: 파트너별 타임라인 + 미배정 대기열 + 후보 추천
(function(){
  const H0=8,H1=20,CW=56;
  const css=`
.dp-wrap{display:grid;grid-template-columns:260px minmax(0,1fr);gap:14px;align-items:start}
.dp-wrap.dp-has{grid-template-columns:260px minmax(0,1fr) 290px}
@media (max-width:1100px){.dp-wrap,.dp-wrap.dp-has{grid-template-columns:minmax(0,1fr)}}
.dp-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}
.dp-chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:4px 12px;cursor:pointer}
.dp-chip.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent);font-weight:600}
.dp-chip b{font:500 11px var(--mono);margin-left:4px;color:var(--warn)}
.dp-h{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:14px;font-weight:600}
.dp-q{display:flex;flex-direction:column;gap:8px;max-height:640px;overflow:auto}
.dp-qc{text-align:left;font:inherit;color:var(--ink);background:var(--surface2);border:1px solid var(--line);border-radius:8px;padding:9px 11px;cursor:pointer}
.dp-qc:hover{border-color:var(--accent)}.dp-qc.on{border-color:var(--accent);background:var(--accent-soft);box-shadow:inset 3px 0 0 var(--accent)}
.dp-qc .dp-r{display:flex;justify-content:space-between;gap:8px;align-items:center}
.dp-dl{font:500 11.5px var(--mono);color:var(--muted)}.dp-dl.dp-late{color:var(--bad)}.dp-dl.dp-soon{color:var(--warn)}
.dp-tl{overflow-x:auto;border:1px solid var(--line);border-radius:8px}
.dp-grid{position:relative;min-width:${150+(H1-H0)*CW}px}
.dp-row{display:flex;border-bottom:1px solid var(--line);height:44px}.dp-row:last-child{border-bottom:0}
.dp-row.dp-cand{background:var(--accent-soft)}.dp-row.dp-cand .dp-nm{color:var(--accent);font-weight:600}
.dp-row.dp-hd{height:28px;background:var(--surface2)}
.dp-nm{width:150px;flex:none;padding:4px 8px;font-size:12.5px;border-right:1px solid var(--line);overflow:hidden;white-space:nowrap;text-overflow:ellipsis;position:sticky;left:0;background:inherit;z-index:2}
.dp-row:not(.dp-cand) .dp-nm{background:var(--surface)}.dp-row.dp-hd .dp-nm{background:var(--surface2)}
.dp-nm small{display:block;color:var(--muted);font-size:11px}
.dp-lane{position:relative;flex:none;width:${(H1-H0)*CW}px;background-image:linear-gradient(to right,var(--line) 1px,transparent 1px);background-size:${CW}px 100%}
.dp-hr{position:absolute;top:6px;font:11px var(--mono);color:var(--muted);transform:translateX(3px)}
.dp-bar{position:absolute;top:5px;bottom:5px;border-radius:6px;padding:2px 6px;font-size:11.5px;line-height:1.3;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;cursor:pointer;border-left:3px solid}
.dp-bar.info{background:var(--info-soft);color:var(--info)}.dp-bar.accent{background:var(--accent-soft);color:var(--accent)}
.dp-bar.ok{background:var(--ok-soft);color:var(--ok)}.dp-bar.bad{background:var(--bad-soft);color:var(--bad)}
.dp-bar.warn{background:var(--warn-soft);color:var(--warn)}.dp-bar.mute{background:var(--mute-soft);color:var(--muted)}
.dp-bar.dp-ghost{background:transparent;border:1.5px dashed var(--warn);color:var(--warn);cursor:default}
.dp-now{position:absolute;top:0;bottom:0;width:2px;background:var(--bad);z-index:3;pointer-events:none}
.dp-now span{position:absolute;top:0;left:3px;font:600 10px var(--mono);color:var(--bad)}
.dp-cc{border:1px solid var(--line);border-radius:8px;padding:10px 11px;margin-bottom:8px;background:var(--surface2)}
.dp-cc.dp-no{opacity:.6}
.dp-tags{display:flex;gap:4px;flex-wrap:wrap;margin:6px 0 8px}
.dp-tag{font-size:11px;border-radius:4px;padding:1px 6px;background:var(--ok-soft);color:var(--ok)}
.dp-tag.dp-x{background:var(--bad-soft);color:var(--bad)}.dp-tag.dp-m{background:var(--mute-soft);color:var(--muted)}
.dp-sc{font:600 13px var(--mono);color:var(--accent)}
.dp-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);margin-top:8px}
`;
  if(!document.getElementById("dp-style")){const s=document.createElement("style");s.id="dp-style";s.textContent=css;document.head.appendChild(s)}

  const TONE={"배정완료":"info","방문중":"accent","완료":"ok","분쟁":"bad","취소":"mute","매칭대기":"warn"};
  const st={date:null,sel:null};
  const hh=h=>String(Math.floor(h)).padStart(2,"0")+":00";
  const md=d=>d.slice(5).replace("-","/");
  const dl=m=>m==null?"":m<0?`<span class="dp-dl dp-late">마감 ${-m}분 지남</span>`:`<span class="dp-dl ${m<60?"dp-soon":""}">마감 ${m>=60?Math.floor(m/60)+"시간 ":""}${m%60}분 남음</span>`;
  const overlap=(a,b)=>a.date===b.date&&a.hour<b.hour+b.duration&&b.hour<a.hour+a.duration;

  function score(b){
    return DB.partners.filter(p=>p.status==="활성").map(p=>{
      const tags=[];let ok=true,s=0;
      if(p.skills.includes(b.service)){tags.push(["스킬 일치",""]);s+=40}else{tags.push(["스킬 없음","x"]);ok=false}
      const busy=DB.bookings.some(o=>o!==b&&o.partner===p.id&&o.status!=="취소"&&overlap(o,b));
      if(busy){tags.push(["시간 겹침","x"]);ok=false}else tags.push(["시간 비어 있음",""]);
      if(p.region===b.region){tags.push(["같은 지역",""]);s+=20}else tags.push([p.region,"m"]);
      s+=(p.rating-3.9)*20+p.acceptRate*0.2;
      tags.push(["평점 "+p.rating,p.rating>=4.5?"":"m"],["수락 "+p.acceptRate+"%",p.acceptRate>=85?"":"m"]);
      return {p,ok,s:Math.round(s),tags};
    }).sort((a,b)=>(b.ok-a.ok)||(b.s-a.s));
  }

  function render(el,param){
    if(param&&App.booking(param)){const b=App.booking(param);st.sel=b.status==="매칭대기"?b.id:null;st.date=b.date}
    const dates=[...new Set(DB.bookings.map(b=>b.date))].sort();
    const waitOn=d=>DB.bookings.filter(b=>b.date===d&&b.status==="매칭대기").length;
    if(!st.date||!dates.includes(st.date)){
      const best=dates.slice().sort((a,b)=>waitOn(b)-waitOn(a))[0];
      st.date=best&&waitOn(best)?best:DB.today;
    }
    let sel=st.sel&&App.booking(st.sel);
    if(sel&&sel.status!=="매칭대기"){sel=null;st.sel=null}

    let queue=DB.bookings.filter(b=>b.status==="매칭대기"&&b.date===st.date),allMode=false;
    if(!queue.length){queue=DB.bookings.filter(b=>b.status==="매칭대기");allMode=true}
    queue.sort((a,b)=>(a.deadlineMin??999)-(b.deadlineMin??999));

    const active=DB.partners.filter(p=>p.status==="활성");
    const ranked=sel?score(sel):[];
    const candIds=new Set(ranked.filter(r=>r.ok).slice(0,5).map(r=>r.p.id));
    const dayB=DB.bookings.filter(b=>b.date===st.date&&b.partner);

    const lane=p=>{
      let h=dayB.filter(b=>b.partner===p.id).map(b=>{
        const l=(Math.max(b.hour,H0)-H0)*CW,w=Math.max(Math.min(b.hour+b.duration,H1)-Math.max(b.hour,H0),0.5)*CW-3;
        return `<div class="dp-bar ${TONE[b.status]||"mute"}" style="left:${l+1}px;width:${w}px" data-b="${b.id}" title="${App.esc(b.id+" "+b.service+" "+b.customer+" · "+b.status)}">${App.esc(b.service)} · ${App.esc(b.customer)}</div>`}).join("");
      if(sel&&candIds.has(p.id)&&sel.date===st.date){
        const l=(Math.max(sel.hour,H0)-H0)*CW,w=Math.min(sel.duration,H1-sel.hour)*CW-3;
        h+=`<div class="dp-bar dp-ghost" style="left:${l+1}px;width:${w}px">${App.esc(sel.service)} 후보</div>`;
      }
      return h;
    };
    const nowX=st.date===DB.today?(DB.nowHour-H0)*CW+150:null;

    el.innerHTML=`
    <div class="dp-chips" role="group" aria-label="날짜">${dates.map(d=>`<button class="dp-chip ${d===st.date?"on":""}" data-d="${d}">${md(d)}${d===DB.today?" 오늘":""}${waitOn(d)?`<b>${waitOn(d)}</b>`:""}</button>`).join("")}</div>
    <div class="dp-wrap ${sel?"dp-has":""}">
      <section class="card">
        <h2 class="dp-h">미배정 대기열 <span class="pill warn">${queue.length}</span></h2>
        ${allMode&&queue.length?`<p class="muted" style="margin:-4px 0 8px;font-size:12px">${md(st.date)} 대기 없음 · 전체 대기 표시</p>`:""}
        <div class="dp-q">${queue.length?queue.map(b=>`<button class="dp-qc ${sel&&sel.id===b.id?"on":""}" data-q="${b.id}">
          <div class="dp-r"><b>${App.esc(b.service)} · ${App.esc(b.region)}</b><span class="mono">${App.won(b.price)}</span></div>
          <div class="dp-r muted" style="font-size:12.5px"><span>${allMode?md(b.date)+" ":""}${hh(b.hour)}–${hh(b.hour+b.duration)} · <span class="mono">${b.id}</span></span></div>
          <div>${dl(b.deadlineMin)}</div></button>`).join(""):`<p class="muted">대기 중인 예약이 없어요.</p>`}</div>
      </section>
      <section class="card" style="min-width:0">
        <h2 class="dp-h">파트너 타임라인 <span class="muted" style="font-weight:400;font-size:12.5px">${md(st.date)} · 활성 ${active.length}명</span>
          ${sel?`<button class="btn" data-clear style="margin-left:auto">선택 해제</button>`:""}</h2>
        <div class="dp-tl"><div class="dp-grid">
          <div class="dp-row dp-hd"><div class="dp-nm">파트너</div><div class="dp-lane">${Array.from({length:H1-H0},(_,i)=>`<span class="dp-hr" style="left:${i*CW}px">${H0+i}</span>`).join("")}</div></div>
          ${active.map(p=>`<div class="dp-row ${candIds.has(p.id)?"dp-cand":""}"><div class="dp-nm" title="${App.esc(p.name)}">${App.esc(p.name)}<small>${App.esc(p.skills.join("·"))} · ${App.esc(p.region)}</small></div><div class="dp-lane">${lane(p)}</div></div>`).join("")}
          ${nowX!=null?`<div class="dp-now" style="left:${nowX}px"><span>${hh(DB.nowHour)}</span></div>`:""}
        </div></div>
        <div class="dp-legend">${["배정완료","방문중","완료","분쟁"].map(s=>App.pill(s)).join("")}${sel?`<span>점선 = 배정 후보 자리</span>`:""}</div>
      </section>
      ${sel?`<section class="card">
        <h2 class="dp-h">추천 후보</h2>
        <p class="muted" style="margin:-4px 0 10px;font-size:12.5px"><span class="mono">${sel.id}</span> ${App.esc(sel.service)} · ${App.esc(sel.region)} · ${md(sel.date)} ${hh(sel.hour)}</p>
        ${ranked.slice(0,5).map(r=>`<div class="dp-cc ${r.ok?"":"dp-no"}">
          <div class="dp-r" style="display:flex;justify-content:space-between"><b>${App.esc(r.p.name)}</b>${r.ok?`<span class="dp-sc">${r.s}점</span>`:`<span class="pill bad">불가</span>`}</div>
          <div class="dp-tags">${r.tags.map(([t,c])=>`<span class="dp-tag ${c?"dp-"+c:""}">${App.esc(t)}</span>`).join("")}</div>
          ${r.ok?`<button class="btn primary" data-a="${r.p.id}">배정</button>`:`<button class="btn" data-pv="${r.p.id}">사유 보기</button>`}
        </div>`).join("")||`<p class="muted">활성 파트너가 없어요.</p>`}
      </section>`:""}
    </div>`;

    const re=()=>render(el,null);
    el.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>{st.date=b.dataset.d;const s=st.sel&&App.booking(st.sel);if(s&&s.date!==st.date)st.sel=null;re()});
    el.querySelectorAll("[data-q]").forEach(b=>b.onclick=()=>{const bk=App.booking(b.dataset.q);st.sel=st.sel===bk.id?null:bk.id;if(st.sel)st.date=bk.date;re()});
    const c=el.querySelector("[data-clear]");if(c)c.onclick=()=>{st.sel=null;re()};
    el.querySelectorAll("[data-a]").forEach(b=>b.onclick=()=>{
      const p=App.partner(b.dataset.a);sel.partner=p.id;sel.status="배정완료";sel.deadlineMin=null;
      App.toast(`${sel.id} → ${p.name} 배정`);st.sel=null;re();App.updateBadges();
    });
    el.querySelectorAll("[data-pv]").forEach(b=>b.onclick=()=>{
      const r=ranked.find(x=>x.p.id===b.dataset.pv);
      App.toast(`${r.p.name}: ${r.tags.filter(t=>t[1]==="x").map(t=>t[0]).join(", ")}`);
    });
    el.querySelectorAll(".dp-bar[data-b]").forEach(bar=>bar.onclick=()=>{
      const b=App.booking(bar.dataset.b),p=App.partner(b.partner);
      App.openDrawer(`<h2 style="margin:8px 0">${App.esc(b.id)} ${App.pill(b.status)}</h2>
        <p>${App.esc(b.service)} · ${App.esc(b.customer)}<br><span class="muted">${App.esc(b.region)} · ${md(b.date)} ${hh(b.hour)}–${hh(b.hour+b.duration)}</span></p>
        <p>파트너: <b>${App.esc(p?p.name:"-")}</b> · <span class="mono">${App.won(b.price)}</span></p>
        ${b.status==="배정완료"?`<button class="btn danger" data-un>배정 취소 (대기열로)</button>`:""}`,body=>{
        const u=body.querySelector("[data-un]");if(u)u.onclick=()=>{b.partner=null;b.status="매칭대기";b.deadlineMin=60;App.closeDrawer();App.toast(`${b.id} 대기열로 이동`);st.sel=b.id;st.date=b.date;re();App.updateBadges()};
      });
    });
  }
  App.register("dispatch",{title:"배정 보드",render});
})();
