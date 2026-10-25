import type { OptionGroup } from "@/api/types";
import { formatPrice } from "@/components/ui";
import {
  calculateGroupPricing,
  chipStyle,
  effectiveLimits,
  isFixed,
  selectionHint,
  unitsIn,
  type Picks,
} from "@/utils/productOptions";

interface ProductOptionGroupsProps {
  optionGroups: OptionGroup[];
  qty: number;
  showErrors: boolean;
  picksFor: (group: OptionGroup) => Picks;
  onPickOne: (group: OptionGroup, variantId: number) => void;
  onChangeQty: (group: OptionGroup, variantId: number, delta: number) => void;
}

export function ProductOptionGroups({
  optionGroups,
  qty,
  showErrors,
  picksFor,
  onPickOne,
  onChangeQty,
}: ProductOptionGroupsProps) {
  return (
    <>
      {optionGroups.map((group) => {
        const picks = picksFor(group);
        const fixed = isFixed(group);
        const { min: effMin, max: effMax } = effectiveLimits(group, qty);
        const multi = !fixed && effMax > 1;
        const currentUnits = unitsIn(picks);
        const isUnfilled = !fixed && currentUnits < effMin;
        const isFilled = !fixed && effMin > 0 && currentUnits >= effMin;
        const isUrgentNotice = isUnfilled && showErrors;
        const groupPricing = calculateGroupPricing(group, picks, qty);

        return (
          <div
            key={group.group_id}
            className={`app-rise rounded-2xl transition-all p-3.5 mt-4 ${
              isUrgentNotice
                ? "ring-2 ring-amber-500/50"
                : ""
            }`}
            style={{
              background: isUrgentNotice
                ? "color-mix(in srgb, #f59e0b 8%, var(--app-surface))"
                : "var(--app-surface)",
              border: isUrgentNotice
                ? "1px solid color-mix(in srgb, #f59e0b 40%, transparent)"
                : "1px solid var(--app-border)",
              boxShadow: "var(--app-shadow-sm)",
            }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <p className="text-sm font-bold tracking-tight">{group.name}</p>
                {!fixed && isFilled ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide inline-flex items-center gap-1 shrink-0"
                    style={{
                      background: "color-mix(in srgb, #22c55e 14%, transparent)",
                      color: "#22c55e",
                    }}
                  >
                    ✓ Обрано
                  </span>
                ) : !fixed && isUrgentNotice ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shrink-0"
                    style={{
                      background: "color-mix(in srgb, #f59e0b 20%, transparent)",
                      color: "#d97706",
                    }}
                  >
                    Оберіть варіант
                  </span>
                ) : !fixed && effMin > 0 ? (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shrink-0"
                    style={{
                      background: "var(--app-tint)",
                      color: "var(--tg-theme-button-color)",
                    }}
                  >
                    Обов'язково
                  </span>
                ) : null}
              </div>
              <p className="shrink-0 text-xs opacity-60">
                {selectionHint(group, qty)}
              </p>
            </div>

            {multi ? (
              <div className="space-y-2">
                {group.items.map((item) => {
                  const count = picks[item.variant_id] ?? 0;
                  const itemPricing = groupPricing.itemsPricing[item.variant_id];
                  return (
                    <div
                      key={item.variant_id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 transition-all"
                      style={{
                        background: count > 0 ? "var(--app-surface-2)" : "transparent",
                        border: "1px solid var(--app-border)",
                      }}
                    >
                      <span className={`flex-1 text-sm ${count ? "font-semibold" : ""}`}>
                        {item.name}
                      </span>
                      {itemPricing?.isFullyFree ? (
                        <span className="text-xs font-bold text-emerald-500">
                          Безкоштовно
                        </span>
                      ) : itemPricing && itemPricing.selectedQty > 0 && itemPricing.paidQty > 0 && itemPricing.freeQty > 0 ? (
                        <span className="text-xs font-medium opacity-75">
                          +{formatPrice(itemPricing.effectiveCost)}
                        </span>
                      ) : itemPricing?.hasFreeQuotaRemaining && item.price_delta > 0 ? (
                        <span className="text-xs font-semibold text-emerald-500">
                          0 ₴ (включено)
                        </span>
                      ) : item.price_delta > 0 ? (
                        <span className="text-xs font-medium opacity-65">
                          +{formatPrice(item.price_delta)}
                        </span>
                      ) : null}
                      <div
                        className="flex items-center gap-1.5 rounded-lg px-1 py-0.5"
                        style={{ background: "var(--app-surface-2)" }}
                      >
                        <button
                          onClick={() => onChangeQty(group, item.variant_id, -1)}
                          disabled={count === 0}
                          aria-label={`Менше: ${item.name}`}
                          className="app-press h-7 w-7 text-base font-bold disabled:opacity-20 flex items-center justify-center rounded-lg"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-xs font-bold">{count}</span>
                        <button
                          onClick={() => onChangeQty(group, item.variant_id, 1)}
                          className="app-press h-7 w-7 text-base font-bold flex items-center justify-center rounded-lg"
                          aria-label={`Більше: ${item.name}`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                {group.items.map((item) => {
                  const active = Boolean(picks[item.variant_id]);
                  const itemPricing = groupPricing.itemsPricing[item.variant_id];
                  return (
                    <button
                      key={item.variant_id}
                      disabled={fixed}
                      onClick={() => onPickOne(group, item.variant_id)}
                      className={`inline-flex items-center justify-center rounded-xl px-3.5 py-2 text-xs font-semibold disabled:opacity-100 transition-all ${
                        fixed ? "" : "app-press"
                      }`}
                      style={chipStyle(active)}
                    >
                      {active && (
                        <span className="app-pop mr-1.5 inline-block text-[11px]" aria-hidden>
                          ✓
                        </span>
                      )}
                      <span>{item.name}</span>
                      {active && itemPricing?.isFullyFree ? (
                        <span className="ml-2 text-[11px] font-bold text-emerald-400">
                          (включено)
                        </span>
                      ) : !active && itemPricing?.hasFreeQuotaRemaining && item.price_delta > 0 ? (
                        <span className="ml-2 text-[11px] font-bold text-emerald-500">
                          0 ₴
                        </span>
                      ) : item.price_delta > 0 ? (
                        <span className="ml-2 opacity-75">+{formatPrice(item.price_delta)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
