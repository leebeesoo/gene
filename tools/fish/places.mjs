// 바다낚시지수 장소(활용가이드 261022 「바다낚시지수 코드정보」의 장소 코드 49곳: 갯바위 34·선상 15) → 쪽 주소·시·도·항구·조석 예보지점.
// sido·port·obs는 이름으로 짐작한 값이 섞여 있어요(✱ 표시는 이름이 겹치거나 확실하지 않음). 실제 응답의 lat/lot이 들어오면
// build.mjs가 좌표로 시·도를 다시 계산하고, obs가 없으면 tide-stations.json 좌표로 가장 가까운 예보지점을 고른다.
// port는 낚시어선 「선적항」 묶기와 낚시방 검색 링크(「{port} 낚시」)에만 쓴다.
export const PLACES = {
  // 갯바위
  '가거도': { slug: 'gageodo', sido: '전남', port: '가거도항', obs: 'SO_0577' },
  '거문도': { slug: 'geomundo', sido: '전남', port: '거문도항', obs: 'DT_0031' },
  '거제도': { slug: 'geojedo', sido: '경남', port: '거제', obs: 'DT_0029' },
  '계마항': { slug: 'gyemahang', sido: '전남', port: '계마항', obs: 'SO_1264' },
  '국화도': { slug: 'gukhwado', sido: '경기', port: '국화도', obs: 'SO_0564' },
  '김녕': { slug: 'gimnyeong', sido: '제주', port: '김녕항', obs: null },
  '남애항': { slug: 'namaehang', sido: '강원', port: '남애항', obs: 'SO_0732' },
  '대진항': { slug: 'daejinhang', sido: null, port: '대진항', obs: 'SO_0731' }, // ✱ 강원 고성·경북 영덕에 같은 이름
  '모항항': { slug: 'mohanghang', sido: null, port: '모항항', obs: null }, // ✱ 충남 태안·전북 부안
  '방포항': { slug: 'bangpohang', sido: '충남', port: '방포항', obs: 'SO_1260' },
  '부산남부': { slug: 'busan-south', sido: '부산', port: '부산', obs: 'DT_0005' },
  '부산동부': { slug: 'busan-east', sido: '부산', port: '부산', obs: 'SO_0553' },
  '부산서부': { slug: 'busan-west', sido: '부산', port: '다대포항', obs: 'SO_1272' },
  '비금도': { slug: 'bigeumdo', sido: '전남', port: '비금도', obs: null },
  '비양도': { slug: 'biyangdo', sido: '제주', port: '비양도', obs: null },
  '상왕등도': { slug: 'sangwangdeungdo', sido: '전북', port: '상왕등도', obs: 'SO_1253' },
  '상태도': { slug: 'sangtaedo', sido: '전남', port: '상태도', obs: 'SO_1255' },
  '서귀포': { slug: 'seogwipo', sido: '제주', port: '서귀포항', obs: 'DT_0010' },
  '성산포': { slug: 'seongsanpo', sido: '제주', port: '성산포항', obs: 'DT_0022' },
  '신시도': { slug: 'sinsido', sido: '전북', port: '신시도', obs: null },
  '신지도': { slug: 'sinjido', sido: '전남', port: '신지도', obs: null },
  '아야진항': { slug: 'ayajinhang', sido: '강원', port: '아야진항', obs: 'SO_1276' },
  '어청도': { slug: 'eocheongdo', sido: '전북', port: '어청도항', obs: 'DT_0037' },
  '연도': { slug: 'yeondo', sido: null, port: '연도', obs: null }, // ✱ 충남 서천(SO_1269 연도항)·전남 여수에 같은 이름
  '영흥도': { slug: 'yeongheungdo', sido: '인천', port: '영흥도', obs: 'DT_0043' },
  '외옹치항': { slug: 'oeongchihang', sido: '강원', port: '외옹치항', obs: null },
  '욕지도': { slug: 'yokjido', sido: '경남', port: '욕지도', obs: null },
  '울릉도': { slug: 'ulleungdo', sido: '경북', port: '울릉도', obs: 'DT_0013' },
  '울산': { slug: 'ulsan', sido: '울산', port: '울산', obs: 'DT_0020' },
  '울진 후정': { slug: 'uljin-hujeong', sido: '경북', port: '후정항', obs: null },
  '추자도': { slug: 'chujado', sido: '제주', port: '추자항', obs: 'DT_0021' },
  '포항': { slug: 'pohang', sido: '경북', port: '포항', obs: 'DT_0091' },
  '하조도': { slug: 'hajodo', sido: '전남', port: '하조도', obs: null },
  '후포': { slug: 'hupo', sido: '경북', port: '후포항', obs: 'DT_0011' },
  // 선상
  '강릉항북동(2km)': { slug: 'boat-gangneung-ne2', sido: '강원', port: '강릉항', obs: 'SO_0733' },
  '거진항동측(2km)': { slug: 'boat-geojin-e2', sido: '강원', port: '거진항', obs: 'SO_1274' },
  '공현진항동남동(5km)': { slug: 'boat-gonghyeonjin-ese5', sido: '강원', port: '공현진항', obs: 'SO_1275' },
  '도두항북서(2km)': { slug: 'boat-dodu-nw2', sido: '제주', port: '도두항', obs: null },
  '목포북항서측(53km)': { slug: 'boat-mokpo-w53', sido: '전남', port: '목포북항', obs: 'DT_0007' },
  '서망항남측(27km)': { slug: 'boat-seomang-s27', sido: '전남', port: '서망항', obs: 'SO_0555' },
  '안흥항북측(30km)': { slug: 'boat-anheung-n30', sido: '충남', port: '안흥항', obs: 'DT_0067' },
  '안흥항북북서(27km)': { slug: 'boat-anheung-nnw27', sido: '충남', port: '안흥항', obs: 'DT_0067' },
  '안흥항서측(40km)': { slug: 'boat-anheung-w40', sido: '충남', port: '안흥항', obs: 'DT_0067' },
  '양포항남동(3km)': { slug: 'boat-yangpo-se3', sido: '경북', port: '양포항', obs: 'SO_0573' },
  '인천항서측(24km)': { slug: 'boat-incheon-w24', sido: '인천', port: '인천항', obs: 'DT_0001' },
  '임원항동북동(10km)': { slug: 'boat-imwon-ene10', sido: '강원', port: '임원항', obs: 'SO_1281' },
  '척포항남남서(25km)': { slug: 'boat-cheokpo-ssw25', sido: '경남', port: '척포항', obs: null },
  '척포항남남동(24km)': { slug: 'boat-cheokpo-sse24', sido: '경남', port: '척포항', obs: null },
  '하리항남서(14km)': { slug: 'boat-hari-sw14', sido: null, port: '하리항', obs: null } // ✱
};
/** 알려지지 않은 장소 이름은 쪽 주소를 만들 수 없어 페이지를 만들지 않는다(빌드가 경고) */
export function placeOf(name) { return PLACES[name] || null; }
