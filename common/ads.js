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
 *
 * 보이기: 칸은 기본으로 높이 0·라벨 없음(ads.css). 애드센스가 data-ad-status="filled"를 달면
 * .jl-ad--filled를 붙여 그때만 보이고, "unfilled"이거나 4초 안에 스크립트가 안 불러와지면 .jl-ad--empty로 접습니다.
 *
 * 자리표시 ID: 게시자 ID가 ca-pub-XXXX… 이거나 광고 단위 ID가 0000000000이면 요청하지 않습니다.
 * (페이지 전체가 자리표시면 <html>에 .jl-ads-off — 심사 전에도 빈 칸이 하나도 안 보임)
 * 진짜 ID로 바꾸면 코드 수정 없이 그대로 켜집니다.
 */
(function () {
  function fakeClient(id) { return !id || /X{4,}/i.test(id) || /^ca-pub-0+$/.test(id); }
  function fakeSlot(id) { return !id || /^0+$/.test(id); }
  var head = document.querySelector('script[src*="adsbygoogle.js"]');
  var headClient = head ? ((head.getAttribute('src') || '').match(/client=([^&]+)/) || [])[1] : null;
  var off = !!head && fakeClient(headClient);
  if (off) document.documentElement.classList.add('jl-ads-off');

  var pushed = typeof WeakSet === 'function' ? new WeakSet() : null;
  function wasPushed(ins) { return pushed ? pushed.has(ins) : ins.getAttribute('data-jl-pushed') === '1'; }
  function mark(ins) { if (pushed) pushed.add(ins); ins.setAttribute('data-jl-pushed', '1'); }
  function boxOf(ins) { return ins.closest('.jl-ad'); }
  // 광고 칸 하나만 담은 감싸개(목록 사이 li 등)도 함께 접고 펼친다
  function hostOf(box) {
    var p = box && box.parentElement;
    return p && p !== document.body && p.children.length === 1 ? p : null;
  }
  function setState(ins, state) {
    var box = boxOf(ins); if (!box) return;
    var host = hostOf(box);
    box.classList.remove('jl-ad--filled', 'jl-ad--empty');
    box.classList.add('jl-ad--' + state);
    if (host) { host.classList.remove('jl-ad-host--filled', 'jl-ad-host--empty'); host.classList.add('jl-ad-host', 'jl-ad-host--' + state); }
  }
  function sync(ins) {
    var st = ins.getAttribute('data-ad-status');
    if (st === 'filled') setState(ins, 'filled');
    else if (st === 'unfilled') setState(ins, 'empty');
  }
  function watch(ins) {
    if (typeof MutationObserver === 'function') new MutationObserver(function () { sync(ins); })
      .observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] });
    sync(ins);
    setTimeout(function () {
      var st = ins.getAttribute('data-ad-status');
      // 상태가 없고 광고 스크립트도 안 불러와졌으면(차단·심사 전) 접는다
      if (st === 'unfilled' || (!st && !(window.adsbygoogle && window.adsbygoogle.loaded))) setState(ins, 'empty');
    }, 4000);
  }
  function request(ins) {
    if (wasPushed(ins)) return;
    mark(ins);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { setState(ins, 'empty'); return; }
    watch(ins);
  }
  function target(ins) { var b = boxOf(ins); return (b && hostOf(b)) || b || ins; }
  var io = typeof IntersectionObserver === 'function' ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      var list = e.target.matches('ins.adsbygoogle') ? [e.target] : e.target.querySelectorAll('ins.adsbygoogle');
      for (var i = 0; i < list.length; i++) request(list[i]);
    });
  }, { rootMargin: '300px 0px' }) : null;
  function mount(root) {
    var list = (root || document).querySelectorAll('ins.adsbygoogle');
    for (var i = 0; i < list.length; i++) {
      var ins = list[i];
      if (wasPushed(ins)) continue;
      if (off || fakeClient(ins.getAttribute('data-ad-client')) || fakeSlot(ins.getAttribute('data-ad-slot'))) {
        mark(ins); setState(ins, 'empty'); continue;
      }
      if (io) io.observe(target(ins)); else request(ins);
    }
  }
  function boot() { mount(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  window.JLAds = { mount: mount, off: off };
})();
