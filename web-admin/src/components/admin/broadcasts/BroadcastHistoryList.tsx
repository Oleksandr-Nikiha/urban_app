import { useState } from "react";
import type { Broadcast } from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import { SEGMENT_OPTIONS } from "./constants";

interface BroadcastHistoryListProps {
  broadcasts: Broadcast[];
  isPending: boolean;
  error: Error | null;
}

export function BroadcastHistoryList({
  broadcasts,
  isPending,
  error,
}: BroadcastHistoryListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;
  if (broadcasts.length === 0) {
    return (
      <EmptyState
        icon="📢"
        title="Розсилок ще не було"
        hint="Створіть першу кампанію, щоб повідомити клієнтів про акції та новинки."
      />
    );
  }

  return (
    <div className="space-y-3">
      {broadcasts.map((b) => {
        const isExpanded = expandedId === b.id;

        const getStatusBadge = () => {
          if (b.status === "sending") {
            return (
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 animate-pulse">
                ⏳ Відправляється...
              </span>
            );
          }
          if (b.status === "failed") {
            return (
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30">
                ❌ Помилка
              </span>
            );
          }
          return (
            <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold bg-emerald-500/20 text-emerald-500 border border-emerald-500/30">
              ✅ Завершено
            </span>
          );
        };

        const segmentObj = SEGMENT_OPTIONS.find((s) => s.id === b.segment);

        return (
          <div
            key={b.id}
            className="rounded-2xl p-4 border border-[var(--app-border)] space-y-3 shadow-sm transition-all"
            style={{ background: "var(--app-surface-2)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-bold text-sm truncate">{b.title}</span>
                <span className="rounded-lg px-2.5 py-0.5 text-[11px] font-semibold shrink-0 bg-[var(--app-surface)] border border-[var(--app-border)]">
                  {segmentObj?.icon} {segmentObj?.label || b.segment}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                <span className="text-[11px] opacity-60 font-medium">
                  {new Date(b.created_at).toLocaleDateString("uk-UA", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>

            {/* Статистика відправки */}
            <div className="flex items-center justify-between text-xs pt-2 border-t border-[var(--app-border)]">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span>
                  Отримувачів: <strong className="font-bold">{b.total_recipients}</strong>
                </span>
                <span>
                  Успішно: <strong className="font-bold text-emerald-500">{b.sent_count}</strong>
                </span>
                {b.failed_count > 0 && (
                  <span>
                    Помилок/блок: <strong className="font-bold text-rose-500">{b.failed_count}</strong>
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  setExpandedId(isExpanded ? null : b.id);
                }}
                className="text-xs text-emerald-500 font-bold hover:underline"
              >
                {isExpanded ? "Приховати текст ▲" : "Показати текст ▼"}
              </button>
            </div>

            {/* Розгорнутий перегляд тексту */}
            {isExpanded && (
              <div
                className="p-4 rounded-xl text-xs space-y-3 mt-2 leading-relaxed border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--tg-theme-text-color)] shadow-inner"
                style={{ color: "var(--tg-theme-text-color, #ffffff)" }}
              >
                {b.image_url && (
                  <div className="max-w-sm rounded-lg overflow-hidden border border-[var(--app-border)]">
                    <img src={b.image_url} alt="Банер" className="w-full object-cover" />
                  </div>
                )}
                <p className="whitespace-pre-wrap font-medium leading-relaxed text-xs opacity-95">
                  {b.text}
                </p>
                {b.button_text && b.button_url && (
                  <div className="pt-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-500/15 text-sky-500 border border-sky-500/20">
                      🔘 {b.button_text}: {b.button_url}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
