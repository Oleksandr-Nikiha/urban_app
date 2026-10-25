import type { Cart, CartItem, CartItemOption, OptionSelection } from "@/api/types";

const GUEST_CART_STORAGE_KEY = "urban_guest_cart_v1";
export const GUEST_CART_EVENT = "urban_guest_cart_changed";

export interface AddGuestCartPayload {
  product_id: number;
  product_name: string;
  variant_id: number;
  variant_label: string;
  weight: string | null;
  price: number;
  qty: number;
  location_id: number;
  location_name: string;
  options: OptionSelection[];
  options_details: CartItemOption[];
  group_free_count?: Record<number, number>;
}

function calculateItemSubtotal(
  basePrice: number,
  qty: number,
  optionsDetails: CartItemOption[],
  groupFreeCount: Record<number, number> = {},
): number {
  // Базова вартість варіанта
  let optionsTotal = 0;

  // Групуємо опції по group_id для застосування безкоштовної квоти (free_count * qty)
  const byGroup = new Map<number, CartItemOption[]>();
  for (const opt of optionsDetails) {
    const list = byGroup.get(opt.group_id) ?? [];
    list.push(opt);
    byGroup.set(opt.group_id, list);
  }

  for (const [groupId, items] of byGroup.entries()) {
    const freeQuota = (groupFreeCount[groupId] ?? 0) * qty;
    const unitPrices: number[] = [];
    for (const it of items) {
      for (let i = 0; i < it.qty; i++) {
        unitPrices.push(it.price_delta);
      }
    }
    // Сортуємо за спаданням — найдорожчі покриває квота
    const chargeable = unitPrices.sort((a, b) => b - a).slice(freeQuota);
    optionsTotal += chargeable.reduce((sum, p) => sum + p, 0);
  }

  const subtotal = basePrice * qty + optionsTotal;
  return Math.round(subtotal * 100) / 100;
}

function calculateCartTotal(items: CartItem[]): number {
  const sum = items.reduce((acc, it) => acc + it.subtotal, 0);
  return Math.round(sum * 100) / 100;
}

export function getGuestCart(): Cart {
  if (typeof window === "undefined") {
    return { items: [], total: 0 };
  }
  try {
    const raw = localStorage.getItem(GUEST_CART_STORAGE_KEY);
    if (!raw) return { items: [], total: 0 };
    const parsed = JSON.parse(raw) as Cart;
    if (!Array.isArray(parsed.items)) return { items: [], total: 0 };
    return {
      items: parsed.items,
      total: calculateCartTotal(parsed.items),
    };
  } catch {
    return { items: [], total: 0 };
  }
}

export function saveGuestCart(cart: Cart): void {
  if (typeof window === "undefined") return;
  try {
    cart.total = calculateCartTotal(cart.items);
    localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(cart));
    window.dispatchEvent(new CustomEvent(GUEST_CART_EVENT, { detail: cart }));
  } catch {
    // ігноруємо помилки квоти localStorage
  }
}

function buildOptionsKey(options: OptionSelection[], itemQty: number = 1): string {
  const safeQty = Math.max(1, itemQty);
  return [...options]
    .sort((a, b) => a.group_id - b.group_id || a.variant_id - b.variant_id)
    .map((o) => {
      const unitQty = o.qty % safeQty === 0 ? Math.floor(o.qty / safeQty) : o.qty;
      return `${o.group_id}:${o.variant_id}:${unitQty}`;
    })
    .join("|");
}

function getGroupFreeCount(item: CartItem): Record<number, number> {
  if (item.group_free_count && Object.keys(item.group_free_count).length > 0) {
    return item.group_free_count;
  }
  const inferred: Record<number, number> = {};
  if (!item.options || item.options.length === 0 || !item.qty) {
    return inferred;
  }
  const byGroup = new Map<number, number>();
  for (const opt of item.options) {
    byGroup.set(opt.group_id, (byGroup.get(opt.group_id) ?? 0) + opt.qty);
  }
  const optionsCharged = Math.max(0, item.subtotal - item.price * item.qty);
  if (optionsCharged === 0) {
    for (const [groupId, count] of byGroup.entries()) {
      inferred[groupId] = Math.round(count / item.qty);
    }
  }
  return inferred;
}

export function addGuestItem(payload: AddGuestCartPayload): Cart {
  const cart = getGuestCart();
  const optionsKey = buildOptionsKey(payload.options, payload.qty);

  // Шукаємо, чи є вже такий самий товар із такими ж опціями
  const existingIdx = cart.items.findIndex(
    (it) =>
      it.product_id === payload.product_id &&
      it.variant_label === payload.variant_label &&
      buildOptionsKey(
        it.options.map((o) => ({ group_id: o.group_id, variant_id: o.variant_id, qty: o.qty })),
        it.qty,
      ) === optionsKey,
  );

  const subtotal = calculateItemSubtotal(
    payload.price,
    payload.qty,
    payload.options_details,
    payload.group_free_count ?? {},
  );

  if (existingIdx >= 0) {
    const existing = cart.items[existingIdx];
    const newQty = existing.qty + payload.qty;
    existing.qty = newQty;
    // Оновлюємо кількість усередині опцій
    existing.options = existing.options.map((opt) => ({
      ...opt,
      qty: opt.qty > 0 ? (opt.qty / (existing.qty - payload.qty)) * newQty : 0,
    }));
    if (payload.group_free_count) {
      existing.group_free_count = {
        ...existing.group_free_count,
        ...payload.group_free_count,
      };
    }
    existing.subtotal = calculateItemSubtotal(
      existing.price,
      newQty,
      existing.options,
      getGroupFreeCount(existing),
    );
  } else {
    const newItem: CartItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      product_id: payload.product_id,
      variant_id: payload.variant_id,
      product_name: payload.product_name,
      variant_label: payload.variant_label,
      weight: payload.weight,
      price: payload.price,
      qty: payload.qty,
      subtotal,
      location_id: payload.location_id,
      location_name: payload.location_name,
      options: payload.options_details,
      group_free_count: payload.group_free_count,
    };
    cart.items.push(newItem);
  }

  saveGuestCart(cart);
  return cart;
}

export interface UpdateGuestCartPayload {
  variant_id?: number;
  variant_label?: string;
  weight?: string | null;
  price?: number;
  qty?: number;
  options?: OptionSelection[];
  options_details?: CartItemOption[];
  group_free_count?: Record<number, number>;
}

export function updateGuestItem(itemId: number, payload: UpdateGuestCartPayload): Cart {
  const cart = getGuestCart();
  const itemIdx = cart.items.findIndex((it) => it.id === itemId);
  if (itemIdx === -1) return cart;

  const current = cart.items[itemIdx];

  // Якщо оновлюються лише кількість без опцій — використовуємо updateGuestItemQty
  if (payload.options_details === undefined && payload.options === undefined) {
    if (payload.qty !== undefined) {
      return updateGuestItemQty(itemId, payload.qty);
    }
    return cart;
  }

  const newVariantLabel = payload.variant_label ?? current.variant_label;
  const newWeight = payload.weight !== undefined ? payload.weight : current.weight;
  const newPrice = payload.price ?? current.price;
  const newQty = payload.qty ?? current.qty;
  const newOptions = payload.options_details ?? current.options;

  const optionsKey = buildOptionsKey(
    newOptions.map((o) => ({ group_id: o.group_id, variant_id: o.variant_id, qty: o.qty })),
    newQty,
  );

  // Перевіряємо, чи є інша позиція з таким же товаром і опціями для злиття
  const otherIdx = cart.items.findIndex(
    (it) =>
      it.id !== itemId &&
      it.product_id === current.product_id &&
      it.variant_label === newVariantLabel &&
      buildOptionsKey(
        it.options.map((o) => ({ group_id: o.group_id, variant_id: o.variant_id, qty: o.qty })),
        it.qty,
      ) === optionsKey,
  );

  if (otherIdx >= 0) {
    const other = cart.items[otherIdx];
    const mergedQty = other.qty + newQty;
    other.qty = mergedQty;
    other.options = other.options.map((opt) => {
      const match = newOptions.find((no) => no.group_id === opt.group_id && no.variant_id === opt.variant_id);
      return {
        ...opt,
        qty: opt.qty + (match ? match.qty : 0),
      };
    });
    if (payload.group_free_count) {
      other.group_free_count = {
        ...other.group_free_count,
        ...payload.group_free_count,
      };
    }
    other.subtotal = calculateItemSubtotal(other.price, mergedQty, other.options, getGroupFreeCount(other));
    cart.items.splice(itemIdx, 1);
  } else {
    current.variant_label = newVariantLabel;
    current.weight = newWeight;
    current.price = newPrice;
    current.qty = newQty;
    current.options = newOptions;
    if (payload.group_free_count) {
      current.group_free_count = payload.group_free_count;
    }
    current.subtotal = calculateItemSubtotal(newPrice, newQty, newOptions, getGroupFreeCount(current));
  }

  saveGuestCart(cart);
  return cart;
}

export function updateGuestItemQty(itemId: number, newQty: number): Cart {
  const cart = getGuestCart();
  const item = cart.items.find((it) => it.id === itemId);
  if (item && newQty > 0) {
    const ratio = newQty / item.qty;
    item.qty = newQty;
    // Масштабуємо порції опцій
    item.options = item.options.map((opt) => ({
      ...opt,
      qty: Math.max(1, Math.round(opt.qty * ratio)),
    }));
    const groupFreeCount = getGroupFreeCount(item);
    item.subtotal = calculateItemSubtotal(item.price, newQty, item.options, groupFreeCount);
    saveGuestCart(cart);
  }
  return cart;
}

export function removeGuestItem(itemId: number): Cart {
  const cart = getGuestCart();
  cart.items = cart.items.filter((it) => it.id !== itemId);
  saveGuestCart(cart);
  return cart;
}

export function clearGuestCart(): Cart {
  const cart: Cart = { items: [], total: 0 };
  saveGuestCart(cart);
  return cart;
}
