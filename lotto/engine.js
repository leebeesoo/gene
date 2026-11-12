/* 오늘로또 — deterministic engine (KST time, rounds, 사주-flavoured reading, numbers) */
(function () {
  'use strict';
  var D = window.LottoData;
  var KST = 9 * 36e5, MIN = 6e4, DAY = 864e5, WEEK = 7 * DAY;
  var FIRST_DRAW = Date.UTC(2002, 11, 7, 20, 35) - KST; // 제1회 2002-12-07 (토)

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function mod(a, n) { return ((a % n) + n) % n; }

  /* ---------- time (always KST) ---------- */
  function kst(ts) {
    var d = new Date((ts == null ? Date.now() : ts) + KST);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dow: d.getUTCDay(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds() };
  }
  function dateKey(ts) { var p = kst(ts); return '' + p.y + pad(p.m) + pad(p.d); }
  function parseKey(k) { return { y: +k.slice(0, 4), m: +k.slice(4, 6), d: +k.slice(6, 8) }; }
  function addDays(k, n) {
    var p = parseKey(k), d = new Date(Date.UTC(p.y, p.m - 1, p.d + n));
    return '' + d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate());
  }
  function dowOfKey(k) { var p = parseKey(k); return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay(); }
  /* KST wall-clock → epoch ms */
  function kstTs(y, m, d, h, mi) { return Date.UTC(y, m - 1, d, h || 0, mi || 0) - KST; }

  /* ---------- draw schedule ---------- */
  function nextDraw(ts) {
    ts = ts == null ? Date.now() : ts;
    var p = kst(ts);
    var t = kstTs(p.y, p.m, p.d + mod(6 - p.dow, 7), 20, 35);
    if (t <= ts) t += WEEK;
    return t;
  }
  function roundOf(drawTs) { return Math.round((drawTs - FIRST_DRAW) / WEEK) + 1; }
  function drawTsOf(round) { return FIRST_DRAW + (round - 1) * WEEK; }
  function drawInfo(ts) {
    ts = ts == null ? Date.now() : ts;
    var next = nextDraw(ts), close = next - 35 * MIN, last = next - WEEK;
    var resume = last + (9 * 60 + 25) * MIN; // 일요일 06:00 판매 재개
    return {
      now: ts, next: next, close: close, round: roundOf(next), lastRound: roundOf(next) - 1, lastTs: last,
      phase: ts >= close ? 'closed' : ts < resume ? 'paused' : 'open',
      justDrawn: ts - last < 3 * 36e5
    };
  }

  /* ---------- hashing / prng ---------- */
  function xmur3(str) {
    var h = 1779033703 ^ str.length;
    for (var i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function seedHex(str) { var f = xmur3(str); f(); return ('0000000' + f().toString(16)).slice(-8); }
  function rng(hex, salt) { return mulberry32(xmur3(hex + '|' + (salt || ''))()); }
  function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }

  /* ---------- 사주 basics ---------- */
  function dayPillar(y, m, d) {
    var diff = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(2000, 0, 1)) / DAY);
    return mod(54 + diff, 60); // 2000-01-01 = 무오일
  }
  function yearBranch(y, m, d) {
    var ey = (m < 2 || (m === 2 && d < 4)) ? y - 1 : y; // 입춘 기준
    return { stem: mod(ey - 4, 10), branch: mod(ey - 4, 12) };
  }
  function relation(me, day) {
    if (me === day) return 'same';
    if ((me + 2) % 5 === day) return 'wealth';   // 내가 극하는 기운 = 재성
    if ((day + 1) % 5 === me) return 'support';  // 나를 생하는 기운 = 인성
    if ((me + 1) % 5 === day) return 'output';   // 내가 생하는 기운 = 식상
    return 'pressure';                           // 나를 극하는 기운 = 관성
  }

  function parseBirth(s) {
    if (!/^\d{8}$/.test(s || '')) return null;
    var y = +s.slice(0, 4), m = +s.slice(4, 6), d = +s.slice(6, 8);
    var dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
    return { y: y, m: m, d: d };
  }

  function birthInfo(s) {
    var b = parseBirth(s); if (!b) return null;
    var dp = dayPillar(b.y, b.m, b.d), yb = yearBranch(b.y, b.m, b.d);
    return { y: b.y, m: b.m, d: b.d, dayStem: dp % 10, dayBranch: dp % 12, el: Math.floor((dp % 10) / 2), zodiac: yb.branch };
  }

  /* ---------- lucky time (12 시진, constrained to sales hours 06–24, Sat until 20) ---------- */
  function timeWindows(el, saturday) {
    var out = [], end = saturday ? 20 : 24;
    for (var b = 0; b < 12; b++) {
      if (D.BRANCH_EL[b] !== el) continue;
      var start = mod(b * 2 - 1, 24);
      for (var k = 0; k < 2; k++) {
        var h = (start + k) % 24;
        if (h >= 6 && h + 1 <= end) out.push({ branch: b, start: start, hour: h });
      }
    }
    return out;
  }
  function luckyTime(el, saturday, r) {
    var c = timeWindows(el, saturday);
    if (!c.length) c = timeWindows((el + 4) % 5, saturday); // 나를 생하는 기운의 시간
    if (!c.length) c = timeWindows(2, saturday);
    return pick(r, c);
  }
  function hourLabel(h) {
    h = mod(h, 24);
    var p = h < 6 ? '새벽' : h < 12 ? '오전' : h === 12 ? '낮' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤';
    if (h === 0) p = '밤';
    return { p: p, n: (h % 12) || 12 };
  }
  function rangeLabel(h) {
    var a = hourLabel(h), b = hourLabel(h + 1);
    return a.p === b.p ? a.p + ' ' + a.n + '시~' + b.n + '시' : a.p + ' ' + a.n + '시~' + b.p + ' ' + b.n + '시';
  }

  /* ---------- numbers ---------- */
  function genNumbers(hex, luckyEl) {
    var r = rng(hex, 'nums'), digits = D.LUCKY_DIGITS[luckyEl] || [];
    var all = []; for (var i = 1; i <= 45; i++) all.push(i);
    var lucky = all.filter(function (n) { return digits.indexOf(n % 10) >= 0; });
    var chosen = [];
    function take(pool, k) {
      pool = pool.filter(function (n) { return chosen.indexOf(n) < 0; });
      for (var j = 0; j < k && pool.length; j++) {
        var idx = Math.floor(r() * pool.length);
        chosen.push(pool.splice(idx, 1)[0]);
      }
    }
    take(lucky, 2);
    take(all, 4);
    var rest = all.filter(function (n) { return chosen.indexOf(n) < 0; });
    var bonus = rest[Math.floor(r() * rest.length)];
    chosen.sort(function (a, b) { return a - b; });
    return { nums: chosen, bonus: bonus, digits: digits };
  }
  function drawHex(dayHex, idx) { return idx ? seedHex(dayHex + '#' + idx) : dayHex; }
  function setRows(hex, luckyEl) {
    var rows = [genNumbers(hex, luckyEl).nums];
    for (var i = 1; rows.length < 5 && i < 40; i++) {
      var n = genNumbers(seedHex(hex + '|set|' + i), luckyEl).nums;
      if (!rows.some(function (x) { return x.join() === n.join(); })) rows.push(n);
    }
    return rows;
  }

  /* ---------- full daily reading for a profile ---------- */
  function reading(p, key) {
    var bi = birthInfo(p.birth);
    var t = parseKey(key), todayEl = Math.floor((dayPillar(t.y, t.m, t.d) % 10) / 2);
    var me = bi ? bi.el : 2;
    var rel = relation(me, todayEl);
    var dayHex = seedHex([String(p.name || '').trim(), p.birth, p.btime, p.gender, p.sido, p.gugun, key].join('|'));
    var r = rng(dayHex, 'reading');
    var x = r();
    var luckyEl = x < 0.55 ? (me + 2) % 5 : x < 0.85 ? (me + 4) % 5 : todayEl;
    var R = D.REL[rel];
    var score = Math.max(55, Math.min(99, R.base + Math.round((r() - 0.5) * 12) + (p.btime >= 0 && D.BRANCH_EL[p.btime] === luckyEl ? 3 : 0)));
    var dir = pick(r, D.DIRS[luckyEl]);
    var place = pick(r, D.PLACES[luckyEl]);
    var distance = pick(r, D.DISTANCE);
    var tm = luckyTime(luckyEl, dowOfKey(key) === 6, r);
    return {
      key: key, dayHex: dayHex, me: me, todayEl: todayEl, rel: rel, relTag: R.tag, line: pick(r, R.lines), tip: pick(r, D.TIPS[me]),
      score: score, luckyEl: luckyEl, dir: dir, place: place, distance: distance,
      time: { branch: tm.branch, hour: tm.hour, start: tm.start, label: rangeLabel(tm.hour) },
      birth: bi
    };
  }

  /* 첫 화면 예시: 날짜만으로 뽑는 모두의 번호 (사람마다 같음) */
  function commonDraw(key) {
    var hex = seedHex('오늘의공|' + key);
    return genNumbers(hex, parseInt(hex.slice(0, 2), 16) % 5);
  }

  var DIR_DEG = { '북': 0, '북동': 45, '동': 90, '남동': 135, '남': 180, '남서': 225, '서': 270, '북서': 315 };

  function rank(nums, win) {
    if (!win || !win.nums || win.nums.length !== 6) return null;
    var m = nums.filter(function (n) { return win.nums.indexOf(n) >= 0; }).length;
    var b = nums.indexOf(win.bonus) >= 0;
    var rk = m === 6 ? 1 : m === 5 && b ? 2 : m === 5 ? 3 : m === 4 ? 4 : m === 3 ? 5 : 0;
    return { match: m, bonus: b, rank: rk };
  }

  window.LottoEngine = {
    pad: pad, kst: kst, kstTs: kstTs, dateKey: dateKey, parseKey: parseKey, addDays: addDays, dowOfKey: dowOfKey,
    drawInfo: drawInfo, drawTsOf: drawTsOf, roundOf: roundOf,
    seedHex: seedHex, rng: rng, parseBirth: parseBirth, birthInfo: birthInfo,
    genNumbers: genNumbers, commonDraw: commonDraw, drawHex: drawHex, setRows: setRows, reading: reading, rangeLabel: rangeLabel,
    DIR_DEG: DIR_DEG, rank: rank
  };
})();
