import { useState } from "react";
import { formatPrice } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import type { VariantSelectorChoice } from "@/api/types";

interface AddDishSubmodalProps {
  isOpen: boolean;
  onClose: () => void;
  variantChoices: VariantSelectorChoice[];
  onSelect: (choice: VariantSelectorChoice) => void;
}

export function AddDishSubmodal({
  isOpen,
  onClose,
  variantChoices,
  onSelect,
}: AddDishSubmodalProps) {
  const [dishSearch, setDishSearch] = useState("");

  if (!isOpen) return null;

  const filteredChoices = variantChoices.filter((vc) => {
    if (!dishSearch) return true;
    const q = dishSearch.toLowerCase();
    return (
      vc.product_name.toLowerCase().includes(q) ||
      vc.variant_label.toLowerCase().includes(q) ||
      (vc.category_name && vc.category_name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 overscroll-contain">
      <div
        className="w-full max-h-[85dvh] overflow-y-auto rounded-2xl p-4 max-w-sm space-y-3 overscroll-contain touch-pan-y shadow-2xl"
        style={{
          background: "var(--tg-theme-bg-color, #ffffff)",
          border: "1px solid var(--app-border)",
        }}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold">Додати страву до замовлення</h4>
          <button
            onClick={onClose}
            className="opacity-50 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="🔍 Пошук страви..."
          value={dishSearch}
          onChange={(e) => setDishSearch(e.target.value)}
          className="w-full rounded-xl p-2.5 text-xs outline-none"
          style={{ background: "var(--app-surface-2)" }}
        />

        <div className="space-y-1.5 max-h-[50vh] overflow-y-auto">
          {filteredChoices.slice(0, 40).map((vc) => (
            <button
              key={vc.variant_id}
              onClick={() => {
                haptic("light");
                onSelect(vc);
                onClose();
                setDishSearch("");
              }}
              className="app-press flex w-full items-center justify-between rounded-xl p-2 text-left text-xs hover:bg-black/5"
              style={{ background: "var(--app-surface-2)" }}
            >
              <div>
                <p className="font-bold">{vc.product_name}</p>
                <p className="opacity-60 text-[10px]">
                  {vc.category_name ? `${vc.category_name} • ` : ""}
                  {vc.variant_label}
                </p>
              </div>
              <span className="font-bold">{formatPrice(vc.price)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
