import { TYPES, QUESTIONS, REGIONS, ELEMENTS, EL_ORDER, AXES, BONGWAN, POPULAR_BONGWAN } from './data.js';
import { STEMS, BRANCHES, STEMS_K, BRANCHES_K, STEM_EL, BRANCH_EL, HOURS, ZODIAC, computeSaju } from './saju.js';
import {
  computeResult, splitName, buildTree, clanStory, eraLives, compat, compatStory, estimateType,
  dailyMessage, todayStrongType, encodeInvite, decodeInvite, typeBits, hash,
} from './engine.js';
import { emblemSVG, emblemInner, lockedSVG } from './emblems.js';
import { makeShareCard } from './share.js';

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const P = 'geunbon.v1.';
const store = {
  get(k, d = null) { try { const v = localStorage.getItem(P + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(P + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(P + k); } catch { /* noop */ } },
};
const app = $('#app');
const modal = $('#modal'), sheet = $('#sheet');
const BASE = location.origin + location.pathname;
const codeOf = id => typeBits(id).map((b, i) => b ? AXES[i].neg : AXES[i].pos);
const josa = (w, a, b) => { const c = w.charCodeAt(w.length - 1); return (c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28) ? a : b; };

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}
function adSlot() {
  return `<div class="ad-wrap"><span class="ad-label">광고</span><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins></div>`;
}
function pushAds(root = document) {
  $$('ins.adsbygoogle:not([data-ad-pushed])', root).forEach(el => {
    el.setAttribute('data-ad-pushed', '1');
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* ad blocked or not loaded */ }
  });
}
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
const STEPS = ['name', 'bongwan', 'birth', 'gender', 'region', ...QUESTIONS.map((_, i) => 'q' + i)];
let state = { step: 0, profile: { name: '', surname: '', bongwan: '', birth: '', hour: '', gender: '', region: '' }, answers: [] };
let stickyObs = null;

// invite param
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
  $('.top-btn').hidden = !on;
}

/* ---------- landing ---------- */
function renderLanding() {
  setFlowMode(false); killSticky(); document.body.classList.remove('has-sticky');
  const inv = store.get('invite');
  const saved = store.get('result');
  const strong = todayStrongType();
  const st = TYPES[strong.id];
  const orbitIds = [1, 13, 15, 2, 8, 14, 12, 9];
  const sats = orbitIds.map((id, i) => {
    const a = (i / orbitIds.length) * Math.PI * 2 - Math.PI / 2;
    return `<div class="sat" style="left:${50 + 41 * Math.cos(a)}%;top:${50 + 41 * Math.sin(a)}%">${emblemSVG(id, 90, 'aria-hidden="true"')}</div>`;
  }).join('');
  app.innerHTML = `
  <section class="hero">
    <div class="hero-in">
      <div>
        ${inv ? `<div class="invite-banner">${emblemSVG(inv.t, 46, 'aria-hidden="true"')}<div><b>${esc(inv.n)}</b>님(${TYPES[inv.t].name}형)이 궁합을 신청했어요.<br><small>테스트를 마치면 두 사람의 궁합이 바로 나와요.</small></div></div>` : ''}
        <span class="eyebrow">🌳 16가지 근본 유형 · 사주 오행 · 상상 가계도</span>
        <h1>너, <em>근본</em>이<br>어디야?</h1>
        <p class="lead">이름과 생일, 그리고 10개의 질문. 내 안에 흐르는 조상의 피를 찾아 드려요. 조선에 태어났다면 당신은 무엇이었을까요?</p>
        <div class="hero-cta">
          <button class="btn btn-primary btn-block" data-action="start">내 근본 찾기 →</button>
          ${saved ? `<button class="btn btn-light btn-block" data-action="show-result">내 결과 다시 보기</button>` : ''}
          <div class="hero-meta"><span>⏱ <b>1분</b>이면 끝</span><span>🔒 정보는 <b>내 기기에만</b></span><span>🎁 <b>무료</b></span></div>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="orbit"><div class="orbit-ring"></div><div class="spin">${sats}</div><div class="core"><div><span>根本</span><small>내 안의 조상</small></div></div></div>
      </div>
    </div>
  </section>

  <section class="section wrap">
    <div class="today-strong">
      ${emblemSVG(strong.id, 64, 'aria-hidden="true"')}
      <div><b>오늘의 일진 ${strong.ilJin}</b> · 기운이 센 근본은 <b>${st.name}형</b>
        <p>${esc(st.tagline)}. 오늘 이 근본을 가진 사람은 하는 일마다 술술 풀린대요.</p></div>
    </div>
  </section>

  <section class="section wide" style="padding-top:8px">
    <div class="sec-head"><div class="sec-kicker">16 ROOTS</div><h2 class="sec-title">당신 안엔 어떤 피가 흐를까?</h2>
      <p class="sec-sub">16가지 근본 · ${(16 * 15 * 14).toLocaleString()}가지 혈통 조합</p></div>
    <div class="type-grid">${TYPES.map((t, i) => `<button class="type-chip" data-action="type" data-id="${i}" aria-label="${t.name}형 미리보기">${emblemSVG(i, 58, 'aria-hidden="true"')}<b>${t.name}</b><small>${t.hanja}</small></button>`).join('')}</div>
  </section>

  <div class="wrap">${adSlot()}</div>

  <section class="section wide" style="padding-top:16px">
    <div class="sec-head"><div class="sec-kicker">HOW IT WORKS</div><h2 class="sec-title">족보를 펼치는 세 가지 열쇠</h2></div>
    <div class="steps">
      <div class="step-card"><div class="n">壹</div><h3>사주 오행</h3><p>생년월일로 년·월·일주를 실제 60갑자로 계산해 내 안의 목·화·토·금·수 기운을 읽어요.</p></div>
      <div class="step-card"><div class="n">貳</div><h3>10개의 질문</h3><p>조선 장터에 떨어진다면? 탭 몇 번으로 思行·守遊·理情·獨群 네 가지 기질을 가려내요.</p></div>
      <div class="step-card"><div class="n">參</div><h3>상상 가계도</h3><p>고조할아버지부터 삼국시대 조상까지, 당신의 피가 흘러온 길을 이야기로 그려 드려요.</p></div>
    </div>
  </section>

  <section class="section wrap faq" style="padding-top:8px">
    <div class="sec-head"><h2 class="sec-title">자주 묻는 질문</h2></div>
    <details><summary>실제 족보랑 관련이 있나요?</summary><p>아니요. 입력한 정보를 바탕으로 재미로 만든 상상의 계보예요. 사주 기둥 계산은 실제 60갑자 방식을 따르지만, 해석은 엔터테인먼트 콘텐츠입니다.</p></details>
    <details><summary>내 정보는 어디에 저장되나요?</summary><p>이름, 생일 등 모든 입력은 서버로 보내지 않고 이 기기의 브라우저에만 저장돼요.</p></details>
    <details><summary>궁합은 어떻게 보나요?</summary><p>결과 화면에서 친구 이름과 생일을 넣거나, 궁합 링크를 보내 보세요. 친구가 테스트를 마치면 두 사람의 궁합이 자동으로 나와요.</p></details>
  </section>
  <div class="bottom-cta wrap"><button class="btn btn-primary" data-action="start">1분 만에 내 근본 찾기</button></div>`;
  pushAds(app);
  window.scrollTo(0, 0);
}

/* ---------- flow ---------- */
function startFlow(prefill) {
  const saved = store.get('result');
  if (prefill && saved) state.profile = { ...saved.profile };
  state.answers = []; state.step = 0;
  renderStep();
}

function yearOpts(sel) {
  const now = new Date().getFullYear(); let h = '<option value="">년</option>';
  for (let y = now; y >= 1930; y--) h += `<option value="${y}" ${+sel === y ? 'selected' : ''}>${y}년</option>`;
  return h;
}
function rangeOpts(n, label, sel) {
  let h = `<option value="">${label}</option>`;
  for (let i = 1; i <= n; i++) h += `<option value="${i}" ${+sel === i ? 'selected' : ''}>${i}${label}</option>`;
  return h;
}
function validDate(y, m, d) {
  if (!y || !m || !d) return false;
  const dt = new Date(+y, +m - 1, +d);
  return dt.getFullYear() === +y && dt.getMonth() === +m - 1 && dt.getDate() === +d && dt <= new Date();
}

function renderStep() {
  setFlowMode(true); killSticky(); document.body.classList.remove('has-sticky');
  const key = STEPS[state.step];
  const total = STEPS.length;
  const pf = state.profile;
  let body = '';
  if (key === 'name') {
    const sp = splitName(pf.name);
    body = `
      <div class="q-art" aria-hidden="true">📜</div>
      <div class="q-label">족보 첫 장</div>
      <h1 class="q-title">당신의 이름은?</h1>
      <p class="q-sub">성씨는 자동으로 나눠 드려요</p>
      <label class="field"><span class="sr-only">이름</span><input class="input" id="f-name" maxlength="10" autocomplete="name" placeholder="예) 홍길동" value="${esc(pf.name)}"></label>
      <div class="surname-pill" id="sp" ${sp.surname ? '' : 'hidden'}>성씨 <input id="f-sur" maxlength="2" aria-label="성씨" value="${esc(pf.surname || sp.surname)}"></div>`;
  } else if (key === 'bongwan') {
    const sur = pf.surname;
    const list = (BONGWAN[sur] || []).map(p => `${p} ${sur}씨`);
    const chips = (list.length ? list : POPULAR_BONGWAN).map(b => `<button class="chip ${pf.bongwan === b ? 'sel' : ''}" data-action="bon" data-v="${esc(b)}">${esc(b)}</button>`).join('');
    body = `
      <div class="q-art" aria-hidden="true">🏯</div>
      <div class="q-label">가문의 뿌리</div>
      <h1 class="q-title">본관을 알고 있나요?</h1>
      <p class="q-sub">몰라도 괜찮아요. 알면 가문 이야기가 열려요</p>
      <div class="chips">${chips}</div>
      <label class="field"><span>직접 입력</span><input class="input" id="f-bon" maxlength="12" placeholder="예) ${esc(list[0] || '김해 김씨')}" value="${esc(pf.bongwan)}"></label>`;
  } else if (key === 'birth') {
    const [y, m, d] = (pf.birth || '').split('-');
    body = `
      <div class="q-art" aria-hidden="true">🌙</div>
      <div class="q-label">사주의 기둥</div>
      <h1 class="q-title">언제 태어났나요?</h1>
      <p class="q-sub">양력 기준 · 년·월·일주를 60갑자로 계산해요</p>
      <div class="row3">
        <select class="input" id="f-y" aria-label="태어난 해">${yearOpts(y)}</select>
        <select class="input" id="f-m" aria-label="태어난 달">${rangeOpts(12, '월', m)}</select>
        <select class="input" id="f-d" aria-label="태어난 날">${rangeOpts(31, '일', d)}</select>
      </div>
      <label class="field" style="margin-top:12px"><span>태어난 시 (선택)</span>
        <select class="input" id="f-h"><option value="">모르겠어요</option>${HOURS.map((h, i) => `<option value="${i}" ${String(pf.hour) === String(i) ? 'selected' : ''}>${h}</option>`).join('')}</select></label>
      <p class="hint" id="birth-err" role="alert"></p>`;
  } else if (key === 'gender') {
    const opts = [['👩', '여성'], ['👨', '남성'], ['🌀', '선택 안 함']];
    body = `
      <div class="q-art" aria-hidden="true">☯️</div>
      <div class="q-label">음과 양</div>
      <h1 class="q-title">성별을 골라 주세요</h1>
      <p class="q-sub">가계도 속 호칭에만 쓰여요</p>
      <div class="opts">${opts.map(([e, t]) => `<button class="opt ${pf.gender === t ? 'sel' : ''}" data-action="gender" data-v="${t}"><span class="e" aria-hidden="true">${e}</span>${t}</button>`).join('')}</div>`;
  } else if (key === 'region') {
    const regs = [...REGIONS.map(r => r.t), '비밀'];
    body = `
      <div class="q-art" aria-hidden="true">🗺️</div>
      <div class="q-label">고향의 기운</div>
      <h1 class="q-title">고향은 어디인가요?</h1>
      <p class="q-sub">태어난 곳이나 마음의 고향, 아무 데나</p>
      <div class="opts two">${regs.map(t => `<button class="opt center ${pf.region === t ? 'sel' : ''}" data-action="region" data-v="${t}">${t}</button>`).join('')}</div>`;
  } else {
    const qi = +key.slice(1); const q = QUESTIONS[qi];
    body = `
      <div class="q-art" aria-hidden="true">${q.art}</div>
      <div class="q-label">질문 ${qi + 1} / ${QUESTIONS.length}</div>
      <h1 class="q-title">${esc(q.q)}</h1>
      <div class="opts" style="margin-top:20px">${q.opts.map((o, oi) => `<button class="opt ${state.answers[qi] === oi ? 'sel' : ''}" data-action="answer" data-v="${oi}"><span class="e" aria-hidden="true">${o.e}</span>${esc(o.t)}</button>`).join('')}</div>`;
  }
  const needsNext = ['name', 'bongwan', 'birth'].includes(key);
  app.innerHTML = `
    <div class="flow">
      <div class="flow-top">
        <button class="back" data-action="back" aria-label="이전"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M15 5l-7 7 7 7"/></svg></button>
        <div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${state.step + 1}"><i style="width:${((state.step + 1) / total) * 100}%"></i></div>
        <span class="prog-n">${state.step + 1}/${total}</span>
      </div>
      <div class="q-wrap">${body}</div>
      <div class="flow-foot">
        ${needsNext ? `<button class="btn btn-dark btn-block" data-action="next" id="next-btn">다음</button>` : ''}
        ${key === 'bongwan' ? `<button class="skip" data-action="skip-bon">잘 모르겠어요, 건너뛰기</button>` : ''}
      </div>
    </div>`;
  window.scrollTo(0, 0);
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
    const chk = () => { $('#next-btn').disabled = !($('#f-y').value && $('#f-m').value && $('#f-d').value); };
    ['#f-y', '#f-m', '#f-d'].forEach(s => $(s).addEventListener('change', chk)); chk();
  }
}

function next() {
  const key = STEPS[state.step]; const pf = state.profile;
  if (key === 'name') {
    if (pf.name.replace(/\s/g, '').length < 2) return;
    if (!pf.surname) pf.surname = splitName(pf.name).surname;
  }
  if (key === 'bongwan') pf.bongwan = ($('#f-bon')?.value || '').trim().slice(0, 12);
  if (key === 'birth') {
    const y = $('#f-y').value, m = $('#f-m').value, d = $('#f-d').value;
    if (!validDate(y, m, d)) { $('#birth-err').textContent = '날짜를 다시 확인해 주세요.'; return; }
    pf.birth = `${y}-${pad(m)}-${pad(d)}`; pf.hour = $('#f-h').value;
  }
  if (state.step < STEPS.length - 1) { state.step++; renderStep(); } else renderLoading();
}

/* ---------- loading ---------- */
function renderLoading() {
  setFlowMode(true);
  const pf = state.profile;
  const msgs = [`${pf.surname || ''}씨 족보를 펼치는 중…`, '고조할아버지를 깨우는 중…', '오행의 기운을 읽는 중…', '조선 호적을 뒤적이는 중…', '피의 비율을 계산하는 중…'];
  app.innerHTML = `
    <div class="loading" role="status" aria-live="polite">
      <div>
        <div class="scroll-anim" aria-hidden="true"><div class="paper">${[30, 48, 66, 84, 102].map((t, i) => `<i style="top:${t}px;animation-delay:${0.9 + i * 0.25}s;${i % 2 ? 'right:60px' : ''}"></i>`).join('')}</div><div class="rod l"></div><div class="rod r"></div></div>
        <p class="load-title">족보를 펼치는 중…</p>
        <p class="load-msg" id="lmsg">${esc(msgs[0])}</p>
        <div class="load-bar"><i></i></div>
      </div>
    </div>`;
  window.scrollTo(0, 0);
  let i = 0;
  const iv = setInterval(() => { i++; const el = $('#lmsg'); if (el) el.textContent = msgs[i % msgs.length]; }, 560);
  const saved = { profile: { ...state.profile }, answers: [...state.answers], at: Date.now() };
  store.set('result', saved);
  setTimeout(() => { clearInterval(iv); renderResult(true); }, 2600);
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

function renderResult(fresh = false) {
  const saved = store.get('result');
  if (!saved || !saved.profile || !saved.profile.birth) { renderLanding(); return; }
  setFlowMode(false);
  document.body.classList.add('has-sticky');
  const pf = saved.profile;
  const res = computeResult(pf, saved.answers || []);
  const t = TYPES[res.typeId];
  const streak = updateStreak();
  const daily = dailyMessage(res);
  const tree = buildTree(pf, res);
  const clan = clanStory(pf);
  const eras = eraLives(res);
  R = { pf, res, t, eras, cardBlob: null };
  const name = pf.name;
  const code = codeOf(res.typeId);
  const blendTxt = res.blend.map(b => `${TYPES[b.id].name} ${b.pct}%`).join(' · ');

  // pending invite
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

  const S = res.saju;
  const dist = EL_ORDER.map(k => ({ k, v: S.count[k], p: Math.round(S.dist[k] * 100) }));
  const strongEl = [...dist].sort((a, b) => b.v - a.v)[0];
  const weakEl = [...dist].sort((a, b) => a.v - b.v)[0];
  const dm = ELEMENTS[S.dayEl];

  app.innerHTML = `
  <div class="result wrap">
    <section class="daily" aria-label="오늘의 조상님 한마디">
      <div class="daily-top"><span>오늘의 조상님 한마디 · ${daily.ilJin}</span><span class="streak">🔥 ${streak.n}일 연속 문안</span></div>
      <div class="daily-msg">${emblemSVG(res.typeId, 52, 'aria-hidden="true"')}<p>“${esc(daily.msg)}”<small>— ${t.name}형 조상님 · ${esc(daily.mood)}</small></p></div>
      <div class="daily-stats">
        <div><b>${daily.score}</b><span>오늘 기운</span></div>
        <div><b>${daily.luckyColor}</b><span>행운 색</span></div>
        <div><b>${daily.luckyNum}</b><span>행운 숫자</span></div>
        <div><b>${daily.luckyDir}</b><span>좋은 방향</span></div>
      </div>
    </section>

    <section class="r-hero" id="r-hero">
      <div class="r-for">${esc(name)}님의 근본은</div>
      <div class="r-emblem">${emblemSVG(res.typeId, 168, `role="img" aria-label="${t.name}형 엠블럼"`)}</div>
      <div class="r-code" aria-label="유형 코드">${code.map(c => `<span title="${c.d}">${c.h}</span>`).join('')}</div>
      <h1 class="r-name">${t.name}형<small>${t.hanja}</small></h1>
      <p class="r-title">${esc(t.title)}</p>
      <p class="r-tag">${esc(t.tagline)}</p>
      <div class="kw">${t.keywords.map(k => `<span>${esc(k)}</span>`).join('')}</div>
    </section>

    <section class="card" aria-labelledby="h-blend">
      <h2 id="h-blend">내 안에 흐르는 피</h2>
      <p class="sub">10개의 답과 사주 오행으로 계산한 혈통 비율</p>
      <div class="blend-bars">${res.blend.map(b => {
        const bt = TYPES[b.id];
        return `<button class="bb" data-action="type" data-id="${b.id}">${emblemSVG(b.id, 44, 'aria-hidden="true"')}<div><div class="bb-name">${bt.name}<small style="color:var(--muted);font-weight:600">${bt.hanja}</small></div><div class="bb-track"><i data-w="${b.pct}" style="background:${ELEMENTS[bt.el].color}"></i></div></div><span class="bb-pct">${b.pct}%</span></button>`;
      }).join('')}</div>
      <p class="blend-line">겉은 <b>${t.name}</b>, 속엔 <b>${TYPES[res.blend[1].id].name}</b>의 ${esc(TYPES[res.blend[1].id].keywords[0])}${josa(TYPES[res.blend[1].id].keywords[0], '과', '와')} <b>${TYPES[res.blend[2].id].name}</b>의 ${esc(TYPES[res.blend[2].id].keywords[0])}${josa(TYPES[res.blend[2].id].keywords[0], '이', '가')} 숨어 있어요.</p>
    </section>

    <section class="card" aria-labelledby="h-me">
      <h2 id="h-me">${t.name}형은 이런 사람</h2>
      <p class="sub">${code.map(c => `${c.h}(${c.d})`).join(' · ')}</p>
      <p class="desc">${esc(t.desc)}</p>
      <div class="two-col">
        <div class="box good"><h3>강점</h3><ul>${t.strengths.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
        <div class="box bad"><h3>약점</h3><ul>${t.weaknesses.map(s => `<li>${esc(s)}</li>`).join('')}</ul></div>
      </div>
      <div style="margin-top:16px"><b>어울리는 일</b><div class="jobs">${t.jobs.map(j => `<span>${esc(j)}</span>`).join('')}</div></div>
      <div class="today-box"><b>오늘날 이런 사람</b>${esc(t.today)}</div>
    </section>

    ${adSlot()}

    <section class="card" aria-labelledby="h-saju">
      <h2 id="h-saju">사주 오행 분포</h2>
      <p class="sub">${pf.birth.replace(/-/g, '.')} · ${S.zodiac}띠${pf.hour !== '' && pf.hour !== undefined && pf.hour !== null ? ' · ' + HOURS[pf.hour].split(' ')[0] : ''} · 양력 기준</p>
      <div class="pillars" style="--n:${S.pillars.length}">${S.pillars.map((p, i) => `
        <div class="pillar ${i === 2 ? 'me' : ''}"><div class="pl">${p.label}${i === 2 ? ' (나)' : ''}</div>
          <div class="ch" style="background:${ELEMENTS[STEM_EL[p.stem]].color}">${STEMS[p.stem]}<small>${STEMS_K[p.stem]} · ${ELEMENTS[STEM_EL[p.stem]].h}</small></div>
          <div class="ch" style="background:${ELEMENTS[BRANCH_EL[p.branch]].color};opacity:.88">${BRANCHES[p.branch]}<small>${BRANCHES_K[p.branch]} · ${ELEMENTS[BRANCH_EL[p.branch]].h}</small></div></div>`).join('')}</div>
      <div class="el-bars">${dist.map(d => `<div class="el-row"><b style="color:${ELEMENTS[d.k].color}">${ELEMENTS[d.k].h}<small style="font-size:12px;color:var(--muted);font-family:var(--sans)"> ${ELEMENTS[d.k].k}</small></b><div class="el-track"><i data-w="${Math.max(3, d.p)}" style="background:${ELEMENTS[d.k].color}"></i></div><span>${d.v}개</span></div>`).join('')}</div>
      <p class="saju-note">나를 뜻하는 일간은 <b>${STEMS[S.dayMaster]}(${STEMS_K[S.dayMaster]}) · ${dm.name}의 기운</b>. ${ELEMENTS[strongEl.k].name}(${ELEMENTS[strongEl.k].h})이 가장 강하고 ${S.count[weakEl.k] === 0 ? `${ELEMENTS[weakEl.k].name}(${ELEMENTS[weakEl.k].h})이 비어 있어요. ${ELEMENTS[weakEl.k].lucky} 계열 소품이 부족한 기운을 채워 줘요.` : `${ELEMENTS[weakEl.k].name}(${ELEMENTS[weakEl.k].h})이 가장 약해요.`}</p>
    </section>

    <section class="card" aria-labelledby="h-tree">
      <h2 id="h-tree">${esc(pf.surname)}씨 상상 가계도</h2>
      <p class="sub">나에게서 뿌리를 따라 내려가 보세요</p>
      ${treeSVG(res, tree, name)}
      <div class="chips" style="justify-content:center;margin:10px 0 0">${tree.near.slice(0, 2).map(n => `<span class="chip" style="cursor:default">${n.side} · ${TYPES[n.id].name}의 <b>&nbsp;${esc(n.gift)}</b></span>`).join('')}</div>
      <div class="deep">${tree.deep.map(a => `
        <div class="anc">${emblemSVG(a.id, 46, 'aria-hidden="true"')}<div>
          <div class="era">${esc(a.era)}</div>
          <div class="who">${esc(a.rel)} · ${esc(a.role)}<small>${TYPES[a.id].name}의 피</small></div>
          <p>${esc(a.line)}.</p></div></div>`).join('')}</div>
      ${clan ? `<div class="clan"><h3>${esc(clan.title)} 이야기</h3><p>${esc(clan.text)}</p>${clan.known ? '<small>널리 전해지는 이야기를 바탕으로 한 짧은 소개예요.</small>' : ''}</div>` : ''}
      <p class="tree-note">입력값으로 만든 재미로 보는 상상 계보예요. 실제 족보 기록이 아닙니다.</p>
    </section>

    <section class="card" aria-labelledby="h-era">
      <h2 id="h-era">시대별 나의 인생</h2>
      <p class="sub">그 시대에 태어났다면 ${esc(name)}님은…</p>
      <div class="tabs" role="tablist">${eras.map((e, i) => `<button class="tab" role="tab" id="tab-${i}" aria-selected="${i === 2}" aria-controls="era-panel" data-action="era" data-i="${i}">${e.tab}</button>`).join('')}</div>
      <div id="era-panel" role="tabpanel"></div>
      <div class="era-dots" aria-hidden="true">${eras.map((e, i) => `<i class="${i === 2 ? 'on' : ''}"></i>`).join('')}</div>
      <button class="btn btn-ghost btn-block btn-sm" style="margin-top:12px" data-action="era-next">다음 시대로 →</button>
    </section>

    ${adSlot()}

    <section class="card share-card-sec" aria-labelledby="h-share">
      <h2 id="h-share">내 근본 카드</h2>
      <p class="sub">저장해서 스토리에 올리고 친구 근본도 물어보세요</p>
      <img class="share-preview" id="share-preview" alt="${esc(name)}님의 근본 카드: ${t.name}형, ${esc(blendTxt)}">
      <div class="btn-row"><button class="btn btn-primary btn-sm" data-action="save-card">이미지 저장</button><button class="btn btn-dark btn-sm" data-action="share">공유하기</button></div>
    </section>

    ${adSlot()}

    <section class="card" id="compat" aria-labelledby="h-cmp">
      <h2 id="h-cmp">근본 궁합</h2>
      <p class="sub">오행 상생·상극 + 근본 성향 + 띠 궁합으로 계산해요</p>
      ${invHtml}
      <div class="match-list">
        ${t.best.map(id => `<button class="match" data-action="type" data-id="${id}">${emblemSVG(id, 50, 'aria-hidden="true"')}<div><b>${TYPES[id].name}형</b><small>${esc(TYPES[id].tagline)}</small></div><span class="badge good">찰떡</span></button>`).join('')}
        <button class="match" data-action="type" data-id="${t.worst}">${emblemSVG(t.worst, 50, 'aria-hidden="true"')}<div><b>${TYPES[t.worst].name}형</b><small>${esc(TYPES[t.worst].tagline)}</small></div><span class="badge bad">티격태격</span></button>
      </div>
      <div class="invite-box">
        <h3>💌 친구에게 궁합 신청하기</h3>
        <p>링크를 받은 친구가 테스트를 마치면 두 사람의 궁합이 자동으로 나와요. 링크엔 이름과 유형만 담겨요.</p>
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

    <section class="card" id="dex-sec" aria-labelledby="h-dex"></section>

    <div class="retry">
      <button class="btn btn-ghost" data-action="retry">다시 테스트하기</button>
      <button class="skip" data-action="reset">내 정보 지우기</button>
    </div>
  </div>
  <div class="sticky" id="sticky"><div class="sticky-in"><button class="btn btn-primary" data-action="share">내 근본 공유하기</button><button class="btn btn-dark" data-action="goto-compat">궁합 보기</button></div></div>`;

  renderEra(2);
  renderHistory();
  renderDex();
  requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]', app).forEach(el => { el.style.width = el.dataset.w + '%'; })));
  $('#friend-form').addEventListener('submit', onFriendSubmit);
  pushAds(app);
  setupSticky();
  window.scrollTo(0, 0);
  if (invHtml) setTimeout(() => $('#compat')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), fresh ? 900 : 300);
  // lazy share-card preview
  const prev = $('#share-preview');
  const io = new IntersectionObserver(ents => { if (ents.some(e => e.isIntersecting)) { io.disconnect(); getCard().then(b => { if (b && prev) prev.src = URL.createObjectURL(b); }).catch(() => {}); } }, { rootMargin: '400px' });
  io.observe(prev);
}

function treeSVG(res, tree, name) {
  const halo = 'paint-order="stroke" stroke="#fffbf2" stroke-width="4" stroke-linejoin="round"';
  const node = (x, y, r, id, l1, l2, me) => `
    <g>${me ? `<circle cx="${x}" cy="${y}" r="${r + 6}" fill="#fffbf2" stroke="#b8332a" stroke-width="2" stroke-dasharray="3 3"/>` : ''}
      <g transform="translate(${x - r} ${y - r}) scale(${(2 * r) / 100})">${emblemInner(id)}</g>
      <text x="${x}" y="${y + r + 16}" text-anchor="middle" font-size="12.5" font-weight="800" fill="#1b2333" ${halo}>${esc(l1)}</text>
      <text x="${x}" y="${y + r + 30}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#81796a" ${halo}>${esc(l2)}</text></g>`;
  const root = (x1, y1, x2, y2, w) => `<path d="M${x1} ${y1} C ${x1} ${(y1 + y2) / 2 + 6}, ${x2} ${(y1 + y2) / 2 - 6}, ${x2} ${y2}" fill="none" stroke="#8a6a43" stroke-width="${w}" stroke-linecap="round" opacity=".75"/>`;
  const N = tree.near;
  const by = R.pf.birth.slice(0, 4);
  const gp = [46, 136, 224, 314];
  return `<svg class="tree-svg" viewBox="0 0 360 350" role="img" aria-label="나, 부모, 조부모로 이어지는 상상 가계도">
    <path d="M180 100 V 350" stroke="#8a6a43" stroke-width="5" opacity=".2" stroke-linecap="round"/>
    ${root(180, 100, 92, 126, 5)}${root(180, 100, 268, 126, 5)}
    ${root(92, 212, 46, 243, 3.5)}${root(92, 212, 136, 243, 3.5)}${root(268, 212, 224, 243, 3.5)}${root(268, 212, 314, 243, 3.5)}
    ${root(136, 316, 180, 348, 2.5)}${root(224, 316, 180, 348, 2.5)}${root(46, 316, 172, 348, 2)}${root(314, 316, 188, 348, 2)}
    ${node(180, 36, 28, res.typeId, `나 · ${name}`, `${by}년생 · ${TYPES[res.typeId].name}`, true)}
    ${node(92, 151, 25, N[0].id, N[0].rel, `${N[0].era} · ${TYPES[N[0].id].name}`)}
    ${node(268, 151, 25, N[1].id, N[1].rel, `${N[1].era} · ${TYPES[N[1].id].name}`)}
    ${gp.map((x, i) => node(x, 264, 21, N[2 + i].id, N[2 + i].rel, TYPES[N[2 + i].id].name)).join('')}
  </svg>`;
}

function renderEra(i) {
  if (!R) return;
  const e = R.eras[i];
  $('#era-panel').innerHTML = `
    <div class="era-card">${emblemSVG(e.id, 76, 'aria-hidden="true"')}<div>
      <div class="era-y">${e.name} · ${e.year}</div>
      <div class="era-h">${e.key === 'future' ? '2100년에 태어났다면' : `${e.name}에 태어났다면`}, 너는 <span style="color:var(--red)">${esc(e.role)}</span>${e.key === 'now' ? josa(e.role, '이야', '야') : josa(e.role, '이었다', '였다')}.</div>
      <p>${esc(e.story)}</p></div></div>
    <div class="fate">${esc(e.fate)}</div>`;
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
    ${label ? `<div style="font-size:12.5px;color:#f2c46a;font-weight:800;margin-bottom:8px">${label}</div>` : ''}
    <div class="cmp-top">
      <div class="cmp-p">${emblemSVG(a.typeId, 64, 'aria-hidden="true"')}<b>${esc(aName)}</b><small>${ta.name}형</small></div>
      <div class="ring"><svg viewBox="0 0 96 96" aria-hidden="true"><circle cx="48" cy="48" r="42" fill="none" stroke="rgba(255,255,255,.12)" stroke-width="8"/><circle cx="48" cy="48" r="42" fill="none" stroke="#f2c46a" stroke-width="8" stroke-linecap="round" stroke-dasharray="${circ}" stroke-dashoffset="${circ * (1 - c.total / 100)}"/></svg><span>${c.total}<small>${verdict}</small></span></div>
      <div class="cmp-p">${emblemSVG(b.typeId, 64, 'aria-hidden="true"')}<b>${esc(bName)}</b><small>${tb.name}형${estimated ? '(추정)' : ''}</small></div>
    </div>
    <div class="cmp-rows">
      <div class="cmp-row"><div class="t"><span>오행 궁합 ${ELEMENTS[a.el].h}·${ELEMENTS[b.el].h}</span><span>${c.elScore}</span></div><div class="bar"><i style="width:${c.elScore}%"></i></div><p>${esc(c.elText)}</p></div>
      <div class="cmp-row"><div class="t"><span>근본 성향 궁합</span><span>${c.ty}</span></div><div class="bar"><i style="width:${c.ty}%"></i></div><p>${ta.best.includes(b.typeId) ? '서로의 빈 곳을 채우는 찰떡 조합' : ta.worst === b.typeId ? '정반대라 부딪히지만, 배울 것도 가장 많은 조합' : a.typeId === b.typeId ? '거울을 보는 듯한 같은 근본' : '다른 듯 닮은, 균형 잡힌 조합'}</p></div>
      <div class="cmp-row"><div class="t"><span>띠 궁합</span><span>${c.brScore}</span></div><div class="bar"><i style="width:${c.brScore}%"></i></div><p>${esc(c.brText)}</p></div>
    </div>
    <p class="cmp-story">${esc(compatStory(aName, a, bName, b, c.total))}</p>
    ${estimated ? `<p class="cmp-est">상대 유형은 사주만으로 추정했어요. 궁합 링크로 테스트하면 더 정확해져요.</p>` : ''}
  </div>`;
}

function onFriendSubmit(e) {
  e.preventDefault();
  const n = $('#fr-name').value.trim().slice(0, 10);
  const y = $('#fr-y').value, m = $('#fr-m').value, d = $('#fr-d').value;
  const err = $('#fr-err');
  if (n.length < 1) { err.textContent = '상대 이름을 입력해 주세요.'; return; }
  if (!validDate(y, m, d)) { err.textContent = '생년월일을 다시 확인해 주세요.'; return; }
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
  if (!before.has(est.typeId) && est.typeId !== R.res.typeId) toast(`도감에 ${TYPES[est.typeId].name}형이 새로 등록됐어요!`);
}

function renderHistory() {
  const dex = getDex(); const el = $('#history'); if (!el) return;
  if (!dex.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="history"><b style="font-size:14px;margin-top:6px">지난 궁합</b>${dex.slice(0, 6).map((x, i) => `<button data-action="hist" data-i="${i}">${emblemSVG(x.t, 32, 'aria-hidden="true"')}<span>${esc(x.n)} · ${TYPES[x.t].name}형</span><span class="sc">${x.s}</span></button>`).join('')}</div>`;
}

function renderDex() {
  const sec = $('#dex-sec'); if (!sec || !R) return;
  const dex = getDex();
  const owned = new Map(); dex.forEach(x => { if (!owned.has(x.t)) owned.set(x.t, x.n); });
  const mine = R.res.typeId;
  const count = new Set([mine, ...owned.keys()]).size;
  sec.innerHTML = `
    <h2 id="h-dex">친구들의 근본 도감</h2>
    <p class="sub">궁합을 볼 때마다 친구의 근본 카드가 열려요</p>
    <div class="dex-progress"><span>${count} / 16</span><div class="prog"><i style="width:${(count / 16) * 100}%"></i></div><span>${count === 16 ? '완성!' : '수집 중'}</span></div>
    <div class="dex">${TYPES.map((t, i) => {
      const isMine = i === mine, got = isMine || owned.has(i);
      return `<button class="${got ? '' : 'locked'} ${isMine ? 'mine' : ''}" data-action="dex" data-id="${i}" aria-label="${got ? t.name + '형' : '잠긴 카드'}">${got ? emblemSVG(i, 52, 'aria-hidden="true"') : lockedSVG(52)}<b>${got ? t.name : '???'}</b><small style="font-size:10.5px">${isMine ? '나' : got ? esc(owned.get(i)) : ''}</small></button>`;
    }).join('')}</div>`;
}

/* ---------- share ---------- */
async function getCard() {
  if (R.cardBlob) return R.cardBlob;
  R.cardBlob = await makeShareCard({ name: R.pf.name, result: R.res, url: BASE });
  return R.cardBlob;
}
function shareText() {
  const t = R.t; const bl = R.res.blend.map(b => `${TYPES[b.id].name} ${b.pct}%`).join(' · ');
  return `내 근본은 ${t.name}형(${t.hanja})! 내 안에 흐르는 피: ${bl}. 너의 근본은? 우리 궁합도 봐 줘 👉`;
}
async function doShare() {
  const url = inviteUrl(R.pf.name, R.res.typeId);
  openShareSheet(url);
}
function openShareSheet(url) {
  sheet.innerHTML = `
    <button class="sheet-x" data-action="close" aria-label="닫기">×</button>
    <h2 id="modal-title">내 근본 공유하기</h2>
    <img class="share-preview" id="sheet-preview" alt="공유 카드 미리보기">
    <div class="share-actions">
      <button class="btn btn-primary btn-block" data-action="share-native">공유하기</button>
      <div class="btn-row"><button class="btn btn-dark btn-sm" data-action="save-card">이미지 저장</button><button class="btn btn-ghost btn-sm" data-action="invite-copy">링크 복사</button></div>
      <p class="hint" style="text-align:center">링크로 들어온 친구가 테스트하면 우리 궁합이 자동으로 나와요</p>
    </div>`;
  openModal();
  getCard().then(b => { const im = $('#sheet-preview'); if (im && b) im.src = URL.createObjectURL(b); }).catch(() => {});
  sheet.dataset.url = url;
}
async function nativeShare() {
  const url = inviteUrl(R.pf.name, R.res.typeId);
  try {
    const blob = await getCard();
    const file = new File([blob], `근본-${R.t.name}형.png`, { type: 'image/png' });
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
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `근본-${R.t.name}형.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('카드 이미지를 저장했어요');
  } catch { toast('이미지를 만들지 못했어요'); }
}
async function inviteShare() {
  const url = inviteUrl(R.pf.name, R.res.typeId);
  const text = `${R.pf.name}님이 근본 궁합을 신청했어요! 테스트하면 우리 궁합이 바로 나와요 💌`;
  if (navigator.share) { try { await navigator.share({ title: '근본 궁합 신청', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
  if (await copyText(`${text} ${url}`)) toast('궁합 링크를 복사했어요');
}

/* ---------- modal ---------- */
let lastFocus = null;
function openModal() { lastFocus = document.activeElement; modal.classList.add('open'); setTimeout(() => $('.sheet-x', sheet)?.focus(), 30); }
function closeModal() { modal.classList.remove('open'); sheet.innerHTML = ''; lastFocus?.focus?.(); }
function openTypeModal(id, mode) {
  const t = TYPES[id]; const code = codeOf(id);
  const unlocked = mode !== 'locked';
  sheet.innerHTML = `
    <button class="sheet-x" data-action="close" aria-label="닫기">×</button>
    <div class="type-modal-head">${unlocked ? emblemSVG(id, 84, 'aria-hidden="true"') : lockedSVG(84)}<div>
      <div style="font-size:12.5px;font-weight:800;color:var(--red)">${code.map(c => c.h).join('·')} · ${ELEMENTS[t.el].h}</div>
      <h2 id="modal-title" style="margin:2px 0 2px">${unlocked ? `${t.name}형 <small style="color:var(--muted);font-size:15px">${t.hanja}</small>` : '아직 못 만난 근본'}</h2>
      <div style="color:var(--ink-2);font-size:14.5px">${unlocked ? esc(t.tagline) : `${code.map(c => c.d).join(' · ')}의 기질을 가진 근본`}</div></div></div>
    ${unlocked ? `<div class="kw" style="justify-content:flex-start">${t.keywords.map(k => `<span>${esc(k)}</span>`).join('')}</div>
      ${mode === 'preview' ? `<p class="desc" style="margin-top:14px;font-size:15.5px">${esc(t.title)}. 이 피가 내 안에 몇 % 흐르는지는 테스트로 확인해 보세요.</p>
        <button class="btn btn-primary btn-block" style="margin-top:16px" data-action="start">내 근본 찾기 →</button>` :
      `<p class="desc" style="margin-top:14px;font-size:15.5px">${esc(t.desc)}</p>
        <div class="today-box"><b>오늘날 이런 사람</b>${esc(t.today)}</div>
        <p style="font-size:14px;margin:14px 0 0"><b>잘 맞는 근본</b> ${t.best.map(b => TYPES[b].name + '형').join(', ')} · <b>티격태격</b> ${TYPES[t.worst].name}형</p>`}` :
      `<p class="desc" style="margin-top:12px;font-size:15px">이 근본을 가진 친구와 궁합을 보면 카드가 열려요. 궁합 링크를 보내 보세요!</p>
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
    case 'home': renderLanding(); break;
    case 'show-result': renderResult(); break;
    case 'back': if (state.step > 0) { state.step--; renderStep(); } else renderLanding(); break;
    case 'next': next(); break;
    case 'bon': pf.bongwan = el.dataset.v; $('#f-bon').value = el.dataset.v; $$('.chip', app).forEach(c => c.classList.toggle('sel', c === el)); setTimeout(next, 180); break;
    case 'skip-bon': pf.bongwan = ''; state.step++; renderStep(); break;
    case 'gender': case 'region': case 'answer': {
      $$('.opt', app).forEach(o => o.classList.toggle('sel', o === el));
      if (a === 'gender') pf.gender = el.dataset.v;
      if (a === 'region') pf.region = el.dataset.v;
      if (a === 'answer') state.answers[+STEPS[state.step].slice(1)] = +el.dataset.v;
      $$('.opt', app).forEach(o => { o.disabled = true; });
      setTimeout(next, 200); break;
    }
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
    case 'invite-share': inviteShare(); break;
    case 'invite-copy': copyText(inviteUrl(R.pf.name, R.res.typeId)).then(ok => toast(ok ? '궁합 링크를 복사했어요' : '복사하지 못했어요')); break;
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
      if (confirm('저장된 결과와 궁합 기록을 모두 지울까요?')) { ['result', 'dex', 'streak', 'invite'].forEach(k => store.del(k)); R = null; state.profile = { name: '', surname: '', bongwan: '', birth: '', hour: '', gender: '', region: '' }; renderLanding(); }
      break;
    case 'close': closeModal(); break;
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
  if (modal.classList.contains('open') && e.key === 'Tab') {
    const f = $$('button, a[href], input, select', sheet).filter(x => !x.disabled);
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  }
});

/* ---------- boot ---------- */
if (store.get('result')) renderResult(); else renderLanding();
