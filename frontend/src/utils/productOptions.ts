import type React from "react";
import type { OptionGroup } from "@/api/types";

/** Скільки порцій обрано в групі: ключ — variant_id, значення — кількість. */
export type Picks = Record<number, number>;

/**
 * Група, де вибирати нема з чого: треба взяти рівно стільки, скільки є
 * (Хенд-рол СЕТ — усі три соуси). Показуємо як склад, а не як вибір.
 */
export function isFixed(group: OptionGroup): boolean {
  return group.min_select >= group.items.length && group.max_select <= group.items.length;
}

export function unitsIn(picks: Picks): number {
  return Object.values(picks).reduce((sum, n) => sum + n, 0);
}

/**
 * Ефективні межі групи з урахуванням кількості товару в позиції: скільки
 * одиниць товару беремо (qty), стільки разів множаться ліміти й безкоштовна
 * квота. Дзеркалить бекенд (api/src/routers/cart.py): effective_min/max/free = rule * qty.
 */
export function effectiveLimits(group: OptionGroup, qty: number): { min: number; max: number; free: number } {
  return {
    min: group.min_select * qty,
    max: group.max_select * qty,
    free: group.free_count * qty,
  };
}

/**
 * Вартість опцій групи з урахуванням безкоштовної квоти, помноженої на qty.
 */
export function groupCost(group: OptionGroup, picks: Picks, qty: number): number {
  const { free } = effectiveLimits(group, qty);
  const units: number[] = [];
  for (const item of group.items) {
    const pickedQty = picks[item.variant_id] ?? 0;
    for (let i = 0; i < pickedQty; i++) units.push(item.price_delta);
  }
  return units
    .sort((a, b) => b - a)
    .slice(free)
    .reduce((sum, price) => sum + price, 0);
}

/** Підказка біля назви групи: скільки брати і що з цього безкоштовно. */
export function selectionHint(group: OptionGroup, qty: number): string {
  if (isFixed(group)) return "усе включено";

  const { min, max, free } = effectiveLimits(group, qty);

  const need =
    min === max
      ? `оберіть ${min}`
      : min === 0
        ? `до ${max}`
        : `${min}–${max}`;

  if (free === 0 || free >= max) return need;
  const freeLabel = free === 1 ? "перша безкоштовно" : `${free} безкоштовно`;
  return `${need} · ${freeLabel}`;
}

/** Спільний вигляд для «таблеток» розміру й опцій. */
export function chipStyle(active: boolean): React.CSSProperties {
  return {
    background: active ? "var(--tg-theme-button-color)" : "var(--app-surface)",
    color: active ? "var(--tg-theme-button-text-color)" : "inherit",
    boxShadow: active ? "var(--app-shadow-sm)" : undefined,
    border: active ? "1px solid transparent" : "1px solid var(--app-border)",
  };
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
 * Розраховує вартість та розбивку безкоштовних/платних одиниць для групи з урахуванням кількості товару (qty).
 * Сортує порції за ціною за спаданням: перші free порцій — БЕЗКОШТОВНІ (0 ₴).
 */
export function calculateGroupPricing(
  group: OptionGroup,
  picks: Picks,
  qty: number = 1
): GroupCalculationResult {
  const totalSelectedUnits = unitsIn(picks);
  const { min, max, free: freeQuota } = effectiveLimits(group, qty);

  const portions: { variant_id: number; price: number }[] = [];
  for (const item of group.items) {
    const count = picks[item.variant_id] || 0;
    for (let i = 0; i < count; i++) {
      portions.push({ variant_id: item.variant_id, price: item.price_delta });
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
    const priceDelta = item.price_delta;
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
      hasFreeQuotaRemaining: remainingFreeSlots > 0 || priceDelta === 0,
    };
  }

  const isValid =
    (min === 0 || totalSelectedUnits >= min) &&
    (max === 0 || totalSelectedUnits <= max);

  return {
    extraCost,
    totalSelectedUnits,
    itemsPricing,
    isValid,
  };
}

export interface RawOptionItem {
  option_group_name: string;
  option_name: string;
  price_delta: number;
  qty: number;
}

export interface OptionGroupRule {
  name?: string;
  group_name?: string;
  free_count?: number;
}

export interface OptionCostItemBreakdown {
  option_group_name: string;
  option_name: string;
  price_delta: number;
  qty: number;
  freeQty: number;
  paidQty: number;
  effectiveCost: number;
}

export interface ItemOptionsCalculation {
  totalOptionsCost: number;
  itemSubtotal: number;
  breakdown: OptionCostItemBreakdown[];
}

function roundPrice(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Розрахунок вартості додатків/опцій для позиції замовлення з урахуванням безкоштовної квоти (free_count).
 * Дзеркалить логіку бекенду (cart.py options_cost).
 */
export function calculateItemOptionsWithFreeQuota(
  options: RawOptionItem[],
  rules: OptionGroupRule[],
  itemUnitPrice: number,
  itemQty: number
): ItemOptionsCalculation {
  const groupsMap = new Map<string, RawOptionItem[]>();
  for (const opt of options) {
    const gName = opt.option_group_name.trim();
    const list = groupsMap.get(gName) || [];
    list.push(opt);
    groupsMap.set(gName, list);
  }

  let totalOptionsCost = 0;
  const breakdown: OptionCostItemBreakdown[] = [];

  for (const [groupName, groupOpts] of groupsMap.entries()) {
    const rule = rules.find(
      (r) =>
        (r.name && r.name.trim().toLowerCase() === groupName.toLowerCase()) ||
        (r.group_name && r.group_name.trim().toLowerCase() === groupName.toLowerCase())
    );

    const freeQuota = (rule?.free_count ?? 0) * itemQty;
    const sorted = [...groupOpts].sort((a, b) => b.price_delta - a.price_delta);
    let remainingFree = freeQuota;

    for (const opt of sorted) {
      const freeQty = Math.min(opt.qty, remainingFree);
      const paidQty = opt.qty - freeQty;
      remainingFree -= freeQty;

      const effectiveCost = roundPrice(paidQty * opt.price_delta);
      totalOptionsCost += effectiveCost;

      breakdown.push({
        option_group_name: opt.option_group_name,
        option_name: opt.option_name,
        price_delta: opt.price_delta,
        qty: opt.qty,
        freeQty,
        paidQty,
        effectiveCost,
      });
    }
  }

  const itemSubtotal = roundPrice(itemUnitPrice * itemQty + totalOptionsCost);

  return {
    totalOptionsCost: roundPrice(totalOptionsCost),
    itemSubtotal,
    breakdown,
  };
}

