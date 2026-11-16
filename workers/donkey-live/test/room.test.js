// node --test test/  (Cloudflare 없이 방 규칙만 시험)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoom, newConn, handle } from '../src/room.js';

const post = (text, nonce = 'n1') => JSON.stringify({ t: 'post', text, nonce });
const report = (id) => JSON.stringify({ t: 'report', id });

test('보통 글은 보낸 사람에게 ack, 나머지에게 note', () => {
  const room = createRoom();
  const a = newConn('a', 'ipA');
  const out = handle(room, a, post('오늘 팀장님 회의 너무 길었다'), 1000);
  assert.equal(out.length, 2);
  assert.equal(out[0].to, 'sender'); assert.equal(out[0].msg.t, 'ack'); assert.equal(out[0].msg.nonce, 'n1');
  assert.equal(out[1].to, 'others'); assert.equal(out[1].msg.t, 'note');
  assert.ok(out[1].msg.ttl >= 20 && out[1].msg.ttl <= 60);
  assert.equal(out[1].msg.id, out[0].msg.id);
});

test('100자 넘으면 거절', () => {
  const out = handle(createRoom(), newConn('a', 'x'), post('가'.repeat(101)), 0);
  assert.equal(out[0].msg.t, 'reject'); assert.equal(out[0].msg.code, 'long');
});

test('한 접속 10초에 1개, 같은 글 반복 금지', () => {
  const room = createRoom(); const a = newConn('a', 'ipA');
  assert.equal(handle(room, a, post('첫 글'), 0)[0].msg.t, 'ack');
  const w = handle(room, a, post('두 번째'), 5000)[0].msg;
  assert.equal(w.code, 'wait'); assert.ok(w.waitMs > 0 && w.waitMs <= 5000);
  assert.equal(handle(room, a, post('첫 글'), 11000)[0].msg.code, 'same');
  assert.equal(handle(room, a, post('두 번째'), 11000)[0].msg.t, 'ack');
});

test('1시간 30개 제한', () => {
  const room = createRoom(); const a = newConn('a', 'ipA');
  let t = 0;
  for (let i = 0; i < 30; i++) { assert.equal(handle(room, a, post('글 ' + 'ㄱㄴㄷㄹㅁㅂㅅㅇㅈㅊㅋㅌㅍㅎ'[i % 14] + i), t)[0].msg.t, 'ack', 'i=' + i); t += 11000; }
  assert.equal(handle(room, a, post('하나 더'), t)[0].msg.code, 'hour');
});

test('금칙어·링크·전화번호는 거절(방송 없음)', () => {
  const room = createRoom();
  for (const [text, code] of [['씨.1.발', 'banned'], ['www.abc.com 오세요', 'link'], ['010 1234 5678', 'contact'], ['오픈채팅 들어와', 'contact']]) {
    const out = handle(room, newConn('c' + code, 'ip' + code), post(text), 0);
    assert.equal(out.length, 1); assert.equal(out[0].to, 'sender'); assert.equal(out[0].msg.code, code, text);
  }
});

test('자해 마음은 본인에게만(care), 방송하지 않음', () => {
  const out = handle(createRoom(), newConn('a', 'ipA'), post('요즘 정말 죽고 싶다'), 0);
  assert.equal(out.length, 1); assert.equal(out[0].to, 'sender'); assert.equal(out[0].msg.t, 'care');
});

test('자해 방법·동반 모집은 차단 + 109', () => {
  const out = handle(createRoom(), newConn('a', 'ipA'), post('같이 죽을 사람 구해요'), 0);
  assert.equal(out[0].msg.t, 'reject'); assert.equal(out[0].msg.code, 'harm'); assert.equal(out[0].msg.care, true);
});

test('서로 다른 3명이 신고하면 모두에게 hide, 자기 글·중복 신고는 안 셈', () => {
  const room = createRoom(); const a = newConn('a', 'ipA');
  const id = handle(room, a, post('평범한 글'), 0)[0].msg.id;
  assert.deepEqual(handle(room, a, report(id), 1000), []);           // 자기 글
  const b = newConn('b', 'ipB');
  assert.deepEqual(handle(room, b, report(id), 1000), []);
  assert.deepEqual(handle(room, b, report(id), 1100), []);           // 중복
  assert.deepEqual(handle(room, newConn('b2', 'ipB'), report(id), 1200), []); // 같은 사람 다른 창
  assert.deepEqual(handle(room, newConn('c', 'ipC'), report(id), 1300), []);
  const out = handle(room, newConn('d', 'ipD'), report(id), 1400);
  assert.equal(out.length, 1); assert.equal(out[0].to, 'all'); assert.deepEqual(out[0].msg, { t: 'hide', id });
});

test('3번 숨겨진 사람은 24시간 쓰기 금지', () => {
  const room = createRoom(); const a = newConn('a', 'ipA'); let t = 0;
  for (let k = 0; k < 3; k++) {
    const id = handle(room, a, post('글' + 'ㄱㄴㄷ'[k]), t)[0].msg.id;
    for (const r of ['B', 'C', 'D']) handle(room, newConn(r + k, 'ip' + r), report(id), t + 100);
    t += 11000;
  }
  assert.equal(handle(room, newConn('a2', 'ipA'), post('또 씀'), t)[0].msg.code, 'muted');
  assert.equal(handle(room, newConn('a3', 'ipA'), post('하루 뒤'), t + 24 * 3600 * 1000 + 1)[0].msg.t, 'ack');
});

test('방 전체 초당 5개 넘으면 busy (도배 횟수엔 안 넣음)', () => {
  const room = createRoom();
  for (let i = 0; i < 5; i++) assert.equal(handle(room, newConn('u' + i, 'ip' + i), post('글 ' + i), 100)[0].msg.t, 'ack');
  const f = newConn('f', 'ipF');
  assert.equal(handle(room, f, post('여섯 번째'), 200)[0].msg.code, 'busy');
  assert.equal(handle(room, f, post('여섯 번째'), 1300)[0].msg.t, 'ack');
});

test('비상 정지 중이면 closed', () => {
  assert.equal(handle(createRoom(), newConn('a', 'x'), post('hi'), 0, { closed: true })[0].msg.t, 'closed');
});

test('이상한 입력은 무시', () => {
  const room = createRoom(); const a = newConn('a', 'x');
  assert.deepEqual(handle(room, a, 'not json', 0), []);
  assert.deepEqual(handle(room, a, 'x'.repeat(3000), 0), []);
  assert.deepEqual(handle(room, a, JSON.stringify({ t: 'admin' }), 0), []);
});
