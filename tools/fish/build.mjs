#!/usr/bin/env node
// 물때명당(/fish/) 정적 페이지 생성기. 의존성 없음(Node 18+). ※ 초안: 공개 전이라 모든 쪽에 noindex, 허브·사이트맵·배포에서 빠져 있음.
// 사용: node tools/fish/build.mjs
// 입력: fish/data/rules.json(법령 표) · species.json(어종 글) · zones.json·freshwater.json(파일 자료) · index.json·tide.json·boats.json(API 수집, 2026-11-20 첫 실제 자료)
//       lottomap/data/geo.js(시·도 경계, 명당로드·소원명당과 같은 파일) · common/regions.json(시·군·구 이름·중심) — tools/fish/geo.mjs
// 출력: fish/index.html, species/<slug>/, region/<key>/, point/<slug>/, freshwater/, sources.html, privacy.html, SOURCES.md
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GTM_HEAD, GTM_BODY } from '../seo/gtm.mjs';
import { closedOn, fmtMd, sizeSentence, kstDate, distKm, sidoOfAddress, inPeriod, INDEX_LEVELS, INDEX_CLASS } from './lib.mjs';
import { GEO, proj, POLY, regionAt } from './geo.mjs';
import { preparePoints, prepareBoats, boatsForPoint, nearestTide, boatPlace } from './resolve.mjs';

const SERVICE = '물때명당';            // ← 서비스 이름(한 곳에서만 바꾼다)
const SITE = '혹시나랩';
const BASE = 'https://jaemilab.net/fish/';
const CONTACT = 'gdf0620@gmail.com';
const DRAFT = true;                  // 공개 전 초안: 모든 쪽 noindex
const MIN_SPECIES_CHARS = 800;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const FISH = join(ROOT, 'fish');
const J = f => JSON.parse(readFileSync(join(FISH, 'data', f), 'utf8'));
const RULES = J('rules.json'), SPECIES = J('species.json'), ZONES = J('zones.json'), FW = J('freshwater.json');
const INDEX = J('index.json'), TIDE = J('tide.json'), BOATS = J('boats.json'), STATIONS = J('tide-stations.json');
const CHECKED = RULES.meta.checked;
const BUILD_DAY = kstDate();
const RULE = Object.fromEntries(RULES.rules.map(r => [r.id, r]));
const FIXTURE = INDEX.meta.fixture || TIDE.meta.fixture || BOATS.meta.fixture;

/* ---------- 시·도 ---------- */
const REGIONS = [['서울', 'seoul'], ['부산', 'busan'], ['대구', 'daegu'], ['인천', 'incheon'], ['광주', 'gwangju'], ['대전', 'daejeon'], ['울산', 'ulsan'], ['세종', 'sejong'],
  ['경기', 'gyeonggi'], ['강원', 'gangwon'], ['충북', 'chungbuk'], ['충남', 'chungnam'], ['전북', 'jeonbuk'], ['전남', 'jeonnam'], ['경북', 'gyeongbuk'], ['경남', 'gyeongnam'], ['제주', 'jeju']];
const RKEY = Object.fromEntries(REGIONS), RNAME = Object.fromEntries(REGIONS.map(([n, k]) => [k, n]));
const COASTAL = ['incheon', 'gyeonggi', 'chungnam', 'jeonbuk', 'jeonnam', 'gyeongnam', 'busan', 'ulsan', 'gyeongbuk', 'gangwon', 'jeju'];
const SEA_OF = { incheon: '서해', gyeonggi: '서해', chungnam: '서해', jeonbuk: '서해', jeonnam: '서해·남해', gyeongnam: '남해', busan: '남해·동해', ulsan: '동해', gyeongbuk: '동해', gangwon: '동해', jeju: '제주 바다' };
// 법령·자료에서 지역 예외를 찾을 때 쓰는 이름(별표의 표기)
const LAW_NAMES = { incheon: ['인천'], gyeonggi: ['경기'], chungnam: ['충남', '충청남도'], jeonbuk: ['전북'], jeonnam: ['전남', '여수', '무안', '영광'], gyeongnam: ['경남', '경상남도'], busan: ['부산'], ulsan: ['울산'], gyeongbuk: ['경북', '경상북도', '울릉', '독도'], gangwon: ['강원'], jeju: ['제주', '추자'] };
const REGION_INTRO = {
  incheon: '인천 바다는 서해에 있고, 영흥도·덕적도·백령도처럼 섬이 많아요. 서해는 밀물과 썰물의 차가 커서 물이 빠지면 갯벌과 갯바위가 넓게 드러났다가 금방 다시 잠겨요. 물때표 없이 갯벌이나 섬 둘레 갯바위에 들어가면 고립될 수 있어요.',
  gyeonggi: '경기 바다는 화성·안산·시흥·평택에 걸친 서해 연안이에요. 넓은 갯벌과 방조제가 많아 해루질과 방파제 낚시를 하는 사람이 많아요. 서해 갯벌은 밀물이 빠르게 들어오니 해가 진 뒤에는 특히 조심하고, 해경이 정한 출입통제구역에는 들어가지 마세요.',
  chungnam: '충남 바다는 태안·보령·서천·당진에 걸친 서해예요. 태안의 안흥항과 신진도 일대는 선상 낚시가 활발하다고 알려져 있어요. 갯바위와 방파제가 많은 만큼 물때와 파고를 함께 확인하세요.',
  jeonbuk: '전북 바다는 군산·부안·고창의 서해예요. 고군산군도와 위도, 어청도 같은 섬이 있어요. 섬으로 가는 배편은 날씨에 따라 끊길 수 있으니 돌아오는 배 시간과 기상 예보를 함께 보세요.',
  jeonnam: '전남 바다는 서해와 남해에 걸쳐 있고 섬이 매우 많아요. 법령에는 전남광주통합특별시로 적혀 있어요. 가거도·거문도·추자도 가까운 바다처럼 먼 섬 갯바위 낚시는 배를 타고 들어가 내려야 해서, 기상이 나빠지면 나오기 어려워요.',
  gyeongnam: '경남 바다는 통영·거제·남해·사천의 남해예요. 섬과 만이 복잡하게 얽혀 있어 갯바위·방파제·선상 낚시가 고루 이뤄진다고 알려져 있어요. 양식장이 많은 바다라 시설에 배를 묶거나 올라가지 마세요.',
  busan: '부산 바다는 남해와 동해가 만나는 곳이에요. 항만과 방파제가 많고, 국립해양조사원 낚시금지구역 자료에도 부산 앞바다의 제한구역이 여럿 들어 있어요. 항만 시설과 제한구역에는 들어가지 마세요.',
  ulsan: '울산 바다는 동해 남쪽이에요. 국립해양조사원 낚시금지구역 자료의 많은 구역이 울산 항만 일대에 있어요. 항만과 산업 시설 둘레의 방파제는 출입이 막힌 곳이 많으니 안내판을 꼭 보세요.',
  gyeongbuk: '경북 바다는 포항·경주·영덕·울진과 울릉도·독도의 동해예요. 동해는 서해보다 밀물과 썰물의 차가 작지만, 너울성 파도가 갑자기 밀려올 수 있어 방파제와 갯바위에서 특히 조심해야 해요.',
  gangwon: '강원 바다는 고성에서 삼척까지 이어지는 동해예요. 항구마다 방파제가 있고 선상 낚시도 많아요. 겨울철 동해는 바람이 세고 너울이 높아지는 날이 많으니 파고 예보를 꼭 보세요.',
  jeju: '제주 바다는 섬을 둘러싼 갯바위가 많고, 추자도처럼 배를 타고 가는 섬도 있어요. 바람이 강한 날이 많아 파고가 빠르게 높아질 수 있어요. 소라·전복·오분자기처럼 제주에만 따로 정한 금어기·금지체장도 있어요.'
};

/* ---------- 지도 ---------- */
const ORDER = Object.keys(GEO.regions).sort((a, b) => GEO.regions[b].d.length - GEO.regions[a].d.length);
function mapSvg({ points = [], zones = [], up, sel = null, linkRegions = false, label, viewBox = '72 -2 252 428', r = 4.2, x = 3.2 }) {
  const regs = ORDER.map(k => {
    const cls = `rg${COASTAL.includes(k) ? ' has' : ''}${sel === k ? ' sel' : ''}`;
    return linkRegions && COASTAL.includes(k)
      ? `<a href="${up}region/${k}/" aria-label="${RNAME[k]} 바다 보기"><path class="${cls} lk" d="${GEO.regions[k].d}"></path></a>`
      : `<path class="${cls}" d="${GEO.regions[k].d}"></path>`;
  }).join('');
  const zs = zones.map(z => { const [cx, cy] = proj(z.lat, z.lng); return `<g class="zx"><title>들어가지 마세요: ${esc(z.name)}</title><path d="M${(cx - x).toFixed(1)},${(cy - x).toFixed(1)}L${(cx + x).toFixed(1)},${(cy + x).toFixed(1)}M${(cx + x).toFixed(1)},${(cy - x).toFixed(1)}L${(cx - x).toFixed(1)},${(cy + x).toFixed(1)}"/></g>`; }).join('');
  const ds = points.map(p => { const [cx, cy] = proj(p.lat, p.lng); return `<a href="${up}point/${p.slug}/" aria-label="${esc(p.name)} 물때·지수"><circle class="dot" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}"><title>${esc(p.name)}</title></circle></a>`; }).join('');
  return `<svg viewBox="${viewBox}" role="img" aria-label="${esc(label)}"><g>${regs}</g><g>${zs}</g><g>${ds}</g></svg>`;
}
const LEGEND = (pts = true) => `<p class="maplegend">${pts ? `<span><i class="lg-dot"></i>바다낚시지수 지점${FIXTURE ? '(예시)' : ''}</span>` : ''}<span><svg class="lg-x" viewBox="0 0 10 10" aria-hidden="true"><path d="M2,2L8,8M8,2L2,8"/></svg>들어가지 마세요(금지·통제구역)</span></p>`;

/* ---------- 자료 정리 ---------- */
// 지점: 실제 응답은 구분(갯바위/선상)과 상관없이 같은 49곳이 와서 이름으로 묶는다(resolve.mjs preparePoints)
const PREP = preparePoints(INDEX.points);
const points = PREP.points;
const BP = prepareBoats(BOATS.boats, points, TIDE.stations);
const boatsAll = BP.boats;
const ZONE_KM = 5;
const allZones = [...ZONES.ban.map(z => ({ ...z, rk: regionAt(z.lat, z.lng) })), ...ZONES.control.map(z => ({ ...z, rk: RKEY[sidoOfAddress(z.address.replace(/^인천시/, '인천광역시'))] || regionAt(z.lat, z.lng) }))];
const fwSpots = FW.spots.map(s => ({ ...s, sido: sidoOfAddress(s.address) || (s.lat ? RNAME[regionAt(s.lat, s.lng)] : null) }));
// 조석 예보지점: 받아 둔 예보지점 중 좌표가 가장 가까운 곳(거리와 함께 보여 줌)
const tideFor = p => nearestTide(p, TIDE.stations);
const speciesByRule = {};
for (const s of SPECIES.species) for (const id of s.rules) speciesByRule[id] = s;
const speciesByName = name => SPECIES.species.find(s => s.name === name || s.also.split('·').includes(name) || s.rules.some(id => RULE[id].name === name || (RULE[id].alias || []).includes(name)));

/* ---------- 공통 조각 ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hangul = s => (String(s).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').match(/[가-힣]/g) || []).length;
const fmtDate = d => d.replace(/-/g, '.');
const ACC = '%230B6474';
const FAVICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cpath d='M6 40c8-8 14-8 20 0s12 8 20 0 10-6 12-4' fill='none' stroke='${ACC}' stroke-width='6' stroke-linecap='round'/%3E%3Ccircle cx='44' cy='16' r='8' fill='none' stroke='%2316201F' stroke-width='5'/%3E%3C/svg%3E`;
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 15c3-3 5-3 7.5 0s5 3 7.5 0 4-2.5 5-1.5"/><path d="M2 19.5c3-3 5-3 7.5 0s5 3 7.5 0 4-2.5 5-1.5"/><circle cx="16.5" cy="6.5" r="3"/></svg>';
const I = {
  moon: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  search: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  vest: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3l-4 3v14h6v-6h4v6h6V6l-4-3"/><path d="M8 3c0 2 1.8 4 4 4s4-2 4-4"/></svg>',
  people: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="8" r="3"/><circle cx="16.5" cy="9" r="2.5"/><path d="M2.5 20c.5-3.5 3-5.5 5.5-5.5s5 2 5.5 5.5"/><path d="M14 15.2c.8-.5 1.6-.7 2.5-.7 2.2 0 4.2 1.7 4.6 4.8"/></svg>',
  wave: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0 4.5-2.5 6 0"/><path d="M2 17c2.5-2.5 4.5-2.5 7 0s4.5 2.5 7 0 4.5-2.5 6 0"/><path d="M6 7c1.5-1.5 3-1.5 4.5 0"/></svg>',
  stop: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>'
};

function head({ title, desc, path, up, jsonld }) {
  const url = BASE + path;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
${GTM_HEAD}
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
${DRAFT ? '<meta name="robots" content="noindex">\n' : ''}<meta name="theme-color" content="#E7F0F1" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#2A393F" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="${up}css/style.css">
<link rel="stylesheet" href="${up}../common/footer.css">
<script>try{var t=localStorage.getItem('fish.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
${jsonld ? `<script type="application/ld+json">\n${JSON.stringify(jsonld)}\n</script>\n` : ''}</head>
<body>
${GTM_BODY}
<a class="sr-only" href="#main">본문 바로가기</a>
<header class="top">
  <div class="top-in">
    <a class="brand" href="${up}" aria-label="${SERVICE} 처음으로">${LOGO}<span>${SERVICE}</span></a>
    ${DRAFT ? '<span class="draft-tag">초안</span>' : ''}
    <span class="top-sp"></span>
    <button class="tbtn" type="button" id="btnTheme" aria-label="화면 밝기 바꾸기">${I.moon}</button>
  </div>
</header>
`;
}
const FOOT_NOTE = `<p>${SERVICE}은 국가법령정보센터 법령 원문과 공공데이터포털 자료를 옮겨 정리한 참고용 안내예요. 바다낚시지수·물때는 예보이며 조과를 보장하지 않아요. 금어기·금지체장은 법령 원문이 우선이고, 고시·조례로 달라질 수 있어요. 법령 확인일 ${fmtDate(CHECKED)}.</p>`;
function foot(up) {
  return `
<footer class="jl-footer" data-site="fish" data-home="${up}../" data-copy="회원가입·위치 수집 없이 보는 안내예요">
  <div data-notes>${FOOT_NOTE}</div>
  <div data-links><a href="${up}">${SERVICE} 처음으로</a><a href="${up}#rules">금어기·금지체장 표</a><a href="${up}sources.html">출처·라이선스</a><a href="${up}privacy.html">개인정보처리방침</a></div>
</footer>
<script src="${up}../common/footer.js" defer></script>
<script src="${up}js/app.js" defer></script>
</body>
</html>
`;
}
const SAFETY = `<section class="safety" aria-labelledby="safe-h">
  <h2 id="safe-h">먼저 안전부터 확인하세요</h2>
  <ul>
    <li>${I.vest}<span><b>구명조끼를 입으세요.</b> 갯바위·방파제·배 위 어디서나 입어요.</span></li>
    <li>${I.people}<span><b>혼자 가지 마세요.</b> 일행과 함께 가고, 가족에게 장소와 돌아올 시각을 알려 두세요.</span></li>
    <li>${I.wave}<span><b>파고를 보세요.</b> 파도가 높거나 풍랑·너울 특보가 있으면 가지 마세요. <a href="https://www.weather.go.kr/w/ocean/forecast/daily-forecast.do" target="_blank" rel="noopener">기상청 해상예보</a></span></li>
  </ul>
  <p class="safe-note">예보이며 조과를 보장하지 않아요. 위급하면 119에 신고하세요.</p>
</section>`;
const FIX_BANNER = FIXTURE ? `<p class="fixture" role="note"><b>초안 화면이에요.</b> 지점·바다낚시지수·물때·낚시어선 값은 공공데이터 명세 모양을 흉내 낸 <b>예시 자료</b>이고 실제 예보가 아니에요. 금어기·금지체장 표와 금지·통제구역, 민물 낚시터 목록은 실제 공공 자료예요.</p>` : '';
const LAW_NOTE = `<p class="lawnote"><b>법령 원문이 우선이에요.</b> 이 표는 ${esc(RULES.meta.laws.sea1.name.split(' [')[0])} 별표 1·2와 내수면어업법 시행령 별표 1을 ${fmtDate(CHECKED)}에 옮겨 적은 것이에요. 해양수산부 고시, 시·도 고시, 조례로 기간·크기가 달라질 수 있어요.</p>`;
const lawLink = k => { const l = RULES.meta.laws[k]; return `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name.replace(/ \([^)]*\)$/, '').replace(/ 수산자원의.*| 내수면 수산자원의.*/, ''))}</a>`; };
const kakaoSearch = q => `https://map.kakao.com/link/search/${encodeURIComponent(q)}`;
const naverSearch = q => `https://map.naver.com/p/search/${encodeURIComponent(q)}`;
const shopLinks = port => `<div class="acts"><a class="btn" href="${kakaoSearch(`${port} 낚시`)}" target="_blank" rel="noopener">${I.search}카카오맵에서 「${esc(port)} 낚시」</a><a class="btn" href="${naverSearch(`${port} 낚시`)}" target="_blank" rel="noopener">${I.search}네이버 지도에서 「${esc(port)} 낚시」</a></div>`;

/* ---------- 실제 자료 표시 ---------- */
const IDX = v => `<span class="idx idx-${INDEX_CLASS[v] || 'l0'}">${esc(v || '—')}</span>`;
const lvl = v => { const i = INDEX_LEVELS.indexOf(v); return i < 0 ? 99 : i; }; // 0 = 매우좋음
/** 지점의 첫 예보 때(날짜·오전오후)와 그때 어종별 지수 가운데 가장 높은 값·가장 낮은 값 */
function firstSlot(p) {
  const d0 = p.days[0];
  if (!d0) return null;
  const rows = p.days.filter(d => d.date === d0.date && d.ampm === d0.ampm);
  const sorted = rows.map(d => d.index).filter(Boolean).sort((a, b) => lvl(a) - lvl(b));
  return { date: d0.date, ampm: d0.ampm, best: sorted[0] || '', worst: sorted[sorted.length - 1] || '', n: rows.length };
}
const slotLabel = (date, ampm) => `${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))} ${ampm === '일' ? '하루' : ampm}`;
const DATA_META = `<p class="small datameta">자료: 바다낚시지수 ${fmtDate(INDEX.meta.fetched)} 받음(공공데이터포털 ${INDEX.meta.dataset}) · 조석예보 ${fmtDate(TIDE.meta.fetched)}(${TIDE.meta.dataset}) · 낚시어선 신고정보 ${fmtDate(BOATS.meta.fetched)}(${BOATS.meta.dataset}) · <a href="${'{UP}'}sources.html">출처</a></p>`;
const dataMeta = up => DATA_META.replace('{UP}', up);

/* ---------- 규칙 표시 ---------- */
function ruleClosed(r) {
  if (r.notice) return `<b>고시로 정해요</b> · ${esc(r.notice.text)}`;
  if (!r.closed) return '전국 공통 금어기 없음';
  return esc(r.closedText);
}
function ruleRow(r, up) {
  const sp = speciesByRule[r.id];
  const name = sp ? `<a href="${up}species/${sp.slug}/">${esc(r.name)}</a>` : esc(r.name);
  return `<tr id="r-${r.id}"><th scope="row">${name}${r.alias ? `<small>${esc(r.alias.join('·'))}</small>` : ''}</th><td>${ruleClosed(r)}</td><td>${r.size ? esc(r.sizeText) : '—'}</td></tr>`;
}
function rulesTable(up) {
  const groups = [['어류', '바다 물고기'], ['갑각류', '게·새우'], ['패류', '조개·고둥'], ['해조류', '해조류'], ['기타', '오징어·문어·해삼'], ['민물', '민물(내수면)']];
  return groups.map(([g, label]) => {
    const rows = RULES.rules.filter(r => r.group === g);
    return `<h3>${label} <small class="num">${rows.length}종</small></h3><div class="tbl"><table class="rules"><thead><tr><th scope="col">어종</th><th scope="col">금어기(잡으면 안 되는 기간)</th><th scope="col">금지체장(이 크기 이하 금지)</th></tr></thead><tbody>${rows.map(r => ruleRow(r, up)).join('')}</tbody></table></div>`;
  }).join('');
}
const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
/** 12달 띠: 그 달에 하루라도 금어기면 칠함(지역 한정 기간은 옅게) */
function monthStrip(rs) {
  const cells = MONTH_DAYS.map((n, i) => {
    const mm = String(i + 1).padStart(2, '0');
    let full = false, part = false, notice = false;
    for (const r of rs) {
      for (let d = 1; d <= n; d++) {
        const md = `${mm}-${String(d).padStart(2, '0')}`;
        for (const p of r.closed || []) if (inPeriod(md, p.from, p.to)) (p.where ? (part = true) : (full = true));
        if (r.notice && inPeriod(md, r.notice.from, r.notice.to)) notice = true;
      }
    }
    const cls = full ? 'm-full' : part ? 'm-part' : notice ? 'm-notice' : '';
    const t = full ? '금어기' : part ? '일부 지역 금어기' : notice ? '고시 기간 가능' : '금어기 아님';
    return `<li class="${cls}"><span>${i + 1}월</span><small>${t}</small></li>`;
  }).join('');
  return `<ol class="months" aria-label="달별 금어기">${cells}</ol><p class="small">진한 칸: 그 달에 금어기가 걸쳐 있어요. 옅은 칸: 일부 지역·해역만, 또는 고시로 정하는 기간이 걸칠 수 있는 달이에요. 정확한 날짜는 위 문장과 원문을 보세요.</p>`;
}

/* ---------- 쓰기 ---------- */
const report = [];
function write(rel, html, { minUnique = 0, unique = '' } = {}) {
  if (minUnique && hangul(unique) < minUnique) throw new Error(`${rel}: 고유 글 ${hangul(unique)}자 < ${minUnique}자`);
  if (DRAFT && !html.includes('<meta name="robots" content="noindex">')) throw new Error(`${rel}: noindex 없음`);
  if (/0\d{1,2}-\d{3,4}-\d{4}/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) throw new Error(`${rel}: 전화번호 모양이 들어감`);
  const f = join(FISH, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
  report.push({ rel, chars: hangul(html.replace(/<footer[\s\S]*<\/footer>/, '')), unique: unique ? hangul(unique) : null });
}
const crumbLd = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });

/* ---------- 첫 화면 ---------- */
const FAQ = [
  ['바다낚시지수가 「좋음」이면 잘 잡히나요?', '알 수 없어요. 바다낚시지수는 국립해양조사원이 물때·파고·수온·유속 같은 예보 값을 묶어 다섯 단계로 나타낸 예보예요. 조과를 약속하지 않고, 날씨가 바뀌면 예보도 바뀌어요. 지수와 상관없이 파고와 기상특보를 먼저 보세요.'],
  ['금어기·금지체장은 어디서 정하나요?', '바다 어종은 수산자원관리법 시행령 별표 1(금어기)·별표 2(금지체장), 민물 어종은 내수면어업법 시행령 별표 1에 있어요. 고등어·꽃게처럼 해마다 해양수산부가 고시하는 것, 낙지·참문어처럼 시·도가 따로 고시할 수 있는 것도 있어요. 이 쪽의 표는 원문을 옮긴 참고용이고, 법령 원문이 우선이에요.'],
  ['낚시인도 처벌받나요?', `네. ${RULES.meta.penalty} 잡은 수산물을 파는 것도 금지돼요.`],
  ['낚시 포인트를 알려 주나요?', '아니요. 이 서비스는 국립해양조사원이 예보하는 지점의 물때와 지수, 그리고 들어가면 안 되는 곳만 보여 줘요. 낚시 앱·커뮤니티의 포인트·조황·사진은 쓰지 않아요. 낚시금지구역과 출입통제구역은 「들어가지 마세요」로만 표시해요.'],
  ['낚싯배 연락처는 왜 없나요?', '해양수산부 낚시어선업 신고정보에는 배 이름·선적항·승객 수·신고 유효기간이 있어요. 신고 유효기간이 끝난 배는 빼고 보여 주지만, 실제 영업 여부와 연락처는 알 수 없어서 싣지 않아요. 영업·연락처는 직접 확인하세요.'],
  ['틀린 내용을 알려 주고 싶어요.', `이메일 ${CONTACT} 로 보내 주세요. 법령 원문과 공공 자료로 확인해 고치고 확인일을 새로 적어요.`]
];
const pointItem = up => p => { const f = firstSlot(p); return `<li><a href="${up}point/${p.slug}/"><b>${esc(p.name)}</b><span>${esc(p.gubun)}${f && f.n > 1 ? ` · 어종 ${f.n}가지` : ''}</span></a>${IDX(f?.best)}</li>`; };
function buildIndex() {
  const up = '';
  const today = closedOn(RULES.rules, BUILD_DAY.slice(5));
  const sea = points.slice().sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const rulesForJs = RULES.rules.map(r => ({ id: r.id, n: r.name, c: (r.closed || []).map(p => [p.from, p.to, p.where || '']), x: r.notice ? [r.notice.from, r.notice.to] : null, s: speciesByRule[r.id]?.slug || null }));
  const bandItem = x => { const sp = speciesByRule[x.id]; const nm = sp ? `<a href="species/${sp.slug}/">${esc(x.name)}</a>` : esc(x.name); return `<li class="${x.kind === 'notice' ? 'is-notice' : x.partial ? 'is-part' : ''}">${nm}${x.kind === 'notice' ? '<small>고시 확인</small>' : x.where.length ? `<small>${esc(x.where.join(', '))}</small>` : ''}</li>`; };
  const html = head({
    title: `오늘 금어기·물때·바다낚시지수 | ${SERVICE}`,
    desc: `오늘 금어기인 어종, 금지체장 표(법령 원문 대조), 바다낚시지수 지점의 물때와 들어가면 안 되는 곳을 한 화면에. 예보이며 조과를 보장하지 않아요.`,
    path: '', up,
    jsonld: { '@context': 'https://schema.org', '@graph': [{ '@type': 'WebSite', name: SERVICE, url: BASE, inLanguage: 'ko' }, { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] }
  }) + `
<main id="main" class="wrap" tabindex="-1">
  <div class="hero">
    <h1>오늘 잡으면 안 되는 물고기부터, ${SERVICE}</h1>
    <p class="lead">낚시 가기 전에 세 가지를 봐요. 오늘 금어기인 어종, 놓아줘야 하는 크기, 들어가면 안 되는 곳. 바다낚시지수와 물때는 국립해양조사원 예보를 그대로 옮겨요.</p>
    <section class="band" aria-labelledby="band-h">
      <h2 id="band-h"><span id="bandDate">${fmtMd(BUILD_DAY.slice(5))}</span> 금어기인 어종 <small class="num" id="bandCount">${today.length}종</small></h2>
      <ul class="band-list" id="bandList">${today.map(bandItem).join('')}</ul>
      <p class="small">날짜는 이 기기의 한국 시간으로 매일 다시 계산해요. 옅은 칩은 일부 지역·해역만 해당하거나 고시로 날짜가 정해지는 어종이에요. <a href="#rules">전체 표 보기</a></p>
    </section>
  </div>
  ${FIX_BANNER}
  ${SAFETY}
  <div class="board">
    <div class="mapbox">
      ${mapSvg({ points: sea, zones: allZones, up, linkRegions: true, label: `바다낚시지수 지점 ${sea.length}곳과 금지·통제구역 ${allZones.length}곳 지도` })}
      ${LEGEND()}
      <p class="small">바다에 닿은 시·도를 누르면 그 지역 쪽으로 가요. ✕ 표시는 낚시 장소가 아니라 <b>들어가면 안 되는 곳</b>이에요.</p>
    </div>
    <div>
      <h2 class="h-tight">바다낚시지수 지점 <small class="num">${sea.length}곳</small></h2>
      ${COASTAL.map(k => { const l = sea.filter(p => p.rk === k); return l.length ? `<h3 class="h-sido"><a href="region/${k}/">${RNAME[k]}</a> <small class="num">${l.length}곳</small></h3><ul class="plist">${l.map(pointItem('')).join('')}</ul>` : ''; }).join('')}
      <p class="small">국립해양조사원이 예보하는 지점만 보여 줘요(갯바위 ${sea.filter(p => p.gubun === '갯바위').length}곳·선상 ${sea.filter(p => p.gubun === '선상').length}곳). 칩은 ${esc(slotLabel(sea[0].days[0].date, sea[0].days[0].ampm))} 예보에서 어종별 지수 가운데 가장 높은 값이에요. 예보이며 조과를 보장하지 않아요.</p>
      ${dataMeta(up)}
      <h2 class="h-tight">바다 낀 시·도</h2>
      <div class="linkgrid">${COASTAL.map(k => `<a class="chip" href="region/${k}/">${RNAME[k]}</a>`).join('')}</div>
      <h2 class="h-tight">어종별 금어기·금지체장</h2>
      <div class="linkgrid">${SPECIES.species.map(s => `<a class="chip" href="species/${s.slug}/">${esc(s.name)}${s.also && s.also !== '민물' ? `<small>${esc(s.also)}</small>` : ''}</a>`).join('')}</div>
      <p class="small"><a href="freshwater/">민물 허가 낚시터 ${fwSpots.length}곳(행정안전부 표준데이터)</a></p>
    </div>
  </div>
  <section id="rules" aria-labelledby="rules-h">
    <h2 id="rules-h">금어기·금지체장 전체 표 <small class="num">${RULES.rules.length}종</small></h2>
    ${LAW_NOTE}
    <p>「이하」는 그 크기도 포함해요. 25센티미터 이하가 금지라면 딱 25센티미터도 놓아줘야 해요. 길이는 어류는 전장(주둥이~꼬리지느러미 끝), 갈치는 항문장, 게는 두흉갑장(머리·가슴 껍데기 길이), 오징어는 외투장으로 재요.</p>
    ${rulesTable(up)}
    <p class="small">${esc(RULES.meta.females)} 원문: ${lawLink('sea1')} · ${lawLink('sea2')} · ${lawLink('inland1')}</p>
  </section>
  <section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">자주 묻는 질문</h2>${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>
</main>
<script type="application/json" id="rulesData">${JSON.stringify(rulesForJs).replace(/</g, '\\u003c')}</script>
` + foot(up);
  write('index.html', html);
}

/* ---------- 어종 ---------- */
function buildSpecies(s) {
  const up = '../../';
  const rs = s.rules.map(id => RULE[id]);
  const where = points.filter(p => p.days.some(d => d.species === s.name || (s.also && s.also.split('·').includes(d.species)) || rs.some(r => r.name === d.species)));
  const ruleBox = rs.length ? rs.map(r => `<div class="rulebox">
      <h2 class="h-tight">${esc(r.name)} <small>${esc(r.sci)}</small></h2>
      <dl class="kv2">
        <dt>금어기</dt><dd>${ruleClosed(r)}</dd>
        <dt>금지체장</dt><dd>${r.size ? `${esc(r.sizeText)}<br><small>${esc(sizeSentence(r))}</small>` : '없음'}</dd>
        ${r.female ? `<dt>암컷</dt><dd>${esc(RULES.meta.females)}</dd>` : ''}
        <dt>근거</dt><dd>${[r.closedLaw, r.closedLaw2, r.sizeLaw, r.sizeLaw2].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).map(lawLink).join(' · ')}</dd>
      </dl>
    </div>`).join('') + monthStrip(rs) : `<div class="rulebox"><h2 class="h-tight">전국 공통 금어기·금지체장 없음</h2><p>내수면어업법 시행령 별표 1(${fmtDate(CHECKED)} 확인)에 ${esc(s.name)} 행이 없어요. 지자체 낚시통제구역·조례·낚시터 규칙은 따로 확인하세요. 원문: ${lawLink('inland1')}</p></div>`;
  const unique = [s.summary, ...s.sections.flatMap(x => [x.h, ...x.p])].join(' ');
  const srcs = [...new Set(rs.flatMap(r => [r.closedLaw, r.closedLaw2, r.sizeLaw, r.sizeLaw2]).filter(Boolean)), 'act'];
  if (!rs.length) srcs.unshift('inland1');
  const extra = s.slug === 'gwangeo' ? [['세계일보, 「해수부, 광어 금지체장 21→35㎝로」(2020. 10. 8.)', 'https://www.segye.com/newsView/20201008527767']] : [];
  if (['bungeo', 'ssogari'].includes(s.slug)) extra.push(['낚시 관리 및 육성법 제5조·제6조·제7조', 'https://www.law.go.kr/법령/낚시관리및육성법']);
  if (s.slug === 'jukkumi') extra.push(['낚시 관리 및 육성법 제5조(낚시제한기준)', 'https://www.law.go.kr/법령/낚시관리및육성법']);
  const others = SPECIES.species.filter(x => x.slug !== s.slug && x.water === s.water).slice(0, 12);
  const title = `${s.name}${s.also && s.also !== '민물' ? `(${s.also})` : ''} 금어기·금지체장 — 법령 원문 기준 | ${SERVICE}`;
  const html = head({
    title, desc: `${s.summary} ${s.name}의 금어기·금지체장과 재는 법, 처벌, 헷갈리기 쉬운 어종을 법령 원문으로 정리했어요.`,
    path: `species/${s.slug}/`, up,
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbLd([[SERVICE, BASE], [s.name, `${BASE}species/${s.slug}/`]])] }
  }) + `
<main id="main" class="wrap" tabindex="-1">
  <div class="hero">
    <p class="crumb"><a href="${up}">${SERVICE}</a> › 어종 › ${esc(s.name)}</p>
    <h1>${esc(s.name)}${s.also && s.also !== '민물' ? ` <span class="h1-sub">${esc(s.also)}</span>` : ''}</h1>
    <p class="lead">${esc(s.summary)}</p>
  </div>
  ${ruleBox}
  ${LAW_NOTE}
  <div class="prose">
${s.sections.map(x => `  <h2>${esc(x.h)}</h2>\n${x.p.map(t => `  <p>${esc(t)}</p>`).join('\n')}`).join('\n')}
  </div>
  <p class="penalty"><b>처벌</b> ${esc(RULES.meta.penalty)}</p>
  ${where.length ? `<section aria-labelledby="w-h"><h2 id="w-h">바다낚시지수에서 대상어로 나오는 지점${FIXTURE ? ' <small>(예시 자료)</small>' : ''}</h2><div class="related">${where.map(p => `<a class="chip" href="${up}point/${p.slug}/">${esc(p.name)}</a>`).join('')}</div><p class="small">예보이며 조과를 보장하지 않아요. 금어기에는 지수와 상관없이 잡으면 안 돼요.</p></section>` : ''}
  <section aria-labelledby="src-h"><h2 id="src-h">출처</h2>
    <ul class="src">${srcs.map(k => { const l = RULES.meta.laws[k]; return `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a> (${esc(l.version)})</li>`; }).join('')}${extra.map(([t, u]) => `<li><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>
    <p class="small">법령 원문을 읽고 직접 쓴 글이에요. 확인일 ${fmtDate(SPECIES.meta.checked)}. 틀린 곳은 ${CONTACT} 로 알려 주세요.</p>
  </section>
  <section aria-labelledby="o-h"><h2 id="o-h">다른 어종</h2><div class="related">${others.map(o => `<a class="chip" href="${up}species/${o.slug}/">${esc(o.name)}</a>`).join('')}</div></section>
</main>
` + foot(up);
  write(`species/${s.slug}/index.html`, html, { minUnique: MIN_SPECIES_CHARS, unique });
}

/* ---------- 지역 ---------- */
/** 시·도 경계와 지점을 모두 담는 정사각형 viewBox */
function regionBox(k, pts) {
  const xs = [], ys = [];
  for (const r of POLY[k]) for (const [x, y] of r) { xs.push(x); ys.push(y); }
  for (const p of pts) { const [x, y] = proj(p.lat, p.lng); xs.push(x); ys.push(y); }
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const size = Math.max(x1 - x0, y1 - y0, 40) + 16;
  return `${((x0 + x1 - size) / 2).toFixed(0)} ${((y0 + y1 - size) / 2).toFixed(0)} ${size.toFixed(0)} ${size.toFixed(0)}`;
}
function zoneList(zs) {
  if (!zs.length) return '<p class="small">이 지역에 해당하는 공공 자료가 아직 없어요. 현장 안내판과 관할 해양경찰서·지자체 공고를 확인하세요.</p>';
  return `<ul class="zlist">${zs.map(z => `<li>${I.stop}<div><b>들어가지 마세요</b> · ${esc(z.name)}${z.type ? ` <small>${esc(z.type)}</small>` : ''}<br><small>${z.kind === 'control' ? `${esc(z.address)} · ${esc(z.notice)} · 해양경찰청 연안 출입통제구역(2023. 5. 1. 기준)` : `국립해양조사원 낚시금지구역(전자해도 ${esc(z.enc)}, 위치 대략 북위 ${z.lat.toFixed(3)}°·동경 ${z.lng.toFixed(3)}°)`}</small></div></li>`).join('')}</ul>`;
}
function buildRegion(k) {
  const up = '../../';
  const name = RNAME[k];
  const pts = points.filter(p => p.rk === k).sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const zs = allZones.filter(z => z.rk === k);
  const rb = boatsAll.filter(b => b.sido === name);
  const portRows = [...rb.reduce((m, b) => { const key = `${b.sigungu}|${boatPlace(b)}`; if (!m.has(key)) m.set(key, { sigungu: b.sigungu, place: boatPlace(b), isPort: !!b.port, n: 0, pax: 0 }); const r = m.get(key); r.n++; r.pax = Math.max(r.pax, b.maxPassengers || 0); return m; }, new Map()).values()].sort((a, b) => b.n - a.n || a.place.localeCompare(b.place, 'ko'));
  const sggCount = [...new Set(rb.map(b => b.sigungu).filter(Boolean))].length;
  const portTable = list => `<div class="tbl"><table class="boats"><thead><tr><th scope="col">선적지</th><th scope="col">시·군·구</th><th scope="col">신고된 배</th><th scope="col">가장 큰 최대 승객</th></tr></thead><tbody>${list.map(r => `<tr><th scope="row">${esc(r.place)}${r.isPort ? '' : '<small>항구 이름 없이 신고</small>'}</th><td>${esc(r.sigungu || '—')}</td><td class="num">${r.n}척</td><td class="num">${r.pax || '—'}명</td></tr>`).join('')}</tbody></table></div>`;
  const local = RULES.rules.filter(r => (LAW_NAMES[k] || []).some(n => (r.closedText + ' ' + (r.sizeText || '')).includes(n)));
  const fw = fwSpots.filter(s => s.sido === name);
  const ports = [...new Set(pts.map(p => p.port).filter(Boolean))];
  const g = GEO.regions[k];
  const html = head({
    title: `${name} 바다낚시 — 물때·금어기·들어가면 안 되는 곳 | ${SERVICE}`,
    desc: `${name} 바다의 바다낚시지수 지점 ${pts.length}곳, 선적지별 낚시어선 수, 지역에만 적용되는 금어기·금지체장, 해경 출입통제구역과 낚시금지구역. 예보이며 조과를 보장하지 않아요.`,
    path: `region/${k}/`, up,
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbLd([[SERVICE, BASE], [name, `${BASE}region/${k}/`]])] }
  }) + `
<main id="main" class="wrap" tabindex="-1">
  ${SAFETY}
  <div class="hero hero-after">
    <p class="crumb"><a href="${up}">${SERVICE}</a> › 지역 › ${name}</p>
    <h1>${name} 바다 <span class="h1-sub">${SEA_OF[k]}</span></h1>
    <div class="prose"><p class="lead">${esc(REGION_INTRO[k])}</p></div>
  </div>
  ${FIX_BANNER}
  <div class="board">
    <div class="mapbox">${mapSvg({ points: pts, zones: zs, up, sel: k, label: `${name} 지점과 금지·통제구역`, viewBox: regionBox(k, pts), r: 2.6, x: 2 })}${LEGEND(pts.length > 0)}</div>
    <div>
      <h2 class="h-tight">바다낚시지수 지점 <small class="num">${pts.length}곳</small></h2>
      ${pts.length ? `<ul class="plist">${pts.map(pointItem(up)).join('')}</ul><p class="small">칩: ${esc(slotLabel(pts[0].days[0].date, pts[0].days[0].ampm))} 예보에서 어종별 지수 가운데 가장 높은 값. 예보이며 조과를 보장하지 않아요.</p>` : `<p class="small">${FIXTURE ? '예시 자료에는 이 지역 지점이 없어요. 실제 예보가 연결되면 국립해양조사원 지점이 여기에 나와요.' : '국립해양조사원 바다낚시지수 지점이 이 지역에는 없어요.'}</p>`}
      <h2 class="h-tight">${name}에만 따로 정한 기준</h2>
      ${local.length ? `<ul class="llist">${local.map(r => `<li><b>${speciesByRule[r.id] ? `<a href="${up}species/${speciesByRule[r.id].slug}/">${esc(r.name)}</a>` : esc(r.name)}</b> — ${esc(r.closedText || '')}${r.sizeText && (LAW_NAMES[k] || []).some(n => r.sizeText.includes(n)) ? ` / ${esc(r.sizeText)}` : ''}</li>`).join('')}</ul>` : '<p class="small">별표에 이 지역 이름이 따로 나오는 기준은 없어요. 전국 기준을 따르고, 시·도 고시와 조례를 확인하세요.</p>'}
      <p class="small">낙지·참문어는 시·도가 금어기를 따로 고시할 수 있어요. ${LAW_NAMES[k][0]} 고시·공고 게시판을 확인하세요. <a href="${up}#rules">전국 표 보기</a></p>
    </div>
  </div>
  <section aria-labelledby="z-h"><h2 id="z-h">들어가면 안 되는 곳 <small class="num">${zs.length}곳</small></h2>
    <p>아래는 낚시 장소가 아니에요. 공공 자료에 금지·통제구역으로 올라 있는 곳이니 들어가지 마세요. 해경 출입통제구역 자료는 2023년 5월 기준이라, 새로 지정되거나 풀린 곳은 관할 해양경찰서 공고를 확인하세요.</p>
    ${zoneList(zs)}
  </section>
  <section aria-labelledby="b-h"><h2 id="b-h">${name} 선적 낚시어선 <small class="num">${rb.length}척 · 선적지 ${portRows.length}곳</small></h2>
    <p class="note-strong">해양수산부 신고 기준이에요. 영업 여부와 연락처는 직접 확인하세요.</p>
    ${rb.length ? portTable(portRows.slice(0, 30)) + (portRows.length > 30 ? `<details class="more"><summary>나머지 선적지 ${portRows.length - 30}곳 보기</summary>${portTable(portRows.slice(30))}</details>` : '') : '<p class="small">이 지역으로 가려진 낚시어선이 없어요.</p>'}
    <p class="small">선적항 문자열에 시·도가 없는 배가 많아서, 시·군·구 이름(${sggCount}곳)과 같은 항구·읍·면 이름의 다른 배로 시·도를 짐작했어요. 끝내 시·도를 모르는 배 ${BP.stat.noSido}척(전국)은 어느 지역에도 넣지 않았어요. 신고 유효기간이 끝난 배 ${BOATS.meta.expired}척은 뺐어요.</p>
  </section>
  ${ports.length ? `<section aria-labelledby="s-h"><h2 id="s-h">낚시방 찾기</h2><p>공식 전국 낚시방 목록이 없어서 지도 검색으로만 연결해요. 검색 결과는 각 지도 서비스의 것이고, 영업 여부는 직접 확인하세요.</p>${ports.map(p => `<h3>${esc(p)}</h3>${shopLinks(p)}`).join('')}</section>` : ''}
  ${dataMeta(up)}
  <section aria-labelledby="f-h"><h2 id="f-h">${name} 민물 허가 낚시터 <small class="num">${fw.length}곳</small></h2><p class="small">${fw.length ? `지자체가 허가한 낚시터 목록(행정안전부 표준데이터)이에요. <a href="${up}freshwater/#${k}">${name} 목록 보기</a>` : '표준데이터에 이 지역 낚시터가 없어요.'}</p></section>
  <section aria-labelledby="o-h"><h2 id="o-h">다른 지역</h2><div class="linkgrid">${COASTAL.filter(x => x !== k).map(x => `<a class="chip" href="${up}region/${x}/">${RNAME[x]}</a>`).join('')}</div></section>
</main>
` + foot(up);
  write(`region/${k}/index.html`, html);
}

/* ---------- 지점(포인트) ---------- */
const v2 = (a, u) => (a?.[0] == null ? '—' : a[0] === a[1] || a[1] == null ? `${a[0]}${u}` : `${a[0]}~${a[1]}${u}`);
const BOAT_ROWS = 40;
/** 어종 × 때(날짜·오전/오후/하루) 지수 표 + 그때의 물때·파고·수온·풍속 */
function forecastTable(p) {
  const slots = [];
  for (const d of p.days) if (!slots.some(s => s.date === d.date && s.ampm === d.ampm)) slots.push({ date: d.date, ampm: d.ampm, d });
  const species = [...new Set(p.days.map(d => d.species))];
  const sp = species.filter(x => x && x !== '기타어종').concat(species.filter(x => x === '기타어종')).concat(species.filter(x => !x));
  const cell = (s, sp) => { const d = p.days.find(x => x.date === s.date && x.ampm === s.ampm && x.species === sp); return `<td>${d ? IDX(d.index) : '—'}</td>`; };
  const dates = [...new Set(slots.map(s => s.date))];
  const h1 = dates.map(dt => { const n = slots.filter(s => s.date === dt).length; return `<th scope="colgroup" colspan="${n}" class="num">${Number(dt.slice(5, 7))}.${Number(dt.slice(8, 10))}</th>`; }).join('');
  const h2 = slots.map(s => `<th scope="col">${s.ampm === '일' ? '하루' : esc(s.ampm)}</th>`).join('');
  const rowsSp = sp.map(x => `<tr><th scope="row">${x ? esc(x) : '지수'}</th>${slots.map(s => cell(s, x)).join('')}</tr>`).join('');
  const cond = [['물때', s => esc(s.d.tide || '—')], ['파고', s => v2(s.d.wave, 'm')], ['수온', s => v2(s.d.wtemp, '℃')], ['풍속', s => v2(s.d.wind, 'm/s')], ['유속', s => v2(s.d.current, 'kn')]]
    .map(([n, f]) => `<tr class="cond"><th scope="row">${n}</th>${slots.map(s => `<td class="num">${f(s)}</td>`).join('')}</tr>`).join('');
  return `<div class="tbl tbl-fc"><table class="fc"><thead><tr><th scope="col" rowspan="2">${p.gubun === '선상' ? '' : '대상어'}</th>${h1}</tr><tr>${h2}</tr></thead><tbody>${rowsSp}${cond}</tbody></table></div>`;
}
function boatSection(p) {
  const r = boatsForPoint(p, boatsAll);
  const title = r.how === 'port' ? `${esc(r.places.map(x => x.name).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join('·'))} 선적 낚시어선`
    : r.how === 'sigungu' ? `${esc(r.sigungu)} 선적 낚시어선 <small>가까운 항구 기준</small>`
    : r.how === 'near' ? `가까운 항구의 낚시어선 <small>가까운 항구 기준</small>` : '낚시어선';
  const note = r.how === 'port' ? `지점의 항구 이름(${esc(p.port)})과 같은 이름으로 신고된 배예요.`
    : r.how === 'sigungu' ? `지점 이름(${esc(p.port)})과 같은 이름의 시·군에 신고된 배예요. 지점에서 가장 가까운 항구라는 뜻은 아니에요.`
    : r.how === 'near' ? `이 지점 이름과 같은 항구로 신고된 배가 없어서, 선적지가 가까운 곳(${esc(r.places.map(x => x.name).join(', '))})의 배를 보여 줘요. 거리는 항구나 시·군·구 중심으로 잰 대략값이라, 실제로 가장 가까운 항구가 아닐 수 있어요.` : '';
  const rows = r.boats.slice().sort((a, b) => boatPlace(a).localeCompare(boatPlace(b), 'ko') || a.name.localeCompare(b.name, 'ko'));
  const chips = r.places.length ? `<div class="related">${r.places.map(x => `<span class="chip">${esc(x.name)}${x.sigungu ? ` <small>${esc(x.sigungu)}</small>` : ''} <small class="num">${x.count}척${x.km != null && r.how !== 'port' ? ` · 약 ${Math.round(x.km)}km` : ''}</small></span>`).join('')}</div>` : '';
  const table = rows.length ? `<div class="tbl"><table class="boats"><thead><tr><th scope="col">배 이름</th><th scope="col">선적지</th><th scope="col">총톤수</th><th scope="col">최대 승객</th><th scope="col">신고 유효기간</th></tr></thead><tbody>${rows.slice(0, BOAT_ROWS).map(b => `<tr><th scope="row">${esc(b.name)}</th><td>${esc([b.sigungu, b.area, b.port].filter(Boolean).join(' ') || b.raw)}</td><td class="num">${b.tons ?? '—'}t</td><td class="num">${b.maxPassengers ?? '—'}명</td><td class="num">${esc(fmtDate(b.validTo))}까지</td></tr>`).join('')}</tbody></table></div>${rows.length > BOAT_ROWS ? `<p class="small">${rows.length}척 가운데 ${BOAT_ROWS}척만 보여 줘요. ${p.rk ? `<a href="../../region/${p.rk}/#b-h">${RNAME[p.rk]} 선적지별 수 보기</a>` : ''}</p>` : ''}` : '';
  return { r, html: `<section aria-labelledby="b-h"><h2 id="b-h">${title} ${rows.length ? `<small class="num">${rows.length}척</small>` : ''}</h2>
    <p class="note-strong">해양수산부 신고 기준이에요. 영업 여부와 연락처는 직접 확인하세요.</p>
    ${r.how === 'none' ? `<p class="small">이 지점 이름과 같은 항구로 신고된 배가 없고, 40km 안에 위치를 짐작할 수 있는 선적지도 없어요. ${p.rk ? `<a href="../../region/${p.rk}/#b-h">${RNAME[p.rk]} 선적지별 낚시어선 수</a>를 보세요.` : ''}</p>` : `<p class="small">${note}</p>${chips}${table}`}
    <p class="small">신고 유효기간이 끝난 배는 뺐어요(이번 자료에서 ${BOATS.meta.expired}척). 연락처는 싣지 않아요.</p>
  </section>` };
}
function buildPoint(p) {
  const up = '../../';
  const near = allZones.map(z => ({ z, d: distKm([p.lat, p.lng], [z.lat, z.lng]) })).filter(x => x.d <= ZONE_KM).sort((a, b) => a.d - b.d);
  const nearest = allZones.map(z => distKm([p.lat, p.lng], [z.lat, z.lng])).sort((a, b) => a - b)[0];
  const tide = tideFor(p);
  const bs = boatSection(p);
  const species = [...new Set(p.days.map(d => d.species).filter(x => x && x !== '기타어종'))];
  const [x, y] = proj(p.lat, p.lng);
  const days = [...new Set(p.days.map(d => d.date))];
  const sp = species.map(n => { const s = speciesByName(n); const rs = s ? s.rules.map(id => RULE[id]) : RULES.rules.filter(r => r.name === n || (r.alias || []).includes(n)); return `<li><b>${s ? `<a href="${up}species/${s.slug}/">${esc(n)}</a>` : esc(n)}</b>${rs.length ? rs.map(r => ` — 금어기: ${r.closed || r.notice ? ruleClosed(r) : '없음'} · 금지체장: ${r.size ? esc(r.sizeText) : '없음'}`).join('') : ' — 별표에 따로 정한 기준 없음'}</li>`; }).join('');
  const f = firstSlot(p);
  const tideDays = tide ? [...new Set(tide.events.map(e => e.time.slice(0, 10)))] : [];
  const html = head({
    title: `${p.name} 물때·바다낚시지수(${p.gubun}) | ${SERVICE}`,
    desc: `${p.name}(${p.gubun}, ${RNAME[p.rk]}) 바다낚시지수 ${days.length}일 예보, 가까운 조석 예보지점의 고·저조 시각, 대상어의 금어기·금지체장, 근처 금지·통제구역, 신고된 낚시어선. 예보이며 조과를 보장하지 않아요.`,
    path: `point/${p.slug}/`, up,
    jsonld: { '@context': 'https://schema.org', '@graph': [crumbLd([[SERVICE, BASE], ...(p.rk ? [[RNAME[p.rk], `${BASE}region/${p.rk}/`]] : []), [p.name, `${BASE}point/${p.slug}/`]])] }
  }) + `
<main id="main" class="wrap" tabindex="-1">
  ${SAFETY}
  <div class="hero hero-after">
    <p class="crumb"><a href="${up}">${SERVICE}</a> › ${p.rk ? `<a href="${up}region/${p.rk}/">${RNAME[p.rk]}</a>` : '지역 모름'} › ${esc(p.name)}</p>
    <div class="place-head">
      <div>
        <h1>${esc(p.name)} <span class="h1-sub">${esc(p.gubun)}</span></h1>
        <p class="lead">국립해양조사원 바다낚시지수 예보 지점이에요(북위 ${p.lat.toFixed(3)}°, 동경 ${p.lng.toFixed(3)}°, ${RNAME[p.rk]}). ${p.gubun === '선상' ? '배를 타고 나가는 바다 위 지점이라 걸어서 갈 수 없어요.' : '지점 이름은 넓은 해역을 가리켜요. 특정 갯바위를 뜻하지 않아요.'}</p>
        ${f ? `<p class="nowline">${esc(slotLabel(f.date, f.ampm))} 지수 ${f.best === f.worst ? IDX(f.best) : `${IDX(f.worst)}~${IDX(f.best)}`} <small>${f.n > 1 ? `어종 ${f.n}가지` : ''}</small></p>` : ''}
      </div>
      <div class="minimap">${mapSvg({ points: [p], zones: near.map(n => n.z), up, sel: p.rk, label: `${p.name} 위치`, viewBox: `${(x - 70).toFixed(0)} ${(y - 70).toFixed(0)} 140 140`, r: 3, x: 2 })}<p class="small">점: 예보 지점(대략) · ✕: 들어가지 마세요</p></div>
    </div>
  </div>
  ${FIX_BANNER}
  <section aria-labelledby="i-h"><h2 id="i-h">바다낚시지수 ${days.length ? `<small>${esc(fmtDate(days[0]))}${days.length > 1 ? ` ~ ${esc(fmtDate(days[days.length - 1]).slice(5))}` : ''} · ${days.length}일</small>` : ''}</h2>
    <p class="small">예보이며 조과를 보장하지 않아요. 지수는 물때·파고·수온·유속·풍속을 묶은 다섯 단계(매우나쁨·나쁨·보통·좋음·매우좋음) 예보예요. 앞 3일은 오전·오후, 그 뒤는 하루 단위로 나와요. 표가 넓으면 옆으로 밀어 보세요.</p>
    ${forecastTable(p)}
  </section>
  <section aria-labelledby="t-h"><h2 id="t-h">고조·저조 시각</h2>
    ${tide ? `<p class="small">가장 가까운 조석 예보지점: <b>${esc(tide.station)}</b>(약 ${Math.max(1, Math.round(tide.km))}km) · 국립해양조사원 조석예보 ${tideDays.length}일치</p>${tide.km > 20 ? `<p class="fixture" role="note">이 지점에서 약 ${Math.round(tide.km)}km 떨어진 예보지점이라 실제 물때 시각과 높이가 다를 수 있어요.</p>` : ''}${tideDays.map(dt => `<h3 class="num">${Number(dt.slice(5, 7))}월 ${Number(dt.slice(8, 10))}일</h3><ul class="tide">${tide.events.filter(e => e.time.startsWith(dt)).map(e => `<li class="${e.type === '고조' ? 'hi' : 'lo'}"><b>${esc(e.type)}</b><span class="num">${esc(e.time.slice(11))}</span><small class="num">${e.level ?? '—'}cm</small></li>`).join('')}</ul>`).join('')}<p class="small">갯바위·갯벌은 고조 전에 미리 나오세요. 물이 들어오기 시작하면 길이 끊길 수 있어요.</p>` : '<p class="small">받아 둔 조석 예보지점이 없어요.</p>'}
  </section>
  <section aria-labelledby="s-h"><h2 id="s-h">대상어의 금어기·금지체장</h2>
    ${sp ? `<ul class="llist">${sp}</ul>` : '<p class="small">선상 지점은 대상어가 따로 나오지 않아요. <a href="' + up + '#rules">전체 표</a>를 보세요.</p>'}
    ${LAW_NOTE}
  </section>
  <section aria-labelledby="z-h"><h2 id="z-h">근처 들어가면 안 되는 곳 <small class="num">${near.length}곳(${ZONE_KM}km 안)</small></h2>
    ${near.length ? zoneList(near.map(n => n.z)) : `<p class="small">공공 자료(국립해양조사원 낚시금지구역, 해경 연안 출입통제구역 2023. 5.)에 ${ZONE_KM}km 안으로 올라 있는 곳이 없어요${nearest != null ? `(가장 가까운 곳 약 ${Math.round(nearest)}km)` : ''}. 자료에 없어도 막힌 곳이 있으니 현장 안내판과 관할 해양경찰서 공고를 확인하세요.</p>`}
  </section>
  ${bs.html}
  <section aria-labelledby="sh-h"><h2 id="sh-h">낚시방 찾기</h2><p class="small">공식 낚시방 목록이 없어 지도 검색으로만 연결해요.</p>${shopLinks(p.port)}</section>
  ${dataMeta(up)}
  <p class="small">출처: 해양수산부 국립해양조사원 바다낚시지수·조석예보(공공누리 제1유형), 해양수산부 낚시어선업 신고정보, 해양경찰청 연안 출입통제구역, 국립해양조사원 낚시금지구역 — 공공데이터포털. <a href="${up}sources.html">출처 자세히</a></p>
</main>
` + foot(up);
  write(`point/${p.slug}/index.html`, html);
  return { tide, boats: bs.r, zones: near.length };
}

/* ---------- 민물 허가 낚시터 ---------- */
function buildFreshwater() {
  const up = '../';
  const by = REGIONS.map(([n, k]) => [n, k, fwSpots.filter(s => s.sido === n).sort((a, b) => a.name.localeCompare(b.name, 'ko'))]).filter(x => x[2].length);
  const html = head({
    title: `민물 허가 낚시터 ${fwSpots.length}곳 — 시·도별 목록 | ${SERVICE}`,
    desc: `지자체가 허가한 전국 낚시터 ${fwSpots.length}곳(행정안전부 전국낚시터정보표준데이터)을 시·도별로. 전화번호는 싣지 않았어요.`,
    path: 'freshwater/', up
  }) + `
<main id="main" class="wrap" tabindex="-1">
  <div class="hero">
    <p class="crumb"><a href="${up}">${SERVICE}</a> › 민물 허가 낚시터</p>
    <h1>민물 허가 낚시터 <span class="num">${fwSpots.length}</span>곳</h1>
    <p class="lead">지자체가 허가한 낚시터 목록이에요. 행정안전부 전국낚시터정보표준데이터를 시·도별로 묶었고, 전화번호는 싣지 않았어요. 영업 여부와 요금은 관리기관이나 낚시터에 직접 확인하세요.</p>
  </div>
  <div class="linkgrid">${by.map(([n, k, l]) => `<a class="chip" href="#${k}">${n} <small class="num">${l.length}</small></a>`).join('')}</div>
  ${by.map(([n, k, l]) => `<section id="${k}" aria-labelledby="h-${k}"><h2 id="h-${k}">${n} <small class="num">${l.length}곳</small></h2><div class="tbl"><table class="fw"><thead><tr><th scope="col">낚시터</th><th scope="col">유형</th><th scope="col">주요 어종</th><th scope="col">주소</th><th scope="col">기준일</th></tr></thead><tbody>${l.map(s => `<tr><th scope="row">${esc(s.name)}</th><td>${esc(s.type)}</td><td>${esc(s.species)}</td><td>${esc(s.address)}</td><td class="num">${esc(s.refDate)}</td></tr>`).join('')}</tbody></table></div></section>`).join('\n')}
  <p class="small">출처: <a href="${esc(FW.meta.source)}" target="_blank" rel="noopener">${esc(FW.meta.title)}</a>, 공공데이터포털(${esc(FW.meta.license)}), ${fmtDate(FW.meta.fetched)} 내려받음. 기준일이 오래된 행이 있어요.</p>
</main>
` + foot(up);
  write('freshwater/index.html', html);
}

/* ---------- 출처 ---------- */
const SOURCES = [
  ['법령', RULES.meta.laws.sea1.name, RULES.meta.laws.sea1.url, `${RULES.meta.laws.sea1.version}. 금어기 표. 원문 PDF를 tools/fish/law/에 옮겨 행마다 대조(확인일 ${CHECKED})`],
  ['법령', RULES.meta.laws.sea2.name, RULES.meta.laws.sea2.url, `${RULES.meta.laws.sea2.version}. 금지체장 표`],
  ['법령', RULES.meta.laws.inland1.name, RULES.meta.laws.inland1.url, `${RULES.meta.laws.inland1.version}. 민물 금어기·금지체장`],
  ['법령', '수산자원관리법 제14조·제18조제5항·제65조제2호', RULES.meta.laws.act.url, `${RULES.meta.laws.act.version}. 비어업인 처벌(1천만 원 이하 벌금)`],
  ['법령', '낚시 관리 및 육성법 제5조·제6조·제7조', 'https://www.law.go.kr/법령/낚시관리및육성법', '시행 2025. 6. 21., 법률 제20597호. 조례로 더 엄격한 낚시제한기준, 낚시통제구역'],
  ['오픈API', `해양수산부 국립해양조사원_바다낚시지수 조회 (${INDEX.meta.dataset})`, INDEX.meta.source, `${INDEX.meta.license}. ${fmtDate(INDEX.meta.fetched)} 받은 ${PREP.points.length}곳(갯바위·선상 두 번 불러도 같은 ${PREP.points.length}곳이 와서 하나로 묶음, 구분은 활용가이드 장소 코드표), ${[...new Set(points.flatMap(p => p.days.map(d => d.date)))].length}일 예보`],
  ['오픈API', `해양수산부 국립해양조사원_조석예보(고, 저조) (${TIDE.meta.dataset})`, TIDE.meta.source, `${TIDE.meta.license}. ${fmtDate(TIDE.meta.fetched)} 받은 예보지점 ${Object.keys(TIDE.stations).length}곳. 지점마다 좌표가 가장 가까운 예보지점을 거리와 함께 보여 줌. 예보지점 코드 166곳은 활용가이드에서 옮김`],
  ['오픈API', `해양수산부_낚시 어선업 신고정보 (${BOATS.meta.dataset})`, BOATS.meta.source, `${fmtDate(BOATS.meta.fetched)} 받은 ${BOATS.meta.received}척 중 신고 유효기간이 남은 ${BOATS.boats.length}척(끝난 ${BOATS.meta.expired}척 제외). 연락처 없음. 선적항에 시·도가 없는 배는 시·군·구 이름·같은 항구 이름으로 짐작, 모르는 ${BP.stat.noSido}척은 지역에 넣지 않음`],
  ['지역표', '혹시나랩 공통 지역표 (common/regions.json)', 'https://jaemilab.net/', '시·군·구 이름과 대략의 중심 좌표. 낚시어선 선적지의 시·도 짐작과 대략 거리에만 씀'],
  ['파일', `해양수산부 국립해양조사원_낚시금지구역 (15130115)`, 'https://www.data.go.kr/data/15130115/fileData.do', `${ZONES.meta.ban.file}. SHP(EPSG:5179)를 경위도로 변환, 남한 관할 밖 ${ZONES.meta.ban.droppedOutsideSouthKorea}곳 제외, ${ZONES.meta.ban.count}곳. 공공누리 제1유형`],
  ['파일', `해양경찰청_연안 출입통제구역 현황 (15110667)`, 'https://www.data.go.kr/data/15110667/fileData.do', `${ZONES.meta.control.file}. 2023. 5. 1. 기준 ${ZONES.meta.control.count}곳(낡은 자료 — 해경 공고 확인)`],
  ['파일', '전국낚시터정보표준데이터 (15021144, 행정안전부)', 'https://www.data.go.kr/data/15021144/standard.do', `${FW.meta.count}곳, ${FW.meta.fetched} 내려받음. 이용허락범위 제한 없음. 전화번호 칸은 싣지 않음`],
  ['지도', '시·도 경계: southkorea-maps (KOSTAT 2013 행정경계 단순화본)', 'https://github.com/southkorea/southkorea-maps', '명당로드·소원명당과 같은 파일(lottomap/data/geo.js). 지점의 시·도를 좌표로 정할 때도 씀(바다 위 섬은 장소표 행정구역)'],
  ['보도', '세계일보, 「해수부, 광어 금지체장 21→35㎝로」(2020. 10. 8.)', 'https://www.segye.com/newsView/20201008527767', '광어 쪽의 개정 시기 언급에만 사용']
];
function buildSources() {
  const up = '';
  const html = head({ title: `출처·라이선스 — ${SERVICE} | ${SITE}`, desc: `${SERVICE}이 쓰는 법령과 공공데이터, 확인일과 라이선스.`, path: 'sources.html', up }) + `
<main id="main" class="wrap doc prose" tabindex="-1">
  <h1>출처·라이선스</h1>
  <p class="meta">법령 확인일 ${fmtDate(CHECKED)} · 이 쪽 만든 날 ${fmtDate(BUILD_DAY)}</p>
  <p>${SERVICE}은 아래 법령과 공공데이터만 써요. 낚시 앱·커뮤니티의 포인트·조황·사진은 쓰지 않아요. 공공누리 제1유형 자료는 출처를 밝히면 쓸 수 있어 각 쪽 아래에 출처를 적었어요.</p>
  <div class="tbl"><table class="src-t"><thead><tr><th scope="col">종류</th><th scope="col">자료</th><th scope="col">쓰는 방법</th></tr></thead><tbody>${SOURCES.map(([k, t, u, n]) => `<tr><td>${esc(k)}</td><td><a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a></td><td>${esc(n)}</td></tr>`).join('')}</tbody></table></div>
  <h2>지키는 것</h2>
  <ul>
    <li>금지·통제구역은 「들어가지 마세요」로만 보여 주고, 낚시 장소로 소개하지 않아요.</li>
    <li>낚시어선은 해양수산부 신고 기준으로 이름·선적항·승객 수·신고 유효기간만 보여 주고, 유효기간이 끝난 배는 빼요. 연락처는 싣지 않아요.</li>
    <li>낚시방은 공식 목록이 없어 카카오맵·네이버 지도 검색 링크로만 연결해요.</li>
    <li>바다낚시지수·물때는 예보이며 조과를 보장하지 않아요.</li>
  </ul>
</main>
` + foot(up);
  write('sources.html', html);
  const md = `# ${SERVICE} 출처 (자동 생성: node tools/fish/build.mjs)\n\n법령 확인일 ${CHECKED}. 공개 전 초안.\n\n| 종류 | 자료 | 주소 | 쓰는 방법 |\n|---|---|---|---|\n${SOURCES.map(([k, t, u, n]) => `| ${k} | ${t} | ${u} | ${n.replace(/\|/g, '/')} |`).join('\n')}\n\n## 금어기·금지체장 표 확인 방법\n- 국가법령정보센터에서 별표 PDF를 받아 \`tools/fish/law/*.txt\`로 옮겼어요.\n- \`fish/data/rules.json\`의 모든 행에 원문 문구(\`verify\`)를 적고, \`node tools/fish/test.mjs\`가 공백을 뺀 원문에 그 문구가 있는지 확인해요.\n- 고등어·꽃게는 해양수산부 고시, 낙지·참문어는 시·도 고시, 넓미역은 제주도지사 고시로 기간이 달라질 수 있어요.\n- 비어업인 처벌은 과태료가 아니라 벌금이에요(수산자원관리법 제18조제5항·제65조제2호, 1천만 원 이하). 「과태료 80만 원」은 현행 법령·시행령 별표 17에서 확인되지 않아 쓰지 않았어요.\n`;
  writeFileSync(join(FISH, 'SOURCES.md'), md);
}

/* ---------- 개인정보처리방침 ---------- */
function buildPrivacy() {
  const up = '';
  const html = head({ title: `개인정보처리방침 — ${SERVICE} | ${SITE}`, desc: `${SERVICE}의 개인정보처리방침. 회원가입·위치 수집이 없고, 화면 밝기 설정만 이 기기에 저장합니다.`, path: 'privacy.html', up }) + `
<main id="main" class="wrap doc prose" tabindex="-1">
  <h1>개인정보처리방침</h1>
  <p class="meta">초안(공개 전)</p>
  <h2>1. 모으는 정보가 없어요</h2>
  <p>${SERVICE}은 회원가입이 없고, 이름·연락처·위치를 묻거나 모으지 않습니다. 지도는 그림(SVG)으로 그려 보여 주며, 기기의 위치 정보에 접근하지 않습니다. 「오늘 금어기인 어종」은 이 기기의 날짜로 화면 안에서 계산하며, 서버로 보내지 않습니다.</p>
  <ul><li>이 기기에만 저장하는 것: <code>fish.theme</code>(화면 밝기 설정). 브라우저의 사이트 데이터 삭제로 지울 수 있습니다.</li></ul>
  <h2>2. 외부 지도 검색 링크</h2>
  <p>「카카오맵에서 ○○ 낚시」, 「네이버 지도에서 ○○ 낚시」를 누르면 해당 회사의 지도 서비스로 이동합니다. 이동한 뒤의 정보 처리는 각 회사의 개인정보처리방침을 따릅니다.</p>
  <h2>3. 방문 통계</h2>
  <p>방문 통계를 위해 Google 태그 관리자(Google Tag Manager)로 Google Analytics를 사용합니다. Google Analytics는 쿠키로 어떤 페이지를 얼마나 보는지 같은 익명 이용 통계를 모으며, 이름처럼 개인을 알아볼 수 있는 정보는 모으지 않습니다. 원하지 않으면 브라우저에서 쿠키를 차단하거나 <a href="https://tools.google.com/dlpage/gaoptout?hl=ko" rel="noopener">Google 애널리틱스 차단 브라우저 부가기능</a>을 설치하세요. 광고는 넣지 않았습니다.</p>
  <h2>4. 외부 리소스</h2>
  <p>글꼴(Pretendard)은 jsDelivr CDN에서 불러옵니다. 이 과정에서 CDN 사업자가 일반적인 접속 기록(IP, 브라우저 정보)을 처리할 수 있습니다.</p>
  <h2>5. 안내 내용에 대한 고지</h2>
  <p>${SERVICE}은 법령 원문과 공공데이터를 정리한 참고용 안내이며, 조과를 보장하지 않습니다. 금어기·금지체장은 법령 원문이 우선입니다.</p>
  <h2>6. 문의</h2>
  <p>개인정보 관련 문의와 정정 요청은 이메일 <a href="mailto:${CONTACT}">${CONTACT}</a> 로 보내 주세요.</p>
</main>
` + foot(up);
  write('privacy.html', html);
}

/* ---------- 실행 ---------- */
for (const d of ['species', 'region', 'point', 'freshwater']) if (existsSync(join(FISH, d))) rmSync(join(FISH, d), { recursive: true });
buildIndex();
SPECIES.species.forEach(buildSpecies);
COASTAL.forEach(buildRegion);
const pagePoints = points.filter(p => p.slug && p.lat != null && p.rk);
if (new Set(pagePoints.map(p => p.slug)).size !== pagePoints.length) throw new Error('지점 쪽 주소가 겹쳐요');
const pstat = pagePoints.map(p => ({ p, ...buildPoint(p) }));
buildFreshwater();
buildSources();
buildPrivacy();
for (const n of INDEX.meta.unknownPlaces || []) console.warn(`장소표에 없는 지점(쪽 안 만듦): ${n}`);
for (const p of points) if (!p.rk) console.warn(`시·도를 못 정한 지점: ${p.name}`);
for (const p of points) if (p.rkHow === '장소표(섬)') console.warn(`참고: ${p.name} 좌표상 가장 가까운 경계 ${RNAME[p.coordKey]} → 장소표 행정구역 ${RNAME[p.rk]}`);
const by = k => pagePoints.filter(p => p.rk === k).length;
console.log(`fish: ${SERVICE}(초안${FIXTURE ? ', 예시 자료' : ', 실제 자료 ' + INDEX.meta.fetched}) — 페이지 ${report.length}개 = 첫 화면 1 + 어종 ${SPECIES.species.length} + 지역 ${COASTAL.length} + 지점 ${pagePoints.length} + 민물 1 + 출처 1 + 개인정보 1 · 규칙 ${RULES.rules.length}행 · 금지·통제구역 ${allZones.length}곳`);
console.log(`  지점: index.json ${INDEX.points.length}행 → ${points.length}곳(겹침 ${PREP.dup}, 그중 값이 같은 것 ${PREP.dupSame}) · 시·도별 ${COASTAL.map(k => `${RNAME[k]} ${by(k)}`).join(', ')}`);
console.log(`  낚시어선: ${BP.stat.total}척 · 시·도 앎 ${BP.stat.withSido}(주소·시군구 ${boatsAll.filter(b => b.sidoBy === '주소' || b.sidoBy === '시군구').length}, 같은 항구 ${BP.stat.port}, 같은 읍·면 ${BP.stat.area}, 지점 이름 ${BP.stat.hint}) · 모름 ${BP.stat.noSido}(겹치는 이름 ${BP.stat.ambiguous}) · 대략 좌표 ${BP.stat.withCoord}`);
const hw = h => pstat.filter(x => x.boats.how === h).length;
console.log(`  지점별 낚시어선: 같은 항구 이름 ${hw('port')}곳 · 같은 시·군 ${hw('sigungu')}곳 · 가까운 항구 ${hw('near')}곳 · 없음 ${hw('none')}곳(${pstat.filter(x => x.boats.how === 'none').map(x => x.p.name).join(', ')})`);
console.log(`  조석: 가장 가까운 예보지점 20km 넘는 지점 ${pstat.filter(x => x.tide && x.tide.km > 20).map(x => `${x.p.name}→${x.tide.station} ${Math.round(x.tide.km)}km`).join(', ')}`);
console.log(`  금지·통제구역 ${ZONE_KM}km 안: ${pstat.filter(x => x.zones).map(x => `${x.p.name} ${x.zones}`).join(', ') || '없음'}`);
for (const r of report) console.log(`  ${String(r.chars).padStart(5)}자${r.unique != null ? ` (고유 ${r.unique})` : ''}  ${r.rel}`);
