// 물때명당(/fish/) 자료 처리 함수 모음. 의존성 없음(Node 18+). 화면에서는 쓰지 않고 수집·빌드·테스트에서만 씀.
// 응답 칸 이름은 data.go.kr 오픈API 명세와 기관 활용가이드(2026-11-20 확인)를 따랐다. 실제 응답을 받으면 README의 「확인할 것」을 보고 고친다.
import { inflateRawSync } from 'node:zlib';

/* ---------- 날짜(한국 시간) ---------- */
export const KST_OFFSET = 9 * 3600 * 1000;
export const kstDate = (d = new Date()) => new Date(d.getTime() + KST_OFFSET).toISOString().slice(0, 10);
export const ymd = s => s.replace(/-/g, '');
export function shiftDate(date, days) { const t = new Date(date + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + days); return t.toISOString().slice(0, 10); }

/* ---------- 금어기 계산(화면 js/app.js 와 같은 규칙) ---------- */
/** mmdd 가 from~to(양 끝 포함) 안에 있는지. from > to 이면 해를 넘기는 기간(예: 12-01 ~ 01-31) */
export function inPeriod(mmdd, from, to) { return from <= to ? mmdd >= from && mmdd <= to : mmdd >= from || mmdd <= to; }
/** 오늘(mmdd) 금어기인 규칙 목록: [{rule, kind:'closed'|'notice', periods}] */
export function closedOn(rules, mmdd) {
  const out = [];
  for (const r of rules) {
    const hit = (r.closed || []).filter(p => inPeriod(mmdd, p.from, p.to));
    if (hit.length) out.push({ id: r.id, name: r.name, kind: 'closed', where: hit.map(p => p.where).filter(Boolean), partial: hit.every(p => p.where) });
    else if (r.notice && inPeriod(mmdd, r.notice.from, r.notice.to)) out.push({ id: r.id, name: r.name, kind: 'notice', where: [], partial: true });
  }
  return out;
}
export const fmtMd = mmdd => `${Number(mmdd.slice(0, 2))}월 ${Number(mmdd.slice(3, 5))}일`;
/** 금지체장 문장: 「25cm 이하는 잡으면 안 돼요」 */
export function sizeSentence(r) {
  if (!r.size) return '';
  const s = r.size;
  if (s.min != null) return `${s.min}${s.unit} 이상 ${s.max}${s.unit} 이하는 잡으면 안 돼요`;
  return `${s.how === '체중' ? '' : s.how + ' '}${s.max}${s.unit === 'g' ? '그램' : s.unit} 이하는 잡으면 안 돼요`;
}

/* ---------- data.go.kr 공통 ---------- */
/** 인증키는 '인코딩 키'를 그대로 쓰는 경우가 많아 serviceKey만 직접 이어 붙인다(이미 인코딩된 키는 그대로 둔다) */
export function dataGoUrl(base, key, params) {
  const sk = /%[0-9A-F]{2}/i.test(key) ? key : encodeURIComponent(key);
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== '').map(([k, v]) => [k, String(v)])).toString();
  return `${base}?serviceKey=${sk}&${qs}`;
}
export const INDEX_BASE = 'https://apis.data.go.kr/1192136/fcstFishingv2/GetFcstFishingApiServicev2';
export const TIDE_BASE = 'https://apis.data.go.kr/1192136/tideFcstHghLw/GetTideFcstHghLwApiService';
export const BOAT_BASE = 'https://apis.data.go.kr/1192000/select0230List/getselect0230List';
export const GUBUN = ['갯바위', '선상'];
export const indexUrl = (key, { gubun, reqDate, page = 1, rows = 300, placeName = null }) =>
  dataGoUrl(INDEX_BASE, key, { type: 'json', reqDate: reqDate && ymd(reqDate), gubun, pageNo: page, numOfRows: rows, placeName });
export const tideUrl = (key, { obsCode, reqDate, page = 1, rows = 20 }) =>
  dataGoUrl(TIDE_BASE, key, { type: 'json', obsCode, reqDate: reqDate && ymd(reqDate), pageNo: page, numOfRows: rows });
export const boatUrl = (key, { page = 1, rows = 500 }) => dataGoUrl(BOAT_BASE, key, { type: 'json', pageNo: page, numOfRows: rows });

/** 아주 작은 XML → 객체(평평한 <item> 목록과 헤더만). 공공데이터포털 오류 응답과 XML 기본 응답 대비용 */
export function parseXmlItems(xml) {
  const tag = (s, t) => { const m = s.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)); return m ? m[1].trim() : undefined; };
  const err = tag(xml, 'cmmMsgHeader');
  if (err != null) return { OpenAPI_ServiceResponse: { cmmMsgHeader: { errMsg: tag(err, 'errMsg'), returnAuthMsg: tag(err, 'returnAuthMsg'), returnReasonCode: tag(err, 'returnReasonCode') } } };
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(m => Object.fromEntries([...m[1].matchAll(/<(\w+)>([\s\S]*?)<\/\1>/g)].map(x => [x[1], x[2].trim()])));
  const head = tag(xml, 'header') || '';
  return { response: { header: { resultCode: tag(head, 'resultCode'), resultMsg: tag(head, 'resultMsg') }, body: { items: { item: items }, totalCount: Number(tag(xml, 'totalCount') ?? items.length) } } };
}

/** JSON(또는 XML 문자열) 응답 → {ok, items, total, error}. 성공 코드는 '00'(명세 예제)·'0'(활용가이드 표) 둘 다 받아 준다 */
export function parseDataGo(input) {
  const json = typeof input === 'string' ? (input.trim().startsWith('<') ? parseXmlItems(input) : JSON.parse(input)) : input;
  const err = json?.OpenAPI_ServiceResponse?.cmmMsgHeader;
  if (err) return { ok: false, error: `${err.returnReasonCode} ${err.returnAuthMsg || err.errMsg}`, items: [], total: 0 };
  const res = json?.response ?? json?.responseXml ?? json;
  const head = res?.header ?? {};
  const code = String(head.resultCode ?? '');
  if (code === '03' || code === '3') return { ok: true, items: [], total: 0, nodata: true };
  if (!res || (code && !['00', '0', '000'].includes(code))) return { ok: false, error: `${code} ${head.resultMsg ?? 'no response'}`, items: [], total: 0 };
  const body = res.body ?? {};
  let items = body.items?.item ?? body.items ?? body.item ?? [];
  if (!Array.isArray(items)) items = items && typeof items === 'object' ? [items] : [];
  const total = Number(body.totalCount ?? head.totalCount ?? body.items?.totalCount ?? items.length) || 0;
  return { ok: true, total, items };
}
const num = v => (v == null || v === '' || v === '-' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const txt = v => (v == null || v === '-' ? '' : String(v).trim());

/* ---------- 바다낚시지수(15142486) ---------- */
// 명세(활용가이드 261022): seafsPstnNm 위치, lat, lot, predcYmd(YYYY-MM-DD), predcNoonSeCd(오전/오후), seafsTgfshNm 대상어('-' 가능),
// tdlvHrCn 물때, tdlvHrScr 물때점수, min/maxWvhgt 파고(m), min/maxWtem 수온(℃), min/maxArtmp 기온, min/maxCrsp 유속(kn), min/maxWspd 풍속(m/s), totalIndex 지수, lastScr 점수
export const INDEX_LEVELS = ['매우좋음', '좋음', '보통', '나쁨', '매우나쁨']; // ← 실제 응답 문자열 확인 필요(명세 예시는 「나쁨」「보통」만)
export function normIndex(items, gubun) {
  const by = new Map();
  for (const it of items) {
    const name = txt(it.seafsPstnNm);
    if (!name) continue;
    const key = `${gubun}|${name}`;
    if (!by.has(key)) by.set(key, { name, gubun, lat: num(it.lat), lng: num(it.lot), days: [] });
    by.get(key).days.push({
      date: txt(it.predcYmd).replace(/\./g, '-').slice(0, 10), ampm: txt(it.predcNoonSeCd), species: txt(it.seafsTgfshNm),
      tide: txt(it.tdlvHrCn), tideScore: num(it.tdlvHrScr), index: txt(it.totalIndex), score: num(it.lastScr),
      wave: [num(it.minWvhgt), num(it.maxWvhgt)], wtemp: [num(it.minWtem), num(it.maxWtem)], atemp: [num(it.minArtmp), num(it.maxArtmp)],
      current: [num(it.minCrsp), num(it.maxCrsp)], wind: [num(it.minWspd), num(it.maxWspd)]
    });
  }
  for (const p of by.values()) p.days.sort((a, b) => (a.date + (a.ampm === '오후' ? 1 : 0)).localeCompare(b.date + (b.ampm === '오후' ? 1 : 0)));
  return [...by.values()];
}

/* ---------- 조석예보 고·저조(15156018) ---------- */
// 명세(활용가이드 261106): obsvtrNm 예보지점명, lot, lat, predcDt 'YYYY-MM-DD HH:mm', predcTdlvVl 조위(cm), extrSe 1 오전 고조·2 오전 저조·3 오후 고조·4 오후 저조
export const EXTR = { 1: ['오전', '고조'], 2: ['오전', '저조'], 3: ['오후', '고조'], 4: ['오후', '저조'] };
export function normTide(items) {
  if (!items.length) return null;
  const f = items[0];
  const events = items.map(it => {
    const e = EXTR[Number(it.extrSe)] || [null, null];
    return { time: txt(it.predcDt), level: num(it.predcTdlvVl), type: e[1], ampm: e[0] };
  }).filter(e => e.time).sort((a, b) => a.time.localeCompare(b.time));
  return { station: txt(f.obsvtrNm), lat: num(f.lat), lng: num(f.lot), events };
}

/* ---------- 낚시어선업 신고정보(15074088) ---------- */
// 명세: fsboNo 어선번호, fsboNm 어선명, fshNtNm 신고확인번호, fsboTotTons 총톤수, fshryApvPermNm 어업허가번호, shpmHangNm 선적항,
// maxShcrNum 최대 선원 수('2명'), maxPsrNum 최대 승객 수('17명'), bsnStEndDt 유효기간('2023.06.12 ~ 2024.06.12')
export function parseValidity(s) {
  const m = String(s || '').match(/(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\s*~\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  const d = (y, mo, da) => `${y}-${mo.padStart(2, '0')}-${da.padStart(2, '0')}`;
  return { from: d(m[1], m[2], m[3]), to: d(m[4], m[5], m[6]) };
}
/** 선적항 문자열 → { sido, sigungu, port } (예: 부산광역시 서구 암남항) */
export function splitPort(s) {
  const parts = txt(s).split(/\s+/).filter(Boolean);
  if (!parts.length) return { sido: '', sigungu: '', port: '' };
  return { sido: parts[0], sigungu: parts.slice(1, -1).join(' '), port: parts[parts.length - 1] };
}
/** 신고 유효기간이 끝난 배는 뺀다. 전화번호는 응답에 없고, 있더라도 싣지 않는다 */
export function normBoats(items, today) {
  const out = [];
  let expired = 0, unknown = 0;
  for (const it of items) {
    const v = parseValidity(it.bsnStEndDt);
    if (!v) { unknown++; continue; }
    if (v.to < today) { expired++; continue; }
    const p = splitPort(it.shpmHangNm);
    out.push({ name: txt(it.fsboNm), port: p.port, sido: p.sido, sigungu: p.sigungu, tons: num(it.fsboTotTons), maxPassengers: num(String(it.maxPsrNum ?? '').replace(/[^0-9.]/g, '')), validTo: v.to });
  }
  out.sort((a, b) => (a.sido + a.port + a.name).localeCompare(b.sido + b.port + b.name, 'ko'));
  return { boats: out, expired, unknown };
}

/* ---------- ZIP(공공데이터포털 파일) ---------- */
/** 중앙 디렉터리를 읽어 [{name, data}] 반환. 파일 이름은 UTF-8 표시가 없으면 cp949로 읽는다 */
export function unzip(buf) {
  let e = buf.length - 22;
  while (e >= 0 && buf.readUInt32LE(e) !== 0x06054b50) e--;
  if (e < 0) throw new Error('zip 끝 표시 없음');
  const n = buf.readUInt16LE(e + 10);
  let o = buf.readUInt32LE(e + 16);
  const out = [];
  for (let i = 0; i < n; i++) {
    if (buf.readUInt32LE(o) !== 0x02014b50) throw new Error('zip 중앙 디렉터리 오류');
    const flag = buf.readUInt16LE(o + 8), method = buf.readUInt16LE(o + 10), csize = buf.readUInt32LE(o + 20);
    const nl = buf.readUInt16LE(o + 28), xl = buf.readUInt16LE(o + 30), cl = buf.readUInt16LE(o + 32), lo = buf.readUInt32LE(o + 42);
    const raw = buf.subarray(o + 46, o + 46 + nl);
    const name = new TextDecoder(flag & 0x800 ? 'utf-8' : 'euc-kr').decode(raw);
    const lnl = buf.readUInt16LE(lo + 26), lxl = buf.readUInt16LE(lo + 28);
    const start = lo + 30 + lnl + lxl, comp = buf.subarray(start, start + csize);
    if (!name.endsWith('/')) out.push({ name, data: method === 0 ? Buffer.from(comp) : method === 8 ? inflateRawSync(comp) : null });
    o += 46 + nl + xl + cl;
  }
  return out;
}

/* ---------- 파일 자료 정리 ---------- */
/** 해경 연안 출입통제구역(15110667) 속성 → 화면용. 칸: num, pname(파출소 등), name, place_type, plave_type(장소 유형), address, announceme(공고) */
export function normControlZone(props, center) {
  return {
    kind: 'control', name: txt(props.name), type: txt(props.plave_type), address: txt(props.address), notice: txt(props.announceme),
    station: txt(props.pname), lat: +center[1].toFixed(5), lng: +center[0].toFixed(5)
  };
}
/** 국립해양조사원 낚시금지구역(15130115, 전자해도 제한구역 TL_RESARE_ENS) 속성 → 화면용 */
export function normBanZone(props, center) {
  return {
    kind: 'ban', name: txt(props.korn_nm) || txt(props.korn_etc_i) || '낚시금지구역', enc: txt(props.enc_no), made: txt(props.fbctn_ymd),
    lat: +center[1].toFixed(5), lng: +center[0].toFixed(5)
  };
}
/** 전국낚시터정보표준데이터(15021144) 한 행 → 화면용. 전화번호는 싣지 않는다 */
export function normFreshwater(r) {
  const lat = num(r.LATITUDE ?? r['위도']), lng = num(r.LONGITUDE ?? r['경도']);
  return {
    name: txt(r.FSHLC_NM ?? r['낚시터명']), type: txt(r.FSHLC_TYPE ?? r['낚시터유형']),
    address: txt(r.RDNMADR ?? r['소재지도로명주소']) || txt(r.LNMADR ?? r['소재지지번주소']),
    lat: lat && lat > 32 && lat < 39 ? lat : null, lng: lng && lng > 124 && lng < 132 ? lng : null,
    species: txt(r.KDFSH ?? r['주요어종']), manager: txt(r.INSTITUTION_NM ?? r['관리기관명']), refDate: txt(r.REFERENCE_DATE ?? r['데이터기준일자'])
  };
}
export const SIDO_PREFIX = [
  ['서울', /^서울/], ['부산', /^부산/], ['대구', /^대구/], ['인천', /^인천/], ['광주', /^광주광역시|^광주 /], ['대전', /^대전/], ['울산', /^울산/], ['세종', /^세종/],
  ['경기', /^경기/], ['강원', /^강원/], ['충북', /^충청북도|^충북/], ['충남', /^충청남도|^충남/], ['전북', /^전라북도|^전북/], ['전남', /^전라남도|^전남/],
  ['경북', /^경상북도|^경북/], ['경남', /^경상남도|^경남/], ['제주', /^제주/]
];
export function sidoOfAddress(a) { for (const [k, re] of SIDO_PREFIX) if (re.test(String(a || '').trim())) return k; return null; }

/* ---------- 거리 ---------- */
export function distKm(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
