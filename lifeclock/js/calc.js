/* 남은봄 — 계산 (순수 함수) */
(function (root) {
  'use strict';
  var DAY = 86400000;
  var YEAR_MS = 365.2425 * DAY;
  var BPM = 80; // 평균 심박수 가정(분당 80회, 성인 안정 시 정상 범위 60~100회의 중간값 근처)

  function parseYMD(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || ''));
    if (!m) return null;
    var y = +m[1], mo = +m[2] - 1, d = +m[3];
    var dt = new Date(y, mo, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
    return dt;
  }

  function ymd(dt) {
    return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
  }

  function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }

  /* 해당 연도의 생일. 2월 29일생은 평년엔 3월 1일에 나이가 듦(민법 제160조 기간 계산) */
  function birthdayIn(birth, y) {
    if (birth.getMonth() === 1 && birth.getDate() === 29 && !isLeap(y)) return new Date(y, 2, 1);
    return new Date(y, birth.getMonth(), birth.getDate());
  }

  function ages(birth, now) {
    var y = now.getFullYear();
    var bdThis = birthdayIn(birth, y);
    var man = y - birth.getFullYear() - (now < bdThis ? 1 : 0);
    var last = birthdayIn(birth, birth.getFullYear() + man);
    var next = birthdayIn(birth, birth.getFullYear() + man + 1);
    var frac = (now - last) / (next - last);
    var yeon = y - birth.getFullYear();
    return {
      man: man,
      yeon: yeon,
      korean: yeon + 1,
      exact: man + frac,
      lastBirthday: last,
      nextBirthday: next,
      daysToBirthday: Math.ceil((startOfDay(next) - startOfDay(now)) / DAY)
    };
  }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  /* 생명표 기대여명 — 단일연령 사이를 선형 보간 */
  function remainingYears(table, sex, exactAge) {
    var arr = sex === 'f' ? table.f : table.m;
    if (exactAge < 0) exactAge = 0;
    var x = Math.floor(exactAge);
    if (x >= 100) return arr[100];
    var f = exactAge - x;
    return arr[x] + (arr[x + 1] - arr[x]) * f;
  }

  function lived(birth, now) {
    var ms = now - birth;
    var days = Math.floor((startOfDay(now) - birth) / DAY);
    return {
      ms: ms,
      nthDay: days + 1,
      days: days,
      weeks: Math.floor(days / 7),
      hours: Math.floor(ms / 3600000),
      seconds: Math.floor(ms / 1000),
      heartbeats: Math.round(ms / 60000 * BPM)
    };
  }

  /* (from, to] 구간에 month/day 이벤트가 몇 번 있는지 */
  function countAnnual(from, to, month, day) {
    var n = 0;
    for (var y = from.getFullYear(); y <= to.getFullYear(); y++) {
      var d = new Date(y, month - 1, day);
      if (d > from && d <= to) n++;
    }
    return n;
  }

  function countPeriodic(from, to, startYear, step, month, day) {
    var n = 0, first = null;
    for (var y = startYear; y <= to.getFullYear(); y += step) {
      var d = new Date(y, month - 1, day);
      if (d > from && d <= to) { n++; if (!first) first = y; }
    }
    return { n: n, first: first };
  }

  function countSaturdays(from, to) {
    var start = startOfDay(from);
    var dow = start.getDay();
    var first = new Date(start.getTime());
    first.setDate(first.getDate() + ((6 - dow + 7) % 7 || 7));
    if (first > to) return 0;
    return Math.floor((startOfDay(to) - first) / (7 * DAY)) + 1;
  }

  function addYears(date, years) { return new Date(date.getTime() + years * YEAR_MS); }

  function summary(table, input, now) {
    var birth = parseYMD(input.birth);
    if (!birth) return null;
    var a = ages(birth, now);
    var rem = remainingYears(table, input.sex, a.exact);
    var end = addYears(now, rem);
    var l = lived(birth, now);
    var remDays = Math.floor((end - now) / DAY);
    var expectedAge = a.exact + rem;
    return {
      birth: birth,
      sex: input.sex,
      ages: a,
      lived: l,
      remaining: rem,
      expectedAge: expectedAge,
      end: end,
      remDays: remDays,
      remHours: Math.floor((end - now) / 3600000),
      progress: Math.min(1, a.exact / expectedAge),
      counts: {
        weekends: countSaturdays(now, end),
        birthdays: countAnnual(now, end, a.nextBirthday.getMonth() + 1, a.nextBirthday.getDate()),
        seollal: countAnnual(now, end, 2, 1),       // 설: 양력 1월 하순~2월 중순 → 2월 1일로 근사
        chuseok: countAnnual(now, end, 9, 25),      // 추석: 양력 9월 중순~10월 초 → 9월 25일로 근사
        blossom: countAnnual(now, end, 4, 5),       // 벚꽃: 4월 초로 근사
        worldcup: countPeriodic(now, end, 2030, 4, 6, 15),  // 2030년부터 4년 주기, 6월 개막 근사
        election: countPeriodic(now, end, 2030, 5, 3, 1)    // 현행 5년 단임제, 2030년부터 5년 주기 가정
      }
    };
  }

  function parentTime(table, parentAge, parentSex, userRemaining, perYear) {
    var pr = remainingYears(table, parentSex, parentAge + 0.5);
    var years = Math.min(pr, userRemaining);
    var meetings = Math.round(years * perYear);
    return { parentRemaining: pr, years: years, meetings: meetings, days: meetings };
  }

  function milestones(list, birth, now) {
    return list.map(function (m) {
      var at = new Date(birth.getTime() + m.ms);
      return { label: m.label, at: at, past: at <= now, msLeft: at - now };
    }).sort(function (a, b) { return a.at - b.at; });
  }

  function weeksGrid(s, now) {
    var rows = Math.max(Math.ceil(s.expectedAge), s.ages.man + 1);
    var sinceBd = Math.floor((startOfDay(now) - s.ages.lastBirthday) / DAY);
    var curWeek = Math.min(51, Math.floor(sinceBd / 7));
    var expWeeksTotal = s.expectedAge * 52;
    return { rows: rows, cols: 52, curRow: s.ages.man, curCol: curWeek, expWeeks: expWeeksTotal };
  }

  function mentalAge(quiz, answers) {
    var sum = 0, n = 0, rows = [];
    for (var i = 0; i < quiz.length; i++) {
      var k = answers[i];
      if (k == null || !quiz[i].a[k]) continue;
      sum += quiz[i].a[k][1]; n++;
      rows.push({ q: quiz[i].q, a: quiz[i].a[k][0], pts: quiz[i].a[k][1] });
    }
    if (!n) return null;
    return { age: Math.round(sum / n), exact: sum / n, sum: sum, n: n, rows: rows };
  }

  function mentalType(types, age) {
    for (var i = 0; i < types.length; i++) if (age <= types[i].max) return types[i];
    return types[types.length - 1];
  }

  root.LC_CALC = {
    DAY: DAY, YEAR_MS: YEAR_MS, BPM: BPM,
    parseYMD: parseYMD, ymd: ymd, ages: ages, remainingYears: remainingYears, lived: lived,
    countAnnual: countAnnual, countPeriodic: countPeriodic, countSaturdays: countSaturdays,
    summary: summary, parentTime: parentTime, milestones: milestones, weeksGrid: weeksGrid,
    mentalAge: mentalAge, mentalType: mentalType, startOfDay: startOfDay, birthdayIn: birthdayIn
  };
})(typeof window !== 'undefined' ? window : globalThis);
