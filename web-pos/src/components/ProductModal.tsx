import { useState } from "react";
import { DEFAULT_PRODUCT_IMAGE, getImageUrl } from "../api/client";
import type { CartItemOption, OptionGroup, OptionItem, Product, ProductVariant } from "../types";
import {
  calculateGroupPricing,
  countGroupUnits,
  getInitialGroupPicks,
  getSelectionHint,
  isFixedGroup,
  type GroupCalculationResult,
  type PicksMap,
} from "../utils/productOptions";

interface ProductModalProps {
  product: Product;
  onClose: () => void;
  onAddToCart: (
    product: Product,
    variant: ProductVariant,
    selectedOptions: CartItemOption[],
    qty: number,
    comment?: string
  ) => void;
}

export function ProductModal({ product, onClose, onAddToCart }: ProductModalProps) {
  // Default to first variant
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant>(
    product.variants[0] || {
      id: 0,
      product_id: product.id,
      label: "Стандарт",
      price: 0,
      weight: null,
      is_available: true,
      sort_order: 1,
    }
  );

  // Єдиний початковий вибір опцій для всіх груп
  const [picks, setPicks] = useState<Record<number, PicksMap>>(() => {
    const initial: Record<number, PicksMap> = {};
    if (product.option_groups) {
      for (const group of product.option_groups) {
        initial[group.group_id] = getInitialGroupPicks(group);
      }
    }
    return initial;
  });

  const [qty, setQty] = useState(1);
  const [comment, setComment] = useState("");
  const [showValidation, setShowValidation] = useState(false);

  // Розрахунок вартості опцій за єдиною формулою
  let extraOptionsCostPerUnit = 0;
  const groupCalculations: Record<number, GroupCalculationResult> = {};
  if (product.option_groups) {
    for (const group of product.option_groups) {
      const gCalc = calculateGroupPricing(group, picks[group.group_id] || {});
      groupCalculations[group.group_id] = gCalc;
      extraOptionsCostPerUnit += gCalc.extraCost;
    }
  }

  const unitPrice = selectedVariant.price + extraOptionsCostPerUnit;
  const totalPrice = unitPrice * qty;

  const unfilledGroups = (product.option_groups || []).filter(
    (g) => !(groupCalculations[g.group_id]?.isValid ?? true)
  );
  const canAddToCart = unfilledGroups.length === 0;

  const handleToggleSingle = (group: OptionGroup, item: OptionItem) => {
    setShowValidation(false);
    const currentPicks = picks[group.group_id] || {};
    const isSelected = (currentPicks[item.variant_id] || 0) > 0;

    if (isSelected && group.min_select >= 1) {
      return;
    }

    setPicks((prev) => ({
      ...prev,
      [group.group_id]: isSelected ? {} : { [item.variant_id]: 1 },
    }));
  };

  const handleChangeOptionCount = (
    group: OptionGroup,
    item: OptionItem,
    delta: number
  ) => {
    setShowValidation(false);
    const currentPicks = picks[group.group_id] || {};
    const currentUnits = countGroupUnits(currentPicks);

    if (delta > 0 && currentUnits >= group.max_select) {
      return;
    }

    const currentCount = currentPicks[item.variant_id] || 0;
    const newCount = currentCount + delta;
    const next = { ...currentPicks };

    if (newCount <= 0) {
      delete next[item.variant_id];
    } else {
      next[item.variant_id] = newCount;
    }

    setPicks((prev) => ({ ...prev, [group.group_id]: next }));
  };

  const handleAdd = () => {
    if (!canAddToCart) {
      setShowValidation(true);
      return;
    }

    const selectedOptions: CartItemOption[] = [];
    if (product.option_groups) {
      for (const group of product.option_groups) {
        const gPicks = picks[group.group_id] || {};
        for (const item of group.items) {
          const count = gPicks[item.variant_id] || 0;
          if (count > 0) {
            selectedOptions.push({
              option_item_id: item.id || item.variant_id,
              variant_id: item.variant_id,
              name: item.name,
              price: item.price !== undefined ? item.price : 0,
              qty: count,
              group_id: group.group_id,
              group_name: group.name,
            });
          }
        }
      }
    }

    onAddToCart(product, selectedVariant, selectedOptions, qty, comment.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
      <div className="w-full max-w-lg bg-[#13171F] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-slide-up sm:animate-none">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-start justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <img
              src={getImageUrl(product.image_url)}
              alt={product.name}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl object-cover bg-black/40 border border-white/5"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
              }}
            />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-tight">
                {product.name}
              </h2>
              {product.description && (
                <p className="text-[11px] sm:text-xs text-zinc-400 line-clamp-1 mt-0.5">
                  {product.description}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5 flex-1">
          {/* Валідаційне попередження, якщо обов'язкові додатки не обрано */}
          {showValidation && unfilledGroups.length > 0 && (
            <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2 animate-in fade-in">
              <span>⚠️</span>
              <span>
                Оберіть обов'язкові додатки у групі:{" "}
                <strong>{unfilledGroups.map((g) => g.name).join(", ")}</strong>
              </span>
            </div>
          )}

          {/* Variants / Sizes */}
          {product.variants.length > 1 && (
            <div>
              <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                Оберіть розмір / варіант
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                {product.variants.map((v) => {
                  const isSelected = selectedVariant.id === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setSelectedVariant(v)}
                      className={`p-2.5 sm:p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? "bg-amber-500/15 border-amber-500 text-white shadow-md shadow-amber-500/10"
                          : "bg-[#1A1F2B] border-white/5 text-zinc-300 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="font-bold text-xs sm:text-sm">{v.label}</span>
                        <span className="font-extrabold text-amber-400 text-xs sm:text-sm">
                          {v.price} ₴
                        </span>
                      </div>
                      {v.weight && (
                        <span className="text-[10px] sm:text-[11px] text-zinc-400 mt-1">
                          {v.weight}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Option Groups (Modifiers, Sauces, Extras) */}
          {product.option_groups && product.option_groups.length > 0 && (
            <div className="space-y-4">
              {product.option_groups.map((group) => {
                const isFixed = isFixedGroup(group);
                const isMulti = !isFixed && group.max_select > 1;
                const gCalc = groupCalculations[group.group_id] || {
                  extraCost: 0,
                  totalSelectedUnits: 0,
                  itemsPricing: {},
                  isValid: true,
                };
                const totalUnits = gCalc.totalSelectedUnits;
                const isUnfilled = showValidation && !gCalc.isValid;

                return (
                  <div
                    key={group.group_id}
                    className={`pt-2 border-t space-y-2 transition-all ${
                      isUnfilled
                        ? "border-amber-500/50 bg-amber-500/5 -mx-2 px-2 rounded-2xl"
                        : "border-white/5"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <label className="text-xs font-bold text-white uppercase tracking-wider">
                          {group.name}
                        </label>
                        {group.free_count > 0 && (
                          <span className="text-[10px] text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-full font-bold border border-emerald-500/30">
                            {group.free_count} безкоштовно
                          </span>
                        )}
                        {!isFixed && group.min_select > 0 && (
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                              totalUnits >= group.min_select
                                ? "text-emerald-400 bg-emerald-500/10"
                                : "text-amber-400 bg-amber-500/10 border border-amber-500/30"
                            }`}
                          >
                            {totalUnits >= group.min_select ? "✓ Обрано" : "Обов'язково"}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {getSelectionHint(group)}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {group.items.map((opt) => {
                        const itemPricing = gCalc.itemsPricing[opt.variant_id] || {
                          variant_id: opt.variant_id,
                          name: opt.name,
                          price_delta: opt.price !== undefined ? opt.price : 0,
                          selectedQty: 0,
                          freeQty: 0,
                          paidQty: 0,
                          effectiveCost: 0,
                          isFullyFree: false,
                          hasFreeQuotaRemaining: false,
                        };
                        const count = itemPricing.selectedQty;
                        const isChecked = count > 0;
                        const optPrice = opt.price !== undefined ? opt.price : 0;

                        if (isMulti) {
                          return (
                            <div
                              key={opt.variant_id}
                              className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                                isChecked
                                  ? "bg-amber-500/15 border-amber-500 text-white shadow-sm"
                                  : "bg-[#1A1F2B] border-white/5 text-zinc-300 hover:border-white/15"
                              }`}
                            >
                              <div className="flex-1 pr-2">
                                <div className="flex items-center space-x-2">
                                  <span className="font-bold text-xs">{opt.name}</span>
                                  {/* Відображення ціни або безкоштовної квоти */}
                                  {count > 0 ? (
                                    itemPricing.isFullyFree ? (
                                      <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold">
                                        Безкоштовно
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-amber-400 font-bold">
                                        +{itemPricing.effectiveCost} ₴
                                        {itemPricing.freeQty > 0 && (
                                          <span className="text-zinc-400 font-normal ml-1">
                                            ({itemPricing.freeQty} б/к)
                                          </span>
                                        )}
                                      </span>
                                    )
                                  ) : itemPricing.hasFreeQuotaRemaining ? (
                                    <span className="text-[10px] text-emerald-400/80 font-semibold">
                                      0 ₴ (включено)
                                    </span>
                                  ) : optPrice > 0 ? (
                                    <span className="text-[10px] text-zinc-400 font-semibold">
                                      +{optPrice} ₴
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {/* Controls: Stepper */}
                              <div className="flex items-center space-x-1.5 bg-[#0B0D11] rounded-xl p-1 border border-white/5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleChangeOptionCount(group, opt, -1)}
                                  disabled={count === 0}
                                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 active:scale-95 text-xs font-black text-white flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  −
                                </button>
                                <span className={`w-5 text-center text-xs font-extrabold ${count > 0 ? "text-amber-400" : "text-zinc-500"}`}>
                                  {count}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleChangeOptionCount(group, opt, 1)}
                                  disabled={totalUnits >= group.max_select}
                                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-20 active:scale-95 text-xs font-black text-white flex items-center justify-center cursor-pointer transition-colors"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // Single selection
                        return (
                          <div
                            key={opt.variant_id}
                            onClick={() => !isFixed && handleToggleSingle(group, opt)}
                            className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer ${
                              isChecked
                                ? "bg-amber-500/15 border-amber-500 text-white shadow-sm"
                                : "bg-[#1A1F2B] border-white/5 text-zinc-300 hover:border-white/15"
                            }`}
                          >
                            <div className="flex-1 pr-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs">{opt.name}</span>
                                {isChecked ? (
                                  itemPricing.isFullyFree ? (
                                    <span className="text-[10px] text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md font-bold">
                                      Безкоштовно
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-amber-400 font-bold">
                                      +{itemPricing.effectiveCost} ₴
                                    </span>
                                  )
                                ) : itemPricing.hasFreeQuotaRemaining ? (
                                  <span className="text-[10px] text-emerald-400/80 font-semibold">
                                    0 ₴ (включено)
                                  </span>
                                ) : optPrice > 0 ? (
                                  <span className="text-[10px] text-zinc-400 font-semibold">
                                    +{optPrice} ₴
                                  </span>
                                ) : null}
                              </div>
                            </div>

                            <button
                              type="button"
                              disabled={isFixed}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isFixed) handleToggleSingle(group, opt);
                              }}
                              className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs cursor-pointer ${
                                isChecked
                                  ? "bg-amber-500 border-amber-500 text-black font-extrabold"
                                  : "border-white/20 text-transparent"
                              }`}
                            >
                              ✓
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Comment / Note for Kitchen */}
          <div className="pt-2 border-t border-white/5">
            <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
              Коментар на кухню (опціонально)
            </label>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Наприклад: без цибулі, соус окремо..."
              className="w-full bg-[#1A1F2B] border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Footer with Qty & Add Button with iOS safe area */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-[#0E1117] flex items-center justify-between shrink-0 pb-[calc(1.5rem+env(safe-area-inset-bottom,20px))]">
          {/* Quantity stepper */}
          <div className="flex items-center space-x-1.5 sm:space-x-2 bg-[#1A1F2B] border border-white/10 rounded-2xl p-1">
            <button
              type="button"
              onClick={() => setQty((prev) => Math.max(1, prev - 1))}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-base sm:text-lg font-bold text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              -
            </button>
            <span className="w-6 sm:w-8 text-center font-bold text-xs sm:text-sm text-white">
              {qty}
            </span>
            <button
              type="button"
              onClick={() => setQty((prev) => prev + 1)}
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95 text-base sm:text-lg font-bold text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              +
            </button>
          </div>

          {/* Add to check button */}
          <button
            type="button"
            onClick={handleAdd}
            className="flex-1 ml-3 sm:ml-4 py-3 sm:py-3.5 px-4 sm:px-6 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 text-black font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 flex items-center justify-between cursor-pointer transition-all"
          >
            <span>Додати в чек</span>
            <span className="bg-black/15 px-2 py-0.5 sm:py-1 rounded-xl text-xs sm:text-sm font-bold">
              {totalPrice} ₴
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
