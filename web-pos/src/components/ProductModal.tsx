import { useState } from "react";
import { DEFAULT_PRODUCT_IMAGE, getImageUrl } from "../api/client";
import type { CartItemOption, OptionGroup, OptionItem, Product, ProductVariant } from "../types";

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

function getInitialOptions(product: Product): CartItemOption[] {
  const initial: CartItemOption[] = [];
  if (!product.option_groups) return initial;

  for (const group of product.option_groups) {
    if ((group.free_count > 0 || group.min_select > 0) && group.items && group.items.length > 0) {
      const defaultQty = Math.min(
        group.max_select || 1,
        Math.max(1, group.min_select || 0)
      );
      const first = group.items[0];
      initial.push({
        option_item_id: first.id,
        variant_id: first.variant_id,
        name: first.name,
        price: first.price,
        qty: defaultQty,
        group_id: group.group_id,
        group_name: group.name,
      });
    }
  }
  return initial;
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

  const [selectedOptions, setSelectedOptions] = useState<CartItemOption[]>(() =>
    getInitialOptions(product)
  );
  const [qty, setQty] = useState(1);
  const [comment, setComment] = useState("");

  const handleChangeOptionCount = (
    group: OptionGroup,
    item: OptionItem,
    delta: number
  ) => {
    setSelectedOptions((prev) => {
      const inGroup = prev.filter((o) => o.group_id === group.group_id);
      const totalUnitsInGroup = inGroup.reduce((sum, o) => sum + o.qty, 0);
      const existing = prev.find((o) => o.option_item_id === item.id);
      const currentCount = existing ? existing.qty : 0;
      const newCount = currentCount + delta;

      if (delta > 0 && totalUnitsInGroup >= group.max_select) {
        return prev;
      }

      if (newCount <= 0) {
        return prev.filter((o) => o.option_item_id !== item.id);
      }

      if (existing) {
        return prev.map((o) =>
          o.option_item_id === item.id ? { ...o, qty: newCount } : o
        );
      }

      return [
        ...prev,
        {
          option_item_id: item.id,
          variant_id: item.variant_id,
          name: item.name,
          price: item.price,
          qty: newCount,
          group_id: group.group_id,
          group_name: group.name,
        },
      ];
    });
  };

  const handleToggleSingle = (group: OptionGroup, item: OptionItem) => {
    setSelectedOptions((prev) => {
      const existing = prev.find((o) => o.option_item_id === item.id);
      const otherGroups = prev.filter((o) => o.group_id !== group.group_id);

      if (existing) {
        if (group.min_select === 0) {
          return otherGroups;
        }
        return prev;
      }

      return [
        ...otherGroups,
        {
          option_item_id: item.id,
          variant_id: item.variant_id,
          name: item.name,
          price: item.price,
          qty: 1,
          group_id: group.group_id,
          group_name: group.name,
        },
      ];
    });
  };

  // Розрахунок вартості додатків з урахуванням безкоштовної квоти (free_count)
  let extraOptionsCost = 0;
  for (const group of product.option_groups || []) {
    const chosenInGroup = selectedOptions.filter((o) => o.group_id === group.group_id);
    const deltas: number[] = [];
    for (const o of chosenInGroup) {
      for (let i = 0; i < o.qty; i++) {
        deltas.push(o.price);
      }
    }
    deltas.sort((a, b) => b - a);
    const charged = deltas.slice(group.free_count);
    extraOptionsCost += charged.reduce((sum, d) => sum + d, 0);
  }

  const unitPrice = selectedVariant.price + extraOptionsCost;
  const totalPrice = unitPrice * qty;

  const handleAdd = () => {
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
                const inGroup = selectedOptions.filter((o) => o.group_id === group.group_id);
                const totalUnits = inGroup.reduce((sum, o) => sum + o.qty, 0);
                const isSingle = group.max_select === 1;

                return (
                  <div key={group.group_id} className="pt-2 border-t border-white/5 space-y-2">
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
                      </div>
                      <span className="text-[11px] text-zinc-400">
                        {isSingle
                          ? "Оберіть 1"
                          : `обрано ${totalUnits} з ${group.max_select}`}
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {group.items.map((opt) => {
                        const optState = selectedOptions.find((o) => o.option_item_id === opt.id);
                        const count = optState ? optState.qty : 0;
                        const isChecked = count > 0;

                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all ${
                              isChecked
                                ? "bg-amber-500/15 border-amber-500 text-white shadow-sm"
                                : "bg-[#1A1F2B] border-white/5 text-zinc-300 hover:border-white/15"
                            }`}
                          >
                            <div
                              className="flex-1 pr-2 cursor-pointer"
                              onClick={() => {
                                if (isSingle) {
                                  handleToggleSingle(group, opt);
                                } else {
                                  handleChangeOptionCount(group, opt, count > 0 ? -1 : 1);
                                }
                              }}
                            >
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-xs">{opt.name}</span>
                                {opt.price > 0 ? (
                                  <span className="text-[10px] text-zinc-400 font-semibold">
                                    +{opt.price} ₴
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-emerald-400 font-semibold">
                                    Безкоштовно
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Controls: Stepper for multi-choice or radio checkmark */}
                            {isSingle ? (
                              <button
                                type="button"
                                onClick={() => handleToggleSingle(group, opt)}
                                className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs cursor-pointer ${
                                  isChecked
                                    ? "bg-amber-500 border-amber-500 text-black font-extrabold"
                                    : "border-white/20 text-transparent"
                                }`}
                              >
                                ✓
                              </button>
                            ) : (
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
                            )}
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
