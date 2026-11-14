# 속마음 칠판 — 실시간 중계소 (donkey-live)

`/donkey/` 칠판의 글을 **저장하지 않고 걸러서 방송만** 하는 Cloudflare Worker + Durable Object(방 1개)입니다. 무료 플랜으로 돌아갑니다.

```
src/index.js   입구(비상 정지·출처·Turnstile 확인) + 방 「Board」(WebSocket 잠자기 API)
src/room.js    방 규칙(100자·10초 1개·1시간 30개·같은 글 반복·방 전체 초당 5개·신고 3명 숨김·3번 숨겨지면 24시간 금지)
../../donkey/js/filter.js   금칙어·링크·연락처·자해 검사 (화면과 같은 파일)
test/room.test.js           node --test 로 방 규칙 시험
```

## 사장님 할 일 (처음 한 번, 약 15분)

1. **Turnstile 위젯 만들기** — Cloudflare 대시보드 → Turnstile → Add widget
   - 도메인: 내 도메인(예: `example.com`)과 `<프로젝트>.pages.dev`
   - Widget mode: **Managed**
   - 나오는 **사이트 키**(0x4AAAA…)는 Claude에게 → `donkey/js/config.js`의 `turnstileSiteKey`
   - **비밀 키**는 아래 4번에서 Cloudflare에 직접 넣음(채팅·저장소에 올리지 않기)
2. **Cloudflare API 토큰** — 대시보드 → My Profile → API Tokens → Create Token → 템플릿 「Edit Cloudflare Workers」
   - GitHub 저장소 Settings → Secrets and variables → Actions → `CLOUDFLARE_API_TOKEN` 으로 저장
   - 같은 곳에 `CLOUDFLARE_ACCOUNT_ID`(대시보드 오른쪽 아래 Account ID)도 저장
3. **배포** — GitHub → Actions → 「donkey-live 배포」 → Run workflow (또는 내 컴퓨터에서 `cd workers/donkey-live && npx wrangler deploy`)
4. **비밀값 넣기** (배포 후 한 번) — 대시보드 → Workers & Pages → donkey-live → Settings → Variables and Secrets → Add
   - `TURNSTILE_SECRET` = Turnstile 비밀 키 (Type: Secret)
   - `IP_SALT` = 아무 긴 글자 30자 이상 (Type: Secret)
5. **주소 정하기**
   - 도메인이 Cloudflare에 있으면: `wrangler.toml`의 `routes` 주석을 풀고 도메인을 넣어 다시 배포 → 주소 `wss://내도메인/donkey/live`
   - 아니면 기본 주소 `wss://donkey-live.<계정 이름>.workers.dev`
   - 이 주소를 Claude에게 → `donkey/js/config.js`의 `wsUrl`
   - `wrangler.toml`의 `ALLOWED_ORIGINS` 를 실제 사이트 주소로 바꿈(쉼표로 여러 개)
6. **확인** — 폰 2대(또는 PC+폰)로 `/donkey/`를 열어 「지금 2명」이 보이고, 한쪽에서 쓴 글이 다른 쪽에 떴다 사라지는지

## 비상 정지 (1분)

대시보드 → donkey-live → Settings → Variables → `BOARD_OPEN` 을 `false` 로 바꾸고 저장(Deploy).
새 접속은 모두 「혼자 외치기」로, 이미 열린 칠판도 다음 글을 보낼 때 혼자 모드로 바뀝니다. 다시 열 때는 `true`.

## 매일 볼 것 (출시 첫 주, 하루 5분)

대시보드 → Workers & Pages → donkey-live → Metrics: 요청 수(Workers)와 Durable Objects 요청 수.
하루 무료 한도는 각각 10만. 방문 1번에 Worker 요청 약 1.3, DO 요청 약 1.8이 예상값(`docs/ideas/01-donkey-ears.md` 2절). 크게 다르면 Claude에게 알려 주세요.
한도를 넘으면 그날은 자동으로 「혼자 외치기」가 되고, 한국 시간 오전 9시에 다시 열립니다.

## 개발자용

```sh
cd workers/donkey-live
node --test test/*.test.js          # 방 규칙 시험 (wrangler 없이)
node --test ../../donkey/tests/*.test.mjs   # 글 검사 시험
npx wrangler dev --var DEV_NO_TURNSTILE:true   # 내 컴퓨터에서 ws://localhost:8787
```

- 방 상태(신고 집계·24시간 금지)는 **메모리에만** 있습니다. 방이 오래 조용해서 잠들었다 깨면 비워집니다(글은 어차피 1분 안에 사라지므로 괜찮음). 24시간 금지가 방이 잠들면 풀리는 것은 알고 있는 한계입니다.
- 도배 기록은 접속마다 `serializeAttachment` 로 붙여 두어 방이 잠들어도 유지됩니다.
- 「지금 N명」은 접속·종료 때만(2초에 한 번으로 묶어) 알립니다. 알람을 쓰지 않으므로 방이 쉬는 동안 깨어나지 않습니다.
- 화면은 45초마다 `ping`을 보내고 방은 깨어나지 않고 `pong`으로 답합니다(setWebSocketAutoResponse). 이 ping이 요청으로 세이는지는 **미확인** — 최악으로 세여도 방문 1번에 약 0.3 요청.
