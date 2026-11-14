// 재미랩 사이트 Worker. 정적 파일(dist)은 ASSETS가 내려주고,
// 정적 파일 처리에서 .html 주소가 다른 주소로 넘어가면(307) 안 되는 검색엔진 확인 파일만 여기서 바로 답한다.
const VERIFY = {
  '/google0257301bb46d3493.html': 'google-site-verification: google0257301bb46d3493.html',
};

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (Object.prototype.hasOwnProperty.call(VERIFY, pathname)) {
      return new Response(VERIFY[pathname], { headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    return env.ASSETS.fetch(request);
  },
};
