import { useEffect, useState } from "react";
import { DEFAULT_PRODUCT_IMAGE, fetchProductDetail, getImageUrl } from "../api/client.ts";
import { useCart } from "../context/CartContext.tsx";
import { useModalBehavior } from "../hooks/useModalBehavior.ts";
import type { SelectedOptionWithGroup } from "../types/cart.ts";
import type { ProductDetail, ProductOptionGroup, ProductOptionItem, ProductVariant } from "../types/catalog.ts";
import {
  calculateGroupPricing,
  countGroupUnits,
  getInitialGroupPicks,
  getSelectionHint,
  isFixedGroup,
  type GroupCalculationResult,
  type PicksMap,
} from "../utils/productOptions.ts";

interface ProductModalProps {
  productId: number;
  onClose: () => void;
}

export function ProductModal({ productId, onClose }: ProductModalProps) {
  useModalBehavior({ isOpen: true, onClose });

  const { addItem } = useCart();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [picks, setPicks] = useState<Record<number, PicksMap>>({});
  const [qty, setQty] = useState(1);
  const [showValidation, setShowValidation] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    fetchProductDetail(productId)
      .then((data) => {
        if (!isMounted) return;
        setProduct(data);
        if (data.variants.length > 0) {
          setSelectedVariant(data.variants[0]);
        }
        // Єдиний початковий вибір опцій (автоматичний підбір безкоштовних і обов'язкових)
        const initialPicks: Record<number, PicksMap> = {};
        for (const g of data.option_groups) {
          initialPicks[g.group_id] = getInitialGroupPicks(g);
        }
        setPicks(initialPicks);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err.message || "Помилка завантаження страви");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [productId]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
        <div className="bg-[#14171E] border border-white/10 text-white rounded-3xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-12 h-12 border-4 border-[#E69A38] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold text-[#CBD5E1]">Завантажуємо смаколики...</p>
        </div>
      </div>
    );
  }

  if (error || !product || !selectedVariant) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
        <div className="bg-[#14171E] border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 text-white">
          <p className="text-red-400 font-bold">{error || "Страву не знайдено"}</p>
          <button
            onClick={onClose}
            type="button"
            className="w-full bg-[#E69A38] hover:bg-[#D4892A] text-white py-2.5 rounded-xl font-bold transition-colors cursor-pointer"
          >
            Закрити
          </button>
        </div>
      </div>
    );
  }

  // Розрахунок вартості опцій за єдиною формулою
  let extraOptionsCostPerUnit = 0;
  const groupCalculations: Record<number, GroupCalculationResult> = {};
  for (const group of product.option_groups) {
    const gCalc = calculateGroupPricing(group, picks[group.group_id] || {});
    groupCalculations[group.group_id] = gCalc;
    extraOptionsCostPerUnit += gCalc.extraCost;
  }

  const unitTotal = selectedVariant.price + extraOptionsCostPerUnit;
  const totalPrice = unitTotal * qty;

  const unfilledGroups = product.option_groups.filter(
    (g) => !(groupCalculations[g.group_id]?.isValid ?? true)
  );
  const canAddToCart = unfilledGroups.length === 0;

  const handleToggleSingleOption = (
    group: ProductOptionGroup,
    option: ProductOptionItem
  ) => {
    setShowValidation(false);
    const currentPicks = picks[group.group_id] || {};
    const isSelected = (currentPicks[option.variant_id] || 0) > 0;

    // Якщо це обов'язковий вибір (min_select >= 1), зняти до 0 не можна
    if (isSelected && group.min_select >= 1) {
      return;
    }

    setPicks((prev) => ({
      ...prev,
      [group.group_id]: isSelected ? {} : { [option.variant_id]: 1 },
    }));
  };

  const handleChangeOptionCount = (
    group: ProductOptionGroup,
    option: ProductOptionItem,
    delta: number
  ) => {
    setShowValidation(false);
    const currentPicks = picks[group.group_id] || {};
    const currentUnits = countGroupUnits(currentPicks);

    if (delta > 0 && currentUnits >= group.max_select) {
      return;
    }

    const currentCount = currentPicks[option.variant_id] || 0;
    const newCount = currentCount + delta;
    const next = { ...currentPicks };

    if (newCount <= 0) {
      delete next[option.variant_id];
    } else {
      next[option.variant_id] = newCount;
    }

    setPicks((prev) => ({ ...prev, [group.group_id]: next }));
  };

  const handleAddToCart = () => {
    if (!canAddToCart) {
      setShowValidation(true);
      return;
    }

    const selectedOptions: SelectedOptionWithGroup[] = [];
    for (const group of product.option_groups) {
      const gPicks = picks[group.group_id] || {};
      for (const item of group.items) {
        const count = gPicks[item.variant_id] || 0;
        if (count > 0) {
          selectedOptions.push({
            groupId: group.group_id,
            groupName: group.name,
            option: item,
            qty: count,
          });
        }
      }
    }

    addItem({
      productId: product.id,
      productName: product.name,
      imageUrl: product.image_url,
      variant: selectedVariant,
      selectedOptions,
      qty,
      extraPerUnit: extraOptionsCostPerUnit,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-[#14171E] rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 text-[#F1F5F9]">
        {/* Кнопка закриття */}
        <button
          onClick={onClose}
          type="button"
          aria-label="Закрити"
          className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1E232B]/90 backdrop-blur-md text-white hover:bg-[#282F3B] flex items-center justify-center font-bold text-lg sm:text-xl shadow-md cursor-pointer transition-transform hover:scale-110 active:scale-95 border border-white/10"
        >
          ✕
        </button>

        {/* Скролабельний вміст модального вікна */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Зображення страви */}
          <div className="relative w-full h-56 sm:h-72 bg-[#121419] overflow-hidden flex items-center justify-center border-b border-white/10">
            <img
              src={getImageUrl(product.image_url)}
              alt={product.name}
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).src = DEFAULT_PRODUCT_IMAGE;
              }}
              className="w-full h-full object-cover sm:object-contain transition-all duration-300 opacity-95"
            />
          </div>

          {/* Тіло з опціями */}
          <div className="p-5 sm:p-7 space-y-6">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-white">
                {product.name}
              </h2>
              {product.description && (
                <p className="mt-2 text-sm sm:text-base text-[#94A3B8] leading-relaxed">
                  {product.description}
                </p>
              )}
            </div>

            {/* Валідаційне попередження, якщо не вибрані обов'язкові опції */}
            {showValidation && unfilledGroups.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs flex items-center space-x-2 animate-in fade-in">
                <span>⚠️</span>
                <span>
                  Будь ласка, оберіть обов'язкові додатки у групі:{" "}
                  <strong>{unfilledGroups.map((g) => g.name).join(", ")}</strong>
                </span>
              </div>
            )}

            {/* Вибір варіанту / розміру */}
            {product.variants.length > 1 && (
              <div className="space-y-3">
                <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                  Оберіть розмір / варіант
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {product.variants.map((v) => {
                    const isSelected = selectedVariant.id === v.id;
                    return (
                      <button
                        key={v.id}
                        onClick={() => setSelectedVariant(v)}
                        type="button"
                        className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? "border-[#E69A38] bg-[#E69A38]/15 shadow-sm ring-2 ring-[#E69A38]/20"
                            : "border-white/10 hover:border-white/25 bg-[#181B22]"
                        }`}
                      >
                        <div className="font-bold text-sm text-white">{v.label}</div>
                        <div className="flex items-center justify-between text-xs text-[#94A3B8] mt-1">
                          {v.weight && (
                            <span>{/[а-яА-Яa-zA-Z]/.test(v.weight) ? v.weight : `${v.weight} г`}</span>
                          )}
                          <span className="font-extrabold text-[#E69A38]">{v.price} ₴</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Групи опцій / додатків */}
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
                  className={`space-y-3 pt-3.5 pb-1 border-t transition-all ${
                    isUnfilled
                      ? "border-amber-500/50 bg-amber-500/5 -mx-2 px-2 rounded-2xl"
                      : "border-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-white">{group.name}</span>
                      {group.free_count > 0 && (
                        <span className="text-xs text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded-full font-semibold border border-amber-500/30">
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
                    <span className="text-xs text-[#94A3B8]">
                      {getSelectionHint(group)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    {group.items.map((opt) => {
                      const itemPricing = gCalc.itemsPricing[opt.variant_id] || {
                        variant_id: opt.variant_id,
                        name: opt.name,
                        price_delta: opt.price_delta,
                        selectedQty: 0,
                        freeQty: 0,
                        paidQty: 0,
                        effectiveCost: 0,
                        isFullyFree: false,
                        hasFreeQuotaRemaining: false,
                      };
                      const count = itemPricing.selectedQty;
                      const isChecked = count > 0;

                      if (isMulti) {
                        return (
                          <div
                            key={opt.variant_id}
                            className={`flex items-center justify-between p-3 rounded-2xl border text-sm transition-all ${
                              isChecked
                                ? "border-[#E69A38] bg-[#E69A38]/15"
                                : "border-white/10 bg-[#181B22] hover:border-white/20"
                            }`}
                          >
                            <div className="flex-1 pr-3">
                              <span className="font-bold text-white">{opt.name}</span>
                              {/* Відображення ціни або безкоштовної квоти */}
                              {count > 0 ? (
                                itemPricing.isFullyFree ? (
                                  <span className="text-xs text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold ml-2">
                                    Безкоштовно
                                  </span>
                                ) : (
                                  <span className="text-xs text-[#E69A38] ml-2 font-bold">
                                    +{itemPricing.effectiveCost} ₴
                                    {itemPricing.freeQty > 0 && (
                                      <span className="text-[#94A3B8] font-normal ml-1">
                                        ({itemPricing.freeQty} б/к)
                                      </span>
                                    )}
                                  </span>
                                )
                              ) : itemPricing.hasFreeQuotaRemaining ? (
                                <span className="text-xs text-amber-400/80 ml-2 font-semibold">
                                  0 ₴ (включено)
                                </span>
                              ) : opt.price_delta > 0 ? (
                                <span className="text-xs text-[#94A3B8] ml-2 font-medium">
                                  +{opt.price_delta} ₴
                                </span>
                              ) : null}
                            </div>

                            <div className="flex items-center gap-2 bg-[#121417] rounded-xl border border-white/10 p-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeOptionCount(group, opt, -1)
                                }
                                disabled={count === 0}
                                className="w-7 h-7 rounded-lg bg-[#1E232B] text-white font-bold disabled:opacity-30 hover:bg-[#282F3B] flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                              >
                                −
                              </button>
                              <span className="w-5 text-center font-extrabold text-xs text-white">
                                {count}
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleChangeOptionCount(group, opt, 1)
                                }
                                disabled={totalUnits >= group.max_select}
                                className="w-7 h-7 rounded-lg bg-[#1E232B] text-white font-bold disabled:opacity-30 hover:bg-[#282F3B] flex items-center justify-center cursor-pointer shadow-2xs active:scale-95"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Одиничний вибір (Radio / Pill)
                      return (
                        <button
                          key={opt.variant_id}
                          disabled={isFixed}
                          onClick={() =>
                            handleToggleSingleOption(group, opt)
                          }
                          type="button"
                          className={`w-full flex items-center justify-between p-3 rounded-2xl border text-sm transition-all cursor-pointer ${
                            isChecked
                              ? "border-[#E69A38] bg-[#E69A38]/15 font-bold text-white"
                              : "border-white/10 hover:border-white/25 text-[#CBD5E1] bg-[#181B22]"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`w-4 h-4 rounded-full flex items-center justify-center border text-[10px] ${
                                isChecked
                                  ? "bg-[#E69A38] border-[#E69A38] text-white"
                                  : "border-white/20"
                              }`}
                            >
                              {isChecked ? "✓" : ""}
                            </span>
                            <span>{opt.name}</span>
                          </div>

                          <div>
                            {isChecked ? (
                              itemPricing.isFullyFree ? (
                                <span className="text-xs text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md font-bold">
                                  Безкоштовно
                                </span>
                              ) : (
                                <span className="text-xs text-[#E69A38] font-bold">
                                  +{itemPricing.effectiveCost} ₴
                                </span>
                              )
                            ) : itemPricing.hasFreeQuotaRemaining ? (
                              <span className="text-xs text-amber-400/80 font-semibold">
                                0 ₴ (включено)
                              </span>
                            ) : opt.price_delta > 0 ? (
                              <span className="text-xs text-[#94A3B8]">
                                +{opt.price_delta} ₴
                              </span>
                            ) : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Зафіксований футер із кількістю та кнопкою додавання */}
        <div className="shrink-0 p-4 sm:p-5 border-t border-white/10 bg-[#181B22] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 bg-[#121417] rounded-2xl border border-white/10 p-1 shrink-0">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1E232B] text-white font-bold hover:bg-[#282F3B] shadow-xs flex items-center justify-center cursor-pointer active:scale-95 text-base sm:text-lg"
            >
              −
            </button>
            <span className="w-6 sm:w-8 text-center font-extrabold text-sm sm:text-base text-white">
              {qty}
            </span>
            <button
              onClick={() => setQty((q) => q + 1)}
              type="button"
              className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1E232B] text-white font-bold hover:bg-[#282F3B] shadow-xs flex items-center justify-center cursor-pointer active:scale-95 text-base sm:text-lg"
            >
              +
            </button>
          </div>

          <button
            onClick={handleAddToCart}
            type="button"
            className="flex-1 bg-[#E69A38] hover:bg-[#D4892A] text-white py-3 sm:py-3.5 px-4 sm:px-6 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-[#E69A38]/25 transition-all active:scale-98 cursor-pointer flex items-center justify-between"
          >
            <span>В кошик</span>
            <span className="bg-white/20 text-white px-2.5 py-0.5 rounded-lg text-sm sm:text-base font-extrabold">
              {totalPrice} ₴
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
