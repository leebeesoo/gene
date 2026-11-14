#!/usr/bin/env node
// 나이별 혜택·검진 달력(/silver/) 정적 페이지 생성기. 의존성 없음.
// 사용: node tools/silver/build.mjs
// 입력: silver/data/benefits.json (손으로 정리한 공식 출처 데이터), silver/js/rules.js (판단 규칙·카드 HTML)
// 출력: silver/index.html, silver/age/{60..85}/index.html, silver/item/{id}/index.html, silver/about.html, silver/privacy.html
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { GTM_HEAD, GTM_BODY } from '../seo/gtm.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SILVER = join(ROOT, 'silver');
const require = createRequire(import.meta.url);
const R = require(join(SILVER, 'js', 'rules.js'));
const data = JSON.parse(readFileSync(join(SILVER, 'data', 'benefits.json'), 'utf8'));
const { esc } = R;

const NAME = '나이별 혜택·검진 달력';
const BASE = 'https://jaemilab.net/silver/'; // 사이트 주소(2026-11-14 도메인 연결)
const Y = data.meta.baseYear;
const CHECKED = data.meta.checked;
const AGES = []; for (let a = 60; a <= 85; a++) AGES.push(a);
// 나이 페이지는 26개가 거의 같아서, 새 항목이 시작되는 대표 나이만 검색에 싣는다.
// 2026-11-14: 75·80·66세는 70세와 본문이 89~93% 같아 noindex로 돌림(애드센스 「중복·얇은 페이지」 대비). 대표 나이 60·65·70만 색인.
// 나머지는 noindex,follow(사람은 그대로 보고 링크도 따라감) + 사이트맵 제외(tools/seo/sitemap.mjs가 noindex를 뺌) + 광고 없음.
const INDEXED_AGES = new Set([60, 65, 70]);
const items = data.items;
const byId = Object.fromEntries(items.map(i => [i.id, i]));

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect x='8' y='12' width='48' height='44' rx='8' fill='none' stroke='%23141413' stroke-width='5'/%3E%3Cpath d='M8 26h48M22 6v12M42 6v12' stroke='%23141413' stroke-width='5' stroke-linecap='round'/%3E%3Ccircle cx='40' cy='42' r='7' fill='%232C6A8E'/%3E%3C/svg%3E";
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/><circle cx="15" cy="15.5" r="1.6" fill="currentColor" stroke="none"/></svg>';
const ICON_MOON = '<svg class="ico ico-s" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
const AD = '<aside class="jl-ad" aria-label="광고"><small>광고</small><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>';

function head({ title, desc, path, up, ogTitle, ogDesc, jsonld, extra = '', noindex = false }) {
  const url = BASE + path;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
${GTM_HEAD}
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,follow">\n' : ''}<meta name="theme-color" content="#F7F6F2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121211" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="혹시나랩">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(ogDesc || desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:description" content="${esc(ogDesc || desc)}">
<meta name="twitter:image" content="${BASE}og.png">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="${up}css/style.css">
<link rel="stylesheet" href="${up}../common/footer.css">
<link rel="stylesheet" href="${up}../common/ads.css">
<script>try{var t=localStorage.getItem('silver.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);if(localStorage.getItem('silver.size')==='xl')document.documentElement.setAttribute('data-size','xl');}catch(e){}</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 1)}
</script>
${extra}</head>
<body>
${GTM_BODY}
<a class="sr-only" href="#main">본문 바로가기</a>
<header class="top">
  <div class="top-in">
    <a class="brand" href="${up}" aria-label="${NAME} 처음으로">${LOGO}<span>나이별 혜택<span class="nm-x">·검진</span> 달력</span></a>
    <span class="top-sp"></span>
    <button class="tbtn" type="button" id="btnSize" aria-pressed="false" aria-label="글자 크게 보기">글자 크게</button>
    <button class="tbtn" type="button" id="btnTheme" aria-label="화면 밝기 바꾸기">${ICON_MOON}</button>
  </div>
</header>
`;
}

function foot(up, notes, scripts = '') {
  return `
<footer class="jl-footer" data-site="silver" data-home="${up}../">
  <div data-notes>${notes}</div>
  <div data-links><a href="${up}about.html">만든 사람·만든 방법</a><a href="${up}privacy.html">개인정보처리방침</a><a href="${up}">${NAME} 처음으로</a></div>
</footer>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="${up}../common/footer.js" defer></script>
<script src="${up}../common/ads.js" defer></script>
<script src="${up}js/ui.js" defer></script>
${scripts}</body>
</html>
`;
}

const FOOT_NOTE = `<p>${NAME}은 보건복지부·국민건강보험공단·질병관리청·국민연금공단 등 공식 자료를 옮겨 정리한 참고용 안내입니다. 의학적 조언이 아니며, 정확한 대상 여부는 해당 기관에 확인하세요. 기준: ${Y}년, 확인일 ${R.fmtDate(CHECKED)}.</p>`;

function notice(level = 'h2') {
  return `<section class="notice" aria-labelledby="ntc">
  <${level} id="ntc">정확한 대상 여부는 해당 기관에 확인하세요</${level}>
  <p>공식 기준을 옮긴 참고용 안내예요. 소득·재산, 건강보험 자격, 사는 곳에 따라 실제 대상과 금액이 달라질 수 있어요.</p>
  ${R.phonesBox(data)}
</section>`;
}

function methodBox(up) {
  const orgs = [
    ['보건복지부·복지로', data.meta.guide.title, data.meta.guide.url],
    ['보건복지부', '2026년 기초연금 선정기준액 보도자료', byId['basic-pension'].sources[0].url],
    ['국민건강보험공단', '일반건강검진·암검진·틀니·임플란트 안내', 'https://www.nhis.or.kr/nhis/policy/wbhada19700m01.do'],
    ['질병관리청 예방접종도우미', '65세 이상 폐렴구균·인플루엔자', 'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=134'],
    ['국민연금공단', '노령연금 지급 개시 나이', 'https://www.nps.or.kr/pnsinfo/ntpsklg/getOHAF0100M0.do']
  ];
  return `<details class="box" id="method">
  <summary>만든 방법·출처</summary>
  <div class="box-body">
    <h3>쓴 자료</h3>
    <ul>${orgs.map(o => `<li><a href="${esc(o[2])}" rel="noopener" target="_blank">${esc(o[0])} · ${esc(o[1])}</a></li>`).join('')}</ul>
    <p>항목마다 원문 링크와 확인일을 따로 달았어요. 공식 기관 자료를 기본으로 썼고, 지자체마다 다른 대상포진 접종 지원·시내버스만 언론 보도로 전국 현황을 보탰어요. 블로그 요약은 쓰지 않았어요.</p>
    <h3>계산 방식</h3>
    <p>태어난 해로 올해 나이(${Y} − 출생연도)를 구해 제도별 나이 기준과 맞춰 봐요. 기초연금처럼 <b>만 나이</b> 기준인 제도는 그해 생일이 지나야 해당돼서 「올해 생일이 지나면」이라고 적어요.</p>
    <p>국가건강검진·암검진과 예방접종은 생일과 관계없이 <b>올해 그 나이가 되는 분(출생연도 기준)</b>이 대상이에요. 예를 들어 ${Y}년에는 ${Y - 66}년생이 66세 검진(인지기능·노인신체기능·폐기능, 여성 골밀도)을 1월부터 받을 수 있어요. 건보공단이 출생연도로 대상자를 정해 검진표를 보내요.</p>
    <p>예: 1961년생 → ${Y}년 65세 → 폐렴구균·독감 무료 접종 대상(질병관리청: 1961년 12월 31일 이전 출생), 기초연금은 만 65세 생일부터 받을 수 있는 나이(소득 기준은 따로 확인).</p>
    <p>소득·재산 기준은 계산하지 않아요. 기초연금·노인일자리 같은 제도는 나이만 맞춰 보여 드리고, 소득 조건은 「대상」에 그대로 적었어요.</p>
    <h3>확인일</h3>
    <p>모든 항목 ${R.fmtDate(CHECKED)} 확인. 다음 확인 예정: ${R.fmtDate(data.meta.nextCheck)} (새해 기준액 고시 뒤).</p>
    <h3>아직 발표되지 않아 넣지 않은 것</h3>
    <ul>${data.meta.excluded.map(e => `<li><span class="badge-check">발표 전</span> <b>${esc(e.name)}</b> — ${esc(e.reason)}</li>`).join('')}</ul>
    <h3>하지 않는 것</h3>
    <p>병원·약·제품 추천, 증상으로 병을 짐작하는 기능, 건강 조언은 하지 않아요. 입력한 출생연도는 이 기기에만 저장되고 서버로 보내지 않아요.</p>
    <p><a href="${up}about.html">만든 사람과 정정 요청 방법 보기</a></p>
  </div>
</details>`;
}

const ARROW = R.ICON.arrow;
function ageGrid(up, current) {
  return `<div class="age-grid">${AGES.map(a => `<a href="${up}age/${a}/"${a === current ? ' aria-current="page"' : ''}><span class="num">${a}세</span><small class="num">${Y - a}년생</small></a>`).join('')}</div>`;
}
function itemList(up) {
  return `<ul class="item-list">${items.map(it => `<li><a href="${up}item/${it.id}/"><span><b>${esc(it.name)}</b><span>${esc(it.short)}</span></span>${ARROW}</a></li>`).join('')}</ul>`;
}

function write(rel, html) {
  const p = join(SILVER, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, html);
}

/* ---------------- 첫 화면 ---------------- */
function buildIndex() {
  const up = '';
  const years = []; for (let b = 1971; b >= 1926; b--) years.push(b);
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebApplication', name: NAME, url: BASE, description: '태어난 해를 넣으면 올해 받을 수 있는 혜택과 국가건강검진·예방접종, 내년에 새로 받을 수 있는 것을 연도별로 보여 주는 참고용 달력. 보건복지부·국민건강보험공단·질병관리청·국민연금공단 자료 기준.', applicationCategory: 'ReferenceApplication', operatingSystem: 'Any', inLanguage: 'ko', isAccessibleForFree: true, dateModified: CHECKED, offers: { '@type': 'Offer', price: '0', priceCurrency: 'KRW' } },
      { '@type': 'FAQPage', mainEntity: [
        { '@type': 'Question', name: '기초연금은 몇 살부터 받을 수 있나요?', acceptedAnswer: { '@type': 'Answer', text: `만 65세 이상이며 소득인정액이 선정기준액 이하인 분이 대상입니다. ${Y}년 선정기준액은 단독가구 247만 원, 부부가구 395만 2천 원이고, 월 최대 34만 9,700원(단독가구)입니다(보건복지부, ${CHECKED} 확인). 만 65세 생일이 속한 달의 1개월 전부터 신청할 수 있습니다.` } },
        { '@type': 'Question', name: '올해 국가건강검진 대상인지 어떻게 아나요?', acceptedAnswer: { '@type': 'Answer', text: '일반건강검진은 2년에 한 번이며, 출생연도 끝자리가 짝수면 짝수 해, 홀수면 홀수 해에 받습니다(국민건강보험공단). 나이별 검사(66세 인지기능·노인신체기능, 여성 54·60·66세 골밀도 등)는 생일과 관계없이 그해 그 나이가 되는 출생연도가 대상입니다. 정확한 대상 여부는 공단 누리집의 건강검진 대상 조회나 1577-1000에서 확인할 수 있습니다.' } },
        { '@type': 'Question', name: '65세 이상 무료 예방접종은 무엇인가요?', acceptedAnswer: { '@type': 'Answer', text: `폐렴구균(PPSV23) 1회와 인플루엔자 매년 1회가 무료입니다. ${Y}년 기준 1961년 12월 31일 이전 출생자가 대상이며, 위탁의료기관이나 보건소에서 신분증을 가지고 접종합니다(질병관리청 예방접종도우미).` } }
      ] }
    ]
  };
  const html = head({
    title: `${NAME} | 기초연금·건강검진·무료 예방접종 나이별 확인`,
    desc: `태어난 해만 넣으면 올해 받을 수 있는 혜택과 국가건강검진, 내년에 새로 받을 수 있는 것까지 연도별로 보여 드려요. 기초연금, 노인일자리, 폐렴구균·독감 무료 접종, 틀니·임플란트 건강보험, 교통·문화 경로우대. 보건복지부·건보공단·질병관리청 ${Y}년 기준.`,
    path: '', up,
    ogTitle: `부모님이 올해 받을 수 있는 혜택·검진, 한눈에 — ${NAME}`,
    ogDesc: '태어난 해만 넣으면 지금 받을 수 있는 것과 내년에 새로 받을 수 있는 것을 보여 드려요. 공식 기관 자료와 확인일 표시.',
    jsonld,
    extra: `<script type="application/json" id="silver-data">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>\n`
  }) + `
<main id="main" tabindex="-1">
  <div class="wrap">
    <section class="hero" aria-labelledby="heroT">
      <p class="eyebrow">${Y}년 기준 · 공식 기관 자료</p>
      <h1 id="heroT">올해 받을 수 있는 혜택과 검진, 태어난 해로 한눈에</h1>
      <p class="lead">기초연금, 국가건강검진, 무료 예방접종, 틀니·임플란트 건강보험까지. 지금 받을 수 있는 것과 내년에 새로 생기는 것을 연도별로 보여 드려요.</p>
      <form class="card form" id="form" novalidate>
        <div class="field" id="fYear">
          <label class="lbl" for="birth">태어난 해</label>
          <select class="input num" id="birth" name="birth">
            <option value="">태어난 해를 골라 주세요</option>
            ${years.map(b => `<option value="${b}">${b}년생 (올해 ${Y - b}세)</option>`).join('')}
          </select>
          <p class="or-age"><button type="button" id="toAge">나이로 넣을래요</button></p>
        </div>
        <div class="field" id="fAge" hidden>
          <label class="lbl" for="age">만 나이 <small>올해 생일이 지났다고 보고 계산해요</small></label>
          <input class="input num" type="number" inputmode="numeric" id="age" name="age" min="40" max="100" placeholder="예: 65">
          <p class="or-age"><button type="button" id="toYear">태어난 해로 넣을래요</button></p>
        </div>
        <fieldset class="field">
          <legend class="lbl">성별 <small>여성만 받는 검진이 있어요</small></legend>
          <div class="seg">
            <input type="radio" name="sex" id="sexF" value="f"><label for="sexF">여성</label>
            <input type="radio" name="sex" id="sexM" value="m"><label for="sexM">남성</label>
            <input type="radio" name="sex" id="sexA" value="" checked><label for="sexA">모두</label>
          </div>
        </fieldset>
        <p class="form-err" id="formErr" role="alert"></p>
        <button class="btn btn-primary" type="submit">받을 수 있는 것 보기</button>
        <div class="chips" aria-label="예시 나이로 바로 보기">
          ${[63, 65, 66, 70, 75, 80].map(a => `<button type="button" class="chip num" data-year="${Y - a}">${a}세</button>`).join('')}
        </div>
      </form>
    </section>

    <div id="result" aria-live="polite" hidden></div>

    <section class="sec" aria-labelledby="agesT">
      <h2 class="sec-h" id="agesT">나이별로 보기</h2>
      <p class="sec-sub">${Y}년에 그 나이가 되는 분 기준이에요.</p>
      ${ageGrid('', null)}
    </section>

    <section class="sec" aria-labelledby="itemsT">
      <h2 class="sec-h" id="itemsT">항목별로 보기</h2>
      <p class="sec-sub">대상·받는 것·신청 방법·출처를 항목마다 정리했어요.</p>
      ${itemList('')}
    </section>

    ${methodBox('')}
    ${AD}
  </div>
</main>
` + foot(up, FOOT_NOTE, `<script src="js/rules.js" defer></script>\n<script src="js/app.js" defer></script>\n`);
  write('index.html', html);
}

/* ---------------- 나이 페이지 ---------------- */
function buildAge(a) {
  const up = '../../';
  const by = Y - a;
  const cur = R.current(data, by, '', Y);
  const rows = R.timeline(data, by, '', 6);
  const nowBig = rows[0].events.filter(e => !e.minor);
  const nx = R.nextUp(rows);
  const names = cur.now.map(x => x.item.name);
  const desc = `${Y}년에 ${a}세가 되는 ${by}년생이 받을 수 있는 혜택과 국가건강검진: ${names.slice(0, 6).join(', ')} 등 ${names.length}가지. 내년·앞으로 새로 생기는 것까지 연도별로 정리했어요. 공식 기관 자료, ${CHECKED} 확인.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: `${a}세(${by}년생) 받을 수 있는 혜택·검진`, url: `${BASE}age/${a}/`, description: desc, inLanguage: 'ko', dateModified: CHECKED, isPartOf: { '@type': 'WebSite', name: NAME, url: BASE } },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: NAME, item: BASE },
        { '@type': 'ListItem', position: 2, name: `${a}세`, item: `${BASE}age/${a}/` }
      ] }
    ]
  };
  const html = head({
    title: `${a}세(${by}년생) 받을 수 있는 혜택·검진 — ${Y}년 기준 | ${NAME}`,
    desc, path: `age/${a}/`, up,
    ogTitle: `${a}세(${by}년생)가 올해 받을 수 있는 혜택·검진`,
    jsonld, noindex: !INDEXED_AGES.has(a)
  }) + `
<main id="main" tabindex="-1">
  <div class="wrap">
    <p class="crumbs"><a href="${up}">${NAME}</a> › 나이별 › ${a}세</p>
    <section class="hero" aria-labelledby="heroT">
      <p class="eyebrow">${Y}년 기준 · ${by}년생</p>
      <h1 id="heroT">${a}세에 받을 수 있는 혜택과 검진</h1>
      <p class="lead">${Y}년에 ${a}세가 되는 ${by}년생 기준으로, 지금 받을 수 있는 ${cur.now.length}가지와 앞으로 새로 생기는 것을 정리했어요.</p>
    </section>

    ${nowBig.length ? `<section class="next" aria-labelledby="newT"><h2 id="newT">${a}세에 새로 생기는 것</h2><ul>${nowBig.map(e => `<li><a href="${up}item/${e.item.id}/">${esc(e.item.name)}</a><span>${esc(e.text)}</span></li>`).join('')}</ul></section>` : ''}
    ${nx ? `<section class="next" aria-labelledby="nextT"><h2 id="nextT">${nx.offset === 1 ? '내년' : nx.offset + '년 뒤'}(${nx.row.year}년, ${nx.row.age}세)엔 이것도 받을 수 있어요</h2><ul>${nx.events.map(e => `<li><a href="${up}item/${e.item.id}/">${esc(e.item.name)}</a><span>${esc(e.text)}</span></li>`).join('')}</ul></section>` : ''}

    <section class="sec" aria-labelledby="nowT">
      <h2 class="sec-h" id="nowT">지금 받을 수 있어요</h2>
      <p class="sec-sub">나이 기준만 맞춰 봤어요. 소득 조건이 있는 항목은 「대상」에 적어 두었어요.</p>
      <div class="cards">${cur.now.map(x => R.card(data, x.item, { base: up, st: x.st, age: a, sex: '' })).join('')}</div>
    </section>

    <section class="sec" aria-labelledby="tlT">
      <h2 class="sec-h" id="tlT">앞으로 6년 달력</h2>
      <p class="sec-sub">해마다 새로 생기거나 차례가 오는 것만 적었어요.</p>
      ${R.timelineHtml(data, rows, up)}
    </section>

    ${cur.soon.length ? `<section class="sec" aria-labelledby="soonT"><h2 class="sec-h" id="soonT">나중에 열리는 것</h2><ul class="soon">${cur.soon.map(x => `<li><a href="${up}item/${x.item.id}/"><span><b>${esc(x.item.name)}</b><span>${esc(x.st.label)}</span></span>${ARROW}</a></li>`).join('')}</ul></section>` : ''}

    ${notice()}

    <div class="share-row">
      <a class="btn btn-line" href="${up}?y=${by}">다른 정보로 다시 보기</a>
      <button class="btn btn-line" type="button" data-share="${BASE}age/${a}/" data-share-title="${a}세(${by}년생) 받을 수 있는 혜택·검진">이 페이지 보내기</button>
    </div>
    <nav class="pager" aria-label="다른 나이">
      ${a > 60 ? `<a class="btn btn-line" href="../${a - 1}/">${a - 1}세 보기</a>` : ''}
      ${a < 85 ? `<a class="btn btn-line" href="../${a + 1}/">${a + 1}세 보기</a>` : ''}
    </nav>

    <section class="sec" aria-labelledby="agesT">
      <h2 class="sec-h" id="agesT">다른 나이 보기</h2>
      ${ageGrid(up, a)}
    </section>

    ${methodBox(up)}
    ${INDEXED_AGES.has(a) ? AD : ''}
  </div>
</main>
` + foot(up, FOOT_NOTE);
  write(`age/${a}/index.html`, html);
}

/* ---------------- 항목 페이지 ---------------- */
function relatedAges(it) {
  return AGES.filter(a => {
    const s = R.statusAt(it, Y - a, Y, '');
    return s.state === 'now' || s.state === 'birthday' || s.state === 'next';
  });
}
function buildItem(it, idx) {
  const up = '../../';
  const ages = relatedAges(it);
  const desc = `${it.name}: ${it.short}. 대상, 받는 것, 신청 방법과 문의 전화, 공식 출처(${it.sources.map(s => s.org).filter((v, i, a) => a.indexOf(v) === i).join('·')})를 ${CHECKED} 확인 기준으로 정리했어요.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: `${it.name} — 대상·내용·신청 방법`, url: `${BASE}item/${it.id}/`, description: desc, inLanguage: 'ko', dateModified: it.checked, isPartOf: { '@type': 'WebSite', name: NAME, url: BASE },
        citation: it.sources.map(s => ({ '@type': 'CreativeWork', name: s.title, publisher: s.org, url: R.srcUrl(data, s.url) })) },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: NAME, item: BASE },
        { '@type': 'ListItem', position: 2, name: it.name, item: `${BASE}item/${it.id}/` }
      ] }
    ]
  };
  const prev = items[idx - 1], next = items[idx + 1];
  const sameCat = items.filter(x => x.cat === it.cat && x.id !== it.id);
  const html = head({
    title: `${it.name} — 대상·받는 것·신청 방법 (${Y}년 기준) | ${NAME}`,
    desc, path: `item/${it.id}/`, up,
    ogTitle: `${it.name}: ${it.short}`,
    jsonld
  }) + `
<main id="main" tabindex="-1">
  <div class="wrap">
    <p class="crumbs"><a href="${up}">${NAME}</a> › ${esc(data.categories[it.cat])} › ${esc(it.name)}</p>
    <section class="hero" aria-labelledby="heroT">
      <p class="eyebrow">${esc(data.categories[it.cat])} · ${Y}년 기준</p>
      <h1 id="heroT">${esc(it.name)}</h1>
      <p class="lead">${esc(it.short)}</p>
    </section>

    <dl class="facts">${(it.facts || []).map(f => `<div><dt>${esc(f.k)}</dt><dd>${esc(f.v)}</dd></div>`).join('')}</dl>

    <div class="prose">
      ${it.parts ? `<h2>암별 대상과 주기</h2>${R.partsTable(it, null, '')}` : ''}
      <h2>누가 받을 수 있나요</h2>
      <p>${esc(it.who)}</p>
      <h2>무엇을 받나요</h2>
      <p>${esc(it.what)}</p>
      <h2>어떻게 신청하나요</h2>
      <p>${esc(it.how)}</p>
      ${it.note ? `<h2>함께 알아 두면 좋은 점</h2><p>${esc(it.note)}</p>` : ''}
      <h2>문의</h2>
      <div class="bc-tels">${R.phoneBtns(it.phones)}</div>
      ${it.links.length ? `<p style="margin-top:12px">${it.links.map(l => `<a class="more-link" href="${esc(l.url)}" rel="noopener" target="_blank">${esc(l.label)}${R.ICON.ext}</a>`).join(' ')}</p>` : ''}
      <h2>출처와 확인일</h2>
      ${R.sourceList(data, it)}
    </div>

    ${ages.length ? `<section class="sec" aria-labelledby="agesT"><h2 class="sec-h" id="agesT">${Y}년에 해당하는 나이</h2><p class="sec-sub">나이 기준만 맞춰 본 거예요. 나이를 누르면 그 나이에 받을 수 있는 것 전체를 볼 수 있어요.</p><div class="age-grid">${ages.map(a => `<a href="${up}age/${a}/"><span class="num">${a}세</span><small class="num">${Y - a}년생</small></a>`).join('')}</div></section>` : ''}

    ${notice()}

    ${sameCat.length ? `<section class="sec" aria-labelledby="relT"><h2 class="sec-h" id="relT">같이 보면 좋은 항목</h2><ul class="item-list">${sameCat.map(x => `<li><a href="${up}item/${x.id}/"><span><b>${esc(x.name)}</b><span>${esc(x.short)}</span></span>${ARROW}</a></li>`).join('')}</ul></section>` : ''}

    <nav class="pager" aria-label="다른 항목">
      ${prev ? `<a class="btn btn-line" href="../${prev.id}/">이전: ${esc(prev.name)}</a>` : ''}
      ${next ? `<a class="btn btn-line" href="../${next.id}/">다음: ${esc(next.name)}</a>` : ''}
    </nav>
    <p style="margin-top:16px"><a class="btn btn-primary" href="${up}">태어난 해로 전체 보기</a></p>

    ${methodBox(up)}
    ${AD}
  </div>
</main>
` + foot(up, FOOT_NOTE);
  write(`item/${it.id}/index.html`, html);
}

/* ---------------- 만든 사람·만든 방법 ---------------- */
function buildAbout() {
  const up = '';
  const allSrc = [];
  const seen = new Set();
  items.forEach(it => it.sources.forEach(s => { const u = R.srcUrl(data, s.url); const k = u + s.title; if (!seen.has(k)) { seen.add(k); allSrc.push({ ...s, url: u, item: it.name }); } }));
  const html = head({
    title: `만든 사람·만든 방법 — ${NAME}`,
    desc: `${NAME}을 누가, 어떤 자료로, 어떻게 만들었는지. 출처 목록, 확인일, 바뀐 내용 기록, 정정 요청 방법.`,
    path: 'about.html', up,
    jsonld: { '@context': 'https://schema.org', '@type': 'AboutPage', name: `만든 사람·만든 방법 — ${NAME}`, url: BASE + 'about.html', inLanguage: 'ko', dateModified: CHECKED, publisher: { '@type': 'Organization', name: '혹시나랩' } }
  }) + `
<main id="main" class="wrap doc" tabindex="-1">
  <h1>만든 사람·만든 방법</h1>
  <p class="meta">마지막 확인 ${R.fmtDate(CHECKED)} · 다음 확인 예정 ${R.fmtDate(data.meta.nextCheck)}</p>

  <h2>누가 만드나요</h2>
  <p>${NAME}은 작은 무료 웹 서비스 모음 「혹시나랩」에서 만들었어요. 혹시나랩 운영자 한 사람이 운영하며, 의료인·사회복지 전문가가 아니에요. 그래서 직접 판단하거나 조언하지 않고, 공식 기관이 발표한 기준만 옮겨 정리해요.</p>
  <ul>
    <li>운영: 혹시나랩 운영자 (개인)</li>
    <li>문의·정정 요청: 이메일 <a href="mailto:gdf0620@gmail.com">gdf0620@gmail.com</a> 로 보내 주세요. 공식 자료와 다른 부분을 알려 주시면 확인 후 고치고 아래 기록에 남겨요.</li>
    <li>광고: Google AdSense 광고가 붙을 수 있어요. 제휴 링크, 병원·상품 홍보, 유료 게재는 없어요.</li>
  </ul>

  <h2>왜 만들었나요</h2>
  <p>나이가 되면 받을 수 있는 혜택과 검진이 여러 기관에 흩어져 있어서, 「내 나이에 무엇을 받을 수 있지?」를 한 화면에서 보기 어려웠어요. 태어난 해 하나로 지금과 앞으로를 같이 볼 수 있게 묶었어요.</p>

  <h2>어떻게 만들었나요</h2>
  <ul>
    <li>보건복지부·복지로, 국민건강보험공단, 질병관리청, 국민연금공단의 누리집과 「${esc(data.meta.guide.title)}」 안내서를 직접 열어 보고 옮겼어요.</li>
    <li>숫자·나이·조건마다 출처와 확인일을 달았어요. 확인하지 못한 값은 사실처럼 보여 주지 않고 빼 두었어요.</li>
    <li>대상포진 접종 지원과 시내버스 요금처럼 지자체마다 다른 것은 공식 일괄 기준이 없어서, 언론 보도로 전국 현황만 적고 「사는 곳에 확인」이라고 안내해요.</li>
    <li>나이 계산: 올해 나이 = ${Y} − 출생연도. 만 나이 기준 제도는 생일이 지나야 해당돼요. 예방접종(질병관리청)과 국가건강검진·암검진(건보공단)은 출생연도로 대상을 정해서, 생일과 관계없이 올해 그 나이가 되는 분이 대상이에요.</li>
    <li>소득·재산 기준은 계산하지 않아요. 실제 대상 여부는 기관에서 확인해야 해요.</li>
    <li>병원·약·제품을 추천하지 않고, 증상으로 병을 짐작하는 기능도 없어요.</li>
  </ul>

  <h2>아직 발표되지 않아 넣지 않은 것</h2>
  <ul>${data.meta.excluded.map(e => `<li><b>${esc(e.name)}</b> — ${esc(e.reason)}</li>`).join('')}</ul>

  <h2>출처 목록</h2>
  <ul>${allSrc.map(s => `<li>${esc(s.item)}: <a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.org)} · ${esc(s.title)}</a></li>`).join('')}</ul>

  <h2>바뀐 내용 기록</h2>
  <ul class="log">
    <li><b class="num">${R.fmtDate(CHECKED)}</b> 건강검진 나이 기준(출생연도) 확인·문구 반영, 여성 골밀도 60세 확인, 대상포진 접종(지자체 지원) 추가, 시내버스는 지역마다 다르다는 안내 추가.</li>
    <li><b class="num">2026.11.13</b> 처음 공개. ${Y}년 기준으로 확인.</li>
  </ul>

  <h2>도움이 필요할 때</h2>
  ${R.phonesBox(data)}
</main>
` + foot(up, FOOT_NOTE);
  write('about.html', html);
}

/* ---------------- 개인정보처리방침 ---------------- */
function buildPrivacy() {
  const up = '';
  const html = head({
    title: `개인정보처리방침 — ${NAME}`,
    desc: `${NAME}의 개인정보처리방침. 입력한 출생연도·성별은 서버로 보내지 않고 이 기기에만 저장됩니다.`,
    path: 'privacy.html', up,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: `개인정보처리방침 — ${NAME}`, url: BASE + 'privacy.html', inLanguage: 'ko' }
  }) + `
<main id="main" class="wrap doc" tabindex="-1">
  <h1>개인정보처리방침</h1>
  <p class="meta">시행일: ${Y}년 11월 13일</p>

  <h2>1. 입력한 정보는 내 기기에만 있어요</h2>
  <p>${NAME}은 회원가입이 없고, 서버에 개인정보를 저장하지 않습니다. 태어난 해(또는 나이)와 성별 선택은 브라우저 안에서만 계산되며, 다음 방문 때 다시 보여 드리기 위해 이 기기의 브라우저 저장소(localStorage)에만 보관됩니다.</p>
  <ul>
    <li>저장 항목: <code>silver.v1</code>(태어난 해·성별), <code>silver.theme</code>(화면 밝기), <code>silver.size</code>(글자 크기)</li>
    <li>삭제 방법: 결과 화면의 「입력 지우기」 버튼, 또는 브라우저의 사이트 데이터 삭제</li>
    <li>「보내기」로 공유하는 주소에는 태어난 해가 들어갈 수 있어요. 공유 여부는 직접 선택합니다.</li>
    <li>이름, 주민등록번호, 소득, 건강 상태는 묻지 않습니다.</li>
  </ul>

  <h2>2. 광고와 쿠키 (Google AdSense)</h2>
  <p>이 사이트는 Google AdSense 광고를 게재할 수 있습니다. Google 등 제3자 광고 사업자는 쿠키를 사용해 이 사이트 및 다른 사이트 방문 기록을 바탕으로 광고를 제공할 수 있습니다.</p>
  <ul>
    <li>맞춤 광고는 <a href="https://adssettings.google.com/" rel="noopener">Google 광고 설정</a>에서 끌 수 있습니다. 제3자 쿠키는 <a href="https://www.aboutads.info/choices/" rel="noopener">aboutads.info</a>에서 관리할 수 있습니다.</li>
    <li>자세한 내용: <a href="https://policies.google.com/technologies/ads?hl=ko" rel="noopener">Google 광고 정책</a></li>
  </ul>
  <p>입력한 태어난 해·성별은 광고 사업자에게 전달되지 않습니다.</p>
  <p>방문 통계를 위해 Google 태그 관리자(Google Tag Manager)로 Google Analytics를 사용합니다. Google Analytics는 쿠키로 어떤 페이지를 얼마나 보는지 같은 익명 이용 통계를 모으며, 이름처럼 개인을 알아볼 수 있는 정보는 모으지 않습니다. 원하지 않으면 브라우저 설정에서 쿠키를 차단하거나 <a href="https://tools.google.com/dlpage/gaoptout?hl=ko" rel="noopener">Google 애널리틱스 차단 브라우저 부가기능</a>을 설치하면 됩니다.</p>

  <h2>3. 외부 리소스</h2>
  <p>글꼴(Pretendard)은 jsDelivr CDN에서 불러옵니다. 이 과정에서 CDN 사업자가 일반적인 접속 기록(IP, 브라우저 정보)을 처리할 수 있습니다.</p>

  <h2>4. 안내 내용에 대한 고지</h2>
  <p>이 서비스는 공식 기관 자료를 옮겨 정리한 참고용 안내이며, 의학적 조언이나 자격 판정이 아닙니다. 정확한 대상 여부는 해당 기관(보건복지상담센터 129, 국민건강보험공단 1577-1000 등)에 확인하세요.</p>

  <h2>5. 문의</h2>
  <p>개인정보 관련 문의는 이메일 <a href="mailto:gdf0620@gmail.com">gdf0620@gmail.com</a> 로 보내 주세요.</p>
</main>
` + foot(up, FOOT_NOTE);
  write('privacy.html', html);
}

/* ---------------- 실행 ---------------- */
for (const d of ['age', 'item']) if (existsSync(join(SILVER, d))) rmSync(join(SILVER, d), { recursive: true });
buildIndex();
AGES.forEach(buildAge);
items.forEach(buildItem);
buildAbout();
buildPrivacy();
const verified = items.filter(i => i.status === 'verified').length;
console.log(`silver: index 1 + age ${AGES.length} + item ${items.length} + about + privacy = ${3 + AGES.length + items.length} pages`);
console.log(`items verified ${verified}/${items.length}, excluded(발표 전) ${data.meta.excluded.length}`);
