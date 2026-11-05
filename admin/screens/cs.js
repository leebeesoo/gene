// 리뷰·CS: 왼쪽 대기 목록 + 오른쪽 상세
(function(){
  const {esc,won,pill}=App;
  if(!document.getElementById("cs-style")){
    const s=document.createElement("style");s.id="cs-style";
    s.textContent=`
.cs-wrap{display:grid;grid-template-columns:360px minmax(0,1fr);gap:16px;align-items:start}
.cs-side{min-width:0}
.cs-filter{display:flex;gap:8px;align-items:center;margin-bottom:10px}
.cs-filter select{flex:1}
.cs-list{background:var(--surface);border:1px solid var(--line);border-radius:10px;overflow:auto;max-height:calc(100vh - 220px)}
.cs-item{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);background:none;font:inherit;color:var(--ink);padding:10px 12px;cursor:pointer;border-left:3px solid transparent}
.cs-item:hover{background:var(--surface2)}
.cs-item.on{background:var(--accent-soft);border-left-color:var(--accent)}
.cs-item:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.cs-row{display:flex;align-items:center;gap:6px}
.cs-row .pill{margin-left:auto}
.cs-chip{font-size:11.5px;border:1px solid var(--line);border-radius:5px;padding:0 6px;color:var(--muted);background:var(--surface)}
.cs-snip{color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
.cs-meta{font:11.5px var(--mono);color:var(--muted);margin-top:2px;display:flex;gap:8px}
.cs-star{color:var(--warn)}.cs-star.low{color:var(--bad);font-weight:600}
.cs-empty{padding:24px;text-align:center;color:var(--muted)}
.cs-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.cs-head h2{font-size:17px;margin:0}
.cs-bubble{background:var(--surface2);border:1px solid var(--line);border-radius:10px 10px 10px 2px;padding:10px 12px;max-width:560px}
.cs-reply{background:var(--accent-soft);border-radius:10px 10px 2px 10px;padding:10px 12px;max-width:560px;margin:8px 0 0 auto}
.cs-by{font-size:11.5px;color:var(--muted);margin-bottom:2px}
.cs-sec{margin-top:16px}
.cs-bk{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px 14px;border:1px solid var(--line);border-radius:8px;padding:10px 12px;margin-top:6px}
.cs-bk div b{display:block;font-weight:500}
.cs-chips{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0 8px}
.cs-tpl{font:inherit;font-size:12.5px;border:1px dashed var(--accent);background:var(--surface);color:var(--accent);border-radius:999px;padding:3px 10px;cursor:pointer}
.cs-tpl:hover{background:var(--accent-soft)}
.cs-box textarea{width:100%;box-sizing:border-box;min-height:84px;resize:vertical}
.cs-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.cs-acts .cs-push{margin-left:auto}
@media (max-width:900px){.cs-wrap{grid-template-columns:1fr}.cs-list{max-height:340px}}
`;document.head.appendChild(s);}

  const TPL={
    "환불 요청":["사진 확인 후 부분 환불 안내","재방문 청소 제안","전액 환불 처리 안내"],
    "일정 변경":["변경 가능 시간 안내","파트너와 일정 조율 중"],
    "파트너 노쇼":["대체 파트너 긴급 배정","노쇼 보상 쿠폰 지급 안내","파트너 연락 시도 중"],
    "리뷰":["소중한 리뷰 감사합니다","불편 드려 죄송합니다. 확인 후 연락드릴게요"],
    "견적 문의":["견적 차이 이유 안내","추가 견적 요청 안내"],
    "결제 오류":["중복 결제 취소 처리 안내","카드사 확인 후 3일 내 환불"],
    "파트너 문의":["정산 내역 확인 후 안내","수수료 기준 안내"]
  };
  const ST=["미처리","처리중","완료","전체"];
  let tab="미처리", type="전체", sel=null;

  function stars(n){return `<span class="cs-star ${n<=2?"low":""}">${"★".repeat(n)}${"☆".repeat(5-n)}</span>`}
  function filtered(){return DB.tickets.filter(t=>(tab==="전체"||t.status===tab)&&(type==="전체"||t.type===type))}

  function render(el){
    const list=filtered();
    if(!list.find(t=>t.id===sel)) sel=list[0]?list[0].id:null;
    const types=["전체",...new Set(DB.tickets.map(t=>t.type))];
    el.innerHTML=`<div class="cs-wrap">
      <section class="cs-side">
        <div class="tabs" role="tablist">${ST.map(s=>`<button type="button" data-tab="${s}" class="${s===tab?"on":""}">${s}<b>${s==="전체"?DB.tickets.length:DB.tickets.filter(t=>t.status===s).length}</b></button>`).join("")}</div>
        <div class="cs-filter"><span class="label">유형</span><select id="csType">${types.map(t=>`<option ${t===type?"selected":""}>${esc(t)}</option>`).join("")}</select></div>
        <div class="cs-list">${list.length?list.map(t=>`<button type="button" class="cs-item ${t.id===sel?"on":""}" data-id="${t.id}">
          <div class="cs-row"><span class="cs-chip">${esc(t.type)}</span><b>${esc(t.name)}</b><span class="muted" style="font-size:12px">${esc(t.from)}</span>${pill(t.status)}</div>
          <div class="cs-snip">${esc(t.text)}</div>
          <div class="cs-meta"><span>${esc(t.createdAt)}</span>${t.rating?stars(t.rating):""}${t.replies.length?`<span>답변 ${t.replies.length}</span>`:""}</div>
        </button>`).join(""):`<div class="cs-empty">해당하는 문의가 없어요</div>`}</div>
      </section>
      <section class="card cs-detail">${detail(DB.tickets.find(t=>t.id===sel))}</section>
    </div>`;
    el.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{tab=b.dataset.tab;sel=null;render(el)});
    el.querySelector("#csType").onchange=e=>{type=e.target.value;sel=null;render(el)};
    el.querySelectorAll(".cs-item").forEach(b=>b.onclick=()=>{sel=b.dataset.id;render(el);if(innerWidth<=900)el.querySelector(".cs-detail").scrollIntoView({behavior:"smooth"})});
    bindDetail(el);
  }

  function detail(t){
    if(!t) return `<div class="cs-empty">왼쪽에서 문의를 고르세요</div>`;
    const b=App.booking(t.booking), p=b&&b.partner?App.partner(b.partner):null;
    const low=t.type==="리뷰"&&t.rating===1;
    return `<div class="cs-head"><span class="cs-chip">${esc(t.type)}</span><h2>${esc(t.name)} <span class="muted" style="font-size:13px;font-weight:400">${esc(t.from)}</span></h2><span class="mono muted">${esc(t.id)}</span>${pill(t.status)}<span class="muted mono" style="margin-left:auto;font-size:12px">${esc(t.createdAt)}</span></div>
      <div class="cs-bubble"><div class="cs-by">${esc(t.name)}${t.rating?" · "+stars(t.rating):""}</div>${esc(t.text)}</div>
      ${t.replies.map(r=>`<div class="cs-reply"><div class="cs-by">운영자 · ${esc(r.at)}</div>${esc(r.text)}</div>`).join("")}
      ${b?`<div class="cs-sec"><div class="label">연결된 예약</div><div class="cs-bk">
        <div><span class="label">예약</span><b class="mono">${esc(b.id)}</b></div>
        <div><span class="label">서비스</span><b>${esc(b.service)}</b></div>
        <div><span class="label">일시</span><b class="mono">${esc(b.date.slice(5))} ${b.hour}:00</b></div>
        <div><span class="label">파트너</span><b>${p?esc(p.name):"미배정"}</b></div>
        <div><span class="label">금액</span><b class="mono">${won(b.price)}</b></div>
        <div><span class="label">상태</span><b>${pill(b.status)}</b></div>
      </div><div class="cs-acts"><button class="btn" data-act="openBk">예약 열기</button>
        ${t.type==="파트너 노쇼"?`<button class="btn primary" data-act="dispatch">대체 파트너 찾기</button>`:""}
        ${low?`<button class="btn" data-act="hide">리뷰 숨김 요청</button><button class="btn danger" data-act="warn">파트너에게 경고</button>`:""}
      </div></div>`:""}
      <div class="cs-sec cs-box"><div class="label">답변</div>
        <div class="cs-chips">${(TPL[t.type]||[]).map(x=>`<button type="button" class="cs-tpl" data-tpl="${esc(x)}">${esc(x)}</button>`).join("")}</div>
        <textarea id="csText" placeholder="고객에게 보낼 답변을 적어 주세요"></textarea>
        <div class="cs-acts"><button class="btn" data-act="done" ${t.status==="완료"?"disabled":""}>처리 완료</button><button class="btn primary cs-push" data-act="send">답변 보내기</button></div>
      </div>`;
  }

  function bindDetail(el){
    const t=DB.tickets.find(x=>x.id===sel); if(!t) return;
    const ta=el.querySelector("#csText");
    el.querySelectorAll("[data-tpl]").forEach(b=>b.onclick=()=>{ta.value=(ta.value?ta.value+"\n":"")+b.dataset.tpl;ta.focus()});
    const act=(k,f)=>{const b=el.querySelector(`[data-act="${k}"]`);if(b)b.onclick=f};
    act("openBk",()=>App.go("bookings",t.booking));
    act("dispatch",()=>App.go("dispatch",t.booking));
    act("hide",()=>{t.hidden=true;App.toast("리뷰 숨김을 요청했어요");});
    act("warn",()=>{const b=App.booking(t.booking),p=b&&App.partner(b.partner);App.toast((p?p.name:"파트너")+"에게 경고를 보냈어요");});
    act("send",()=>{const v=ta.value.trim();if(!v){App.toast("답변 내용을 적어 주세요");ta.focus();return}
      t.replies.push({text:v,at:"11/05 14:00"});if(t.status==="미처리")t.status="처리중";
      App.toast("답변을 보냈어요");render(el);App.updateBadges()});
    act("done",()=>{t.status="완료";App.toast(t.id+" 처리 완료");render(el);App.updateBadges()});
  }

  let cur=null;
  addEventListener("keydown",e=>{
    if(!cur||!document.body.contains(cur)||/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;
    if(e.key!=="j"&&e.key!=="k")return;
    const list=filtered(),i=list.findIndex(t=>t.id===sel),n=i+(e.key==="j"?1:-1);
    if(list[n]){sel=list[n].id;render(cur);const on=cur.querySelector(".cs-item.on");on&&on.scrollIntoView({block:"nearest"})}
  });

  App.register("cs",{title:"리뷰·CS",render(el,param){cur=el;if(param&&DB.tickets.find(t=>t.id===param)){sel=param;tab="전체"}render(el)}});
})();
