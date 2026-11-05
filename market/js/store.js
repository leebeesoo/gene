/*
 * store.js — 맛남의 광장 데이터 계층
 * ------------------------------------------------------------
 * 앱의 모든 읽기/쓰기는 이 파일의 `store` 객체만 거칩니다. 지금은 브라우저 localStorage에
 * 저장하지만, 모든 메서드가 Promise를 반환하도록 되어 있어 Supabase 같은 실제 백엔드로 옮길 때는
 * 이 파일 내부만 바꾸면 됩니다. (예: getListings → supabase.from('listings').select('*'),
 * placeOrder → RPC/트랜잭션, on('change') → Realtime 구독). 뷰는 메서드 이름과 반환 객체 모양에만 의존합니다.
 *
 * 데모 전용 동작 두 가지 (백엔드 연결 시 삭제):
 *  1) simulateSeller(): 시드 판매자에게 보낸 주문 요청은 시간이 지나면 자동으로 진행 상태가 바뀝니다.
 *  2) 시드 상품 일부는 첫 방문 몇 시간 뒤 '새로 올라오도록' publishAt이 설정됩니다 (알림 배지 데모).
 */
import { SEED, SEED_VERSION } from './seed.js';
import { effectivePrice, isActive, CO2_PER_KG, isExpired } from './meta.js';

const NS = 'mn1:';
const ME = 'me';
const H = 3600000;
const mem = new Map(); // localStorage를 못 쓸 때(사파리 프라이빗 등) 메모리 폴백

export class StoreError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code;
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(NS + key);
    if (raw == null) return mem.has(key) ? mem.get(key) : fallback;
    return JSON.parse(raw);
  } catch {
    return mem.has(key) ? mem.get(key) : fallback;
  }
}
function write(key, value) {
  mem.set(key, value);
  try {
    localStorage.setItem(NS + key, JSON.stringify(value));
  } catch (e) {
    const quota = e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);
    if (quota) throw new StoreError('QUOTA', '저장 공간이 부족합니다.');
    // 그 외(접근 차단 등)는 메모리에만 유지
  }
}

const listeners = new Set();
function emit(topic) {
  listeners.forEach((fn) => {
    try { fn(topic); } catch (e) { console.warn(e); }
  });
}

const uid = (p) => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 6);
const clone = (o) => (o == null ? o : JSON.parse(JSON.stringify(o)));
const dateOnly = (ms) => {
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// ── 시드 ────────────────────────────────────────────────
function buildSeed(base, first) {
  const listings = [];
  const sellers = {};
  for (const s of SEED) {
    const sid = 'f-' + s.id;
    sellers[sid] = { id: sid, ...s.seller, region: s.region, locality: s.locality };
    const createdAt = s.publishH != null ? (first ? base + s.publishH * H : base - 1 * H) : base - s.createdH * H;
    const deadlineBase = s.publishH != null && first ? createdAt : base;
    listings.push({
      id: s.id, seed: true, sellerId: sid, status: 'active',
      title: s.title, cat: s.cat, reason: s.reason, note: s.note, art: s.art, images: [],
      unit: s.unit, unitKg: s.unitKg, unitLabel: s.unitLabel || '', total: s.total, remain: s.remain, min: s.min,
      normal: s.normal, price: s.price, region: s.region, locality: s.locality,
      harvestDate: dateOnly(base + s.harvest * 24 * H), deadline: new Date(deadlineBase + s.deadlineH * H).toISOString(),
      createdAt: new Date(createdAt).toISOString(), delivery: s.delivery, storage: s.storage || '',
      gb: s.gb ? { ...s.gb } : null, desc: s.desc,
    });
  }
  return { listings, sellers };
}

function ensureSeed() {
  const meta = read('meta', null);
  const now = Date.now();
  const stale = !meta || meta.v !== SEED_VERSION || now - meta.seededAt > 4 * 24 * H;
  if (!stale) return;
  const first = !meta;
  const { listings, sellers } = buildSeed(now, first);
  const existing = read('listings', []);
  const userListings = existing.filter((l) => !l.seed);
  const prevSellers = read('sellers', {});
  write('listings', [...userListings, ...listings]);
  write('sellers', { ...prevSellers, ...sellers });
  write('meta', { v: SEED_VERSION, seededAt: now, firstVisit: meta?.firstVisit || now });
  if (first) {
    const prefs = read('prefs', {});
    write('prefs', { ...defaultPrefs(), ...prefs, alertsSeenAt: new Date(now).toISOString() });
  }
}

const defaultPrefs = () => ({
  role: 'buyer', buyerType: 'personal', myRegion: '',
  alerts: { cats: [], regions: [] }, alertsSeenAt: new Date().toISOString(),
  buyerInfo: { name: '', phone: '', address: '', bizName: '' },
});

// ── 내부 헬퍼 ───────────────────────────────────────────
const allListings = () => read('listings', []);
const visible = (l, now = Date.now()) => new Date(l.createdAt).getTime() <= now;
function saveListings(list) { write('listings', list); }
function patchListing(id, fn) {
  const list = allListings();
  const i = list.findIndex((l) => l.id === id);
  if (i < 0) return null;
  list[i] = fn({ ...list[i] }) || list[i];
  saveListings(list);
  return list[i];
}

/** 데모: 시드 판매자 주문 자동 진행 (백엔드 연결 시 제거) */
function simulateSeller(orders) {
  let changed = false;
  const now = Date.now();
  const plan = [['confirmed', 40 * 1000], ['shipped', 6 * H], ['delivered', 30 * H]];
  for (const o of orders) {
    if (o.sellerId === ME || !['requested', 'confirmed', 'shipped'].includes(o.status)) continue;
    const t0 = new Date(o.createdAt).getTime();
    for (const [st, dt] of plan) {
      if (now - t0 >= dt && !o.timeline.some((t) => t.s === st)) {
        o.timeline.push({ s: st, at: new Date(t0 + dt).toISOString() });
        o.status = st;
        changed = true;
      }
    }
  }
  return changed;
}

function restoreStock(order) {
  const list = allListings();
  for (const it of order.items) {
    const l = list.find((x) => x.id === it.listingId);
    if (!l) continue;
    l.remain = Math.min(l.total, l.remain + it.qty);
    if (l.gb) l.gb.joined = Math.max(0, l.gb.joined - it.qty);
  }
  saveListings(list);
}

// ── 공개 인터페이스 ─────────────────────────────────────
export const store = {
  ME,

  async init() {
    ensureSeed();
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith(NS)) emit(e.key.slice(NS.length));
    });
  },

  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  // 상품
  async getListings({ includeInactive = false, sellerId } = {}) {
    const now = Date.now();
    return allListings()
      .filter((l) => visible(l, now))
      .filter((l) => (sellerId ? l.sellerId === sellerId : true))
      .filter((l) => includeInactive || isActive(l))
      .map(clone);
  },
  async getListing(id) {
    const l = allListings().find((x) => x.id === id);
    return l && visible(l) ? clone(l) : null;
  },
  async createListing(input) {
    const l = {
      ...input, id: uid('u'), seed: false, sellerId: ME, status: 'active',
      remain: input.total, createdAt: new Date().toISOString(),
      gb: input.gb ? { goal: input.gb.goal, joined: 0, extra: input.gb.extra } : null,
    };
    const list = allListings();
    list.unshift(l);
    saveListings(list); // QUOTA 에러는 호출부로 전달
    ensureMySeller();
    emit('listings');
    return clone(l);
  },
  async updateListing(id, patch) {
    const cur = allListings().find((l) => l.id === id);
    if (!cur || cur.sellerId !== ME) throw new StoreError('FORBIDDEN', '내 상품만 수정할 수 있어요.');
    const sold = cur.total - cur.remain;
    const next = patchListing(id, (l) => {
      Object.assign(l, patch);
      if (patch.total != null) l.remain = Math.max(0, patch.total - sold);
      if (patch.gb === null) l.gb = null;
      else if (patch.gb) l.gb = { goal: patch.gb.goal, extra: patch.gb.extra, joined: cur.gb?.joined || 0 };
      return l;
    });
    emit('listings');
    return clone(next);
  },
  async setListingStatus(id, status) {
    const cur = allListings().find((l) => l.id === id);
    if (!cur || cur.sellerId !== ME) throw new StoreError('FORBIDDEN');
    patchListing(id, (l) => ({ ...l, status }));
    emit('listings');
  },
  async deleteListing(id) {
    const list = allListings();
    const cur = list.find((l) => l.id === id);
    if (!cur || cur.sellerId !== ME) throw new StoreError('FORBIDDEN');
    saveListings(list.filter((l) => l.id !== id));
    write('cart', read('cart', []).filter((c) => c.listingId !== id));
    emit('listings');
    emit('cart');
  },

  // 판매자
  async getSeller(id) {
    if (id === ME) return ensureMySeller();
    return clone(read('sellers', {})[id] || null);
  },
  async updateMySeller(patch) {
    const sellers = read('sellers', {});
    sellers[ME] = { ...ensureMySeller(), ...patch };
    write('sellers', sellers);
    emit('sellers');
    return clone(sellers[ME]);
  },

  // 장바구니
  async getCart() { return read('cart', []); },
  async addToCart(listingId, qty, delivery) {
    const l = allListings().find((x) => x.id === listingId);
    if (!l || !isActive(l)) throw new StoreError('UNAVAILABLE', '판매가 끝난 상품이에요.');
    const cart = read('cart', []);
    const item = cart.find((c) => c.listingId === listingId);
    const nextQty = Math.min(l.remain, Math.max(l.min, (item?.qty || 0) + qty));
    if (item) { item.qty = nextQty; if (delivery) item.delivery = delivery; }
    else cart.push({ listingId, qty: nextQty, delivery: delivery || l.delivery[0], addedAt: new Date().toISOString() });
    write('cart', cart);
    emit('cart');
    return cart;
  },
  async updateCartItem(listingId, patch) {
    const cart = read('cart', []);
    const item = cart.find((c) => c.listingId === listingId);
    if (item) Object.assign(item, patch);
    write('cart', cart);
    emit('cart');
    return cart;
  },
  async removeFromCart(listingId) {
    write('cart', read('cart', []).filter((c) => c.listingId !== listingId));
    emit('cart');
  },

  /**
   * 장바구니 → 판매자별 '주문 요청' 생성. 결제는 판매자 확인 후 별도 안내(결제 연동 전).
   * @returns {Promise<Array>} 생성된 주문들
   */
  async placeOrder({ buyer, recurring = null, note = '' }) {
    const cart = read('cart', []);
    if (!cart.length) throw new StoreError('EMPTY', '장바구니가 비어 있어요.');
    const list = allListings();
    const groups = new Map();
    for (const c of cart) {
      const l = list.find((x) => x.id === c.listingId);
      if (!l || !isActive(l)) throw new StoreError('UNAVAILABLE', `판매가 끝난 상품이 있어요${l ? `: ${l.title}` : ''}`);
      if (c.qty < l.min) throw new StoreError('MIN', `${l.title}: 최소 주문량은 ${l.min}입니다.`);
      if (c.qty > l.remain) throw new StoreError('STOCK', `${l.title}: 남은 수량이 부족해요.`);
      if (!groups.has(l.sellerId)) groups.set(l.sellerId, []);
      groups.get(l.sellerId).push({ c, l });
    }
    const sellers = read('sellers', {});
    const now = new Date().toISOString();
    const orders = [];
    for (const [sellerId, rows] of groups) {
      const items = rows.map(({ c, l }) => {
        const unitPrice = effectivePrice(l, c.qty);
        return {
          listingId: l.id, title: l.title, art: l.art, cat: l.cat, unit: l.unit, unitLabel: l.unitLabel, unitKg: l.unitKg,
          qty: c.qty, price: unitPrice, listPrice: l.price, normal: l.normal, delivery: c.delivery,
          region: l.region, locality: l.locality,
        };
      });
      const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
      const normalTotal = items.reduce((s, i) => s + i.normal * i.qty, 0);
      const parcelSub = items.filter((i) => i.delivery === 'parcel').reduce((s, i) => s + i.price * i.qty, 0);
      const shipping = shippingFee(parcelSub, items.some((i) => i.delivery === 'parcel'));
      orders.push({
        id: 'MN' + now.slice(2, 10).replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(),
        createdAt: now, sellerId, sellerName: sellers[sellerId]?.farm || '내 농장',
        items, subtotal, normalTotal, saved: normalTotal - subtotal, shipping, total: subtotal + shipping,
        kg: items.reduce((s, i) => s + i.qty * (i.unitKg || 0), 0),
        buyer: { ...buyer }, recurring, note, status: 'requested', timeline: [{ s: 'requested', at: now }],
      });
      for (const { c, l } of rows) {
        l.remain -= c.qty;
        if (l.gb) l.gb.joined += c.qty;
      }
    }
    saveListings(list);
    write('orders', [...orders, ...read('orders', [])]);
    write('cart', []);
    const prefs = read('prefs', defaultPrefs());
    prefs.buyerInfo = { name: buyer.name, phone: buyer.phone, address: buyer.address, bizName: buyer.bizName || '' };
    write('prefs', prefs);
    emit('orders'); emit('cart'); emit('listings');
    return clone(orders);
  },

  async getOrders({ as = 'buyer' } = {}) {
    const orders = read('orders', []);
    if (simulateSeller(orders)) write('orders', orders);
    if (as === 'seller') return clone(orders.filter((o) => o.sellerId === ME));
    return clone(orders);
  },
  async getOrder(id) {
    const orders = await this.getOrders();
    return orders.find((o) => o.id === id) || null;
  },
  /** 판매자: 주문 상태 변경 (requested→confirmed|declined, confirmed→shipped, shipped→delivered) */
  async updateOrderStatus(id, next) {
    const orders = read('orders', []);
    const o = orders.find((x) => x.id === id);
    if (!o || o.sellerId !== ME) throw new StoreError('FORBIDDEN');
    const ok = { requested: ['confirmed', 'declined'], confirmed: ['shipped'], shipped: ['delivered'] }[o.status] || [];
    if (!ok.includes(next)) throw new StoreError('STATE', '지금은 바꿀 수 없는 상태예요.');
    o.status = next;
    o.timeline.push({ s: next, at: new Date().toISOString() });
    if (next === 'declined') restoreStock(o);
    write('orders', orders);
    emit('orders'); emit('listings');
    return clone(o);
  },
  /** 구매자: 판매자 확인 전 주문 요청 취소 */
  async cancelOrder(id) {
    const orders = read('orders', []);
    const o = orders.find((x) => x.id === id);
    if (!o || o.status !== 'requested') throw new StoreError('STATE', '판매자가 확인한 주문은 문의로 취소를 요청해 주세요.');
    o.status = 'cancelled';
    o.timeline.push({ s: 'cancelled', at: new Date().toISOString() });
    restoreStock(o);
    write('orders', orders);
    emit('orders'); emit('listings');
    return clone(o);
  },

  // 찜 / 최근 본
  async getWishlist() { return read('wish', []); },
  async toggleWish(id) {
    const w = read('wish', []);
    const has = w.includes(id);
    write('wish', has ? w.filter((x) => x !== id) : [id, ...w]);
    emit('wish');
    return !has;
  },
  async getRecent() { return read('recent', []); },
  async pushRecent(id) {
    write('recent', [id, ...read('recent', []).filter((x) => x !== id)].slice(0, 12));
  },

  // 문의 스레드
  async getThread(listingId) { return read('threads', {})[listingId] || { listingId, messages: [] }; },
  async getThreads({ as = 'buyer' } = {}) {
    const threads = Object.values(read('threads', {}));
    const mine = new Set(allListings().filter((l) => l.sellerId === ME).map((l) => l.id));
    return threads.filter((t) => (as === 'seller' ? mine.has(t.listingId) : t.messages.some((m) => m.role === 'buyer')))
      .sort((a, b) => (b.messages.at(-1)?.at || '').localeCompare(a.messages.at(-1)?.at || ''));
  },
  async sendMessage(listingId, role, text) {
    const threads = read('threads', {});
    const t = threads[listingId] || { listingId, messages: [] };
    const now = new Date().toISOString();
    t.messages.push({ role, text: String(text).slice(0, 1000), at: now });
    const l = allListings().find((x) => x.id === listingId);
    if (role === 'buyer' && l && l.sellerId !== ME && !t.messages.some((m) => m.role === 'system')) {
      t.messages.push({ role: 'system', text: '판매자에게 전달했어요. 보통 하루 안에 답변이 와요.', at: now });
    }
    t.unread = role === 'buyer' ? 'seller' : 'buyer';
    threads[listingId] = t;
    write('threads', threads);
    emit('threads');
    return t;
  },
  async markThreadRead(listingId, as) {
    const threads = read('threads', {});
    if (threads[listingId]?.unread === as) { threads[listingId].unread = null; write('threads', threads); emit('threads'); }
  },

  // 설정
  async getPrefs() { return { ...defaultPrefs(), ...read('prefs', {}) }; },
  async setPrefs(patch) {
    const p = { ...defaultPrefs(), ...read('prefs', {}), ...patch };
    write('prefs', p);
    emit('prefs');
    return p;
  },

  // 알림: 구독한 카테고리/지역의 새 상품
  async getAlertMatches() {
    const p = await this.getPrefs();
    const { cats = [], regions = [] } = p.alerts || {};
    if (!cats.length && !regions.length) return [];
    const since = new Date(p.alertsSeenAt || 0).getTime();
    return (await this.getListings())
      .filter((l) => l.sellerId !== ME && new Date(l.createdAt).getTime() > since)
      .filter((l) => (!cats.length || cats.includes(l.cat)) && (!regions.length || regions.includes(l.region)));
  },
  async markAlertsSeen() { await this.setPrefs({ alertsSeenAt: new Date().toISOString() }); },

  // 임팩트
  async getImpact() {
    const now = Date.now();
    const list = allListings().filter((l) => visible(l, now));
    let kg = 0, saved = 0;
    const farms = new Set();
    for (const l of list) {
      const sold = l.total - l.remain;
      kg += sold * (l.unitKg || 0);
      saved += sold * (l.normal - l.price);
      farms.add(l.sellerId);
    }
    return { kg, saved, co2: kg * CO2_PER_KG, farms: farms.size, live: list.filter((l) => isActive(l)).length };
  },
  async getMyImpact() {
    const orders = (await this.getOrders()).filter((o) => !['declined', 'cancelled'].includes(o.status));
    const kg = orders.reduce((s, o) => s + o.kg, 0);
    const saved = orders.reduce((s, o) => s + o.saved, 0);
    const farms = new Set(orders.map((o) => o.sellerId)).size;
    return { kg, saved, co2: kg * CO2_PER_KG, orders: orders.length, farms };
  },

  /** 판매자 통계 */
  async getSellerStats() {
    const mine = allListings().filter((l) => l.sellerId === ME);
    const orders = (await this.getOrders({ as: 'seller' }));
    const live = orders.filter((o) => !['declined', 'cancelled'].includes(o.status));
    return {
      active: mine.filter((l) => isActive(l)).length,
      closed: mine.filter((l) => !isActive(l)).length,
      pending: orders.filter((o) => o.status === 'requested').length,
      revenue: live.filter((o) => o.status !== 'requested').reduce((s, o) => s + o.subtotal, 0),
      kg: live.reduce((s, o) => s + o.kg, 0),
      expiredSoon: mine.filter((l) => isActive(l) && !isExpired(l) && new Date(l.deadline) - Date.now() < 48 * H).length,
    };
  },

  // 판매 등록 임시저장 (기기 로컬 편의 기능 — 백엔드 연결 후에도 로컬 유지 가능)
  async getDraft() { return read('draft', null); },
  async saveDraft(d) { try { write('draft', d); } catch { /* 임시저장 실패는 무시 */ } },
  async clearDraft() { try { localStorage.removeItem(NS + 'draft'); } catch {} mem.delete('draft'); },

  /** 개발/데모용 초기화 */
  async resetAll() {
    try { Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => localStorage.removeItem(k)); } catch {}
    mem.clear();
    ensureSeed();
    emit('all');
  },
};

export function shippingFee(parcelSubtotal, hasParcel) {
  if (!hasParcel) return 0;
  return parcelSubtotal >= 50000 ? 0 : 4000;
}

function ensureMySeller() {
  const sellers = read('sellers', {});
  if (!sellers[ME]) {
    sellers[ME] = { id: ME, name: '나', farm: '내 농장', story: '', rating: null, reviews: 0, since: new Date().getFullYear(), region: '', locality: '' };
    try { write('sellers', sellers); } catch {}
  }
  return clone(sellers[ME]);
}
