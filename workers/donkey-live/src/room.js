/*
 * 칠판 방의 규칙(순수 함수 — Durable Object 없이 node로 시험할 수 있게 분리)
 *
 * 방이 기억하는 것(메모리에만, 디스크에 쓰지 않음):
 *   notes   : 최근 60초 안의 글 id → { by(접속 id), ip(하루마다 바뀌는 IP 섞은 값), until, reporters }
 *             글 내용은 기억하지 않는다. 신고 집계에 필요한 표시만.
 *   strikes : ip → { count, mutedUntil }  3번 숨겨지면 24시간 쓰기 금지
 *   recent  : 방 전체 최근 1초 글 시각(붐빔 판단)
 *
 * 결과는 「할 일 목록」으로 돌려준다: [{ to: 'sender'|'all'|'others', msg }]
 */
import F from '../../../donkey/js/filter.js';

const L = F.LIMITS;

export function createRoom() {
  return { notes: new Map(), strikes: new Map(), recent: [], seq: 0 };
}

export function newConn(id, ip) {
  return { id, ip: ip || '', rate: { last: null, times: [], lastText: '' } };
}

function rid() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function sweep(room, now) {
  for (const [id, n] of room.notes) if (n.until + 30000 < now) room.notes.delete(id); // 화면에서 사라진 뒤 30초까지만 신고 받음
  for (const [ip, s] of room.strikes) if (s.mutedUntil && s.mutedUntil < now && s.count >= L.strikesToMute) room.strikes.delete(ip);
  room.recent = room.recent.filter((t) => now - t < 1000);
}

// 붐빔 정도 0~1: 지금 떠 있는 글 수 기준(60개면 1)
function busy(room, now) {
  let live = 0;
  for (const n of room.notes.values()) if (n.until > now) live++;
  return Math.min(1, live / 60);
}

export function isMuted(room, ip, now) {
  const s = ip && room.strikes.get(ip);
  return !!(s && s.mutedUntil && s.mutedUntil > now);
}

/*
 * 글 올리기. msg = { t: 'post', text, nonce }
 */
export function onPost(room, conn, msg, now, opts = {}) {
  sweep(room, now);
  const nonce = typeof msg.nonce === 'string' ? msg.nonce.slice(0, 24) : '';
  const reject = (code, message, extra) => [{ to: 'sender', msg: Object.assign({ t: 'reject', nonce, code, message }, extra || {}) }];

  if (opts.closed) return [{ to: 'sender', msg: { t: 'closed' } }];
  if (typeof msg.text !== 'string') return reject('bad', '글을 읽지 못했어요.');
  if (isMuted(room, conn.ip, now)) return reject('muted', '신고가 여러 번 쌓여서 24시간 동안 글을 쓸 수 없어요.');

  const r = F.check(msg.text);
  if (r.action === 'block') return reject(r.code, r.message, r.care ? { care: true } : null);

  if (r.action === 'send' && room.recent.length >= L.roomPerSec) {
    return reject('busy', '지금 칠판이 붐벼요. 몇 초 뒤에 다시 보내 주세요.', { waitMs: 3000 }); // 도배 횟수에는 넣지 않음
  }

  const rl = F.rate(conn.rate, now, msg.text);
  if (!rl.ok) return reject(rl.code, rl.message, { waitMs: rl.waitMs });

  if (r.action === 'self') {
    // 본인에게만: 방송하지 않고, 글쓴이 화면에 109 안내
    return [{ to: 'sender', msg: { t: 'care', nonce, text: r.text, ttl: F.ttl(r.text, 0), message: r.message } }];
  }

  room.recent.push(now);

  const id = rid();
  const ttl = F.ttl(r.text, busy(room, now));
  room.notes.set(id, { by: conn.id, ip: conn.ip, until: now + ttl * 1000, reporters: new Set() });
  const note = { t: 'note', id, text: r.text, ttl };
  return [
    { to: 'sender', msg: { t: 'ack', nonce, id, text: r.text, ttl } },
    { to: 'others', msg: note }
  ];
}

/*
 * 신고. msg = { t: 'report', id }  서로 다른 3명(접속 id와 ip가 모두 달라야 함)이면 모두에게서 숨김
 */
export function onReport(room, conn, msg, now) {
  sweep(room, now);
  const n = room.notes.get(String(msg.id || ''));
  if (!n) return [];
  if (n.by === conn.id || (n.ip && n.ip === conn.ip)) return []; // 자기 글 신고는 세지 않음
  const key = conn.ip || conn.id; // 같은 사람이 창을 여러 개 열어도 한 번
  if (n.reporters.has(key)) return [];
  n.reporters.add(key);
  if (n.reporters.size < L.reportsToHide || n.hidden) return [];
  n.hidden = true;
  if (n.ip) {
    const s = room.strikes.get(n.ip) || { count: 0, mutedUntil: 0 };
    s.count++;
    if (s.count >= L.strikesToMute) s.mutedUntil = now + L.muteMs;
    room.strikes.set(n.ip, s);
  }
  return [{ to: 'all', msg: { t: 'hide', id: msg.id } }];
}

export function handle(room, conn, raw, now, opts = {}) {
  if (typeof raw !== 'string' || raw.length > 2000) return [];
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return []; }
  if (!msg || typeof msg !== 'object') return [];
  if (msg.t === 'post') return onPost(room, conn, msg, now, opts);
  if (msg.t === 'report') return onReport(room, conn, msg, now);
  return [];
}
