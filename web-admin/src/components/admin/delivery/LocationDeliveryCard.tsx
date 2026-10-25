import { useState } from "react";
import type { LocationDeliverySettings } from "@/api/types";
import { haptic } from "@/telegram/sdk";

interface LocationDeliveryCardProps {
  location: LocationDeliverySettings;
  onUpdate: (payload: {
    is_delivery_enabled?: boolean;
    delivery_start_time?: string;
    delivery_end_time?: string;
  }) => void;
  isUpdating: boolean;
}

export function LocationDeliveryCard({
  location,
  onUpdate,
  isUpdating,
}: LocationDeliveryCardProps) {
  const [startTime, setStartTime] = useState(location.delivery_start_time || "10:00");
  const [endTime, setEndTime] = useState(location.delivery_end_time || "22:00");
  const [hasHoursChanged, setHasHoursChanged] = useState(false);

  const handleToggleDelivery = () => {
    haptic("medium");
    onUpdate({ is_delivery_enabled: !location.is_delivery_enabled });
  };

  const handleSaveHours = (e: React.FormEvent) => {
    e.preventDefault();
    haptic("light");
    onUpdate({ delivery_start_time: startTime, delivery_end_time: endTime });
    setHasHoursChanged(false);
  };

  return (
    <div className="app-card rounded-2xl p-4 space-y-4">
      <div
        className="flex items-start justify-between gap-2 border-b pb-3"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div>
          <h3 className="font-bold text-base flex items-center gap-1.5">
            <span>📍</span>
            <span>{location.name}</span>
          </h3>
          <p className="mt-0.5 text-xs opacity-60">{location.address}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            location.is_delivery_enabled
              ? "text-emerald-500 bg-emerald-500/10"
              : "text-rose-500 bg-rose-500/10"
          }`}
        >
          {location.is_delivery_enabled ? "🟢 Доставка активна" : "🔴 Доставка вимкнена"}
        </span>
      </div>

      {/* Аварійний перемикач навантаження */}
      <div className="space-y-2">
        <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">
          Аварійне вимкнення при навантаженні
        </label>
        <button
          type="button"
          onClick={handleToggleDelivery}
          disabled={isUpdating}
          className="app-press w-full rounded-xl py-3 px-4 text-xs font-bold transition flex items-center justify-between shadow-sm"
          style={{
            background: location.is_delivery_enabled
              ? "color-mix(in srgb, #ef4444 12%, transparent)"
              : "color-mix(in srgb, #22c55e 12%, transparent)",
            color: location.is_delivery_enabled ? "#ef4444" : "#22c55e",
            border: `1px solid ${
              location.is_delivery_enabled
                ? "color-mix(in srgb, #ef4444 30%, transparent)"
                : "color-mix(in srgb, #22c55e 30%, transparent)"
            }`,
          }}
        >
          <span>
            {location.is_delivery_enabled
              ? "⛔ Вимкнути доставку (високе навантаження)"
              : "✅ Увімкнути прийом доставки"}
          </span>
          <span className="text-xs">
            {location.is_delivery_enabled ? "Перевести на самовивіз →" : "Відновити →"}
          </span>
        </button>
        <p className="text-[11px] opacity-60 leading-relaxed">
          {location.is_delivery_enabled
            ? "Клієнти можуть обирати і доставку, і самовивіз."
            : "Доставка вимкнена: у клієнтів блокується кнопка доставки, замовлення приймаються виключно на самовивіз."}
        </p>
      </div>

      {/* Години роботи доставки */}
      <form
        onSubmit={handleSaveHours}
        className="space-y-3 pt-2 border-t"
        style={{ borderColor: "var(--app-border)" }}
      >
        <label className="block text-xs font-semibold uppercase tracking-wider opacity-60">
          Години прийому доставки
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
            <span className="block text-[11px] font-medium opacity-70 mb-1.5 flex items-center gap-1.5">
              <span>⏰</span>
              <span>Початок роботи</span>
            </span>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setHasHoursChanged(true);
              }}
              required
              className="w-full rounded-lg bg-transparent text-base font-bold outline-none transition focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3">
            <span className="block text-[11px] font-medium opacity-70 mb-1.5 flex items-center gap-1.5">
              <span>🌙</span>
              <span>Кінець роботи</span>
            </span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => {
                setEndTime(e.target.value);
                setHasHoursChanged(true);
              }}
              required
              className="w-full rounded-lg bg-transparent text-base font-bold outline-none transition focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
              style={{ color: "var(--tg-theme-text-color)" }}
            />
          </div>
        </div>

        {hasHoursChanged && (
          <button
            type="submit"
            disabled={isUpdating}
            className="app-press w-full sm:w-auto px-6 rounded-xl py-2.5 text-xs font-bold shadow transition"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            {isUpdating ? "Збереження..." : "Зберегти нові години"}
          </button>
        )}
      </form>
    </div>
  );
}
