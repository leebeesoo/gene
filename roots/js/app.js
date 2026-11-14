import { TYPES, REGIONS, REGION_WHY, ELEMENTS, EL_ORDER, AXES, RARITY, CODE_LETTERS } from './data.js';
import { STEMS, BRANCHES, STEMS_K, BRANCHES_K, STEM_EL, BRANCH_EL, HOURS, lunarToSolar, lunarLeapMonth, fmtKST } from './saju.js';
import { QUESTION_SETS, STAGES, stageOf } from './questions.js';
import { SURNAMES, POP_2015, FUTURE, STATUS_DAEGU, BONGWAN_TOTAL } from './facts.js';
import {
  computeResult, splitName, eraLives, compat, compatStory, estimateType, dailyMessage, todayStrongType,
  encodeInvite, decodeInvite, typeBits, codeOf, nickOf, mbtiOf, WEIGHTS, SAJU_RULES, surnameStat, parseBongwan, bongwanStat,
  bongwanOptions, ancestorGens, statusEstimate, descendants, eraNameOf, genLabel, GEN_YEARS,
} from './engine.js';
import { EVENTS } from './facts.js';
import { emblemSVG, lockedSVG } from './emblems.js';
import { makeShareCard } from './share.js';

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nf = n => Math.round(n).toLocaleString('ko-KR');
const man = n => n >= 1e8 ? `${(n / 1e8).toFixed(n >= 1e9 ? 0 : 1)}억` : n >= 1e4 ? `${Math.round(n / 1e4).toLocaleString('ko-KR')}만` : nf(n);
const P = 'geunbon.v1.';
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(P + k); } catch { /* noop */ } },
};
const RKEY = 'result2'; // v2: 나이대별 질문·시각 입력 (v1 결과와 호환 안 됨)
const app = $('#app');
const modal = $('#modal'), sheet = $('#sheet');
const BASE = location.origin + location.pathname;
const hanjaCode = id => typeBits(id).map((b, i) => b ? AXES[i].neg : AXES[i].pos);
const josa = (w, a, b) => { const c = String(w).charCodeAt(String(w).length - 1); return (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28) ? a : b; };
const NOW_Y = new Date().getFullYear();
/* 1.5px 선 아이콘 한 세트 (24 그리드) */
const ICON = {
  clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  lock: '<rect x="5" y="10.5" width="14" height="9.5" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  chart: '<path d="M4 20h16M7 16v-4M12 16V7M17 16v-6"/>',
  alert: '<path d="M12 4.5l8.5 15h-17z"/><path d="M12 10v4M12 16.8v.2"/>',
  mail: '<rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  back: '<path d="M14.5 5.5L8 12l6.5 6.5"/>',
};
const icon = (n, s = 20) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true">${ICON[n]}</svg>`;
const euro = w => { const t = String(w).replace(/\([^)]*\)/g, '').trim(); const c = t.charCodeAt(t.length - 1); if (!(c >= 0xac00 && c <= 0xd7a3)) return '(으)로'; const j = (c - 0xac00) % 28; return j === 0 || j === 8 ? '로' : '으로'; };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}
const adSlot = kind => adSlotTpl(kind);
/* 광고: 공용 common/ads.js — 화면을 새로 그릴 때마다 새 칸이 생기고, 그린 뒤 새 칸만 요청 */
function pushAds(root = document) { if (window.JLAds) window.JLAds.mount(root); }
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}
const inviteUrl = (name, id) => `${BASE}?invite=${encodeInvite(name, id)}`;

/* ---------- state ---------- */
const BASE_STEPS = ['name', 'bongwan', 'birth', 'region'];
const blankProfile = () => ({ name: '', surname: '', bongwan: '', cal: 'solar', leap: false, birth: '', hour: '', minute: '', region: '', stage: '' });
let state = { step: 0, profile: blankProfile(), answers: [], skipped: new Set() };
const steps = () => [...BASE_STEPS, ...(QUESTION_SETS[state.profile.stage || 'young']).map((_, i) => 'q' + i)];
let stickyObs = null;
let usingKeyboard = false;
document.addEventListener('keydown', e => { if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Enter') usingKeyboard = true; }, true);
document.addEventListener('pointerdown', () => { usingKeyboard = false; }, true);

(function readInvite() {
  const p = new URLSearchParams(location.search);
  const raw = p.get('invite');
  if (!raw) return;
  const inv = decodeInvite(raw);
  if (inv) store.set('invite', { ...inv, at: Date.now() });
  p.delete('invite');
  const qs = p.toString();
  try { history.replaceState(null, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch { /* noop */ }
})();

function setFlowMode(on) {
  document.body.classList.toggle('in-flow', on);
  $('.top-btn').hidden = !on && !location.hash.startsWith('#/');
}
function clearHash() { if (location.hash) { try { history.replaceState(null, '', location.pathname + location.search); } catch { location.hash = ''; } } }

/* ---------- 미니 테스트 · 예시 카드 (다른 서비스 목록은 공용 푸터가 보여 줌) ---------- */
function miniTests(exclude = '') {
  const cards = [
    { k: 'main', href: './', h: '根', t: '나의 근본 코드 찾기', d: '질문 10개 · 만세력 사주 · 조상 타임라인' },
    { k: 'surname', href: '#/surname', h: '姓', t: '나와 같은 성씨·본관은 몇 명?', d: '2015 인구주택총조사 실제 통계' },
    { k: 'ancestors', href: '#/ancestors', h: '祖', t: '조상 몇 명이 나를 만들었나', d: '10대 위 1,024명, 20대 위 100만 명' },
  ].filter(c => c.k !== exclude);
  return `<section class="minis" aria-labelledby="h-minis"><h2 id="h-minis" class="others-h">근본 테스트 더 해 보기</h2>
    <div class="mini-grid">${cards.map(c => `<a class="mini-card" href="${c.href}" ${c.k === 'main' ? 'data-action="home-link"' : ''}><span class="mini-hz" aria-hidden="true">${c.h}</span><b>${c.t}</b><small>${c.d}</small></a>`).join('')}</div></section>`;
}
function adSlotTpl(kind = 'display') {
  const multi = kind === 'multiplex';
  return `<aside class="jl-ad${multi ? ' jl-ad--multiplex' : ''}" aria-label="광고"><small>광고</small><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" ${multi ? 'data-ad-format="autorelaxed"' : 'data-ad-format="auto" data-full-width-responsive="true"'}></ins></aside>`;
}
/* 인주 도장: 유형 한자를 세로로 찍은 낙관 */
function sealHTML(id, cls = '') {
  const h = TYPES[id].hanja;
  return `<span class="seal seal-l${h.length} ${cls}" aria-hidden="true"><span>${h.split('').join('<br>')}</span></span>`;
}
/* 결과 카드 (예시·실제 공용) */
function codeCardHTML({ id, pct, title, example }) {
  const t = TYPES[id]; const hz = hanjaCode(id); const code = codeOf(id);
  return `<figure class="cc${example ? ' is-example' : ''}" ${example ? 'aria-label="예시 결과 카드"' : ''}>
    ${example ? '<span class="ex-tag">예시</span>' : ''}
    <div class="cc-top"><span>${esc(title)}</span><span class="cc-no">No.${pad(id + 1)} / 16</span></div>
    <div class="cc-code" aria-label="근본 코드 ${code}">${code.split('').map((c, k) => `<span><b>${c}</b><small>${hz[k].h}</small></span>`).join('')}</div>
    <div class="cc-nick">${esc(nickOf(id))}</div>
    <div class="cc-type">${t.name}형 · ${t.hanja} · ${esc(t.tagline)}</div>
    <ul class="cc-axes">${pct.map((p, k) => { const lead = p >= 50; const side = lead ? AXES[k].pos : AXES[k].neg; const v = lead ? p : 100 - p; return `<li><span>${side.h} ${side.d}</span><i><b style="width:${v}%"></b></i><em>${v}%</em></li>`; }).join('')}</ul>
    <div class="cc-foot">16개 중 하나 · 시뮬레이션상 ${RARITY[id]}%</div>
    ${sealHTML(id, 'cc-seal')}
  </figure>`;
}

/* ---------- landing ---------- */
function renderLanding() {
  setFlowMode(false); killSticky(); document.body.classList.remove('has-sticky');
  const inv = store.get('invite');
  const saved = store.get(RKEY);
  const strong = todayStrongType();
  const st = TYPES[strong.id];
  const top3 = SURNAMES.slice(0, 3);
  const top3Share = ((top3[0].n + top3[1].n + top3[2].n) / POP_2015 * 100).toFixed(1);
  app.innerHTML = `
  <section class="stage">
    <div class="stage-in">
      <div class="stage-head">
        ${inv ? `<div class="invite-banner"><b>${esc(inv.n)}</b>님(${codeOf(inv.t)} · ${TYPES[inv.t].name}형)이 궁합을 신청했어요. 테스트를 마치면 두 사람의 궁합이 바로 나와요.</div>` : ''}
        <p class="stage-kicker">근본 테스트 · 16가지 근본 코드</p>
        <h1 class="stage-title">너, 근본이<br>어디야?</h1>
        <p class="stage-lead">질문 10개와 만세력 사주로 찾는 4글자 근본 코드. 조상들이 겪은 역사, 나와 같은 본관이 몇 명인지까지 한 장에 담아요.</p>
      </div>
      <div class="stage-card">${codeCardHTML({ id: 0, pct: [72, 64, 58, 81], title: '홍길동님의 근본 코드', example: true })}</div>
      <div class="stage-cta">
        <button class="btn btn-stamp btn-block" data-action="start">도장 찍기<small>내 근본 코드 찾기</small></button>
        ${saved ? `<button class="btn btn-on-field btn-block" data-action="show-result">내 결과 다시 보기</button>` : ''}
        <p class="stage-meta">기본 정보 4개 + 질문 10개 · 약 2분 · 입력한 정보는 내 기기에만</p>
      </div>
    </div>
  </section>

  <section class="section wide" aria-labelledby="h-seals">
    <div class="sec-head"><h2 class="sec-title" id="h-seals">16가지 근본 코드</h2>
      <p class="sec-sub">思·行 / 守·遊 / 理·情 / 獨·群, 네 갈래 기질이 만나 하나의 도장이 돼요. 눌러서 미리 보세요.</p></div>
    <div class="seal-grid">${TYPES.map((t, i) => `<button class="seal-cell" data-action="type" data-id="${i}" aria-label="${codeOf(i)} ${t.name}형 미리보기">${sealHTML(i, i % 2 ? 'is-line' : '')}<b>${codeOf(i)}</b><small>${t.name}</small></button>`).join('')}</div>
  </section>

  <section class="section wrap" aria-labelledby="h-today">
    <div class="today-strong">
      <div class="ts-day" aria-hidden="true">${String(strong.ilJin).split('').join('<br>')}</div>
      <div><h2 id="h-today" class="ts-h">오늘은 ${strong.ilJin}, ${ELEMENTS[strong.el].name}(${ELEMENTS[strong.el].h})의 날</h2>
        <p>오늘 일진의 천간과 같은 오행을 가진 근본은 <b>${st.name}형(${codeOf(strong.id)})</b>이에요. 재미로 보는 오늘의 근본이에요.</p></div>
    </div>
  </section>

  <section class="section wrap" aria-labelledby="h-how">
    <h2 class="sec-title left" id="h-how">근본 공식은 공개돼 있어요</h2>
    <ol class="how-list">
      <li><span class="how-n">60%</span><div><h3>나이대별 질문 10개</h3><p>10대·20~30대·40~50대·60대 이상에 맞춘 상황 질문으로 네 가지 기질을 재요.</p></div></li>
      <li><span class="how-n">25%</span><div><h3>만세력 사주</h3><p>절기 시각을 천문 계산해 년·월·일·시주를 세워요. 서머타임·표준시 변경, 음력·윤달까지 반영해요.</p></div></li>
      <li><span class="how-n">15%</span><div><h3>출생 시대·지역</h3><p>자란 시대와 고향을 작은 비중으로 더해요. 계산식은 결과 화면에 그대로 보여 드려요.</p></div></li>
    </ol>
  </section>

  <div class="wrap">${adSlotTpl()}</div>

  <section class="section wrap faq" aria-labelledby="h-faq">
    <h2 class="sec-title left" id="h-faq">자주 묻는 질문</h2>
    <h3>실제 족보랑 관련이 있나요?</h3><p>아니요. 부모·조부모 같은 개인 정보는 만들어 내지 않아요. 조상 타임라인은 '한 세대 ≈ 30년'으로 계산한 시대와 실제 역사 사건, 성씨·본관 인구는 통계청 2015 인구주택총조사 값이에요. 근본 코드 해석은 재미로 보는 콘텐츠예요.</p>
    <h3>사주 계산은 얼마나 정확한가요?</h3><p>입춘·12절의 정확한 시각을 천문 계산(오차 1분 이내)으로 구하고, 1954~61년 표준시(UTC+8:30)와 1948~51·1955~60·1987~88년 서머타임, 한국천문연구원 음력(1900~2050)을 반영해요. 시각은 동경 127.5° 기준(현재 표준시 −30분)으로 보정해요.</p>
    <h3>내 정보는 어디에 저장되나요?</h3><p>이름, 생일 등 모든 입력은 서버로 보내지 않고 이 기기의 브라우저에만 저장돼요.</p>
  </section>

  <div class="wrap">${adSlotTpl('multiplex')}</div>

  <section class="section wrap facts" aria-labelledby="h-facts">
    <h2 class="sec-title left" id="h-facts">알고 보면 더 재밌는 숫자</h2>
    <dl class="fact-list">
      <div><dt>${top3Share}%</dt><dd>김·이·박 세 성씨가 2015년 내국인에서 차지하는 비율이에요.</dd></div>
      <div><dt>${nf(BONGWAN_TOTAL.clans)}개</dt><dd>2015년 조사에 나온 본관 수예요. 1천 명이 넘는 본관은 ${BONGWAN_TOTAL.over1000}개였어요.</dd></div>
      <div><dt>약 ${man(2 ** 30)}명</dt><dd>30대 위 조상 자리 수예요. 당시 한반도 인구보다 훨씬 많아서, 같은 조상이 여러 자리를 겹쳐 차지해요.</dd></div>
    </dl>
  </section>

  <div class="wrap">${miniTests('main')}</div>

  <div class="bottom-cta wrap"><button class="btn btn-primary btn-block" data-action="start">도장 찍고 내 근본 코드 찾기</button></div>`;
  pushAds(app);
  window.scrollTo(0, 0);
}

/* ---------- flow ---------- */
function startFlow(prefill) {
  clearHash();
  const saved = store.get(RKEY);
  state.profile = prefill && saved ? { ...blankProfile(), ...saved.profile } : blankProfile();
  state.answers = []; state.skipped = new Set(); state.step = 0;
  renderStep();
}
/** 결과 화면에서 '질문에 답하기': 저장된 정보·답은 그대로 두고 첫 번째 안 한 질문부터 */
function resumeQuestions() {
  clearHash();
  const saved = store.get(RKEY);
  if (!saved || !saved.profile) { startFlow(false); return; }
  state.profile = { ...blankProfile(), ...saved.profile };
  state.answers = (saved.answers || []).map(a => (a === null ? undefined : a));
  state.skipped = new Set();
  const n = QUESTION_SETS[state.profile.stage || 'young'].length;
  let first = 0; while (first < n && isAnswered(first)) first++;
  state.step = BASE_STEPS.length + (first < n ? first : 0);
  renderStep();
}
const isAnswered = qi => state.answers[qi] !== undefined && state.answers[qi] !== null;

function yearOpts(sel, min = 1920) {
  let h = '<option value="">년</option>';
  for (let y = NOW_Y; y >= min; y--) h += `<option value="${y}" ${+sel === y ? 'selected' : ''}>${y}년</option>`;
  return h;
}
function rangeOpts(n, label, sel, from = 1) {
  let h = `<option value="">${label}</option>`;
  for (let i = from; i <= n; i++) h += `<option value="${i}" ${sel !== '' && sel !== undefined && sel !== null && +sel === i ? 'selected' : ''}>${i}${label}</option>`;
  return h;
}
function validSolar(y, m, d) {
  if (!y || !m || !d) return false;
  const dt = new Date(+y, +m - 1, +d);
  return dt.getFullYear() === +y && dt.getMonth() === +m - 1 && dt.getDate() === +d && dt <= new Date();
}

function renderStep() {
  setFlowMode(true); killSticky(); document.body.classList.remove('has-sticky');
  const ST = steps();
  const key = ST[state.step];
  const total = ST.length;
  const pf = state.profile;
  let body = '';
  if (key === 'name') {
    const sp = splitName(pf.name);
    body = `
      <div class="q-art" aria-hidden="true">名</div>
      <div class="q-label">족보 첫 장</div>
      <h1 class="q-title">당신의 이름은?</h1>
      <p class="q-sub">성씨는 자동으로 나눠 드려요 · 성씨 통계에 쓰여요</p>
      <label class="field"><span class="sr-only">이름</span><input class="input" id="f-name" maxlength="10" autocomplete="name" placeholder="예) 홍길동" value="${esc(pf.name)}"></label>
      <div class="surname-pill" id="sp" ${sp.surname ? '' : 'hidden'}>성씨 <input id="f-sur" maxlength="2" aria-label="성씨" value="${esc(pf.surname || sp.surname)}"></div>`;
  } else if (key === 'bongwan') {
    const sur = pf.surname;
    const list = bongwanOptions(sur);
    const chips = list.slice(0, 10).map(b => `<button class="chip ${pf.bongwan === b ? 'sel' : ''}" data-action="bon" data-v="${esc(b)}">${esc(b)}</button>`).join('');
    body = `
      <div class="q-art" aria-hidden="true">本</div>
      <div class="q-label">가문의 뿌리</div>
      <h1 class="q-title">본관을 알고 있나요?</h1>
      <p class="q-sub">알면 같은 본관 인구(2015 통계)와 시조 이야기가 열려요</p>
      ${chips ? `<div class="chips">${chips}</div>` : ''}
      <label class="field"><span>직접 입력</span><input class="input" id="f-bon" maxlength="12" placeholder="예) ${esc(list[0] || '김해 김씨')}" value="${esc(pf.bongwan)}"></label>`;
  } else if (key === 'birth') {
    const [y, m, d] = (pf.birth || '').split('-');
    const lunar = pf.cal === 'lunar';
    body = `
      <div class="q-art" aria-hidden="true">生</div>
      <div class="q-label">사주의 기둥</div>
      <h1 class="q-title">언제 태어났나요?</h1>
      <p class="q-sub">태어난 해에 맞춰 질문 세트도 달라져요</p>
      <div class="seg" role="radiogroup" aria-label="달력">
        <button class="${lunar ? '' : 'on'}" role="radio" aria-checked="${!lunar}" data-action="cal" data-v="solar">양력</button>
        <button class="${lunar ? 'on' : ''}" role="radio" aria-checked="${lunar}" data-action="cal" data-v="lunar">음력</button>
      </div>
      <div class="row3">
        <select class="input" id="f-y" aria-label="태어난 해">${yearOpts(y)}</select>
        <select class="input" id="f-m" aria-label="태어난 달">${rangeOpts(12, '월', m)}</select>
        <select class="input" id="f-d" aria-label="태어난 날">${rangeOpts(lunar ? 30 : 31, '일', d)}</select>
      </div>
      <label class="leap" id="leap-wrap" ${lunar ? '' : 'hidden'}><input type="checkbox" id="f-leap" ${pf.leap ? 'checked' : ''}> 윤달 <small id="leap-info"></small></label>
      <div class="field" style="margin-top:12px"><span>태어난 시각 (선택 · 시주와 시간 경계 계산에 쓰여요)</span>
        <div class="row2">
          <select class="input" id="f-h" aria-label="태어난 시"><option value="">시각 모름</option>${Array.from({ length: 24 }, (_, i) => `<option value="${i}" ${pf.hour !== '' && +pf.hour === i ? 'selected' : ''}>${pad(i)}시</option>`).join('')}</select>
          <select class="input" id="f-mi" aria-label="태어난 분">${Array.from({ length: 60 }, (_, i) => `<option value="${i}" ${+pf.minute === i ? 'selected' : ''}>${pad(i)}분</option>`).join('')}</select>
        </div></div>
      <p class="hint">시각을 모르면 년·월·일 세 기둥(6글자)으로 계산해요.</p>
      <p class="hint err" id="birth-err" role="alert"></p>`;
  } else if (key === 'region') {
    body = `
      <div class="q-art" aria-hidden="true">鄕</div>
      <div class="q-label">고향의 기운 · 공식의 일부(작은 비중)</div>
      <h1 class="q-title">어디에서 자랐나요?</h1>
      <p class="q-sub">가장 오래 자란 곳을 골라 주세요</p>
      <div class="opts two" role="radiogroup" aria-label="자란 곳">${REGIONS.map(r => `<button class="opt center ${pf.region === r.t ? 'sel' : ''}" role="radio" aria-checked="${pf.region === r.t}" data-action="region" data-v="${r.t}">${r.t}</button>`).join('')}</div>`;
  } else {
    const qi = +key.slice(1); const set = QUESTION_SETS[pf.stage]; const q = set[qi];
    const stg = STAGES.find(s => s.key === pf.stage);
    body = `
      <div class="q-art" aria-hidden="true">${q.art}</div>
      <div class="q-label">질문 ${qi + 1} / ${set.length} · ${stg.label} 질문</div>
      <h1 class="q-title" id="q-title">${esc(q.q)}</h1>
      <div class="opts" style="margin-top:20px" role="radiogroup" aria-labelledby="q-title">${q.opts.map((o, oi) => `<button class="opt ${state.answers[qi] === oi ? 'sel' : ''}" role="radio" aria-checked="${state.answers[qi] === oi}" data-action="answer" data-v="${oi}">${esc(o.t)}</button>`).join('')}</div>`;
  }
  const isQ = key.startsWith('q');
  const nBase = BASE_STEPS.length;
  const nQ = total - nBase;
  const qi = isQ ? +key.slice(1) : -1;
  const isLast = state.step === total - 1;
  let doneN = 0, skipN = 0;
  for (let i = 0; i < nQ; i++) { if (isAnswered(i)) doneN++; else if (state.skipped.has(i)) skipN++; }
  const progTxt = state.step < nBase ? `기본 정보 ${state.step + 1}/${nBase}` : `질문 ${qi + 1}/${nQ}`;
  const answeredHere = isQ ? isAnswered(qi) : key === 'region' ? !!pf.region : true;
  // 질문 단계: 점으로 답함·건너뜀·현재를 보여 줌 (글로도 같은 내용)
  const dots = isQ ? `<div class="q-status"><ol class="qdots" aria-hidden="true">${Array.from({ length: nQ }, (_, i) => `<li class="${i === qi ? 'is-cur ' : ''}${isAnswered(i) ? 'is-done' : state.skipped.has(i) ? 'is-skip' : ''}"></li>`).join('')}</ol><span class="q-count">답함 ${doneN} · 건너뜀 ${skipN}</span></div>` : '';
  const nextLabel = isLast ? '결과 보기' : '다음';
  const navRow = state.step > 0 ? `<div class="nav-row">
          <button class="btn btn-ghost" data-action="back">이전</button>
          <button class="btn btn-dark" data-action="next" id="next-btn" ${answeredHere ? '' : 'disabled'}>${nextLabel}</button>
        </div>` : `<button class="btn btn-dark btn-block" data-action="next" id="next-btn">다음</button>`;
  app.innerHTML = `
    <div class="flow">
      <div class="flow-top">
        <button class="back" data-action="back" aria-label="이전">${icon('back')}</button>
        <div class="prog" role="progressbar" aria-label="진행" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${state.step + 1}" aria-valuetext="${progTxt}"><i style="width:${((state.step + 1) / total) * 100}%"></i></div>
        <span class="prog-n">${progTxt}</span>
      </div>
      ${dots}
      <div class="q-wrap">${body}</div>
      <div class="flow-foot">
        ${navRow}
        ${key === 'bongwan' ? `<button class="skip" data-action="skip-bon">잘 모르겠어요, 건너뛰기</button>` : ''}
        ${isQ ? `<div class="skip-row"><button class="skip" data-action="skip-q">${isLast ? '이 질문 건너뛰고 결과 보기' : '이 질문 건너뛰기'}</button>${isLast ? '' : `<button class="skip" data-action="skip-all">질문 건너뛰고 결과 보기</button>`}</div>
        <p class="skip-note">건너뛴 질문은 사주와 시대·지역 정보로 채워 계산해요.</p>` : ''}
      </div>
    </div>`;
  window.scrollTo(0, 0);
  const group = $('.opts[role="radiogroup"]', app);
  if (group) {
    const radios = $$('.opt', group); const cur = radios.find(o => o.classList.contains('sel')) || radios[0];
    radios.forEach(o => { o.tabIndex = o === cur ? 0 : -1; });
    // 키보드로 오가는 중이거나 이미 고른 답이 있을 때만 포커스 (Enter 한 번에 첫 선택지가 골라지는 일 방지)
    if (usingKeyboard || cur.classList.contains('sel')) setTimeout(() => { try { cur.focus({ preventScroll: true }); } catch { /* noop */ } }, 30);
  }
  if (key === 'name') {
    const inp = $('#f-name'), sur = $('#f-sur'), sp = $('#sp');
    const upd = () => {
      const s = splitName(inp.value); pf.name = inp.value.trim();
      sp.hidden = !s.surname; sur.value = s.surname; pf.surname = s.surname;
      $('#next-btn').disabled = pf.name.replace(/\s/g, '').length < 2;
    };
    inp.addEventListener('input', upd);
    sur.addEventListener('input', () => { pf.surname = sur.value.trim(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) next(); });
    $('#next-btn').disabled = pf.name.replace(/\s/g, '').length < 2;
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch { /* noop */ } }, 50);
  }
  if (key === 'bongwan') {
    const inp = $('#f-bon');
    inp.addEventListener('input', () => { pf.bongwan = inp.value.trim(); $$('.chip').forEach(c => c.classList.toggle('sel', c.dataset.v === pf.bongwan)); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) next(); });
  }
  if (key === 'birth') {
    const chk = () => {
      $('#next-btn').disabled = !($('#f-y').value && $('#f-m').value && $('#f-d').value);
      $('#f-mi').disabled = $('#f-h').value === '';
      const y = +$('#f-y').value; const lm = y ? lunarLeapMonth(y) : 0;
      const li = $('#leap-info'); if (li) li.textContent = y ? (lm ? `(${y}년은 윤${lm}월이 있어요)` : `(${y}년은 윤달이 없어요)`) : '';
    };
    ['#f-y', '#f-m', '#f-d', '#f-h'].forEach(s => $(s).addEventListener('change', chk)); chk();
  }
}

function next() {
  const ST = steps();
  const key = ST[state.step]; const pf = state.profile;
  if (key === 'name') {
    if (pf.name.replace(/\s/g, '').length < 2) return;
    if (!pf.surname) pf.surname = splitName(pf.name).surname;
  }
  if (key === 'bongwan') pf.bongwan = ($('#f-bon')?.value || '').trim().slice(0, 12);
  if (key === 'region' && !pf.region) return;
  if (key.startsWith('q') && !isAnswered(+key.slice(1))) return; // 답하지 않았으면 '건너뛰기'를 써요
  if (key === 'birth') {
    const y = $('#f-y').value, m = $('#f-m').value, d = $('#f-d').value;
    const lunar = pf.cal === 'lunar', leap = lunar && $('#f-leap').checked;
    const err = $('#birth-err');
    let solar;
    if (lunar) {
      solar = lunarToSolar(+y, +m, +d, leap);
      if (!solar) { err.textContent = leap ? `${y}년에는 윤${m}월이 없거나, 그 달에 ${d}일이 없어요.` : `음력 ${y}년 ${m}월에는 ${d}일이 없어요(작은달은 29일).`; return; }
      if (!validSolar(solar.y, solar.m, solar.d)) { err.textContent = '미래 날짜는 고를 수 없어요.'; return; }
    } else if (!validSolar(y, m, d)) { err.textContent = '날짜를 다시 확인해 주세요.'; return; }
    pf.birth = `${y}-${pad(m)}-${pad(d)}`; pf.leap = leap;
    pf.hour = $('#f-h').value; pf.minute = pf.hour === '' ? '' : $('#f-mi').value;
    const sy = lunar ? solar.y : +y;
    const newStage = stageOf(sy, NOW_Y).key;
    if (newStage !== pf.stage) { state.answers = []; state.skipped = new Set(); }
    pf.stage = newStage;
  }
  if (state.step < steps().length - 1) { state.step++; renderStep(); } else renderLoading();
}

/* ---------- loading ---------- */
function renderLoading() {
  setFlowMode(true);
  const pf = state.profile;
  const msgs = ['입춘·12절 시각을 천문 계산하는 중…', '년·월·일·시 기둥을 세우는 중…', `${pf.surname || ''}씨 2015 인구 통계를 찾는 중…`, '조상 세대별 연표를 맞추는 중…', '근본 공식(60·25·15)을 합산하는 중…'];
  app.innerHTML = `
    <div class="loading" role="status" aria-live="polite">
      <div>
        <div class="load-seal" aria-hidden="true">根<br>本</div>
        <p class="load-title">근본을 계산하는 중…</p>
        <p class="load-msg" id="lmsg">${esc(msgs[0])}</p>
        <div class="load-bar"><i></i></div>
      </div>
    </div>`;
  window.scrollTo(0, 0);
  let i = 0;
  const iv = setInterval(() => { i++; const el = $('#lmsg'); if (el) el.textContent = msgs[i % msgs.length]; }, 420);
  const nQ = QUESTION_SETS[state.profile.stage || 'young'].length;
  store.set(RKEY, { v: 2, profile: { ...state.profile }, answers: Array.from({ length: nQ }, (_, i) => (isAnswered(i) ? state.answers[i] : null)), at: Date.now() });
  setTimeout(() => { clearInterval(iv); renderResult(true); }, 2000);
}

/* ---------- result ---------- */
function updateStreak() {
  const today = dkey(); const s = store.get('streak', { last: '', n: 0 });
  if (s.last === today) return s;
  const y = new Date(); y.setDate(y.getDate() - 1);
  const n = s.last === dkey(y) ? s.n + 1 : 1;
  const ns = { last: today, n, best: Math.max(n, s.best || 0) };
  store.set('streak', ns); return ns;
}
function getDex() { return store.get('dex', []); }
function addDex(entry) {
  const dex = getDex().filter(e => !(e.n === entry.n && e.t === entry.t));
  dex.unshift(entry); store.set('dex', dex.slice(0, 40)); return dex;
}

let R = null; // current result context
const AXIS_NAMES = ['생각 ↔ 행동', '지킴 ↔ 떠남', '이치 ↔ 마음', '홀로 ↔ 함께'];

function axisBars(res) {
  return `<div class="axes">${res.posPct.map((p, k) => {
    const a = AXES[k]; const lead = p >= 50;
    return `<div class="axis"><div class="axis-t"><span class="${lead ? 'win' : ''}"><b>${CODE_LETTERS[k][0]}</b> ${a.pos.h} ${a.pos.d} ${p}%</span><small>${AXIS_NAMES[k]}</small><span class="${lead ? '' : 'win'}">${100 - p}% ${a.neg.d} ${a.neg.h} <b>${CODE_LETTERS[k][1]}</b></span></div>
      <div class="axis-track"><i class="l" data-w="${p}"></i><i class="r" data-w="${100 - p}"></i></div></div>`;
  }).join('')}</div>`;
}

function formulaBox(res, pf) {
  const f = v => (v >= 0 ? '+' : '') + v.toFixed(2);
  const q = res.parts.quiz, s = res.parts.saju, e = res.parts.era;
  const regionWhy = REGION_WHY[pf.region] || '반영 안 함';
  const W = res.weights, full = res.answered === res.total, none = res.answered === 0;
  const pc = v => `${Math.round(v * 100)}%`;
  const wTxt = k => `${pc(W[k].quiz)}·${pc(W[k].saju)}·${pc(W[k].era)}`;
  return `<details class="formula"><summary>어떻게 계산했나요? (근본 공식)</summary>
    <p><b>축 점수 = 퀴즈 ${WEIGHTS.quiz * 100}% + 사주 오행 ${WEIGHTS.saju * 100}% + 출생 시대·지역 ${WEIGHTS.era * 100}%</b><br>각 성분은 −1(뒤 글자)~+1(앞 글자). 합이 0보다 크면 앞 글자(T·K·L·S), 작으면 뒤 글자(A·R·H·G)예요. 비율(%) = 50 + 50 × 축 점수.</p>
    ${full ? '' : `<p class="f-skip"><b>${none ? '질문을 모두 건너뛰었어요.' : `질문 ${res.total}개 중 ${res.answered}개에 답했어요.`}</b> 건너뛴 질문만큼 퀴즈 몫이 줄고, 줄어든 몫은 사주 : 시대·지역 = 25 : 15 비율로 나눠 가져요. 이번 계산에 쓴 비중(퀴즈·사주·시대지역): ${res.axes.map((_, k) => `${AXES[k].pos.h}/${AXES[k].neg.h} ${wTxt(k)}`).join(' · ')}</p>`}
    <div class="ftable" role="table" aria-label="축별 계산">
      <div role="row" class="fh"><span role="columnheader">축</span><span role="columnheader">퀴즈</span><span role="columnheader">사주</span><span role="columnheader">시대·지역</span><span role="columnheader">합</span></div>
      ${res.axes.map((x, k) => `<div role="row"><span role="cell">${AXES[k].pos.h}/${AXES[k].neg.h}</span><span role="cell">${none ? '—' : f(q[k])}</span><span role="cell">${f(s[k])}</span><span role="cell">${f(e[k])}</span><span role="cell"><b>${f(x)}</b></span></div>`).join('')}
    </div>
    <ul>
      <li><b>건너뛴 질문은?</b> 점수에 넣지 않아요. 답한 질문만으로 퀴즈 점수(−1~+1)를 내고, 퀴즈 비중은 60% × (답한 질문이 그 축에서 차지하는 몫)으로 줄여요. 남은 비중은 사주와 시대·지역이 25 : 15로 나눠요. 모두 건너뛰면 사주 62.5% · 시대·지역 37.5%예요.</li>
      <li><b>왜 퀴즈 60%?</b> 지금의 성향을 직접 묻는 유일한 입력이라 가장 크게 잡았어요. 질문 10개는 각각 두 축을 묻고, 선택지는 양극이 거울처럼 짝지어져 있어 무작위로 답하면 축마다 약 50:50이 나와요(2만 회 시뮬레이션 확인).</li>
      <li><b>사주 25%</b> — 전통 오행 상징을 빌린 우리 공식의 가정이에요(과학적 성격 측정이 아님): ${SAJU_RULES.join(' · ')}.</li>
      <li><b>시대·지역 15%</b> — ${esc(res.cohort.label)}(${esc(res.cohort.why)}) · ${esc(pf.region || '비밀')}(${esc(regionWhy)})을 작은 값으로 더했어요. 역시 사실이 아니라 가정이에요.</li>
      <li><b>가까운 근본 3가지</b> — 16유형마다 축별 비율을 곱한 값 중 상위 3개를 100%로 다시 나눈 거예요.</li>
    </ul></details>`;
}

function sajuCard(res, pf) {
  const S = res.saju;
  const dist = EL_ORDER.map(k => ({ k, v: S.count[k], p: Math.round(S.dist[k] * 100), h: Math.round(S.hidden[k] * 100) }));
  const strong = [...dist].sort((a, b) => b.v - a.v || b.h - a.h)[0];
  const weak = [...dist].sort((a, b) => a.v - b.v || a.h - b.h)[0];
  const dm = ELEMENTS[S.dayEl];
  const lunarTxt = S.lunar ? `음력 ${S.lunar.y}.${pad(S.lunar.m)}.${pad(S.lunar.d)}${S.lunar.leap ? '(윤달)' : ''}` : '';
  const solarTxt = `양력 ${S.solar.y}.${pad(S.solar.m)}.${pad(S.solar.d)}`;
  const timeTxt = S.hourKnown ? ` · ${pad(+pf.hour)}:${pad(+pf.minute || 0)}${S.dst ? '(서머타임)' : ''} → 보정 ${pad(S.local.h)}:${pad(S.local.mi)} ${HOURS[S.hour.branch].split(' ')[0]}` : ' · 시각 모름';
  return `<section class="card" aria-labelledby="h-saju">
    <h2 id="h-saju">만세력 사주 · 오행</h2>
    <p class="sub">${pf.cal === 'lunar' ? `${lunarTxt} = ${solarTxt}` : `${solarTxt}${lunarTxt ? ` (${lunarTxt})` : ''}`}${timeTxt} · ${S.zodiac}띠</p>
    <div class="pillars" style="--n:${S.pillars.length}">${[...S.pillars].reverse().map(p => `
      <div class="pillar ${p.key === 'day' ? 'me' : ''}"><div class="pl">${p.label}${p.key === 'day' ? ' (나)' : ''}</div>
        <div class="ch" style="background:${ELEMENTS[STEM_EL[p.stem]].color}">${STEMS[p.stem]}<small>${STEMS_K[p.stem]} · ${ELEMENTS[STEM_EL[p.stem]].h}</small></div>
        <div class="ch" style="background:${ELEMENTS[BRANCH_EL[p.branch]].color};opacity:.88">${BRANCHES[p.branch]}<small>${BRANCHES_K[p.branch]} · ${ELEMENTS[BRANCH_EL[p.branch]].h}</small></div></div>`).join('')}</div>
    ${S.boundaryWarning ? `<p class="warn">${icon('alert')}<span>${esc(S.boundaryWarning)}</span></p>` : ''}
    ${(S.dayDate.y !== S.solar.y || S.dayDate.m !== S.solar.m || S.dayDate.d !== S.solar.d) ? `<p class="warn">자시(KST 23:30~)에 태어나 일주는 다음 날(${S.dayDate.m}/${S.dayDate.d}) 기준이에요. 자정에 날짜를 바꾸는 만세력(야자시 적용)과는 일주가 다를 수 있어요.</p>` : ''}
    <div class="el-head"><span></span><span>${S.total}글자 기준</span><span>지장간 포함</span></div>
    <div class="el-bars">${dist.map(d => `<div class="el-row"><b style="color:${ELEMENTS[d.k].color}">${ELEMENTS[d.k].h}<small> ${ELEMENTS[d.k].k}</small></b><div class="el-track"><i data-w="${Math.max(3, d.p)}" style="background:${ELEMENTS[d.k].color}"></i></div><span>${d.v}개</span><span class="hid">${d.h}%</span></div>`).join('')}</div>
    <div class="saju-note">
      <p><b>나를 대표하는 오행(일간)</b> ${STEMS[S.dayMaster]}(${STEMS_K[S.dayMaster]}) · ${dm.name}(${dm.h}), ${S.yang ? '양' : '음'}의 기운.</p>
      <p><b>가장 강한 기운</b> ${ELEMENTS[strong.k].name}(${ELEMENTS[strong.k].h}) ${strong.v}개 · <b>가장 적은 기운</b> ${ELEMENTS[weak.k].name}(${ELEMENTS[weak.k].h}) ${weak.v}개${weak.v === 0 ? '(없음)' : ''}.</p>
      <p><b>보완하면 좋은 기운</b> ${ELEMENTS[weak.k].name}(${ELEMENTS[weak.k].h}) — 가장 적은 기운을 채운다는 단순한 기준이에요. 정식 용신(用神)은 학파마다 판단이 달라 여기서 정하지 않아요.</p>
      ${S.hourKnown ? '' : '<p>시각을 몰라 <b>년·월·일 세 기둥(6글자)</b>만으로 오행을 셌어요.</p>'}
    </div>
    <p class="basis">기준: ${esc(S.basis)}. 절입 ${S.prevJie ? `${S.prevJie.name} ${fmtKST(S.prevJie.ms)}` : ''} 이후 · 다음 ${S.nextJie ? `${S.nextJie.name} ${fmtKST(S.nextJie.ms)}` : ''}. 음력은 한국천문연구원 기준.</p>
  </section>`;
}

function ancestorCard(res) {
  const by = res.by;
  const gens = ancestorGens(by);
  const deep = [20, 30].map(n => ({ n, born: by - GEN_YEARS * n, count: 2 ** n }));
  return `<section class="card" aria-labelledby="h-anc">
    <h2 id="h-anc">나의 조상들은 어떤 시대를 살았을까</h2>
    <p class="sub">한 세대 ≈ ${GEN_YEARS}년으로 ${by}년생부터 거슬러 올라간 계산 · 사건은 실제 연도</p>
    <div class="anc-hook"><div><b>${nf(2 ** 10)}명</b><span>10대 위 조상 자리</span></div><div><b>약 ${man(2 ** 20)}명</b><span>20대 위</span></div><div><b>약 ${man(2 ** 30)}명</b><span>30대 위 (이론상)</span></div></div>
    <ol class="tl">${gens.map(g => `
      <li><div class="tl-h"><b>${g.label}</b><span>${g.decade}년대생 무렵 · ${esc(g.era)}</span><em>${nf(g.count)}명</em></div>
        ${g.events.length ? `<p>${g.events.map(([y, t]) => `<span class="ev"><i>${y}</i>${esc(t)}</span>`).join('')}</p>` : '<p class="muted">이 시기 연표는 생략했어요.</p>'}</li>`).join('')}
      ${deep.map(g => `<li class="deep-li"><div class="tl-h"><b>${g.n}대조</b><span>${Math.floor(g.born / 10) * 10}년대생 무렵 · ${esc(eraNameOf(g.born + 20))}</span><em>${man(g.count)}명</em></div></li>`).join('')}
    </ol>
    <p class="fine">30대 위 '10억 명'은 당시 한반도 인구보다 훨씬 많아요. 실제로는 같은 조상이 여러 갈래로 겹치기 때문(조상 겹침, pedigree collapse)이고, 그래서 우리는 생각보다 많은 조상을 서로 공유해요. 한 세대 30년은 평균값이라 실제와 다를 수 있어요.</p>
  </section>`;
}

function likelyCard(res) {
  const e = statusEstimate(res.by);
  const t = TYPES[res.typeId];
  return `<section class="card" aria-labelledby="h-likely">
    <h2 id="h-likely">이런 조상이 있었을 것이다</h2>
    <p class="sub">역사 통계로 따져 본 확률 이야기</p>
    <div class="likely">
      <p>${e.year}년 무렵 태어난 세대는 당신의 <b>${e.n}대조</b>, 조상 자리로는 <b>${nf(e.slots)}명</b>이에요. 그 시기 <b>대구 호적</b>을 분석한 연구에 따르면 양반 ${e.st.yangban}% · 양인(상민) ${e.st.sangmin}% · 노비 약 ${e.st.nobi}%였어요.</p>
      <div class="stack" aria-label="1690년 대구 신분 구성">
        <i style="width:${e.st.yangban}%;background:var(--d1)"></i><i style="width:${e.st.sangmin}%;background:var(--d2)"></i><i style="width:${e.st.nobi}%;background:var(--d3)"></i>
      </div>
      <div class="stack-legend"><span><i style="background:var(--d1)"></i>양반 약 ${nf(e.yangban)}명</span><span><i style="background:var(--d2)"></i>양인 약 ${nf(e.sangmin)}명</span><span><i style="background:var(--d3)"></i>노비 약 ${nf(e.nobi)}명</span></div>
      <p class="fine">대구 한 지역의 비율을 그대로 곱한 단순 기대값이에요. 그래도 결론은 분명해요: <b>당신 조상의 다수는 농사짓던 양인과 노비였을 가능성이 높아요.</b> 같은 대구에서 양반 호(戶)는 1729년 ${e.st2.yangban}%, 1858년 ${e.st3.yangban}%로 늘었는데, 납속·직역 모칭 등으로 '호적상 양반'이 급증한 결과예요. 오늘날 족보에 양반 조상이 많은 이유이기도 하죠. 1801년 공노비 해방, 1894년 갑오개혁으로 신분제는 법적으로 사라졌어요.</p>
    </div>
    <div class="resemble">${emblemSVG(res.typeId, 56, 'aria-hidden="true"')}<div>
      <small>가장 닮았을 조상 (상상)</small>
      <b>${esc(t.eras[2][0])}</b>
      <p>당신의 코드 ${res.code}(${esc(res.nick)})에 가장 가까운 조선 사람의 모습이에요. 기록이 아니라 성향을 옮긴 상상이에요.</p></div></div>
  </section>`;
}

function clanCard(pf) {
  const sur = pf.surname || '';
  const ss = surnameStat(sur);
  const place = parseBongwan(pf.bongwan, sur);
  const bs = bongwanStat(place, sur);
  const per100 = ss ? ss.share : 0;
  return `<section class="card" aria-labelledby="h-clan">
    <h2 id="h-clan">${esc(sur)}씨${bs ? ` · ${esc(bs.place)} ${esc(bs.s)}씨` : ''}, 실제 숫자로 보기</h2>
    <p class="sub">통계청 2015 인구주택총조사 (성씨·본관을 조사한 가장 최근 자료)</p>
    ${ss ? `<div class="stat-row"><div><b>${ss.rank}위</b><span>성씨 순위</span></div><div><b>${man(ss.n)}명</b><span>${esc(sur)}씨 인구</span></div><div><b>${per100.toFixed(1)}%</b><span>100명 중 ${per100 >= 1 ? Math.round(per100) : '1명 미만'}${per100 >= 1 ? '명' : ''}</span></div></div>`
    : `<p class="muted">${esc(sur || '입력한')}씨는 상위 45개 성씨 밖이라 이 앱에 인구 값이 없어요. 2015년 조사에서 성씨는 모두 5,582개(귀화 포함)였어요.</p>`}
    ${bs ? `<div class="clan"><h3>나와 같은 ${esc(bs.place)} ${esc(bs.s)}씨 ${bs.approx ? '약 ' : ''}${nf(bs.n)}명</h3>
        <p>2015년 기준 전체 인구의 <b>${bs.share.toFixed(2)}%</b>${bs.rank ? ` · 본관 순위 <b>${bs.rank}위</b>` : ''}.${bs.founder ? ` 시조는 ${bs.era ? `${esc(bs.era)}의 ` : ''}<b>${esc(bs.founder)}</b>${euro(bs.founder)} 전해져요.` : ''}</p></div>`
    : pf.bongwan ? `<p class="muted">입력한 본관 '${esc(pf.bongwan)}'은 이 앱의 본관 표(상위 약 80개)에 없어 성씨 통계만 보여 드려요. 2015년 본관은 ${nf(BONGWAN_TOTAL.clans)}개, 1천 명 이상인 본관은 ${BONGWAN_TOTAL.over1000}개였어요.</p>`
    : '<p class="muted">본관을 입력하면 같은 본관 인구와 시조 정보를 보여 드려요.</p>'}
    <p class="fine">출처: 통계청 2015 인구주택총조사 성씨·본관 집계(내국인 ${nf(POP_2015)}명). 2015 조사는 '유'와 '류'를 따로 셌어요. 시조 정보는 각 문중에서 전하는 내용으로 전설이 포함돼요.</p>
    <a class="inline-cta" href="#/surname">다른 성씨·본관도 찾아보기 →</a>
  </section>`;
}

function futureCard(res) {
  const ds = descendants(res.by);
  const t = TYPES[res.typeId];
  return `<section class="card" aria-labelledby="h-fut">
    <h2 id="h-fut">앞으로 생길 자손들</h2>
    <p class="sub">한 세대 ≈ 31년, 아직 오지 않은 세대만 내다본 상상 · 숫자는 통계청 장래인구추계(2022~2072, 중위)</p>
    <ol class="tl future">${ds.map((d, i) => `
      <li><div class="tl-h"><b>${d.label} 세대</b><span>${d.born}년 무렵 출생 · ${d.thirty}년에 서른</span></div>
        <p>${i === 0 ? `이 세대가 태어날 무렵 기대수명은 2022년 ${FUTURE.life2022}세에서 2072년 ${FUTURE.life2072}세로 늘 것으로 가정돼요.`
          : d.inProjection ? `추계상 2072년 한국 인구는 ${nf(FUTURE.pop2072)}만 명(1977년 수준), 65세 이상이 ${FUTURE.aged2072}%, 중위연령 ${FUTURE.medianAge2072}세예요. 한 해 출생아는 약 ${FUTURE.births2072}만 명으로 예상돼요.`
          : `통계청 추계는 2072년까지라 ${d.born}년은 숫자로 알 수 없어요. 2072년에 이미 인구의 ${FUTURE.aged2072}%가 65세 이상이니, 이 세대는 지금보다 훨씬 '어른이 많은' 사회에서 태어날 거예요.`}</p></li>`).join('')}</ol>
    <div class="pass">당신이 물려줄 것은 유전자 속 성격이 아니라 <b>이야기와 습관</b>이에요. ${esc(t.keywords[0])}${josa(t.keywords[0], '과', '와')} ${esc(t.keywords[1])}${josa(t.keywords[1], '을', '를')} 아끼던 ${res.code} 조상의 이야기가 손주 세대에 "우리 집안 어른은…"으로 전해질지도 몰라요.</div>
  </section>`;
}

function codeCard(res) {
  const t = TYPES[res.typeId];
  const lines = res.posPct.map((p, k) => {
    const lead = p >= 50; const pc = lead ? p : 100 - p; const side = lead ? AXES[k].pos : AXES[k].neg;
    return { k, pc, txt: `${side.d}(${side.h}) 쪽 ${pc}%` };
  }).sort((a, b) => b.pc - a.pc);
  const best = t.best.map(id => ({ id, code: codeOf(id) })), worst = { id: t.worst, code: codeOf(t.worst) };
  return `<section class="card code-final" aria-labelledby="h-code">
    <div class="sec-kicker">결론 · 나만의 근본 코드</div>
    <div class="code-badge" id="h-code" aria-label="근본 코드 ${res.code}">${res.code.split('').map((c, k) => `<span><b>${c}</b><small>${hanjaCode(res.typeId)[k].h}</small></span>`).join('')}</div>
    <h2 class="code-nick">${esc(res.nick)}</h2>
    <p class="code-meta">16개 코드 중 하나 · 시뮬레이션상 <b>${RARITY[res.typeId]}%</b> · MBTI로 치면 <b>${mbtiOf(res.typeId)}</b>와 비슷한 결 (참고용 비유)</p>
    <ul class="code-sum">
      <li>가장 뚜렷한 기질은 <b>${lines[0].txt}</b> — 네 축 가운데 합산 점수가 가장 한쪽으로 기운 축이에요.</li>
      <li>${res.answered === 0 ? `질문을 건너뛰어 사주 일간 ${STEMS[res.saju.dayMaster]}·${ELEMENTS[res.saju.dayEl].h}와 ${esc(res.cohort.label)} 배경만으로 정했어요.` : `답변${res.answered < res.total ? `(${res.answered}개)` : '(60%)'}에 사주 일간 ${STEMS[res.saju.dayMaster]}·${ELEMENTS[res.saju.dayEl].h}${res.answered < res.total ? '' : '(25%)'}와 ${esc(res.cohort.label)} 배경${res.answered < res.total ? '' : '(15%)'}이 더해졌어요.`}</li>
      <li>가장 덜 뚜렷한 축은 <b>${lines[3].txt}</b> — 상황에 따라 반대 모습도 자주 보일 수 있어요.</li>
    </ul>
    <div class="code-match">
      <div><small>잘 맞는 코드</small>${best.map(b => `<button class="cm good" data-action="type" data-id="${b.id}">${b.code}<small>${TYPES[b.id].name}</small></button>`).join('')}</div>
      <div><small>티격태격 코드</small><button class="cm bad" data-action="type" data-id="${worst.id}">${worst.code}<small>${TYPES[worst.id].name}</small></button></div>
    </div>
    <p class="fine">비율은 무작위 응답 2만 회 시뮬레이션에서 각 코드가 나온 비율이에요(실제 사용자 통계 아님).</p>
    <div class="btn-row"><button class="btn btn-primary btn-sm" data-action="invite-share">다른 사람과 코드 비교하기</button><button class="btn btn-dark btn-sm" data-action="share">내 코드 공유</button></div>
  </section>`;
}

function renderResult(fresh = false) {
  const saved = store.get(RKEY);
  if (!saved || !saved.profile || !saved.profile.birth) { renderLanding(); return; }
  const pf = { ...blankProfile(), ...saved.profile };
  const res = computeResult(pf, saved.answers || []);
  if (!res) { store.del(RKEY); renderLanding(); return; }
  setFlowMode(false);
  document.body.classList.add('has-sticky');
  const t = TYPES[res.typeId];
  const streak = updateStreak();
  const daily = dailyMessage(res);
  const eras = eraLives(res);
  R = { pf, res, t, eras, cardBlob: null };
  const name = pf.name;
  const blendTxt = res.blend.map(b => `${TYPES[b.id].name} ${b.pct}%`).join(' · ');

  const inv = store.get('invite');
  let invHtml = '';
  if (inv) {
    const me = { typeId: res.typeId, el: res.saju.dayEl, yearBranch: res.saju.yearBranch };
    const other = { typeId: inv.t, el: TYPES[inv.t].el, yearBranch: null };
    const c = compat(me, other);
    addDex({ n: inv.n, t: inv.t, s: c.total, d: dkey(), src: 'invite' });
    invHtml = cmpCard(name, me, inv.n, other, c, `${esc(inv.n)}님이 보낸 궁합 초대`);
    store.del('invite');
  }
  const stg = STAGES.find(s => s.key === res.stage);
  const skipNote = res.answered === 0
    ? `<section class="skip-notice" aria-label="질문 건너뜀 안내"><p><b>질문을 건너뛰어 사주·출생 정보로만 계산했어요.</b> 질문 ${res.total}개에 답하면 지금의 나에 더 가까운 코드가 나와요.</p><button class="btn btn-dark btn-sm" data-action="answer-qs">질문에 답하기</button></section>`
    : res.answered < res.total
      ? `<section class="skip-notice" aria-label="질문 건너뜀 안내"><p>질문 ${res.total}개 중 <b>${res.answered}개</b>에 답했어요. 건너뛴 질문은 사주·출생 정보로 채워 계산했어요.</p><button class="btn btn-ghost btn-sm" data-action="answer-qs">남은 질문 답하기</button></section>`
      : '';
  const partTxt = res.answered === 0 ? '사주 오행과 출생 시대·지역' : res.answered < res.total ? `질문 ${res.answered}/${res.total}개 + 사주 + 출생 시대·지역` : `${stg ? stg.label : ''} 질문 ${res.total}개 + 사주 + 출생 시대·지역`;

  app.innerHTML = `
  <section class="stage stage-result" id="r-hero" aria-labelledby="r-title">
    <div class="stage-in">
      <div class="stage-head">
        <p class="stage-kicker">근본 테스트 결과</p>
        <h1 class="stage-title stage-title-sm" id="r-title">${esc(name)}님의 근본은<br>${t.name}형 ${res.code}</h1>
        <div class="kw">${t.keywords.map(k => `<span>${esc(k)}</span>`).join('')}</div>
      </div>
      <div class="stage-card">${codeCardHTML({ id: res.typeId, pct: res.posPct, title: `${name}님의 근본 코드` })}</div>
      <div class="stage-cta">
        <div class="btn-row"><button class="btn btn-stamp" data-action="share">내 코드 공유</button><button class="btn btn-on-field" data-action="goto-compat">궁합 보기</button></div>
      </div>
    </div>
  </section>
  <div class="result wrap">
    ${skipNote}
    <section class="daily" aria-label="오늘의 조상님 한마디">
      <div class="daily-top"><span>오늘의 조상님 한마디 · ${daily.ilJin}</span><span class="streak">${streak.n}일 연속 문안</span></div>
      <div class="daily-msg">${emblemSVG(res.typeId, 52, 'aria-hidden="true"')}<p>“${esc(daily.msg)}”<small>— ${res.code} ${t.name}형 조상님 · ${esc(daily.mood)}</small></p></div>
      <div class="daily-stats">
        <div><b>${daily.ilJin}</b><span>오늘 일진</span></div>
        <div><b>${ELEMENTS[daily.todayEl].h}→${ELEMENTS[res.saju.dayEl].h}</b><span>오늘·나의 오행</span></div>
        <div><b>${daily.luckyColor}</b><span>나를 돕는 색</span></div>
        <div><b>${daily.luckyDir}</b><span>나를 돕는 방향</span></div>
      </div>
    </section>

    <section class="card" aria-labelledby="h-axes">
      <h2 id="h-axes">내 안의 네 가지 기질</h2>
      <p class="sub">${partTxt}으로 계산</p>
      ${axisBars(res)}
      <h3 class="mini-h">가까운 근본 3가지</h3>
      <div class="blend-bars">${res.blend.map(b => {
        const bt = TYPES[b.id];
        return `<button class="bb" data-action="type" data-id="${b.id}">${emblemSVG(b.id, 44, 'aria-hidden="true"')}<div><div class="bb-name">${bt.name}<small style="color:var(--muted);font-weight:700">${codeOf(b.id)}</small></div><div class="bb-track"><i data-w="${b.pct}" style="background:${ELEMENTS[bt.el].color}"></i></div></div><span class="bb-pct">${b.pct}%</span></button>`;
      }).join('')}</div>
      ${formulaBox(res, pf)}
    </section>

    <section class="card" aria-labelledby="h-me">
      <h2 id="h-me">${t.name}형(${res.code})은 이런 사람</h2>
      <p class="sub">${hanjaCode(res.typeId).map(c => `${c.h}(${c.d})`).join(' · ')}</p>
      <p class="desc">${esc(t.desc)}</p>
      <div class="two-col">
        <div class="box good"><h3>강점</h3><ul>${t.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
        <div class="box bad"><h3>약점</h3><ul>${t.weaknesses.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
      </div>
      <div style="margin-top:16px"><b>어울리는 일</b><div class="jobs">${t.jobs.map(j => `<span>${esc(j)}</span>`).join('')}</div></div>
      <div class="today-box"><b>오늘날 이런 사람</b>${esc(t.today)}</div>
    </section>

    ${adSlot()}

    ${sajuCard(res, pf)}
    ${ancestorCard(res)}

    ${adSlot()}

    ${likelyCard(res)}
    ${clanCard(pf)}

    <section class="card" aria-labelledby="h-era">
      <h2 id="h-era">시대별 나의 인생</h2>
      <p class="sub">그 시대의 실제 사실 + ${esc(name)}님 성향에 어울리는 역할(상상)</p>
      <div class="tabs" role="tablist">${eras.map((e, i) => `<button class="tab" role="tab" id="tab-${i}" aria-selected="${i === 2}" aria-controls="era-panel" data-action="era" data-i="${i}">${e.tab}</button>`).join('')}</div>
      <div id="era-panel" role="tabpanel"></div>
      <div class="era-dots" aria-hidden="true">${eras.map((e, i) => `<i class="${i === 2 ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn btn-ghost btn-block btn-sm" style="margin-top:12px" data-action="era-next">다음 시대로 →</button>
    </section>

    ${futureCard(res)}

    ${adSlot()}

    ${codeCard(res)}

    <section class="card share-card-sec" aria-labelledby="h-share">
      <h2 id="h-share">내 근본 카드</h2>
      <p class="sub">저장해서 스토리에 올리고 친구 코드도 물어보세요</p>
      <img class="share-preview" id="share-preview" alt="${esc(name)}님의 근본 카드: ${res.code} ${esc(res.nick)}, ${esc(blendTxt)}">
      <div class="btn-row"><button class="btn btn-primary btn-sm" data-action="save-card">이미지 저장</button><button class="btn btn-dark btn-sm" data-action="share">공유하기</button></div>
    </section>

    <section class="card" id="compat" aria-labelledby="h-cmp">
      <h2 id="h-cmp">근본 궁합</h2>
      <p class="sub">오행 상생·상극 + 코드 궁합 + 띠 궁합으로 계산해요</p>
      ${invHtml}
      <div class="invite-box">
        <h3>${icon('mail')}친구에게 궁합 신청하기</h3>
        <p>링크를 받은 친구가 테스트를 마치면 두 사람의 코드와 궁합이 자동으로 나와요. 링크엔 이름과 코드만 담겨요.</p>
        <div class="btn-row"><button class="btn btn-primary btn-sm" data-action="invite-share">링크 보내기</button><button class="btn btn-ghost btn-sm" data-action="invite-copy">링크 복사</button></div>
      </div>
      <form class="friend-form" id="friend-form" autocomplete="off">
        <b>지금 바로 궁합 보기</b>
        <label class="field" style="margin-top:8px"><span>상대 이름</span><input class="input" id="fr-name" maxlength="10" placeholder="예) 성춘향" required></label>
        <div class="field"><span>상대 생년월일 (양력)</span><div class="row3">
          <select class="input" id="fr-y" aria-label="상대 태어난 해" required>${yearOpts('')}</select>
          <select class="input" id="fr-m" aria-label="상대 태어난 달" required>${rangeOpts(12, '월', '')}</select>
          <select class="input" id="fr-d" aria-label="상대 태어난 날" required>${rangeOpts(31, '일', '')}</select></div></div>
        <p class="hint" id="fr-err" role="alert"></p>
        <button class="btn btn-dark btn-block" type="submit">궁합 보기</button>
      </form>
      <div id="cmp-out"></div>
      <div id="history"></div>
    </section>

    <section class="read-note" aria-labelledby="h-cmp-read">
      <h2 id="h-cmp-read">궁합 점수 읽는 법</h2>
      <p>총점은 오행 궁합 40%, 코드 궁합 42%, 띠 궁합 18%를 더해요. 두 사람의 일간 오행이 서로 살리는 상생이면 90점대, 같은 오행이면 76점, 누르는 상극이면 60점대예요.</p>
      <p>띠는 육합 96점, 삼합 90점, 충 52점이고 띠를 모르면 72점으로 계산해요. 88점 이상은 천생연분, 75점 이상은 찰떡궁합, 62점 이상은 티키타카, 그 아래는 불꽃 케미예요.</p>
    </section>

    ${adSlot()}

    <section class="card" id="dex-sec" aria-labelledby="h-dex"></section>

    <section class="read-note" aria-labelledby="h-read">
      <h2 id="h-read">이 결과를 읽는 법</h2>
      <p>네 축 중 한쪽으로 크게 기운 축일수록 평소 모습에 가깝고, 50%에 가까운 축은 상황에 따라 반대 모습도 자주 나와요. 계산식은 위 ‘어떻게 계산했나요?’에 있어요.</p>
      <p>조상 타임라인은 한 세대를 30년으로 잡은 계산이고, 성씨·본관 숫자는 통계청 2015 인구주택총조사 값이에요. 사주 해석과 '닮은 조상'은 재미로 보는 상상이에요.</p>
    </section>

    ${adSlot('multiplex')}

    <section class="read-note" aria-labelledby="h-facts2">
      <h2 id="h-facts2">${esc(pf.surname || name)}${pf.surname ? '씨' : '님'}에 관한 숫자 하나</h2>
      <p>${(() => { const ss = surnameStat(pf.surname || ''); return ss ? `2015년 기준 ${esc(pf.surname)}씨는 ${ss.rank}위, 약 ${man(ss.n)}명이에요. 100명이 모이면 그중 ${ss.share >= 1 ? `${Math.round(ss.share)}명` : '1명 미만'}이 ${esc(pf.surname)}씨인 셈이에요.` : `2015년 조사에서 성씨는 모두 5,582개(귀화 포함)였어요. 상위 45개 밖의 성씨는 이 앱에 인구 값이 없어요.`; })()} 10대 위로 올라가면 조상 자리만 ${nf(2 ** 10)}개예요.</p>
    </section>

    ${miniTests('main')}

    <div class="retry">
      <button class="btn btn-ghost" data-action="retry">다시 테스트하기</button>
      <button class="skip" data-action="reset">내 정보 지우기</button>
    </div>
  </div>
  <div class="sticky" id="sticky"><div class="sticky-in"><button class="btn btn-primary" data-action="share">내 코드 공유하기</button><button class="btn btn-dark" data-action="goto-compat">궁합 보기</button></div></div>`;

  renderEra(2);
  renderHistory();
  renderDex();
  requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]', app).forEach(el => { el.style.width = el.dataset.w + '%'; })));
  $('#friend-form').addEventListener('submit', onFriendSubmit);
  pushAds(app);
  setupSticky();
  window.scrollTo(0, 0);
  if (invHtml) setTimeout(() => $('#compat')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), fresh ? 900 : 300);
  const prev = $('#share-preview');
  const io = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) { io.disconnect(); getCard().then(b => { if (b && prev) prev.src = URL.createObjectURL(b); }).catch(() => {}); } }, { rootMargin: '400px' });
  io.observe(prev);
}

function renderEra(i) {
  if (!R) return;
  const e = R.eras[i];
  $('#era-panel').innerHTML = `
    <div class="era-card">${emblemSVG(e.id, 76, 'aria-hidden="true"')}<div>
      <div class="era-y">${e.name} · ${e.year}</div>
      <div class="era-h">${e.key === 'future' ? '2100년에 태어났다면' : `${e.name}에 태어났다면`}, 너는 <u style="text-decoration-thickness:1px;text-underline-offset:5px">${esc(e.role)}</u>${e.key === 'now' ? josa(e.role, '이야', '야') : josa(e.role, '이었을 거야', '였을 거야')}.</div>
      <p>${esc(e.story)}</p></div></div>
    <div class="fact"><b>그 시대 사실</b>${esc(e.fact)}</div>`;
  $$('.tab', app).forEach((b, j) => b.setAttribute('aria-selected', String(j === i)));
  $$('.era-dots i', app).forEach((d, j) => d.classList.toggle('on', j === i));
  R.era = i;
  const tab = $(`#tab-${i}`); if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function cmpCard(aName, a, bName, b, c, label, estimated) {
  const ta = TYPES[a.typeId], tb = TYPES[b.typeId];
  const circ = 2 * Math.PI * 42;
  const verdict = c.total >= 88 ? '천생연분' : c.total >= 75 ? '찰떡궁합' : c.total >= 62 ? '티키타카' : '불꽃 케미';
  return `<div class="cmp" role="group" aria-label="궁합 결과">
    ${label ? `<div class="cmp-label">${label}</div>` : ''}
    <div class="cmp-top">
      <div class="cmp-p">${emblemSVG(a.typeId, 64, 'aria-hidden="true"')}<b>${esc(aName)}</b><small>${codeOf(a.typeId)} · ${ta.name}형</small></div>
      <div class="ring"><svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="42" fill="none" style="stroke:var(--line)" stroke-width="6"/><circle cx="48" cy="48" r="42" fill="none" style="stroke:var(--accent)" stroke-width="6" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - c.total / 100)}"/></svg><span>${c.total}<small>${verdict}</small></span></div>
      <div class="cmp-p">${emblemSVG(b.typeId, 64, 'aria-hidden="true"')}<b>${esc(bName)}</b><small>${codeOf(b.typeId)}${estimated ? '(추정)' : ''} · ${tb.name}형</small></div>
    </div>
    <div class="cmp-rows">
      <div class="cmp-row"><div class="t"><span>오행 궁합 ${ELEMENTS[a.el].h}·${ELEMENTS[b.el].h}</span><span>${c.elScore}</span></div><div class="bar"><i style="width:${c.elScore}%"></i></div><p>${esc(c.elText)}</p></div>
      <div class="cmp-row"><div class="t"><span>코드 궁합 ${codeOf(a.typeId)}·${codeOf(b.typeId)}</span><span>${c.ty}</span></div><div class="bar"><i style="width:${c.ty}%"></i></div><p>${ta.best.includes(b.typeId) ? '서로의 빈 곳을 채우는 조합' : ta.worst === b.typeId ? '정반대라 부딪히지만, 배울 것도 가장 많은 조합' : a.typeId === b.typeId ? '거울을 보는 듯한 같은 코드' : '다른 듯 닮은, 균형 잡힌 조합'}</p></div>
      <div class="cmp-row"><div class="t"><span>띠 궁합</span><span>${c.brScore}</span></div><div class="bar"><i style="width:${c.brScore}%"></i></div><p>${esc(c.brText)}</p></div>
    </div>
    <p class="cmp-story">${esc(compatStory(aName, a, bName, b, c.total))}</p>
    ${estimated ? `<p class="cmp-est">상대 코드는 퀴즈 없이 사주·출생연도만으로 추정했어요. 궁합 링크로 테스트하면 정확해져요.</p>` : ''}
  </div>`;
}

function onFriendSubmit(e) {
  e.preventDefault();
  const n = $('#fr-name').value.trim().slice(0, 10);
  const y = $('#fr-y').value, m = $('#fr-m').value, d = $('#fr-d').value;
  const err = $('#fr-err');
  if (n.length < 1) { err.textContent = '상대 이름을 입력해 주세요.'; return; }
  if (!validSolar(y, m, d)) { err.textContent = '생년월일을 다시 확인해 주세요.'; return; }
  err.textContent = '';
  const birth = `${y}-${pad(m)}-${pad(d)}`;
  const est = estimateType(n, birth);
  const me = { typeId: R.res.typeId, el: R.res.saju.dayEl, yearBranch: R.res.saju.yearBranch };
  const other = { typeId: est.typeId, el: est.saju.dayEl, yearBranch: est.saju.yearBranch };
  const c = compat(me, other);
  const before = new Set(getDex().map(x => x.t));
  addDex({ n, t: est.typeId, s: c.total, d: dkey(), src: 'manual', el: other.el, yb: other.yearBranch });
  $('#cmp-out').innerHTML = cmpCard(R.pf.name, me, n, other, c, '', true);
  renderHistory(); renderDex();
  if (!before.has(est.typeId) && est.typeId !== R.res.typeId) toast(`도감에 ${codeOf(est.typeId)} ${TYPES[est.typeId].name}형이 새로 등록됐어요!`);
}

function renderHistory() {
  const dex = getDex(); const el = $('#history'); if (!el) return;
  if (!dex.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="history"><b>지난 궁합</b>${dex.slice(0, 6).map((x, i) => `<button data-action="hist" data-i="${i}">${emblemSVG(x.t, 32, 'aria-hidden="true"')}<span>${esc(x.n)} · ${codeOf(x.t)} ${TYPES[x.t].name}형</span><span class="sc">${x.s}</span></button>`).join('')}</div>`;
}

function renderDex() {
  const sec = $('#dex-sec'); if (!sec || !R) return;
  const dex = getDex();
  const owned = new Map(); dex.forEach(x => { if (!owned.has(x.t)) owned.set(x.t, x.n); });
  const mine = R.res.typeId;
  const count = new Set([mine, ...owned.keys()]).size;
  sec.innerHTML = `
    <h2 id="h-dex">친구들의 근본 도감</h2>
    <p class="sub">궁합을 볼 때마다 친구의 코드 카드가 열려요</p>
    <div class="dex-progress"><span>${count} / 16</span><div class="prog"><i style="width:${(count / 16) * 100}%"></i></div><span>${count === 16 ? '완성!' : '수집 중'}</span></div>
    <div class="dex">${TYPES.map((t, i) => {
      const isMine = i === mine, got = isMine || owned.has(i);
      return `<button class="${got ? '' : 'locked'} ${isMine ? 'mine' : ''}" data-action="dex" data-id="${i}" aria-label="${got ? codeOf(i) + ' ' + t.name + '형' : '잠긴 카드'}">${got ? emblemSVG(i, 52, 'aria-hidden="true"') : lockedSVG(52)}<b>${got ? codeOf(i) : '????'}</b><small>${isMine ? '나' : got ? esc(owned.get(i)) : ''}</small></button>`;
    }).join('')}</div>`;
}

/* ---------- mini tests ---------- */
function miniShell(kicker, title, sub, body) {
  setFlowMode(false); killSticky(); document.body.classList.remove('has-sticky');
  $('.top-btn').hidden = false;
  app.innerHTML = `<div class="wrap mini">
    <div class="sec-head" style="margin:26px 0 18px"><div class="sec-kicker">${kicker}</div><h1 class="sec-title">${title}</h1><p class="sec-sub">${sub}</p></div>
    ${body}
  </div>`;
  window.scrollTo(0, 0);
}
function renderSurnameTest() {
  const saved = store.get(RKEY);
  const sur0 = saved?.profile?.surname || '';
  const bon0 = saved?.profile?.bongwan || '';
  const top10 = SURNAMES.slice(0, 10);
  miniShell('MINI TEST · 실제 통계', '나와 같은 성씨·본관은 몇 명?', '통계청 2015 인구주택총조사', `
    <form class="card" id="sur-form" autocomplete="off">
      <div class="row2">
        <label class="field"><span>성씨</span><input class="input" id="s-sur" maxlength="2" placeholder="예) 김" value="${esc(sur0)}"></label>
        <label class="field"><span>본관 (선택)</span><input class="input" id="s-bon" maxlength="12" placeholder="예) 김해" value="${esc(bon0)}" list="bon-list"></label>
      </div>
      <datalist id="bon-list"></datalist>
      <button class="btn btn-dark btn-block" type="submit">찾아보기</button>
    </form>
    <div id="sur-out"></div>
    <section class="card"><h2>성씨 TOP 10</h2><p class="sub">2015년 내국인 ${nf(POP_2015)}명 기준</p>
      <div class="rank">${top10.map(s => `<div><b>${s.rank}</b><span>${s.s}</span><div class="rk-track"><i style="width:${(s.n / top10[0].n) * 100}%"></i></div><em>${man(s.n)}</em></div>`).join('')}</div>
      <p class="fine">김·이·박 세 성씨만 합쳐도 약 ${((top10[0].n + top10[1].n + top10[2].n) / POP_2015 * 100).toFixed(1)}%예요.</p></section>
    ${adSlot('multiplex')}
    <section class="read-note"><h2>성씨·본관 통계 읽는 법</h2><p>2015년 인구주택총조사는 성씨와 본관을 함께 조사한 가장 최근 자료예요. 같은 한자 성씨라도 '유'와 '류'처럼 한글 표기가 다르면 따로 셌고, 본관은 신고한 대로 집계했어요. 이 앱에는 상위 45개 성씨와 약 80개 본관의 값이 들어 있어요.</p></section>
    ${adSlot()}
    <section class="read-note"><h2>시조 이야기는 어디서 왔나요?</h2><p>시조 정보는 각 문중에서 전하는 내용이라 전설이 섞여 있어요. 같은 본관이라도 문중마다 계보가 다를 수 있어요.</p></section>
    ${miniTests('surname')}`);
  const out = $('#sur-out');
  const fill = () => { const s = $('#s-sur').value.trim(); $('#bon-list').innerHTML = bongwanOptions(s).map(b => `<option value="${esc(b.split(' ')[0])}">`).join(''); };
  const show = () => {
    const s = $('#s-sur').value.trim(); const b = $('#s-bon').value.trim();
    if (!s) { out.innerHTML = ''; return; }
    const prof = { surname: s, bongwan: b };
    out.innerHTML = clanCard(prof).replace('<a class="inline-cta" href="#/surname">다른 성씨·본관도 찾아보기 →</a>', `<button class="btn btn-primary btn-block btn-sm" data-action="start" style="margin-top:12px">내 근본 코드까지 찾아보기 →</button>`);
  };
  $('#s-sur').addEventListener('input', fill); fill();
  $('#sur-form').addEventListener('submit', e => { e.preventDefault(); show(); });
  if (sur0) show();
  pushAds(app);
}
function renderAncestorTest() {
  const saved = store.get(RKEY);
  const by0 = saved?.profile?.birth ? +saved.profile.birth.slice(0, 4) : 1995;
  miniShell('MINI TEST · 진짜 수학', '조상 몇 명이 나를 만들었나', '한 세대 위로 갈 때마다 두 배', `
    <div class="card">
      <div class="row2">
        <label class="field"><span>태어난 해</span><select class="input" id="a-y">${yearOpts(by0)}</select></label>
        <label class="field"><span>몇 대 위까지?</span><select class="input" id="a-n">${rangeOpts(40, '대', 10)}</select></label>
      </div>
      <input type="range" id="a-r" min="1" max="40" value="10" aria-label="세대 수" class="range">
    </div>
    <div id="anc-out"></div>
    <section class="read-note"><h2>왜 두 배씩 늘어날까?</h2><p>누구에게나 부모는 2명, 조부모는 4명이에요. 한 세대 올라갈 때마다 조상 자리는 두 배가 되니 n대 위는 2ⁿ명이에요. 한 세대는 평균 30년으로 잡았어요.</p></section>
    ${adSlot()}
    <section class="read-note"><h2>조상 겹침</h2><p>25대쯤 올라가면 조상 자리가 당시 한반도 인구보다 많아져요. 같은 사람이 여러 자리를 차지하기 때문이고, 그래서 우리는 생각보다 가까운 먼 친척이에요.</p></section>
    ${adSlot('multiplex')}
    <section class="read-note"><h2>한 세대는 몇 년일까?</h2><p>이 계산은 한 세대를 평균 ${GEN_YEARS}년으로 잡았어요. 실제 부모와 자식의 나이 차는 시대와 집안마다 달라요. 한 세대를 25년으로 잡으면 같은 10대 위 조상도 50년 더 가까운 시대 사람이 돼요.</p></section>
    ${miniTests('ancestors')}`);
  const draw = () => {
    const by = +$('#a-y').value || by0; const n = +$('#a-n').value || 10;
    const born = by - GEN_YEARS * n; const cnt = 2 ** n; const cum = 2 ** (n + 1) - 2;
    const ev = EVENTS.filter(([y]) => y >= born + 12 && y <= born + 55).slice(0, 4);
    $('#anc-out').innerHTML = `<section class="card anc-result">
      <div class="big-num">${cnt >= 1e4 ? `약 ${man(cnt)}` : nf(cnt)}<small>명</small></div>
      <p class="center"><b>${n}대 위(${esc(genLabel(n))})</b> 조상 자리의 수예요. 그들은 대략 <b>${Math.floor(born / 10) * 10}년대생</b>, ${esc(eraNameOf(born + 20))}를 살았어요.</p>
      <div class="stat-row"><div><b>${cum >= 1e4 ? man(cum) : nf(cum)}</b><span>1~${n}대 누적 자리</span></div><div><b>2<sup>${n}</sup></b><span>계산식</span></div><div><b>${GEN_YEARS}년</b><span>한 세대 가정</span></div></div>
      ${ev.length ? `<p class="evs">${ev.map(([y, t]) => `<span class="ev"><i>${y}</i>${esc(t)}</span>`).join('')}</p>` : ''}
      ${n >= 25 ? `<p class="fine"><b>${man(cnt)}명</b>은 그 시절 한반도에 살던 사람보다 훨씬 많아요. 그래서 실제로는 같은 조상이 여러 갈래로 겹쳐요(조상 겹침). 우리 모두 먼 친척인 이유죠.</p>` : '<p class="fine">조상 자리는 2ⁿ으로 늘지만, 먼 세대로 갈수록 같은 사람이 여러 자리를 차지(조상 겹침)해서 실제 서로 다른 사람 수는 더 적어요.</p>'}
      <button class="btn btn-primary btn-block btn-sm" data-action="start">그 조상들과 나를 잇는 근본 코드 찾기 →</button>
    </section>`;
  };
  $('#a-r').addEventListener('input', () => { $('#a-n').value = $('#a-r').value; draw(); });
  $('#a-n').addEventListener('change', () => { $('#a-r').value = $('#a-n').value || 10; draw(); });
  $('#a-y').addEventListener('change', draw);
  draw();
  pushAds(app);
}

/* ---------- share ---------- */
async function getCard() {
  if (R.cardBlob) return R.cardBlob;
  R.cardBlob = await makeShareCard({ name: R.pf.name, result: R.res, url: BASE });
  return R.cardBlob;
}
function shareText() {
  return `내 근본 코드는 ${R.res.code} · ${R.res.nick}! (${TYPES[R.res.typeId].name}형 · 시뮬레이션상 ${RARITY[R.res.typeId]}%) 너의 코드는? 우리 궁합도 봐 줘 👉`;
}
async function doShare() { openShareSheet(inviteUrl(R.pf.name, R.res.typeId)); }
function openShareSheet(url) {
  sheet.innerHTML = `
    <button class="sheet-x" data-action="close" aria-label="닫기">${icon('close')}</button>
    <h2 id="modal-title">내 근본 코드 공유하기</h2>
    <img class="share-preview" id="sheet-preview" alt="공유 카드 미리보기">
    <div class="share-actions">
      <button class="btn btn-primary btn-block" data-action="share-native">공유하기</button>
      <div class="btn-row"><button class="btn btn-dark btn-sm" data-action="save-card">이미지 저장</button><button class="btn btn-ghost btn-sm" data-action="invite-copy">링크 복사</button></div>
      <p class="hint" style="text-align:center">링크로 들어온 친구가 테스트하면 두 코드의 궁합이 자동으로 나와요</p>
    </div>`;
  openModal();
  getCard().then(b => { const im = $('#sheet-preview'); if (im && b) im.src = URL.createObjectURL(b); }).catch(() => {});
  sheet.dataset.url = url;
}
async function nativeShare() {
  const url = inviteUrl(R.pf.name, R.res.typeId);
  try {
    const blob = await getCard();
    const file = new File([blob], `근본코드-${R.res.code}.png`, { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: '근본 테스트', text: `${shareText()} ${url}` }); return;
    }
    if (navigator.share) { await navigator.share({ title: '근본 테스트', text: shareText(), url }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  if (await copyText(`${shareText()} ${url}`)) toast('공유 문구와 링크를 복사했어요');
}
async function saveCard() {
  try {
    const blob = await getCard();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `근본코드-${R.res.code}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('카드 이미지를 저장했어요');
  } catch { toast('이미지를 만들지 못했어요'); }
}
async function inviteShare() {
  if (!R) { startFlow(false); return; }
  const url = inviteUrl(R.pf.name, R.res.typeId);
  const text = `${R.pf.name}님(${R.res.code})이 근본 코드 비교를 신청했어요! 테스트하면 우리 궁합이 바로 나와요 💌`;
  if (navigator.share) { try { await navigator.share({ title: '근본 코드 비교', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  if (await copyText(`${text} ${url}`)) toast('비교 링크를 복사했어요');
}

/* ---------- modal ---------- */
let lastFocus = null;
function openModal() { lastFocus = document.activeElement; modal.classList.add('open'); setTimeout(() => $('.sheet-x', sheet)?.focus(), 30); }
function closeModal() { modal.classList.remove('open'); sheet.innerHTML = ''; lastFocus?.focus?.(); }
function openTypeModal(id, mode) {
  const t = TYPES[id]; const code = hanjaCode(id);
  const unlocked = mode !== 'locked';
  sheet.innerHTML = `
    <button class="sheet-x" data-action="close" aria-label="닫기">${icon('close')}</button>
    <div class="type-modal-head">${unlocked ? emblemSVG(id, 84, 'aria-hidden="true"') : lockedSVG(84)}<div>
      <div class="tm-kicker">${codeOf(id)} · ${code.map(c => c.h).join('')} · ${ELEMENTS[t.el].h}</div>
      <h2 id="modal-title" style="margin:2px 0 2px">${unlocked ? `${esc(nickOf(id))} <small style="color:var(--muted);font-size:14px;font-family:var(--sans)">${t.name}형</small>` : '아직 못 만난 근본'}</h2>
      <div class="tm-tag">${unlocked ? esc(t.tagline) : `${code.map(c => c.d).join(' · ')}의 기질을 가진 코드`}</div></div></div>
    ${unlocked ? `<div class="kw" style="justify-content:flex-start">${t.keywords.map(k => `<span>${esc(k)}</span>`).join('')}</div>
      ${mode === 'preview' ? `<p class="desc" style="margin-top:14px;font-size:16px">${esc(t.title)}. MBTI로 치면 ${mbtiOf(id)}와 비슷한 결(참고용). 내 코드는 테스트로 확인해 보세요.</p>
        <button class="btn btn-primary btn-block" style="margin-top:16px" data-action="start">내 근본 코드 찾기 →</button>` :
      `<p class="desc" style="margin-top:14px;font-size:16px">${esc(t.desc)}</p>
        <div class="today-box"><b>오늘날 이런 사람</b>${esc(t.today)}</div>
        <p style="font-size:14px;margin:14px 0 0"><b>잘 맞는 코드</b> ${t.best.map(b => `${codeOf(b)}(${TYPES[b].name})`).join(', ')} · <b>티격태격</b> ${codeOf(t.worst)}(${TYPES[t.worst].name})</p>`}` :
      `<p class="desc" style="margin-top:12px;font-size:16px">이 코드를 가진 친구와 궁합을 보면 카드가 열려요. 궁합 링크를 보내 보세요!</p>
       <button class="btn btn-primary btn-block" style="margin-top:14px" data-action="invite-share">궁합 링크 보내기</button>`}`;
  openModal();
}

/* ---------- sticky ---------- */
function setupSticky() {
  killSticky();
  const st = $('#sticky'), hero = $('#r-hero');
  if (!st || !hero || !('IntersectionObserver' in window)) { st?.classList.add('show'); return; }
  stickyObs = new IntersectionObserver(([e]) => st.classList.toggle('show', !e.isIntersecting && e.boundingClientRect.top < 0));
  stickyObs.observe(hero);
}
function killSticky() { if (stickyObs) { stickyObs.disconnect(); stickyObs = null; } }

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]');
  if (!el) { if (e.target === modal) closeModal(); return; }
  const a = el.dataset.action; const pf = state.profile;
  switch (a) {
    case 'start': closeModal(); startFlow(true); break;
    case 'home': clearHash(); if (store.get(RKEY)) renderResult(); else renderLanding(); break;
    case 'home-link': e.preventDefault(); clearHash(); renderLanding(); break;
    case 'show-result': renderResult(); break;
    case 'back': if (state.step > 0) { state.step--; renderStep(); } else renderLanding(); break;
    case 'next': next(); break;
    case 'cal': {
      pf.cal = el.dataset.v;
      const keep = { y: $('#f-y').value, m: $('#f-m').value, d: $('#f-d').value, h: $('#f-h').value, mi: $('#f-mi').value };
      pf.birth = keep.y && keep.m && keep.d ? `${keep.y}-${pad(keep.m)}-${pad(keep.d)}` : ''; pf.hour = keep.h; pf.minute = keep.mi;
      renderStep(); break;
    }
    case 'bon': pf.bongwan = el.dataset.v; $('#f-bon').value = el.dataset.v; $$('.chip', app).forEach(c => c.classList.toggle('sel', c === el)); setTimeout(next, 180); break;
    case 'skip-bon': pf.bongwan = ''; state.step++; renderStep(); break;
    case 'region': case 'answer': {
      chooseOpt(el);
      // 누르면 고른 채로 바로 다음 단계 (방향키로 고를 땐 넘어가지 않음)
      $$('.opt', app).forEach(o => { o.disabled = true; });
      setTimeout(next, 200); break;
    }
    case 'skip-q': {
      const qi = +steps()[state.step].slice(1);
      state.answers[qi] = undefined; state.skipped.add(qi);
      if (state.step < steps().length - 1) { state.step++; renderStep(); } else renderLoading();
      break;
    }
    case 'skip-all': {
      const n = steps().length - BASE_STEPS.length;
      for (let i = +steps()[state.step].slice(1); i < n; i++) if (!isAnswered(i)) state.skipped.add(i);
      renderLoading(); break;
    }
    case 'answer-qs': resumeQuestions(); break;
    case 'type': openTypeModal(+el.dataset.id, R && document.querySelector('.result') ? 'full' : 'preview'); break;
    case 'dex': {
      const id = +el.dataset.id; const got = id === R?.res.typeId || getDex().some(x => x.t === id);
      openTypeModal(id, got ? 'full' : 'locked'); break;
    }
    case 'era': renderEra(+el.dataset.i); break;
    case 'era-next': renderEra(((R?.era ?? 2) + 1) % 6); break;
    case 'share': doShare(); break;
    case 'share-native': nativeShare(); break;
    case 'save-card': saveCard(); break;
    case 'invite-share': closeModal(); inviteShare(); break;
    case 'invite-copy': if (R) copyText(inviteUrl(R.pf.name, R.res.typeId)).then(ok => toast(ok ? '궁합 링크를 복사했어요' : '복사하지 못했어요')); break;
    case 'goto-compat': $('#compat')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
    case 'hist': {
      const x = getDex()[+el.dataset.i]; if (!x) break;
      const me = { typeId: R.res.typeId, el: R.res.saju.dayEl, yearBranch: R.res.saju.yearBranch };
      const other = { typeId: x.t, el: x.el || TYPES[x.t].el, yearBranch: x.yb ?? null };
      $('#cmp-out').innerHTML = cmpCard(R.pf.name, me, x.n, other, compat(me, other), x.src === 'invite' ? '궁합 링크로 만난 친구' : '', x.src !== 'invite');
      $('#cmp-out').scrollIntoView({ behavior: 'smooth', block: 'center' }); break;
    }
    case 'retry': startFlow(true); break;
    case 'reset':
      if (confirm('저장된 결과와 궁합 기록을 모두 지울까요?')) { [RKEY, 'result', 'dex', 'streak', 'invite'].forEach(k => store.del(k)); R = null; state.profile = blankProfile(); renderLanding(); }
      break;
    case 'close': closeModal(); break;
  }
});
/** 선택지 하나를 고른 상태로 표시하고 값 저장 (넘어가지는 않음) */
function chooseOpt(el) {
  $$('.opt', app).forEach(o => { const on = o === el; o.classList.toggle('sel', on); o.setAttribute('aria-checked', String(on)); o.tabIndex = on ? 0 : -1; });
  if (el.dataset.action === 'region') state.profile.region = el.dataset.v;
  else state.answers[+steps()[state.step].slice(1)] = +el.dataset.v;
  const nb = $('#next-btn'); if (nb) nb.disabled = false;
}
document.addEventListener('keydown', e => {
  if (document.body.classList.contains('in-flow') && !modal.classList.contains('open') && !e.isComposing) {
    const opt = e.target.closest?.('.opts[role="radiogroup"] .opt');
    const dir = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
    if (opt && dir) {
      e.preventDefault();
      const list = $$('.opt', opt.parentElement); const nx = list[(list.indexOf(opt) + dir + list.length) % list.length];
      chooseOpt(nx); nx.focus(); return;
    }
    // 선택지에서 Enter = 고른 채로 다음
    if (opt && e.key === 'Enter') { e.preventDefault(); chooseOpt(opt); next(); return; }
  }
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  if (modal.classList.contains('open') && e.key === 'Tab') {
    const f = $$('button, a[href], input, select', sheet).filter(x => !x.disabled);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

/* ---------- routing ---------- */
function route() {
  closeModal();
  const h = location.hash;
  if (h === '#/surname') return renderSurnameTest();
  if (h === '#/ancestors') return renderAncestorTest();
  if (store.get(RKEY)) renderResult(); else renderLanding();
}
window.addEventListener('hashchange', route);
route();
