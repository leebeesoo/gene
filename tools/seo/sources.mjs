#!/usr/bin/env node
// <서비스>/SOURCES.md → <서비스>/sources.html (빌드가 *.md를 빼므로 사이트에서 열 수 있는 출처 페이지를 따로 만든다).
//   node tools/seo/sources.mjs            SOURCES.md를 고친 뒤 다시 돌린다(여러 번 돌려도 같음).
// 틀(머리·상단바·공용 푸터·GTM)은 그 서비스의 privacy.html에서 가져오고, 본문만 마크다운을 옮긴다. 의존성 없음.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SITE = 'https://jaemilab.net/';

// 서비스 → [이름, 메타 설명]
const PAGES = {
  birthyear: ['나때연감', '나때연감이 쓰는 출생아 수·물가·품목 가격·영화 흥행·이름 자료의 출처와 기준. 확인된 값만 싣고 모르면 비워 둡니다.'],
  family: ['식구궁합', '식구궁합의 사주 기둥, 오행 생극, 천간합·지지 합충형파해 표의 출처와 점수 계산 근거.'],
  money: ['내 미래 머니', '내 미래 머니의 청약 가점표, 이자 세금, 소비자물가지수, 예금자보호 한도의 법령·공식 출처와 확인일.'],
  names: ['이름레이더', '이름레이더가 쓰는 성씨 인구, 연도별 출생신고 이름 순위, 인구 규모 자료의 출처와 동명이인 추정 가정.'],
  roots: ['근본 테스트', '근본 테스트의 절기·음력 계산, 성씨·본관 인구, 조선 후기 신분 구성, 장래 인구 자료의 출처와 공식의 가정.'],
  season: ['제철장보기', '제철장보기의 가격(KAMIS)·제철·주산지 자료의 출처와 수집 기준일.'],
};

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const attr = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

// 인라인: `코드`, [글](주소), <주소>, 맨 주소, **굵게**, *기울임*
const TOKEN = /`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|<(https?:\/\/[^>\s]+)>|(https?:\/\/[^\s<>()]*[^\s<>().,;:!?'"」』)\]])/g;
function inline(text) {
  const keep = [];
  let out = '', last = 0;
  for (const m of text.matchAll(TOKEN)) {
    out += esc(text.slice(last, m.index));
    let h;
    if (m[1] != null) h = `<code>${esc(m[1])}</code>`;
    else if (m[2] != null) h = `<a href="${attr(m[3])}" rel="noopener">${esc(m[2])}</a>`;
    else { const u = m[4] || m[5]; h = `<a href="${attr(u)}" rel="noopener">${esc(u)}</a>`; }
    out += `\u0001${keep.push(h) - 1}\u0001`;
    last = m.index + m[0].length;
  }
  out += esc(text.slice(last));
  out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\*)/g, '$1<em>$2</em>');
  return out.replace(/\u0001(\d+)\u0001/g, (_, i) => keep[+i]);
}

function render(md) {
  const lines = md.replace(/\r/g, '').split('\n');
  const out = [];
  let h1 = '', i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    let m;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      const lv = m[1].length;
      if (lv === 1 && !h1) { h1 = m[2].trim(); i++; continue; }
      out.push(`<h${Math.min(lv, 4)}>${inline(m[2].trim())}</h${Math.min(lv, 4)}>`);
      i++; continue;
    }
    if (line.startsWith('|') && /^\|?\s*:?-{2,}/.test(lines[i + 1] || '')) {
      const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) rows.push(cells(lines[i++]));
      out.push('<div class="md-table"><table><thead><tr>' + head.map(c => `<th>${inline(c)}</th>`).join('') + '</tr></thead><tbody>' +
        rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>');
      continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      // 들여쓰기 2칸 = 한 단계. 항목 아래 들여쓴 일반 줄은 그 항목에 붙인다.
      const items = [];
      while (i < lines.length && lines[i].trim()) {
        const l = lines[i];
        const lm = l.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (lm) items.push({ lv: Math.floor(lm[1].length / 2), ol: /\d/.test(lm[2]), text: lm[3] });
        else if (items.length && /^\s/.test(l)) items[items.length - 1].text += ' ' + l.trim();
        else break;
        i++;
      }
      let html = '', stack = [];
      for (const it of items) {
        const lv = Math.min(it.lv, stack.length);
        while (stack.length > lv + 1) html += `</li></${stack.pop()}>`;
        if (stack.length === lv + 1) html += '</li>';
        else { const t = it.ol ? 'ol' : 'ul'; stack.push(t); html += `<${t}>`; }
        html += `<li>${inline(it.text)}`;
      }
      while (stack.length) html += `</li></${stack.pop()}>`;
      out.push(html);
      continue;
    }
    if (line.startsWith('>')) {
      const q = [];
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote><p>${inline(q.join(' '))}</p></blockquote>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|\||\s*([-*]|\d+\.)\s|>)/.test(lines[i])) para.push(lines[i++].trim());
    if (!para.length) { out.push(`<p>${inline(lines[i++].trim())}</p>`); continue; }
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return { h1, body: out.join('\n') };
}

const STYLE = `<style>
.sources h1{margin-bottom:6px}
.sources .src-meta{font-size:14px;color:var(--muted,#6b6b70);margin:0 0 20px}
.sources h2{margin-top:32px}
.sources h3{font-size:16px;font-weight:700;margin:20px 0 6px}
.sources ul,.sources ol{padding-left:20px;margin:0 0 12px}
.sources li{margin:0 0 6px;line-height:1.7}
.sources li ul,.sources li ol{margin:6px 0 0}
.sources p{line-height:1.7}
.sources code{font-size:.9em;padding:1px 5px;border-radius:6px;border:1px solid var(--line,#e2e0db);word-break:break-all}
.sources a{overflow-wrap:anywhere}
.sources blockquote{margin:0 0 12px;padding:0 0 0 12px;border-left:2px solid var(--line,#e2e0db);color:var(--muted,#6b6b70)}
.sources .md-table{overflow-x:auto;margin:0 0 16px;-webkit-overflow-scrolling:touch}
.sources table{border-collapse:collapse;width:100%;min-width:480px;font-size:14px;font-variant-numeric:tabular-nums}
.sources th,.sources td{text-align:left;vertical-align:top;padding:8px;border-bottom:1px solid var(--line,#e2e0db);line-height:1.55}
.sources th{font-weight:700;white-space:nowrap}
.sources .src-back{margin-top:32px;font-size:15px}
</style>`;

for (const [svc, [name, desc]] of Object.entries(PAGES)) {
  const md = fs.readFileSync(path.join(ROOT, svc, 'SOURCES.md'), 'utf8');
  const tpl = fs.readFileSync(path.join(ROOT, svc, 'privacy.html'), 'utf8');
  const { h1, body } = render(md);
  const title = h1.replace(/\s*\(\/[a-z]+\/\)/, '');
  const mOpen = tpl.match(/<main\b[^>]*>/);
  const close = tpl.lastIndexOf('</main>');
  if (!mOpen || close < 0) throw new Error(`${svc}/privacy.html: <main> 없음`);
  let head = tpl.slice(0, mOpen.index + mOpen[0].length);
  const tail = tpl.slice(close);
  const wrapArticle = !/class="[^"]*\bdoc\b/.test(mOpen[0]);   // birthyear: <main class="wrap"><article class="doc">
  head = head
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title.includes(name) ? title : `${title} — ${name}`)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr(desc)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${attr(desc)}">`)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr(title)}">`)
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${SITE}${svc}/sources.html$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${SITE}${svc}/sources.html$2`)
    .replace(/[ \t]*<meta name="robots" content="[^"]*">\n?/, '')
    .replace(/[ \t]*<script type="application\/ld\+json">[\s\S]*?<\/script>\n?/g, '')
    .replace('</head>', STYLE + '\n</head>');
  if (!head.includes('rel="canonical"')) head = head.replace('</title>', `</title>\n<link rel="canonical" href="${SITE}${svc}/sources.html">`);
  // 상단바 등 privacy.html 고유 문구가 head 쪽(본문 앞)에 있으면 그대로 둔다(서비스로 돌아가는 링크).
  const content = `
  <h1>${inline(title)}</h1>
  <p class="src-meta">${esc(name)}에서 쓰는 자료의 출처, 확인한 날짜, 계산에 넣은 가정을 정리했어요. 틀린 곳은 <a href="../contact.html">문의</a>로 알려 주세요.</p>
${body}
  <p class="src-back"><a href="./">← ${esc(name)} 첫 화면</a> · <a href="privacy.html">개인정보처리방침</a> · <a href="../">혹시나랩 홈</a></p>
`;
  const main = wrapArticle ? `\n<article class="doc sources">${content}</article>\n` : content;
  let html = head + main + tail;
  if (!wrapArticle) html = html.replace(mOpen[0], mOpen[0].replace(/class="([^"]*)"/, 'class="$1 sources"'));
  fs.writeFileSync(path.join(ROOT, svc, 'sources.html'), html);
  console.log(`${svc}/sources.html  ${title}`);
}
