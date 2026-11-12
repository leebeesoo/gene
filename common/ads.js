/*
 * 재미랩 공용 광고 도우미 — 모든 서비스가 같은 방식으로 광고를 붙입니다.
 *
 * 마크업(어디서나 동일):
 *   <aside class="jl-ad" aria-label="광고"><small>광고</small>
 *     <ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-XXXXXXXXXXXXXXXX"
 *          data-ad-slot="0000000000" data-ad-format="auto" data-full-width-responsive="true"></ins>
 *   </aside>
 *   (인피드: data-ad-format="fluid" data-ad-layout-key="…", 멀티플렉스: data-ad-format="autorelaxed")
 *
 * 사용:
 *   <link rel="stylesheet" href="../common/ads.css">
 *   <script src="../common/ads.js" defer></script>
 *   정적 페이지는 자동 실행됩니다. SPA는 화면(라우트)을 그릴 때마다 그린 뒤에
 *   window.JLAds && JLAds.mount(뷰_요소)  를 호출하세요. 새로 생긴 광고 칸만 한 번씩 요청합니다.
 *
 * 규칙: 페이지/라우트 이동 = 새 화면 = 새 광고 칸(<ins>)을 새로 그림 → 그 칸만 요청.
 * 같은 칸을 다시 요청(새로고침)하지 않습니다(애드센스 정책). 화면에 보이지 않는 칸은 보일 때 요청합니다.
 * 4초 안에 채워지지 않으면 칸을 접습니다(data-ad-status="unfilled" 이거나 스크립트 차단 시).
 */
(function () {
  var pushed = typeof WeakSet === 'function' ? new WeakSet() : null;
  function wasPushed(ins) { return pushed ? pushed.has(ins) : ins.getAttribute('data-jl-pushed') === '1'; }
  function mark(ins) { if (pushed) pushed.add(ins); ins.setAttribute('data-jl-pushed', '1'); }
  function collapse(box) { if (box) box.classList.add('jl-ad--empty'); }
  function watch(ins) {
    var box = ins.closest('.jl-ad');
    setTimeout(function () {
      var st = ins.getAttribute('data-ad-status');
      // 채워지지 않았거나, 광고 스크립트가 아예 안 불러와졌으면(차단·심사 전) 접는다
      if (st === 'unfilled' || (!st && !(window.adsbygoogle && window.adsbygoogle.loaded))) collapse(box);
    }, 4000);
    // 나중에 unfilled로 바뀌는 경우도 접는다
    if (typeof MutationObserver === 'function') new MutationObserver(function () {
      if (ins.getAttribute('data-ad-status') === 'unfilled') collapse(box);
    }).observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
  }
  function request(ins) {
    if (wasPushed(ins)) return;
    mark(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { collapse(ins.closest('.jl-ad')); return; }
    watch(ins);
  }
  var io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); request(e.target); } });
  }, { rootMargin: '300px 0px' }) : null;
  function mount(root) {
    var list = (root || document).querySelectorAll('ins.adsbygoogle');
    for (var i = 0; i < list.length; i++) {
      var ins = list[i];
      if (wasPushed(ins)) continue;
      if (io) io.observe(ins); else request(ins);
    }
  }
  function boot() { mount(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.JLAds = { mount: mount };
})();
