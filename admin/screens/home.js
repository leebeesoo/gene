// 홈: 예외부터 보여주는 화면
(function(){
  const CSS=`
.home-tiles{grid-template-columns:repeat(auto-fit,minmax(170px,1fr))}
.home-tile{text-align:left;font:inherit;color:inherit;cursor:pointer;border-left:4px solid var(--line);display:flex;flex-direction:column;gap:4px}
.home-tile:hover{border-color:var(--accent)}
.home-tile:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.home-tile.bad{border-left-color:var(--bad)}.home-tile.bad .home-n{color:var(--bad)}
.home-tile.warn{border-left-color:var(--warn)}.home-tile.warn .home-n{color:var(--warn)}
.home-n{font:600 30px var(--mono);font-variant-numeric:tabular-nums;line-height:1.1}
.home-t{font-weight:600}.home-h{font-size:12px;color:var(--muted)}
.home-kpis{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.home-kpis .kpi{font-size:18px}
.home-main{grid-template-columns:minmax(0,2fr) minmax(0,1fr);align-items:start}
@media (max-width:900px){.home-main{grid-template-columns:1fr}}
.home-sec{display:flex;align-items:center;gap:8px;margin:0 0 10px;flex-wrap:wrap}
.home-sec h2{font-size:15px;margin:0}
.home-bar{display:grid;grid-template-columns:52px minmax(0,1fr) 28px;align-items:center;gap:8px;margin:8px 0;font-size:13px;width:100%;background:none;border:0;padding:0;color:inherit;cursor:pointer;text-align:left}
.home-bar:hover .home-fill{background:var(--accent)}
.home-track{background:var(--surface2);border-radius:4px;height:14px;overflow:hidden}
.home-fill{background:var(--info);height:100%;border-radius:4px}
.home-empty{padding:16px;color:var(--muted);text-align:center}
`;
  if(!document.getElementById("home-style")){const s=document.createElement("style");s.id="home-style";s.textContent=CSS;document.head.appendChild(s)}

  const {esc,won,pill}=App;
  const reason=b=>{
    if(b.status==="매칭대기"&&b.deadlineMin<0) return {r:`응답 마감 ${-b.deadlineMin}분 지남`,p:0,k:b.deadlineMin};
    if(b.status==="매칭대기"&&b.deadlineMin<60) return {r:`응답 마감 ${b.deadlineMin}분 남음`,p:3,k:b.deadlineMin};
    if(b.late) return {r:"방문 지연 위험",p:1,k:b.hour};
    if(b.status==="분쟁") return {r:"분쟁 처리 필요",p:2,k:0};
    return null;
  };

  function render(el){
    const B=DB.bookings;
    const wait=B.filter(b=>b.status==="매칭대기");
    const soon=wait.filter(b=>b.deadlineMin<60);
    const over=soon.filter(b=>b.deadlineMin<0).length;
    const late=B.filter(b=>b.late);
    const disp=B.filter(b=>b.status==="분쟁");
    const hold=DB.payouts.filter(p=>p.status==="보류");
    const open=DB.tickets.filter(t=>t.status==="미처리");
    const tiles=[
      {n:wait.length,t:"미배정 예약",h:"파트너 배정 전",tone:"warn",go:["bookings","매칭대기"]},
      {n:soon.length,t:"응답 마감 임박",h:over?`${over}건 마감 지남`:"1시간 안에 마감",tone:"bad",go:["dispatch"]},
      {n:late.length,t:"방문 지연 위험",h:"파트너 연락 필요",tone:"bad",go:["bookings","배정완료"]},
      {n:disp.length,t:"분쟁",h:"환불·보상 판단",tone:"bad",go:["bookings","분쟁"]},
      {n:hold.length,t:"정산 보류",h:hold.length?won(hold.reduce((a,p)=>a+p.net,0))+" 묶임":"보류 없음",tone:"warn",go:["settlement"]},
      {n:open.length,t:"미처리 문의",h:"답변 대기",tone:"warn",go:["cs"]}
    ];
    const today=B.filter(b=>b.date===DB.today);
    const todayAmt=today.filter(b=>b.status!=="취소").reduce((a,b)=>a+b.price,0);
    const act=DB.partners.filter(p=>p.status==="활성");
    const avg=act.length?(act.reduce((a,p)=>a+p.rating,0)/act.length).toFixed(2):"-";

    const items=B.map(b=>({b,x:reason(b)})).filter(o=>o.x).sort((a,c)=>a.x.p-c.x.p||a.x.k-c.x.k);
    const top=items.slice(0,8);

    const cnt={}; DB.SERVICES.forEach(s=>cnt[s.k]=0); B.forEach(b=>cnt[b.service]=(cnt[b.service]||0)+1);
    const max=Math.max(1,...Object.values(cnt));

    el.innerHTML=`
<div class="grid home-tiles">${tiles.map((t,i)=>`
  <button type="button" class="card home-tile ${t.n>0?t.tone:""}" data-i="${i}">
    <span class="home-n">${t.n}</span><span class="home-t">${esc(t.t)}</span><span class="home-h">${esc(t.h)}</span>
  </button>`).join("")}
</div>
<div class="grid home-kpis" style="margin-top:12px">
  <div class="card"><div class="label">오늘 예약</div><div class="kpi">${today.length}건</div></div>
  <div class="card"><div class="label">오늘 예상 거래액</div><div class="kpi">${won(todayAmt)}</div></div>
  <div class="card"><div class="label">활성 파트너</div><div class="kpi">${act.length}명</div></div>
  <div class="card"><div class="label">평균 평점</div><div class="kpi">${avg}</div></div>
</div>
<div class="grid home-main" style="margin-top:12px">
  <div class="card">
    <div class="home-sec"><h2>지금 처리할 일</h2><span class="muted">${items.length}건 중 급한 ${top.length}건</span>
      <button type="button" class="btn" id="home-all" style="margin-left:auto">전체 보기</button></div>
    ${top.length?`<div class="tbl-wrap"><table class="tbl"><thead><tr><th>상태</th><th>예약번호</th><th>서비스</th><th>고객</th><th>사유</th><th></th></tr></thead><tbody>
    ${top.map(({b,x})=>`<tr><td>${pill(b.status)}</td><td class="mono">${esc(b.id)}</td><td>${esc(b.service)}</td><td>${esc(b.customer)}</td>
      <td style="color:var(${x.p<3?"--bad":"--warn"})">${esc(x.r)}</td>
      <td><button type="button" class="btn" data-open="${esc(b.id)}">열기</button></td></tr>`).join("")}
    </tbody></table></div>`:`<div class="home-empty">지금 처리할 일이 없습니다</div>`}
  </div>
  <div class="card">
    <div class="home-sec"><h2>서비스별 예약</h2><span class="muted">전체 ${B.length}건</span></div>
    ${Object.entries(cnt).map(([k,v])=>`<button type="button" class="home-bar" data-svc="${esc(k)}" aria-label="${esc(k)} ${v}건">
      <span>${esc(k)}</span><span class="home-track"><span class="home-fill" style="display:block;width:${Math.round(v/max*100)}%"></span></span><span class="num">${v}</span></button>`).join("")}
  </div>
</div>`;

    el.querySelectorAll(".home-tile").forEach(btn=>btn.onclick=()=>{const t=tiles[+btn.dataset.i];App.go(t.go[0],t.go[1])});
    el.querySelectorAll("[data-open]").forEach(btn=>btn.onclick=()=>App.go("bookings",btn.dataset.open));
    el.querySelectorAll("[data-svc]").forEach(btn=>btn.onclick=()=>{App.toast(`${btn.dataset.svc} 예약 목록으로 이동`);App.go("bookings")});
    el.querySelector("#home-all").onclick=()=>App.go("bookings");
  }

  App.register("home",{title:"홈",render});
})();
