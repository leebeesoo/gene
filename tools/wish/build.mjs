#!/usr/bin/env node
// 소원명당(/wish/) 정적 페이지 생성기. 의존성 없음(Node 18+).
// 사용: node tools/wish/build.mjs
// 입력: wish/data/places.json (사람이 확인해 쓴 장소 데이터), wish/data/geo.js (시·도 경계, 명당로드와 같은 파일)
// 출력: wish/index.html, wish/type/<slug>/index.html, wish/region/<slug>/index.html, wish/p/<id>/index.html, wish/privacy.html
// 서비스 이름을 바꿀 때는 아래 SERVICE 한 줄만 고치면 된다.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GTM_HEAD, GTM_BODY } from '../seo/gtm.mjs';

const SERVICE = '소원명당';            // ← 서비스 이름(한 곳에서만 바꾼다)
const SITE = '혹시나랩';               // 사이트 전체 이름(og:site_name 등)
const BASE = 'https://jaemilab.net/wish/';
const CONTACT = 'gdf0620@gmail.com';
const MIN_AD_CHARS = 800;            // 정적 한글 글자 수가 이보다 적은 페이지에는 광고 칸을 넣지 않는다

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WISH = join(ROOT, 'wish');
const data = JSON.parse(readFileSync(join(WISH, 'data', 'places.json'), 'utf8'));
const GEO = JSON.parse(readFileSync(join(WISH, 'data', 'geo.js'), 'utf8').replace(/^[\s\S]*?window\.LM_GEO\s*=\s*/, '').replace(/;\s*$/, ''));
const CHECKED = data.meta.checked;
const places = data.places;
const byId = Object.fromEntries(places.map(p => [p.id, p]));

/* ---------- 분류 ---------- */
const TYPES = [
  { key: '합격', slug: 'exam', h1: '합격 기도로 알려진 곳', short: '합격' },
  { key: '건강', slug: 'health', h1: '건강을 비는 이야기가 전하는 곳', short: '건강' },
  { key: '사랑', slug: 'love', h1: '사랑 이야기가 전하는 곳', short: '사랑' },
  { key: '재물', slug: 'wealth', h1: '재물·부자 이야기가 전하는 곳', short: '재물' },
  { key: '자녀', slug: 'children', h1: '자녀를 비는 이야기가 전하는 곳', short: '자녀' },
  { key: '새해·일출', slug: 'newyear', h1: '새해 해맞이·소원 명소', short: '새해·일출' },
  { key: '무사안녕', slug: 'peace', h1: '무사안녕·한 가지 소원으로 알려진 곳', short: '무사안녕' }
];
const TYPE = Object.fromEntries(TYPES.map(t => [t.key, t]));
const REGIONS = [ // [시·도 약칭, 지도 키(geo.js), 쪽 주소]
  ['서울', 'seoul'], ['부산', 'busan'], ['대구', 'daegu'], ['인천', 'incheon'], ['광주', 'gwangju'], ['대전', 'daejeon'], ['울산', 'ulsan'], ['세종', 'sejong'],
  ['경기', 'gyeonggi'], ['강원', 'gangwon'], ['충북', 'chungbuk'], ['충남', 'chungnam'], ['전북', 'jeonbuk'], ['전남', 'jeonnam'], ['경북', 'gyeongbuk'], ['경남', 'gyeongnam'], ['제주', 'jeju']
];
const RKEY = Object.fromEntries(REGIONS);
const RNAME = Object.fromEntries(REGIONS.map(([n, k]) => [k, n]));
const regionOf = p => RKEY[p.sido];
const inRegion = k => places.filter(p => regionOf(p) === k);
const PAGE_REGIONS = REGIONS.filter(([, k]) => inRegion(k).length >= 3).map(([, k]) => k); // 3곳 이상만 지역 쪽을 만든다
const USED_REGIONS = REGIONS.filter(([, k]) => inRegion(k).length > 0).map(([, k]) => k);
for (const p of places) {
  if (!regionOf(p)) throw new Error(`알 수 없는 시·도: ${p.id} ${p.sido}`);
  for (const t of p.wishTypes) if (!TYPE[t]) throw new Error(`알 수 없는 소원 종류: ${p.id} ${t}`);
  if (!p.sources || p.sources.length < 2) throw new Error(`출처 2개 미만: ${p.id}`);
}

/* ---------- 손으로 쓴 소개 글 ---------- */
const TYPE_INTRO = {
  '합격': ['시험을 앞두면 마음이 급해져요. 그래서 예부터 과거 시험을 보러 가던 선비들도, 지금의 수험생 가족도 기도할 곳을 찾았어요. 이 쪽에는 「합격을 빌던 곳」이라는 이야기가 공식 안내나 백과사전, 여러 해의 언론 보도에 남아 있는 곳만 모았어요.',
    '팔공산 갓바위, 서울 봉은사·조계사, 강화 보문사는 수능 철마다 학부모 기도 모습이 보도되는 곳이에요. 안성 칠장사에는 어사 박문수가 꿈에서 시험 문제를 받았다는 이야기가, 문경새재 책바위와 괴산 연풍새재, 김천 괘방령에는 과거 보러 가던 선비들의 장원급제 이야기가 전해요. 강릉 오죽헌은 아홉 번 장원한 율곡 이이가 태어난 집이에요.',
    '어느 곳도 합격을 약속하지는 않아요. 마음을 가다듬고 다짐을 새기는 곳으로 다녀오세요. 수능·입시철 주말에는 몹시 붐비니 시간을 넉넉히 잡으세요.'],
  '건강': ['아픈 가족이 낫기를, 오래 건강하기를 비는 마음은 가장 흔한 소원이에요. 이 쪽에는 병이 나았다는 옛이야기나, 병을 고쳐 준다고 믿어 온 부처를 모신 곳, 몸에 좋다는 이야기가 전하는 샘을 모았어요.',
    '오대산 상원사와 영동 반야사에는 세조가 문수동자를 만나 병을 씻었다는 이야기가, 세종 전의초수에는 세종대왕이 눈병을 다스리려 이 물을 썼다는 실록 기록이 있어요. 부여 고란사 약수는 한 잔에 3년이 젊어진다는 이야기로 이름났고, 대전 법동 석장승에는 마을 사람의 건강을 비는 장승제가 이어져요.',
    '여기 적은 것은 전해지는 이야기예요. 의학적인 효과를 뜻하지 않아요. 몸이 불편하면 먼저 병원을 찾고, 산길이 많은 곳은 무리하지 마세요.'],
  '사랑': ['사랑을 비는 곳은 생각보다 드물어요. 대신 이뤄지지 못한 사랑, 끝까지 기다린 마음이 바위나 다리, 고개에 남았다는 이야기가 여러 곳에 전해요. 이 쪽에는 그런 이야기가 공식 안내와 백과사전에 실린 곳을 모았어요.',
    '영주 부석사에는 의상을 사모한 선묘가 용이 되어 배를 지켰다는 이야기가, 남원 광한루원에는 오작교 이야기가 전해요. 제천 박달재에는 과거 보러 가던 선비와 마을 처녀의 이야기가, 김해 수로왕비릉과 제주 혼인지에는 바다 건너온 신부와의 혼인 이야기가, 익산 미륵사지에는 서동과 선화공주의 「서동요」 이야기가 남아 있어요. 남산의 사랑의 자물쇠처럼 요즘 생긴 풍습도 함께 실었어요.',
    '바위가 된 아내, 다리를 건너는 연인처럼 이야기는 대개 애틋해요. 연인이나 부부가 함께 걸으며 이야기를 나누기 좋은 곳으로 소개해요.'],
  '재물': ['「부자 되게 해 주세요」는 누구나 한 번쯤 빌어 본 소원이에요. 다만 재물을 비는 곳으로 알려진 곳은 영업장이나 홍보성 장소가 많아, 백과사전·지자체 안내·언론으로 이야기를 확인할 수 있는 곳만 남겼어요.',
    '의령 솥바위는 바위 둘레 20리 안에 부귀가 끊이지 않는다는 이야기가, 진주 승산마을은 이름난 기업인이 여럿 나온 「부자마을」 이야기가 전해요. 경주 최부잣집과 구례 운조루, 제주 김만덕 객주터는 모은 재산을 이웃과 나눈 부자 이야기로, 태백 황지연못은 인색한 황부자의 집이 연못이 됐다는 이야기로 알려져 있어요.',
    '돈이 생긴다는 뜻은 아니에요. 어떤 부자가 될지, 한 해 살림을 어떻게 꾸릴지 다짐하는 나들이로 다녀오세요. 근거가 확인되는 곳을 찾으면 더 넣을게요.'],
  '자녀': ['아이를 바라는 마음으로 기도하러 다니던 곳이 전국에 있어요. 옛사람들은 바위에 작은 돌을 붙이거나, 부처의 배를 만지거나, 오래된 나무와 돌 앞에서 빌었어요. 이 쪽에는 그런 이야기가 백과사전이나 지자체 안내에 남은 곳을 모았어요.',
    '인왕산 선바위는 자식이 없는 사람이 빌면 효험이 크다고 여겨 온 바위로 백과사전에 실려 있어요. 대구 파계사에는 숙종의 부탁으로 백일기도를 올린 뒤 영조가 태어났다는 이야기가, 파주 용미리 마애불에는 고려 왕실이 두 불상을 새기고 왕자를 얻었다는 이야기가 전해요. 안동 하회마을 삼신당 느티나무에는 지금도 소원지가 매달려요.',
    '이야기는 이야기일 뿐이에요. 난임으로 고민한다면 전문 의료기관의 상담을 먼저 받으세요. 문화유산은 문지르거나 돌을 붙이지 말고 눈으로만 보세요.'],
  '새해·일출': ['새해 첫날 해를 보며 한 해를 비는 것은 오래된 풍습이에요. 이 쪽에는 바다나 산꼭대기에서 해돋이를 볼 수 있고, 새해 소원과 관련된 행사나 이야기가 있는 곳을 모았어요.',
    '여수 향일암과 양양 홍련암, 남해 보리암은 바다 위로 해가 뜨는 관음 기도처예요. 울산 간절곶과 포항 호미곶, 강릉 정동진, 제주 성산일출봉은 해마다 해맞이 행사가 열리고, 당진 왜목마을은 서해에서 해돋이를 볼 수 있는 곳으로 알려져 있어요. 서울 보신각에서는 12월 31일 자정 제야의 종이 33번 울려요.',
    '새해 아침에는 어디나 차가 막히고 주차가 어려워요. 해 뜨는 시각과 교통 통제는 해마다 지자체가 따로 알리니 꼭 확인하세요. 새벽 바닷가와 산은 매우 추워요.'],
  '무사안녕': ['특정한 소원보다 「올해도 무사하게」를 비는 사람이 가장 많아요. 이 쪽에는 정성껏 빌면 한 가지 소원은 들어준다는 이야기가 전하는 곳, 나라와 마을의 평안을 빌어 온 곳을 모았어요.',
    '팔공산 갓바위, 창녕 관룡사 용선대, 진안 마이산 탑사, 옥천 용암사에는 「한 가지 소원」 이야기가 전해요. 대구 용수동 당산, 광주 칠석동 은행나무, 대전 장동 돌탑과 괴곡동 느티나무, 부안 수성당처럼 마을 사람들이 해마다 제사를 지내며 평안을 비는 민속문화유산도 함께 실었어요. 무속 영업장이 아니라 마을이 함께 지켜 온 곳이에요.',
    '절과 바위, 오래된 나무는 누군가에게는 기도하는 자리예요. 조용히 다녀오고, 기도하거나 제사 지내는 사람을 촬영하지 마세요.']
};
const REGION_INTRO = {
  seoul: '서울에도 소원 이야기가 전하는 곳이 꽤 있어요. 인왕산 선바위와 홍제천 옥천암 백불은 아이를 비는 이야기로, 강남 봉은사와 종로 조계사는 수능 철 학부모 기도로 알려져 있어요. 북한산 도선사 마애불, 12월 31일 제야의 종이 울리는 보신각, 연인들이 자물쇠를 거는 남산까지 모두 지하철과 버스로 갈 수 있어요.',
  busan: '부산에서는 바다와 산의 이야기를 모았어요. 해동용궁사는 바닷가 바위 위의 절로 새해 해돋이와 득남불로 알려졌고, 해운대 해수욕장은 1월 1일 해맞이 축제가 열리는 곳이에요. 금정산 범어사에는 하늘에서 내려온 금빛 물고기 이야기가, 영도 태종대에는 남편을 기다리다 돌이 된 아내의 망부석 이야기가 전해요.',
  daegu: '대구에서는 팔공산과 비슬산 자락의 세 곳을 모았어요. 파계사는 숙종의 부탁으로 백일기도를 올린 뒤 영조가 태어났다는 이야기로, 비슬산 대견사는 중국 황제의 세숫물에 비친 절터라는 이야기로 알려져 있어요. 동구 용수동 당산은 마을의 무사평안을 빌어 온 돌무더기와 당나무로, 대구 민속문화유산이에요. 이웃한 경산 팔공산 갓바위와 함께 다녀오기 좋아요.',
  incheon: '인천은 강화도와 영종도에 소원 이야기가 모여 있어요. 강화 보문사 눈썹바위 마애불은 관음 기도처이자 수능 기도로, 영종도 용궁사 소원바위는 아이를 비는 바위로 알려져 있어요. 마니산 참성단은 단군이 하늘에 제사를 지냈다고 전하는 제단으로, 새해 해맞이 산행지로 사랑받아요.',
  daejeon: '대전에서는 마을 사람들이 지금도 제사를 이어 가는 민속문화유산 세 곳을 모았어요. 계족산 아래 장동 산디마을 돌탑, 칠월칠석마다 목신제를 지내는 괴곡동 느티나무, 정월 장승제로 마을의 안녕과 건강을 비는 법동 석장승이에요. 무속 영업장이 아니라 마을이 함께 지켜 온 곳이니 조용히 다녀오세요.',
  ulsan: '울산은 동해에서 해가 일찍 뜨는 바닷가의 이야기가 많아요. 간절곶은 새해 해맞이와 커다란 소망우체통으로, 대왕암공원은 죽어서도 용이 되어 나라를 지키겠다는 신라 왕비의 이야기로 알려져 있어요. 처용암은 동해 용왕의 아들 처용이 나타났다는 『삼국유사』 이야기의 무대예요.',
  gyeonggi: '경기에서는 안성 칠장사, 양평 용문사, 파주 용미리, 수원 팔달산 네 곳을 모았어요. 칠장사는 어사 박문수가 꿈에서 시험 문제를 받았다는 합격 이야기로, 용문사 은행나무는 나라에 큰일이 있으면 소리를 냈다는 이야기로 알려져 있어요. 용미리 마애불에는 고려 왕실이 왕자를 얻었다는 이야기가, 수원화성 효원의 종에는 가족의 건강을 비는 타종 체험이 있어요.',
  gangwon: '강원은 바다와 높은 산을 함께 품고 있어 새해 해맞이 명소가 많아요. 양양 낙산사 홍련암과 휴휴암, 동해 추암, 강릉 정동진은 해돋이 명소이고, 태백산 천제단에는 하늘에 제사를 지내 온 역사가 있어요. 오대산 상원사에는 세조의 병이 나았다는 이야기가, 정선 아우라지와 춘천 청평사, 양양 하조대에는 사랑 이야기가, 태백 황지연못에는 황부자 이야기가 전해요. 강릉 오죽헌은 율곡 이이가 태어난 집이에요.',
  chungbuk: '충북에서는 다섯 곳을 모았어요. 옥천 용암사는 구름바다 위 해돋이와 「기도하면 이뤄진다」는 마애불 이야기로, 영동 반야사는 세조가 문수동자를 만나 샘물에 몸을 씻었다는 이야기로 알려져 있어요. 제천 박달재에는 선비와 처녀의 사랑 이야기가, 괴산 연풍새재에는 과거 보러 넘던 선비들의 장원급제 이야기가 전해요. 단양 구인사는 국내 최대 규모의 관음 기도처로 알려진 곳이에요.',
  chungnam: '충남에는 백제와 고려, 조선의 이야기가 얽힌 곳이 많아요. 논산 관촉사 은진미륵은 나라에 큰일이 생기면 땀을 흘린다는 이야기가 전하는 큰 돌부처이고, 부여 고란사 약수는 한 잔에 3년이 젊어진다는 이야기로 이름났어요. 계룡산 신원사 중악단은 조선 왕실이 산신에게 나라의 평안을 빌던 제단이에요. 서해 쪽에는 꽃지 할미할아비바위와 해돋이를 볼 수 있는 당진 왜목마을이 있어요.',
  jeonbuk: '전북에서는 일곱 곳을 모았어요. 진안 마이산 탑사는 한 사람이 평생 쌓았다는 돌탑의 절이고, 남원 광한루원과 익산 미륵사지에는 춘향과 몽룡, 서동과 선화공주의 사랑 이야기가 남아 있어요. 부안 내소사 당산제와 수성당은 마을과 바닷사람들의 평안을 빌어 온 곳이고, 순창과 정읍의 남근석은 아이를 빌던 민속문화유산이에요.',
  jeonnam: '전남은 바다와 섬, 지리산 자락의 이야기가 많은 곳이에요. 여수 향일암은 새해 해돋이로, 진도 신비의 바닷길은 뽕할머니의 기도로 바다가 갈라졌다는 이야기로 알려져 있어요. 구례 사성암은 섬진강을 내려다보는 절벽 암자이고, 구례 운조루는 「누구나 열 수 있는」 쌀뒤주로 이웃과 나눈 집이에요. 화순 운주사의 누운 부처, 한반도 남쪽 끝 해남 땅끝도 함께 실었어요.',
  gyeongbuk: '경북은 소원 명소로 이름난 곳이 많은 지역이에요. 팔공산 갓바위는 「한 가지 소원」으로 전국에 알려졌고, 문경새재 책바위와 김천 괘방령에는 과거 보러 가던 선비들의 합격 이야기가 전해요. 영천 돌할매, 청도 사리암, 안동 하회마을 삼신당처럼 저마다 다른 방식으로 소원을 비는 곳이 있고, 영주 부석사에는 선묘의 사랑 이야기가, 경주 최부잣집에는 나눔으로 부를 지킨 이야기가, 경주 문무대왕릉과 포항 호미곶에는 동해 해맞이가 있어요.',
  gyeongnam: '경남에는 바다와 강, 바위산에 얽힌 이야기가 고루 있어요. 남해 보리암은 3대 관음 기도처 가운데 하나이고, 밀양 만어사는 두드리면 종소리가 나는 돌밭과 소원돌로, 남해 가천 암수바위는 다랭이마을 사람들이 미륵으로 모신 바위로 알려져 있어요. 창녕 관룡사 용선대에는 한 가지 소원 이야기가, 의령 솥바위와 진주 승산마을에는 부자 이야기가, 김해 수로왕비릉에는 바다 건너온 허황옥의 혼인 이야기가 전해요.',
  jeju: '제주는 섬의 신화가 살아 있는 곳이에요. 혼인지에는 탐라를 연 세 신인이 바다 건너온 세 공주와 혼례를 올렸다는 이야기가, 송당 본향당에는 제주 마을 당신들의 뿌리가 된 여신 이야기가 전해요. 산방굴사와 외돌개에도 오래된 이야기가 있고, 성산일출봉은 영주십경의 해돋이 명소예요. 제주항 근처에는 재산을 털어 굶주린 사람을 살린 거상 김만덕의 객주터가 있어요.'
};

/* ---------- 공통 조각 ---------- */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hangul = s => (String(s).replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').match(/[가-힣]/g) || []).length;
const fmtDate = d => d.replace(/-/g, '.');
const ACC = '%2356661C';
const FAVICON = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cellipse cx='32' cy='52' rx='20' ry='7' fill='none' stroke='%231A1B17' stroke-width='5'/%3E%3Cellipse cx='32' cy='35' rx='14' ry='6' fill='none' stroke='%231A1B17' stroke-width='5'/%3E%3Ccircle cx='32' cy='16' r='7' fill='${ACC}'/%3E%3C/svg%3E`;
const LOGO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="19" rx="8" ry="2.6"/><ellipse cx="12" cy="12.6" rx="5.6" ry="2.2"/><circle cx="12" cy="6.2" r="2.6"/></svg>';
const I = {
  moon: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  route: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h7a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h7"/></svg>',
  search: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  arrow: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>'
};
const AD = '<aside class="jl-ad" aria-label="광고"><small>광고</small><ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-8074161899415977" data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins></aside>';
const AD_MARK = '<!--AD-->';

function head({ title, desc, path, up, jsonld, ads }) {
  const url = BASE + path;
  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
${GTM_HEAD}
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="theme-color" content="#EDF0E7" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#36382E" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${SITE}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${BASE}og.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="ko_KR">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${BASE}og.png">
<link rel="icon" href="${FAVICON}">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<link rel="stylesheet" href="${up}css/style.css">
<link rel="stylesheet" href="${up}../common/footer.css">
${ads ? `<link rel="stylesheet" href="${up}../common/ads.css">\n` : ''}<script>try{var t=localStorage.getItem('wish.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t);}catch(e){}</script>
${ads ? '<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8074161899415977" crossorigin="anonymous"></script>\n' : ''}<script type="application/ld+json">
${JSON.stringify(jsonld)}
</script>
</head>
<body>
${GTM_BODY}
<a class="sr-only" href="#main">본문 바로가기</a>
<header class="top">
  <div class="top-in">
    <a class="brand" href="${up}" aria-label="${SERVICE} 처음으로">${LOGO}<span>${SERVICE}</span></a>
    <span class="top-sp"></span>
    <button class="tbtn" type="button" id="btnTheme" aria-label="화면 밝기 바꾸기">${I.moon}</button>
  </div>
</header>
`;
}
const FOOT_NOTE = `<p>${SERVICE}은 공식 안내·백과사전·국가유산청 자료를 대조해 직접 쓴 참고용 안내예요. 전해지는 이야기를 소개할 뿐, 소원이 이뤄진다고 약속하지 않아요. 입장·주차·통제는 바뀔 수 있으니 방문 전에 공식 안내를 확인하세요. 확인일 ${fmtDate(CHECKED)}.</p>`;
function foot(up, ads) {
  return `
<footer class="jl-footer" data-site="wish" data-home="${up}../" data-copy="회원가입·위치 수집 없이 보는 안내예요">
  <div data-notes>${FOOT_NOTE}</div>
  <div data-links><a href="${up}">${SERVICE} 처음으로</a><a href="${up}#method">고른 기준·출처</a><a href="${up}privacy.html">개인정보처리방침</a></div>
</footer>
<script src="${up}../common/footer.js" defer></script>
${ads ? `<script src="${up}../common/ads.js" defer></script>\n` : ''}<script src="${up}js/app.js" defer></script>
</body>
</html>
`;
}
const NOTICE = `<p class="notice" role="note"><b>참고용 안내예요. 방문 전에 공식 안내를 확인하세요.</b> 전해지는 이야기를 소개할 뿐, 결과를 약속하지 않아요. 입장 시간·요금·주차·통제(산불·공사·기상)는 바뀔 수 있어요. 확인일 ${fmtDate(CHECKED)}.</p>`;

/* ---------- 지도(정적 SVG) ---------- */
const proj = (lat, lng) => { const g = GEO.proj; return [(lng - g.lonMin) * g.k * g.s, (g.latMax - lat) * g.s]; };
const ORDER = Object.keys(GEO.regions).sort((a, b) => GEO.regions[b].d.length - GEO.regions[a].d.length); // 큰 도를 먼저
function mapSvg({ list, up, sel = null, interactive = false, hrefFor, label, viewBox = '72 -2 252 428', r = 4.2 }) {
  const has = new Set(list.map(regionOf));
  const regs = ORDER.map(k => {
    const on = interactive && USED_REGIONS.includes(k);
    const cls = `rg${has.has(k) ? ' has' : ''}${sel === k ? ' sel' : ''}`;
    return on
      ? `<path class="${cls}" data-rk="${k}" d="${GEO.regions[k].d}" tabindex="0" role="button" aria-label="${RNAME[k]} 장소만 보기"></path>`
      : `<path class="${cls}" d="${GEO.regions[k].d}"></path>`;
  }).join('');
  const dots = list.map(p => {
    const [x, y] = proj(p.lat, p.lng);
    return `<a class="dot-a" href="${hrefFor(p)}" aria-label="${esc(p.name)}"><circle class="dot" data-types="${p.wishTypes.map(t => TYPE[t].slug).join(' ')}" data-region="${regionOf(p)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"><title>${esc(p.name)}</title></circle></a>`;
  }).join('');
  return `<svg viewBox="${viewBox}" role="img" aria-label="${esc(label)}"><g>${regs}</g><g>${dots}</g></svg>`;
}

/* ---------- 카드 ---------- */
const kakao = p => `https://map.kakao.com/link/to/${encodeURIComponent(p.name)},${p.lat},${p.lng}`;
const naver = p => `https://map.naver.com/p/search/${encodeURIComponent(p.name)}`;
function cardHref(p, up) { // 장소 이름을 누르면 갈 곳
  if (p.detail) return `${up}p/${p.id}/`;
  const rk = regionOf(p);
  return PAGE_REGIONS.includes(rk) ? `${up}region/${rk}/#${p.id}` : `${up}#${p.id}`;
}
function directions(p) {
  return `<div class="acts">
  <a class="btn btn-primary" href="${kakao(p)}" target="_blank" rel="noopener">${I.route}카카오맵 길찾기</a>
  <a class="btn" href="${naver(p)}" target="_blank" rel="noopener">${I.search}네이버 지도에서 보기</a>
</div>`;
}
function card(p, up, { selfAnchor = true } = {}) {
  const typeTags = p.wishTypes.map(t => `<li><a class="tag" href="${up}type/${TYPE[t].slug}/">${esc(TYPE[t].short)}</a></li>`).join('');
  const title = p.detail ? `<a href="${up}p/${p.id}/">${esc(p.name)}</a>` : esc(p.name);
  return `<li class="card" id="${p.id}" data-types="${p.wishTypes.map(t => TYPE[t].slug).join(' ')}" data-region="${regionOf(p)}">
  <div class="card-h"><h3>${title}</h3><span class="where">${esc(p.sido)} ${esc(p.sigungu)} · ${esc(p.kind)}</span></div>
  <ul class="tags">${typeTags}</ul>
  ${p.photo ? photoFig(p, up, 'card') : ''}
  <p class="sum">${esc(p.summary)}</p>
  <dl class="kv">
    <dt>사실</dt><dd>${esc(p.facts)}</dd>
    <dt>전해지는 이야기</dt><dd>${esc(p.legend)}</dd>
    <dt>가는 길</dt><dd>${esc(p.tips.route)}${p.tips.notes?.length ? ' ' + p.tips.notes.map(esc).join(' ') : ''}</dd>
    <dt>예절</dt><dd>${esc(p.tips.manners)}</dd>
  </dl>
  ${directions(p)}
  <p class="small" style="margin:10px 0 0">출처: ${p.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title.split(' · ')[0])}</a>`).join(', ')} · 확인 ${fmtDate(p.checked)}${p.approx ? ' · 지도 위치는 대략' : ''}${p.detail ? ` · <a href="${up}p/${p.id}/">자세히 보기</a>` : ''}</p>
</li>`;
}

/* ---------- 사진(위키미디어 커먼즈, LICENSES.md에 기록) ---------- */
const credit = ph => `사진: ${ph.page ? `<a href="${esc(ph.page)}" target="_blank" rel="noopener">${esc(ph.author)}</a>` : esc(ph.author)}, ${ph.licUrl ? `<a href="${esc(ph.licUrl)}" target="_blank" rel="noopener license">${esc(ph.license)}</a>` : esc(ph.license)}${ph.changed ? ', 크기 줄임' : ''} · 위키미디어 커먼즈`;
function photoFig(p, up, mode) {
  const ph = p.photo;
  const h600 = Math.round(600 * ph.h / ph.w), h1200 = Math.round(1200 * ph.h / ph.w);
  const img = mode === 'card'
    ? `<img src="${up}img/${p.id}-600.jpg" width="600" height="${h600}" alt="${esc(ph.alt)}" loading="lazy" decoding="async">`
    : `<img src="${up}img/${p.id}.jpg" srcset="${up}img/${p.id}-600.jpg 600w, ${up}img/${p.id}.jpg 1200w" sizes="(max-width: 760px) 100vw, 760px" width="1200" height="${h1200}" alt="${esc(ph.alt)}" decoding="async">`;
  return `<figure class="ph ph-${mode}">${img}<figcaption>${credit(ph)}</figcaption></figure>`;
}
for (const p of places) if (p.photo && !existsSync(join(WISH, 'img', `${p.id}.jpg`))) throw new Error(`사진 파일 없음: ${p.id}`);

/* ---------- 쓰기 ---------- */
const report = [];
function write(rel, html, { minUnique = 0, unique = '' } = {}) {
  const chars = hangul(html.replace(/<footer[\s\S]*<\/footer>/, ''));
  const ads = chars >= MIN_AD_CHARS;
  html = html.replace(AD_MARK, ads ? AD : '');
  if (!ads) html = html.replace(/<link rel="stylesheet" href="[^"]*common\/ads\.css">\n/, '').replace(/<script async src="https:\/\/pagead2[^\n]*\n/, '').replace(/<script src="[^"]*common\/ads\.js" defer><\/script>\n/, '');
  if (minUnique && hangul(unique) < minUnique) throw new Error(`${rel}: 고유 글 ${hangul(unique)}자 < ${minUnique}자`);
  const f = join(WISH, rel);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, html);
  report.push({ rel, chars, ads, unique: unique ? hangul(unique) : null });
}
const crumbLd = items => ({ '@type': 'BreadcrumbList', itemListElement: items.map(([name, url], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url })) });
const itemListLd = (name, list) => ({ '@type': 'ItemList', name, numberOfItems: list.length, itemListElement: list.map((p, i) => ({ '@type': 'ListItem', position: i + 1, name: p.name, url: p.detail ? `${BASE}p/${p.id}/` : (PAGE_REGIONS.includes(regionOf(p)) ? `${BASE}region/${regionOf(p)}/#${p.id}` : `${BASE}#${p.id}`) })) });

/* ---------- 첫 화면 ---------- */
const FAQ = [
  ['정말 소원이 이뤄지나요?', '알 수 없어요. 이 안내는 「~로 알려진」, 「~라는 이야기가 전해요」처럼 전해지는 이야기만 소개해요. 효과를 약속하는 표현은 쓰지 않아요. 마음을 정리하고 다짐을 새기는 나들이로 다녀오세요.'],
  ['어떤 기준으로 골랐나요?', '세 가지를 봤어요. 첫째, 사찰 공식 안내·지자체 관광 안내·대한민국 구석구석·한국민족문화대백과사전·국가유산청 자료 가운데 두 곳 이상에서 소원·기도 이야기를 확인할 수 있는 곳. 둘째, 누구나 들어갈 수 있는 곳. 셋째, 위치를 공개 자료로 확인할 수 있는 곳이에요. 블로그 소문만 있는 곳은 넣지 않았어요.'],
  ['점집이나 교회는 왜 없나요?', '점집·굿당 같은 무속 영업장은 넣지 않아요. 영업 홍보처럼 보일 수 있고 사실 확인도 어렵기 때문이에요. 교회도 「소원 비는 곳」이라는 틀과 맞지 않아 넣지 않았어요. 사찰과 암자, 그리고 바위·나무·샘처럼 마을에서 오래 이야기가 전해 온 곳을 중심으로 모았어요.'],
  ['절에 갈 때 지킬 예절이 있나요?', '법당 안에서는 사진을 찍지 말고 소리를 낮추세요. 기도하는 사람 앞을 가로지르지 말고, 기도 자리는 오래 차지하지 마세요. 시주함이 아닌 곳에 동전을 던지거나 탑에 돌을 얹는 일은 문화유산을 상하게 할 수 있어요.'],
  ['지도 위치가 정확한가요?', `대부분 OpenStreetMap 지점 데이터로 확인한 위치예요. 바위나 샘처럼 지점이 없는 ${places.filter(p => p.approx).length}곳은 가까운 마을·다리·해변을 기준으로 한 대략 위치이고, 카드에 「지도 위치는 대략」이라고 적었어요. 길찾기는 카카오맵·네이버 지도에서 이름이나 주소로 한 번 더 확인하세요.`],
  ['틀린 내용을 알려 주고 싶어요.', `이메일 ${CONTACT} 로 보내 주세요. 공식 자료와 대조해 고치고 확인일을 새로 적어요.`]
];
const faqHtml = `<section class="faq" aria-labelledby="faq-h"><h2 id="faq-h">자주 묻는 질문</h2>${FAQ.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section>`;
const faqLd = { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) };
function typeChips(up, current, asButtons) {
  if (asButtons) return `<button type="button" class="chip" data-ft="all" data-name="모든 소원" aria-pressed="true">전체 <small class="num">${places.length}</small></button>` + TYPES.map(t => `<button type="button" class="chip" data-ft="${t.slug}" data-name="${esc(t.short)}" aria-pressed="false">${esc(t.short)} <small class="num">${places.filter(p => p.wishTypes.includes(t.key)).length}</small></button>`).join('');
  return TYPES.map(t => `<a class="chip" href="${up}type/${t.slug}/"${current === t.key ? ' aria-current="page"' : ''}>${esc(t.short)} <small class="num">${places.filter(p => p.wishTypes.includes(t.key)).length}</small></a>`).join('');
}
function regionLinks(up, current) {
  return PAGE_REGIONS.map(k => `<a class="chip" href="${up}region/${k}/"${current === k ? ' aria-current="page"' : ''}>${RNAME[k]} <small class="num">${inRegion(k).length}</small></a>`).join('');
}
function buildIndex() {
  const up = '';
  const sorted = places.slice().sort((a, b) => REGIONS.findIndex(r => r[0] === a.sido) - REGIONS.findIndex(r => r[0] === b.sido));
  const typeCounts = TYPES.map(t => `${t.short} ${places.filter(p => p.wishTypes.includes(t.key)).length}곳`).join(', ');
  const html = head({
    title: `소원 비는 곳 · 전국 소원 명소 지도 | ${SERVICE}`,
    desc: `합격·건강·사랑·재물·자녀·새해·무사안녕, 소원 이야기가 전하는 전국 ${places.length}곳을 지도와 목록으로. 출처 2곳 이상 대조, 카카오맵·네이버 지도 길찾기.`,
    path: '', up, ads: true,
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'WebSite', name: SERVICE, url: BASE, inLanguage: 'ko', publisher: { '@type': 'Organization', name: SITE } },
      itemListLd(`${SERVICE} 전체 장소`, sorted), faqLd] }
  }) + `
<main id="main" class="wrap" tabindex="-1">
  <div class="hero">
  <h1>소원 빌러 가는 곳, ${SERVICE}</h1>
  <div class="prose">
    <p class="lead">내 소원은 어디서 빌까요? 합격·건강·사랑·재물·자녀·새해·무사안녕, 소원 이야기가 전하는 전국 <b class="num">${places.length}</b>곳을 지도와 목록으로 모았어요.</p>
    <p>장소마다 왜 그런 이야기가 생겼는지, 무엇을 보면 되는지, 어떻게 가는지를 적었어요. 「사실」과 「전해지는 이야기」를 나눠 썼고, 이야기는 모두 「~로 알려진」, 「~라는 이야기가 전해요」로만 적었어요. 결과를 약속하는 곳은 없어요.</p>
  </div>
  </div>
  ${NOTICE}
  <div class="filters" role="group" aria-label="소원 종류로 고르기">
    <p class="flabel">무슨 소원인가요?</p>
    <div class="chips">${typeChips(up, null, true)}</div>
    <p class="flabel">어느 지역인가요?</p>
    <div class="chips"><button type="button" class="chip" data-fr="all" data-name="전국" aria-pressed="true">전국</button>${USED_REGIONS.map(k => `<button type="button" class="chip" data-fr="${k}" data-name="${RNAME[k]}" aria-pressed="false">${RNAME[k]} <small class="num">${inRegion(k).length}</small></button>`).join('')}</div>
  </div>
  <div class="board" id="board">
    <div class="mapbox">
      ${mapSvg({ list: sorted, up, interactive: true, hrefFor: p => `#${p.id}`, label: `${SERVICE} 장소 ${places.length}곳 지도` })}
      <p class="maplegend"><span><i></i>장소</span><span>지역을 누르면 그 지역만 보여요</span></p>
    </div>
    <div>
      <p class="count" id="count" aria-live="polite"><b>전국 · 모든 소원</b> ${places.length}곳</p>
      <p class="empty" id="empty" hidden>이 조건에 맞는 곳이 아직 없어요. 다른 소원이나 지역을 골라 보세요.</p>
      <ul class="cards">${sorted.map(p => card(p, up)).join('\n')}</ul>
    </div>
  </div>
  ${AD_MARK}
  <section aria-labelledby="by-h"><h2 id="by-h">소원 종류별·지역별로 보기</h2>
    <p>소원 종류별 쪽에는 그 소원과 관련된 이야기를 한데 모아 소개 글을 붙였어요. 지역별 쪽은 장소가 세 곳 이상인 시·도만 만들었어요.</p>
    <div class="linkgrid">${typeChips(up, null, false)}</div>
    <div class="linkgrid">${regionLinks(up, null)}</div>
  </section>
  <section class="prose" id="method" aria-labelledby="m-h"><h2 id="m-h">고른 기준과 출처</h2>
    <p>소원 이야기는 사찰 공식 안내, 지자체 관광 안내, 한국관광공사 「대한민국 구석구석」, 한국민족문화대백과사전, 국가유산청 자료에서 확인했어요. 장소마다 두 곳 이상의 출처를 대조했고, 출처 링크를 카드 아래에 달았어요. 자료끼리 숫자가 다르면(창건 연도, 불상 높이 등) 쓰지 않거나 「자료마다 달라요」라고 적었어요.</p>
    <p>글은 모두 출처를 읽고 새로 썼어요. 블로그나 기사 문장을 옮기지 않았어요. 지금 모은 곳은 ${typeCounts}이에요. 한 곳이 여러 소원에 들어갈 수 있어요.</p>
    <p>점집·굿당 같은 무속 영업장과 교회는 넣지 않았어요. 다만 당산·장승·돌탑·본향당처럼 마을이 함께 제사를 지내 온 곳 가운데 국가나 지자체가 민속문화유산 등으로 지정한 곳은 마을 신앙 문화유산으로 실었어요. 개인 땅에 있거나 수행 때문에 일반인 출입을 막는 작은 암자도 뺐어요. 사진은 위키미디어 커먼즈에서 퍼블릭 도메인·CC0·CC BY·CC BY-SA처럼 쓸 수 있는 조건이 분명한 것만 골라, 사진 바로 아래에 작가와 라이선스를 적었어요. 새로 만든 불상·조각상을 크게 찍은 사진과 사람이 주인공인 사진은 쓰지 않았어요. 알맞은 사진이 없는 곳은 사진 없이 두었어요.</p>
    <p>지도 경계는 통계청 2013 행정경계 단순화본(southkorea-maps)을, 장소 위치는 OpenStreetMap(© OpenStreetMap 기여자, ODbL)을 썼어요. 모든 내용은 ${fmtDate(CHECKED)}에 확인했어요.</p>
  </section>
  ${faqHtml}
</main>
` + foot(up, true);
  write('index.html', html);
}

/* ---------- 소원 종류별 ---------- */
function buildType(t) {
  const up = '../../';
  const list = places.filter(p => p.wishTypes.includes(t.key));
  const intro = TYPE_INTRO[t.key];
  const html = head({
    title: `${t.h1} ${list.length}곳 · 지도와 가는 길 | ${SERVICE}`,
    desc: `${intro[0].slice(0, 90)}… 전국 ${list.length}곳의 이야기·가는 길·예절과 출처.`,
    path: `type/${t.slug}/`, up, ads: true,
    jsonld: { '@context': 'https://schema.org', '@graph': [itemListLd(`${t.h1}`, list), crumbLd([[SERVICE, BASE], [t.h1, `${BASE}type/${t.slug}/`]])] }
  }) + `
<main id="main" class="wrap" tabindex="-1">
  <div class="hero">
  <p class="crumb"><a href="${up}">${SERVICE}</a> › 소원 종류 › ${esc(t.short)}</p>
  <h1>${esc(t.h1)} <span class="num">${list.length}</span>곳</h1>
  <div class="prose" style="margin-top:12px">${intro.map(p => `<p>${esc(p)}</p>`).join('')}</div>
  </div>
  ${NOTICE}
  <div class="chips" style="margin:8px 0 0">${typeChips(up, t.key, false)}</div>
  <div class="board">
    <div class="mapbox">${mapSvg({ list, up, hrefFor: p => `#${p.id}`, label: `${t.short} 장소 ${list.length}곳 지도` })}</div>
    <div><ul class="cards">${list.map(p => card(p, up)).join('\n')}</ul></div>
  </div>
  ${AD_MARK}
  <section aria-labelledby="rg-h"><h2 id="rg-h">지역별로 보기</h2><div class="linkgrid">${regionLinks(up, null)}</div><p class="small">지도 첫 화면에서는 소원 종류와 지역을 함께 고를 수 있어요. <a href="${up}#${t.slug}">${esc(t.short)} 전체 지도로 보기</a></p></section>
</main>
` + foot(up, true);
  write(`type/${t.slug}/index.html`, html);
}

/* ---------- 지역별 ---------- */
function buildRegion(k) {
  const up = '../../';
  const list = inRegion(k);
  const name = RNAME[k];
  const types = TYPES.filter(t => list.some(p => p.wishTypes.includes(t.key)));
  const h1 = `${name} 소원 명소 ${list.length}곳`;
  const g = GEO.regions[k];
  const html = head({
    title: `${h1} · 지도와 가는 길 | ${SERVICE}`,
    desc: `${REGION_INTRO[k].slice(0, 100)}…`,
    path: `region/${k}/`, up, ads: true,
    jsonld: { '@context': 'https://schema.org', '@graph': [itemListLd(h1, list), crumbLd([[SERVICE, BASE], [h1, `${BASE}region/${k}/`]])] }
  }) + `
<main id="main" class="wrap" tabindex="-1">
  <div class="hero">
  <p class="crumb"><a href="${up}">${SERVICE}</a> › 지역 › ${name}</p>
  <h1>${esc(name)}에서 소원 빌러 가는 곳 <span class="num">${list.length}</span>곳</h1>
  <div class="prose" style="margin-top:12px"><p>${esc(REGION_INTRO[k] || '')}</p>
  <p>${esc(name)}에 모은 곳의 소원 종류는 ${types.map(t => `${t.short} ${list.filter(p => p.wishTypes.includes(t.key)).length}곳`).join(', ')}이에요. 장소마다 사실과 전해지는 이야기를 나눠 적고, 출처와 길찾기 버튼을 달았어요.</p></div>
  </div>
  ${NOTICE}
  <div class="chips" style="margin:8px 0 0">${regionLinks(up, k)}</div>
  <div class="board">
    <div class="mapbox">${mapSvg({ list, up, sel: k, hrefFor: p => `#${p.id}`, label: `${name} 장소 ${list.length}곳 지도` })}</div>
    <div><ul class="cards">${list.map(p => card(p, up)).join('\n')}</ul></div>
  </div>
  ${AD_MARK}
  <section aria-labelledby="ty-h"><h2 id="ty-h">소원 종류별로 보기</h2><div class="linkgrid">${typeChips(up, null, false)}</div><p class="small"><a href="${up}#all/${k}">${esc(name)} 지도에서 보기</a></p></section>
</main>
` + foot(up, true);
  write(`region/${k}/index.html`, html);
}

/* ---------- 장소 ---------- */
function buildPlace(p) {
  const up = '../../';
  const rk = regionOf(p);
  const [x, y] = proj(p.lat, p.lng);
  const vb = `${(x - 55).toFixed(0)} ${(y - 55).toFixed(0)} 110 110`;
  const same = places.filter(q => q.id !== p.id && regionOf(q) === rk);
  const sameType = places.filter(q => q.id !== p.id && regionOf(q) !== rk && q.wishTypes.some(t => p.wishTypes.includes(t))).slice(0, 6);
  const longHtml = p.long.map(s => `<h2>${esc(s.h)}</h2>${s.p.map(t => `<p>${esc(t)}</p>`).join('')}`).join('\n');
  const unique = [p.summary, p.facts, p.legend, ...p.long.flatMap(s => [s.h, ...s.p]), p.tips.route, ...(p.tips.notes || []), p.tips.manners].join(' ');
  const related = q => `<a class="chip" href="${cardHref(q, up)}">${esc(q.name)}</a>`;
  const title = `${p.name} — ${p.wishTypes.map(t => TYPE[t].short).join('·')} 소원 이야기와 가는 길 | ${SERVICE}`;
  const html = head({
    title, desc: `${p.summary} ${p.sido} ${p.sigungu}. 사실과 전해지는 이야기, 가는 길, 예절, 출처.`,
    path: `p/${p.id}/`, up, ads: true,
    jsonld: { '@context': 'https://schema.org', '@graph': [
      { '@type': 'TouristAttraction', name: p.name, alternateName: p.official, description: p.summary, url: `${BASE}p/${p.id}/`,
        address: { '@type': 'PostalAddress', addressCountry: 'KR', addressRegion: p.sido, addressLocality: p.sigungu, streetAddress: p.address },
        geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng }, isAccessibleForFree: undefined },
      crumbLd([[SERVICE, BASE], ...(PAGE_REGIONS.includes(rk) ? [[`${RNAME[rk]} 소원 명소`, `${BASE}region/${rk}/`]] : []), [p.name, `${BASE}p/${p.id}/`]])] }
  }) + `
<main id="main" class="wrap" tabindex="-1">
  <div class="hero">
  <p class="crumb"><a href="${up}">${SERVICE}</a> › ${PAGE_REGIONS.includes(rk) ? `<a href="${up}region/${rk}/">${RNAME[rk]}</a>` : RNAME[rk]} › ${esc(p.name)}</p>
  <div class="place-head">
    <div>
      <h1>${esc(p.name)}</h1>
      <p class="meta" style="margin-top:6px">${esc(p.official)} · ${esc(p.address)}</p>
      <ul class="tags">${p.wishTypes.map(t => `<li><a class="tag" href="${up}type/${TYPE[t].slug}/">${esc(TYPE[t].short)}</a></li>`).join('')}<li><span class="tag">${esc(p.kind)}</span></li></ul>
      <p class="lead">${esc(p.summary)}</p>
      ${directions(p)}
    </div>
    <div class="minimap">${mapSvg({ list: [p], up, sel: rk, hrefFor: () => kakao(p), label: `${p.name} 위치`, viewBox: vb, r: 3 })}<p class="small" style="margin:6px 4px 0">${p.approx ? '대략 위치(가까운 마을·다리·해변 기준)' : '위치: OpenStreetMap'} · 점을 누르면 카카오맵이 열려요</p></div>
  </div>
  </div>
  ${p.photo ? photoFig(p, up, 'page') : ''}
  <section class="facts" aria-label="사실과 전해지는 이야기">
    <p><span class="lbl">사실</span>${esc(p.facts)}</p>
    <p><span class="lbl">전해지는 이야기</span>${esc(p.legend)}</p>
  </section>
  <div class="prose">
${longHtml}
  <h2>가기 전에 알아 둘 것</h2>
  <ul class="tips"><li>${esc(p.tips.route)}</li>${(p.tips.notes || []).map(n => `<li>${esc(n)}</li>`).join('')}<li><b>예절</b> — ${esc(p.tips.manners)}</li></ul>
  </div>
  ${NOTICE}
  ${AD_MARK}
  <section aria-labelledby="src-h"><h2 id="src-h">출처</h2>
    <ul class="src">${p.sources.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul>
    <p class="small">출처를 읽고 직접 쓴 글이에요. 확인일 ${fmtDate(p.checked)}. 틀린 곳은 ${CONTACT} 로 알려 주세요.</p>
  </section>
  ${same.length ? `<section aria-labelledby="near-h"><h2 id="near-h">${RNAME[rk]}의 다른 곳</h2><div class="related">${same.map(related).join('')}</div></section>` : ''}
  ${sameType.length ? `<section aria-labelledby="st-h"><h2 id="st-h">비슷한 소원, 다른 지역</h2><div class="related">${sameType.map(related).join('')}</div></section>` : ''}
</main>
` + foot(up, true);
  write(`p/${p.id}/index.html`, html, { minUnique: MIN_AD_CHARS, unique });
}

/* ---------- 개인정보처리방침 ---------- */
function buildPrivacy() {
  const up = '';
  const html = head({
    title: `개인정보처리방침 — ${SERVICE} | ${SITE}`,
    desc: `${SERVICE}의 개인정보처리방침. 회원가입·위치 수집이 없고, 화면 밝기 설정만 이 기기에 저장합니다.`,
    path: 'privacy.html', up, ads: false,
    jsonld: { '@context': 'https://schema.org', '@type': 'WebPage', name: `개인정보처리방침 — ${SERVICE}`, url: BASE + 'privacy.html', inLanguage: 'ko' }
  }) + `
<main id="main" class="wrap doc prose" tabindex="-1">
  <h1>개인정보처리방침</h1>
  <p class="meta">시행일: 2026년 11월 15일</p>
  <h2>1. 모으는 정보가 없어요</h2>
  <p>${SERVICE}은 회원가입이 없고, 이름·연락처·위치를 묻거나 모으지 않습니다. 지도는 그림(SVG)으로 그려 보여 주며, 기기의 위치 정보에 접근하지 않습니다.</p>
  <ul><li>이 기기에만 저장하는 것: <code>wish.theme</code>(화면 밝기 설정). 브라우저의 사이트 데이터 삭제로 지울 수 있습니다.</li><li>소원 종류·지역을 고르면 주소 끝(#)만 바뀌며, 서버로 보내지 않습니다.</li></ul>
  <h2>2. 길찾기 버튼</h2>
  <p>「카카오맵 길찾기」, 「네이버 지도에서 보기」를 누르면 해당 회사의 지도 서비스로 이동합니다. 이동한 뒤의 정보 처리는 각 회사의 개인정보처리방침을 따릅니다.</p>
  <h2>3. 광고와 쿠키 (Google AdSense)</h2>
  <p>이 사이트는 Google AdSense 광고를 게재할 수 있습니다. Google 등 제3자 광고 사업자는 쿠키를 사용해 이 사이트와 다른 사이트 방문 기록을 바탕으로 광고를 제공할 수 있습니다. 맞춤 광고는 <a href="https://adssettings.google.com/" rel="noopener">Google 광고 설정</a>에서 끌 수 있고, 제3자 쿠키는 <a href="https://www.aboutads.info/choices/" rel="noopener">aboutads.info</a>에서 관리할 수 있습니다. 자세한 내용은 <a href="https://policies.google.com/technologies/ads?hl=ko" rel="noopener">Google 광고 정책</a>을 보세요.</p>
  <p>방문 통계를 위해 Google 태그 관리자(Google Tag Manager)로 Google Analytics를 사용합니다. Google Analytics는 쿠키로 어떤 페이지를 얼마나 보는지 같은 익명 이용 통계를 모으며, 이름처럼 개인을 알아볼 수 있는 정보는 모으지 않습니다. 원하지 않으면 브라우저에서 쿠키를 차단하거나 <a href="https://tools.google.com/dlpage/gaoptout?hl=ko" rel="noopener">Google 애널리틱스 차단 브라우저 부가기능</a>을 설치하세요.</p>
  <h2>4. 외부 리소스</h2>
  <p>글꼴(Pretendard)은 jsDelivr CDN에서 불러옵니다. 이 과정에서 CDN 사업자가 일반적인 접속 기록(IP, 브라우저 정보)을 처리할 수 있습니다.</p>
  <h2>5. 안내 내용에 대한 고지</h2>
  <p>${SERVICE}은 공식 자료를 대조해 쓴 참고용 안내이며, 소원의 결과나 효험을 약속하지 않습니다. 입장·주차·통제 정보는 바뀔 수 있으니 방문 전에 공식 안내를 확인하세요.</p>
  <h2>6. 문의</h2>
  <p>개인정보 관련 문의와 정정 요청은 이메일 <a href="mailto:${CONTACT}">${CONTACT}</a> 로 보내 주세요.</p>
</main>
` + foot(up, false);
  write('privacy.html', html);
}

/* ---------- 실행 ---------- */
for (const d of ['type', 'region', 'p']) if (existsSync(join(WISH, d))) rmSync(join(WISH, d), { recursive: true });
buildIndex();
TYPES.forEach(buildType);
PAGE_REGIONS.forEach(buildRegion);
places.filter(p => p.detail).forEach(buildPlace);
buildPrivacy();
for (const k of PAGE_REGIONS) if (!REGION_INTRO[k]) console.warn(`지역 소개 글 없음: ${k}`);
const detail = places.filter(p => p.detail).length;
console.log(`wish: ${SERVICE} — 장소 ${places.length}곳(대략 좌표 ${places.filter(p => p.approx).length}), 페이지 ${report.length}개 = 첫 화면 1 + 소원 ${TYPES.length} + 지역 ${PAGE_REGIONS.length} + 장소 ${detail} + 개인정보 1`);
for (const r of report) console.log(`  ${r.ads ? 'AD ' : '-- '} ${String(r.chars).padStart(5)}자${r.unique != null ? ` (고유 ${r.unique})` : ''}  ${r.rel}`);
