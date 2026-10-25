import { haptic } from "@/telegram/sdk";

interface BulkActionsBarProps {
  selectedCount: number;
  isPending: boolean;
  onClearSelection: () => void;
  onSetAvailability: (available: boolean) => void;
  onOpenBulkOptions: () => void;
}

export function BulkActionsBar({
  selectedCount,
  isPending,
  onClearSelection,
  onSetAvailability,
  onOpenBulkOptions,
}: BulkActionsBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg">
      <div
        className="app-card rounded-2xl p-3 shadow-2xl border flex flex-col gap-2.5 backdrop-blur-md"
        style={{
          background: "color-mix(in srgb, var(--tg-theme-bg-color) 94%, black)",
          borderColor: "var(--tg-theme-button-color)",
        }}
      >
        <div className="flex items-center justify-between text-xs px-1">
          <span className="font-bold">
            Обрано страв:{" "}
            <span className="text-[var(--tg-theme-button-color)] font-extrabold">
              {selectedCount}
            </span>
          </span>
          <button
            type="button"
            onClick={onClearSelection}
            className="opacity-60 hover:opacity-100 font-medium"
          >
            ✕ Зняти вибір
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              haptic("medium");
              onSetAvailability(false);
            }}
            className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-red-500/30 bg-red-500/10 text-red-500 disabled:opacity-50"
          >
            ⛔ На стоп
          </button>

          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              haptic("medium");
              onSetAvailability(true);
            }}
            className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 disabled:opacity-50"
          >
            ✓ Доступно
          </button>

          <button
            type="button"
            onClick={() => {
              haptic("light");
              onOpenBulkOptions();
            }}
            className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            🧩 Додатки
          </button>
        </div>
      </div>
    </div>
  );
}
