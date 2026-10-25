import { useState } from "react";
import {
  useAdminOptionGroups,
  useBulkProductOptionGroups,
} from "@/api/queries";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function BulkProductOptionsModal({
  productIds,
  onClose,
  onSuccess,
}: {
  productIds: number[];
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const { data: allGroups = [] } = useAdminOptionGroups();
  const [action, setAction] = useState<"attach" | "detach" | "clear">("attach");
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [minSelect, setMinSelect] = useState("0");
  const [maxSelect, setMaxSelect] = useState("3");
  const [freeCount, setFreeCount] = useState("0");

  const bulkOptions = useBulkProductOptionGroups();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (action === "attach") {
      const gId = parseInt(selectedGroupId, 10);
      if (!gId) return;
      bulkOptions.mutate(
        {
          action: "attach",
          product_ids: productIds,
          group_id: gId,
          min_select: parseInt(minSelect, 10) || 0,
          max_select: parseInt(maxSelect, 10) || 1,
          free_count: parseInt(freeCount, 10) || 0,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onSuccess?.();
            onClose();
          },
        },
      );
    } else if (action === "detach") {
      const gId = parseInt(selectedGroupId, 10);
      if (!gId) return;
      bulkOptions.mutate(
        {
          action: "detach",
          product_ids: productIds,
          group_id: gId,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onSuccess?.();
            onClose();
          },
        },
      );
    } else if (action === "clear") {
      if (!window.confirm(`Видалити ВСІ додатки з ${productIds.length} вибраних страв?`)) return;
      bulkOptions.mutate(
        {
          action: "clear",
          product_ids: productIds,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onSuccess?.();
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
        className="app-card w-full max-w-md rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-base">Масова зміна додатків</h3>
            <p className="text-xs opacity-60">Обрано страв: {productIds.length}</p>
          </div>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        {/* Перемикач типу дії */}
        <div
          className="grid grid-cols-3 gap-1 rounded-xl p-1 text-xs font-semibold"
          style={{ background: "var(--app-surface-2)" }}
        >
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setAction("attach");
            }}
            className="rounded-lg py-1.5 transition-all text-center"
            style={
              action === "attach"
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { opacity: 0.6 }
            }
          >
            ➕ Додати
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setAction("detach");
            }}
            className="rounded-lg py-1.5 transition-all text-center"
            style={
              action === "detach"
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { opacity: 0.6 }
            }
          >
            🗑️ Відкріпити
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setAction("clear");
            }}
            className="rounded-lg py-1.5 transition-all text-center"
            style={
              action === "clear"
                ? { background: "#ef4444", color: "#ffffff" }
                : { opacity: 0.6 }
            }
          >
            ❌ Очистити
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {action === "attach" && (
            <div className="space-y-3">
              <label className="block text-xs">
                <span className="opacity-60">Виберіть групу додатків</span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                >
                  <option value="">-- Виберіть групу --</option>
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.items_count} поз.)
                    </option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <label className="block">
                  <span className="opacity-60 text-[10px]">Мін. вибір</span>
                  <input
                    type="number"
                    min="0"
                    value={minSelect}
                    onChange={(e) => setMinSelect(e.target.value)}
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="opacity-60 text-[10px]">Макс. вибір</span>
                  <input
                    type="number"
                    min="1"
                    value={maxSelect}
                    onChange={(e) => setMaxSelect(e.target.value)}
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block">
                  <span className="opacity-60 text-[10px]">Безкоштовно</span>
                  <input
                    type="number"
                    min="0"
                    value={freeCount}
                    onChange={(e) => setFreeCount(e.target.value)}
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
              </div>
              <p className="text-[11px] opacity-50">
                Цю групу буде прикріплено до всіх {productIds.length} вибраних страв із зазначеними правилами вибору. Якщо група вже була прикріплена, правила оновляться.
              </p>
            </div>
          )}

          {action === "detach" && (
            <div className="space-y-3">
              <label className="block text-xs">
                <span className="opacity-60">Яку групу додатків відкріпити?</span>
                <select
                  value={selectedGroupId}
                  onChange={(e) => setSelectedGroupId(e.target.value)}
                  required
                  className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
                  style={inputStyle}
                >
                  <option value="">-- Виберіть групу для відкріплення --</option>
                  {allGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] opacity-50">
                Вказану групу додатків буде відкріплено від усіх {productIds.length} вибраних страв.
              </p>
            </div>
          )}

          {action === "clear" && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 space-y-2 text-xs">
              <p className="font-bold text-red-500">⚠️ Увага!</p>
              <p className="opacity-80">
                З усіх {productIds.length} вибраних страв буде безповоротно видалено будь-які прикріплені групи додатків.
              </p>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="app-press flex-1 rounded-xl py-2.5 text-xs font-semibold"
              style={{ background: "var(--app-surface-2)" }}
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={
                bulkOptions.isPending ||
                (action !== "clear" && !selectedGroupId)
              }
              className="app-press flex-1 rounded-xl py-2.5 text-xs font-bold disabled:opacity-40"
              style={{
                background: action === "clear" ? "#ef4444" : "var(--tg-theme-button-color)",
                color: "#ffffff",
              }}
            >
              {bulkOptions.isPending ? "Застосування..." : "Застосувати"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
