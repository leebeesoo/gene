// node --test donkey/tests/*.test.mjs  — 화면·중계소가 같이 쓰는 글 검사
import test from 'node:test';
import assert from 'node:assert/strict';
import F from '../js/filter.js';

const act = (t) => F.check(t).action;
const code = (t) => F.check(t).code;

test('평범한 글은 보냄 (금칙어처럼 보이는 평범한 말 포함)', () => {
  for (const t of ['오늘 아무한테도 못 한 말', '사실 그 메뉴 별로였어요', '시발점부터 다시', '시바견 산책', '3개년 계획 세움', '칼로리 폭탄 야식', '등신대 샀다',
    '2026년 11월 13일', '10000원 아꼈다', '부장님 오피스룩 멋짐', '딸 치킨 사줬다', '시험 99점 ㅋㅋㅋ', '배고파 죽겠다', 'ㅠㅠ'])
    assert.equal(act(t), 'send', t);
});

test('욕설 변형(띄어쓰기·숫자·특수문자·초성·자판)', () => {
  for (const t of ['씨발', '씨 발', '씨1발', '씨.발', '씨~~~발', 'ㅅㅂ', 'ㅅ ㅂ', '병1신', 'tlqkf', 'F u c k', '존 나 싫다', '개 새 끼'])
    assert.equal(code(t), 'banned', t);
});

test('링크', () => {
  for (const t of ['http://a.b', 'www.example.com', 'abc.com 와', 'abc . kr', 'abc점com', '네이버 닷컴', 'open.kakao.com/o/x', 't.me/abc'])
    assert.equal(code(t), 'link', t);
});

test('연락처(전화·이메일·메신저·주민번호 모양)', () => {
  for (const t of ['010-1234-5678', '010 1234 5678', '01012345678', 'o1o-1234-5678', '02-123-4567', '1588-1234', '900101-1234567', '공일공일이삼사오육칠팔', '카톡 아이디 알려줄게', '오픈채팅 ㄱㄱ', '텔레그램 연락'])
    assert.equal(code(t), 'contact', t);
  assert.ok(['contact', 'link'].includes(code('me@example.com')));
});

test('자해 마음 → 본인에게만', () => {
  for (const t of ['죽고 싶다', '요즘 살기 싫어', '자해 했어', '사라지고 싶어']) assert.equal(act(t), 'self', t);
});

test('자해 방법·동반 모집 → 차단 + care', () => {
  for (const t of ['같이 죽을 사람', '번개탄 어디서', '자살 방법 알려줘']) { const r = F.check(t); assert.equal(r.action, 'block', t); assert.equal(r.code, 'harm'); assert.equal(r.care, true); }
});

test('글자 수', () => {
  assert.equal(code(''), 'empty'); assert.equal(code('   '), 'empty');
  assert.equal(act('가'.repeat(100)), 'send'); assert.equal(code('가'.repeat(101)), 'long');
  assert.equal(F.check('  a \n\n b ').text, 'a b');
  assert.equal(F.check('a​b').text, 'ab');
});

test('도배 검사', () => {
  const s = {};
  assert.ok(F.rate(s, 0, '하나').ok);
  assert.equal(F.rate(s, 9999, '둘').code, 'wait');
  assert.equal(F.rate(s, 10000, '하나').code, 'same');
  assert.ok(F.rate(s, 10000, '둘').ok);
});

test('표시 시간 20~60초, 붐비면 짧게', () => {
  assert.equal(F.ttl('a'), 20);
  assert.equal(F.ttl('가'.repeat(100)), 60);
  assert.ok(F.ttl('가'.repeat(50), 1) < F.ttl('가'.repeat(50), 0));
  assert.ok(F.ttl('a', 1) >= 12);
});
