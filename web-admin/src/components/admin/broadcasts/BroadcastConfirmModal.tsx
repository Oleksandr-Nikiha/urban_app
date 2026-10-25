import type { BroadcastSegment } from "@/api/types";
import { SEGMENT_OPTIONS } from "./constants";

interface BroadcastConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
  title: string;
  recipientCount: number;
  segment: BroadcastSegment;
}

export function BroadcastConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  isPending,
  title,
  recipientCount,
  segment,
}: BroadcastConfirmModalProps) {
  if (!isOpen) return null;

  const segmentLabel = SEGMENT_OPTIONS.find((s) => s.id === segment)?.label || segment;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-[var(--app-border)] bg-white dark:bg-[#1c1c1e]"
        style={{
          background: "var(--tg-theme-bg-color, #ffffff)",
          color: "var(--tg-theme-text-color, #000000)",
        }}
      >
        <div className="flex items-center gap-2.5 text-amber-500">
          <span className="text-2xl">⚠️</span>
          <h4 className="text-base font-bold text-[var(--tg-theme-text-color,inherit)]">
            Підтвердження розсилки
          </h4>
        </div>

        <p className="text-xs leading-relaxed opacity-90 text-[var(--tg-theme-text-color,inherit)]">
          Ви збираєтеся надіслати повідомлення <strong>«{title}»</strong> для{" "}
          <strong className="text-emerald-500">{recipientCount} клієнтів</strong> у сегменті{" "}
          <strong>{segmentLabel}</strong>.
        </p>

        <p className="text-[11px] opacity-70 text-[var(--tg-theme-text-color,inherit)]">
          Відправка почнеться негайно у фоні через Telegram-бота з дотриманням рейт-лімітів.
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="app-press rounded-xl px-4 py-2.5 text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity"
            style={{
              background: "var(--app-surface-2)",
              color: "var(--tg-theme-text-color, inherit)",
            }}
          >
            Скасувати
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="app-press rounded-xl px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 shadow-md transition-all"
          >
            {isPending ? "Запуск..." : "Так, розпочати розсилку"}
          </button>
        </div>
      </div>
    </div>
  );
}
