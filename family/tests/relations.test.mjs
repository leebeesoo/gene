// node --test family/tests/relations.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { branchRelations, elRel, stemHap, scorePair, familyRoles, familyBalance, familySanhe, W } from '../js/relations.js';
import { decodeBoard, encodeBoard } from '../js/codec.js';
import { festivalNear } from '../js/festival.js';

const types = (a, b) => branchRelations(a, b).map(r => r.type).sort();
// 子0 丑1 寅2 卯3 辰4 巳5 午6 未7 申8 酉9 戌10 亥11
test('육합', () => {
  for (const [a, b] of [[0, 1], [2, 11], [3, 10], [4, 9], [5, 8], [6, 7]]) {
    assert.ok(types(a, b).includes('liuhe'), `${a}-${b}`);
    assert.ok(types(b, a).includes('liuhe'));
  }
  assert.ok(!types(0, 2).includes('liuhe'));
});
test('삼합 반합', () => {
  for (const g of [[8, 0, 4], [11, 3, 7], [2, 6, 10], [5, 9, 1]]) {
    assert.ok(types(g[0], g[1]).includes('sanhe'));
    assert.ok(types(g[1], g[2]).includes('sanhe'));
    assert.ok(types(g[0], g[2]).includes('sanhe'));
  }
});
test('충', () => {
  for (let a = 0; a < 12; a++) assert.ok(types(a, (a + 6) % 12).includes('chong'));
  assert.equal(branchRelations(0, 6).filter(r => r.type === 'chong').length, 1);
});
test('형', () => {
  for (const [a, b] of [[2, 5], [5, 8], [2, 8], [1, 10], [10, 7], [1, 7], [0, 3]]) assert.ok(types(a, b).includes('xing'), `${a}-${b}`);
  for (const b of [4, 6, 9, 11]) assert.deepEqual(types(b, b), ['self']);
  assert.deepEqual(types(0, 0), ['same']);
});
test('파·해', () => {
  for (const [a, b] of [[0, 9], [1, 4], [2, 11], [3, 6], [5, 8], [7, 10]]) assert.ok(types(a, b).includes('po'));
  for (const [a, b] of [[0, 7], [1, 6], [2, 5], [3, 4], [8, 11], [9, 10]]) assert.ok(types(a, b).includes('hai'));
});
test('겹치는 관계', () => {
  assert.deepEqual(types(5, 8), ['liuhe', 'po', 'xing']); // 巳申: 합·형·파
  assert.deepEqual(types(2, 8), ['chong', 'xing']);       // 寅申: 충·형
  assert.deepEqual(types(2, 5), ['hai', 'xing']);         // 寅巳: 형·해
  assert.deepEqual(types(1, 7), ['chong', 'xing']);       // 丑未: 충·형
  assert.deepEqual(types(2, 11), ['liuhe', 'po']);        // 寅亥: 합·파
});
test('오행·천간합', () => {
  assert.equal(elRel('wood', 'fire'), 'gen');
  assert.equal(elRel('fire', 'wood'), 'genBy');
  assert.equal(elRel('metal', 'wood'), 'ctrl');
  assert.equal(elRel('wood', 'metal'), 'ctrlBy');
  assert.ok(stemHap(0, 5) && stemHap(9, 4) && !stemHap(0, 1));
});
const P = (name, ds, db, yb, extra = {}) => ({ name, saju: { year: { stem: 0, branch: yb }, month: { stem: 0, branch: 0 }, day: { stem: ds, branch: db }, hour: null, ...extra } });
test('점수 합산과 투명성', () => {
  const r = scorePair(P('A', 0, 0, 0), P('B', 2, 1, 1)); // 甲木→丙火 상생, 子丑 육합, 쥐·소 육합
  assert.equal(r.score, W.base + W.stem.gen + W.day.liuhe + W.year.liuhe);
  assert.equal(r.tone, 'good');
  const bad = scorePair(P('A', 6, 0, 0), P('B', 0, 6, 6)); // 庚金剋甲木, 子午 충, 쥐·말 충
  assert.equal(bad.score, W.base + W.stem.ctrl + W.day.chong + W.year.chong);
  assert.equal(bad.tone, 'bad');
});
test('역할: 통관 중재자', () => {
  // 金(庚6) 극 木(甲0), 水(壬8)가 金生水·水生木로 통관
  const roles = familyRoles([P('금', 6, 0, 0), P('목', 0, 0, 0), P('수', 8, 0, 0)]);
  assert.equal(roles.find(r => r.key === 'mediator').who, 2);
});
test('밸런스', () => {
  const b = familyBalance([P('a', 0, 0, 0), P('b', 0, 0, 0)]);
  assert.equal(b.sum, 12);
  assert.ok(b.lack.includes('fire'));
});
test('가족 삼합', () => {
  const s = familySanhe([P('a', 0, 8, 0), P('b', 0, 0, 1), P('c', 0, 4, 2)]);
  assert.ok(s.some(x => x.field === 'day' && x.el === 'water'));
});
test('링크 왕복', () => {
  const board = { title: '우리집', people: [{ name: '엄마😀', rel: '엄마', y: 1965, m: 3, d: 9, cal: 'lunar', leap: true, time: '07:30' }, { name: '나', rel: '나', y: 1995, m: 12, d: 1, cal: 'solar', leap: false, time: '' }] };
  const back = decodeBoard('#' + encodeBoard(board));
  assert.equal(back.title, '우리집');
  assert.deepEqual(back.people.map(({ id, ...p }) => p), board.people);
  assert.equal(decodeBoard('#g=@@@'), null);
});
test('명절', () => {
  assert.equal(festivalNear(new Date(2026, 8, 15)).name, '추석');
  assert.equal(festivalNear(new Date(2026, 1, 3)).dday, 14);
  assert.equal(festivalNear(new Date(2026, 10, 5)), null);
});
