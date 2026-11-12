// 공유용 이미지 (1080×1350). 이름·일간·띠·점수만 그리고 생년월일은 절대 넣지 않습니다.
import { STEMS, STEM_EL, EL_COLOR, EL_INK, EL_K, EL_H, ELS, ZODIAC } from './ganji.js';
import { layout, edgeWidth } from './graph.js';

const W = 1080, H = 1350;
// 한지 바탕 · 먹 글씨 · 청록 포인트 (그라데이션·그림자 없음)
const C = { paper: '#F3F1EC', paper2: '#EAE7E0', card: '#FBFAF7', ink: '#1C1C1E', ink2: '#45423D', muted: '#6F6B64', accent: '#1F5F57', good: '#3F7D62', mid: '#A39E95', bad: '#B5574B', line: '#DDD8CE' };
const SANS = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
const SERIF = '"Gowun Batang", "Noto Serif KR", serif';
const TONE = { good: C.good, mid: C.mid, bad: C.bad };

async function fontsReady() {
  try {
    await Promise.all([
      document.fonts.load(`700 60px ${SERIF}`, '食궁합甲乙丙丁戊己庚辛壬癸'),
      document.fonts.load(`700 40px ${SANS}`, '식구궁합 가족'),
      document.fonts.load(`600 30px ${SANS}`, '식구궁합 가족'),
    ]);
    await document.fonts.ready;
  } catch { /* 폰트 실패해도 시스템 폰트로 그림 */ }
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

/** model: { title, people, pairs, balance, roles, avg } */
export async function drawShareImage(model) {
  await fontsReady();
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d');
  const { people, pairs, balance, roles } = model;

  // 배경
  ctx.fillStyle = C.paper; ctx.fillRect(0, 0, W, H);
  // 헤더
  ctx.fillStyle = C.accent; rr(ctx, 56, 56, 64, 64, 10); ctx.fill();
  ctx.fillStyle = C.card; ctx.font = `700 36px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('食', 88, 90);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ink; ctx.font = `700 30px ${SANS}`; ctx.fillText('식구궁합', 140, 100);
  ctx.fillStyle = C.ink; ctx.font = `700 64px ${SERIF}`;
  ctx.fillText(fitText(ctx, `${model.title} 궁합판`, W - 112), 56, 208);
  ctx.textAlign = 'right'; ctx.fillStyle = C.muted; ctx.font = `500 30px ${SANS}`;
  ctx.fillText(`${people.length}명 · 평균 ${model.avg}점`, W - 56, 100);
  ctx.fillStyle = C.line; ctx.fillRect(56, 250, W - 112, 2);

  // 관계도
  const n = people.length, cx = W / 2, cy = 618, R = n <= 3 ? 240 : n % 2 === 0 ? 250 : 280;
  const nr = n <= 4 ? 70 : n <= 6 ? 62 : 54;
  const pos = layout(n, cx, cy, R);
  const ordered = pairs.slice().sort((a, b) => Math.abs(a.score - 50) - Math.abs(b.score - 50));
  for (const p of ordered) {
    const a = pos[p.i], b = pos[p.j];
    ctx.strokeStyle = TONE[p.tone]; ctx.globalAlpha = p.tone === 'mid' ? 0.6 : 0.9;
    ctx.lineWidth = edgeWidth(p.score) * 2.3; ctx.lineCap = 'round';
    ctx.setLineDash(p.tone === 'mid' ? [14, 12] : []);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  if (n <= 5) {
    const placed = [];
    for (const p of pairs) {
      const a = pos[p.i], b = pos[p.j];
      for (const t of [0.5, 0.36, 0.64, 0.28, 0.72]) {
        const x = a.x + (b.x - a.x) * t, y = a.y + (b.y - a.y) * t;
        if (pos.every(q => Math.hypot(q.x - x, q.y - y) > nr + 34) && placed.every(q => Math.hypot(q.x - x, q.y - y) > 70)) {
          placed.push({ x, y });
          ctx.fillStyle = C.card; rr(ctx, x - 34, y - 22, 68, 44, 22); ctx.fill();
          ctx.lineWidth = 3; ctx.strokeStyle = TONE[p.tone]; ctx.stroke();
          ctx.fillStyle = TONE[p.tone]; ctx.font = `700 26px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(String(p.score), x, y + 1);
          break;
        }
      }
    }
  }
  people.forEach((person, i) => {
    const { x, y } = pos[i];
    const e = STEM_EL[person.saju.day.stem];
    ctx.fillStyle = C.card; ctx.beginPath(); ctx.arc(x, y, nr + 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = EL_COLOR[e]; ctx.beginPath(); ctx.arc(x, y, nr, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = EL_INK[e]; ctx.font = `700 ${Math.round(nr * 0.8)}px ${SERIF}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(STEMS[person.saju.day.stem], x, y + 3);
    ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.strokeStyle = C.paper; ctx.lineWidth = 10;
    ctx.font = `700 32px ${SANS}`;
    const nm = fitText(ctx, person.name, 230);
    ctx.strokeText(nm, x, y + nr + 44); ctx.fillStyle = C.ink; ctx.fillText(nm, x, y + nr + 44);
    ctx.font = `600 23px ${SANS}`;
    const sub = `${EL_K[e]}(${EL_H[e]}) · ${ZODIAC[person.saju.year.branch]}띠`;
    ctx.strokeText(sub, x, y + nr + 74); ctx.fillStyle = C.muted; ctx.fillText(sub, x, y + nr + 74);
  });

  // 최고/최저 궁합
  const best = pairs.reduce((m, p) => (p.score > m.score ? p : m), pairs[0]);
  const worst = pairs.reduce((m, p) => (p.score < m.score ? p : m), pairs[0]);
  const cardY = 1004;
  const cards = pairs.length > 1 ? [['찰떡 1위', best], ['티격태격 1위', worst]] : [['우리 궁합', best]];
  const cw = cards.length === 2 ? (W - 56 * 2 - 24) / 2 : W - 112;
  cards.forEach(([label, p], k) => {
    const x = 56 + k * (cw + 24);
    ctx.fillStyle = C.card; rr(ctx, x, cardY, cw, 128, 16); ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = TONE[p.tone]; ctx.font = `700 24px ${SANS}`; ctx.fillText(label, x + 26, cardY + 42);
    ctx.fillStyle = C.ink; ctx.font = `700 31px ${SANS}`;
    ctx.fillText(fitText(ctx, `${people[p.i].name} × ${people[p.j].name}`, cw - 150), x + 26, cardY + 92);
    ctx.textAlign = 'right'; ctx.fillStyle = TONE[p.tone]; ctx.font = `700 56px ${SANS}`;
    ctx.fillText(String(p.score), x + cw - 24, cardY + 96);
  });

  // 역할
  const roleLine = roles.filter(r => r.who !== null).map(r => `${r.name} ${people[r.who].name}`).join('  ·  ');
  ctx.textAlign = 'center'; ctx.fillStyle = C.ink2; ctx.font = `700 27px ${SANS}`;
  if (roleLine) ctx.fillText(fitText(ctx, roleLine, W - 112), W / 2, 1176);

  // 오행 밸런스 바
  const bx = 56, by = 1196, bw = W - 112, bh = 40;
  ctx.save(); rr(ctx, bx, by, bw, bh, 10); ctx.clip();
  let acc = bx;
  ELS.forEach(e => {
    const w = bw * balance.ratio[e];
    ctx.fillStyle = EL_COLOR[e]; ctx.fillRect(acc, by, w + 0.5, bh);
    if (w > 70) {
      ctx.fillStyle = EL_INK[e]; ctx.font = `700 21px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${EL_H[e]} ${Math.round(balance.ratio[e] * 100)}%`, acc + w / 2, by + bh / 2 + 1);
    }
    acc += w;
  });
  ctx.restore();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = C.ink; ctx.font = `700 25px ${SANS}`;
  const lack = balance.lack.map(e => `${EL_K[e]}(${EL_H[e]})`).join('·');
  ctx.fillText(`${balance.relative ? '가장 적은 기운' : '우리 가족에게 부족한 기운'}: ${lack}`, bx, by + bh + 36);

  // 푸터
  ctx.fillStyle = C.muted; ctx.font = `600 21px ${SANS}`; ctx.textAlign = 'left';
  ctx.fillText('leebeesoo.github.io/gene/family', 56, H - 22);
  ctx.textAlign = 'right'; ctx.fillText('전통 이론으로 재미로 보는 궁합', W - 56, H - 22);
  return cv;
}

export function canvasToBlob(cv) {
  return new Promise((res, rej) => cv.toBlob(b => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
}
