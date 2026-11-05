// 예약 관리 화면
(function(){
  const STATUSES=["매칭대기","배정완료","방문중","완료","취소","분쟁"];
  const css=`
.bookings-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.bookings-bar input{flex:1 1 200px;min-width:0}
.bookings-dl{display:grid;grid-template-columns:120px minmax(0,1fr);gap:4px 10px;margin:6px 0 0}
.bookings-dl dt{color:var(--muted)}.bookings-dl dd{margin:0;overflow-wrap:anywhere}
.bookings-sec{border-top:1px solid var(--line);padding:14px 0}
.bookings-sec h3{font-size:13px;margin:0 0 6px;color:var(--muted);font-weight:600}
.bookings-head{display:flex;align-items:center;gap:8px;margin:10px 0 4px}.bookings-head h2{margin:0;font-size:18px}
.bookings-tl{list-style:none;margin:6px 0 0;padding:0}
.bookings-tl li{position:relative;padding:0 0 12px 22px}
.bookings-tl li::before{content:"";position:absolute;left:4px;top:6px;width:10px;height:10px;border-radius:50%;border:2px solid var(--line);background:var(--surface)}
.bookings-tl li::after{content:"";position:absolute;left:9px;top:18px;bottom:0;width:2px;background:var(--line)}
.bookings-tl li:last-child::after{display:none}
.bookings-tl li.done::before{background:var(--ok);border-color:var(--ok)}
.bookings-tl li.cur::before{background:var(--accent);border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}
.bookings-tl li.cur{font-weight:600}.bookings-tl li.up{color:var(--muted)}
.bookings-tl li.badend::before{background:var(--bad);border-color:var(--bad)}
.bookings-acts{display:flex;gap:8px;flex-wrap:wrap}
.bookings-confirm{margin-top:10px;padding:12px;border-radius:8px;background:var(--bad-soft);color:var(--ink)}
.bookings-confirm p{margin:0 0 8px}
.bookings-warn{color:var(--warn);font-weight:600}.bookings-bad{color:var(--bad);font-weight:600}
.bookings-empty{padding:24px;text-align:center;color:var(--muted)}`;
  if(!document.getElementById("bookings-style")){const s=document.createElement("style");s.id="bookings-style";s.textContent=css;document.head.appendChild(s)}

  const st={tab:"전체",q:"",svc:""};
  let rootEl=null;

  function deadline(b){
    if(b.status!=="매칭대기"||b.deadlineMin==null)return "";
    return b.deadlineMin>=0?`<span class="bookings-warn">마감 ${b.deadlineMin}분 남음</span>`:`<span class="bookings-bad">마감 ${-b.deadlineMin}분 지남</span>`;
  }
  function filtered(){
    const q=st.q.trim().toLowerCase();
    return DB.bookings.filter(b=>(st.tab==="전체"||b.status===st.tab)&&(!st.svc||b.service===st.svc)&&
      (!q||[b.id,b.customer,b.phone].some(v=>String(v).toLowerCase().includes(q))));
  }
  function drawList(){
    const {esc,won,pill,partner}=App;
    const cnt=s=>s==="전체"?DB.bookings.length:DB.bookings.filter(b=>b.status===s).length;
    const rows=filtered();
    const svcs=(DB.SERVICES||[]).map(s=>s.k);
    rootEl.innerHTML=`
      <div class="tabs" role="tablist">${["전체",...STATUSES].map(s=>`<button type="button" data-tab="${s}" class="${st.tab===s?"on":""}">${s}<b>${cnt(s)}</b></button>`).join("")}</div>
      <div class="bookings-bar">
        <input type="search" id="bkQ" placeholder="예약번호·고객·전화 검색" value="${esc(st.q)}" aria-label="검색">
        <select id="bkSvc" aria-label="서비스"><option value="">전체 서비스</option>${svcs.map(s=>`<option ${st.svc===s?"selected":""}>${s}</option>`).join("")}</select>
      </div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>예약번호</th><th>상태</th><th>서비스</th><th>고객</th><th>지역</th><th>방문일시</th><th>파트너</th><th class="num">금액</th><th>매칭 마감</th></tr></thead>
      <tbody>${rows.map(b=>{const p=partner(b.partner);return `<tr class="click" data-id="${b.id}" tabindex="0">
        <td class="mono">${b.id}</td><td>${pill(b.status)}</td><td>${esc(b.service)}</td><td>${esc(b.customer)}</td><td>${esc(b.region)}</td>
        <td class="mono">${b.date.slice(5)} ${String(b.hour).padStart(2,"0")}:00</td>
        <td>${p?esc(p.name):'<span class="bookings-warn">미배정</span>'}</td><td class="num">${won(b.price)}</td><td>${deadline(b)}</td></tr>`}).join("")}</tbody></table>
      ${rows.length?"":'<div class="bookings-empty">조건에 맞는 예약이 없어요</div>'}</div>`;
    rootEl.querySelectorAll("[data-tab]").forEach(t=>t.onclick=()=>{st.tab=t.dataset.tab;drawList()});
    const q=rootEl.querySelector("#bkQ");
    q.oninput=()=>{st.q=q.value;const pos=q.selectionStart;drawList();const n=rootEl.querySelector("#bkQ");n.focus();n.setSelectionRange(pos,pos)};
    rootEl.querySelector("#bkSvc").onchange=e=>{st.svc=e.target.value;drawList()};
    rootEl.querySelectorAll("tr[data-id]").forEach(tr=>{tr.onclick=()=>openBooking(tr.dataset.id);tr.onkeydown=e=>{if(e.key==="Enter")openBooking(tr.dataset.id)}});
  }

  function timeline(b){
    const s=b.status, visit=`${b.date} ${String(b.hour).padStart(2,"0")}:00`;
    const order=["매칭대기","배정완료","방문중","완료"];
    const steps=[["요청 접수",b.createdAt],["매칭","파트너 찾는 중"],["배정","파트너 확정"],["방문",visit]];
    let idx; // index of current step
    if(s==="매칭대기")idx=1;else if(s==="배정완료")idx=2;else if(s==="방문중")idx=3;else idx=4;
    const endLabel=s==="취소"?"취소":s==="분쟁"?"분쟁":"완료";
    steps.push([endLabel,s==="취소"?"예약 취소됨":s==="분쟁"?"처리 필요":"서비스 종료"]);
    if(s==="취소"){ // 취소: 끝 단계만 표시, 중간은 회색
      return `<ol class="bookings-tl">${steps.map((x,i)=>{const c=i===0?"done":i===4?"badend cur":"up";return `<li class="${c}">${x[0]} <span class="muted">${App.esc(x[1])}</span></li>`}).join("")}</ol>`;
    }
    return `<ol class="bookings-tl">${steps.map((x,i)=>{let c=i<idx?"done":i===idx?"cur":"up";if(i===4&&s==="분쟁")c="badend cur";if(i===4&&s==="완료")c="done";return `<li class="${c}">${x[0]} <span class="muted">${App.esc(x[1])}</span></li>`}).join("")}</ol>`;
  }

  function actions(b){
    const A={
      "매칭대기":[["dispatch","배정 보드로","primary"],["cancel","예약 취소","danger"]],
      "배정완료":[["start","방문 시작 처리","primary"],["change","파트너 변경",""],["cancel","취소","danger"]],
      "방문중":[["finish","완료 처리","primary"]],
      "완료":[["dispute","분쟁 접수","danger"],["refund","부분 환불",""]],
      "분쟁":[["refundClose","고객 환불 후 종료","danger"],["noFault","파트너 귀책 없음 종결","primary"]],
      "취소":[]
    }[b.status]||[];
    if(!A.length)return '<p class="muted" style="margin:0">취소된 예약이라 할 수 있는 액션이 없어요</p>';
    return `<div class="bookings-acts">${A.map(a=>`<button type="button" class="btn ${a[2]}" data-act="${a[0]}">${a[1]}</button>`).join("")}</div><div id="bkConfirm"></div>`;
  }

  function openBooking(id){
    const b=App.booking(id); if(!b){App.toast("예약을 찾을 수 없어요");return}
    const {esc,won,pill,partner}=App, p=partner(b.partner);
    const html=`
      <div class="bookings-head"><h2 class="mono">${b.id}</h2>${pill(b.status)}</div>
      <div class="muted">${esc(b.service)} · ${b.date} ${String(b.hour).padStart(2,"0")}:00 · ${b.duration}시간 ${b.status==="매칭대기"?" · "+deadline(b):""}</div>
      <div class="bookings-sec"><h3>가능한 액션</h3>${actions(b)}</div>
      <div class="bookings-sec"><h3>상태 타임라인</h3>${timeline(b)}</div>
      <div class="bookings-sec"><h3>고객</h3><dl class="bookings-dl"><dt>이름</dt><dd>${esc(b.customer)}</dd><dt>전화</dt><dd class="mono">${esc(b.phone)}</dd><dt>주소</dt><dd>${esc(b.region)} ${esc(b.address)}</dd><dt>메모</dt><dd>${esc(b.memo)||'<span class="muted">없음</span>'}</dd></dl></div>
      <div class="bookings-sec"><h3>파트너</h3>${p?`<dl class="bookings-dl"><dt>이름</dt><dd>${esc(p.name)}</dd><dt>평점</dt><dd class="mono">★ ${p.rating}</dd><dt>전화</dt><dd class="mono">${esc(p.phone)}</dd></dl>`:
        `<p style="margin:0 0 8px" class="bookings-warn">미배정</p><button type="button" class="btn primary" data-act="dispatch">배정 보드에서 배정</button>`}</div>
      <div class="bookings-sec"><h3>결제 분해</h3><dl class="bookings-dl"><dt>결제액</dt><dd class="num">${won(b.price)}</dd><dt>플랫폼 수수료 15%</dt><dd class="num">−${won(b.fee)}</dd><dt>파트너 정산 예정</dt><dd class="num"><b>${won(b.price-b.fee)}</b></dd></dl></div>`;
    App.openDrawer(html,body=>{
      body.querySelectorAll("[data-act]").forEach(btn=>btn.onclick=()=>act(b,btn.dataset.act,body));
    });
  }

  function done(b,msg){
    App.toast(msg); if(rootEl&&rootEl.isConnected)drawList(); App.updateBadges(); openBooking(b.id);
  }
  function act(b,a,body){
    if(a==="dispatch"){App.closeDrawer();App.go("dispatch",b.id);return}
    if(a==="cancel"){
      const box=body.querySelector("#bkConfirm");
      box.innerHTML=`<div class="bookings-confirm"><p><b>${b.id}</b> 예약을 취소할까요? 고객에게 취소 안내가 가요.</p><div class="bookings-acts"><button type="button" class="btn danger" data-c="yes">취소 확정</button><button type="button" class="btn" data-c="no">돌아가기</button></div></div>`;
      box.querySelector('[data-c="yes"]').onclick=()=>{b.status="취소";b.deadlineMin=null;done(b,`${b.id} 예약을 취소했어요`)};
      box.querySelector('[data-c="no"]').onclick=()=>{box.innerHTML=""};
      return;
    }
    if(a==="start"){b.status="방문중";b.late=false;return done(b,"방문 시작으로 바꿨어요")}
    if(a==="change"){b.status="매칭대기";b.partner=null;b.deadlineMin=60;return done(b,"파트너를 해제했어요. 다시 매칭해 주세요")}
    if(a==="finish"){b.status="완료";return done(b,"완료 처리했어요")}
    if(a==="dispute"){b.status="분쟁";return done(b,"분쟁으로 접수했어요")}
    if(a==="refund"){const amt=Math.round(b.price*0.1/1000)*1000;b.memo=(b.memo?b.memo+" / ":"")+`부분 환불 ${App.won(amt)} (${DB.today})`;return done(b,`${App.won(amt)} 부분 환불했어요`)}
    if(a==="refundClose"){b.status="취소";b.memo=(b.memo?b.memo+" / ":"")+"분쟁: 고객 전액 환불";return done(b,"고객 환불 후 종료했어요")}
    if(a==="noFault"){b.status="완료";b.memo=(b.memo?b.memo+" / ":"")+"분쟁: 파트너 귀책 없음";return done(b,"파트너 귀책 없음으로 종결했어요")}
  }

  App.register("bookings",{title:"예약 관리",render(el,param){
    rootEl=el;
    try{param=param&&decodeURIComponent(param)}catch(e){}
    if(param&&STATUSES.includes(param))st.tab=param;
    drawList();
    if(param&&param.startsWith("B"))openBooking(param);
  }});
})();
