// 공유 링크 인코딩: #g=<base64url(JSON)>. 링크에는 입력한 이름·관계·생년월일·시간이 그대로 들어갑니다.
export const RELS = ['나', '배우자', '엄마', '아빠', '형제자매', '자녀', '할머니', '할아버지', '친구', '연인', '동료', '기타'];
const CAL = ['s', 'l', 'L']; // 양력, 음력, 음력 윤달

function b64urlEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
const pad = (n, w = 2) => String(n).padStart(w, '0');

export function encodeBoard(board) {
  const p = board.people.map(x => {
    const cal = x.cal === 'lunar' ? (x.leap ? 'L' : 'l') : 's';
    const rel = RELS.indexOf(x.rel);
    return [x.name, rel >= 0 ? rel : x.rel, `${x.y}${pad(x.m)}${pad(x.d)}${cal}${x.time ? x.time.replace(':', '') : ''}`];
  });
  return 'g=' + b64urlEncode(JSON.stringify({ v: 1, t: board.title, p }));
}

export function decodeBoard(hash) {
  const m = /(?:^|[#&])g=([A-Za-z0-9_-]+)/.exec(hash || '');
  if (!m) return null;
  try {
    const o = JSON.parse(b64urlDecode(m[1]));
    if (!o || o.v !== 1 || !Array.isArray(o.p)) return null;
    const people = o.p.slice(0, 8).map((row, i) => {
      const [name, rel, code] = row;
      const mm = /^(\d{4})(\d{2})(\d{2})([slL])(\d{4})?$/.exec(String(code));
      if (!mm || typeof name !== 'string') throw new Error('bad row');
      return {
        id: 'p' + i + Math.random().toString(36).slice(2, 7),
        name: name.slice(0, 12),
        rel: typeof rel === 'number' ? (RELS[rel] || '기타') : String(rel).slice(0, 8),
        y: +mm[1], m: +mm[2], d: +mm[3],
        cal: mm[4] === 's' ? 'solar' : 'lunar', leap: mm[4] === 'L',
        time: mm[5] ? `${mm[5].slice(0, 2)}:${mm[5].slice(2)}` : '',
      };
    });
    return { title: typeof o.t === 'string' ? o.t.slice(0, 20) : '공유받은 궁합판', people };
  } catch { return null; }
}
