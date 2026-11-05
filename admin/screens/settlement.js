(function(){
  const {esc,won,pill}=App;
  const ROUNDS=["2026-10-20","2026-10-27","2026-11-03","2026-11-10"], TODAY="2026-11-05";
  let round="2026-11-10"; const sel=new Set();
  if(!document.getElementById("st-css")){const s=document.createElement("style");s.id="st-css";s.textContent=`
.st-wrap{display:grid;gap:14px}
.st-chips{display:flex;gap:6px;flex-wrap:wrap}
.st-chip{font:inherit;font-size:13px;border:1px solid var(--line);background:var(--surface);color:var(--ink);border-radius:999px;padding:5px 12px;cursor:pointer}
.st-chip.on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent);font-weight:600}
.st-chip small{font:11px var(--mono);color:var(--muted);margin-left:4px}
.st-formula{display:flex;align-items:flex-end;gap:10px 14px;flex-wrap:wrap}
.st-term .kpi{font-size:24px}.st-op{font:500 22px var(--mono);color:var(--muted);padding-bottom:2px}
.st-term.st-net .kpi{color:var(--accent)}
.st-meta{display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid var(--line);font-size:13px}
.st-alert{background:var(--bad-soft);border:1px solid var(--bad);border-radius:10px;padding:12px 14px}
.st-alert h3{margin:0 0 8px;font-size:14px;color:var(--bad)}
.st-hold{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:6px 0;border-top:1px solid var(--line)}
.st-hold:first-of-type{border-top:0}.st-hold .st-r{margin-left:auto}
.st-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.st-bar .st-sp{margin-left:auto}.st-bar .btn:disabled{opacity:.45;cursor:default}
.st-cal{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}
.st-day{border:1px solid var(--line);border-radius:8px;padding:10px;cursor:pointer;background:var(--surface)}
.st-day.on{border-color:var(--accent);background:var(--accent-soft)}
.st-day .mono{font-size:15px;font-weight:600}
.st-h{margin:0 0 10px;font-size:15px}
.st-ta{width:100%;min-height:320px;font:12px var(--mono);border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--surface2);color:var(--ink);box-sizing:border-box}
`;document.head.appendChild(s)}
  const sum=(a,k)=>a.reduce((s,x)=>s+x[k],0);
  const pname=id=>(App.partner(id)||{}).name||id;
  const past=r=>r<TODAY;
  function render(el){
    const rows=DB.payouts.filter(p=>p.round===round);
    [...sel].forEach(id=>{if(!rows.some(r=>r.id===id))sel.delete(id)});
    const held=DB.payouts.filter(p=>p.status==="보류");
    const cnt=s=>rows.filter(r=>r.status===s).length;
    const adj=sum(rows,"adj");
    const ledger=DB.bookings.filter(b=>b.status==="완료").sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).slice(0,15);
    el.innerHTML=`<div class="st-wrap">
      <div class="st-chips">${ROUNDS.map(r=>`<button class="st-chip ${r===round?"on":""}" data-r="${r}">${r.slice(5)}<small>${past(r)?"지난 회차":"예정"}</small></button>`).join("")}</div>
      <div class="card">
        <div class="label">${round} 회차 정산</div>
        <div class="st-formula" style="margin-top:8px">
          <div class="st-term"><div class="label">거래액</div><div class="kpi">${won(sum(rows,"gross"))}</div></div>
          <div class="st-op">−</div>
          <div class="st-term"><div class="label">플랫폼 수수료</div><div class="kpi">${won(sum(rows,"fee"))}</div></div>
          <div class="st-op">${adj<0?"−":"+"}</div>
          <div class="st-term"><div class="label">조정</div><div class="kpi">${won(Math.abs(adj))}</div></div>
          <div class="st-op">=</div>
          <div class="st-term st-net"><div class="label">파트너 지급액</div><div class="kpi">${won(sum(rows,"net"))}</div></div>
        </div>
        <div class="st-meta"><span><span class="muted">지급일</span> <b class="mono">${round}</b></span>
          <span>${pill("지급완료")} ${cnt("지급완료")}건</span><span>${pill("지급예정")} ${cnt("지급예정")}건</span><span>${pill("보류")} ${cnt("보류")}건</span></div>
      </div>
      ${held.length?`<div class="st-alert"><h3>보류 ${held.length}건</h3>${held.map(h=>`<div class="st-hold">
        <b>${esc(pname(h.partner))}</b><span class="mono muted">${h.round}</span><span class="mono">${won(h.net)}</span><span class="muted">${esc(h.hold||"")}</span>
        <button class="btn st-r" data-rel="${h.id}">보류 해제</button></div>`).join("")}</div>`:""}
      <div class="card">
        <h2 class="st-h">회차별 지급표 <span class="muted mono" style="font-size:12px">${round} · ${rows.length}명</span></h2>
        <div class="st-bar"><span class="muted">선택 ${sel.size}건</span>
          <button class="btn primary" id="st-pay" ${sel.size?"":"disabled"}>선택 ${sel.size}건 지급 처리</button>
          <button class="btn danger" id="st-hold" ${sel.size?"":"disabled"}>선택 보류</button>
          <button class="btn st-sp" id="st-csv">CSV 내보내기</button></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th><input type="checkbox" id="st-all" aria-label="전체 선택" ${rows.length&&sel.size===rows.length?"checked":""}></th><th>파트너</th><th class="num">거래액</th><th class="num">수수료</th><th class="num">조정</th><th class="num">지급액</th><th>상태</th><th>사유</th></tr></thead>
        <tbody>${rows.map(p=>`<tr><td><input type="checkbox" data-id="${p.id}" ${sel.has(p.id)?"checked":""} aria-label="선택"></td>
          <td>${esc(pname(p.partner))} <span class="muted mono">${p.partner}</span></td><td class="num">${won(p.gross)}</td><td class="num">${won(p.fee)}</td>
          <td class="num">${p.adj?won(p.adj):'<span class="muted">0원</span>'}</td><td class="num"><b>${won(p.net)}</b></td><td>${pill(p.status)}</td><td class="muted">${esc(p.hold||"—")}</td></tr>`).join("")}</tbody></table></div>
      </div>
      <div class="card"><h2 class="st-h">지급 일정</h2><div class="st-cal">${ROUNDS.map(r=>{const rr=DB.payouts.filter(p=>p.round===r);const h=rr.filter(p=>p.status==="보류").length;
        const st=h?"보류":rr.every(p=>p.status==="지급완료")?"지급완료":"지급예정";
        return `<div class="st-day ${r===round?"on":""}" data-r="${r}" role="button" tabindex="0"><div class="label">${past(r)?"지난 회차":"다음 지급"}</div><div class="mono">${r}</div><div class="mono">${won(sum(rr,"net"))}</div><div style="margin-top:4px">${pill(st)}${h?` <span class="muted">${h}건</span>`:""}</div></div>`}).join("")}</div></div>
      <div class="card"><h2 class="st-h">거래 원장 <span class="muted" style="font-size:12px">완료 예약 최근 ${ledger.length}건</span></h2>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>날짜</th><th>예약번호</th><th>서비스</th><th class="num">결제액</th><th class="num">수수료</th><th class="num">파트너 몫</th></tr></thead>
        <tbody>${ledger.map(b=>`<tr class="click" data-b="${b.id}"><td class="mono">${b.date}</td><td class="mono">${b.id}</td><td>${esc(b.service)}</td><td class="num">${won(b.price)}</td><td class="num">−${won(b.fee)}</td><td class="num"><b>${won(b.price-b.fee)}</b></td></tr>`).join("")}</tbody></table></div></div>
    </div>`;
    const re=()=>{render(el);App.updateBadges()};
    el.querySelectorAll("[data-r]").forEach(b=>{const f=()=>{round=b.dataset.r;sel.clear();re()};b.onclick=f;b.onkeydown=e=>{if(e.key==="Enter")f()}});
    el.querySelectorAll("[data-rel]").forEach(b=>b.onclick=()=>{const p=DB.payouts.find(x=>x.id===b.dataset.rel);
      p.status=past(p.round)?"지급완료":"지급예정";p.hold=null;App.toast(`${pname(p.partner)} 보류 해제 → ${p.status}`);re()});
    el.querySelectorAll("input[data-id]").forEach(c=>c.onchange=()=>{c.checked?sel.add(c.dataset.id):sel.delete(c.dataset.id);re()});
    el.querySelector("#st-all").onchange=e=>{sel.clear();if(e.target.checked)rows.forEach(r=>sel.add(r.id));re()};
    el.querySelector("#st-pay").onclick=()=>{const n=sel.size;DB.payouts.forEach(p=>{if(sel.has(p.id)){p.status="지급완료";p.hold=null}});sel.clear();App.toast(`${n}건 지급 처리했어요`);re()};
    el.querySelector("#st-hold").onclick=()=>{const n=sel.size;DB.payouts.forEach(p=>{if(sel.has(p.id)){p.status="보류";p.hold="운영자 보류"}});sel.clear();App.toast(`${n}건 보류했어요`);re()};
    el.querySelector("#st-csv").onclick=()=>{
      const q=v=>/[",\n]/.test(String(v))?`"${String(v).replace(/"/g,'""')}"`:v;
      const csv=[["회차","파트너ID","파트너","거래액","수수료","조정","지급액","상태","사유"].join(",")]
        .concat(rows.map(p=>[p.round,p.partner,pname(p.partner),p.gross,p.fee,p.adj,p.net,p.status,p.hold||""].map(q).join(","))).join("\n");
      App.openDrawer(`<h2 class="st-h">CSV 내보내기 · ${round}</h2><p class="muted">${rows.length}행. 복사해서 붙여넣으세요.</p>
        <textarea class="st-ta" readonly>${esc(csv)}</textarea><div style="margin-top:10px"><button class="btn primary" id="st-copy">복사</button></div>`,body=>{
        const ta=body.querySelector("textarea");body.querySelector("#st-copy").onclick=()=>{ta.select();
          (navigator.clipboard?navigator.clipboard.writeText(csv):Promise.reject()).then(()=>App.toast("복사했어요"),()=>{try{document.execCommand("copy")}catch(e){}App.toast("선택했어요. 복사하세요")})}});
    };
    el.querySelectorAll("tr[data-b]").forEach(t=>t.onclick=()=>{const b=App.booking(t.dataset.b);
      App.openDrawer(`<h2 class="st-h">${esc(b.id)} 원장</h2><table class="tbl"><tbody>
        <tr><td class="muted">날짜</td><td class="mono">${b.date}</td></tr><tr><td class="muted">서비스</td><td>${esc(b.service)}</td></tr>
        <tr><td class="muted">파트너</td><td>${esc(pname(b.partner))}</td></tr><tr><td class="muted">결제액</td><td class="num">${won(b.price)}</td></tr>
        <tr><td class="muted">수수료 15%</td><td class="num">−${won(b.fee)}</td></tr><tr><td class="muted">파트너 몫</td><td class="num"><b>${won(b.price-b.fee)}</b></td></tr></tbody></table>`)});
  }
  App.register("settlement",{title:"정산",render});
})();
