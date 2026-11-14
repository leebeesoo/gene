/*
 * 속마음 칠판 — 글 검사(화면과 중계소가 같은 파일을 씁니다)
 *
 * 화면: <script src="js/filter.js"></script> → window.DonkeyFilter
 * 중계소(Worker): import F from '../../../donkey/js/filter.js' (wrangler가 묶어 줌)
 * 테스트(node): import F from '../js/filter.js'
 *
 * 화면의 검사는 미리 알려 주는 용도이고, 진짜 차단은 중계소에서 다시 합니다(화면 코드는 고칠 수 있으므로).
 *
 * check(text) 결과
 *   { action: 'send', text }                        모두에게 보냄
 *   { action: 'self', code: 'care', text, message } 본인에게만 보이고 109 안내 (방송하지 않음)
 *   { action: 'block', code, message, care? }       보내지 않음 (care: true 이면 109 안내도 함께)
 *
 * 금칙어 목록은 첫 버전(약 150개)입니다. 운영하며 늘립니다. 단어는 「붙여 쓴 꼴」로 적습니다.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module && module.exports) module.exports = api;
  if (root) root.DonkeyFilter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LIMITS = {
    maxLen: 100,          // 글자 수
    minIntervalMs: 10000, // 한 접속에서 10초에 1개
    perHour: 30,          // 한 접속에서 1시간 30개
    roomPerSec: 5,        // 방 전체 초당 5개 넘으면 「잠시 붐벼요」
    reportsToHide: 3,     // 서로 다른 3명이 신고하면 모두에게서 숨김
    strikesToMute: 3,     // 3번 숨겨진 사람은
    muteMs: 24 * 3600 * 1000, // 24시간 쓰기 금지
    ttlMin: 20, ttlMax: 60 // 표시 시간(초)
  };

  // ── 금칙어 (욕설·성적 표현·혐오·불법 광고) ─────────────────────────
  var BANNED = [
    // 욕설
    '씨발', '시발', '씨빨', '씨바', '씨벌', '씨팔', '시팔', '시벌', '쓰발', '쓰벌', '씨부랄', '시부랄', '씹새', '씹년', '씹놈', '씹할', '씹창', '씹질',
    'ㅅㅂ', 'ㅆㅂ', 'ㅅㅍ', 'ㅆㅍ', 'ㅆㅂㄹ', 'ㅂㅅ', 'ㅄ', 'ㅈㄴ', 'ㅈㄹ', 'ㅈ같', 'ㄱㅅㄲ', 'ㅅㄲ', 'ㅁㅊㄴ', 'ㅅㅂㄴ',
    '병신', '븅신', '빙신', '병쉰', '좆', '좃같', '좃밥', '존나', '존니', '졸라게', '지랄', '개새끼', '개새기', '개색기', '개색끼', '개세끼', '개쉐이',
    '씹새끼', '좆새끼', '미친새끼', '미친년', '미친놈', '미친넘', '쌍년', '쌍놈', '썅', '개놈', '걸레년', '화냥년', '호로새끼', '호로자식', '후레자식', '상놈의',
    '니미', '니애미', '니어미', '느금마', '느금', '니엄마', '니앰', '애미뒤진', '애비뒤진', '엠창', '염병', '옘병', '등신', '또라이', '돌아이', '찐따', '애자새끼',
    '뒤져라', '뒤지세요', '디져라',
    // 성적 표현·성매매
    '섹스', '쎅스', '섹쓰', '쎅쓰', '섹파', '보지털', '보짓', '자지털', '잦이', '보빨', '자위하', '자위행위', '딸딸이', '딸치', '꼴리', '꼴림', '사까시', '펠라',
    '정액', '질싸', '입싸', '빨통', '젖꼭지', '야동', '몸캠', '조건만남', '원나잇', '오피걸', '출장안마', '출장마사지', '키스방', '립카페', '성매매', '강간', '윤간',
    // 혐오
    '한남충', '김치녀', '된장녀', '메갈년', '일베충', '틀딱', '급식충', '맘충', '짱깨', '짱개', '쪽바리', '깜둥', '똥남아', '흑형', '장애인새끼', '병자새끼',
    // 불법 광고
    '토토사이트', '사설토토', '카지노사이트', '바카라', '먹튀검증', '작업대출', '대리입금', '내구제', '필로폰', '대마초', '떨팔', '아이스팔',
    // 영문·자판 변형
    'fuck', 'fuk', 'shit', 'bitch', 'porn', 'pussy', 'dick', 'nigg', 'tlqkf', 'tlqk', 'qudtls', 'whssk', 'wlfkf', 'rotoRl', 'sex'
  ];

  // 금칙어처럼 보이지만 평범한 말 (검사 전에 지움)
  var ALLOW = ['시발점', '시발역', '시바견', '시바이누', '시바르', '자위대', '자위권', '정액제', '정액권', '니미츠', '로리타패션', '오피스', '등신대', '딸치킨', '딸치즈', 'sexy', 'essex', 'sussex', 'dickens', 'fukuoka', 'shitake', 'shiitake'];

  // 자해 방법·도구·동반 모집 → 차단 + 109 안내 (자살예방법상 불법정보)
  var HARM_INFO = [
    '동반자살', '같이죽을', '같이죽자', '같이죽어', '함께죽을', '함께죽자', '자살방법', '자살하는법', '자살하는방법', '죽는방법', '죽는법', '고통없이죽',
    '번개탄', '착화탄', '수면제몇알', '목매는법', '목매는방법', '투신방법', '투신장소', '안락사약', '자살사이트', '자살장소', '청산가리', '농약마시'
  ];

  // 힘든 마음 → 본인에게만 보이고 109 안내 (다른 사람에게 퍼지지 않게)
  var CARE = [
    '죽고싶', '죽고시퍼', '죽고싶다', '죽을래', '죽어버리고', '죽어버릴', '죽어야겠', '죽고말', '자살', '자해', '살기싫', '살기실', '살고싶지않', '살고싶지가않', '살아서뭐해',
    '사라지고싶', '없어지고싶', '그만살고', '그만살래', '그만살까', '손목긋', '손목그', '목매', '뛰어내리고', '뛰어내릴', '극단적선택', '극단선택', '생을마감', '삶을끝내'
  ];

  var MSG = {
    empty: '한 글자 이상 적어 주세요.',
    long: '100자까지 적을 수 있어요.',
    link: '주소(링크)는 올릴 수 없어요.',
    contact: '전화번호·이메일·메신저 아이디는 올릴 수 없어요. 낯선 사람에게 연락처를 알려 주지 마세요.',
    banned: '욕설·성적 표현·혐오 표현이 있어서 보내지 않았어요.',
    harm: '이 글은 보낼 수 없어요. 혼자 견디기 힘들면 109에 전화해 주세요.',
    care: '이 글은 다른 사람에게 보내지 않고 내 화면에만 보여요.'
  };

  var ZW = /[​-‏⁠-⁤﻿­͏ᅟᅠㅤﾠ]/g;

  // 화면에 보일 글: 보이지 않는 글자 지우고, 줄바꿈·연속 공백을 한 칸으로
  function clean(text) {
    var s = String(text == null ? '' : text);
    try { s = s.normalize('NFKC'); } catch (e) { /* 오래된 브라우저 */ }
    return s.replace(ZW, '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  }

  // 검사용: 소문자, 한글·영문만 남기고 붙임, 같은 글자 반복은 하나로 (씨 1 발, 씨.발, 씨~~발 → 씨발)
  function squash(text) {
    var s = clean(text).toLowerCase();
    s = s.replace(/[^a-zᄀ-ᇿㄱ-ㆎ가-힣]/g, '');
    s = s.replace(/(.)\1+/g, '$1');
    return s;
  }

  // 목록도 검사용 꼴(squash)로 바꿔 둠 — 같은 글자 반복을 줄이는 규칙이 양쪽에 똑같이 적용되게
  function prep(list) { return list.map(function (w) { return squash(w); }).filter(Boolean); }
  var SQ = { BANNED: prep(BANNED), ALLOW: prep(ALLOW), HARM_INFO: prep(HARM_INFO), CARE: prep(CARE), MESSENGER: null };

  function stripAllowed(sq) {
    for (var i = 0; i < SQ.ALLOW.length; i++) sq = sq.split(SQ.ALLOW[i]).join('');
    return sq;
  }

  function hasAny(sq, list) {
    for (var i = 0; i < list.length; i++) if (list[i] && sq.indexOf(list[i]) !== -1) return list[i];
    return '';
  }

  var TLD = '(com|net|org|kr|co|io|me|ly|gg|xyz|shop|site|link|app|dev|info|biz|tv|to|cc|top|club|online|store|live|kim|page|vip|asia|jp|cn|us)';
  var RE_URL = new RegExp('(https?:|www\\.|\\b[a-z0-9][a-z0-9-]{0,62}\\s*(\\.|점|닷|dot|\\[\\.\\]|\\(\\.\\))\\s*' + TLD + '\\b)', 'i');
  var RE_URL_KO = /(닷|점)\s*(컴|넷|케이알|코리아)(?![가-힣])/; // 네이버 닷컴
  var RE_URL_SQ = /(openkakao|tme\/|bitly|linktr|lineme)/;
  var RE_EMAIL = /[a-z0-9._%+-]+\s*(@|＠|골뱅이|\(at\)|\[at\])\s*[a-z0-9-]+\s*(\.|점|닷)\s*[a-z]{2,}/i;
  var MESSENGER = ['오픈채팅', '오픈톡', '오픈챗', '텔레그램', '텔그', '텔레아이디', '텔레id', '카톡아이디', '카톡id', '카톡ㅇㅇㄷ', '카카오아이디', '카카오id', '카톡주세요', '카톡줘',
    '라인아이디', '라인id', '디스코드', '인스타아이디', '인스타id', '인스타dm', '디엠주세요', '디엠줘', '연락주세요', '번호주세요', '번호줘', '번호알려',
    'telegram', 'discord', 'kakaoid', 'lineid', 'snapchat'];

  // 숫자 덩어리(사이에 공백·하이픈·점 등이 끼어도 하나로 봄)
  function digitRuns(text) {
    var s = clean(text).replace(/[oO○ㅇ](?=[\d\s.\-]*\d)/g, '0').replace(/[lI|](?=[\d\s.\-]*\d)/g, '1');
    var out = [], m, re = /\d(?:[\s.\-_/()~]{0,2}\d)*/g;
    while ((m = re.exec(s))) out.push(m[0].replace(/\D/g, ''));
    return out;
  }

  function hasContact(text, sq) {
    if (RE_EMAIL.test(clean(text))) return true;
    var runs = digitRuns(text);
    for (var i = 0; i < runs.length; i++) {
      var d = runs[i];
      if (d.length >= 9) return true;                       // 010-1234-5678, 주민번호 등
      if (d.length >= 8 && /^0/.test(d)) return true;       // 02-123-4567
      if (d.length === 8 && /^1[5-9]\d{2}/.test(d)) return true; // 1588-0000
    }
    if (/[공영일이삼사오육륙칠팔구]{9,}/.test(clean(text).replace(/\s/g, ''))) return true; // 공일공일이삼사…
    if (hasAny(sq, SQ.MESSENGER || (SQ.MESSENGER = prep(MESSENGER)))) return true;
    return false;
  }

  function hasLink(text, sq) {
    var c = clean(text);
    var spaced = c.replace(/\s+/g, '');
    return RE_URL.test(c) || RE_URL.test(spaced) || RE_URL_KO.test(c) || RE_URL_SQ.test(sq);
  }

  function check(text) {
    var t = clean(text);
    if (!t) return { action: 'block', code: 'empty', message: MSG.empty };
    if (Array.from(t).length > LIMITS.maxLen) return { action: 'block', code: 'long', message: MSG.long };
    var sq = stripAllowed(squash(t));
    if (hasAny(sq, SQ.HARM_INFO)) return { action: 'block', code: 'harm', message: MSG.harm, care: true };
    if (hasAny(sq, SQ.CARE)) return { action: 'self', code: 'care', message: MSG.care, text: t, care: true };
    if (hasLink(t, sq)) return { action: 'block', code: 'link', message: MSG.link };
    if (hasContact(t, sq)) return { action: 'block', code: 'contact', message: MSG.contact };
    if (hasAny(sq, SQ.BANNED)) return { action: 'block', code: 'banned', message: MSG.banned };
    return { action: 'send', text: t };
  }

  /*
   * 도배 검사 (접속 하나의 상태). state = { last: null, times: [], lastText: '' } 를 그대로 넘기면 고쳐서 돌려줌.
   * 결과 { ok: true } | { ok: false, code: 'wait'|'hour'|'same', waitMs, message }
   */
  function rate(state, now, text) {
    state = state || {};
    var times = (state.times || []).filter(function (t) { return now - t < 3600000; });
    var key = squash(text);
    if (typeof state.last === 'number' && now - state.last < LIMITS.minIntervalMs) {
      var w = LIMITS.minIntervalMs - (now - state.last);
      return { ok: false, code: 'wait', waitMs: w, message: Math.ceil(w / 1000) + '초 뒤에 다시 적을 수 있어요.', state: state };
    }
    if (times.length >= LIMITS.perHour) return { ok: false, code: 'hour', waitMs: 3600000 - (now - times[0]), message: '한 시간에 30개까지 적을 수 있어요. 잠시 쉬었다 와 주세요.', state: state };
    if (key && key === state.lastText) return { ok: false, code: 'same', waitMs: 0, message: '방금과 같은 글은 다시 보낼 수 없어요.', state: state };
    times.push(now);
    state.last = now; state.times = times; state.lastText = key;
    return { ok: true, state: state };
  }

  // 표시 시간(초): 글이 길수록 길게 20~60초, 붐비면(busy 0~1) 최대 40% 짧게
  function ttl(text, busy) {
    var n = Array.from(clean(text)).length;
    var s = LIMITS.ttlMin + n * 0.4;
    s = s * (1 - 0.4 * Math.max(0, Math.min(1, busy || 0)));
    return Math.round(Math.max(LIMITS.ttlMin * 0.6, Math.min(LIMITS.ttlMax, s)));
  }

  return { LIMITS: LIMITS, MSG: MSG, clean: clean, squash: squash, check: check, rate: rate, ttl: ttl, _lists: { BANNED: BANNED, ALLOW: ALLOW, HARM_INFO: HARM_INFO, CARE: CARE } };
});
