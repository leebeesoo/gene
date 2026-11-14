import { TYPES, ELEMENTS, AXES } from './data.js';
import { emblemSVG } from './emblems.js';
import { typeBits } from './engine.js';

const SERIF = '"Nanum Myeongjo", "Noto Serif KR", serif';
const SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
const svgUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

async function ensureFonts(text) {
  try {
    await Promise.all([
      document.fonts.load(`700 80px ${SERIF}`, text),
      document.fonts.load(`700 36px ${SANS}`, text), document.fonts.load(`500 36px ${SANS}`, text),
    ]);
  } catch { /* fall back to system fonts */ }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export async function makeShareCard({ name, result, url }) {
  const t = TYPES[result.typeId];
  const W = 1080, H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const text = `${name}님의 근본 코드${t.name}형${t.hanja}${t.tagline}${result.nick}가까운 근본 3가지${result.blend.map(b => TYPES[b.id].name).join('')}0123456789%·너의 코드는? TKLSARHG思行守遊理情獨群根本`;
  await ensureFonts(text);

  // 한지 바탕 · 먹 글씨 · 인주 한 점 (그라데이션·그림자 없음)
  const C = { bg: '#F3F1EC', surface: '#FBFAF7', ink: '#1C1C1E', ink2: '#45423D', muted: '#6F6B64', line: '#DDD8CE', sunken: '#EAE7E0', accent: '#8E2B22' };
  ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.strokeRect(40, 40, W - 80, H - 80);

  // header: 인주 낙관 + 이름
  ctx.fillStyle = C.accent; roundRect(ctx, 80, 80, 60, 60, 8); ctx.fill();
  ctx.fillStyle = C.surface; ctx.font = `700 34px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('根', 110, 112);
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `700 34px ${SANS}`; ctx.fillText('근본 테스트', 160, 122);

  ctx.textAlign = 'center'; ctx.fillStyle = C.muted; ctx.font = `500 36px ${SANS}`;
  ctx.fillText(`${name}님의 근본 코드`, W / 2, 236);

  // emblem
  const img = await loadImg(svgUrl(emblemSVG(result.typeId, 400)));
  ctx.drawImage(img, W / 2 - 140, 272, 280, 280);

  // code badge
  const code = result.code.split('');
  const bits = typeBits(result.typeId);
  const hz = AXES.map((a, i) => bits[i] ? a.neg.h : a.pos.h);
  ctx.textAlign = 'center';
  code.forEach((ch, i) => {
    const cx = W / 2 - 195 + i * 130;
    ctx.fillStyle = C.surface; roundRect(ctx, cx - 54, 600, 108, 124, 14); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.ink; ctx.font = `700 76px ${SANS}`; ctx.fillText(ch, cx, 680);
    ctx.fillStyle = C.muted; ctx.font = `700 24px ${SERIF}`; ctx.fillText(hz[i], cx, 710);
  });
  // nickname
  ctx.fillStyle = C.ink; ctx.font = `700 72px ${SERIF}`; ctx.fillText(result.nick, W / 2, 828);
  ctx.fillStyle = C.ink2; const tl = `${t.name}형 · ${t.tagline}`; let fs = 32;
  do { ctx.font = `500 ${fs}px ${SANS}`; fs -= 2; } while (ctx.measureText(tl).width > W - 180 && fs > 20);
  ctx.fillText(tl, W / 2, 886);

  // blend
  roundRect(ctx, 90, 940, W - 180, 290, 16); ctx.fillStyle = C.surface; ctx.fill();
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.muted; ctx.font = `700 26px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText('가까운 근본 3가지', 130, 994);
  result.blend.forEach((b, i) => {
    const bt = TYPES[b.id]; const y = 1052 + i * 60;
    ctx.fillStyle = C.ink; ctx.font = `700 30px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText(bt.name, 130, y + 10);
    const bx = 300, bwid = 520;
    ctx.fillStyle = C.sunken; roundRect(ctx, bx, y - 7, bwid, 14, 7); ctx.fill();
    ctx.fillStyle = ELEMENTS[bt.el].color;
    roundRect(ctx, bx, y - 7, Math.max(14, bwid * b.pct / 100), 14, 7); ctx.fill();
    ctx.fillStyle = C.ink; ctx.font = `700 36px ${SANS}`; ctx.textAlign = 'right'; ctx.fillText(`${b.pct}%`, W - 130, y + 12);
  });

  ctx.textAlign = 'center'; ctx.fillStyle = C.muted; ctx.font = `500 26px ${SANS}`;
  ctx.fillText(`너의 코드는? · ${url.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}`, W / 2, H - 78);

  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
