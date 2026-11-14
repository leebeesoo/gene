/* 이름레이더 — UI */
(function () {
  'use strict';
  const NR = window.NR;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const NOW_YEAR = new Date().getFullYear();
  const GN = { m: '남', f: '여' };
  const FRIENDS = ['김민준', '이서연', '박지훈', '최영숙', '정하윤', '강도윤', '조서아', '윤현우', '장지혜', '김영수', '한이준', '오수진'];
  const STORE = 'nr.recent.v1';

  /* ---------- 숫자 표기 ---------- */
  const comma = n => Math.round(n).toLocaleString('ko-KR');
  function approx(n) {
    if (n < 1) return '1명 미만';
    if (n < 20) return comma(n) + '명';
    if (n < 100) return comma(Math.round(n / 5) * 5) + '명';
    if (n < 1000) return comma(Math.round(n / 10) * 10) + '명';
    if (n < 9950) return comma(Math.round(n / 100) * 100) + '명';
    const man = n / 10000;
    return (man < 100 ? man.toFixed(1).replace(/\.0$/, '') : comma(man)) + '만 명';
  }
  const approxNum = n => (n < 1 ? '0' : approx(n).replace(/ ?명$/, ''));
  const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';

  /* ---------- 저장소 (실패해도 동작) ---------- */
  function loadRecent() {
    try { const v = JSON.parse(localStorage.getItem(STORE) || '[]'); return Array.isArray(v) ? v.slice(0, 8) : []; } catch (e) { return []; }
  }
  function saveRecent(list) { try { localStorage.setItem(STORE, JSON.stringify(list.slice(0, 8))); } catch (e) { /* 저장 불가 환경 */ } }
  function clearRecent() { try { localStorage.removeItem(STORE); } catch (e) { /* noop */ } }

  /* ---------- 광고 (공용 ../common/ads.js) ---------- */
  // 결과를 새로 그릴 때마다 새 광고 칸을 만들고, 그린 뒤 JLAds.mount로 새 칸만 요청한다
  const AD_HTML = '<aside class="jl-ad" aria-label="광고"><small>광고</small><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>';
  const mountAds = root => { if (window.JLAds) window.JLAds.mount(root); };

  /* ---------- 토스트 ---------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400);
  }

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        const ok = document.execCommand('copy'); ta.remove(); return ok;
      } catch (e2) { return false; }
    }
  }

  /* ---------- 폼 ---------- */
  const form = $('#form'), inName = $('#inName'), inYear = $('#inYear'), inHanja = $('#inHanja'), errEl = $('#formErr');
  const getGender = () => (form.querySelector('input[name=g]:checked') || {}).value || '';
  const setGender = g => { const el = $('#g' + ({ m: 'M', f: 'F' }[g] || 'N')); if (el) el.checked = true; };
  function showErr(msg) { errEl.textContent = msg; errEl.hidden = !msg; if (msg) inName.setAttribute('aria-invalid', 'true'); else inName.removeAttribute('aria-invalid'); }

  form.addEventListener('submit', e => {
    e.preventDefault();
    run({ raw: inName.value, year: inYear.value, g: getGender(), hanja: inHanja.value }, true);
  });

  let lastSur = '김';
  let current = null;

  function parseYear(v) {
    const y = parseInt(v, 10);
    if (!v && v !== 0) return { y: null };
    if (!y) return { y: null };
    if (y < 1925 || y > NOW_YEAR) return { error: '출생연도는 1925~' + NOW_YEAR + ' 사이로 입력해 주세요.' };
    return { y };
  }

  function run(input, scroll) {
    const sp = NR.splitName(input.raw);
    if (sp.error) { showErr(sp.error); inName.focus(); return; }
    const py = parseYear(String(input.year || '').trim());
    if (py.error) { showErr(py.error); inYear.focus(); return; }
    showErr('');
    const g = input.g === 'm' || input.g === 'f' ? input.g : '';
    const state = { raw: String(input.raw).trim(), sur: sp.sur, given: sp.given, full: sp.full, year: py.y, g, hanja: String(input.hanja || '').trim() };
    // 폼 동기화
    inName.value = state.raw; inYear.value = state.year || ''; setGender(g); inHanja.value = state.hanja;
    if (state.hanja) $('.hanja-opt').open = true;
    lastSur = sp.sur;
    render(state);
    updateLive();
    // 최근 검색
    const rec = loadRecent().filter(r => r.raw !== state.raw);
    rec.unshift({ raw: state.raw, g, y: state.year || '' });
    saveRecent(rec); renderRecent();
    // 주소 갱신 (공유용)
    try {
      const q = new URLSearchParams({ n: state.raw });
      if (g) q.set('g', g);
      if (state.year) q.set('y', state.year);
      history.replaceState(null, '', '?' + q.toString());
    } catch (e) { /* noop */ }
    if (scroll) {
      const r = $('#result');
      r.scrollIntoView({ behavior: 'smooth', block: 'start' });
      r.focus({ preventScroll: true });
    }
  }

  /* ---------- 최근 검색 ---------- */
  function renderRecent() {
    const list = loadRecent(), box = $('#recent');
    box.hidden = !list.length;
    $('#recentList').innerHTML = list.map(r => `<button type="button" class="chip" data-raw="${esc(r.raw)}" data-g="${esc(r.g || '')}" data-y="${esc(r.y || '')}">${esc(r.raw.replace(/\s/g, ''))}${r.y ? ` <small>${esc(r.y)}</small>` : ''}</button>`).join('');
  }
  $('#recentList').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    run({ raw: b.dataset.raw, g: b.dataset.g, year: b.dataset.y, hanja: '' }, true);
  });
  $('#recentClear').addEventListener('click', () => { clearRecent(); renderRecent(); toast('최근 검색을 지웠어요'); });

  /* ---------- 결과 ---------- */
  function render(st) {
    const res = NR.analyzeName(st.given, st.g);
    const sur = NR.surnameInfo(st.sur);
    const a = res.main;
    const same = res.total * sur.share;
    const sameLo = res.lo * sur.share, sameHi = res.hi * sur.share;
    const sy = st.year ? NR.sameYear(res, st.year) : null;
    current = { st, res, sur, same };

    const gLabel = res.genderGiven ? GN[res.gender] : (res.unisex ? '남녀 모두' : GN[res.gender] + '(추정)');
    const peak = a.peak;
    let peakV, peakD;
    if (peak && peak.type === 'year') {
      peakV = peak.y + '년'; peakD = `그해 태어난 ${GN[res.gender]}아 중 비율이 가장 높았던 해 · 그해 ${peak.rank}위, ${comma(peak.count)}명${peak.partial ? ' (잠정)' : ''}`;
    } else if (peak) {
      peakV = peak.y + '년 무렵'; peakD = `출생아 중 비율이 가장 높았던 시기 · 그해 인기 이름 ${peak.rank}위 (시대별 TOP 10 목록)`;
    } else { peakV = '기록 없음'; peakD = '연도별 100위·시대별 10위 밖의 개성 있는 이름이에요'; }
    const avg = a.avgYear ? Math.round(a.avgYear) : null;
    const bestYr = a.bestRank ? a.years.find(p => p.rank === a.bestRank) : null;
    const age = avg ? Math.max(0, NOW_YEAR - avg) : null;

    const surStat = sur.known
      ? `<div class="stat"><span class="k">${esc(sur.h)}씨 전국 순위</span><span class="v">${sur.rank}<small>위</small></span><span class="d">${approx(sur.pop)} · 인구의 ${pct(sur.share, sur.share < .001 ? 3 : 1)}${sur.share > .02 ? ` · ${Math.round(1 / sur.share)}명 중 1명꼴` : ''}</span><div class="meter" aria-hidden="true"><i style="width:${Math.max(2, Math.min(100, sur.share / 0.215 * 100)).toFixed(1)}%"></i></div></div>`
      : `<div class="stat"><span class="k">${esc(sur.h)}씨</span><span class="v">목록 밖</span><span class="d">2015년 조사 기준 인구 500명 미만의 드문 성씨이거나 다른 표기일 수 있어요. 희성 기준(약 300명)으로 계산했어요.</span></div>`;

    const splitAlt = st.sur.length === 2 && !st.raw.includes(' ') ? `<p class="split-hint muted">성이 ‘${esc(st.sur[0])}’인가요? <button type="button" data-split="${esc(st.sur[0] + ' ' + st.sur[1] + st.given)}">${esc(st.sur[0])} + ${esc(st.sur[1] + st.given)}(으)로 다시 보기</button></p>` : '';

    let sameLine = '';
    if (sy) {
      const n = sy.count * sur.share;
      sameLine = `<p class="r-same">${st.year}년생 ${esc(st.full)}<span class="est-badge">추정</span> <b>${approx(n)}</b>${sy.exact ? ` · 그해 ‘${esc(st.given)}’ ${sy.rank}위${sy.partial ? '(잠정)' : ''}` : ''}</p>`;
    }

    $('#result').hidden = false; // 차트 폭 계산을 위해 먼저 표시
    // 차트 카드 뒤에 붙는 카드들. 없으면 아래 광고가 차트의 「표로 보기」와 붙으니 위를 더 띄운다
    const extra = (birthYearCard(st, res) + hanjaCard(st) + syllableCard(st, res)).trim();
    const html = `
      <div class="r-hero">
        <span class="tag">${esc(gLabel)} · ${esc(st.sur)} + ${esc(st.given)}</span>
        <p class="r-name">${esc(st.full)}${st.hanja ? `<small lang="zh-Hant">${esc(st.hanja)}</small>` : ''}</p>
        <p class="r-big">전국의 ${esc(st.full)}<span class="est-badge">추정</span><b>약 ${approxNum(same)}<span class="unit">명</span></b></p>
        <p class="r-range">대략 ${approxNum(sameLo)} ~ ${approx(sameHi)} 사이로 봐요${a.listed ? '' : ' · 드문 이름이라 아주 거친 추정이에요'}</p>
        ${sameLine}
      </div>
      ${splitAlt}
      <div class="stats">
        ${surStat}
        <div class="stat accent"><span class="k">‘${esc(st.given)}’ 가장 유행한 해</span><span class="v">${esc(peakV)}</span><span class="d">${esc(peakD)}</span></div>
        <div class="stat"><span class="k">평균 출생연도 추정</span><span class="v">${avg ? avg + '<small>년생</small>' : '—'}</span><span class="d">${avg ? `지금 이 이름을 가진 사람의 평균 · 약 ${age}살` : ''}</span></div>
        <div class="stat"><span class="k">성 상관없이 ‘${esc(st.given)}’</span><span class="v">약 ${approx(res.total)}</span><span class="d">${a.bestRank ? `순위로는 ${bestYr ? bestYr.y + '년 ' : ''}${a.bestRank}위가 최고(2008년 이후) · 상위 100위에 ${a.hitYears}번 등장` : (a.hitEras ? `시대별 TOP 10에 ${a.hitEras}번 등장` : '연도별 상위 100위 기록 없음')}${res.unisex ? ' · 남녀 모두 쓰는 이름' : ''}</span></div>
      </div>
      ${AD_HTML}
      <div class="card">
        <h3>‘${esc(st.given)}’ 순위 변화</h3>
        <p class="cap">1940~1990년은 그해 인기 이름 TOP 10, 2008년부터는 출생신고 상위 100위 기준이에요. 위로 갈수록 인기가 높아요.</p>
        ${chartHTML(res)}
      </div>
      ${extra}
      ${AD_HTML.replace('jl-ad"', extra ? 'jl-ad gap-b"' : 'jl-ad gap-t gap-b"')}
      <div class="card">
        <h3>결과 공유하기</h3>
        <p class="cap">친구에게 보내고 누가 더 흔한 이름인지 겨뤄 보세요.</p>
        <div class="actions">
          <button type="button" class="btn btn-solid" id="btnShareImg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 14v5h14v-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>이미지 공유</button>
          <button type="button" class="btn btn-ghost" id="btnCopy"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>링크 복사</button>
        </div>
        <div class="card-preview" id="cardPreview"></div>
      </div>
      <div class="card">
        <h3>친구 이름도 검색</h3>
        <form class="friend-form" id="friendForm" autocomplete="off"><label class="sr" for="friendIn">친구 이름</label><input id="friendIn" type="text" maxlength="8" placeholder="친구 이름 (예: 이서연)" spellcheck="false"><button class="btn btn-solid" type="submit">검색</button></form>
        <div class="chips" id="friendChips">${FRIENDS.filter(f => f !== st.full).slice(0, 10).map(f => `<button type="button" class="chip" data-raw="${f}">${f}</button>`).join('')}</div>
      </div>
      ${howCard(st, res, sur, same)}
      ${AD_HTML.replace('jl-ad"', 'jl-ad gap-t gap-b"')}`;

    const box = $('#result');
    box.innerHTML = html;
    box.hidden = false;
    mountAds(box);
    bindResult();
  }

  function bindResult() {
    const box = $('#result');
    const sp = $('[data-split]', box);
    if (sp) sp.addEventListener('click', () => run({ raw: sp.dataset.split, year: current.st.year, g: current.st.g, hanja: current.st.hanja }, true));
    $('#btnCopy', box).addEventListener('click', async () => { toast(await copyText(shareUrl()) ? '링크를 복사했어요' : '복사하지 못했어요. 주소창의 링크를 이용해 주세요'); });
    $('#btnShareImg', box).addEventListener('click', shareImage);
    $('#friendForm', box).addEventListener('submit', e => {
      e.preventDefault();
      const v = $('#friendIn', box).value;
      run({ raw: v, year: '', g: '', hanja: '' }, true);
    });
    $('#friendChips', box).addEventListener('click', e => {
      const b = e.target.closest('.chip'); if (!b) return;
      run({ raw: b.dataset.raw, year: '', g: '', hanja: '' }, true);
    });
  }

  /* ---------- 차트 ---------- */
  function chartHTML(res) {
    const gs = res.genderGiven ? [res.gender] : ['m', 'f'].filter(g => res.by[g].listed);
    if (!gs.length) {
      return `<p class="muted" style="margin:0">연도별 상위 100위나 시대별 TOP 10에 오른 기록이 없어요. 그만큼 흔하지 않은 이름이에요.</p>`;
    }
    const box = $('#result');
    const W = Math.round(Math.max(300, Math.min(660, (box.clientWidth || 640) - 70))), H = W < 480 ? 230 : 260, L = 38, R = 10, T = 18, B = 34;
    const iw = W - L - R, ih = H - T - B - 18; // 아래 18px: 100위 밖 영역
    const xOldEnd = L + iw * 0.3, xGap = L + iw * 0.37;
    const x = y => (y <= 1990 ? L + (y - 1940) / 50 * (xOldEnd - L) : xGap + (y - 2008) / (2026 - 2008) * (L + iw - xGap));
    const yr = r => T + (Math.sqrt(r) - 1) / (Math.sqrt(100) - 1) * ih;
    const yOut = T + ih + 14;
    let s = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ariaChart(res, gs))}">`;
    s += `<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" stroke-width="1.2" opacity=".25"/></pattern></defs>`;
    s += `<g class="grid axis">`;
    for (const r of [1, 10, 30, 50, 100]) s += `<line x1="${L}" x2="${L + iw}" y1="${yr(r).toFixed(1)}" y2="${yr(r).toFixed(1)}"/><text x="${L - 6}" y="${(yr(r) + 4).toFixed(1)}" text-anchor="end">${r}위</text>`;
    s += `<text x="${L - 6}" y="${yOut + 4}" text-anchor="end" class="lbl-out">밖</text>`;
    s += `</g>`;
    s += `<rect class="zone" x="${xOldEnd + 6}" y="${T}" width="${(xGap - xOldEnd - 12).toFixed(1)}" height="${ih}" rx="6"/><rect class="gap-band" x="${xOldEnd + 6}" y="${T}" width="${(xGap - xOldEnd - 12).toFixed(1)}" height="${ih}" rx="6" style="color:var(--ink-3)"/>`;
    s += `<text class="lbl-out" x="${((xOldEnd + xGap) / 2).toFixed(1)}" y="${T + ih / 2}" text-anchor="middle" transform="rotate(-90 ${((xOldEnd + xGap) / 2).toFixed(1)} ${T + ih / 2})">자료 없음</text>`;
    s += `<g class="axis">`;
    for (const y of (W < 480 ? [1940, 1970] : [1940, 1960, 1980])) s += `<text x="${x(y).toFixed(1)}" y="${H - 10}" text-anchor="middle">${y}</text>`;
    for (const y of (W < 480 ? [2008, 2017, 2026] : [2008, 2014, 2020, 2026])) s += `<text x="${x(y).toFixed(1)}" y="${H - 10}" text-anchor="middle">${y}</text>`;
    s += `</g>`;
    for (const g of gs) {
      const a = res.by[g];
      // 시대 점
      for (const e of a.eraRanks) {
        const cy = e.rank ? yr(e.rank) : yOut;
        s += e.rank ? `<circle class="pt-era pt-${g}" cx="${x(e.k).toFixed(1)}" cy="${cy.toFixed(1)}" r="5"><title>${e.k}년 ${GN[g]} ${e.rank}위</title></circle>`
          : `<circle cx="${x(e.k).toFixed(1)}" cy="${cy}" r="2.2" fill="var(--ink-3)" opacity=".5"/>`;
      }
      // 연도 선
      let d = '', pen = false, dDash = '';
      a.years.forEach((p, i) => {
        if (p.rank == null) { pen = false; return; }
        const px = x(p.y).toFixed(1), py = yr(p.rank).toFixed(1);
        if (p.partial) {
          const prev = a.years[i - 1];
          if (prev && prev.rank != null) dDash = `M${x(prev.y).toFixed(1)} ${yr(prev.rank).toFixed(1)}L${px} ${py}`;
          return;
        }
        d += (pen ? 'L' : 'M') + px + ' ' + py; pen = true;
      });
      if (d) s += `<path class="ln ln-${g}" d="${d}"/>`;
      if (dDash) s += `<path class="ln ln-${g}" d="${dDash}" stroke-dasharray="4 4" opacity=".7"/>`;
      for (const p of a.years) {
        if (p.rank == null) { s += `<circle cx="${x(p.y).toFixed(1)}" cy="${yOut}" r="2" fill="var(--ink-3)" opacity=".45"/>`; continue; }
        s += `<circle class="pt-${g}" cx="${x(p.y).toFixed(1)}" cy="${yr(p.rank).toFixed(1)}" r="${p.partial ? 3 : 3.4}"${p.partial ? ' fill-opacity=".55"' : ''}><title>${p.y}년 ${GN[g]} ${p.rank}위 (${comma(p.count)}명)${p.partial ? ' 잠정' : ''}</title></circle>`;
      }
      // 최고 순위 라벨
      const pk = a.peak;
      if (pk && g === res.gender) {
        const px = x(pk.y), py = yr(pk.rank);
        const anchor = px > W - 90 ? 'end' : (px < L + 40 ? 'start' : 'middle');
        s += `<text class="peak-lbl" x="${px.toFixed(1)}" y="${Math.max(12, py - 10).toFixed(1)}" text-anchor="${anchor}">${pk.y}${pk.type === 'era' ? '년' : ''} ${pk.rank}위</text>`;
      }
    }
    s += `</svg>`;
    const leg = gs.map(g => `<span><i style="background:var(--${g === 'm' ? 'brand' : 'hot'})"></i>${GN[g]}자 이름 순위</span>`).join('') +
      `<span><i class="o" style="border-color:var(--ink-3)"></i>시대별 TOP 10</span><span><i style="background:var(--ink-3);opacity:.6"></i>점선: 2026년 잠정</span>`;
    return `<div class="chart-wrap">${s}</div><div class="legend">${leg}</div>${tableHTML(res, gs)}`;
  }
  function ariaChart(res, gs) {
    return gs.map(g => {
      const a = res.by[g];
      const ys = a.years.filter(y => y.rank).map(y => `${y.y}년 ${y.rank}위`).join(', ');
      const es = a.eraRanks.filter(e => e.rank).map(e => `${e.k}년 ${e.rank}위`).join(', ');
      return `${GN[g]}자 이름 ‘${res.given}’ 순위: ${[es, ys].filter(Boolean).join(', ') || '기록 없음'}`;
    }).join('. ');
  }
  function tableHTML(res, gs) {
    const rows = [];
    for (const g of gs) {
      const a = res.by[g];
      for (const e of a.eraRanks) if (e.rank) rows.push(`<tr><td>${e.k}년</td><td>${GN[g]}</td><td class="num">${e.rank}위</td><td class="num">—</td></tr>`);
      for (const y of a.years) if (y.rank) rows.push(`<tr><td>${y.y}년${y.partial ? ' (잠정)' : ''}</td><td>${GN[g]}</td><td class="num">${y.rank}위</td><td class="num">${comma(y.count)}명</td></tr>`);
    }
    return `<details class="tbl"><summary>표로 보기</summary><div class="tbl-scroll"><table><thead><tr><th>연도</th><th>성별</th><th>순위</th><th>출생신고</th></tr></thead><tbody>${rows.join('')}</tbody></table></div></details>`;
  }

  /* ---------- 출생연도 카드 ---------- */
  function birthYearCard(st, res) {
    if (!st.year) return '';
    const g = res.gender;
    const L = NR.eraListFor(st.year, g);
    if (!L) {
      return `<div class="card"><h3>${st.year}년생 ${GN[g]}자 인기 이름</h3><p class="cap" style="margin:0">1991~2007년 출생아의 연도별 이름 순위는 공개 자료로 확인하지 못해 보여 드리지 않아요.</p></div>`;
    }
    const inList = L.names.indexOf(st.given);
    return `<div class="card"><h3>${st.year}년생 무렵 ${GN[g]}자 인기 이름 TOP 10</h3>
      <p class="cap">${L.official ? `${esc(L.label)} 출생신고 기준` : `${esc(L.label)} 인기 이름 목록 기준 (민간 정리 자료)`}${inList >= 0 ? ` · ‘${esc(st.given)}’ ${inList + 1}위!` : ` · ‘${esc(st.given)}’은(는) TOP 10 밖이에요`}</p>
      <ol class="toplist">${L.names.map(n => `<li${n === st.given ? ' class="me"' : ''}>${esc(n)}</li>`).join('')}</ol></div>`;
  }

  /* ---------- 한자 카드 ---------- */
  function hanjaCard(st) {
    if (!st.hanja) return '';
    const r = NR.hanjaLookup(st.hanja, st.given);
    if (!r) return '';
    if (r.error) return `<div class="card"><h3>이름 한자</h3><p class="cap" style="margin:0">${esc(r.error)}</p></div>`;
    const cells = r.map(c => {
      if (c.status === 'ok') return `<div class="hj"><span class="c" lang="zh-Hant">${esc(c.ch)}</span><span class="h">${esc(c.hun)} ${esc(c.eum)}</span></div>`;
      if (c.status === 'mismatch') return `<div class="hj warn"><span class="c" lang="zh-Hant">${esc(c.ch)}</span><span class="h">${esc(c.hun)} ${esc(c.eum)}</span><span class="s">‘${esc(c.syl)}’와 음이 달라요</span></div>`;
      if (c.status === 'invalid') return `<div class="hj warn"><span class="c">${esc(c.ch)}</span><span class="h">한자가 아니에요</span></div>`;
      return `<div class="hj"><span class="c" lang="zh-Hant">${esc(c.ch)}</span><span class="h muted">자료 없음</span><span class="s">사전 목록에 없는 글자</span></div>`;
    }).join('');
    return `<div class="card"><h3>이름 한자 훈·음</h3><p class="cap">자주 쓰는 인명 한자의 대표 훈·음만 보여 드려요. 글자를 조합해 이름 뜻을 지어내지는 않아요.</p><div class="hanja-row">${cells}</div></div>`;
  }

  /* ---------- 글자 빈도 카드 (드문 이름) ---------- */
  function syllableCard(st, res) {
    if (res.main.listed) return '';
    const n = NR.syllableNotes(st.given, res.gender);
    if (!n) return `<div class="card"><h3>드문 이름이에요</h3><p class="cap" style="margin:0">${st.given.length === 1 ? '외자 이름' : '세 글자 이상 이름'}은 순위권 자료가 적어 아주 대략적으로만 추정했어요.</p></div>`;
    const line = (o, pos) => {
      const m = o.modern, old = o.old;
      if (!m && !old) return `<li>${pos} 글자 ‘${esc(o.ch)}’는 순위권 이름에서 거의 보이지 않아요.</li>`;
      return `<li>${pos} 글자 ‘${esc(o.ch)}’: 2008년 이후 상위 100위 ${GN[res.gender]}자 이름의 <b>${pct(m)}</b>${old ? `, 1940~90년 TOP 10의 <b>${pct(old)}</b>` : ''}에 쓰였어요.</li>`;
    };
    return `<div class="card"><h3>순위 밖의 개성 있는 이름</h3><p class="cap">글자별로 얼마나 흔한지 보고 대략적인 사람 수를 추정했어요.</p><ul class="how" style="padding-left:18px;margin:0;font-size:14px;color:var(--ink-2)">${line(n.first, '첫')}${line(n.last, '끝')}</ul></div>`;
  }

  /* ---------- 계산 설명 ---------- */
  function howCard(st, res, sur, same) {
    const g = res.gender, a = res.by[g];
    const rows = a.parts.map(p => {
      let basis;
      if (p.key === 'modern') basis = a.hitYears ? `출생신고 실제 건수 합(${a.hitYears}개 연도) + 순위 밖 해는 추정` : '글자 빈도로 추정';
      else if (p.key === 2000) basis = '1990년 목록과 2008년 비율의 평균';
      else { const e = a.eraRanks.find(x => x.k === p.key); basis = e && e.rank ? `${p.key}년 TOP 10 ${e.rank}위 → 비율 가정` : '글자 빈도로 추정'; }
      return `<tr><td>${esc(p.label)}년생</td><td>${basis}</td><td class="num">${approx(p.count)}</td></tr>`;
    }).join('');
    const other = !res.genderGiven && res.unisex ? ` (+ ${GN[g === 'm' ? 'f' : 'm']}자 약 ${approx(res.by[g === 'm' ? 'f' : 'm'].total)})` : '';
    return `<details class="card how"><summary>어떻게 계산했나요?</summary><div class="body">
      <div class="formula">동명이인 추정 = <b>${esc(st.sur)}씨 비율</b> × <b>‘${esc(st.given)}’ 이름 인구</b><br>
      = ${sur.known ? `${comma(sur.pop)} ÷ ${comma(NR.censusTotal)}` : '희성 가정 300명 ÷ 총인구'} (${pct(sur.share, 2)}) × 약 ${approx(res.total)}<br>
      ≈ <b>약 ${approx(same)}</b></div>
      <p>‘${esc(st.given)}’ 이름 인구는 출생 시기별로 나눠 더했어요. ${GN[g]}자 기준${other}:</p>
      <div class="tbl-scroll"><table><thead><tr><th>출생</th><th>근거</th><th>추정</th></tr></thead><tbody>${rows}</tbody></table></div>
      <ul>
        <li>성씨와 이름은 서로 관계없이 고른다고 가정했어요. 실제로는 돌림자·지역 차이가 있어요.</li>
        <li>2008년 이후는 대법원 출생신고 상위 100위 건수를 그대로 썼어요. 사망·개명·이민은 반영하지 않았어요.</li>
        <li>1940~1990년 목록은 건수가 없어서, 순위별 출생 비율(1위 약 1.2~2%)을 가정하고 2025년 주민등록 연령대별 인구에 곱했어요.</li>
        <li>순위에 없는 경우는 데이터 속 첫 글자·끝 글자 빈도로 추정해서 오차가 커요. 범위를 함께 보세요.</li>
        <li>출처: 통계청 2015 인구주택총조사 성씨 통계, 대법원 전자가족관계등록시스템 출생신고 이름 통계, 행정안전부 주민등록인구통계 등. <a href="sources.html">자세히</a></li>
      </ul></div></details>`;
  }

  /* ---------- 공유 ---------- */
  function shareUrl() {
    const base = location.origin + location.pathname;
    if (!current) return base;
    const q = new URLSearchParams({ n: current.st.raw });
    if (current.st.g) q.set('g', current.st.g);
    return base + '?' + q.toString();
  }

  async function makeCard() {
    const { st, res, sur, same } = current;
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const F = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
    try { await Promise.all([document.fonts.load(`700 120px ${F}`, st.full), document.fonts.load(`500 40px ${F}`, '전국의 동명이인 추정')]); } catch (e) { /* 기본 폰트 사용 */ }
    // 배경 (평면)
    const P = { bg: '#F6F7F9', surface: '#FFFFFF', ink: '#15171C', muted: '#6A6F7A', line: '#E3E5EA', accent: '#2B50D8' };
    x.fillStyle = P.bg; x.fillRect(0, 0, W, H);
    // 브랜드 (1.5px 선 아이콘 비율)
    x.save(); x.strokeStyle = P.accent; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.arc(104, 106, 24, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.arc(104, 106, 13, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(104, 106); x.lineTo(121, 89); x.stroke(); x.restore();
    x.fillStyle = P.ink; x.font = `700 40px ${F}`; x.textBaseline = 'alphabetic';
    x.fillText('이름레이더', 146, 120);
    x.font = `500 30px ${F}`; x.fillStyle = P.muted; x.fillText('내 이름, 전국에 몇 명?', 80, 190);
    // 이름
    x.fillStyle = P.ink;
    let fs = 180; x.font = `700 ${fs}px ${F}`;
    while (x.measureText(st.full).width > W - 160 && fs > 100) { fs -= 10; x.font = `700 ${fs}px ${F}`; }
    x.fillText(st.full, 76, 470);
    // 숫자
    x.strokeStyle = P.line; x.lineWidth = 2; x.beginPath(); x.moveTo(80, 560); x.lineTo(W - 80, 560); x.stroke();
    x.font = `500 40px ${F}`; x.fillStyle = P.muted;
    x.fillText('전국의 동명이인 (추정)', 80, 650);
    x.font = `700 140px ${F}`; x.fillStyle = P.accent;
    const big = '약 ' + approx(same);
    let bs = 140; while (x.measureText(big).width > W - 160 && bs > 80) { bs -= 8; x.font = `700 ${bs}px ${F}`; }
    x.fillText(big, 76, 800);
    // 통계 박스
    const a = res.main, pk = a.peak;
    const boxes = [
      ['성씨 순위', sur.known ? `${sur.h}씨 ${sur.rank}위` : `${sur.h}씨`],
      ['가장 유행', pk ? (pk.type === 'year' ? `${pk.y}년` : `${pk.y}년 무렵`) : '순위 밖'],
      ['평균 출생', a.avgYear ? `${Math.round(a.avgYear)}년생` : '—']
    ];
    const bw = (W - 160 - 40) / 3, by = 900, bh = 200;
    boxes.forEach((b, i) => {
      const bx = 80 + i * (bw + 20);
      x.fillStyle = P.surface; roundRect(x, bx, by, bw, bh, 28); x.fill();
      x.strokeStyle = P.line; x.lineWidth = 2; x.stroke();
      x.fillStyle = P.muted; x.font = `500 30px ${F}`; x.fillText(b[0], bx + 28, by + 62);
      x.fillStyle = P.ink; let f2 = 48; x.font = `700 ${f2}px ${F}`;
      while (x.measureText(b[1]).width > bw - 50 && f2 > 28) { f2 -= 3; x.font = `700 ${f2}px ${F}`; }
      x.fillText(b[1], bx + 28, by + 140);
    });
    // 바닥
    x.fillStyle = P.muted; x.font = `500 28px ${F}`;
    x.fillText('통계청·대법원 공개 통계 기반 추정치예요.', 80, 1210);
    x.fillStyle = P.ink; x.font = `700 32px ${F}`;
    x.fillText('친구 이름도 찾아보기 → ' + (location.host || '이름레이더') + location.pathname.replace(/index\.html$/, ''), 80, 1262);
    return c;
  }
  function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }

  let sharing = false;
  async function shareImage() {
    if (!current || sharing) return;
    sharing = true;
    const btn = $('#btnShareImg'); btn.disabled = true;
    try {
      const c = await makeCard();
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      const url = URL.createObjectURL(blob);
      const pv = $('#cardPreview');
      pv.innerHTML = `<img src="${url}" alt="${esc(current.st.full)} 이름레이더 결과 카드" width="1080" height="1350">`;
      pv.classList.add('on');
      const fname = `이름레이더-${current.st.full}.png`;
      const file = typeof File === 'function' ? new File([blob], fname, { type: 'image/png' }) : null;
      const text = `전국의 ${current.st.full}, 약 ${approx(current.same)} (추정) — 내 이름은 몇 명?`;
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: '이름레이더', text, url: shareUrl() }); return; }
        catch (e) { if (e && e.name === 'AbortError') return; }
      }
      const dl = document.createElement('a'); dl.href = url; dl.download = fname;
      document.body.appendChild(dl); dl.click(); dl.remove();
      const ok = await copyText(shareUrl());
      toast(ok ? '이미지를 저장하고 링크를 복사했어요' : '이미지를 저장했어요');
    } catch (e) {
      toast('이미지를 만들지 못했어요. 링크 복사를 이용해 주세요');
    } finally { sharing = false; btn.disabled = false; }
  }

  /* ---------- 신생아 TOP 10 ---------- */
  let t10g = 'f';
  const t10Year = $('#t10Year');
  for (let y = NR.YEAR_LAST; y >= NR.YEAR_FIRST; y--) {
    const o = document.createElement('option'); o.value = y; o.textContent = y + '년' + (y === NR.YEAR_PARTIAL ? ' (잠정)' : ''); t10Year.appendChild(o);
  }
  function renderTop10() {
    const y = +t10Year.value;
    const list = NR.topList(t10g, y, 10);
    const max = list[0].c;
    $('#t10Sub').textContent = y === NR.YEAR_PARTIAL
      ? `${y}년 출생신고 잠정 집계(8월 20일 기준)예요. 연말까지 순위가 바뀔 수 있어요.`
      : `${y}년 한 해 출생신고 기준이에요.`;
    $('#t10List').innerHTML = list.map(e => `<li><button type="button" data-n="${esc(e.n)}" aria-label="${e.r}위 ${esc(e.n)}, ${comma(e.c)}명. 검색하기"><span class="bar" style="width:${(e.c / max * 100).toFixed(1)}%"></span><span class="rk">${e.r}</span><span class="nm">${esc(e.n)}</span><span class="ct">${comma(e.c)}명</span></button></li>`).join('');
  }
  $$('.tabs button').forEach(b => b.addEventListener('click', () => {
    t10g = b.dataset.g;
    $$('.tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    renderTop10();
  }));
  $('.tabs').addEventListener('keydown', e => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const bs = $$('.tabs button'), i = bs.findIndex(b => b.getAttribute('aria-selected') === 'true');
    const nb = bs[(i + (e.key === 'ArrowRight' ? 1 : -1) + bs.length) % bs.length];
    nb.focus(); nb.click();
  });
  t10Year.addEventListener('change', renderTop10);
  $('#t10List').addEventListener('click', e => {
    const b = e.target.closest('button[data-n]'); if (!b) return;
    run({ raw: lastSur + b.dataset.n, year: '', g: t10g, hanja: '' }, true);
  });

  /* ---------- 시대별 대표 이름 ---------- */
  $('#eraStrip').innerHTML = NR.decadeTop.map(([d, m, f]) =>
    `<div class="era"><span class="d">${esc(d)}</span><button type="button" class="m" data-n="${esc(m)}" data-g="m"><small>남</small>${esc(m)}</button><button type="button" class="f" data-n="${esc(f)}" data-g="f"><small>여</small>${esc(f)}</button></div>`).join('');
  $('#eraStrip').addEventListener('click', e => {
    const b = e.target.closest('button[data-n]'); if (!b) return;
    run({ raw: lastSur + b.dataset.n, year: '', g: b.dataset.g, hanja: '' }, true);
  });


  /* ---------- 첫 화면: 입력 칸 옆 실시간 숫자 + 유행 막대 ---------- */
  const reduceMotion = (() => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } })();
  const EXAMPLE = '김민준';
  let liveVal = 0, liveRaf = 0, liveT = 0;
  const bigText = n => (n < 1 ? '1 미만' : '약 ' + approxNum(n));
  function rollTo(target) {
    cancelAnimationFrame(liveRaf);
    const el = $('#liveNum');
    if (reduceMotion || !isFinite(target)) { liveVal = target; el.textContent = bigText(target); return; }
    const from = liveVal, t0 = performance.now(), dur = 400;
    const tick = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      const v = from + (target - from) * e;
      el.textContent = bigText(k < 1 ? v : target);
      if (k < 1) liveRaf = requestAnimationFrame(tick); else liveVal = target;
    };
    liveRaf = requestAnimationFrame(tick);
  }
  function barsSVG(res) {
    const a = res.main, g = res.gender, pk = a.peak;
    const W = 380, H = 150, T = 22, B = 22, ih = H - T - B;
    const counts = a.years.filter(p => p.count != null);
    if (counts.length) {
      const max = Math.max(...counts.map(p => p.count));
      const n = a.years.length, gap = 4, bw = (W - gap * (n - 1)) / n;
      let s = `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`‘${res.given}’ ${GN[g]}자 이름 연도별 출생신고: ` + counts.map(p => `${p.y}년 ${comma(p.count)}명`).join(', '))}">`;
      s += `<line class="base" x1="0" x2="${W}" y1="${T + ih + .5}" y2="${T + ih + .5}"/>`;
      a.years.forEach((p, i) => {
        const x = i * (bw + gap);
        const hot = pk && pk.type === 'year' && pk.y === p.y;
        if (p.count == null) { s += `<rect class="b-out" x="${x.toFixed(1)}" y="${T + ih - 2}" width="${bw.toFixed(1)}" height="2"/>`; return; }
        const h = Math.max(3, p.count / max * ih);
        s += `<rect class="b${hot ? ' hot' : ''}${p.partial ? ' part' : ''}" x="${x.toFixed(1)}" y="${(T + ih - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${p.y}년 ${p.rank}위 · ${comma(p.count)}명${p.partial ? ' (잠정)' : ''}</title></rect>`;
        if (hot) {
          const cx = x + bw / 2, anchor = cx < 40 ? 'start' : (cx > W - 40 ? 'end' : 'middle');
          s += `<text class="b-lbl" x="${(anchor === 'start' ? x : anchor === 'end' ? x + bw : cx).toFixed(1)}" y="${(T + ih - h - 7).toFixed(1)}" text-anchor="${anchor}">${p.y}</text>`;
        }
      });
      const y0 = a.years[0].y;
      [2008, 2014, 2020, 2026].forEach(y => {
        const i = y - y0; if (i < 0 || i >= n) return;
        const x = i * (bw + gap);
        const anchor = i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle');
        const tx = anchor === 'start' ? x : anchor === 'end' ? x + bw : x + bw / 2;
        s += `<text class="b-ax" x="${tx.toFixed(1)}" y="${H - 5}" text-anchor="${anchor}">${y}</text>`;
      });
      return { svg: s + '</svg>', cap: `‘${res.given}’ 연도별 출생신고 (2008–2026, ${GN[g]}자)` };
    }
    const eras = a.eraRanks;
    if (eras.some(e => e.rank)) {
      const n = eras.length, gap = 10, bw = (W - gap * (n - 1)) / n;
      let s = `<svg class="bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`‘${res.given}’ 시대별 인기 순위: ` + eras.filter(e => e.rank).map(e => `${e.k}년 ${e.rank}위`).join(', '))}">`;
      s += `<line class="base" x1="0" x2="${W}" y1="${T + ih + .5}" y2="${T + ih + .5}"/>`;
      eras.forEach((e, i) => {
        const x = i * (bw + gap), hot = pk && pk.type === 'era' && pk.y === e.k;
        if (!e.rank) s += `<rect class="b-out" x="${x.toFixed(1)}" y="${T + ih - 2}" width="${bw.toFixed(1)}" height="2"/>`;
        else {
          const h = (11 - e.rank) / 10 * ih;
          s += `<rect class="b${hot ? ' hot' : ''}" x="${x.toFixed(1)}" y="${(T + ih - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="2"><title>${e.k}년 ${e.rank}위</title></rect>`;
          s += `<text class="b-lbl${hot ? '' : ' dim'}" x="${(x + bw / 2).toFixed(1)}" y="${(T + ih - h - 7).toFixed(1)}" text-anchor="middle">${e.rank}위</text>`;
        }
        s += `<text class="b-ax" x="${(x + bw / 2).toFixed(1)}" y="${H - 5}" text-anchor="middle">${e.k}</text>`;
      });
      return { svg: s + '</svg>', cap: `‘${res.given}’ 시대별 인기 순위 (TOP 10, ${GN[g]}자)` };
    }
    return { svg: `<div class="bars-empty">2008년 이후 상위 100위, 1940~90년 TOP 10 어디에도 없는 이름이에요. 그만큼 드물어요.</div>`, cap: `‘${res.given}’ 이름 유행` };
  }
  function updateLive() {
    const raw = inName.value.trim(), ex = !raw;
    $('#liveTag').hidden = !ex;
    $('#liveOut').classList.toggle('is-ex', ex);
    const sp = NR.splitName(ex ? EXAMPLE : raw);
    if (sp.error) {
      $('#liveName').textContent = raw;
      $('#liveSub').textContent = /^[가-힣 ]+$/.test(raw) ? '성과 이름을 함께 써 주세요 (예: 김민준)' : sp.error;
      return;
    }
    const res = NR.analyzeName(sp.given, getGender());
    const sur = NR.surnameInfo(sp.sur);
    const same = res.total * sur.share;
    $('#liveName').textContent = sp.full;
    $('#liveSub').textContent = `대략 ${approxNum(res.lo * sur.share)}~${approx(res.hi * sur.share)} 사이 · 통계로 계산한 추정치예요`;
    const b = barsSVG(res);
    $('#liveChart').innerHTML = b.svg;
    $('#peakCap').textContent = b.cap;
    const pk = res.main.peak;
    $('#peakNote').innerHTML = pk
      ? (pk.type === 'year'
        ? `가장 유행한 해 <b>${pk.y}년</b> · 그해 ${pk.rank}위, ${comma(pk.count)}명${pk.partial ? ' (잠정)' : ''}`
        : `가장 유행한 때 <b>${pk.y}년 무렵</b> · 그해 인기 이름 ${pk.rank}위`)
      : '순위권 기록이 없는 드문 이름이에요';
    rollTo(same);
  }
  inName.addEventListener('input', () => { clearTimeout(liveT); liveT = setTimeout(updateLive, 90); });
  $$('input[name=g]', form).forEach(r => r.addEventListener('change', updateLive));

  /* ---------- 시작 ---------- */
  renderTop10();
  renderRecent();
  updateLive();
  try {
    const q = new URLSearchParams(location.search);
    const n = q.get('n');
    if (n) run({ raw: n.slice(0, 10), g: q.get('g') || '', year: q.get('y') || '', hanja: '' }, false);
  } catch (e) { /* noop */ }
})();
