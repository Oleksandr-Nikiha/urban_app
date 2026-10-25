import { useState } from "react";
import { useCreateVariant, useUpdateVariant } from "@/api/queries";
import type { AdminVariant, VariantCreatePayload, VariantUpdatePayload } from "@/api/types";
import { hapticNotify } from "@/telegram/sdk";

export function VariantModal({
  productId,
  variant,
  onClose,
}: {
  productId: number;
  variant: AdminVariant | null;
  onClose: () => void;
}) {
  const [label, setLabel] = useState(variant?.label || "Порція");
  const [price, setPrice] = useState(variant ? String(variant.price) : "100");
  const [weight, setWeight] = useState(variant?.weight || "");
  const [sortOrder, setSortOrder] = useState(variant?.sort_order ?? 0);

  const createVariant = useCreateVariant();
  const updateVariant = useUpdateVariant();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !price) return;

    if (variant) {
      const payload: VariantUpdatePayload = {
        label: label.trim(),
        price: parseFloat(price) || 0,
        weight: weight.trim() || null,
        sort_order: Number(sortOrder),
      };
      updateVariant.mutate(
        { variantId: variant.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: VariantCreatePayload = {
        label: label.trim(),
        price: parseFloat(price) || 0,
        weight: weight.trim() || null,
        sort_order: Number(sortOrder),
        is_available: true,
      };
      createVariant.mutate(
        { productId, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{variant ? "Редагування розміру/ціни" : "Новий розмір/ціна"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва варіанта (напр. 30 см, 0.5 л, Велика)</span>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="30 см"
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="opacity-60">Ціна (₴)</span>
              <input
                type="number"
                step="any"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="150"
                required
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="opacity-60">Вага / Вихід (опц.)</span>
              <input
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="450 г"
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>
          </div>

          <label className="block">
            <span className="opacity-60">Порядок сортування</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
