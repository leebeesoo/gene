import { store } from '../store.js';
import { esc, icon, won, toast, todayISO, debounce, $ } from '../util.js';
import { CATS, REASONS, REGION_NAMES, DELIVERY, discount } from '../meta.js';
import { card } from '../components.js';
import { guessArt } from '../art.js';

const MAX_PHOTOS = 4;

/** 사진을 캔버스로 줄여 dataURL(JPEG)로 — localStorage 용량 절약 */
export async function resizeImage(file, max = 1000, quality = 0.72) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    return c.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function recompress(dataUrl, max, q) {
  const img = new Image();
  img.src = dataUrl;
  await img.decode();
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * scale); c.height = Math.round(img.naturalHeight * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', q);
}

const blank = () => ({
  title: '', cat: '', reason: '', note: '', unit: 'kg', unitLabel: '', unitKg: 1, eaGram: 300, total: '', min: 1,
  normal: '', price: '', region: '', locality: '', harvestDate: todayISO(), deadlineDate: todayISO(7),
  delivery: ['parcel'], storage: '', desc: '', gbOn: false, gbGoal: '', gbExtra: 10, images: [],
});

export async function sellView(ctx) {
  ctx.noAds = true;
  const editId = ctx.params.id;
  let v;
  if (editId) {
    const l = await store.getListing(editId);
    if (!l || l.sellerId !== store.ME) {
      ctx.el.innerHTML = `<section class="page"><p>수정할 수 없는 상품이에요.</p><a class="btn" href="#/seller">판매자 센터</a></section>`;
      return;
    }
    v = {
      ...blank(), ...l, deadlineDate: l.deadline.slice(0, 10), eaGram: l.unit === 'ea' ? Math.round(l.unitKg * 1000) : 300,
      gbOn: !!l.gb, gbGoal: l.gb?.goal || '', gbExtra: l.gb?.extra || 10, images: l.images || [],
    };
    // 로컬 시간 기준 날짜
    const dl = new Date(l.deadline);
    v.deadlineDate = `${dl.getFullYear()}-${String(dl.getMonth() + 1).padStart(2, '0')}-${String(dl.getDate()).padStart(2, '0')}`;
  } else {
    const draft = await store.getDraft();
    v = { ...blank(), ...(draft || {}), images: [] };
    const me = await store.getSeller(store.ME);
    if (!v.region && me.region) { v.region = me.region; v.locality = me.locality; }
  }
  ctx.title = editId ? '상품 수정 — 맛남의 광장' : '판매 등록 — 맛남의 광장';

  const chipRadio = (name, items, val) => items.map((it) => `<label class="chip-radio"><input type="radio" name="${name}" value="${it.id}" ${val === it.id ? 'checked' : ''} required><span>${esc(it.label)}${it.hint ? `<small>${esc(it.hint)}</small>` : ''}</span></label>`).join('');

  ctx.el.innerHTML = `<section class="page sell">
    <div class="sell-head">
      <h1 class="page-title">${editId ? '상품 수정' : '판매 등록'}</h1>
      <p class="muted">${editId ? '변경 사항은 저장 즉시 반영돼요.' : '3분이면 충분해요. 작성 중인 내용은 이 기기에 자동 저장돼요.'}</p>
    </div>
    <div class="sell-layout">
    <form class="form" id="sell-form" novalidate>
      <fieldset class="fs"><legend>사진 <span class="muted small">최대 ${MAX_PHOTOS}장 · 흠집·크기를 보여주면 신뢰가 올라가요</span></legend>
        <div class="photos" id="photos"></div>
        <p class="err" id="err-images"></p>
      </fieldset>

      <div class="field"><label for="f-title">품목명 <span class="req">*</span></label>
        <input id="f-title" name="title" maxlength="40" required value="${esc(v.title)}" placeholder="예) 해남 겨울배추 과잉생산분" aria-describedby="err-title"><p class="err" id="err-title"></p></div>

      <fieldset class="fs"><legend>카테고리 <span class="req">*</span></legend><div class="chip-radios">${chipRadio('cat', CATS, v.cat)}</div><p class="err" id="err-cat"></p></fieldset>

      <fieldset class="fs"><legend>싸게 파는 이유 <span class="req">*</span></legend><div class="chip-radios reasons">${chipRadio('reason', REASONS, v.reason)}</div><p class="err" id="err-reason"></p></fieldset>
      <div class="field"><label for="f-note">이유를 솔직하게 <span class="req">*</span></label>
        <textarea id="f-note" name="note" rows="3" maxlength="300" required placeholder="예) 우박을 맞아 껍질에 작은 자국이 있어요. 과육과 당도는 정상품과 같아요." aria-describedby="hint-note err-note">${esc(v.note)}</textarea>
        <p class="hint" id="hint-note">솔직한 설명이 가장 잘 팔려요. 어떤 점이 정상품과 다른지 적어주세요.</p><p class="err" id="err-note"></p></div>

      <div class="row2">
        <div class="field"><label for="f-total">판매 수량 <span class="req">*</span></label>
          <div class="input-group"><input id="f-total" name="total" type="number" inputmode="decimal" min="1" required value="${esc(v.total)}" placeholder="300" aria-describedby="err-total">
          <select name="unit" aria-label="단위">${[['kg', 'kg'], ['box', '박스'], ['ea', '개']].map(([k, t]) => `<option value="${k}" ${v.unit === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
          <p class="err" id="err-total"></p></div>
        <div class="field"><label for="f-min">최소 주문량</label><input id="f-min" name="min" type="number" inputmode="decimal" min="1" value="${esc(v.min)}" aria-describedby="err-min"><p class="err" id="err-min"></p></div>
      </div>
      <div class="row2 unit-box" ${v.unit === 'box' ? '' : 'hidden'}>
        <div class="field"><label for="f-unitKg">박스당 중량(kg) <span class="req">*</span></label><input id="f-unitKg" name="unitKg" type="number" inputmode="decimal" min="0.1" step="0.1" value="${esc(v.unit === 'box' ? v.unitKg : 10)}" aria-describedby="err-unitKg"><p class="err" id="err-unitKg"></p></div>
        <div class="field"><label for="f-unitLabel">포장 설명</label><input id="f-unitLabel" name="unitLabel" maxlength="20" value="${esc(v.unitLabel)}" placeholder="예) 망(3포기·약 10kg)"></div>
      </div>
      <div class="field unit-ea" ${v.unit === 'ea' ? '' : 'hidden'}><label for="f-eaGram">개당 대략 중량(g)</label><input id="f-eaGram" name="eaGram" type="number" inputmode="numeric" min="1" value="${esc(v.eaGram)}"></div>

      <div class="row2">
        <div class="field"><label for="f-normal">정상가 <span class="muted small">/단위</span> <span class="req">*</span></label><div class="input-group"><input id="f-normal" name="normal" type="number" inputmode="numeric" min="100" step="100" required value="${esc(v.normal)}" placeholder="15000" aria-describedby="err-normal"><span class="suffix">원</span></div><p class="err" id="err-normal"></p></div>
        <div class="field"><label for="f-price">판매가 <span class="muted small">/단위</span> <span class="req">*</span></label><div class="input-group"><input id="f-price" name="price" type="number" inputmode="numeric" min="100" step="100" required value="${esc(v.price)}" placeholder="5900" aria-describedby="disc-out err-price"><span class="suffix">원</span></div><p class="hint strong" id="disc-out" aria-live="polite"></p><p class="err" id="err-price"></p></div>
      </div>

      <div class="row2">
        <div class="field"><label for="f-region">산지(시/도) <span class="req">*</span></label><select id="f-region" name="region" required aria-describedby="err-region"><option value="">선택</option>${REGION_NAMES.map((r) => `<option ${v.region === r ? 'selected' : ''}>${r}</option>`).join('')}</select><p class="err" id="err-region"></p></div>
        <div class="field"><label for="f-locality">시·군·구</label><input id="f-locality" name="locality" maxlength="12" value="${esc(v.locality)}" placeholder="예) 해남군"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="f-harvest">수확일</label><input id="f-harvest" name="harvestDate" type="date" value="${esc(v.harvestDate)}"></div>
        <div class="field"><label for="f-deadline">판매 마감일 <span class="req">*</span></label><input id="f-deadline" name="deadlineDate" type="date" required min="${todayISO()}" value="${esc(v.deadlineDate)}" aria-describedby="err-deadlineDate"><p class="err" id="err-deadlineDate"></p></div>
      </div>

      <fieldset class="fs"><legend>거래 방식 <span class="req">*</span></legend>
        <div class="chip-radios">${Object.entries(DELIVERY).map(([k, d]) => `<label class="chip-radio"><input type="checkbox" name="delivery" value="${k}" ${v.delivery.includes(k) ? 'checked' : ''}><span>${esc(d.label)}</span></label>`).join('')}</div>
        <p class="err" id="err-delivery"></p></fieldset>

      <fieldset class="fs">
        <legend>${icon('users', 16)}공동구매 <span class="muted small">목표가 모이면 추가 할인 — 대량 물량 처분에 효과적</span></legend>
        <label class="switch"><input type="checkbox" name="gbOn" ${v.gbOn ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span>공동구매 열기</span></label>
        <div class="row2 gb-opts" ${v.gbOn ? '' : 'hidden'}>
          <div class="field"><label for="f-gbGoal">목표 수량</label><input id="f-gbGoal" name="gbGoal" type="number" inputmode="numeric" min="1" value="${esc(v.gbGoal)}" aria-describedby="err-gbGoal"><p class="err" id="err-gbGoal"></p></div>
          <div class="field"><label for="f-gbExtra">달성 시 추가 할인</label><select id="f-gbExtra" name="gbExtra">${[5, 10, 15, 20].map((x) => `<option value="${x}" ${Number(v.gbExtra) === x ? 'selected' : ''}>${x}%</option>`).join('')}</select></div>
        </div>
      </fieldset>

      <div class="field"><label for="f-storage">보관 방법</label><input id="f-storage" name="storage" maxlength="40" value="${esc(v.storage)}" placeholder="예) 냉장 0~5℃, 수령 후 3일 내"></div>
      <div class="field"><label for="f-desc">상품 설명</label><textarea id="f-desc" name="desc" rows="4" maxlength="800" placeholder="품종, 재배 방식, 추천 용도 등">${esc(v.desc)}</textarea></div>

      <div class="sell-submit">
        ${editId ? `<button type="button" class="btn ghost lg" data-close-listing>판매 종료</button>` : ''}
        <button class="btn primary lg grow" type="submit">${editId ? '수정 저장' : '판매 시작하기'}</button>
      </div>
      <p class="muted small">등록하면 <a href="./terms.html" target="_blank" rel="noopener">이용약관</a>에 동의하는 것으로 봐요. 식품 안전·표시 책임은 판매자에게 있어요.</p>
    </form>
    <aside class="preview" aria-label="미리보기"><p class="preview-label">${icon('info', 14)}구매자에게 이렇게 보여요</p><div id="preview"></div></aside>
    </div></section>`;

  const form = $('#sell-form', ctx.el);
  const photosBox = $('#photos', ctx.el);
  let images = [...v.images];

  const read = () => {
    const fd = new FormData(form);
    const g = (k) => String(fd.get(k) ?? '').trim();
    const unit = g('unit');
    const unitKg = unit === 'kg' ? 1 : unit === 'box' ? Number(g('unitKg')) || 0 : (Number(g('eaGram')) || 0) / 1000;
    return {
      title: g('title'), cat: g('cat'), reason: g('reason'), note: g('note'), unit, unitKg,
      unitLabel: unit === 'box' ? g('unitLabel') || `박스(${Number(g('unitKg')) || '?'}kg)` : '',
      eaGram: Number(g('eaGram')) || 0,
      total: Number(g('total')) || 0, min: Number(g('min')) || 1, normal: Number(g('normal')) || 0, price: Number(g('price')) || 0,
      region: g('region'), locality: g('locality'), harvestDate: g('harvestDate'), deadlineDate: g('deadlineDate'),
      delivery: fd.getAll('delivery'), storage: g('storage'), desc: g('desc'),
      gbOn: !!fd.get('gbOn'), gbGoal: Number(g('gbGoal')) || 0, gbExtra: Number(g('gbExtra')) || 10,
    };
  };

  const toListing = (d) => ({
    title: d.title, cat: d.cat || 'etc', reason: d.reason || 'ugly', note: d.note, art: guessArt(d.title, d.cat), images,
    unit: d.unit, unitKg: d.unitKg, unitLabel: d.unitLabel, total: d.total, min: d.min, normal: d.normal, price: d.price,
    region: d.region, locality: d.locality, harvestDate: d.harvestDate,
    deadline: new Date(`${d.deadlineDate}T23:59:00`).toISOString(), delivery: d.delivery, storage: d.storage, desc: d.desc,
    gb: d.gbOn && d.gbGoal ? { goal: d.gbGoal, extra: d.gbExtra } : null,
  });

  const drawPhotos = () => {
    photosBox.innerHTML = `${images.map((src, i) => `<div class="photo"><img src="${esc(src)}" alt="등록 사진 ${i + 1}"><button type="button" class="icon-btn sm" data-del-photo="${i}" aria-label="사진 ${i + 1} 삭제">${icon('close', 14)}</button>${i === 0 ? '<span class="photo-main">대표</span>' : ''}</div>`).join('')}
      ${images.length < MAX_PHOTOS ? `<label class="photo add">${icon('camera', 24)}<span>사진 추가</span><input type="file" accept="image/*" multiple class="sr-only" id="photo-input"></label>` : ''}`;
  };

  const drawPreview = () => {
    const d = read();
    const discOut = $('#disc-out', ctx.el);
    if (d.normal && d.price) {
      const pc = discount({ normal: d.normal, price: d.price });
      discOut.textContent = d.price >= d.normal ? '판매가가 정상가보다 낮아야 해요' : `할인율 ${pc}% · ${won(d.normal - d.price)} 저렴`;
      discOut.classList.toggle('bad', d.price >= d.normal);
    } else discOut.textContent = '';
    const l = {
      id: 'preview', ...toListing(d), title: d.title || '품목명을 입력하세요', region: d.region || '산지', locality: d.locality,
      total: d.total || 100, remain: d.total || 100, normal: d.normal || 0, price: d.price || 0, delivery: d.delivery.length ? d.delivery : ['parcel'],
      gb: d.gbOn ? { goal: d.gbGoal || 1, joined: 0, extra: d.gbExtra } : null, cat: d.cat || 'veg',
    };
    $('#preview', ctx.el).innerHTML = card(l);
    $('#preview', ctx.el).querySelector('a')?.removeAttribute('href');
    $('#preview', ctx.el).querySelector('.wish-btn')?.setAttribute('tabindex', '-1');
  };

  const saveDraft = debounce(() => { if (!editId) store.saveDraft(read()); }, 400);

  form.addEventListener('input', () => { drawPreview(); saveDraft(); });
  form.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.name === 'unit') {
      form.querySelector('.unit-box').hidden = t.value !== 'box';
      form.querySelector('.unit-ea').hidden = t.value !== 'ea';
    }
    if (t.name === 'gbOn') form.querySelector('.gb-opts').hidden = !t.checked;
    if (t.id === 'photo-input') {
      const files = Array.from(t.files || []).slice(0, MAX_PHOTOS - images.length);
      for (const file of files) {
        if (!file.type.startsWith('image/')) continue;
        try {
          images.push(await resizeImage(file));
        } catch {
          toast('이 사진은 열 수 없어요. JPG·PNG로 다시 시도해 주세요.', { tone: 'error' });
        }
      }
      drawPhotos();
    }
    drawPreview();
    saveDraft();
  });
  photosBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-del-photo]');
    if (!b) return;
    images.splice(Number(b.dataset.delPhoto), 1);
    drawPhotos();
    drawPreview();
  });

  const validate = (d) => {
    const e = {};
    if (d.title.length < 2) e.title = '품목명을 2자 이상 입력해 주세요.';
    if (!d.cat) e.cat = '카테고리를 골라주세요.';
    if (!d.reason) e.reason = '싸게 파는 이유를 골라주세요.';
    if (d.note.length < 10) e.note = '구매자가 이해할 수 있게 10자 이상 적어주세요.';
    if (!(d.total > 0)) e.total = '판매 수량을 입력해 주세요.';
    if (!(d.min > 0)) e.min = '최소 주문량은 1 이상이어야 해요.';
    else if (d.total && d.min > d.total) e.min = '최소 주문량이 판매 수량보다 많아요.';
    if (d.unit === 'box' && !(d.unitKg > 0)) e.unitKg = '박스당 중량을 입력해 주세요.';
    if (!(d.normal >= 100)) e.normal = '정상가를 입력해 주세요.';
    if (!(d.price >= 100)) e.price = '판매가를 입력해 주세요.';
    else if (d.price >= d.normal) e.price = '판매가는 정상가보다 낮아야 해요.';
    if (!d.region) e.region = '산지를 선택해 주세요.';
    if (!d.deadlineDate) e.deadlineDate = '판매 마감일을 정해주세요.';
    else if (d.deadlineDate < todayISO()) e.deadlineDate = '마감일은 오늘 이후여야 해요.';
    else if (d.harvestDate && d.deadlineDate < d.harvestDate && !editId) e.deadlineDate = '마감일이 수확일보다 빨라요.';
    if (!d.delivery.length) e.delivery = '거래 방식을 하나 이상 골라주세요.';
    if (d.gbOn && !(d.gbGoal > 0)) e.gbGoal = '목표 수량을 입력해 주세요.';
    else if (d.gbOn && d.gbGoal > d.total) e.gbGoal = '목표가 판매 수량보다 많아요.';
    return e;
  };

  form.addEventListener('input', (e) => {
    const n = e.target.name;
    if (!n || e.target.getAttribute('aria-invalid') !== 'true') return;
    form.querySelectorAll(`[name="${n}"]`).forEach((i) => i.removeAttribute('aria-invalid'));
    const p = form.querySelector(`#err-${n}`);
    if (p) p.textContent = '';
  });
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const d = read();
    const errs = validate(d);
    form.querySelectorAll('.err').forEach((p) => { p.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
    const keys = Object.keys(errs);
    if (keys.length) {
      keys.forEach((k) => {
        const p = $(`#err-${k}`, form);
        if (p) p.textContent = errs[k];
        form.querySelectorAll(`[name=${k}]`).forEach((i) => i.setAttribute('aria-invalid', 'true'));
      });
      const firstEl = form.querySelector(`[name=${keys[0]}]`);
      firstEl?.focus();
      firstEl?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      toast(`확인이 필요한 항목이 ${keys.length}개 있어요`, { tone: 'error' });
      return;
    }
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    const save = async () => (editId ? store.updateListing(editId, toListing(d)) : store.createListing(toListing(d)));
    try {
      let saved;
      try {
        saved = await save();
      } catch (err) {
        if (err.code !== 'QUOTA' || !images.length) throw err;
        // 용량 초과: 사진을 더 작게 줄여 한 번 더
        images = await Promise.all(images.map((src) => recompress(src, 640, 0.6)));
        saved = await save();
        toast('저장 공간이 부족해 사진을 더 작게 줄였어요');
      }
      if (!editId) {
        store.clearDraft();
        if (d.region) {
          const me = await store.getSeller(store.ME);
          if (!me.region) store.updateMySeller({ region: d.region, locality: d.locality });
        }
      }
      await store.setPrefs({ role: 'seller' });
      toast(editId ? '수정했어요' : '판매를 시작했어요!', { action: '상품 보기', href: `#/item/${saved.id}` });
      location.hash = '#/seller';
    } catch (err) {
      btn.disabled = false;
      if (err.code === 'QUOTA') toast('기기 저장 공간이 부족해요. 사진 수를 줄이거나 오래된 상품을 정리해 주세요.', { tone: 'error', ms: 5000 });
      else toast(err.message || '저장하지 못했어요', { tone: 'error' });
    }
  });

  form.querySelector('[data-close-listing]')?.addEventListener('click', async () => {
    if (!confirm('판매를 종료할까요? 구매자에게 더 이상 보이지 않아요.')) return;
    await store.setListingStatus(editId, 'closed');
    toast('판매를 종료했어요');
    location.hash = '#/seller';
  });

  drawPhotos();
  drawPreview();
}
