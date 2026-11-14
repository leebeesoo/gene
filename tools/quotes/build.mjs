#!/usr/bin/env node
// 내 상황 명언(/quotes/) 정적 페이지 생성기. 의존성 없음(카드 PNG만 playwright 필요).
//   node tools/quotes/build.mjs            페이지·검색 색인·사이트맵 생성
//   node tools/quotes/build.mjs --cards    + 카드 PNG(바뀐 것만) — tools/quotes/cards.mjs
//   node tools/quotes/build.mjs --check    데이터 검사만
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITUATIONS, TOPICS, TEMPLATES } from './meta.mjs';
import { GTM_HEAD, GTM_BODY } from '../seo/gtm.mjs';

const __dir = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dir, '../..');
const OUT = path.join(ROOT, 'quotes');
const DATA = JSON.parse(fs.readFileSync(path.join(OUT, 'data/quotes.json'), 'utf8'));
// 사이트 주소(2026-11-14 도메인 jaemilab.net 연결). 바꿀 때는 여기 한 곳만.
export const BASE = 'https://jaemilab.net';
const SITE = BASE + '/quotes/';
// 서비스 이름(2026-11-13 확정). 머리글 로고·og:site_name·WebSite 이름·제목 꼬리에 쓴다.
const BRAND = '내 상황 명언';
const BRAND_LINE = '지금 필요한 한 줄, 원문과 출처까지';
const TODAY = DATA.updated;
const args = new Set(process.argv.slice(2));

/* ───────── 검사 ───────── */
const persons = Object.fromEntries(DATA.persons.map(p => [p.id, p]));
const quotes = DATA.quotes;
const byId = Object.fromEntries(quotes.map(q => [q.id, q]));
const checks = DATA.checks;
const sitBySlug = Object.fromEntries(SITUATIONS.map(s => [s.slug, s]));
const topBySlug = Object.fromEntries(TOPICS.map(t => [t.slug, t]));
const STATUSES = ['확인됨', '추정', '출처불명·잘못 알려짐'];

function check() {
  const errs = [];
  const seen = new Set();
  for (const q of quotes) {
    if (seen.has(q.id)) errs.push(`${q.id}: id 중복`);
    seen.add(q.id);
    const p = persons[q.author];
    if (!p) { errs.push(`${q.id}: 인물 ${q.author} 없음`); continue; }
    const died = parseInt(String(p.died).replace(/[^0-9]/g, ''), 10);
    const bc = /기원전/.test(p.died);
    if (!p.classical && !(bc || (died && died <= 1962))) errs.push(`${q.id}: ${p.name} 몰년 ${p.died} — 1962년 이전 사망자만`);
    if (!STATUSES.includes(q.status)) errs.push(`${q.id}: 검증 상태 「${q.status}」`);
    if (q.status === '확인됨' && !q.evidence.length) errs.push(`${q.id}: 확인됨인데 근거 링크 없음`);
    for (const s of q.situations) if (!sitBySlug[s]) errs.push(`${q.id}: 상황 ${s} 없음`);
    for (const t of q.topics) if (!topBySlug[t]) errs.push(`${q.id}: 주제 ${t} 없음`);
    if (!q.text_ko || !q.original) errs.push(`${q.id}: 우리말/원문 비어 있음`);
    if (q.page) {
      const d = q.detail || {};
      const len = (d.background || '').length + (q.note || '').length;
      if (len < 250) errs.push(`${q.id}: 따로 페이지인데 해설 ${len}자(250자 이상 필요)`);
      if (!(d.similar || []).length || !(d.usage || []).length) errs.push(`${q.id}: 따로 페이지에 비슷한 명언·활용 예 필요`);
    }
  }
  for (const g of [...SITUATIONS, ...TOPICS]) {
    const L = g.intro.length + (g.tips || []).join('').length;
    if (L < 250) errs.push(`묶음 ${g.slug}: 소개+활용 팁 ${L}자(250자 이상)`);
    const f = byId[g.featured];
    if (!f || !(f.situations.includes(g.slug) || f.topics.includes(g.slug))) errs.push(`묶음 ${g.slug}: 대표 명언 ${g.featured}가 묶음에 없음`);
  }
  for (const c of checks) if (!c.evidence.length) errs.push(`진위 ${c.slug}: 근거 링크 없음`);
  return errs;
}
const errs = check();
if (errs.length) { console.error('데이터 검사 실패:\n- ' + errs.join('\n- ')); process.exit(1); }
if (args.has('--check')) { console.log('검사 통과:', quotes.length, '개'); process.exit(0); }

/* ───────── 도우미 ───────── */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const br = s => esc(s).replace(/\n/g, '<br>');
const oneLine = s => String(s).replace(/\s*\n\s*/g, ' ');
const LANG_CODE = { '한문': 'zh-Hant', '라틴어': 'la', '독일어': 'de', '영어': 'en', '히브리어': 'he', '한국어': 'ko', '그리스어(영역 인용)': 'en', '영어(원어 미상)': 'en' };
const personPages = DATA.persons.filter(p => quotes.filter(q => q.author === p.id).length >= 3);
const hasPersonPage = id => personPages.some(p => p.id === id);
const sitQuotes = slug => quotes.filter(q => q.situations.includes(slug));
const topQuotes = slug => quotes.filter(q => q.topics.includes(slug));
const shortText = (q, n = 40) => { const t = oneLine(q.text_ko); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
// 우리말 시(줄바꿈이 있는 원문)는 어느 상황이든 「부드럽게」 틀로
const tplOf = q => (q.lang === '한국어' && q.text_ko.includes('\n') ? 'soft' : q.situations[0] ? sitBySlug[q.situations[0]].tpl : 'book');
// 본가: 해설 전체를 싣는 단 한 곳. 첫 번째 상황 > 인물 > 첫 번째 주제
function homeOf(q) {
  if (q.page) return `q/${q.id}/`;
  if (q.situations[0]) return `s/${q.situations[0]}/`;
  if (hasPersonPage(q.author)) return `p/${q.author}/`;
  return `t/${q.topics[0]}/`;
}
const anchorUrl = q => homeOf(q) + (q.page ? '' : '#' + q.id);
const absUrl = rel => SITE + rel;
const cardRel = id => `cards/${id}.png`;
const authorLabel = q => persons[q.author].name + (q.speaker ? `(${q.speaker})` : '');
// 추정: 원문을 못 찾은 말은 「~의 말로 알려져 있어요」로 보여 준다(카드·공유 문구·첫 화면 포함)
const attrLabel = q => authorLabel(q) + (q.status === '추정' ? '의 말로 알려져 있어요' : '');
const STATUS_CLASS = { '확인됨': 'ok', '추정': 'maybe', '출처불명·잘못 알려짐': 'no' };

const ICON = {
  search: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  moon: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  copy: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>',
  share: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  image: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  arrow: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
};
const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M10 14h44v30H30l-12 10V44h-8z' fill='none' stroke='%231D1B1E' stroke-width='5' stroke-linejoin='round'/%3E%3Crect x='20' y='24' width='8' height='10' rx='1' fill='%237A3B69'/%3E%3Crect x='34' y='24' width='8' height='10' rx='1' fill='%237A3B69'/%3E%3C/svg%3E";

/* ───────── 공통 틀 ───────── */
function page({ rel, depth, title, desc, ogTitle, ogImage, ogType = 'website', jsonld, body, bodyClass = '', noindex = false, fonts = 'serif' }) {
  const up = '../'.repeat(depth);
  const canonical = absUrl(rel);
  const img = ogImage ? absUrl(ogImage) : absUrl('cards/og-home.png');
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
${GTM_HEAD}
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${noindex ? '<meta name="robots" content="noindex,follow">\n' : ''}<meta name="theme-color" content="#F7F6F3" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#121113" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${ogType}">
<meta property="og:site_name" content="${BRAND}">
<meta property="og:title" content="${esc(ogTitle || title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(ogTitle || title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${img}">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
${fonts === 'serif' ? `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@400;700&display=swap">
` : ''}<link rel="stylesheet" href="${up}css/quotes.css">
<link rel="stylesheet" href="${up}../common/footer.css">
<link rel="stylesheet" href="${up}../common/ads.css">
<script>try{var t=localStorage.getItem('quotes.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-XXXXXXXXXXXXXXXX" crossorigin="anonymous"></script>
${jsonld ? `<script type="application/ld+json">\n${JSON.stringify(jsonld, null, 1)}\n</script>\n` : ''}</head>
<body class="${bodyClass}" data-root="${up || './'}">
${GTM_BODY}
<a class="sr-only" href="#main">본문 바로가기</a>
<header class="top">
  <div class="top-in">
    <a class="brand" href="${up || './'}" aria-label="${BRAND} 처음으로"><span class="brand-mark" aria-hidden="true"></span>${BRAND}</a>
    <span class="top-sp"></span>
    <a class="icon-btn" href="${up || './'}#search" aria-label="명언 검색">${ICON.search}</a>
    <button class="icon-btn" type="button" data-theme-toggle aria-label="화면 테마 바꾸기">${ICON.moon}</button>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="jl-footer" data-site="quotes" data-home="${up}../" data-copy="번역·해설은 재미랩이 직접 썼어요. 원문은 저작권이 끝난 글만 실어요">
  <div data-notes><p>명언은 저작권 보호기간이 끝난 글(1962년 이전에 세상을 떠난 사람의 글, 고전)만 싣고, 우리말 번역은 재미랩이 원문에서 직접 옮겼어요. 출처가 원문에서 확인된 것은 「확인됨」, 아직 확인하지 못한 것은 「추정」으로 표시해요.</p></div>
  <div data-links><a href="${up}about/">출처 확인 기준</a><a href="${up}check/">진위 확인</a><a href="${up}privacy.html">개인정보처리방침</a></div>
</footer>
<div class="sheet-back" id="shareSheet" hidden>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="shareTitle">
    <p class="sheet-title" id="shareTitle">명언 공유하기</p>
    <p class="sheet-quote" id="shareQuote"></p>
    <div class="sheet-btns">
      <button class="btn btn-accent" type="button" data-share="kakao">카카오톡으로 보내기</button>
      <button class="btn" type="button" data-share="native">다른 앱으로 보내기</button>
      <button class="btn" type="button" data-share="link">링크 복사</button>
      <a class="btn" data-share="image" href="#" download>카드 이미지 저장</a>
    </div>
    <button class="btn btn-ghost sheet-close" type="button" data-share="close">닫기</button>
  </div>
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script src="${up}../common/footer.js" defer></script>
<script src="${up}../common/ads.js" defer></script>
<script src="${up}js/config.js" defer></script>
<script src="${up}js/app.js" defer></script>
</body>
</html>
`;
}

const AD = `<aside class="jl-ad" aria-label="광고"><small>광고</small>
  <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>
</aside>`;

function statusBadge(st) { return `<span class="badge badge-${STATUS_CLASS[st]}">${esc(st)}</span>`; }

function sourceLine(q, up, { linkAuthor = true } = {}) {
  const p = persons[q.author];
  const a = linkAuthor && hasPersonPage(q.author) ? `<a href="${up}p/${q.author}/">${esc(authorLabel(q))}</a>` : esc(authorLabel(q));
  return `${a}${q.status === '추정' ? '의 말로 알려져 있어요' : ''} · ${esc(q.source)}${q.year && q.year !== '미상' ? ` · <span class="num">${esc(q.year)}</span>` : ''}`;
}

// 명언 한 개(목록용). full=true면 본가: 원문·해설·근거까지 / false면 한 줄 + 본가 링크
function quoteBlock(q, up, { full = true, hTag = 'h3' } = {}) {
  const lc = LANG_CODE[q.lang] || 'und';
  const showOrig = q.lang !== '한국어' || q.original !== q.text_ko;
  const shareData = esc(JSON.stringify({ id: q.id, t: oneLine(q.text_ko), a: attrLabel(q), s: q.source, u: anchorUrl(q), c: cardRel(q.id) }));
  const ev = q.evidence.map(e => `<a href="${esc(e.url)}" rel="noopener">${esc(e.label)}</a>`).join(' · ');
  return `<article class="q" id="${q.id}" data-q='${shareData}'>
  <${hTag} class="q-text">${br(q.text_ko)}</${hTag}>
  ${showOrig ? `<p class="q-orig" lang="${lc}"${q.lang === '히브리어' ? ' dir="rtl"' : ''}>${br(q.original)}</p>` : ''}
  <p class="q-meta">${sourceLine(q, up)} ${statusBadge(q.status)}</p>
  ${full ? `<p class="q-note">${esc(q.note)}</p>
  <p class="q-ev">${q.lang !== '한국어' ? `원어: ${esc(q.lang)} · 우리말 번역: 재미랩` : '원문 우리말'}${ev ? ` · 근거: ${ev}` : ' · 근거 링크: 아직 없음(확인 중)'} · 확인일 <span class="num">${esc(q.checked)}</span></p>`
    : `<p class="q-ev"><a href="${up}${anchorUrl(q)}">원문·출처·해설 보기</a></p>`}
  ${q.page && full ? `<p class="q-ev"><a href="${up}q/${q.id}/">이 명언 자세히 보기(배경·비슷한 말·쓰는 법)</a></p>` : ''}
  <div class="q-acts">
    <button class="act" type="button" data-act="copy">${ICON.copy}<span>복사</span></button>
    <button class="act" type="button" data-act="share">${ICON.share}<span>공유</span></button>
    <a class="act" href="${up}${cardRel(q.id)}" target="_blank" rel="noopener">${ICON.image}<span>카드</span></a>
  </div>
</article>`;
}

// 첫 화면 대표 명언(틀별 글자 배치)
function hero(q, tpl, extra = '') {
  const len = oneLine(q.text_ko).length;
  const size = len <= 16 ? 'xl' : len <= 40 ? 'l' : len <= 90 ? 'm' : 's';
  const showOrig = q.lang !== '한국어';
  return `<figure class="hero hero-${tpl} hero-${size}">
  ${extra}
  ${tpl === 'book' && showOrig ? `<p class="hero-orig" lang="${LANG_CODE[q.lang] || 'und'}"${q.lang === '히브리어' ? ' dir="rtl"' : ''}>${br(q.original)}</p>` : ''}
  <blockquote class="hero-text"><p>${br(q.text_ko)}</p></blockquote>
  <figcaption class="hero-cap">${esc(attrLabel(q))}<span>${esc(q.source)}</span></figcaption>
</figure>`;
}

function searchBox(id = 'search', big = false) {
  return `<form class="search${big ? ' search-big' : ''}" role="search" action="#" data-search>
  <label class="sr-only" for="${id}">명언 검색</label>
  ${ICON.search}
  <input id="${id}" type="search" placeholder="낱말·인물·초성(ㄴㅊ)으로 찾기" autocomplete="off" enterkeyhint="search">
  <div class="search-res" hidden></div>
</form>`;
}

function crumbs(items, up) {
  return `<nav class="crumbs" aria-label="현재 위치"><a href="${up || './'}">${BRAND}</a>${items.map(([n, h]) => h ? ` <span aria-hidden="true">›</span> <a href="${h}">${esc(n)}</a>` : ` <span aria-hidden="true">›</span> <span>${esc(n)}</span>`).join('')}</nav>`;
}
function crumbLd(items) {
  return { '@type': 'BreadcrumbList', itemListElement: [[BRAND, ''], ...items].map(([n, rel], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: absUrl(rel) })) };
}
function quotationLd(q) {
  return { '@type': 'Quotation', text: oneLine(q.text_ko), inLanguage: 'ko', url: absUrl(anchorUrl(q)),
    creator: { '@type': 'Person', name: persons[q.author].name, alternateName: persons[q.author].name_orig },
    ...(q.lang !== '한국어' ? { translationOfWork: { '@type': 'CreativeWork', name: q.source, inLanguage: LANG_CODE[q.lang] } } : { isPartOf: { '@type': 'CreativeWork', name: q.source } }) };
}

function chips(list, up, current) {
  return `<ul class="chips">${list.map(([name, href, n]) => `<li><a class="chip${href === current ? ' is-on' : ''}" href="${up}${href}"${href === current ? ' aria-current="page"' : ''}>${esc(name)}${n != null ? ` <span class="num">${n}</span>` : ''}</a></li>`).join('')}</ul>`;
}
const sitChips = up => chips(SITUATIONS.map(s => [s.name, `s/${s.slug}/`, sitQuotes(s.slug).length]), up);
const topChips = up => chips(TOPICS.map(t => [t.name, `t/${t.slug}/`, topQuotes(t.slug).length]), up);
const personChips = up => chips(personPages.map(p => [p.name, `p/${p.id}/`, quotes.filter(q => q.author === p.id).length]), up);

function toc(list) {
  return `<details class="toc" open><summary>이 페이지의 명언 <span class="num">${list.length}</span>개</summary><ol>${list.map(q => `<li><a href="#${q.id}">${esc(shortText(q, 34))}</a> <span class="toc-a">${esc(persons[q.author].name)}</span></li>`).join('')}</ol></details>`;
}

function listWithAds(list, up, fullFn) {
  return list.map((q, i) => quoteBlock(q, up, { full: fullFn(q) }) + (i === 5 && list.length > 9 ? '\n' + AD : '')).join('\n');
}

function bigNumberFor(s) {
  if (s.slug === 'newyear') return `<p class="bignum" data-bignum="newyear"><span class="num">${Number(TODAY.slice(0, 4)) + 1}</span><small>새해</small></p>`;
  if (s.slug === 'exam') return `<p class="bignum" data-bignum="exam"><span class="num">D-day</span><small>수능까지</small></p>`;
  if (s.slug === 'cheer') return `<p class="bignum" data-bignum="today"><span class="num">${TODAY.slice(5).replace('-', '.')}</span><small>오늘도</small></p>`;
  return '';
}

/* ───────── 쓰기 ───────── */
const written = [];
function write(rel, html) {
  const file = path.join(OUT, rel.endsWith('/') || rel === '' ? rel + 'index.html' : rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, html);
  written.push(rel);
}
// 이전 빌드 결과 지우기(생성 폴더만)
for (const d of ['s', 'p', 't', 'q', 'check', 'about']) fs.rmSync(path.join(OUT, d), { recursive: true, force: true });

/* 상황별 */
for (const s of SITUATIONS) {
  const rel = `s/${s.slug}/`, up = '../../';
  const list = sitQuotes(s.slug);
  const f = byId[s.featured];
  const ordered = [f, ...list.filter(q => q !== f)];
  const body = `<div class="wrap">
${crumbs([['상황별', null], [s.name, null]], up)}
<header class="g-head tpl-${s.tpl}">
  <p class="eyebrow">상황별 명언 · ${esc(s.name)}</p>
  <h1>${esc(s.title.split(' — ')[0])}</h1>
  <p class="lead">${esc(s.desc)}</p>
</header>
${hero(f, s.tpl, bigNumberFor(s))}
<section class="intro">
  <p>${esc(s.intro)}</p>
  <h2>이렇게 써 보세요</h2>
  <ul class="tips">${s.tips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>
</section>
${searchBox('search-' + s.slug)}
${toc(ordered)}
<section class="qlist" aria-label="${esc(s.name)} 명언 목록">
${listWithAds(ordered, up, q => homeOf(q) === rel)}
</section>
${AD}
<section class="more">
  <h2>다른 상황의 명언</h2>
  ${chips(SITUATIONS.filter(x => x !== s).map(x => [x.name, `s/${x.slug}/`, sitQuotes(x.slug).length]), up)}
  <h2>주제로 찾기</h2>
  ${topChips(up)}
</section>
</div>`;
  write(rel, page({ rel, depth: 2, title: s.title, desc: s.desc, ogTitle: s.title, ogImage: cardRel(f.id), bodyClass: 'tpl-' + s.tpl,
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', name: s.title, description: s.desc, url: absUrl(rel), inLanguage: 'ko', dateModified: TODAY, hasPart: ordered.map(quotationLd) },
      crumbLd([[`${s.name} 명언`, rel]]) ] }, body }));
}

/* 주제별 */
for (const t of TOPICS) {
  const rel = `t/${t.slug}/`, up = '../../';
  const list = topQuotes(t.slug);
  const f = byId[t.featured];
  const ordered = [f, ...list.filter(q => q !== f)];
  const body = `<div class="wrap">
${crumbs([['주제별', null], [t.name, null]], up)}
<header class="g-head tpl-book">
  <p class="eyebrow">주제별 명언 · ${esc(t.name)}</p>
  <h1>${esc(t.title.split(' — ')[0])}</h1>
  <p class="lead">${esc(t.desc)}</p>
</header>
${hero(f, 'book')}
<section class="intro"><p>${esc(t.intro)}</p><h2>이렇게 써 보세요</h2><ul class="tips">${t.tips.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
${searchBox('search-' + t.slug)}
${toc(ordered)}
<section class="qlist" aria-label="${esc(t.name)} 명언 목록">
${listWithAds(ordered, up, q => homeOf(q) === rel)}
</section>
${AD}
<section class="more"><h2>다른 주제</h2>${chips(TOPICS.filter(x => x !== t).map(x => [x.name, `t/${x.slug}/`, topQuotes(x.slug).length]), up)}<h2>상황으로 찾기</h2>${sitChips(up)}</section>
</div>`;
  write(rel, page({ rel, depth: 2, title: t.title, desc: t.desc, ogImage: cardRel(f.id), bodyClass: 'tpl-book',
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', name: t.title, description: t.desc, url: absUrl(rel), inLanguage: 'ko', dateModified: TODAY, hasPart: ordered.map(quotationLd) },
      crumbLd([[`${t.name} 명언`, rel]]) ] }, body }));
}

/* 인물별 */
for (const p of personPages) {
  const rel = `p/${p.id}/`, up = '../../';
  const list = quotes.filter(q => q.author === p.id);
  const f = list.find(q => q.page) || list.find(q => q.status === '확인됨') || list[0];
  const ordered = [f, ...list.filter(q => q !== f)];
  const ok = list.filter(q => q.status === '확인됨').length;
  const myChecks = checks.filter(c => c.author === p.id);
  const title = `${p.name} 명언 ${list.length}개 — 원문과 출처까지`;
  const desc = `${p.name}(${p.name_orig})의 명언을 ${p.works ? p.works.split(',')[0] + ' 등 ' : ''}원문과 함께 모았어요. 우리말 번역은 원문에서 직접 옮겼고, ${ok}개는 원전에서 문장을 확인했어요.`;
  const life = p.born || p.died ? `<span class="num">${esc(p.born)}${p.born && p.died ? ' ~ ' : ''}${esc(p.died)}</span>` : '';
  const body = `<div class="wrap">
${crumbs([['인물별', null], [p.name, null]], up)}
<header class="g-head tpl-book">
  <p class="eyebrow">인물별 명언</p>
  <h1>${esc(p.name)} 명언</h1>
  <p class="lead">${esc(p.name_orig)} ${life}</p>
</header>
${hero(f, 'book')}
<section class="intro">
  <p>${esc(p.bio)}</p>
  ${p.works ? `<p class="muted">대표 저작: ${esc(p.works)}</p>` : ''}
  <p class="muted">이 페이지 ${list.length}개 가운데 원전에서 문장을 확인한 것 ${ok}개, 출처 확인 중 ${list.length - ok}개.</p>
  ${myChecks.length ? `<p class="muted">${esc(p.name)}의 말로 잘못 알려진 문장: ${myChecks.map(c => `<a href="${up}check/${c.slug}/">${esc(shortText(c, 24))}</a>`).join(', ')}</p>` : ''}
</section>
${toc(ordered)}
<section class="qlist" aria-label="${esc(p.name)} 명언 목록">
${listWithAds(ordered, up, q => homeOf(q) === rel)}
</section>
${AD}
<section class="more"><h2>다른 인물</h2>${chips(personPages.filter(x => x !== p).map(x => [x.name, `p/${x.id}/`, quotes.filter(q => q.author === x.id).length]), up)}</section>
</div>`;
  write(rel, page({ rel, depth: 2, title, desc, ogImage: cardRel(f.id), bodyClass: 'tpl-book',
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', name: title, description: desc, url: absUrl(rel), inLanguage: 'ko', dateModified: TODAY,
        about: { '@type': 'Person', name: p.name, alternateName: p.name_orig }, hasPart: ordered.map(quotationLd) },
      crumbLd([[`${p.name} 명언`, rel]]) ] }, body }));
}

/* 따로 페이지 */
for (const q of quotes.filter(x => x.page)) {
  const rel = `q/${q.id}/`, up = '../../';
  const d = q.detail;
  const p = persons[q.author];
  const t = oneLine(q.text_ko);
  const titleCore = t.length > 26 ? t.slice(0, 25) + '…' : t;
  const title = `${p.name} 「${titleCore}」 원문과 뜻, 출처`;
  const desc = `${p.name}의 「${t.slice(0, 40)}${t.length > 40 ? '…' : ''}」 원문(${q.lang})과 출처(${q.source}), 배경과 쓰는 법을 정리했어요.`;
  const tpl = tplOf(q);
  const body = `<div class="wrap">
${crumbs([[p.name, hasPersonPage(p.id) ? `${up}p/${p.id}/` : null], ['명언 해설', null]], up)}
<header class="g-head tpl-${tpl}">
  <p class="eyebrow">명언 해설 · ${esc(p.name)}</p>
  <h1>${esc(titleCore)}</h1>
</header>
${hero(q, 'book')}
${quoteBlock(q, up, { full: true, hTag: 'h2' })}
<section class="intro">
  <h2>어떤 상황에서 나온 말일까</h2>
  <p>${esc(d.background)}</p>
  <h2>이렇게 써 보세요</h2>
  <ul class="tips">${d.usage.map(u => `<li>${esc(u)}</li>`).join('')}</ul>
</section>
${AD}
<section class="more">
  <h2>함께 읽으면 좋은 명언</h2>
  ${d.similar.map(id => quoteBlock(byId[id], up, { full: false })).join('\n')}
  <h2>이 명언이 들어 있는 묶음</h2>
  ${chips([...q.situations.map(s => [sitBySlug[s].name + ' 명언', `s/${s}/`]), ...q.topics.map(s => [topBySlug[s].name + ' 명언', `t/${s}/`])], up)}
</section>
</div>`;
  write(rel, page({ rel, depth: 2, title, desc, ogType: 'article', ogImage: cardRel(q.id), bodyClass: 'tpl-' + tpl,
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { ...quotationLd(q), url: absUrl(rel), description: d.background.slice(0, 160) },
      { '@type': 'Article', headline: title, description: desc, inLanguage: 'ko', dateModified: TODAY, url: absUrl(rel), image: absUrl(cardRel(q.id)), publisher: { '@type': 'Organization', name: '재미랩' } },
      crumbLd([[p.name + ' 명언', hasPersonPage(p.id) ? `p/${p.id}/` : rel], [titleCore, rel]]) ] }, body }));
}

/* 진위 확인 */
function checkBlock(c, up, full) {
  const who = c.author ? persons[c.author].name : c.attributed;
  const data = esc(JSON.stringify({ id: c.id, t: oneLine(c.text_ko), a: `${who}의 말로 알려짐 — ${c.verdict}`, s: '진위 확인', u: `check/${c.slug}/`, c: cardRel(c.id) }));
  return `<article class="q q-check" id="${c.slug}" data-q='${data}'>
  <p class="stamp stamp-${c.verdict === '작자 논란' ? 'maybe' : 'no'}">${esc(c.verdict)}</p>
  <${full ? 'h2' : 'h3'} class="q-text">${esc(c.text_ko)}</${full ? 'h2' : 'h3'}>
  <p class="q-orig" lang="${LANG_CODE[c.lang]}">${esc(c.original)}</p>
  <p class="q-meta">흔히 알려진 말한 사람: ${esc(who)}</p>
  <p class="q-note"><b>실제로는</b> ${esc(c.real_origin)}</p>
  ${full ? `<p class="q-body">${esc(c.body)}</p>
  ${c.real_quote ? `<div class="realq"><p class="realq-label">${esc(who)}가 실제로 쓴 비슷한 문장</p><p class="realq-text">${esc(c.real_quote.text_ko)}</p><p class="q-orig" lang="en">${esc(c.real_quote.original)}</p><p class="q-meta">${esc(c.real_quote.source)}</p></div>` : ''}
  <p class="q-ev">근거: ${c.evidence.map(e => `<a href="${esc(e.url)}" rel="noopener">${esc(e.label)}</a>`).join(' · ')} · 확인일 <span class="num">${TODAY}</span></p>`
    : `<p class="q-ev"><a href="${up}check/${c.slug}/">근거와 자세한 내용 보기</a></p>`}
  <div class="q-acts">
    <button class="act" type="button" data-act="copy">${ICON.copy}<span>복사</span></button>
    <button class="act" type="button" data-act="share">${ICON.share}<span>공유</span></button>
  </div>
</article>`;
}
{
  const rel = 'check/', up = '../';
  const title = '진짜 그 사람이 한 말일까? 명언 진위 확인';
  const desc = '아인슈타인, 다윈, 간디, 볼테르의 말로 널리 알려진 명언이 실제로는 누구의 말인지 근거 링크와 함께 확인했어요.';
  const body = `<div class="wrap">
${crumbs([['진위 확인', null]], up)}
<header class="g-head tpl-verdict">
  <p class="eyebrow">진위 확인</p>
  <h1>진짜 그 사람이 한 말일까?</h1>
  <p class="lead">${esc(desc)}</p>
</header>
<section class="intro">
  <p>유명한 사람의 이름이 붙으면 말이 더 멀리 퍼져요. 그래서 실제로는 다른 사람이 했거나, 누군가 요약한 문장이 유명인의 직접 인용처럼 도는 일이 많아요. 이 페이지는 그런 문장을 하나씩 골라, 처음 기록된 곳과 근거 자료를 함께 정리해요. 판정은 「잘못 알려짐(다른 사람의 말)」, 「다듬어진 말(비슷한 생각은 했지만 이 문장은 아님)」, 「작자 논란(확정하지 못함)」 세 가지예요. 새 근거가 나오면 판정을 고치고 확인일을 바꿔요.</p>
</section>
<section class="qlist">
${checks.map((c, i) => checkBlock(c, up, false) + (i === 2 ? '\n' + AD : '')).join('\n')}
</section>
</div>`;
  write(rel, page({ rel, depth: 1, title, desc, ogImage: cardRel(checks[0].id), bodyClass: 'tpl-verdict',
    jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'CollectionPage', name: title, description: desc, url: absUrl(rel), inLanguage: 'ko', dateModified: TODAY }, crumbLd([['진위 확인', rel]])] }, body }));
  for (const c of checks) {
    const r = `check/${c.slug}/`, u2 = '../../';
    const who = c.author ? persons[c.author].name : c.attributed;
    const d2 = `${c.real_origin.slice(0, 110)}${c.real_origin.length > 110 ? '…' : ''}`;
    const b = `<div class="wrap">
${crumbs([['진위 확인', `${u2}check/`], [who, null]], u2)}
<header class="g-head tpl-verdict"><p class="eyebrow">진위 확인 · ${esc(who)}</p><h1>${esc(c.title)}</h1></header>
${checkBlock(c, u2, true)}
${AD}
<section class="more"><h2>다른 진위 확인</h2>${checks.filter(x => x !== c).map(x => checkBlock(x, u2, false)).join('\n')}</section>
</div>`;
    write(r, page({ rel: r, depth: 2, title: c.title, desc: d2, ogType: 'article', ogImage: cardRel(c.id), bodyClass: 'tpl-verdict',
      jsonld: { '@context': 'https://schema.org', '@graph': [
        { '@type': 'ClaimReview', url: absUrl(r), datePublished: TODAY, author: { '@type': 'Organization', name: '재미랩' },
          claimReviewed: `${who}가 「${c.text_ko}」라고 말했다`, reviewRating: { '@type': 'Rating', alternateName: c.verdict } },
        crumbLd([['진위 확인', 'check/'], [who, r]]) ] }, body: b }));
  }
}

/* 안내 */
{
  const rel = 'about/', up = '../';
  const ok = quotes.filter(q => q.status === '확인됨').length;
  const title = `출처 확인 기준과 번역 원칙 — ${BRAND}`;
  const desc = `${BRAND}이 어떤 글을 싣고, 출처를 어떻게 확인하고, 번역을 어떻게 하는지 정리했어요. 잘못된 곳을 알려 주시면 고쳐요.`;
  const body = `<div class="wrap doc">
${crumbs([['출처 확인 기준', null]], up)}
<h1>출처 확인 기준과 번역 원칙</h1>
<p class="muted">마지막 갱신 <span class="num">${TODAY}</span> · 명언 ${quotes.length}개 중 확인됨 ${ok}개, 추정 ${quotes.length - ok}개 · 진위 확인 ${checks.length}건</p>
<h2>1. 어떤 글을 싣나요</h2>
<p>저작권 보호기간이 끝난 글만 실어요. 우리나라 저작권법상 1962년 이전에 세상을 떠난 사람의 글은 보호기간이 끝났고, 『논어』·『도덕경』·미쉬나처럼 아주 오래된 고전도 마찬가지예요. 노래 가사, 영화·드라마 대사, 지금 살아 있는 사람의 글은 싣지 않아요.</p>
<h2>2. 번역은 누가 하나요</h2>
<p>우리말 번역은 모두 재미랩이 원문을 보고 직접 옮겼어요. 이미 나와 있는 한국어 번역서나 다른 사이트의 번역 문장은 가져오지 않아요(번역도 저작물이라서요). 『명상록』은 그리스어 원문 대신 퍼블릭 도메인인 조지 롱의 1862년 영어 번역을 원문 칸에 싣고, 그 영어에서 옮겼다고 밝혀 두었어요. 우리말 시는 오늘날 맞춤법으로 띄어 쓰고, 원문 칸에 초판 표기를 함께 실어요.</p>
<h2>3. 「확인됨」과 「추정」은 무엇이 다른가요</h2>
<ul>
  <li><b>확인됨</b>: 원전 전자 텍스트(프로젝트 구텐베르크, 위키문헌, Sefaria, The Latin Library 등)에서 그 문장을 직접 찾았거나, 원문 자료를 인용한 믿을 만한 기관·연구 자료로 날짜와 문헌을 확인한 것. 명언마다 근거 링크와 확인일을 달아요.</li>
  <li><b>추정</b>: 널리 그 사람의 말로 알려져 있고 출처 후보도 있지만, 아직 원문으로 확인하지 못한 것. 확인되면 「확인됨」으로 바꾸고, 다른 사람의 말로 밝혀지면 「진위 확인」으로 옮겨요.</li>
  <li><b>출처불명·잘못 알려짐</b>: 그 사람의 말이 아니라는 근거가 있는 것. 일반 목록에는 넣지 않고 <a href="${up}check/">진위 확인</a>에서만 다뤄요.</li>
</ul>
<h2>4. 잘못된 곳을 알려 주세요</h2>
<p>번역이 어색하거나 출처가 틀렸다면 이메일 <a href="mailto:gdf0620@gmail.com">gdf0620@gmail.com</a> 로 알려 주세요. 확인한 뒤 고치고 확인일을 바꿔요.</p>
<h2>5. 카드 이미지</h2>
<p>공유 카드 이미지는 SIL 오픈 폰트 라이선스(OFL) 글꼴(고운바탕, 검은고딕, 도현, 본명조(Noto Serif KR), 프리텐다드)로 만들어요. 사진은 쓰지 않았어요.</p>
</div>`;
  write(rel, page({ rel, depth: 1, title, desc, body, jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'AboutPage', name: title, url: absUrl(rel), inLanguage: 'ko' }, crumbLd([['출처 확인 기준', rel]])] } }));
}

/* 첫 화면 */
{
  const rel = '', up = '';
  // 오늘의 명언 후보: 짧은 것(카드·위젯에 맞게) — 계절 상황 우선은 화면 JS가 고른다
  const pool = quotes.filter(q => oneLine(q.text_ko).length <= 70).map(q => ({ id: q.id, t: oneLine(q.text_ko), a: attrLabel(q), s: q.source, u: anchorUrl(q), g: q.situations, st: q.status }));
  const seasonal = Object.fromEntries(SITUATIONS.filter(s => s.months.length).map(s => [s.slug, s.months]));
  const dayIdx = Math.floor(Date.parse(TODAY) / 864e5);
  const first = byId[pool[dayIdx % pool.length].id];
  const ok = quotes.filter(q => q.status === '확인됨').length;
  const title = `${BRAND} — 졸업·위로·새해 상황별 명언 모음, 원문과 출처까지`;
  const desc = `졸업·수능·위로·새해·결혼 등 상황별로 고른 명언 ${quotes.length}개. 원문과 출처, 우리말 번역, 진짜 그 사람이 한 말인지까지 확인했어요. 카톡으로 명언 카드를 보낼 수 있어요.`;
  const body = `<div class="wrap">
<section class="home-head">
  <p class="eyebrow">재미랩 · ${BRAND}</p>
  <h1>지금 필요한 한 줄,<br>원문과 출처까지.</h1>
  <p class="lead">상황별로 고른 명언 <span class="num">${quotes.length}</span>개. 원전에서 문장을 확인한 것 <span class="num">${ok}</span>개, 우리말 번역은 원문에서 직접 옮겼어요.</p>
</section>
<section class="today" aria-labelledby="todayH">
  <h2 class="today-h" id="todayH">오늘의 명언 <span class="num" data-today-date>${TODAY.replace(/-/g, '.')}</span></h2>
  <div class="today-card" data-today>
    <p class="today-text">${br(first.text_ko)}</p>
    <p class="today-cap"><span data-today-a>${esc(attrLabel(first))}</span> · <span data-today-s>${esc(first.source)}</span></p>
    <div class="today-acts">
      <a class="btn btn-accent" data-today-link href="${anchorUrl(first)}">원문과 출처 보기</a>
      <button class="btn" type="button" data-today-share>공유</button>
    </div>
  </div>
  <script type="application/json" id="todayPool">${JSON.stringify({ pool, seasonal }).replace(/</g, '\\u003c')}</script>
</section>
<section class="find" id="search-sec">
  <h2>명언 찾기</h2>
  ${searchBox('search', true)}
</section>
<section class="nav-sec">
  <h2>상황별 명언</h2>
  <ul class="sit-grid">${SITUATIONS.map(s => `<li><a href="s/${s.slug}/"><b>${esc(s.name)}</b><span>${esc(shortText(byId[s.featured], 22))}</span><i class="num">${sitQuotes(s.slug).length}개</i></a></li>`).join('')}</ul>
</section>
${AD}
<section class="nav-sec">
  <h2>인물별 명언</h2>
  ${personChips('')}
  <h2>주제별 명언</h2>
  ${topChips('')}
</section>
<section class="nav-sec">
  <h2>진짜 그 사람이 한 말일까?</h2>
  <ul class="check-list">${checks.map(c => `<li><a href="check/${c.slug}/"><span class="stamp stamp-sm stamp-${c.verdict === '작자 논란' ? 'maybe' : 'no'}">${esc(c.verdict)}</span><b>${esc(shortText(c, 30))}</b><span>${esc(c.author ? persons[c.author].name : c.attributed)}의 말로 알려짐</span></a></li>`).join('')}</ul>
  <p class="more-link"><a href="check/">진위 확인 전체 보기</a></p>
</section>
<section class="nav-sec">
  <h2>자세히 읽는 명언</h2>
  <ul class="check-list">${quotes.filter(q => q.page).map(q => `<li><a href="q/${q.id}/"><b>${esc(shortText(q, 30))}</b><span>${esc(persons[q.author].name)} · ${esc(q.source)}</span></a></li>`).join('')}</ul>
</section>
<section class="intro">
  <h2>이 명언 모음은 이렇게 만들었어요</h2>
  <p>인터넷에 도는 명언 중에는 출처가 없거나, 다른 사람의 말이 유명인 이름으로 퍼진 것이 많아요. ${BRAND}은 저작권이 끝난 원문을 직접 찾아 문장을 대조하고, 우리말로 새로 옮겼어요. 원문을 찾지 못한 말은 「추정」으로 따로 표시해요. 자세한 기준은 <a href="about/">출처 확인 기준</a>에 적어 두었어요.</p>
</section>
</div>`;
  write(rel, page({ rel, depth: 0, title, desc, ogTitle: `${BRAND_LINE} — ${BRAND}`, ogImage: 'cards/og-home.png', bodyClass: 'home',
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', name: BRAND, alternateName: '재미랩 ' + BRAND, url: SITE, inLanguage: 'ko', description: desc },
      { '@type': 'CollectionPage', name: title, url: SITE, inLanguage: 'ko', dateModified: TODAY,
        hasPart: SITUATIONS.map(s => ({ '@type': 'CollectionPage', name: s.title, url: absUrl(`s/${s.slug}/`) })) } ] }, body }));
}

/* 검색 색인 */
{
  const idx = [
    ...quotes.map(q => ({ id: q.id, t: oneLine(q.text_ko), o: oneLine(q.original).slice(0, 160), a: persons[q.author].name, k: [...q.situations.map(s => sitBySlug[s].name), ...q.topics.map(t => topBySlug[t].name), persons[q.author].name_orig, q.source].join(' '), u: anchorUrl(q), st: q.status })),
    ...checks.map(c => ({ id: c.id, t: c.text_ko, o: c.original, a: (c.author ? persons[c.author].name : c.attributed), k: '진위 확인 ' + c.verdict, u: `check/${c.slug}/`, st: c.verdict })),
  ];
  fs.writeFileSync(path.join(OUT, 'data/index.json'), JSON.stringify(idx));
}

/* 사이트맵 조각 */
{
  const urls = written.map(r => `  <url><loc>${absUrl(r)}</loc><lastmod>${TODAY}</lastmod></url>`).join('\n');
  fs.writeFileSync(path.join(OUT, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<!-- 내 상황 명언 사이트맵 조각: tools/quotes/build.mjs가 만든다. 사이트맵 색인에 이 파일을 추가하세요. -->\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${absUrl('privacy.html')}</loc><lastmod>${TODAY}</lastmod></url>\n${urls}\n</urlset>\n`);
}

// 카드 목록(cards.mjs가 읽음)
const cardJobs = [
  ...quotes.map(q => ({ id: q.id, tpl: tplOf(q), text: q.text_ko, author: attrLabel(q), source: q.source, year: q.year, status: q.status })),
  ...checks.map(c => ({ id: c.id, tpl: 'verdict', text: c.text_ko, author: (c.author ? persons[c.author].name : c.attributed) + '의 말로 알려짐', source: c.real_origin.split(/(?<=[요다])\.\s/)[0], verdict: c.verdict })),
  { id: 'og-home', tpl: 'home', text: '지금 필요한 한 줄,\n원문과 출처까지.', author: `상황별 명언 ${quotes.length}개`, source: '졸업 · 수능 · 위로 · 새해 · 결혼 · 생일 · 감사' },
];
fs.mkdirSync(path.join(__dir, '.cache'), { recursive: true });
fs.writeFileSync(path.join(__dir, '.cache/card-jobs.json'), JSON.stringify(cardJobs));

console.log(`페이지 ${written.length}개 생성 (상황 ${SITUATIONS.length} · 주제 ${TOPICS.length} · 인물 ${personPages.length} · 따로 ${quotes.filter(q => q.page).length} · 진위 ${checks.length + 1} · 안내 1 · 첫 화면 1), 명언 ${quotes.length}개`);
if (args.has('--cards')) {
  const { buildCards } = await import('./cards.mjs');
  await buildCards(cardJobs, path.join(OUT, 'cards'));
}
