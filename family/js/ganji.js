// 간지·오행 상수 (이 앱 전용 — 사주 기둥 계산은 saju-adapter.js가 근본 테스트 엔진에 위임)
export const STEMS = '甲乙丙丁戊己庚辛壬癸'.split('');
export const STEMS_K = '갑을병정무기경신임계'.split('');
export const BRANCHES = '子丑寅卯辰巳午未申酉戌亥'.split('');
export const BRANCHES_K = '자축인묘진사오미신유술해'.split('');
export const ZODIAC = ['쥐', '소', '호랑이', '토끼', '용', '뱀', '말', '양', '원숭이', '닭', '개', '돼지'];
export const ELS = ['wood', 'fire', 'earth', 'metal', 'water'];
export const EL_K = { wood: '목', fire: '화', earth: '토', metal: '금', water: '수' };
export const EL_H = { wood: '木', fire: '火', earth: '土', metal: '金', water: '水' };
export const STEM_EL = ['wood', 'wood', 'fire', 'fire', 'earth', 'earth', 'metal', 'metal', 'water', 'water'];
export const BRANCH_EL = ['water', 'earth', 'wood', 'wood', 'earth', 'fire', 'fire', 'earth', 'metal', 'metal', 'earth', 'water'];
// 오방색에서 따온 노드 색 (금=백, 수=흑 계열은 대비를 위해 톤 조정)
export const EL_COLOR = { wood: '#2f7a6a', fire: '#c2412f', earth: '#c9962f', metal: '#9aa1ab', water: '#22314f' };
export const EL_INK = { wood: '#fff', fire: '#fff', earth: '#1b2333', metal: '#1b2333', water: '#fff' };

export const mod = (n, m) => ((n % m) + m) % m;
export const stemText = s => STEMS[s] + EL_H[STEM_EL[s]];
export const stemTextK = s => STEMS_K[s] + EL_K[STEM_EL[s]];
export const pillarH = p => STEMS[p.stem] + BRANCHES[p.branch];
export const pillarK = p => STEMS_K[p.stem] + BRANCHES_K[p.branch];

/** 받침에 맞는 조사: josa('민지', '이', '가') → '민지가' (한글이 아니면 '이(가)' 형태) */
export function josa(word, withF, without) {
  const c = String(word).trim().slice(-1).charCodeAt(0);
  if (c >= 0xac00 && c <= 0xd7a3) return word + ((c - 0xac00) % 28 ? withF : without);
  if (/[0-9]$/.test(word)) return word + ('013678'.includes(word.slice(-1)) ? withF : without);
  return `${word}${withF}(${without})`;
}
