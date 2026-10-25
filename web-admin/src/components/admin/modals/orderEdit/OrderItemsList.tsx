import { formatPrice } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import { calculateItemOptionsWithFreeQuota } from "@/utils/productOptions";
import type { AdminProduct, AdminVariant } from "@/api/types";
import type { OrderItemDraft } from "../AddOptionToItemModal";

interface OrderItemsListProps {
  items: OrderItemDraft[];
  adminProducts: AdminProduct[];
  onUpdateItemQty: (idx: number, delta: number) => void;
  onRemoveItem: (idx: number) => void;
  onUpdateOptionQty: (
    itemIdx: number,
    groupName: string,
    optName: string,
    delta: number
  ) => void;
  onRemoveOption: (itemIdx: number, groupName: string, optName: string) => void;
  onOpenAddOption: (idx: number) => void;
  onOpenAddDish: () => void;
}

export function OrderItemsList({
  items,
  adminProducts,
  onUpdateItemQty,
  onRemoveItem,
  onUpdateOptionQty,
  onRemoveOption,
  onOpenAddOption,
  onOpenAddDish,
}: OrderItemsListProps) {
  const getProductForDraft = (it: OrderItemDraft) => {
    return adminProducts.find(
      (p) =>
        (it.product_id && p.id === it.product_id) ||
        (it.variant_id && p.variants.some((v: AdminVariant) => v.id === it.variant_id)) ||
        p.name.toLowerCase() === it.product_name.toLowerCase()
    );
  };

  const getOptionRulesForDraft = (it: OrderItemDraft) => {
    const prod = getProductForDraft(it);
    return prod?.option_groups ?? [];
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider opacity-70">
          Позиції замовлення ({items.length})
        </h4>
        <button
          onClick={() => {
            haptic("light");
            onOpenAddDish();
          }}
          className="app-press rounded-xl px-2.5 py-1 text-xs font-semibold"
          style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
        >
          + Додати страву
        </button>
      </div>

      <div className="space-y-2.5">
        {items.map((it, idx) => {
          const rules = getOptionRulesForDraft(it);
          const calc = calculateItemOptionsWithFreeQuota(
            it.options,
            rules,
            it.unit_price,
            it.qty
          );

          return (
            <div
              key={idx}
              className="rounded-2xl p-3 border space-y-2 text-xs"
              style={{ borderColor: "var(--app-border)", background: "var(--app-surface-2)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-bold">{it.product_name}</p>
                  <p className="opacity-60 text-[11px]">
                    {it.variant_label} • {formatPrice(it.unit_price)}/шт
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg bg-black/10 px-2 py-0.5">
                    <button
                      onClick={() => {
                        haptic("light");
                        onUpdateItemQty(idx, -1);
                      }}
                      className="font-bold px-1"
                    >
                      -
                    </button>
                    <span className="font-bold px-1">{it.qty}</span>
                    <button
                      onClick={() => {
                        haptic("light");
                        onUpdateItemQty(idx, 1);
                      }}
                      className="font-bold px-1"
                    >
                      +
                    </button>
                  </div>

                  <span className="font-bold min-w-[65px] text-right">
                    {formatPrice(calc.itemSubtotal)}
                  </span>

                  <button
                    onClick={() => {
                      haptic("light");
                      onRemoveItem(idx);
                    }}
                    className="text-red-500 opacity-60 hover:opacity-100 p-1"
                    title="Видалити"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Додатки до цієї страви */}
              {calc.breakdown.length > 0 && (
                <div
                  className="space-y-1.5 pl-2.5 border-l-2 py-0.5"
                  style={{ borderColor: "var(--tg-theme-button-color)" }}
                >
                  {calc.breakdown.map((b, bIdx) => (
                    <div
                      key={bIdx}
                      className="flex items-center justify-between text-[11px] opacity-80"
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="truncate">
                          ↳ <b>{b.option_name}</b> {b.qty > 1 ? `×${b.qty}` : ""}
                          {b.freeQty > 0 && b.paidQty === 0 && (
                            <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              (включено, 0 ₴)
                            </span>
                          )}
                          {b.freeQty > 0 && b.paidQty > 0 && (
                            <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                              ({b.freeQty} включено, {b.paidQty} платно)
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-semibold text-right min-w-[45px]">
                          {b.effectiveCost > 0 ? `+${formatPrice(b.effectiveCost)}` : "0 ₴"}
                        </span>

                        <div className="flex items-center gap-1 rounded bg-black/5 dark:bg-white/10 px-1 py-0.5">
                          <button
                            type="button"
                            onClick={() => {
                              haptic("light");
                              onUpdateOptionQty(
                                idx,
                                b.option_group_name,
                                b.option_name,
                                -1
                              );
                            }}
                            className="px-1 font-bold text-xs hover:text-red-500"
                            title="Зменшити кількість"
                          >
                            -
                          </button>
                          <span className="font-bold text-[10px] px-0.5">{b.qty}</span>
                          <button
                            type="button"
                            onClick={() => {
                              haptic("light");
                              onUpdateOptionQty(
                                idx,
                                b.option_group_name,
                                b.option_name,
                                1
                              );
                            }}
                            className="px-1 font-bold text-xs hover:text-emerald-500"
                            title="Збільшити кількість"
                          >
                            +
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            haptic("light");
                            onRemoveOption(idx, b.option_group_name, b.option_name);
                          }}
                          className="text-red-500 opacity-60 hover:opacity-100 px-1"
                          title="Видалити додаток"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={() => {
                  haptic("light");
                  onOpenAddOption(idx);
                }}
                className="text-[11px] font-semibold opacity-75 hover:opacity-100 text-blue-500 inline-flex items-center gap-1"
              >
                <span>+ Додати опцію / соус до страви</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
