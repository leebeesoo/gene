// 무작위 20,000회 시뮬레이션 — 축별 50:50 균형과 16코드 분포(희소도) 확인
// 실행: node roots/tests/balance.mjs [--json]
import { computeResult, codeOf, rng } from '../js/engine.js';
import { QUESTION_SETS, STAGES } from '../js/questions.js';
import { REGIONS } from '../js/data.js';

const N = 20000;
const rnd = rng(20261105);
const nowY = new Date().getFullYear();
const axisPos = [0, 0, 0, 0], codes = new Array(16).fill(0), byStage = {};
for (let i = 0; i < N; i++) {
  const stage = STAGES[Math.floor(rnd() * STAGES.length)];
  const age = stage.range[0] === 0 ? 13 + Math.floor(rnd() * 7) : stage.range[0] + Math.floor(rnd() * Math.min(20, stage.range[1] - stage.range[0] + 1));
  const y = nowY - age, m = 1 + Math.floor(rnd() * 12), d = 1 + Math.floor(rnd() * 28);
  const set = QUESTION_SETS[stage.key];
  const answers = set.map(q => Math.floor(rnd() * q.opts.length));
  const hour = rnd() < 0.3 ? '' : Math.floor(rnd() * 24);
  const pf = { name: 'sim' + i, birth: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, hour, minute: Math.floor(rnd() * 60), region: REGIONS[Math.floor(rnd() * REGIONS.length)].t, stage: stage.key };
  const r = computeResult(pf, answers);
  r.axes.forEach((x, k) => { if (x > 0) axisPos[k]++; });
  codes[r.typeId]++;
  const b = byStage[stage.key] ||= [0, 0, 0, 0, 0];
  b[4]++; r.axes.forEach((x, k) => { if (x > 0) b[k]++; });
}
const pct = v => Math.round(v / N * 1000) / 10;
const rarity = codes.map(c => Math.round(c / N * 1000) / 10);
if (process.argv.includes('--json')) { console.log(JSON.stringify(rarity)); process.exit(0); }
console.log(`N=${N}`);
console.log('축별 앞 글자 비율 (思·守·理·獨 %):', axisPos.map(pct).join(' / '));
for (const [k, b] of Object.entries(byStage)) console.log(`  ${k.padEnd(7)} n=${b[4]}  ${b.slice(0, 4).map(v => Math.round(v / b[4] * 1000) / 10).join(' / ')}`);
console.log('16코드 분포 %:');
codes.forEach((c, i) => console.log(`  ${codeOf(i)} ${String(rarity[i]).padStart(5)}%`));
const bad = axisPos.some(v => Math.abs(v / N - 0.5) > 0.03) || Object.values(byStage).some(b => b.slice(0, 4).some(v => Math.abs(v / b[4] - 0.5) > 0.06));
console.log(bad ? 'FAIL: 전체 47~53% 또는 나이대별 44~56%를 벗어남' : 'ok: 전체 축 47~53%, 나이대별 44~56% 이내');
if (bad) process.exit(1);
