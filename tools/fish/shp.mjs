// 아주 작은 SHP/DBF 읽기 + 좌표 변환(의존성 없음). 낚시금지구역·출입통제구역 파일 변환용.
// 지원: 폴리곤(5)·폴리라인(3)·점(1) 레코드, DBF 문자/숫자 칸, 인코딩 EUC-KR(cp949)·UTF-8.
// 좌표계: WGS84(경위도) 그대로, 또는 EPSG:5179(Korea 2000 / Unified CS, UTM-K) → WGS84 역변환.
import { readFileSync, existsSync } from 'node:fs';

export function readDbf(buf, encoding = 'euc-kr') {
  const dec = new TextDecoder(encoding);
  const n = buf.readUInt32LE(4), headLen = buf.readUInt16LE(8), recLen = buf.readUInt16LE(10);
  const fields = [];
  for (let o = 32; buf[o] !== 0x0d && o < headLen; o += 32) {
    const name = dec.decode(buf.subarray(o, o + 11)).replace(/\0[\s\S]*$/, '').trim();
    fields.push({ name, type: String.fromCharCode(buf[o + 11]), len: buf[o + 16] });
  }
  const rows = [];
  for (let i = 0; i < n; i++) {
    let o = headLen + i * recLen;
    if (buf[o] === 0x2a) continue; // 지운 행
    o += 1;
    const row = {};
    for (const f of fields) {
      const raw = dec.decode(buf.subarray(o, o + f.len)).replace(/\0/g, '').trim();
      row[f.name] = f.type === 'N' || f.type === 'F' ? (raw === '' ? null : Number(raw)) : raw;
      o += f.len;
    }
    rows.push(row);
  }
  return { fields, rows };
}

export function readShp(buf) {
  const shapeType = buf.readInt32LE(32);
  const out = [];
  let o = 100;
  while (o + 8 <= buf.length) {
    const len = buf.readInt32BE(o + 4) * 2;
    const c = o + 8;
    const t = buf.readInt32LE(c);
    if (t === 0) out.push(null);
    else if (t === 1 || t === 11 || t === 21) out.push({ type: 'Point', coordinates: [buf.readDoubleLE(c + 4), buf.readDoubleLE(c + 12)] });
    else if ([3, 5, 13, 15, 23, 25].includes(t)) {
      const nParts = buf.readInt32LE(c + 36), nPts = buf.readInt32LE(c + 40);
      const parts = []; for (let i = 0; i < nParts; i++) parts.push(buf.readInt32LE(c + 44 + i * 4));
      const p0 = c + 44 + nParts * 4;
      const rings = parts.map((s, i) => {
        const e = i + 1 < nParts ? parts[i + 1] : nPts;
        const r = []; for (let k = s; k < e; k++) r.push([buf.readDoubleLE(p0 + k * 16), buf.readDoubleLE(p0 + k * 16 + 8)]);
        return r;
      });
      out.push({ type: t % 10 === 5 ? 'Polygon' : 'LineString', rings });
    } else throw new Error(`지원하지 않는 SHP 도형 ${t}`);
    o = c + len;
  }
  return { shapeType, shapes: out };
}

/* EPSG:5179 역변환(Transverse Mercator, GRS80, lon0 127.5, lat0 38, k0 0.9996, FE 1,000,000, FN 2,000,000) */
export function utmkToWgs84(x, y) {
  const a = 6378137, f = 1 / 298.257222101, k0 = 0.9996, lon0 = 127.5 * Math.PI / 180, lat0 = 38 * Math.PI / 180;
  const FE = 1000000, FN = 2000000;
  const e2 = f * (2 - f), ep2 = e2 / (1 - e2);
  const M = phi => a * ((1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256) * phi - (3 * e2 / 8 + 3 * e2 ** 2 / 32 + 45 * e2 ** 3 / 1024) * Math.sin(2 * phi)
    + (15 * e2 ** 2 / 256 + 45 * e2 ** 3 / 1024) * Math.sin(4 * phi) - (35 * e2 ** 3 / 3072) * Math.sin(6 * phi));
  const m = M(lat0) + (y - FN) / k0;
  const mu = m / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
  const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
  const phi1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const C1 = ep2 * Math.cos(phi1) ** 2, T1 = Math.tan(phi1) ** 2;
  const N1 = a / Math.sqrt(1 - e2 * Math.sin(phi1) ** 2), R1 = a * (1 - e2) / (1 - e2 * Math.sin(phi1) ** 2) ** 1.5;
  const D = (x - FE) / (N1 * k0);
  const lat = phi1 - (N1 * Math.tan(phi1) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24
    + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720);
  const lon = lon0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120) / Math.cos(phi1);
  return [lon * 180 / Math.PI, lat * 180 / Math.PI];
}

/** base 경로(확장자 없이)의 .shp/.dbf/.prj/.cpg 를 읽어 [{props, geom(WGS84)}] 로 */
export function readShapefile(base) {
  const shp = readShp(readFileSync(base + '.shp'));
  const cpg = existsSync(base + '.cpg') ? readFileSync(base + '.cpg', 'utf8').trim().toLowerCase() : '';
  const enc = /utf-?8/.test(cpg) ? 'utf-8' : 'euc-kr'; // 949·EUC-KR·없음 → EUC-KR
  const dbf = readDbf(readFileSync(base + '.dbf'), enc);
  const prj = existsSync(base + '.prj') ? readFileSync(base + '.prj', 'utf8') : '';
  const isUtmk = /Transverse_Mercator/i.test(prj) && /127\.5/.test(prj) && /2000000/.test(prj);
  const isGeo = /^GEOGCS/i.test(prj.trim()) || !prj;
  if (!isUtmk && !isGeo) throw new Error(`모르는 좌표계: ${prj.slice(0, 80)}`);
  const conv = isUtmk ? ([x, y]) => utmkToWgs84(x, y) : ([x, y]) => [x, y];
  const features = shp.shapes.map((g, i) => {
    if (!g) return { props: dbf.rows[i], geom: null };
    if (g.type === 'Point') return { props: dbf.rows[i], geom: { type: 'Point', coordinates: conv(g.coordinates) } };
    return { props: dbf.rows[i], geom: { type: g.type, rings: g.rings.map(r => r.map(conv)) } };
  });
  return { fields: dbf.fields, features, crs: isUtmk ? 'EPSG:5179' : 'EPSG:4326', encoding: enc };
}

/** 고리들의 경계 상자와 넓이 가중 중심(대략) */
export function bboxCenter(rings) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rings) for (const [x, y] of r) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }
  return { bbox: [x0, y0, x1, y1], center: [(x0 + x1) / 2, (y0 + y1) / 2] };
}

/** Douglas–Peucker 단순화(도 단위 tol) */
export function simplify(pts, tol) {
  if (pts.length <= 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop();
    let md = 0, mi = -1;
    const [ax, ay] = pts[s], [bx, by] = pts[e];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy || 1e-18;
    for (let i = s + 1; i < e; i++) {
      const [px, py] = pts[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / L));
      const d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      if (d > md) { md = d; mi = i; }
    }
    if (mi > 0 && md > tol * tol) { keep[mi] = 1; stack.push([s, mi], [mi, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
