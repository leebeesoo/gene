import { TYPES, ELEMENTS, AXES } from './data.js';
import { emblemSVG } from './emblems.js';
import { typeBits } from './engine.js';

const SERIF = '"Noto Serif KR", "Nanum Myeongjo", serif';
const SANS = '"Pretendard Variable", Pretendard, system-ui, sans-serif';

function loadImg(src) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
}
const svgUrl = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);

async function ensureFonts(text) {
  try {
    await Promise.all([
      document.fonts.load(`900 80px ${SERIF}`, text), document.fonts.load(`700 40px ${SERIF}`, text),
      document.fonts.load(`700 36px ${SANS}`, text), document.fonts.load(`800 36px ${SANS}`, text),
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
  const text = `${name}님의 근본은${t.name}형${t.hanja}${t.tagline}내 안에 흐르는 피${result.blend.map(b => TYPES[b.id].name).join('')}0123456789%·너의 근본은? 근본 테스트에서 확인하기思行守遊理情獨群根本`;
  await ensureFonts(text);

  // background
  const g = ctx.createRadialGradient(W * .8, 0, 50, W * .5, H * .4, H);
  g.addColorStop(0, '#2a3e66'); g.addColorStop(.45, '#15213b'); g.addColorStop(1, '#0a1428');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // giant hanja watermark
  ctx.save(); ctx.globalAlpha = .05; ctx.fillStyle = '#f5efe3'; ctx.font = `900 520px ${SERIF}`; ctx.textAlign = 'center';
  ctx.fillText(t.hanja.slice(0, 1), W * .78, 560); ctx.restore();
  // dancheong band
  const band = ['#b8332a', '#c9962f', '#1f6f66', '#2c4a7c'];
  const bw = [44, 16, 44, 16]; let x = 0, k = 0;
  while (x < W) { ctx.fillStyle = band[k % 4]; ctx.fillRect(x, H - 26, bw[k % 4], 26); x += bw[k % 4]; k++; }

  // header
  ctx.fillStyle = '#b8332a'; ctx.save(); ctx.translate(96, 96); ctx.rotate(-.07); roundRect(ctx, -34, -34, 68, 68, 14); ctx.fill();
  ctx.fillStyle = '#fbf3e4'; ctx.font = `900 40px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('根', 0, 2); ctx.restore();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#f5efe3'; ctx.font = `800 38px ${SANS}`; ctx.fillText('근본 테스트', 148, 110);

  ctx.textAlign = 'center'; ctx.fillStyle = '#b9c3d6'; ctx.font = `700 40px ${SANS}`;
  ctx.fillText(`${name}님의 근본은`, W / 2, 230);

  // emblem
  const img = await loadImg(svgUrl(emblemSVG(result.typeId, 400)));
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 20;
  ctx.drawImage(img, W / 2 - 180, 260, 360, 360); ctx.restore();

  // name
  ctx.fillStyle = '#f5efe3'; ctx.font = `900 120px ${SERIF}`;
  const nm = `${t.name}형`; const nmW = ctx.measureText(nm).width;
  ctx.font = `900 54px ${SERIF}`; const hjW = ctx.measureText(t.hanja).width;
  const total = nmW + 22 + hjW; const sx = W / 2 - total / 2;
  ctx.textAlign = 'left'; ctx.font = `900 120px ${SERIF}`; ctx.fillText(nm, sx, 770);
  ctx.fillStyle = '#f2c46a'; ctx.font = `900 54px ${SERIF}`; ctx.fillText(t.hanja, sx + nmW + 22, 770);

  // code
  const bits = typeBits(result.typeId);
  const code = AXES.map((a, i) => bits[i] ? a.neg.h : a.pos.h);
  ctx.font = `900 34px ${SERIF}`; ctx.textAlign = 'center';
  code.forEach((ch, i) => {
    const cx = W / 2 - 99 + i * 66;
    ctx.fillStyle = 'rgba(245,239,227,.1)'; roundRect(ctx, cx - 26, 800, 52, 52, 10); ctx.fill();
    ctx.fillStyle = '#f5efe3'; ctx.fillText(ch, cx, 838);
  });
  ctx.fillStyle = '#cfd6e4'; ctx.font = `600 34px ${SANS}`; ctx.fillText(t.tagline, W / 2, 912);

  // blend
  roundRect(ctx, 90, 958, W - 180, 300, 28); ctx.fillStyle = 'rgba(245,239,227,.07)'; ctx.fill();
  ctx.fillStyle = '#f2c46a'; ctx.font = `800 28px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText('내 안에 흐르는 피', 130, 1010);
  result.blend.forEach((b, i) => {
    const bt = TYPES[b.id]; const y = 1062 + i * 64;
    ctx.fillStyle = '#f5efe3'; ctx.font = `800 32px ${SANS}`; ctx.textAlign = 'left'; ctx.fillText(bt.name, 130, y + 11);
    const bx = 300, bwid = 520;
    ctx.fillStyle = 'rgba(255,255,255,.12)'; roundRect(ctx, bx, y - 10, bwid, 22, 11); ctx.fill();
    ctx.fillStyle = ELEMENTS[bt.el].color === '#25467a' ? '#5f86c6' : ELEMENTS[bt.el].color;
    if (bt.el === 'metal') ctx.fillStyle = '#b8c3d1';
    roundRect(ctx, bx, y - 10, Math.max(22, bwid * b.pct / 100), 22, 11); ctx.fill();
    ctx.fillStyle = '#f5efe3'; ctx.font = `900 40px ${SERIF}`; ctx.textAlign = 'right'; ctx.fillText(`${b.pct}%`, W - 130, y + 14);
  });

  ctx.textAlign = 'center'; ctx.fillStyle = '#9fabc2'; ctx.font = `600 26px ${SANS}`;
  ctx.fillText(`너의 근본은? · ${url.replace(/^https?:\/\//, '').replace(/\?.*$/, '')}`, W / 2, H - 52);

  return new Promise(res => c.toBlob(b => res(b), 'image/png'));
}
