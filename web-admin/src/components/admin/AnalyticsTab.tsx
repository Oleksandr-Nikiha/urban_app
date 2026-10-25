import { useState } from "react";

import { useAdminAnalyticsSummary, useAdminAnalyticsTopProducts } from "@/api/queries";
import { EmptyState, ErrorBox, Spinner, formatPrice } from "@/components/ui";
import { haptic } from "@/telegram/sdk";

interface AnalyticsTabProps {
  locationId?: number | null;
}

type AnalyticsPeriod = "today" | "7d" | "30d" | "all";

const PERIOD_OPTIONS: { id: AnalyticsPeriod; label: string }[] = [
  { id: "today", label: "Сьогодні" },
  { id: "7d", label: "7 днів" },
  { id: "30d", label: "30 днів" },
  { id: "all", label: "Весь час" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_moderation: { label: "Очікує модерації", color: "bg-amber-500/15 text-amber-500" },
  confirmed: { label: "Підтверджено", color: "bg-blue-500/15 text-blue-500" },
  in_progress: { label: "Готується", color: "bg-indigo-500/15 text-indigo-500" },
  ready: { label: "Готове", color: "bg-teal-500/15 text-teal-500" },
  on_the_way: { label: "В дорозі", color: "bg-cyan-500/15 text-cyan-500" },
  completed: { label: "Завершено", color: "bg-emerald-500/15 text-emerald-500" },
  rejected: { label: "Відхилено", color: "bg-rose-500/15 text-rose-500" },
  cancelled: { label: "Скасовано", color: "bg-zinc-500/15 text-zinc-400" },
};

export function AnalyticsTab({ locationId }: AnalyticsTabProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>("7d");

  const {
    data: summary,
    isPending: isSummaryLoading,
    error: summaryError,
    refetch: refetchSummary,
    isFetching: isFetchingSummary,
  } = useAdminAnalyticsSummary({ period, locationId });

  const {
    data: topProducts = [],
    isPending: isTopLoading,
    error: topError,
    refetch: refetchTop,
  } = useAdminAnalyticsTopProducts({ period, locationId, limit: 10 });

  const handlePeriodChange = (p: AnalyticsPeriod) => {
    haptic("light");
    setPeriod(p);
  };

  const handleRefresh = () => {
    haptic("medium");
    void refetchSummary();
    void refetchTop();
  };

  if (isSummaryLoading || isTopLoading) {
    return <Spinner />;
  }

  if (summaryError || topError) {
    return (
      <ErrorBox
        message={
          (summaryError as Error)?.message ||
          (topError as Error)?.message ||
          "Не вдалося завантажити аналітику"
        }
        onRetry={handleRefresh}
      />
    );
  }

  if (!summary) {
    return <EmptyState icon="📊" title="Немає даних" hint="За обраний період дані відсутні." />;
  }

  const { kpi, by_status, by_fulfillment, by_payment, by_location, dynamics } = summary;

  // Максимальна виручка за день для розрахунку висоти / ширини барів
  const maxDayRevenue = Math.max(...dynamics.map((d) => d.revenue), 1);
  const maxProductQty = Math.max(...topProducts.map((p) => p.total_qty), 1);

  return (
    <div className="space-y-5 pb-8 px-4 md:px-8 max-w-6xl mx-auto">
      {/* 1. Верхній бар вибору періоду та оновлення */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <div className="flex rounded-xl p-1 text-xs font-semibold" style={{ background: "var(--app-surface-2)" }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => handlePeriodChange(opt.id)}
              className={`rounded-lg px-3 py-1.5 transition-all ${
                period === opt.id ? "shadow-sm font-bold" : "opacity-60 hover:opacity-100"
              }`}
              style={
                period === opt.id
                  ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                  : undefined
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isFetchingSummary}
          className="app-press flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold opacity-80 hover:opacity-100 transition-opacity"
          style={{ background: "var(--app-surface-2)" }}
          title="Оновити дані"
        >
          <span className={isFetchingSummary ? "animate-spin inline-block" : ""}>🔄</span>
          <span>{isFetchingSummary ? "Оновлюється..." : "Оновити"}</span>
        </button>
      </div>

      {/* 2. Ключові показники (KPI Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Виручка */}
        <div className="app-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between opacity-70 text-xs font-semibold">
            <span>Виручка</span>
            <span className="text-base">💰</span>
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black tracking-tight text-emerald-500">
              {formatPrice(kpi.revenue)}
            </span>
          </div>
          <p className="mt-1 text-[11px] opacity-50">Успішні замовлення</p>
        </div>

        {/* Кількість замовлень */}
        <div className="app-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between opacity-70 text-xs font-semibold">
            <span>Замовлень</span>
            <span className="text-base">📦</span>
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black tracking-tight">
              {kpi.orders_count}
            </span>
          </div>
          <p className="mt-1 text-[11px] opacity-50">Без скасованих</p>
        </div>

        {/* Середній чек */}
        <div className="app-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between opacity-70 text-xs font-semibold">
            <span>Середній чек</span>
            <span className="text-base">🧾</span>
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black tracking-tight">
              {formatPrice(kpi.avg_order_value)}
            </span>
          </div>
          <p className="mt-1 text-[11px] opacity-50">AOV за період</p>
        </div>

        {/* Унікальні клієнти */}
        <div className="app-card rounded-2xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between opacity-70 text-xs font-semibold">
            <span>Клієнтів</span>
            <span className="text-base">👥</span>
          </div>
          <div className="mt-2">
            <span className="text-xl md:text-2xl font-black tracking-tight">
              {kpi.customers_count}
            </span>
          </div>
          <p className="mt-1 text-[11px] opacity-50">Здійснили покупку</p>
        </div>
      </div>

      {/* 3. Динаміка продажів за днями */}
      <div className="app-card rounded-2xl p-4 md:p-5">
        <h3 className="text-sm font-bold tracking-tight mb-3 flex items-center gap-2">
          <span>📈</span>
          <span>Динаміка замовлень за днями</span>
        </h3>

        {dynamics.length === 0 ? (
          <p className="text-xs opacity-60 py-4 text-center">За вибраний період замовлень ще немає.</p>
        ) : (
          <div className="space-y-2.5">
            {dynamics.map((day) => {
              const percentage = Math.round((day.revenue / maxDayRevenue) * 100);
              return (
                <div key={day.date} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold">{day.date}</span>
                    <span className="opacity-80">
                      <strong className="text-emerald-500 font-bold">{formatPrice(day.revenue)}</strong>
                      <span className="opacity-50 ml-1.5">({day.orders_count} зам.)</span>
                    </span>
                  </div>
                  {/* Прогрес-бар виручки дня */}
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--app-surface-2)" }}>
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.max(percentage, 2)}%`,
                        background: "var(--tg-theme-button-color, #22c55e)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. Секція розбивок: Локації, Отримання, Оплата */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* По закладах */}
        <div className="app-card rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3 flex items-center gap-1.5">
            <span>🏬</span>
            <span>По закладах</span>
          </h3>
          <div className="space-y-2.5">
            {by_location.map((loc) => (
              <div
                key={loc.location_id}
                className="flex items-center justify-between p-2.5 rounded-xl text-xs"
                style={{ background: "var(--app-surface-2)" }}
              >
                <div>
                  <p className="font-bold">{loc.location_name}</p>
                  <p className="opacity-60 text-[11px]">{loc.orders_count} замовлень</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-500">{formatPrice(loc.revenue)}</p>
                  <p className="opacity-50 text-[10px]">
                    {kpi.revenue > 0 ? `${Math.round((loc.revenue / kpi.revenue) * 100)}%` : "0%"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Спосіб отримання (Fulfillment) */}
        <div className="app-card rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3 flex items-center gap-1.5">
            <span>🛵</span>
            <span>Спосіб отримання</span>
          </h3>
          <div className="space-y-2.5">
            {by_fulfillment.map((item) => {
              const isDelivery = item.fulfillment_type === "delivery";
              return (
                <div
                  key={item.fulfillment_type}
                  className="flex items-center justify-between p-2.5 rounded-xl text-xs"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{isDelivery ? "🛵" : "🏃"}</span>
                    <div>
                      <p className="font-bold">{isDelivery ? "Доставка кур'єром" : "Самовивіз"}</p>
                      <p className="opacity-60 text-[11px]">{item.count} зам.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(item.total_amount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Спосіб оплати (Payment Method) */}
        <div className="app-card rounded-2xl p-4">
          <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3 flex items-center gap-1.5">
            <span>💳</span>
            <span>Спосіб оплати</span>
          </h3>
          <div className="space-y-2.5">
            {by_payment.map((item) => {
              const getIcon = (method: string) => {
                if (method === "card") return "💳";
                if (method === "qr") return "📱";
                return "💵";
              };
              const getLabel = (method: string) => {
                if (method === "card") return "Картка";
                if (method === "qr") return "QR-код";
                return "Готівка";
              };
              return (
                <div
                  key={item.payment_method}
                  className="flex items-center justify-between p-2.5 rounded-xl text-xs"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{getIcon(item.payment_method)}</span>
                    <div>
                      <p className="font-bold">{getLabel(item.payment_method)}</p>
                      <p className="opacity-60 text-[11px]">{item.count} зам.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatPrice(item.total_amount)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 5. Топ-10 найпопулярніших страв */}
      <div className="app-card rounded-2xl p-4 md:p-5">
        <h3 className="text-sm font-bold tracking-tight mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🏆</span>
            <span>Топ-10 страв замовлень</span>
          </div>
          <span className="text-xs font-normal opacity-50">За кількістю продажів</span>
        </h3>

        {topProducts.length === 0 ? (
          <p className="text-xs opacity-60 py-4 text-center">Замовлень страв за період не знайдено.</p>
        ) : (
          <div className="divide-y divide-[var(--app-border)]">
            {topProducts.map((p, idx) => {
              const barWidth = Math.round((p.total_qty / maxProductQty) * 100);
              return (
                <div key={`${p.product_name}-${p.variant_label}`} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="w-5 text-center font-bold opacity-40 text-[11px]">#{idx + 1}</span>
                      <div className="truncate">
                        <span className="font-bold">{p.product_name}</span>
                        {p.variant_label && (
                          <span className="opacity-50 text-[11px] ml-1.5 font-normal">
                            ({p.variant_label})
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-3">
                      <span className="font-bold">{p.total_qty} шт.</span>
                      <span className="text-emerald-500 font-bold min-w-[70px] text-right">
                        {formatPrice(p.total_revenue)}
                      </span>
                    </div>
                  </div>
                  {/* Індикатор відносної популярності */}
                  <div className="mt-1.5 w-full h-1.5 rounded-full overflow-hidden" style={{ background: "var(--app-surface-2)" }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(barWidth, 3)}%`,
                        background: "var(--tg-theme-button-color, #3b82f6)",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 6. Розподіл статусів замовлень (всі включно з скасованими) */}
      <div className="app-card rounded-2xl p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 mb-3 flex items-center gap-1.5">
          <span>📊</span>
          <span>Всі замовлення за статусами</span>
        </h3>
        <div className="flex flex-wrap gap-2">
          {by_status.map((st) => {
            const cfg = STATUS_LABELS[st.status] || { label: st.status, color: "bg-zinc-500/15 text-zinc-400" };
            return (
              <div
                key={st.status}
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs"
                style={{ background: "var(--app-surface-2)" }}
              >
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cfg.color}`}>
                  {cfg.label}
                </span>
                <span className="font-bold">{st.count}</span>
                <span className="opacity-50">({formatPrice(st.total_amount)})</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

