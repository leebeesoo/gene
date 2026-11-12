// 농가 판단 도구 (#/farmer): 보상 대상 확인 → 손익 계산 → 연결 신청(구글 폼)
import { esc, icon, won, num } from '../util.js';
import { REGION_NAMES } from '../meta.js';
import { loadSurplus, stabItem, itemDefaults, ITEM_DEFAULTS, STAB_LABEL, placeText, perKgPrice } from '../surplus.js';
import { joinCta, updateJoinLink, foodbankHTML } from '../participate.js';
import { procFor } from '../processing.js';

const NH_URL = 'https://www.nonghyup.com';

const field = (id, label, value, { unit = '', hint = '', step = 1, min = 0 } = {}) => `<div class="field">
  <label for="fm-${id}">${label}</label>
  <div class="input-group"><input id="fm-${id}" name="${id}" type="number" inputmode="decimal" min="${min}" step="${step}" value="${esc(value)}"${hint ? ` aria-describedby="hint-${id}"` : ''}>${unit ? `<span class="suffix">${esc(unit)}</span>` : ''}</div>
  ${hint ? `<p class="hint" id="hint-${id}">${hint}</p>` : ''}</div>`;

const round10 = (v) => Math.round(v / 10) * 10;
const signed = (v) => `${v < 0 ? '−' : v > 0 ? '+' : ''}${won(Math.abs(v))}`;

export function calc(v) {
  const kgTotal = v.area * v.yieldKg;
  const sunk = v.prodCost * v.area;
  const destroy = v.comp * v.area - sunk;
  const sell = (v.price - v.fee) * kgTotal - v.harvest * v.area - sunk;
  const exp = v.expPrice * kgTotal - sunk;
  const breakEven = v.yieldKg > 0 ? (v.harvest + v.comp) / v.yieldKg + v.fee : null;
  return { kgTotal, sunk, destroy, sell, exp, breakEven };
}

function verdict(v, r) {
  if (!(v.area > 0) || !(v.yieldKg > 0)) return '면적과 수확량을 넣으면 비교해 드려요.';
  if (!(v.price > 0)) return '받을 수 있는 값(kg당)을 넣어 주세요.';
  const opts = [['destroy', r.destroy], ['sell', r.sell], ['exp', r.exp]].sort((a, b) => b[1] - a[1]);
  const [best] = opts;
  const diff = (a, b) => won(Math.abs(a - b));
  if (best[0] === 'sell') return `<b>수확해서 출하하는 쪽이 갈아엎기보다 ${diff(r.sell, r.destroy)} 더 남아요.</b>${r.exp > r.destroy ? ' 일손이 모자라면 구출 원정대도 갈아엎기보다 나아요.' : ''}`;
  if (best[0] === 'exp') return `<b>수확비가 들지 않는 구출 원정대가 가장 나아요.</b> 갈아엎기보다 ${diff(r.exp, r.destroy)}, 직접 수확해 출하하는 것보다 ${diff(r.exp, r.sell)} 더 남아요.`;
  return `<b>지금 시세로는 갈아엎는 쪽이 손해가 가장 적어요.</b> 출하보다 ${diff(r.destroy, r.sell)} 덜 손해예요.${v.comp > 0 ? '' : ' 그래도 원정대·푸드뱅크 기부·가공·연결 신청으로 일부라도 살릴 수 있는지 살펴보세요.'}`;
}

export async function farmerView(ctx) {
  ctx.noAds = true;
  const data = await loadSurplus();
  const q = ctx.query;
  const sig = q.get('signal') ? data.signals.find((s) => s.id === q.get('signal')) : null;
  const item = sig?.item || q.get('item') || '쪽파';
  const sido = sig?.sido || (REGION_NAMES.includes(q.get('sido')) ? q.get('sido') : '') || (item === '쪽파' ? '전남' : '');
  const sigungu = sig?.sigungu || q.get('sigungu') || '';
  const d = itemDefaults(item);
  const sigPrice = sig ? perKgPrice(sig.metrics) : null;
  const price = sigPrice ?? (Number(q.get('price')) || d.price || '');
  const v0 = { area: 300, yieldKg: d.yieldKg, prodCost: d.cost, comp: 0, harvest: 1500, fee: 0, price, expPrice: price ? round10(price * 0.7) : '' };
  const st = stabItem(item);
  const recentIso = data.events.filter((e) => (e.type === 'isolation' || e.type === 'disposal') && (!sido || e.sido === sido));

  ctx.title = '농가 판단 도구 — 갈아엎기·출하·원정대 손익 | 맛남의 광장';
  ctx.description = '출하정지·산지폐기 약정 물량인지 먼저 확인하고, 갈아엎기·직접 출하·구출 원정대 중 무엇이 더 남는지 평당 손익으로 비교해요.';

  ctx.el.innerHTML = `<section class="page wrap farmer">
    <nav class="crumbs" aria-label="위치"><a href="#/">오늘 남는 것</a>${icon('chevron', 12)}<span aria-current="page">농가 판단 도구</span></nav>
    <h1 class="page-title">갈아엎기 전에, 3단계만</h1>
    <p class="lead">보상 대상인지 확인하고, 손익을 비교하고, 연결·기부·가공 중 길을 골라요.${sig ? (sigPrice ? ` <b>${esc(placeText(sig) || '전국')} ${esc(sig.item)}</b> 신호의 시세(kg당 ${won(sigPrice)})를 불러왔어요.` : ` <b>${esc(placeText(sig) || '전국')} ${esc(sig.item)}</b> 신호는 kg당 시세가 없어 기본값을 넣었어요.`) : ''}</p>

    <ol class="steps" aria-label="진행 단계"><li data-s="1" class="on">보상 대상 확인</li><li data-s="2">손익 계산</li><li data-s="3">연결·나눔</li></ol>

    <section class="step-card" id="step1" aria-labelledby="h-s1">
      <h2 id="h-s1"><span class="step-no">1</span>보상 대상 확인</h2>
      <fieldset class="fs"><legend>이 물량이 <b>출하정지·산지폐기 약정 대상</b>인가요?</legend>
        <div class="chip-radios">
          <label class="chip-radio"><input type="radio" name="s1" value="yes"><span>예, 약정했어요</span></label>
          <label class="chip-radio"><input type="radio" name="s1" value="no"><span>아니요</span></label>
          <label class="chip-radio"><input type="radio" name="s1" value="unsure"><span>잘 모르겠어요</span></label>
        </div></fieldset>

      <div class="s1-out" id="s1-yes" hidden>
        <div class="notice stop" role="alert"><div>
          <b>그 물량은 넘기거나 기부하면 안 돼요</b>
          <p>출하정지·산지폐기에 약정한 물량을 팔거나 기부하면 <b>받은 보조금을 돌려줘야 하고, 최대 3년간 사업 참여가 제한</b>돼요. 약정대로 폐기하고 보상(평년 도매가의 약 80% 등)을 받으세요.</p>
          <p>다만 <b>계약 물량 중 의무(50%)를 넘는 부분</b>과 <b>규격외·비상품</b>은 연결할 수 있어요. 어디까지가 약정 물량인지는 지역농협에 먼저 확인하세요.</p>
          <div class="btns"><a class="btn" href="${NH_URL}" target="_blank" rel="noopener noreferrer">지역농협 문의 (농협 누리집)${icon('chevron', 14)}</a>
          <button type="button" class="btn ghost" data-excess>약정 외 물량만 계산하기</button></div>
        </div></div>
      </div>

      <div class="s1-out" id="s1-unsure" hidden>
        <p class="muted small">해당하는 항목에 체크해 보세요.</p>
        <ul class="checklist">
          <li><label class="check"><input type="checkbox" name="c1"><span><b>올해 이 품목으로 농협과 계약재배(채소가격안정제) 약정을 맺었어요</b><small>약정서·출하약정 확인서가 있다면 해당돼요.</small></span></label></li>
          <li><label class="check"><input type="checkbox" name="c2" ${st ? 'checked' : ''}><span><b>품목이 채소가격안정제 7개 대상이에요</b><small>${STAB_LABEL}. ${st ? `입력한 ‘${esc(item)}’은(는) 대상 품목이에요${st.note ? `(${esc(st.note)})` : ''}.` : `입력한 ‘${esc(item)}’은(는) 대상이 아니에요.`}</small></span></label></li>
          <li><label class="check"><input type="checkbox" name="c3"><span><b>최근 우리 시·군에 시장격리·산지폐기 공고가 났고, 신청했어요</b><small>${recentIso.length ? `참고: ${recentIso.slice(0, 2).map((e) => `${esc(e.date || '')} ${esc(placeText(e))} ${esc(e.item || '')}`).join(', ')} 소식이 있어요.` : '시·군청 농정과나 지역농협 공지에서 확인할 수 있어요.'}</small></span></label></li>
        </ul>
        <div class="notice" id="unsure-out" aria-live="polite"></div>
        <div class="btns"><button type="button" class="btn primary" data-unsure-go>이 결과로 손익 계산하기</button></div>
      </div>

      <div class="s1-out" id="s1-no" hidden>
        <div class="notice"><div><b>약정 물량이 아니면 연결·나눔 모두 자유예요.</b><p>정부 보상이 없다면 갈아엎는 비용도 모두 농가 몫이에요. 아래에서 무엇이 더 남는지 비교해 보세요.</p></div></div>
      </div>
    </section>

    <section class="step-card" id="step2" aria-labelledby="h-s2" hidden>
      <h2 id="h-s2"><span class="step-no">2</span>손익 계산</h2>
      <p class="notice warn" id="excess-note" hidden><span>약정 물량을 뺀 <b>계약 외 물량</b>만 면적·수확량에 넣으세요.</span></p>
      <form class="form calc" id="calc" novalidate>
        <div class="row2">
          <div class="field"><label for="fm-item">품목</label><input id="fm-item" name="crop" value="${esc(item)}" maxlength="20" list="fm-items" autocomplete="off">
            <datalist id="fm-items">${Object.keys(ITEM_DEFAULTS).map((k) => `<option value="${esc(k)}">`).join('')}</datalist></div>
          <div class="field"><label for="fm-sido">지역</label><select id="fm-sido" name="sido"><option value="">선택</option>${REGION_NAMES.map((r) => `<option ${r === sido ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        </div>
        <div class="row2">
          ${field('area', '면적', v0.area, { unit: '평', hint: '1,000㎡ ≈ 302평' })}
          ${field('yieldKg', '예상 수확량', v0.yieldKg, { unit: 'kg/평', step: 0.1, hint: '품목별 대략값이에요. 내 밭 기준으로 고치세요.' })}
        </div>
        <div class="row2">
          ${field('price', '받을 수 있는 값', v0.price, { unit: '원/kg', step: 10, hint: sigPrice ? `신호 시세(${esc(sig.metrics.price_basis || '도매')}) ${won(sig.metrics.price)}/${esc(sig.metrics.unit)}에서 kg당 ${won(sigPrice)}을 계산해 넣었어요. 농가 수취가는 이보다 낮을 수 있어요.` : '최근 받은 값이나 도매 시세를 넣으세요.' })}
          ${field('comp', '받을 수 있는 폐기 보상', v0.comp, { unit: '원/평', step: 100, hint: '대부분 0원. 예: 2026.4 조생양파 시장격리 평당 약 1만원, 2022 전남 겨울대파 평당 5,932원' })}
        </div>
        <div class="row2">
          ${field('harvest', '수확·선별·운송 작업비', v0.harvest, { unit: '원/평', step: 100, hint: '인건비 포함. 장흥 쪽파 사례 평당 약 1,500원' })}
          ${field('fee', '포장·출하 수수료', v0.fee, { unit: '원/kg', step: 10, hint: '박스·택배·도매시장 수수료 등. 작업비에 포함했다면 0' })}
        </div>
        <div class="row2">
          ${field('prodCost', '이미 들어간 생산비', v0.prodCost, { unit: '원/평', step: 100, hint: '종자·비료·임차료 등. 세 경우 모두 똑같이 빠져요.' })}
          ${field('expPrice', '원정대 현장가', v0.expPrice, { unit: '원/kg', step: 10, hint: '직접 수확해 가는 대신 시세보다 싸게(기본 70%)' })}
        </div>
      </form>

      <div class="result" aria-live="polite">
        <div class="res-grid" id="res"></div>
        <p class="verdict" id="verdict"></p>
        <p class="hint" id="breakeven"></p>
        <p class="notice warn" id="comp-note" hidden><span>보상을 받는 물량은 넘기거나 나눌 수 없어요. 같은 물량으로는 보상과 출하 중 하나만 고를 수 있어요.</span></p>
        <details class="formula"><summary>계산식 보기</summary>
          <ul>
            <li><b>갈아엎기</b> = 폐기 보상 × 면적 − 이미 들어간 생산비</li>
            <li><b>직접 출하</b> = (받을 값 − 수수료) × 수확량 − 작업비 × 면적 − 생산비</li>
            <li><b>구출 원정대</b> = 원정대 현장가 × 수확량 − 생산비 <span class="muted">(수확·운송은 원정대가 직접)</span></li>
            <li>수확량 = 면적 × 평당 수확량 · 생산비 = 평당 생산비 × 면적</li>
            <li><b>손익분기 값</b> = (작업비 + 폐기 보상) ÷ 평당 수확량 + 수수료</li>
          </ul>
          <p class="muted small">갈아엎는 트랙터 작업비, 원정대 모집이 안 될 위험은 넣지 않았어요. 참고용 계산이며 실제 보상 단가·대상은 지역농협·시군에 확인하세요.</p>
        </details>
      </div>
    </section>

    <section class="step-card" id="step3" aria-labelledby="h-s3" hidden>
      <h2 id="h-s3"><span class="step-no">3</span>연결·나눔</h2>
      <p>받을 곳(식당·가공업체·급식)을 찾고 있다면 <b>농가 연결 신청</b>을 남겨 주세요. 맞는 곳이 있으면 양쪽에 먼저 동의를 받은 뒤 서로 소개해 드려요. 값과 조건은 직접 정하고, 맛남의 광장은 물건이나 대금을 받지 않아요.</p>
      <p class="notice warn" id="s3-pledge"><span><b>신청 폼에서 한 번 더 확인해요: 출하정지·산지폐기 약정 물량이 아닌가요?</b> 약정 물량은 연결 신청을 할 수 없어요. 약정 외 물량(의무 50% 초과분, 규격외·비상품)만 남겨 주세요.</span></p>
      <div class="btns">${joinCta({ role: 'farmer', sido, sigungu, item }, { label: '농가 연결 신청', cls: 'btn primary' }).replace('<a ', '<a id="go-join" ')}</div>
      <div class="s3-grid">
        <div class="s3-box"><h3>받을 곳이 없으면 푸드뱅크로</h3>${foodbankHTML({ compact: true })}
          <p class="note">약정 물량은 기부할 수 없어요. <a class="link" href="#/join?sec=foodbank">자세히</a></p></div>
        <div class="s3-box"><h3>가공해서 오래 두기</h3><p>즙·말랭이·절임처럼 가공하면 제값을 받을 시간을 벌 수 있어요.</p>
          <a class="btn" id="go-proc" href="#/process${procFor(item) ? `?item=${encodeURIComponent(procFor(item).id)}` : ''}">가공 방법 보기${icon('chevron', 14)}</a></div>
      </div>
    </section>
  </section>`;

  const $ = (s) => ctx.el.querySelector(s);
  const form = $('#calc');
  let expTouched = false;
  let s1 = '';

  const read = () => {
    const n = (k) => { const x = Number(form.elements[k].value); return Number.isFinite(x) && x >= 0 ? x : 0; };
    return {
      item: form.elements.crop.value.trim(), sido: form.elements.sido.value,
      area: n('area'), yieldKg: n('yieldKg'), price: n('price'), comp: n('comp'), harvest: n('harvest'), fee: n('fee'), prodCost: n('prodCost'), expPrice: n('expPrice'),
    };
  };

  const draw = () => {
    const v = read();
    const r = calc(v);
    const per = (x) => (v.area > 0 ? `평당 ${signed(Math.round(x / v.area))}` : '');
    const ready = v.area > 0 && v.yieldKg > 0 && v.price > 0;
    const best = ready ? [['destroy', r.destroy], ['sell', r.sell], ['exp', r.exp]].sort((a, b) => b[1] - a[1])[0][0] : '';
    const box = (id, title, val, lines) => `<div class="res ${best === id ? 'best' : ''} ${val < 0 ? 'neg' : ''}">
      <h3>${title}${best === id ? '<span class="best-tag">가장 나음</span>' : ''}</h3>
      <p class="res-val">${ready || id === 'destroy' ? signed(Math.round(val)) : '–'}</p><p class="res-per">${ready || id === 'destroy' ? per(val) : ''}</p>
      <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul></div>`;
    $('#res').innerHTML = [
      box('destroy', '갈아엎기', r.destroy, [`보상 +${won(v.comp * v.area)}`, `생산비 −${won(r.sunk)}`]),
      box('sell', '직접 수확해 출하', r.sell, [`${num(r.kgTotal)}kg × ${won(Math.max(0, v.price - v.fee))}`, `작업비 −${won(v.harvest * v.area)}`, `생산비 −${won(r.sunk)}`]),
      box('exp', '구출 원정대', r.exp, [`${num(r.kgTotal)}kg × ${won(v.expPrice)}`, '수확·운송비 0원', `생산비 −${won(r.sunk)}`]),
    ].join('');
    $('#verdict').innerHTML = verdict(v, r);
    $('#breakeven').textContent = r.breakEven != null && v.yieldKg > 0
      ? `kg당 ${won(Math.ceil(r.breakEven / 10) * 10)} 이상 받을 수 있으면 수확해서 출하하는 게 갈아엎기보다 나아요.` : '';
    $('#comp-note').hidden = !(v.comp > 0);
    updateJoinLink($('#go-join'), { role: 'farmer', sido: v.sido, sigungu: v.sido === sido ? sigungu : '', item: v.item });
    const pf = procFor(v.item);
    $('#go-proc').href = `#/process${pf ? `?item=${encodeURIComponent(pf.id)}` : ''}`;
  };

  const show = (n) => {
    $('#step2').hidden = n < 2;
    $('#step3').hidden = n < 2;
    ctx.el.querySelectorAll('.steps li').forEach((li) => li.classList.toggle('on', Number(li.dataset.s) <= Math.max(1, n === 2 ? 3 : n)));
    if (n >= 2) draw();
  };

  const unsureEval = () => {
    const c = (k) => ctx.el.querySelector(`[name=${k}]`).checked;
    const out = $('#unsure-out');
    let msg;
    if (c('c1')) msg = '<b>계약 물량이 있다면 그 물량은 넘기거나 나눌 수 없어요.</b> 의무(50%)를 넘는 물량과 규격외·비상품만 연결할 수 있어요. 지역농협에 물량을 확인한 뒤 그 부분만 계산하세요.';
    else if (c('c3')) msg = '<b>시장격리에 신청한 물량은 넘기거나 기부할 수 없어요.</b> 신청하지 않은 물량은 자유롭게 연결할 수 있어요. 공고된 평당 보상 단가를 계산기에 넣어 비교해 보세요.';
    else if (c('c2')) msg = '<b>대상 품목이어도 계약하지 않았다면 보상은 없어요. 연결·나눔 자유예요.</b> 계약 여부만 다시 확인하세요.';
    else msg = '<b>보상 대상이 아닐 가능성이 커요. 연결·나눔 자유예요.</b> 대부분의 품목·농가는 폐기 보상이 없어요.';
    out.innerHTML = `<span>${msg}</span>`;
    out.classList.toggle('warn', c('c1') || c('c3'));
    return c('c1') || c('c3');
  };

  ctx.el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 's1') {
      s1 = t.value;
      $('#excess-note').hidden = true;
      ['yes', 'no', 'unsure'].forEach((k) => { $(`#s1-${k}`).hidden = k !== s1; });
      if (s1 === 'unsure') unsureEval();
      show(s1 === 'no' ? 2 : 1);
    }
    if (['c1', 'c2', 'c3'].includes(t.name)) unsureEval();
  });
  ctx.el.querySelector('[data-excess]').addEventListener('click', () => {
    $('#excess-note').hidden = false;
    show(2);
    $('#step2').scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.elements.area.focus({ preventScroll: true });
  });
  ctx.el.querySelector('[data-unsure-go]').addEventListener('click', () => {
    const risky = unsureEval();
    $('#excess-note').hidden = !risky;
    show(2);
    $('#step2').scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.elements.area.focus({ preventScroll: true });
  });
  form.addEventListener('input', (e) => {
    if (e.target.name === 'expPrice') expTouched = true;
    if (e.target.name === 'price' && !expTouched) form.elements.expPrice.value = String(round10(Number(e.target.value || 0) * 0.7) || '');
    draw();
  });
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'crop') return;
    const dd = itemDefaults(e.target.value);
    form.elements.yieldKg.value = String(dd.yieldKg);
    form.elements.prodCost.value = String(dd.cost);
    draw();
  });
}
