// 식구궁합 — UI
import { computeSaju, engine } from './saju-adapter.js';
import { STEMS, STEMS_K, BRANCHES, STEM_EL, BRANCH_EL, EL_COLOR, EL_INK, EL_K, EL_H, ELS, ZODIAC, pillarH, josa } from './ganji.js';
import { allPairs, familyBalance, familyRoles, familySanhe, EL_TRAITS, ROLE_RULES, W, LACK_RATIO, REL_NAME, LIUHE, SANHE, XING, PO, HAI, SELF_XING, STEM_HAP } from './relations.js';
import { renderGraph } from './graph.js';
import { RELS, encodeBoard, decodeBoard } from './codec.js';
import * as store from './store.js';
import { festivalNear } from './festival.js';

const MAX = 8;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');
const uid = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let board = { title: '우리 가족', people: [] };
let editingId = null;
let cal = 'solar';
let model = null; // 마지막 계산 결과

/* ── 계산 ─────────────────────────────────────────── */
function compute(p) {
  const [h, mi] = p.time ? p.time.split(':').map(Number) : [null, null];
  try {
    return { saju: computeSaju(p.y, p.m, p.d, h, mi, { lunar: p.cal === 'lunar', leap: p.leap }), error: null };
  } catch (e) {
    return { saju: null, error: e.message || '계산할 수 없는 날짜예요.' };
  }
}
function buildModel() {
  const all = board.people.map(p => ({ ...p, ...compute(p) }));
  const ok = all.filter(p => p.saju);
  const pairs = ok.length >= 2 ? allPairs(ok) : [];
  const avg = pairs.length ? Math.round(pairs.reduce((s, p) => s + p.score, 0) / pairs.length) : 0;
  return {
    title: board.title, all, people: ok, pairs, avg,
    balance: ok.length ? familyBalance(ok) : null,
    roles: ok.length >= 2 ? familyRoles(ok) : [],
    sanhe: ok.length >= 3 ? familySanhe(ok) : [],
  };
}

/* ── 저장 ─────────────────────────────────────────── */
function persist() { store.saveCurrent(board); }
function commit() { persist(); render(); }

/* ── 렌더 ─────────────────────────────────────────── */
function render() {
  model = buildModel();
  renderPeople();
  renderBoard();
  renderBalance();
  renderRoles();
  renderSaju();
  renderSaved();
  const ready = model.people.length >= 2;
  for (const id of ['#balance-panel', '#roles-panel', '#saju-panel', '#share-panel']) $(id).hidden = !ready;
  if (model.people.length === 1) $('#saju-panel').hidden = false;
  // 결과 광고는 결과가 나온 뒤(2명 이상)에만 보임. 요청은 공용 common/ads.js가 보일 때 한 번만 (docs/ads-plan.md)
  for (const n of ['1', '2']) document.querySelector(`.jl-ad[data-ad="${n}"]`).hidden = !ready;
  mountAds();
}

const dateText = p => `${p.cal === 'lunar' ? '음력 ' : ''}${p.y}.${pad(p.m)}.${pad(p.d)}${p.leap ? ' 윤달' : ''}${p.time ? ' ' + p.time : ''}`;

function renderPeople() {
  const ul = $('#people');
  ul.replaceChildren();
  model.all.forEach((p, idx) => {
    const li = document.createElement('li');
    li.className = 'person' + (p.id === editingId ? ' is-editing' : '');
    li.dataset.id = p.id;
    const e = p.saju ? STEM_EL[p.saju.day.stem] : null;
    li.innerHTML = `
      <button class="handle" type="button" aria-label="${esc(p.name)} 순서 바꾸기 (위·아래 화살표)" title="끌어서 순서 변경">
        <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true" fill="currentColor"><circle cx="4" cy="3" r="1.6"/><circle cx="10" cy="3" r="1.6"/><circle cx="4" cy="9" r="1.6"/><circle cx="10" cy="9" r="1.6"/><circle cx="4" cy="15" r="1.6"/><circle cx="10" cy="15" r="1.6"/></svg>
      </button>
      <span class="dot" style="background:${e ? EL_COLOR[e] : 'var(--paper-2)'};color:${e ? EL_INK[e] : 'var(--muted)'}" aria-hidden="true">${p.saju ? STEMS[p.saju.day.stem] : '?'}</span>
      <span class="p-main"><b>${esc(p.name)} <small>${esc(p.rel)}</small></b>
        <small>${p.error ? `<span class="bad">${esc(p.error)}</span>` : `${esc(dateText(p))} · ${ZODIAC[p.saju.year.branch]}띠`}</small></span>
      <span class="p-act">
        <button class="icon-btn" type="button" data-edit aria-label="${esc(p.name)} 수정"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4"/></svg></button>
        <button class="icon-btn" type="button" data-del aria-label="${esc(p.name)} 삭제"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button>
      </span>`;
    li.querySelector('[data-edit]').addEventListener('click', () => startEdit(p.id));
    li.querySelector('[data-del]').addEventListener('click', () => removePerson(p.id));
    setupDrag(li.querySelector('.handle'), li, idx);
    ul.appendChild(li);
  });
  const n = board.people.length;
  $('#count').textContent = `${n}/${MAX}`;
  $('#empty-hint').hidden = n > 0;
  const full = n >= MAX && !editingId;
  $('#f-submit').disabled = full;
  $('#form-title').textContent = editingId ? `${board.people.find(p => p.id === editingId)?.name || ''} 수정` : full ? '최대 8명까지예요' : '사람 추가';
  $('#demo-btn').hidden = n > 0;
}

function renderBoard() {
  const { people, pairs } = model;
  $('#board-name').textContent = board.title || '우리 가족';
  const ready = people.length >= 2;
  $('#graph').toggleAttribute('hidden', !ready);
  $('#board-empty').hidden = ready;
  $('#tap-hint').hidden = !ready;
  $('#avg').textContent = ready ? `평균 궁합 ${model.avg}점` : '';
  const list = $('#pair-list');
  list.replaceChildren();
  if (!ready) return;
  renderGraph($('#graph'), people, pairs, openPair);
  const order = pairs.map((p, k) => k).sort((a, b) => pairs[b].score - pairs[a].score);
  order.forEach((k, rank) => {
    const p = pairs[k];
    const li = document.createElement('li');
    const tag = pairs.length > 2 && rank === 0 ? '<span class="rank-tag best">찰떡 1위</span>' : pairs.length > 2 && rank === order.length - 1 ? '<span class="rank-tag worst">티격태격 1위</span>' : '';
    li.innerHTML = `<button class="pair-btn" type="button"><span class="names">${tag}${esc(people[p.i].name)} × ${esc(people[p.j].name)}</span><span class="hl">${p.headline} · ${elPair(people[p.i], people[p.j])}</span><span class="sc ${p.tone}">${p.score}</span></button>`;
    li.querySelector('button').addEventListener('click', () => openPair(k));
    list.appendChild(li);
  });
}
const elPair = (a, b) => `${EL_K[STEM_EL[a.saju.day.stem]]}·${EL_K[STEM_EL[b.saju.day.stem]]}`;

function renderBalance() {
  const b = model.balance;
  if (!b || model.people.length < 2) return;
  const seg = (counts, total, labels) => ELS.map(e => {
    const w = total ? (counts[e] / total) * 100 : 0;
    return w ? `<div class="e-${e}" style="width:${w.toFixed(2)}%" title="${EL_K[e]} ${counts[e]}">${labels && w >= 9 ? `${EL_H[e]} ${Math.round(w)}%` : ''}</div>` : '';
  }).join('');
  const rows = model.people.map((p, i) => {
    const c = b.per[i]; const t = ELS.reduce((s, e) => s + c[e], 0);
    return `<div class="bal-row"><span class="nm">${esc(p.name)}</span><div class="stack" aria-hidden="true">${seg(c, t)}</div><span class="n">${t}</span></div>`;
  }).join('');
  const desc = ELS.map(e => `${EL_K[e]} ${b.total[e]}자(${Math.round(b.ratio[e] * 100)}%)`).join(', ');
  $('#balance').innerHTML = `
    <div class="stack" role="img" aria-label="가족 오행 합계: ${desc}">${seg(b.total, b.sum, true)}</div>
    <ul class="bal-legend">${ELS.map(e => `<li><i class="e-${e}"></i>${EL_K[e]}(${EL_H[e]}) <b>${b.total[e]}</b></li>`).join('')}</ul>
    <div class="bal-rows" aria-label="사람별 오행">${rows}</div>`;
  const lack = b.lack;
  const T = EL_TRAITS;
  $('#lack').innerHTML = `
    <h3>${b.relative ? '가장 적은 기운' : '가족에게 부족한 기운'}</h3>
    <div class="tag">${lack.map(e => `<span><i class="e-${e}" style="display:inline-block"></i> ${EL_K[e]}(${EL_H[e]})</span>`).join(' ')}</div>
    ${lack.map(e => `<p><b>${EL_K[e]}(${EL_H[e]}) = ${T[e].word}</b> · 전통적으로 ${T[e].season}, ${T[e].color}, ${T[e].dir}과 연결돼요. 재미로 채워 보기: ${T[e].tip}.</p>`).join('')}
    <p>${b.relative ? `모든 오행이 ${Math.round(LACK_RATIO * 100)}% 이상이라 꽤 고른 편이에요.` : `가족 전체 글자 중 ${Math.round(LACK_RATIO * 100)}% 미만인 오행이에요.`} 가장 많은 기운은 <b>${EL_K[b.strong]}(${EL_H[b.strong]})</b>.</p>`;
  $('#sanhe').innerHTML = model.sanhe.map(s => `<p class="sanhe-note"><span class="mk" aria-hidden="true">三合</span><span><b>가족 삼합 완성!</b> ${s.who.map(i => esc(model.people[i].name)).join('·')}의 ${s.label}가 ${s.branches.map(x => BRANCHES[x]).join('')} ${EL_K[s.el]}(${EL_H[s.el]})국을 이뤄요 — 셋이 뭉치면 한 팀.</span></p>`).join('');
}

function renderRoles() {
  if (model.people.length < 2) return;
  $('#roles').innerHTML = model.roles.map(r => `
    <div class="role">
      <span class="ic" aria-hidden="true">${r.icon}</span>
      <span class="rn">${r.name}</span>
      <span class="who">${r.who === null ? '해당 없음' : esc(model.people[r.who].name)}</span>
      <span class="why">${r.who === null ? '조건을 만족하는 사람이 없어요' : esc(r.why || '')}</span>
      <span class="rule">${r.rule}</span>
    </div>`).join('');
}

function renderSaju() {
  const list = model.all.filter(p => p.saju);
  $('#saju-cards').innerHTML = list.map(p => {
    const s = p.saju;
    const cells = [['년주', s.year], ['월주', s.month], ['일주', s.day], ['시주', s.hour]].map(([l, pl]) => pl ? `
      <div class="pillar"><div class="pl">${l}</div>
        <div class="ch" style="background:${EL_COLOR[STEM_EL[pl.stem]]};color:${EL_INK[STEM_EL[pl.stem]]}">${STEMS[pl.stem]}</div>
        <div class="ch" style="background:${EL_COLOR[BRANCH_EL[pl.branch]]};color:${EL_INK[BRANCH_EL[pl.branch]]}">${BRANCHES[pl.branch]}</div></div>`
      : `<div class="pillar none"><div class="pl">${l}</div><div class="ch">시 모름</div><div class="ch">—</div></div>`).join('');
    const e = STEM_EL[s.day.stem];
    const lunarNote = p.cal === 'lunar' ? ` → 양력 ${s.solar.y}.${pad(s.solar.m)}.${pad(s.solar.d)}` : '';
    return `<article class="saju-card" aria-label="${esc(p.name)}의 사주">
      <header><span class="dot" style="background:${EL_COLOR[e]};color:${EL_INK[e]}" aria-hidden="true">${STEMS[s.day.stem]}</span>
        <span><b>${esc(p.name)}</b><small>${esc(dateText(p))}${lunarNote}</small></span></header>
      <div class="pillars" role="img" aria-label="${[s.year, s.month, s.day, s.hour].filter(Boolean).map(pillarH).join(' ')}">${cells}</div>
      <p class="saju-meta">일간 <b>${STEMS[s.day.stem]}${EL_H[e]} (${STEMS_K[s.day.stem]}${EL_K[e]})</b> · ${ZODIAC[s.year.branch]}띠 (${BRANCHES[s.year.branch]})</p>
      ${s.warning ? `<p class="saju-meta" style="color:var(--muted)">${esc(s.warning)}</p>` : ''}
    </article>`;
  }).join('');
}

/* ── 쌍 상세 ──────────────────────────────────────── */
let pairOrder = [];
let pairPos = 0;
function openPair(k) {
  const pairs = model.pairs;
  pairOrder = pairs.map((p, i) => i).sort((a, b) => pairs[b].score - pairs[a].score);
  pairPos = pairOrder.indexOf(k);
  showPair();
  const d = $('#pair-sheet');
  if (!d.open) { try { d.showModal(); } catch { d.setAttribute('open', ''); } }
}
function showPair() {
  const p = model.pairs[pairOrder[pairPos]];
  const A = model.people[p.i], B = model.people[p.j];
  const dot = x => { const e = STEM_EL[x.saju.day.stem]; return `<span class="dot" style="background:${EL_COLOR[e]};color:${EL_INK[e]}" aria-hidden="true">${STEMS[x.saju.day.stem]}</span>`; };
  const items = p.items.map(it => `<li><span class="g">${it.group}</span><div class="row"><span>${it.label}</span><span class="pts ${it.pts >= 0 ? 'p' : 'm'}">${it.pts > 0 ? '+' : ''}${it.pts}</span></div><p>${esc(it.text)}</p></li>`).join('');
  const sum = p.items.reduce((s, i) => s + i.pts, 0);
  const advice = { good: '서로 기운을 살려 주는 사이. 같이 뭔가 해 보세요.', mid: '특별히 끌리지도 부딪히지도 않는 무난한 사이예요.', bad: '부딪힐 일이 많은 구도. 서로 다름을 인정하면 오히려 자극이 돼요.' }[p.tone];
  $('#pair-body').innerHTML = `
    <div class="pd-head">${dot(A)}<b id="pair-title">${esc(A.name)}</b><span class="vs">×</span>${dot(B)}<b>${esc(B.name)}</b></div>
    <div class="pd-score"><span class="num sc ${p.tone}">${p.score}</span><span class="hl">${p.headline}</span></div>
    <div class="meter" aria-hidden="true"><b class="${p.tone}" style="width:${p.score}%"></b></div>
    <p style="margin:0 0 12px;color:var(--ink-2);font-size:14.5px">${advice}</p>
    <ul class="pd-items">${items}</ul>
    <p class="pd-sum">기본 ${W.base}점 ${sum >= 0 ? '+' : '−'} ${Math.abs(sum)}점 = ${p.raw}점${p.raw !== p.score ? ` → ${W.clamp[0]}~${W.clamp[1]} 범위로 맞춰 ${p.score}점` : ''}</p>
    <div class="pd-nav">
      <button class="btn btn-ghost" type="button" data-nav="-1" ${pairPos === 0 ? 'disabled' : ''}>← 더 높은 궁합</button>
      <button class="btn btn-ghost" type="button" data-nav="1" ${pairPos === pairOrder.length - 1 ? 'disabled' : ''}>더 낮은 궁합 →</button>
    </div>`;
  $('#pair-body').querySelectorAll('[data-nav]').forEach(b => b.addEventListener('click', () => { pairPos += +b.dataset.nav; showPair(); }));
}
function setupSheet() {
  const d = $('#pair-sheet');
  d.addEventListener('click', e => { if (e.target === d || e.target.closest('[data-close]')) d.close(); });
}

/* ── 입력 폼 ──────────────────────────────────────── */
function setupForm() {
  const sel = $('#f-rel');
  sel.innerHTML = RELS.map(r => `<option>${r}</option>`).join('');
  const date = $('#f-date');
  date.addEventListener('input', () => {
    const d = date.value.replace(/\D/g, '').slice(0, 8);
    date.value = d.length > 6 ? `${d.slice(0, 4)}.${d.slice(4, 6)}.${d.slice(6)}` : d.length > 4 ? `${d.slice(0, 4)}.${d.slice(4)}` : d;
    date.removeAttribute('aria-invalid');
    $('#f-err').textContent = '';
  });
  if (!engine.lunar) $('#cal-seg').hidden = true;
  $('#cal-seg').addEventListener('click', e => {
    const b = e.target.closest('[data-cal]'); if (!b) return;
    setCal(b.dataset.cal);
  });
  $('#cal-seg').addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); setCal(cal === 'solar' ? 'lunar' : 'solar');
    $(`#cal-seg [data-cal="${cal}"]`).focus();
  });
  $('#time-clear').addEventListener('click', () => { $('#f-time').value = ''; });
  $('#person-form').addEventListener('submit', e => { e.preventDefault(); submitPerson(); });
  $('#f-cancel').addEventListener('click', resetForm);
  $('#board-title').addEventListener('input', e => { board.title = e.target.value.trim() || '우리 가족'; persist(); $('#board-name').textContent = board.title; });
  $('#demo-btn').addEventListener('click', loadDemo);
  defaultRel();
}
function setCal(c) {
  cal = c;
  $('#cal-seg').querySelectorAll('[data-cal]').forEach(b => { b.setAttribute('aria-checked', String(b.dataset.cal === c)); b.tabIndex = b.dataset.cal === c ? 0 : -1; });
  $('#leap-wrap').hidden = c !== 'lunar';
  if (c !== 'lunar') $('#f-leap').checked = false;
}
function defaultRel() {
  const used = new Set(board.people.map(p => p.rel));
  $('#f-rel').value = ['나', '엄마', '아빠', '배우자'].find(r => !used.has(r)) || '형제자매';
}
function parseDate(v) {
  const d = v.replace(/\D/g, '');
  let y, m, dd;
  if (d.length === 8) { y = +d.slice(0, 4); m = +d.slice(4, 6); dd = +d.slice(6); }
  else if (d.length === 6) { // YYMMDD
    const yy = +d.slice(0, 2); const now = new Date().getFullYear() % 100;
    y = (yy > now ? 1900 : 2000) + yy; m = +d.slice(2, 4); dd = +d.slice(4);
  } else return null;
  return { y, m, d: dd };
}
function fail(msg, el) {
  $('#f-err').textContent = msg;
  if (el) { el.setAttribute('aria-invalid', 'true'); el.focus(); }
}
function submitPerson() {
  const nameEl = $('#f-name'), dateEl = $('#f-date');
  const rel = $('#f-rel').value;
  let name = nameEl.value.trim();
  const dt = parseDate(dateEl.value);
  if (!dt) return fail('생년월일 8자리를 입력해 주세요. 예) 19900517', dateEl);
  const time = $('#f-time').value || '';
  const person = { id: editingId || uid(), name, rel, ...dt, cal, leap: cal === 'lunar' && $('#f-leap').checked, time };
  const thisYear = new Date().getFullYear();
  if (dt.y > thisYear) return fail('미래 날짜는 넣을 수 없어요.', dateEl);
  const r = compute(person);
  if (r.error) return fail(r.error, dateEl);
  if (!name) {
    name = rel === '기타' ? '식구' : rel;
    const others = board.people.filter(p => p.id !== editingId).map(p => p.name);
    if (others.includes(name)) { let k = 2; while (others.includes(name + k)) k++; name += k; }
  }
  person.name = name;
  if (editingId) {
    const i = board.people.findIndex(p => p.id === editingId);
    board.people[i] = person;
    toast(`${name} 정보를 고쳤어요`);
  } else {
    if (board.people.length >= MAX) return fail('최대 8명까지 넣을 수 있어요.');
    board.people.push(person);
    if (board.people.length === 2) setTimeout(() => $('#board-h').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }
  resetForm(true);
  commit();
}
function resetForm(keepFocus) {
  editingId = null;
  $('#person-form').reset();
  $('#person-form').classList.remove('editing');
  $('#f-err').textContent = '';
  $('#f-submit').textContent = '추가하기';
  $('#f-cancel').hidden = true;
  setCal('solar');
  defaultRel();
  renderPeople();
  if (keepFocus === true && board.people.length < MAX) $('#f-name').focus({ preventScroll: true });
}
function startEdit(id) {
  const p = board.people.find(x => x.id === id); if (!p) return;
  editingId = id;
  $('#f-name').value = p.name;
  $('#f-rel').value = RELS.includes(p.rel) ? p.rel : '기타';
  $('#f-date').value = `${p.y}.${pad(p.m)}.${pad(p.d)}`;
  setCal(p.cal === 'lunar' && engine.lunar ? 'lunar' : 'solar');
  $('#f-leap').checked = !!p.leap;
  $('#f-time').value = p.time || '';
  $('#f-submit').textContent = '저장';
  $('#f-cancel').hidden = false;
  $('#person-form').classList.add('editing');
  renderPeople();
  $('#person-form').scrollIntoView({ behavior: 'smooth', block: 'center' });
  $('#f-name').focus({ preventScroll: true });
}
function removePerson(id) {
  const i = board.people.findIndex(p => p.id === id); if (i < 0) return;
  const [gone] = board.people.splice(i, 1);
  if (editingId === id) resetForm();
  commit();
  toast(`${josa(gone.name, '을', '를')} 뺐어요`, '되돌리기', () => { board.people.splice(Math.min(i, board.people.length), 0, gone); commit(); });
}

/* ── 순서 바꾸기 (포인터 드래그 + 키보드) ─────────── */
function setupDrag(handle, li, idx) {
  handle.addEventListener('keydown', e => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const to = idx + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= board.people.length) return;
    const [p] = board.people.splice(idx, 1); board.people.splice(to, 0, p);
    commit();
    document.querySelector(`.person[data-id="${p.id}"] .handle`)?.focus();
  });
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault();
    li.classList.add('dragging');
    const list = li.parentElement;
    // 노드를 DOM에서 옮기면 pointer capture가 풀리므로 window에서 추적
    const move = ev => {
      if (ev.pointerId !== e.pointerId) return;
      ev.preventDefault();
      const sibs = [...list.children].filter(x => x !== li);
      for (const s of sibs) {
        const r = s.getBoundingClientRect(), mid = r.top + r.height / 2;
        const before = li.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_PRECEDING;
        if (before && ev.clientY < mid) { list.insertBefore(li, s); break; }
        if (!before && ev.clientY > mid && s === li.nextElementSibling) { list.insertBefore(li, s.nextElementSibling); break; }
      }
    };
    const up = ev => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      li.classList.remove('dragging');
      const ids = [...list.children].map(x => x.dataset.id);
      const before = board.people.map(p => p.id).join();
      if (ids.join() !== before) {
        board.people.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        commit();
      }
    };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  });
}

/* ── 예시 ─────────────────────────────────────────── */
const DEMO = [
  { name: '아빠', rel: '아빠', y: 1962, m: 9, d: 14, cal: 'solar', leap: false, time: '' },
  { name: '엄마', rel: '엄마', y: 1965, m: 3, d: 2, cal: 'solar', leap: false, time: '06:30' },
  { name: '나', rel: '나', y: 1992, m: 7, d: 21, cal: 'solar', leap: false, time: '14:10' },
  { name: '동생', rel: '형제자매', y: 1996, m: 12, d: 5, cal: 'solar', leap: false, time: '' },
];
/* 첫 화면: 오행 오각형 위에 예시 가족 4명 + 관계선 (실제 계산값) */
function renderHero() {
  const svg = $('#hero-svg'); if (!svg) return;
  const people = DEMO.map(p => ({ ...p, ...compute(p) })).filter(p => p.saju);
  if (people.length < 2) return;
  const pairs = allPairs(people);
  const cx = 170, cy = 158, R = 118;
  const V = {}; ELS.forEach((e, i) => { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; V[e] = { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), a }; });
  // 같은 오행끼리는 꼭짓점 양옆으로 벌려 놓기
  const byEl = {}; people.forEach((p, i) => { const e = STEM_EL[p.saju.day.stem]; (byEl[e] = byEl[e] || []).push(i); });
  const pos = [];
  Object.entries(byEl).forEach(([e, ids]) => ids.forEach((i, k) => {
    const off = (k - (ids.length - 1) / 2) * 52; const v = V[e];
    pos[i] = { x: v.x - Math.sin(v.a) * off, y: v.y + Math.cos(v.a) * off };
  }));
  const tone = { good: 'var(--good)', mid: 'var(--mid)', bad: 'var(--bad)' };
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pent = ELS.map(e => `${V[e].x.toFixed(1)},${V[e].y.toFixed(1)}`).join(' ');
  const lab = ELS.map(e => { const v = V[e]; const lx = cx + (R + 30) * Math.cos(v.a), ly = cy + (R + 30) * Math.sin(v.a); return `<text class="hb-el" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${EL_H[e]}</text>`; }).join('');
  const order = pairs.map((p, k) => k).sort((a, b) => pairs[b].score - pairs[a].score);
  const lines = order.map((k, n) => { const p = pairs[k]; const a = pos[p.i], b = pos[p.j];
    return `<line class="hb-line" x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${tone[p.tone]}" stroke-width="${(1.8 + Math.min(4, Math.abs(p.score - 50) / 9)).toFixed(1)}" stroke-linecap="round" pathLength="1" ${p.tone === 'mid' ? 'stroke-dasharray=".02 .02"' : `style="--d:${n * 90}ms"`}/>`; }).join('');
  const best = pairs[order[0]];
  const bm = { x: (pos[best.i].x + pos[best.j].x) / 2, y: (pos[best.i].y + pos[best.j].y) / 2 };
  const nodes = people.map((p, i) => { const e = STEM_EL[p.saju.day.stem]; const { x, y } = pos[i];
    return `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="21" fill="${EL_COLOR[e]}" stroke="var(--bg)" stroke-width="3"/><text text-anchor="middle" dominant-baseline="central" fill="${EL_INK[e]}" class="hb-stem">${STEMS[p.saju.day.stem]}</text><text class="hb-name" y="36" text-anchor="middle">${esc(p.name)}</text></g>`; }).join('');
  const dots = ELS.map(e => `<circle cx="${V[e].x.toFixed(1)}" cy="${V[e].y.toFixed(1)}" r="4" fill="${EL_COLOR[e]}"/>`).join('');
  svg.innerHTML = `<polygon points="${pent}" fill="none" class="hb-pent"/>${dots}${lab}<g class="hb-lines${reduce ? '' : ' draw'}">${lines}</g>
    <g transform="translate(${bm.x.toFixed(1)} ${bm.y.toFixed(1)})"><rect x="-17" y="-11" width="34" height="22" rx="11" class="hb-badge" stroke="var(--good)"/><text text-anchor="middle" dominant-baseline="central" class="hb-score" fill="var(--good)">${best.score}</text></g>${nodes}`;
  $('#hero-cap').textContent = `예시 · 아빠·엄마·나·동생 — ${josa(people[best.i].name, '과', '와')} ${josa(people[best.j].name, '이', '가')} ${best.score}점으로 가장 잘 맞아요`;
}

function loadDemo() {
  board = {
    title: '우리 가족',
    people: [
      { name: '아빠', rel: '아빠', y: 1962, m: 9, d: 14, cal: 'solar', leap: false, time: '' },
      { name: '엄마', rel: '엄마', y: 1965, m: 3, d: 2, cal: 'solar', leap: false, time: '06:30' },
      { name: '나', rel: '나', y: 1992, m: 7, d: 21, cal: 'solar', leap: false, time: '14:10' },
      { name: '동생', rel: '형제자매', y: 1996, m: 12, d: 5, cal: 'solar', leap: false, time: '' },
      { name: '할머니', rel: '할머니', y: 1938, m: 1, d: 23, cal: 'solar', leap: false, time: '' },
    ].map(p => ({ ...p, id: uid() })),
  };
  $('#board-title').value = board.title;
  defaultRel();
  commit();
  toast('예시 가족을 넣었어요. 이름·날짜는 마음대로 바꿔 보세요');
}

/* ── 공유 ─────────────────────────────────────────── */
function shareUrl() {
  return `${location.origin}${location.pathname}#${encodeBoard(board)}`;
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* fallthrough */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch { return false; }
}
async function shareLink() {
  const url = shareUrl();
  const text = `${board.title} 오행 궁합판 — 누가 중재자고 누가 분위기메이커일까?`;
  if (navigator.share) {
    try { await navigator.share({ title: '식구궁합', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  await copyLink(url);
}
async function copyLink(url = shareUrl()) {
  if (await copyText(url)) toast('링크를 복사했어요. 단톡방에 붙여 넣으세요');
  else window.prompt('아래 링크를 복사하세요', url);
}
async function makeImage() {
  const { drawShareImage, canvasToBlob } = await import('./share-image.js');
  const cv = await drawShareImage(model);
  return canvasToBlob(cv);
}
async function shareImage() {
  const btn = $('#share-img'); btn.disabled = true;
  try {
    const blob = await makeImage();
    const file = new File([blob], 'sikgu-gunghap.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '식구궁합' }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    download(blob);
    toast('이미지를 저장했어요. 생년월일은 들어 있지 않아요');
  } catch (e) {
    console.warn(e); toast('이미지를 만들지 못했어요');
  } finally { btn.disabled = false; }
}
async function downloadImage() {
  try { download(await makeImage()); toast('이미지를 저장했어요'); } catch { toast('이미지를 만들지 못했어요'); }
}
function download(blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `식구궁합-${(board.title || '우리가족').replace(/\s+/g, '')}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function setupShare() {
  $('#share-link').addEventListener('click', shareLink);
  $('#copy-link').addEventListener('click', () => copyLink());
  $('#share-img').addEventListener('click', shareImage);
  $('#dl-img').addEventListener('click', downloadImage);
  $('#save-board').addEventListener('click', () => {
    const id = store.saveBoard(board);
    if (id) { board.savedId = id; persist(); renderSaved(); toast('이 기기에 저장했어요'); } else toast('저장할 수 없는 환경이에요 (사생활 보호 모드?)');
  });
}

/* ── 저장한 보드 ──────────────────────────────────── */
function renderSaved() {
  const boards = store.listBoards();
  $('#saved-wrap').hidden = !boards.length;
  const ul = $('#saved');
  ul.replaceChildren();
  boards.forEach(b => {
    const li = document.createElement('li');
    const d = new Date(b.at);
    li.innerHTML = `<span><b>${esc(b.title)}</b><small>${b.people.length}명 · ${esc(b.people.map(p => p.name).join(', ')).slice(0, 40)} · ${d.getMonth() + 1}/${d.getDate()}</small></span>
      <button class="chip-btn" type="button" data-load>불러오기</button><button class="icon-btn" type="button" data-del aria-label="${esc(b.title)} 삭제"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/></svg></button>`;
    li.querySelector('[data-load]').addEventListener('click', () => {
      board = { title: b.title, people: b.people.map(p => ({ ...p })), savedId: b.id };
      $('#board-title').value = board.title; resetForm(); commit();
      $('#board-h').scrollIntoView({ behavior: 'smooth' });
      toast(`'${b.title}' 보드를 불러왔어요`);
    });
    li.querySelector('[data-del]').addEventListener('click', () => { store.deleteBoard(b.id); renderSaved(); toast('삭제했어요'); });
    ul.appendChild(li);
  });
}

/* ── 계산 방법 ────────────────────────────────────── */
function renderHow() {
  const row = (k, v) => `<tr><td>${k}</td><td class="num ${v >= 0 ? 'p' : 'm'}">${v > 0 ? '+' : ''}${v}</td></tr>`;
  const B = BRANCHES;
  const pairs = list => list.map(r => B[r[0]] + B[r[1]]).join(' · ');
  const keys = ['liuhe', 'sanhe', 'same', 'chong', 'xing', 'self', 'po', 'hai'];
  const src = { 'roots-v2': '근본 테스트 사주 엔진 — 절입 시각을 태양 황경으로 직접 계산, 역사적 한국 표준시·서머타임과 동경 127.5° 보정(약 −30분) 반영, 자시(23:30) 시작에 날짜 변경.', 'roots-v1': '근본 테스트 사주 엔진(평균 절입일 근사).', fallback: '내장 근사 계산(평균 절입일). 근본 테스트 엔진을 불러오지 못했어요.' }[engine.source];
  $('#how-body').innerHTML = `
    <h3>1. 사람마다 사주 기둥</h3>
    <p>${src}${engine.lunar ? ` 음력은 ${engine.lunarRange[0]}~${engine.lunarRange[1]}년(한국천문연구원 음력)을 양력으로 바꿔 계산해요.` : ''} 시를 모르면 년·월·일 3기둥만 써요. 띠는 설날이 아니라 <b>입춘</b> 기준 년주 지지예요(1~2월생은 다를 수 있어요).</p>
    <h3>2. 두 사람 점수 = 기본 ${W.base}점 + 아래 항목 합계 (${W.clamp[0]}~${W.clamp[1]}점으로 제한)</h3>
    <div class="tbl-scroll"><table class="wtable">
      <tr><th>일간 오행 (태어난 날의 천간)</th><th></th></tr>
      ${row('상생 (예: 木生火, 방향 무관)', W.stem.gen)}${row('같은 오행', W.stem.same)}${row('상극 (예: 金剋木, 방향 무관)', W.stem.ctrl)}${row('천간합 (甲己·乙庚·丙辛·丁壬·戊癸)', W.stemHap)}
    </table></div>
    <div class="tbl-scroll"><table class="wtable">
      <tr><th>지지 관계</th><th style="text-align:right">일지끼리</th><th style="text-align:right">띠(년지)끼리</th></tr>
      ${keys.map(k => `<tr><td>${REL_NAME[k]}</td><td class="num ${W.day[k] >= 0 ? 'p' : 'm'}">${W.day[k] > 0 ? '+' : ''}${W.day[k]}</td><td class="num ${W.year[k] >= 0 ? 'p' : 'm'}">${W.year[k] > 0 ? '+' : ''}${W.year[k]}</td></tr>`).join('')}
    </table></div>
    <p>한 쌍에 관계가 여러 개면 모두 더해요(예: 巳申 = 육합 + 형 + 파). 선 색: ${W.band.good}점 이상 초록, ${W.band.bad}점 이하 빨강, 그 사이 회색. 굵기는 50점에서 멀수록 굵어요.</p>
    <h3>3. 쓰는 표</h3>
    <ul>
      <li>상생: 木→火→土→金→水→木 · 상극: 木剋土, 土剋水, 水剋火, 火剋金, 金剋木</li>
      <li>천간합: ${STEM_HAP.map(([a, b]) => STEMS[a] + STEMS[b]).join(' · ')}</li>
      <li>육합: ${pairs(LIUHE)} (午未합의 오행은 문헌마다 火/土로 갈려요)</li>
      <li>삼합: ${SANHE.map(g => g.slice(0, 3).map(i => B[i]).join('') + ' ' + EL_K[g[3]]).join(' · ')} — 두 글자만 만나도 반합으로 셈</li>
      <li>충: 子午 · 丑未 · 寅申 · 卯酉 · 辰戌 · 巳亥</li>
      <li>형: 寅巳申(무은지형) · 丑戌未(지세지형) · 子卯(무례지형) · 자형 ${SELF_XING.map(i => B[i] + B[i]).join(' ')}</li>
      <li>파: ${pairs(PO)} · 해: ${pairs(HAI)}</li>
    </ul>
    <h3>4. 오행 밸런스</h3>
    <p>각자 기둥의 천간·지지 글자(3기둥이면 6자, 4기둥이면 8자)를 오행별로 세어 그냥 더해요. 지장간은 넣지 않아요. 가족 전체의 ${Math.round(LACK_RATIO * 100)}% 미만이면 "부족한 기운", 없으면 가장 적은 오행을 보여 줘요.</p>
    <h3>5. 가족 역할</h3>
    <ul>${ROLE_RULES.map(r => `<li><b>${r.name}</b>: ${r.rule}</li>`).join('')}</ul>
    <p>점수가 같으면 역할을 덜 맡은 사람, 그다음 목록 순서로 정해요. 조건을 만족하는 사람이 없으면 "해당 없음".</p>
    <p class="sub">자세한 출처는 <a href="sources.html">출처 전체 보기</a>.</p>`;
}

/* ── 공유받은 링크 ────────────────────────────────── */
function importFromHash() {
  const shared = decodeBoard(location.hash);
  if (!location.hash.includes('g=')) return false;
  history.replaceState(null, '', location.pathname + location.search);
  if (!shared) { toast('링크를 읽을 수 없었어요'); return false; }
  const cur = store.loadCurrent();
  const sig = b => JSON.stringify((b?.people || []).map(p => [p.name, p.y, p.m, p.d, p.cal, p.leap, p.time]));
  if (cur && cur.people?.length && sig(cur) !== sig(shared)) {
    store.saveBoard({ ...cur, title: cur.title || '이전 보드', savedId: cur.savedId });
  }
  board = shared;
  persist();
  $('#shared-note').hidden = false;
  $('#shared-note').innerHTML = `<div class="note"><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="6" width="17" height="12" rx="2"/><path d="M4.5 7.5l7.5 5.5 7.5-5.5"/></svg><span><b>공유받은 궁합판이에요.</b> 내 정보도 넣어 보세요${cur && cur.people?.length ? ' (원래 보드는 "저장한 보드"에 보관했어요)' : ''}.</span></div>`;
  return true;
}

/* ── 기타 ─────────────────────────────────────────── */
let toastTimer;
function toast(msg, actionLabel, action) {
  const t = $('#toast');
  t.innerHTML = `${esc(msg)}${actionLabel ? ` <button type="button" class="link-btn" style="color:inherit;margin-left:8px">${esc(actionLabel)}</button>` : ''}`;
  t.style.pointerEvents = actionLabel ? 'auto' : 'none';
  if (actionLabel) t.querySelector('button').addEventListener('click', () => { action(); t.classList.remove('on'); }, { once: true });
  t.classList.add('on');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), actionLabel ? 5000 : 2600);
}

/* 광고: 공용 common/ads.js (모든 서비스 같은 방식). 새 칸만 한 번씩 요청해요. */
const AD_INS = multi => `<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" ${multi ? 'data-ad-format="autorelaxed"' : 'data-ad-format="auto" data-full-width-responsive="true"'}></ins>`;
function mountAds() { if (window.JLAds) window.JLAds.mount(document.getElementById('main')); }
/** 공유 링크로 새 보드가 열리면 = 새 화면 → 광고 칸을 새로 만들어 요청 (같은 칸 재요청 금지) */
function freshAds() {
  document.querySelectorAll('#main .jl-ad').forEach(a => {
    a.classList.remove('jl-ad--empty');
    a.innerHTML = `<small>광고</small>${AD_INS(a.classList.contains('jl-ad--multiplex'))}`;
  });
}

function setupFestival() {
  const q = new URLSearchParams(location.search).get('today');
  const today = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? new Date(+q.slice(0, 4), +q.slice(5, 7) - 1, +q.slice(8)) : new Date();
  const f = festivalNear(today);
  if (!f) return;
  const when = f.dday > 0 ? `${f.name}까지 D-${f.dday}` : f.dday === 0 ? `오늘은 ${f.name}!` : `${f.name} 연휴`;
  const el = $('#festival');
  el.innerHTML = `<div class="festival-in"><span class="moon" aria-hidden="true">${f.kind === 'chuseok' ? '月' : '春'}</span><span><b>명절 모드 · ${when}</b> — 모인 김에 식구 궁합판 한 장, 단톡방에 던져 보세요.</span></div>`;
  el.hidden = false;
  document.body.classList.add('festive');
}

function init() {
  const fromLink = importFromHash();
  if (!fromLink) {
    const cur = store.loadCurrent();
    if (cur && Array.isArray(cur.people)) {
      board = { title: cur.title || '우리 가족', savedId: cur.savedId, people: cur.people.filter(p => p && p.id && Number.isFinite(p.y)).slice(0, MAX) };
    }
  }
  $('#board-title').value = board.title;
  setupForm(); setupShare(); setupSheet(); setupFestival(); renderHow(); renderHero();
  $('#hero-start').addEventListener('click', () => {
    $('#table').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    $('#f-name').focus({ preventScroll: true });
  });
  $('#hero-demo').addEventListener('click', () => { loadDemo(); $('#board-panel').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  const en = $('#engine-note'); if (en) en.textContent = { 'roots-v2': '사주 계산: 근본 테스트 엔진 (절입 시각·한국 표준시 이력 반영)', 'roots-v1': '사주 계산: 근본 테스트 엔진 (평균 절입일 근사)', fallback: '사주 계산: 내장 근사식 (평균 절입일)' }[engine.source];
  render();
  window.addEventListener('hashchange', () => { if (importFromHash()) { $('#board-title').value = board.title; resetForm(); freshAds(); commit(); } });
}
init();
