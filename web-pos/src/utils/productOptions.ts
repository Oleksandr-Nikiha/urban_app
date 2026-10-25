export interface BaseOptionItem {
  id?: number;
  variant_id: number;
  name: string;
  price_delta?: number;
  price?: number;
}

export interface BaseOptionGroup {
  group_id: number;
  name: string;
  min_select: number;
  max_select: number;
  free_count: number;
  items: BaseOptionItem[];
}

export type PicksMap = Record<number, number>;

/**
 * Чи є група фіксованим складом страви (без вибору):
 * коли min_select >= items.length та max_select <= items.length
 */
export function isFixedGroup(group: BaseOptionGroup): boolean {
  return group.min_select >= group.items.length && group.max_select <= group.items.length;
}

/** Загальна кількість одиниць опцій, обраних у групі */
export function countGroupUnits(picks: PicksMap): number {
  return Object.values(picks).reduce((sum, n) => sum + (n || 0), 0);
}

/**
 * Ефективні ліміти групи:
 * min, max та free_count з урахуванням кількості товару (за замовчуванням 1).
 */
export function getEffectiveLimits(group: BaseOptionGroup, qty: number = 1): {
  min: number;
  max: number;
  free: number;
} {
  const safeQty = Math.max(1, qty);
  return {
    min: group.min_select * safeQty,
    max: group.max_select * safeQty,
    free: group.free_count * safeQty,
  };
}

/**
 * Початковий вибір опцій за замовчуванням (Default selection):
 * 1. Якщо група фіксована (набір/склад) — обираються всі позиції по 1 шт.
 * 2. Якщо група має free_count > 0 і в ній лише 1 позиція (напр. Васабі, Імбир, Соєвий соус) —
 *    автоматично обирається ця позиція у кількості free_count.
 * 3. Якщо обов'язковий вибір 1 з 1 (min_select == 1 && max_select == 1) і є хоча б 1 позиція —
 *    обирається перша позиція (qty = 1).
 */
export function getInitialGroupPicks(group: BaseOptionGroup): PicksMap {
  if (isFixedGroup(group)) {
    return Object.fromEntries(group.items.map((i) => [i.variant_id, 1]));
  }
  if (group.items.length === 1 && group.free_count > 0) {
    const qty = Math.min(group.free_count, group.max_select || group.free_count);
    return { [group.items[0].variant_id]: qty };
  }
  if (group.min_select === 1 && group.max_select === 1 && group.items.length > 0) {
    return { [group.items[0].variant_id]: 1 };
  }
  return {};
}

/** Підказка біля назви групи (єдина для всіх каналів) */
export function getSelectionHint(group: BaseOptionGroup): string {
  if (isFixedGroup(group)) return "усе включено";

  const { min_select: min, max_select: max, free_count: free } = group;

  const need =
    min === max
      ? `оберіть ${min}`
      : min === 0
      ? `до ${max}`
      : `${min}–${max}`;

  if (free === 0) return need;
  const freeLabel = free === 1 ? "1 безкоштовно" : `${free} безкоштовно`;
  return `${need} · ${freeLabel}`;
}

export interface GroupOptionItemPricing {
  variant_id: number;
  name: string;
  price_delta: number;
  selectedQty: number;
  freeQty: number;
  paidQty: number;
  effectiveCost: number;
  isFullyFree: boolean;
  hasFreeQuotaRemaining: boolean;
}

export interface GroupCalculationResult {
  extraCost: number;
  totalSelectedUnits: number;
  itemsPricing: Record<number, GroupOptionItemPricing>;
  isValid: boolean;
}

/**
 * Розраховує вартість та розбивку безкоштовних/платних одиниць для групи.
 * Сортує порції за ціною за спаданням: перші free_count порцій — БЕЗКОШТОВНІ (0 ₴).
 */
export function calculateGroupPricing(
  group: BaseOptionGroup,
  picks: PicksMap
): GroupCalculationResult {
  const totalSelectedUnits = countGroupUnits(picks);
  const freeQuota = group.free_count;

  // Збираємо всі обрані одиниці
  const portions: { variant_id: number; price: number }[] = [];
  for (const item of group.items) {
    const p = item.price_delta !== undefined ? item.price_delta : (item.price || 0);
    const count = picks[item.variant_id] || 0;
    for (let i = 0; i < count; i++) {
      portions.push({ variant_id: item.variant_id, price: p });
    }
  }

  // Сортуємо найдорожчі першими для максимальної вигоди клієнта
  portions.sort((a, b) => b.price - a.price);

  const freePortions = portions.slice(0, freeQuota);
  const paidPortions = portions.slice(freeQuota);

  const freeCountByVid: Record<number, number> = {};
  for (const p of freePortions) {
    freeCountByVid[p.variant_id] = (freeCountByVid[p.variant_id] || 0) + 1;
  }

  const paidCountByVid: Record<number, number> = {};
  for (const p of paidPortions) {
    paidCountByVid[p.variant_id] = (paidCountByVid[p.variant_id] || 0) + 1;
  }

  const extraCost = paidPortions.reduce((sum, p) => sum + p.price, 0);

  const itemsPricing: Record<number, GroupOptionItemPricing> = {};
  const remainingFreeSlots = Math.max(0, freeQuota - totalSelectedUnits);

  for (const item of group.items) {
    const vid = item.variant_id;
    const priceDelta = item.price_delta !== undefined ? item.price_delta : (item.price || 0);
    const selectedQty = picks[vid] || 0;
    const freeQty = freeCountByVid[vid] || 0;
    const paidQty = paidCountByVid[vid] || 0;
    const effectiveCost = paidQty * priceDelta;

    itemsPricing[vid] = {
      variant_id: vid,
      name: item.name,
      price_delta: priceDelta,
      selectedQty,
      freeQty,
      paidQty,
      effectiveCost,
      isFullyFree: selectedQty > 0 && paidQty === 0,
      hasFreeQuotaRemaining: remainingFreeSlots > 0 || (priceDelta === 0),
    };
  }

  const isValid =
    (group.min_select === 0 || totalSelectedUnits >= group.min_select) &&
    totalSelectedUnits <= group.max_select;

  return {
    extraCost,
    totalSelectedUnits,
    itemsPricing,
    isValid,
  };
}
