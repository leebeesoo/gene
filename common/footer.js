/*
 * 재미랩 공용 푸터. 사용법:
 *   <link rel="stylesheet" href="../common/footer.css">
 *   <footer class="jl-footer" data-site="lotto" data-home="../">
 *     <div data-notes> 이 서비스만의 짧은 안내(면책·19세·1336 등) </div>
 *     <div data-sources> 정보 출처 목록(접혀서 보임) </div>
 *     <div data-links> 이 서비스의 소개·개인정보처리방침 등 링크 </div>
 *   </footer>
 *   <script src="../common/footer.js" defer></script>
 * data-copy="…" 로 맨 아래 한 줄을 바꿀 수 있습니다(예: 구글 폼을 쓰는 맛남의 광장).
 * data-notes / data-sources / data-links 는 모두 선택. 모든 서비스가 같은 순서·모양으로 그려집니다.
 */
(function () {
  var SERVICES = [
    ['lotto', '오늘로또', '사주로 뽑는 오늘의 로또 번호와 살 시간·방향'],
    ['lottomap', '명당로드', '로또 1등 명당 지도와 번호 통계'],
    ['roots', '근본 테스트', '사주와 퀴즈로 찾는 나의 근본 코드'],
    ['family', '식구궁합', '우리 가족 오행 궁합판'],
    ['names', '이름레이더', '내 이름, 전국에 몇 명?'],
    ['lifeclock', '남은봄', '남은 주말·명절·벚꽃 세는 인생 시계'],
    ['birthyear', '나때연감', '내가 태어난 해 타임캡슐'],
    ['sikdang', '제철식당', '이달 이 지역 제철 메뉴를 잘하는 집'],
    ['season', '제철장보기', '이달 제철 식재료와 지금 싼 품목'],
    ['market', '맛남의 광장', '버려질 농수산물이 어디서 남는지, 버려지기 전에'],
    ['donkey', '속마음 칠판', '아무도 모르게 적으면 잠깐 떴다 사라지는 칠판'],
    ['silver', '나이별 혜택·검진 달력', '태어난 해로 보는 올해 받을 혜택·검진'],
    ['money', '내 미래 머니', '청약 가점·이자·물가, 공식 기준으로 계산'],
    ['quotes', '내 상황 명언', '지금 필요한 한 줄, 원문과 출처까지']
  ];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function render(f) {
    if (f.getAttribute('data-rendered')) return;
    var site = f.getAttribute('data-site') || '';
    var home = f.getAttribute('data-home') || '../';
    var take = function (sel) { var el = f.querySelector(sel); return el ? el.innerHTML.trim() : ''; };
    var notes = take('[data-notes]'), sources = take('[data-sources]'), links = take('[data-links]');
    var me = SERVICES.filter(function (s) { return s[0] === site; })[0];
    var others = SERVICES.filter(function (s) { return s[0] !== site; });
    var base = home.replace(/\/?$/, '/');
    var html = '<div class="jf-in">' +
      '<div class="jf-top"><a class="jf-home" href="' + esc(home) + '">← 재미랩 홈</a>' +
      (links ? '<nav class="jf-links" aria-label="' + esc(me ? me[1] : '') + ' 안내">' + links + '</nav>' : '') + '</div>' +
      (notes ? '<div class="jf-notes">' + notes + '</div>' : '') +
      (sources ? '<details class="jf-sources"><summary>정보 출처</summary><div class="jf-body">' + sources + '</div></details>' : '') +
      '<details class="jf-others"><summary>다른 서비스</summary><ul class="jf-svc">' +
      others.map(function (s) { return '<li><a href="' + esc(base + s[0] + '/') + '"><b>' + esc(s[1]) + '</b>' + esc(s[2]) + '</a></li>'; }).join('') +
      '</ul></details>' +
      '<p class="jf-copy">© 재미랩' + (me ? ' · ' + esc(me[1]) : '') + ' · ' + esc(f.getAttribute('data-copy') || '입력한 정보는 이 기기에만 저장돼요') + '</p>' +
      '</div>';
    f.innerHTML = html;
    f.setAttribute('data-rendered', '1');
  }
  function run() { var list = document.querySelectorAll('footer.jl-footer'); for (var i = 0; i < list.length; i++) render(list[i]); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run); else run();
  window.JLFooter = { render: run };
})();
