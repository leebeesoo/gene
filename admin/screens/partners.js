// 파트너 목록 + 품질 지표
(function(){
  const {esc,won,pill}=App;
  const STD={rating:{ok:v=>v>=4.3,t:"기준 4.3 이상"},acceptRate:{ok:v=>v>=75,t:"기준 75% 이상"},
    responseMin:{ok:v=>v<=30,t:"기준 30분 이내"},cancelRate:{ok:v=>v<=5,t:"기준 5% 이하"}};
  const miss=p=>Object.keys(STD).filter(k=>!STD[k].ok(p[k]));
  const LBL={rating:"평점",acceptRate:"수락률",responseMin:"응답 시간",cancelRate:"취소율"};
  const GRADES=["골드","실버","브론즈"];
  let tab="전체",onlyMiss=false;

  if(!document.getElementById("pt-style")){const s=document.createElement("style");s.id="pt-style";s.textContent=`
.pt-bar{display:flex;align-items:flex-end;gap:10px;flex-wrap:wrap;margin-bottom:12px}.pt-bar .tabs{margin-bottom:0;flex:1;min-width:0}
.pt-chip{font:inherit;font-size:12.5px;border:1px solid var(--line);background:var(--surface);color:var(--muted);border-radius:999px;padding:4px 12px;cursor:pointer;margin-bottom:6px}
.pt-chip.on{background:var(--bad-soft);border-color:var(--bad);color:var(--bad);font-weight:600}
.pt-bad{color:var(--bad);font-weight:600}.pt-mk{font-size:10px;margin-left:3px;vertical-align:super}
.pt-sub{font:11px var(--mono);color:var(--muted)}
.pt-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding-right:60px}.pt-head h2{margin:0;font-size:18px}
.pt-need{background:var(--bad-soft);border:1px solid var(--bad);border-radius:9px;padding:10px 12px;margin:14px 0}.pt-need b{color:var(--bad)}.pt-need ul{margin:4px 0 0;padding-left:18px}
.pt-tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:14px 0}
.pt-tile{border:1px solid var(--line);border-radius:9px;padding:9px 10px;background:var(--surface2)}.pt-tile .kpi{font-size:19px}
.pt-tile.pt-miss{border-color:var(--bad);background:var(--bad-soft)}.pt-tile.pt-miss .kpi{color:var(--bad)}
.pt-sec{margin:16px 0 6px;font-weight:600}
.pt-list{list-style:none;margin:0;padding:0;border:1px solid var(--line);border-radius:9px}
.pt-list li{display:flex;gap:8px;align-items:center;padding:7px 10px;border-bottom:1px solid var(--line);font-size:13px}.pt-list li:last-child{border:0}
.pt-list .pt-r{margin-left:auto}
.pt-acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:18px;padding-top:14px;border-top:1px solid var(--line)}
.pt-confirm{width:100%;display:flex;gap:8px;flex-wrap:wrap;align-items:center;background:var(--warn-soft);border-radius:9px;padding:10px}
@media(max-width:520px){.pt-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}`;document.head.appendChild(s)}

  function cell(p,k,txt){return miss(p).includes(k)?`<td class="num pt-bad" title="${STD[k].t}">${txt}<span class="pt-mk">▼</span></td>`:`<td class="num">${txt}</td>`}

  function render(el){
    const counts={전체:DB.partners.length};["활성","심사중","정지"].forEach(s=>counts[s]=DB.partners.filter(p=>p.status===s).length);
    let rows=DB.partners.filter(p=>tab==="전체"||p.status===tab);
    if(onlyMiss)rows=rows.filter(p=>miss(p).length);
    const nMiss=DB.partners.filter(p=>miss(p).length).length;
    el.innerHTML=`<div class="pt-bar"><div class="tabs">${Object.keys(counts).map(s=>`<button type="button" data-t="${s}" class="${s===tab?"on":""}">${s}<b>${counts[s]}</b></button>`).join("")}</div>
      <button type="button" class="pt-chip ${onlyMiss?"on":""}" data-miss aria-pressed="${onlyMiss}">기준 미달만 · ${nMiss}</button></div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>파트너</th><th>상태</th><th>등급</th><th>서비스</th><th>지역</th><th class="num">평점</th><th class="num">수락률</th><th class="num">평균 응답</th><th class="num">취소율</th><th class="num">30일 작업</th></tr></thead><tbody>
      ${rows.map(p=>`<tr class="click" data-id="${p.id}" tabindex="0"><td><div>${esc(p.name)}</div><div class="pt-sub">${p.id}</div></td><td>${pill(p.status)}</td><td>${esc(p.grade)}</td><td>${esc(p.skills.join(", "))}</td><td>${esc(p.region)}</td>
        ${cell(p,"rating",p.rating.toFixed(1))}${cell(p,"acceptRate",p.acceptRate+"%")}${cell(p,"responseMin",p.responseMin+"분")}${cell(p,"cancelRate",p.cancelRate+"%")}<td class="num">${p.jobs30}</td></tr>`).join("")
        ||`<tr><td colspan="10" class="muted" style="text-align:center;padding:24px">해당 파트너가 없습니다</td></tr>`}
      </tbody></table></div><p class="muted" style="font-size:12px">▼ 기준 미달 · 평점 4.3 이상, 수락률 75% 이상, 응답 30분 이내, 취소율 5% 이하</p>`;
    el.querySelectorAll("[data-t]").forEach(b=>b.onclick=()=>{tab=b.dataset.t;render(el)});
    el.querySelector("[data-miss]").onclick=()=>{onlyMiss=!onlyMiss;render(el)};
    el.querySelectorAll("tr[data-id]").forEach(tr=>{const o=()=>detail(tr.dataset.id,el);tr.onclick=o;tr.onkeydown=e=>{if(e.key==="Enter")o()}});
  }

  function detail(id,listEl){
    const p=App.partner(id);if(!p)return;
    const m=miss(p);
    const need=[];if(p.status==="심사중")need.push("서류: "+(p.docs||"심사 대기"));m.forEach(k=>need.push(`${LBL[k]} 기준 미달 (${STD[k].t})`));
    const tile=(lbl,val,std,bad)=>`<div class="pt-tile ${bad?"pt-miss":""}"><div class="label">${lbl}</div><div class="kpi">${val}</div><div class="pt-sub">${std}</div></div>`;
    const bks=DB.bookings.filter(b=>b.partner===id).slice().sort((a,b)=>(b.date+b.hour).localeCompare(a.date+a.hour)).slice(0,5);
    const pays=DB.payouts.filter(x=>x.partner===id);const sum={};pays.forEach(x=>sum[x.status]=(sum[x.status]||0)+x.net);
    let acts="";
    if(p.status==="심사중")acts=`<button class="btn primary" data-a="approve">승인</button><button class="btn danger" data-a="reject">반려</button>`;
    else if(p.status==="활성")acts=`<button class="btn danger" data-a="suspend">활동 정지</button><label class="muted" style="font-size:13px">등급 <select data-a="grade">${GRADES.map(g=>`<option ${g===p.grade?"selected":""}>${g}</option>`).join("")}</select></label>`;
    else acts=`<button class="btn primary" data-a="resume">정지 해제</button>`;
    App.openDrawer(`<div class="pt-head"><h2>${esc(p.name)}</h2>${pill(p.status)}<span class="pill mute">${esc(p.grade)}</span></div>
      <div class="pt-sub" style="margin-top:4px">${p.id} · ${esc(p.region)} · ${esc(p.skills.join(", "))} · ${esc(p.phone)} · 가입 ${p.joined}</div>
      ${need.length?`<div class="pt-need"><b>필요 조치</b><ul>${need.map(t=>`<li>${esc(t)}</li>`).join("")}</ul></div>`:""}
      <div class="pt-tiles">${tile("평점",p.rating.toFixed(1),STD.rating.t,m.includes("rating"))}${tile("수락률",p.acceptRate+"%",STD.acceptRate.t,m.includes("acceptRate"))}
      ${tile("응답 시간",p.responseMin+"분",STD.responseMin.t,m.includes("responseMin"))}${tile("취소율",p.cancelRate+"%",STD.cancelRate.t,m.includes("cancelRate"))}
      ${tile("재이용률",p.reorderRate+"%","참고 지표",false)}${tile("30일 작업",p.jobs30+"건","참고 지표",false)}</div>
      <div class="pt-sec">최근 예약</div>${bks.length?`<ul class="pt-list">${bks.map(b=>`<li><span class="mono">${esc(b.id)}</span><span>${esc(b.service)}</span><span class="muted">${esc(b.date)}</span><span class="pt-r">${pill(b.status)}</span></li>`).join("")}</ul>`:`<p class="muted">예약 내역이 없습니다</p>`}
      <div class="pt-sec">정산 요약</div>${pays.length?`<ul class="pt-list">${Object.keys(sum).map(s=>`<li>${pill(s)}<span class="pt-r num">${won(sum[s])}</span></li>`).join("")}</ul>`:`<p class="muted">정산 내역이 없습니다</p>`}
      <div class="pt-acts" data-acts>${acts}</div>`,body=>{
      const box=body.querySelector("[data-acts]");
      const done=(msg)=>{App.toast(msg);render(listEl);App.updateBadges();detail(id,listEl)};
      const confirmUI=(html,onOk)=>{box.innerHTML=`<div class="pt-confirm">${html}<button class="btn" data-x>취소</button><button class="btn primary" data-ok>확인</button></div>`;
        box.querySelector("[data-x]").onclick=()=>detail(id,listEl);box.querySelector("[data-ok]").onclick=()=>onOk(box)};
      box.querySelectorAll("[data-a]").forEach(c=>{const a=c.dataset.a;
        if(a==="grade"){c.onchange=()=>{p.grade=c.value;done(`${p.name} 등급을 ${p.grade}로 바꿨습니다`)};return}
        c.onclick=()=>{
          if(a==="approve"){p.status="활성";p.docs=null;done(`${p.name} 승인했습니다`)}
          else if(a==="resume"){p.status="활성";done(`${p.name} 정지를 해제했습니다`)}
          else if(a==="reject")confirmUI(`<span>반려 사유</span><select data-r><option>서류 미비</option><option>자격 미충족</option><option>연락 불가</option><option>기타</option></select>`,b=>{p.status="정지";p.rejectReason=b.querySelector("[data-r]").value;done(`${p.name} 반려했습니다 (${p.rejectReason})`)});
          else if(a==="suspend")confirmUI(`<span>활동을 정지할까요? 새 배정이 멈춥니다.</span>`,()=>{p.status="정지";done(`${p.name} 활동을 정지했습니다`)});
        }});
    });
  }
  App.register("partners",{title:"파트너",render});
})();
