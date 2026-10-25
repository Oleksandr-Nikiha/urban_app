import { useState, useEffect } from "react";
import { useAdminOrders, useUpdateAdminOrder } from "@/api/queries";
import { EmptyState, ErrorBox, Spinner, formatPrice } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import { STATUS_CONFIG } from "./orderStatusConfig";
import { OrderEditModal } from "./modals/OrderEditModal";

export function OrdersTab({
  locationId,
  initialEditingOrderId,
  onCloseEditingOrder,
}: {
  locationId?: number | null;
  initialEditingOrderId?: number | null;
  onCloseEditingOrder?: () => void;
}) {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const {
    data: orders = [],
    isPending,
    error,
    refetch,
  } = useAdminOrders({
    status: statusFilter,
    locationId,
  });
  const [editingOrderId, setEditingOrderId] = useState<number | null>(
    initialEditingOrderId ?? null
  );
  const updateOrder = useUpdateAdminOrder();

  useEffect(() => {
    if (initialEditingOrderId) {
      setEditingOrderId(initialEditingOrderId);
    }
  }, [initialEditingOrderId]);

  const statusFilters = [
    { key: null, label: "Всі" },
    { key: "pending_moderation", label: "⏳ Очікують" },
    { key: "confirmed", label: "✅ Підтверджені" },
    { key: "in_progress", label: "👨‍🍳 Готуються" },
    { key: "ready", label: "🛍️ Готові" },
    { key: "on_the_way", label: "🛵 В дорозі" },
    { key: "completed", label: "🏁 Виконані" },
    { key: "rejected", label: "❌ Відхилені" },
    { key: "cancelled", label: "🚫 Скасовані" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Замовлення ({orders.length})</h2>
          <p className="text-xs opacity-60">Модерація та зміна складу замовлень</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            void refetch();
          }}
          className="app-press rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--app-surface-2)" }}
        >
          🔄 Оновити
        </button>
      </div>

      {/* Фільтри за статусом */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {statusFilters.map((sf) => (
          <button
            key={String(sf.key)}
            onClick={() => {
              haptic("light");
              setStatusFilter(sf.key);
            }}
            className="app-press shrink-0 rounded-full px-3 py-1.5 font-medium transition-all"
            style={
              statusFilter === sf.key
                ? {
                    background: "var(--tg-theme-button-color)",
                    color: "var(--tg-theme-button-text-color)",
                  }
                : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
            }
          >
            {sf.label}
          </button>
        ))}
      </div>

      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} />
      ) : orders.length === 0 ? (
        <EmptyState icon="📦" title="Замовлень немає" hint="Не знайдено замовлень із обраним статусом" />
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const sc = STATUS_CONFIG[o.status] || {
              label: o.status,
              bg: "var(--app-surface-2)",
              text: "inherit",
            };
            return (
              <div
                key={o.id}
                className="app-card rounded-2xl p-4 transition-all"
                style={{ border: "1px solid var(--app-border)" }}
              >
                {/* Шапка картки */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold">#{o.id}</span>
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                        style={{ background: sc.bg, color: sc.text }}
                      >
                        {sc.label}
                      </span>
                      {o.source === "web_croissants" ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: "rgba(200, 130, 62, 0.15)",
                            color: "#a15914",
                          }}
                        >
                          🥐 Веб-сайт
                        </span>
                      ) : (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                          style={{
                            background: "rgba(59, 130, 246, 0.15)",
                            color: "#2563eb",
                          }}
                        >
                          🤖 Telegram
                        </span>
                      )}
                      {o.location_name && (
                        <span className="text-[11px] opacity-60">📍 {o.location_name}</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] opacity-50">📅 {o.created_at}</p>
                  </div>

                  <div className="text-right">
                    <span
                      className="text-sm font-bold"
                      style={{ color: "var(--tg-theme-button-color)" }}
                    >
                      {formatPrice(o.total_price)}
                    </span>
                    <p className="text-[11px] opacity-60">
                      {o.payment_method === "cash"
                        ? "💵 Готівка"
                        : o.payment_method === "card"
                        ? "💳 Картка"
                        : "📱 QR"}
                    </p>
                  </div>
                </div>

                {/* Примітка про клієнта */}
                {o.user_admin_note && (
                  <div
                    className="mt-2.5 rounded-xl p-2.5 text-xs"
                    style={{
                      background: "color-mix(in srgb, #f59e0b 15%, transparent)",
                      color: "#b45309",
                    }}
                  >
                    ⚠️ <b>Примітка про клієнта:</b> {o.user_admin_note}
                  </div>
                )}
                {o.user_is_blocked && (
                  <div
                    className="mt-1.5 rounded-xl p-2 text-xs font-semibold"
                    style={{
                      background: "color-mix(in srgb, #ef4444 15%, transparent)",
                      color: "#ef4444",
                    }}
                  >
                    ⛔ Клієнт заблокований в системі!
                  </div>
                )}

                {/* Дані клієнта та доставки */}
                <div className="mt-2.5 space-y-1 text-xs opacity-80">
                  <p>
                    👤 <b>{o.contact_name}</b> (
                    <a href={`tel:${o.contact_phone}`} className="text-blue-500 hover:underline">
                      {o.contact_phone}
                    </a>
                    )
                  </p>
                  <p>
                    {o.fulfillment_type === "delivery"
                      ? `🛵 Доставка: ${o.delivery_address || ""}`
                      : "🛍️ Самовивіз"}
                  </p>
                  <p>
                    ⏰ Час: <b>{o.scheduled_time ? `На ${o.scheduled_time}` : "Якнайшвидше"}</b>
                  </p>
                  {o.comment && <p className="italic opacity-70">💬 {o.comment}</p>}
                </div>

                {/* Список страв */}
                <div
                  className="mt-2.5 rounded-xl p-2.5 text-xs font-medium"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  <p className="opacity-60 mb-0.5 text-[11px]">Страви:</p>
                  <p className="line-clamp-2">{o.items_summary || "Немає позицій"}</p>
                </div>

                {/* Кнопки дій */}
                <div
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-2.5"
                  style={{ borderColor: "var(--app-border)" }}
                >
                  <div className="flex items-center gap-1.5">
                    {o.status === "pending_moderation" && (
                      <>
                        <button
                          onClick={() => {
                            haptic("medium");
                            let nextStatus = "in_progress";
                            if (o.scheduled_time) {
                              try {
                                const parts = o.scheduled_time.split(":");
                                if (parts.length === 2) {
                                  const now = new Date();
                                  const sch = new Date();
                                  sch.setHours(parseInt(parts[0], 10), parseInt(parts[1], 10), 0, 0);
                                  const diffMins = (sch.getTime() - now.getTime()) / 60000;
                                  if (diffMins > 30) {
                                    nextStatus = "confirmed";
                                  }
                                }
                              } catch { /* ignore */ }
                            }
                            updateOrder.mutate({
                              orderId: o.id,
                              payload: { status: nextStatus },
                            });
                          }}
                          className="app-press rounded-xl px-3 py-1.5 text-xs font-semibold"
                          style={{
                            background: "var(--tg-theme-button-color)",
                            color: "var(--tg-theme-button-text-color)",
                          }}
                        >
                          ✅ Підтвердити
                        </button>
                        <button
                          onClick={() => {
                            haptic("medium");
                            updateOrder.mutate({
                              orderId: o.id,
                              payload: { status: "rejected" },
                            });
                          }}
                          className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                          style={{
                            background: "color-mix(in srgb, #ef4444 15%, transparent)",
                            color: "#ef4444",
                          }}
                        >
                          ❌ Відхилити
                        </button>
                      </>
                    )}
                    {o.status === "confirmed" && (
                      <button
                        onClick={() => {
                          haptic("light");
                          updateOrder.mutate({
                            orderId: o.id,
                            payload: { status: "in_progress" },
                          });
                        }}
                        className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                        style={{
                          background: "color-mix(in srgb, #3b82f6 15%, transparent)",
                          color: "#3b82f6",
                        }}
                      >
                        👨‍🍳 Готувати
                      </button>
                    )}
                    {(o.status === "in_progress" || o.status === "cooking") && (
                      o.fulfillment_type === "delivery" ? (
                        <button
                          onClick={() => {
                            haptic("light");
                            updateOrder.mutate({
                              orderId: o.id,
                              payload: { status: "on_the_way" },
                            });
                          }}
                          className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                          style={{
                            background: "color-mix(in srgb, #06b6d4 15%, transparent)",
                            color: "#0891b2",
                          }}
                        >
                          🛵 В дорозі
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            haptic("light");
                            updateOrder.mutate({
                              orderId: o.id,
                              payload: { status: "ready" },
                            });
                          }}
                          className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                          style={{
                            background: "color-mix(in srgb, #8b5cf6 15%, transparent)",
                            color: "#8b5cf6",
                          }}
                        >
                          🛍️ Готово
                        </button>
                      )
                    )}
                    {(o.status === "ready" || o.status === "ready_for_pickup" || o.status === "on_the_way" || o.status === "delivering") && (
                      <button
                        onClick={() => {
                          haptic("light");
                          updateOrder.mutate({
                            orderId: o.id,
                            payload: { status: "completed" },
                          });
                        }}
                        className="app-press rounded-xl px-2.5 py-1.5 text-xs font-semibold"
                        style={{
                          background: "color-mix(in srgb, #10b981 15%, transparent)",
                          color: "#10b981",
                        }}
                      >
                        🏁 Виконано
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      haptic("light");
                      setEditingOrderId(o.id);
                    }}
                    className="app-press rounded-xl px-3 py-1.5 text-xs font-semibold border"
                    style={{ borderColor: "var(--app-border)" }}
                  >
                    ✏️ Змінити замовлення
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingOrderId !== null && (
        <OrderEditModal
          orderId={editingOrderId}
          onClose={() => {
            setEditingOrderId(null);
            onCloseEditingOrder?.();
            try {
              const url = new URL(window.location.href);
              if (url.searchParams.has("order_id") || url.searchParams.has("edit_order")) {
                url.searchParams.delete("order_id");
                url.searchParams.delete("edit_order");
                window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
              }
            } catch {}
          }}
        />
      )}
    </div>
  );
}
