import { useState } from "react";
import type { AdminDeliveryAddress } from "@/api/types";

interface DeliveryAddressModalProps {
  initialData: AdminDeliveryAddress | null;
  onClose: () => void;
  onSave: (payload: {
    city?: string;
    street?: string;
    is_active?: boolean;
    notes?: string | null;
  }) => void;
  isSaving: boolean;
}

export function DeliveryAddressModal({
  initialData,
  onClose,
  onSave,
  isSaving,
}: DeliveryAddressModalProps) {
  const [city, setCity] = useState(initialData?.city || "Київ");
  const [street, setStreet] = useState(initialData?.street || "");
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [isActive, setIsActive] = useState(initialData ? initialData.is_active : true);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStreet = street.trim();
    if (!cleanStreet) {
      setError("Вкажіть назву вулиці");
      return;
    }
    setError(null);
    onSave({
      city: city.trim() || "Київ",
      street: cleanStreet,
      notes: notes.trim() || null,
      is_active: isActive,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 sm:p-4 overscroll-contain">
      <div
        className="app-rise w-full max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl border border-[var(--app-border)] p-5 pb-8 sm:pb-5 shadow-2xl space-y-4 max-w-md bg-white dark:bg-[#1c1c1e]"
        style={{
          background: "var(--tg-theme-bg-color, #ffffff)",
          color: "var(--tg-theme-text-color, #000000)",
        }}
      >
        <div className="flex items-center justify-between border-b pb-3 border-[var(--app-border)]">
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>📍</span>
            <span>{initialData ? "Редагування адреси" : "Нова адреса доставки"}</span>
          </h3>
          <button
            onClick={onClose}
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-sm opacity-60 hover:opacity-100"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-500/15 p-3 text-xs text-rose-600 font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
              Населений пункт
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
              Вулиця / провулок / проспект *
            </label>
            <input
              type="text"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              placeholder="наприклад: вул. Сагайдачного або вул. Велика Васильківська"
              required
              autoFocus
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider opacity-60">
              Примітка / причина стоплиста (необов'язково)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="наприклад: Ремонт мосту, тимчасово без заїзду кур'єра"
              rows={2}
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 text-xs outline-none focus:ring-2 focus:ring-blue-500"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded accent-[var(--tg-theme-button-color)]"
            />
            <span className="text-xs font-medium">
              Доставка дозволена (не в стоплисті)
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--app-border)]">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 text-xs font-semibold opacity-70 hover:opacity-100"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="app-press rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow transition"
              style={{ background: "var(--tg-theme-button-color)" }}
            >
              {isSaving ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
