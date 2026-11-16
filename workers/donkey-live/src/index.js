/*
 * 속마음 칠판 — 실시간 칠판 중계소 (Cloudflare Worker + Durable Object)
 *
 * 입구(Worker): 비상 정지 확인 → 출처(Origin) 확인 → Turnstile 확인 → IP를 하루마다 바뀌는 값으로 섞음 → 방(DO)으로 넘김
 * 방(DO 「Board」): WebSocket 잠자기(Hibernation) API. 글은 저장하지 않고 받은 즉시 걸러서 방송만 한다.
 *
 * 설정값(wrangler.toml [vars] 또는 대시보드):
 *   BOARD_OPEN        "true" 가 아니면 모두 「혼자 외치기」 모드 (비상 정지)
 *   ALLOWED_ORIGINS   쉼표로 구분한 허용 주소. 비우면 출처 검사 안 함(개발용)
 *   ROOM_MAX          방 하나 최대 접속(기본 500)
 *   DEV_NO_TURNSTILE  "true" 면 Turnstile 생략 — 내 컴퓨터(wrangler dev)에서만
 * 비밀값(wrangler secret put):
 *   TURNSTILE_SECRET  Turnstile 비밀 키
 *   IP_SALT           아무 긴 글자(IP 섞기용)
 */
import { DurableObject } from 'cloudflare:workers';
import { createRoom, newConn, handle, isMuted } from './room.js';

const ROOM_NAME = 'board-1';

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, headers) });
}

function originOk(request, env) {
  const list = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!list.length) return true;
  return list.includes(request.headers.get('Origin') || '');
}

async function sha256hex(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

// 한국 날짜(매일 바뀜) + 비밀 소금으로 섞은 IP 표시. 원래 IP는 어디에도 남기지 않는다.
async function ipMark(ip, env) {
  if (!ip) return '';
  const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  return (await sha256hex(ip + '|' + day + '|' + (env.IP_SALT || 'change-me'))).slice(0, 20);
}

async function turnstileOk(token, ip, env) {
  if (env.DEV_NO_TURNSTILE === 'true') return true;
  const secret = env.TURNSTILE_SECRET;
  if (!secret || !token) return false;
  const form = new FormData();
  form.append('secret', secret);
  form.append('response', token);
  if (ip) form.append('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
    const j = await r.json();
    return !!j.success;
  } catch (e) {
    return false;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (env.BOARD_OPEN !== 'true') return json({ closed: true }, 503);
    if (request.headers.get('Upgrade') !== 'websocket') return json({ ok: true, hint: 'websocket only' }, 426);
    if (!originOk(request, env)) return json({ error: 'origin' }, 403);

    const ip = request.headers.get('CF-Connecting-IP') || '';
    if (!(await turnstileOk(url.searchParams.get('t'), ip, env))) return json({ error: 'turnstile' }, 403);

    const headers = new Headers(request.headers);
    headers.set('X-Donkey-Mark', await ipMark(ip, env));
    headers.delete('CF-Connecting-IP');
    const stub = env.BOARD.get(env.BOARD.idFromName(ROOM_NAME));
    return stub.fetch(new Request(request.url, { method: 'GET', headers }));
  }
};

export class Board extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    // 메모리에만 있는 방 상태. 방이 잠들었다 깨면 비어 있음(글은 어차피 1분 안에 사라짐).
    this.room = createRoom();
    this.countTimer = null;
    this.lastCountAt = 0;
    // 화면의 'ping'에는 방을 깨우지 않고 바로 'pong' (연결 유지용)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  sockets() { return this.ctx.getWebSockets(); }

  async fetch(request) {
    const max = Number(this.env.ROOM_MAX || 500);
    if (this.sockets().length >= max) return json({ full: true }, 503);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    const id = crypto.randomUUID().slice(0, 13);
    const mark = request.headers.get('X-Donkey-Mark') || '';
    this.ctx.acceptWebSocket(server);
    const conn = newConn(id, mark);
    server.serializeAttachment(conn);
    const n = this.sockets().length;
    server.send(JSON.stringify({ t: 'hello', id, n, muted: isMuted(this.room, mark, Date.now()) }));
    this.broadcastCount();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    const conn = ws.deserializeAttachment() || newConn(crypto.randomUUID().slice(0, 13), '');
    const now = Date.now();
    const closed = this.env.BOARD_OPEN !== 'true';
    const actions = handle(this.room, conn, typeof raw === 'string' ? raw : '', now, { closed });
    ws.serializeAttachment(conn); // 도배 기록은 접속마다 붙여 둠(방이 잠들어도 유지)
    for (const a of actions) {
      const data = JSON.stringify(a.msg);
      if (a.to === 'sender') this.safeSend(ws, data);
      else for (const s of this.sockets()) if (a.to === 'all' || s !== ws) this.safeSend(s, data);
    }
    if (closed) try { ws.close(1013, 'closed'); } catch (e) { /* 이미 닫힘 */ }
  }

  async webSocketClose(ws, code) {
    try { ws.close(code === 1005 ? 1000 : code, 'bye'); } catch (e) { /* 이미 닫힘 */ }
    this.broadcastCount(ws);
  }

  async webSocketError(ws) {
    this.broadcastCount(ws);
  }

  safeSend(ws, data) {
    try { ws.send(data); } catch (e) { /* 끊긴 접속 */ }
  }

  // 「지금 N명」: 접속·종료 때만 알림(보내는 메시지는 요금에 안 셈). 몰리면 2초에 한 번으로 묶음.
  broadcastCount(leaving) {
    const send = () => {
      this.countTimer = null;
      this.lastCountAt = Date.now();
      const list = this.sockets().filter((s) => s !== leaving && s.readyState === 1);
      const data = JSON.stringify({ t: 'count', n: list.length });
      for (const s of list) this.safeSend(s, data);
    };
    if (this.countTimer) return;
    const wait = 2000 - (Date.now() - this.lastCountAt);
    if (wait <= 0) send();
    else this.countTimer = setTimeout(send, wait);
  }
}
