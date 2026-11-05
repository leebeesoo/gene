/* 이름레이더 — 추정 엔진 (순수 계산, DOM 없음) */
(function (root) {
  'use strict';
  const D = root.NR_DATA;
  const G = ['m', 'f'];
  const G_SHARE = { m: 0.513, f: 0.487 }; // 출생 성비 약 105:100 가정
  const YEAR_FIRST = 2008, YEAR_LAST = 2026, YEAR_FULL = 2025, YEAR_PARTIAL = 2026;
  const ERA_KEYS = [1940, 1950, 1960, 1970, 1980, 1990];

  /* ---------- 성씨 ---------- */
  const surnames = D.surnames.split(';').map(s => {
    const [h, hj, p] = s.split(',');
    return { h, hj, pop: +p };
  }).sort((a, b) => b.pop - a.pop);
  surnames.forEach((s, i) => { s.rank = i + 1; s.share = s.pop / D.censusTotal; });
  const surMap = new Map(surnames.map(s => [s.h, s]));
  const TWO_CHAR = surnames.filter(s => s.h.length === 2).map(s => s.h);
  const SUR_FALLBACK_POP = 300; // 목록 밖(희성) 성씨 가정 인구

  /* ---------- 연도별 이름 ---------- */
  const yearly = { m: {}, f: {} }, yMeta = { m: {}, f: {} };
  for (const g of G) {
    for (let y = YEAR_FIRST; y <= YEAR_LAST; y++) {
      const list = D.yearly[g][y].split('|').map((s, i) => {
        const [n, c] = s.split(',');
        return { n, c: +c, r: i + 1 };
      });
      yearly[g][y] = new Map(list.map(e => [e.n, e]));
      yMeta[g][y] = { list, cutoff: list[99].c, sum: list.reduce((a, e) => a + e.c, 0) };
    }
  }
  // 2026은 잠정 → TOP100 합계 비율로 연간 출생아 규모를 환산해 비율 계산에만 사용
  function births(y) {
    if (D.births[y]) return D.births[y];
    const r = (yMeta.m[y].sum + yMeta.f[y].sum) / (yMeta.m[YEAR_FULL].sum + yMeta.f[YEAR_FULL].sum);
    return D.births[YEAR_FULL] * r;
  }
  const gBirths = (y, g) => births(y) * G_SHARE[g];

  /* ---------- 시대별 TOP10 ---------- */
  const eras = { m: {}, f: {} };
  for (const g of G) for (const k of ERA_KEYS) {
    eras[g][k] = new Map(D.eras[g][k].split(',').map((n, i) => [n, i + 1]));
  }
  // 시대 목록은 건수가 없어 순위→비율 가정. 1940~60년대는 이름이 더 몰려 있었다고 보고 1위 비율을 높게 둠
  const eraTopShare = k => (k <= 1960 ? 0.02 : 0.012);
  const eraShare = (k, r) => eraTopShare(k) * Math.pow(r, -0.3);
  const cohort = new Map(D.cohorts.map(c => [c.key, c]));

  /* ---------- 음절 빈도 (데이터셋에서 직접 계산) ---------- */
  function buildSyl() {
    const t = {};
    for (const g of G) {
      const modern = { first: new Map(), last: new Map(), tot: 0 };
      for (let y = YEAR_FIRST; y <= YEAR_FULL; y++) {
        for (const e of yMeta[g][y].list) {
          if (e.n.length !== 2) continue;
          modern.first.set(e.n[0], (modern.first.get(e.n[0]) || 0) + e.c);
          modern.last.set(e.n[1], (modern.last.get(e.n[1]) || 0) + e.c);
          modern.tot += e.c;
        }
      }
      const old = { first: new Map(), last: new Map(), tot: 0 };
      for (const k of ERA_KEYS) for (const [n, r] of eras[g][k]) {
        const w = 11 - r;
        old.first.set(n[0], (old.first.get(n[0]) || 0) + w);
        old.last.set(n[1], (old.last.get(n[1]) || 0) + w);
        old.tot += w;
      }
      t[g] = { modern, old };
    }
    return t;
  }
  const SYL = buildSyl();
  const sp = (tbl, pos, ch) => (tbl[pos].get(ch) || 0) / tbl.tot;

  // 이름에 흔히 쓰이는 글자(빈도값 없음, 모델 하한용). 목록에 없는 글자는 더 낮은 하한을 받음
  const COMMON = new Set('영수호철식석환규기택균섭용일국태근현준민성진상정동재경승우훈혁희숙자순옥미은지혜연선주아윤서하도시유채나린원빈율결찬열범종길남덕만복봉춘화란애향분례임심금명인의광표삼병문학한형홍효건훈욱웅완창권익필탁솔별봄온새람솜결해든'.split(''));
  const pooled = { first: new Map(), last: new Map(), tot: 0 };
  for (const g of G) for (const e of ['modern', 'old']) {
    const T = SYL[g][e], w = 1 / T.tot;
    for (const pos of ['first', 'last']) for (const [ch, v] of T[pos]) pooled[pos].set(ch, (pooled[pos].get(ch) || 0) + v * w / 4);
  }
  pooled.tot = 1;
  function sylP(T, pos, ch, era) {
    const pool = era === 'modern' ? sp(pooled, pos, ch) * 0.5 : 0;
    return Math.max(sp(T, pos, ch), pool, COMMON.has(ch) ? (era === 'modern' ? 0.008 : 0.005) : 0.0008);
  }
  // 목록에 없는 이름의 출생 비율 추정: 첫 글자·끝 글자 빈도의 곱 × 보정계수, 상한은 그해 100위 컷 아래
  function tailShare(name, g, era, capShare) {
    const T = SYL[g][era];
    if (name.length === 2) {
      const alpha = era === 'modern' ? 0.3 : 1.5;
      return Math.min(alpha * sylP(T, 'first', name[0], era) * sylP(T, 'last', name[1], era), capShare * 0.6);
    }
    if (name.length === 1) return Math.min(era === 'modern' ? 0.00008 : 0.00004, capShare * 0.5);
    return Math.min(0.00001, capShare * 0.3); // 세 글자 이상 이름
  }

  /* ---------- 이름 분석 ---------- */
  function analyzeGender(name, g) {
    const years = [];
    let hitYears = 0;
    for (let y = YEAR_FIRST; y <= YEAR_LAST; y++) {
      const e = yearly[g][y].get(name);
      if (e) hitYears++;
      years.push({ y, rank: e ? e.r : null, count: e ? e.c : null, partial: y === YEAR_PARTIAL });
    }
    const eraRanks = ERA_KEYS.map(k => ({ k, rank: eras[g][k].get(name) || null }));
    const hitEras = eraRanks.filter(e => e.rank).length;

    // 코호트별 인원 추정
    const parts = [];
    let modernSum = 0;
    years.forEach((yr, i) => {
      let c;
      const capShare = yMeta[g][yr.y].cutoff / gBirths(yr.y, g);
      if (yr.count != null) c = yr.count;
      else {
        const near = years.some((o, j) => o.count != null && Math.abs(j - i) <= 2);
        c = near ? yMeta[g][yr.y].cutoff * 0.55 : tailShare(name, g, 'modern', capShare) * gBirths(yr.y, g) * (yr.partial ? 0.65 : 1);
      }
      yr.est = c;
      modernSum += c;
    });
    parts.push({ key: 'modern', label: YEAR_FIRST + '~' + YEAR_LAST, mid: null, count: modernSum });

    const eraShareOf = {};
    for (const e of eraRanks) {
      const s = e.rank ? eraShare(e.k, e.rank) : tailShare(name, g, 'old', 0.0035);
      eraShareOf[e.k] = s;
      const c = cohort.get(e.k);
      parts.push({ key: e.k, label: c.from + '~' + c.to, mid: c.mid, count: s * c.pop * 0.5 });
    }
    // 1996~2007년생: 1990년 목록과 2008년 실제 비율의 평균
    const s2008 = (years[0].count != null ? years[0].count : years[0].est) / gBirths(2008, g);
    const s2000 = (eraShareOf[1990] + s2008) / 2;
    const c2000 = cohort.get(2000);
    parts.push({ key: 2000, label: c2000.from + '~' + c2000.to, mid: c2000.mid, count: s2000 * c2000.pop * 0.5 });

    const total = parts.reduce((a, p) => a + p.count, 0);

    // 평균 출생연도: 코호트 중앙값 + 2008년 이후는 연도별
    let wy = 0, ws = 0;
    for (const p of parts) if (p.mid) { wy += p.mid * p.count; ws += p.count; }
    for (const yr of years) { wy += yr.y * yr.est; ws += yr.est; }
    const avgYear = ws ? wy / ws : null;

    // 가장 유행한 시점: 실제 순위가 있는 해/시대 중 출생 비율이 가장 높은 곳
    let peak = null;
    for (const yr of years) if (yr.count != null) {
      const s = yr.count / gBirths(yr.y, g);
      if (!peak || s > peak.share) peak = { type: 'year', y: yr.y, rank: yr.rank, count: yr.count, share: s, partial: yr.partial };
    }
    for (const e of eraRanks) if (e.rank) {
      const s = eraShare(e.k, e.rank);
      if (!peak || s > peak.share) peak = { type: 'era', y: e.k, rank: e.rank, share: s };
    }
    const bestRank = Math.min(...years.filter(y => y.rank).map(y => y.rank), Infinity);

    return { g, years, eraRanks, hitYears, hitEras, parts, total, avgYear, peak, bestRank: isFinite(bestRank) ? bestRank : null, listed: hitYears + hitEras > 0 };
  }

  function rangeFor(res) {
    if (res.hitYears >= 4) return [0.75, 1.35];
    if (res.listed) return [0.5, 2];
    return [0.25, 3];
  }

  const listedSum = a => a.years.reduce((t, y) => t + (y.count || 0), 0) + a.eraRanks.reduce((t, e) => t + (e.rank ? 1e5 / e.rank : 0), 0);

  function analyzeName(given, gender) {
    const by = { m: analyzeGender(given, 'm'), f: analyzeGender(given, 'f') };
    let g = gender, total, conf;
    if (g === 'm' || g === 'f') {
      total = by[g].total;
      conf = by[g];
    } else {
      const lm = by.m.listed, lf = by.f.listed;
      if (lm && lf) { total = by.m.total + by.f.total; g = listedSum(by.m) >= listedSum(by.f) ? 'm' : 'f'; }
      else if (lm || lf) { g = lm ? 'm' : 'f'; total = by[g].total + by[g === 'm' ? 'f' : 'm'].total * 0.1; }
      else { g = by.m.total >= by.f.total ? 'm' : 'f'; total = by[g].total + by[g === 'm' ? 'f' : 'm'].total * 0.25; }
      conf = by[g];
    }
    const [lo, hi] = rangeFor(conf);
    const unisex = by.m.listed && by.f.listed;
    return { given, gender: g, genderGiven: gender === 'm' || gender === 'f', unisex, by, total, lo: total * lo, hi: total * hi, main: by[g] };
  }

  /* ---------- 이름 입력 분리 ---------- */
  function splitName(raw) {
    const s = String(raw || '').replace(/\s+/g, ' ').trim();
    if (!s) return { error: '이름을 입력해 주세요.' };
    if (!/^[가-힣 ]+$/.test(s)) return { error: '한글 이름만 입력할 수 있어요. (예: 김민준)' };
    let sur, given;
    if (s.includes(' ')) {
      const [a, ...b] = s.split(' ');
      sur = a; given = b.join('');
    } else {
      if (s.length < 2) return { error: '성과 이름을 함께 입력해 주세요. (예: 김민준)' };
      const two = s.length >= 3 && TWO_CHAR.find(t => s.startsWith(t));
      sur = two || s[0];
      given = s.slice(sur.length);
    }
    if (!sur || !given) return { error: '성과 이름을 함께 입력해 주세요. (예: 김민준)' };
    if (sur.length > 2) return { error: '성은 한두 글자로 입력해 주세요. 띄어쓰기로 성과 이름을 나눌 수 있어요.' };
    if (given.length > 4) return { error: '이름이 너무 길어요. 네 글자 이하로 입력해 주세요.' };
    return { sur, given, full: sur + given };
  }

  function surnameInfo(h) {
    const s = surMap.get(h);
    if (s) return { ...s, known: true };
    return { h, hj: '', pop: null, rank: null, share: SUR_FALLBACK_POP / D.censusTotal, known: false };
  }

  /* ---------- 같은 해 출생자 ---------- */
  function sameYear(res, birthYear) {
    const g = res.gender, a = res.by[g];
    if (!birthYear) return null;
    if (birthYear >= YEAR_FIRST && birthYear <= YEAR_LAST) {
      const yr = a.years.find(y => y.y === birthYear);
      return { count: yr.est, rank: yr.rank, exact: yr.count != null, partial: yr.partial };
    }
    for (const p of a.parts) {
      if (p.key === 'modern') continue;
      const c = cohort.get(p.key);
      if (birthYear >= c.from && birthYear <= c.to) return { count: p.count / (c.to - c.from + 1), rank: null, exact: false };
    }
    return null;
  }

  function eraListFor(birthYear, g) {
    if (!birthYear) return null;
    if (birthYear >= YEAR_FIRST && birthYear <= YEAR_LAST) {
      return { label: birthYear + '년' + (birthYear === YEAR_PARTIAL ? '(잠정)' : ''), names: yMeta[g][birthYear].list.slice(0, 10).map(e => e.n), official: true };
    }
    let k = null;
    for (const e of ERA_KEYS) if (birthYear >= e - 4) k = e;
    if (k == null) k = 1940;
    if (birthYear > 1999) return null;
    return { label: k + '년', names: D.eras[g][k].split(','), official: false };
  }

  /* ---------- 음절 설명용 ---------- */
  function syllableNotes(given, g) {
    if (given.length !== 2) return null;
    const T = SYL[g].modern, O = SYL[g].old;
    return {
      first: { ch: given[0], modern: sp(T, 'first', given[0]), old: sp(O, 'first', given[0]) },
      last: { ch: given[1], modern: sp(T, 'last', given[1]), old: sp(O, 'last', given[1]) }
    };
  }

  /* ---------- 한자 훈음 ---------- */
  const hanjaMap = new Map(D.hanja.split(';').map(s => {
    const p = s.split(' ');
    return [p[0], { hun: p[1], eum: p.slice(2) }];
  }));
  function hanjaLookup(hanja, given) {
    const chars = Array.from(String(hanja || '').replace(/\s/g, ''));
    if (!chars.length) return null;
    if (chars.length !== given.length) return { error: '한자 글자 수가 이름(' + given.length + '자)과 달라요. 이름 부분만 입력해 주세요.' };
    return chars.map((ch, i) => {
      if (!/\p{Script=Han}/u.test(ch)) return { ch, status: 'invalid' };
      const e = hanjaMap.get(ch);
      if (!e) return { ch, status: 'unknown', syl: given[i] };
      const match = e.eum.includes(given[i]);
      return { ch, status: match ? 'ok' : 'mismatch', hun: e.hun, eum: e.eum[0], syl: given[i] };
    });
  }

  function topList(g, y, n = 10) { return yMeta[g][y].list.slice(0, n); }

  root.NR = {
    splitName, surnameInfo, analyzeName, sameYear, eraListFor, syllableNotes, hanjaLookup, topList,
    surnames, YEAR_FIRST, YEAR_LAST, YEAR_FULL, YEAR_PARTIAL, ERA_KEYS, decadeTop: D.decadeTop, allTime: D.allTime, censusTotal: D.censusTotal
  };
})(typeof window !== 'undefined' ? window : globalThis);
