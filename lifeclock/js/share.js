/* 남은봄 — 공유 카드 (1080×1350 캔버스) */
(function (root) {
  'use strict';
  var W = 1080, H = 1350;
  var FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  var C = {
    bg: '#fbf5ef', ink: '#23182c', ink2: '#4a3d52', muted: '#8a7d8f', line: '#eadfd6',
    blossom: '#e2486f', soft: '#fde4ea', plum: '#2b1f3a', left: '#e7d9cf', card: '#fffdfa'
  };

  function font(w, px) { return w + ' ' + px + 'px ' + FONT; }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function petal(ctx, cx, cy, s, rot, color, alpha) {
    ctx.save();
    ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);
    ctx.globalAlpha = alpha; ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-12, -14, -8, -30, 0, -36);
    ctx.bezierCurveTo(8, -30, 12, -14, 0, 0);
    ctx.fill();
    ctx.restore();
  }

  async function ensureFonts() {
    try {
      if (document.fonts && document.fonts.load) {
        await Promise.all([
          document.fonts.load(font(900, 100), '0123456789번째날'),
          document.fonts.load(font(700, 30), '남은봄 인생 시계')
        ]);
      }
    } catch (e) { /* 폰트 로드 실패 시 시스템 폰트 */ }
  }

  /* d: { nthDay, manAge, clockText, tiles:[{l,v,u}], livedYears, expectedAge, url } */
  async function draw(canvas, d) {
    await ensureFonts();
    canvas.width = W; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.textBaseline = 'alphabetic';

    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // 상단 밴드
    var g = ctx.createRadialGradient(W, 0, 40, W * 0.6, 260, 900);
    g.addColorStop(0, '#e2486f'); g.addColorStop(0.45, '#6b2c5c'); g.addColorStop(1, '#241631');
    ctx.save(); rr(ctx, 40, 40, W - 80, 470, 48); ctx.clip();
    ctx.fillStyle = g; ctx.fillRect(40, 40, W - 80, 470);
    for (var i = 0; i < 14; i++) {
      petal(ctx, 700 + (i * 97) % 340, 70 + (i * 61) % 380, 1.2 + (i % 4) * 0.5, i * 0.9, '#ffd3df', 0.12 + (i % 3) * 0.05);
    }
    ctx.restore();

    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.font = font(800, 34);
    ctx.fillText('남은봄 · 인생 시계', 96, 120);
    ctx.fillStyle = '#ffffff';
    ctx.font = font(700, 46);
    ctx.fillText('오늘은 인생의', 96, 230);
    ctx.font = font(900, 132);
    var nth = d.nthDay.toLocaleString('ko-KR');
    ctx.fillStyle = '#ffd3df';
    ctx.fillText(nth, 90, 370);
    var nw = ctx.measureText(nth).width;
    ctx.fillStyle = '#ffffff';
    ctx.font = font(800, 54);
    ctx.fillText('번째 날', 90 + nw + 16, 368);
    ctx.font = font(600, 34);
    ctx.fillStyle = 'rgba(255,255,255,.82)';
    ctx.fillText('만 ' + d.manAge + '세 · 지금 내 인생 시각 ' + d.clockText, 96, 450);

    // 타일 3×2
    var tx = 40, ty = 545, tw = (W - 80 - 2 * 20) / 3, th = 168;
    d.tiles.slice(0, 6).forEach(function (t, k) {
      var x = tx + (k % 3) * (tw + 20), y = ty + Math.floor(k / 3) * (th + 20);
      rr(ctx, x, y, tw, th, 30);
      ctx.fillStyle = t.hl ? C.plum : C.card; ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = t.hl ? C.plum : C.line; ctx.stroke();
      ctx.fillStyle = t.hl ? 'rgba(251,245,239,.75)' : C.ink2;
      ctx.font = font(700, 28);
      ctx.fillText(t.l, x + 28, y + 52);
      ctx.fillStyle = t.hl ? '#fbf5ef' : C.ink;
      ctx.font = font(900, 64);
      ctx.fillText(t.v, x + 26, y + 130);
      var vw = ctx.measureText(t.v).width;
      ctx.font = font(750, 30);
      ctx.fillText(t.u, x + 30 + vw, y + 128);
    });

    // 연 단위 인생 점 그리드 (한 점 = 1년)
    var gy = 945, cols = 10, gap = 36, dot = 26;
    var years = Math.max(Math.ceil(d.expectedAge), d.livedYears + 1);
    var rows = Math.ceil(years / cols);
    var scale = Math.min(1, 300 / (rows * gap));
    gap *= scale; dot *= scale;
    var gx = 92;
    ctx.font = font(700, 20);
    for (var r = 0; r < rows; r++) {
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'right';
      ctx.fillText(String(r * 10), gx - 14, gy + r * gap + dot * 0.75);
      ctx.textAlign = 'left';
      for (var c = 0; c < cols; c++) {
        var yr = r * cols + c;
        if (yr >= years) break;
        var cx = gx + c * gap, cy = gy + r * gap;
        rr(ctx, cx, cy, dot, dot, dot * 0.32);
        if (yr < d.livedYears) { ctx.fillStyle = C.plum; ctx.fill(); }
        else if (yr === d.livedYears) { ctx.fillStyle = C.blossom; ctx.fill(); }
        else { ctx.fillStyle = C.left; ctx.fill(); }
      }
    }
    var rx = gx + cols * gap + 50;
    ctx.fillStyle = C.muted; ctx.font = font(700, 28);
    ctx.fillText('한 칸 = 1년', rx, gy + 26);
    ctx.fillStyle = C.ink; ctx.font = font(900, 56);
    ctx.fillText('지나온 ' + d.livedYears + '년', rx, gy + 110);
    ctx.fillStyle = C.blossom;
    ctx.fillText('남은 약 ' + d.remainingYears + '년', rx, gy + 186);
    ctx.fillStyle = C.ink2; ctx.font = font(600, 26);
    ctx.fillText('2024년 생명표 평균 기준', rx, gy + 236);

    // 바닥
    ctx.fillStyle = C.muted; ctx.font = font(650, 26);
    ctx.fillText('통계는 평균일 뿐, 오늘은 당신 거예요.', 60, H - 50);
    ctx.textAlign = 'right';
    ctx.fillStyle = C.ink2; ctx.font = font(750, 26);
    ctx.fillText(d.url, W - 60, H - 50);
    ctx.textAlign = 'left';
    return canvas;
  }

  function toBlob(canvas) {
    return new Promise(function (res) {
      if (canvas.toBlob) canvas.toBlob(function (b) { res(b); }, 'image/png');
      else res(null);
    });
  }

  root.LC_SHARE = { draw: draw, toBlob: toBlob, W: W, H: H };
})(window);
