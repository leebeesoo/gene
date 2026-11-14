/* 나이별 혜택·검진 달력 — 모든 페이지 공통: 화면 밝기, 글자 크기, 보내기 */
(function () {
  var root = document.documentElement;
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function isDark() {
    var t = root.getAttribute('data-theme');
    if (t) return t === 'dark';
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches;
  }
  var bt = document.getElementById('btnTheme');
  if (bt) bt.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next); set('silver.theme', next);
  });
  var bs = document.getElementById('btnSize');
  function syncSize() { if (bs) bs.setAttribute('aria-pressed', root.getAttribute('data-size') === 'xl' ? 'true' : 'false'); }
  if (bs) bs.addEventListener('click', function () {
    if (root.getAttribute('data-size') === 'xl') { root.removeAttribute('data-size'); set('silver.size', null); }
    else { root.setAttribute('data-size', 'xl'); set('silver.size', 'xl'); }
    syncSize();
  });
  syncSize();

  var toastT;
  function toast(msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 2400);
  }
  function share(url, title) {
    if (navigator.share) { navigator.share({ title: title, text: title + ' — 나이별 혜택·검진 달력', url: url }).catch(function () {}); return; }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () { toast('주소를 복사했어요. 카카오톡에 붙여 넣어 보내세요.'); }, function () { prompt('이 주소를 복사해 보내세요', url); });
    } else prompt('이 주소를 복사해 보내세요', url);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-share]');
    if (!b) return;
    share(b.getAttribute('data-share'), b.getAttribute('data-share-title') || document.title);
  });
  window.SilverUI = { toast: toast, share: share };
})();
