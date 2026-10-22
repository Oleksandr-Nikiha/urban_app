import { useState } from "react";
import type { OrderOut } from "../../types/order.ts";

interface OrdersHistoryTabProps {
  orders: OrderOut[];
  loading: boolean;
  onRepeatOrder: (order: OrderOut) => void;
  onOpenTracking: (orderId: number) => void;
  onRefresh: () => void;
}

export function OrdersHistoryTab({
  orders,
  loading,
  onRepeatOrder,
  onOpenTracking,
  onRefresh,
}: OrdersHistoryTabProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return { label: "Виконано 🎉", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "delivering":
      case "on_the_way":
        return { label: "У дорозі 🛵", badge: "bg-amber-100 text-amber-900 border-amber-200" };
      case "ready":
      case "ready_for_pickup":
        return { label: "Готово до видачі 🛍️", badge: "bg-emerald-100 text-emerald-800 border-emerald-200" };
      case "in_progress":
      case "cooking":
        return { label: "Випікається 👨‍🍳", badge: "bg-orange-100 text-orange-900 border-orange-200" };
      case "confirmed":
        return { label: "Підтверджено ✅", badge: "bg-sky-100 text-sky-900 border-sky-200" };
      case "cancelled":
      case "rejected":
        return { label: "Скасовано ❌", badge: "bg-red-100 text-red-800 border-red-200" };
      default:
        return { label: "Очікує підтвердження ⏳", badge: "bg-amber-50 text-amber-800 border-amber-200" };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("uk-UA", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3">
        <div className="w-8 h-8 border-3 border-[#D34528] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-semibold text-[#94A3B8]">Завантажуємо історію замовлень...</p>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-10 px-4 space-y-3 bg-[#181B22] rounded-2xl border border-white/10">
        <span className="text-4xl block">🍕🍣</span>
        <h4 className="font-display text-base font-bold text-white">
          У вас поки немає замовлень
        </h4>
        <p className="text-xs text-[#94A3B8] max-w-sm mx-auto leading-relaxed">
          Оберіть улюблену піцу, свіжі роли або бургер в нашому меню та оформіть перше замовлення!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 text-[#F1F5F9]">
      <div className="flex items-center justify-between text-xs text-[#94A3B8] px-1">
        <span>Знайдено замовлень: <strong className="text-white">{orders.length}</strong></span>
        <button
          type="button"
          onClick={onRefresh}
          className="text-[#E2583E] hover:underline font-bold flex items-center gap-1 cursor-pointer"
        >
          <span>🔄</span>
          <span>Оновити список</span>
        </button>
      </div>

      <div className="space-y-3">
        {orders.map((order) => {
          const st = getStatusBadge(order.status);
          const isExpanded = expandedOrderId === order.id;
          const allItems = order.groups.flatMap((g) => g.items);
          const isDelivery = order.fulfillment_type === "delivery";

          return (
            <div
              key={order.id}
              className="bg-[#181B22] rounded-2xl border border-white/10 overflow-hidden shadow-md hover:border-white/20 transition-all"
            >
              <div className="p-4 space-y-2.5">
                {/* Верхній рядок: ID, Дата і Статус */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-white text-base">
                        #{order.id}
                      </span>
                      <span className="text-xs text-[#94A3B8]">
                        {formatDate(order.created_at)}
                      </span>
                    </div>
                    <div className="text-xs text-[#94A3B8] mt-0.5">
                      {isDelivery ? "🛵 Доставка" : "🛍️ Самовивіз"} • {allItems.length} позицій
                    </div>
                  </div>

                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border ${st.badge} whitespace-nowrap`}>
                    {st.label}
                  </span>
                </div>

                {/* Короткий прев'ю страв */}
                <div className="text-xs text-[#CBD5E1] line-clamp-1">
                  {allItems.map((i) => `${i.product_name} (${i.qty} шт)`).join(", ")}
                </div>

                {/* Розгорнутий перелік страв за кліком */}
                {isExpanded && (
                  <div className="pt-3 border-t border-white/10 space-y-2 animate-in fade-in duration-200">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
                      Склад замовлення:
                    </div>
                    <div className="divide-y divide-white/10 text-xs">
                      {allItems.map((item) => (
                        <div key={item.id} className="py-2 flex items-start justify-between gap-2">
                          <div>
                            <div className="font-bold text-white">{item.product_name}</div>
                            <div className="text-[11px] text-[#94A3B8]">
                              {item.variant_label} • {item.qty} шт × {item.unit_price} ₴
                            </div>
                            {item.options && item.options.length > 0 && (
                              <div className="text-[11px] text-amber-300">
                                + {item.options.map((o) => o.option_name).join(", ")}
                              </div>
                            )}
                          </div>
                          <div className="font-extrabold text-white shrink-0">
                            {item.subtotal} ₴
                          </div>
                        </div>
                      ))}
                    </div>

                    {order.delivery_address && (
                      <div className="text-xs text-[#94A3B8] pt-2 border-t border-white/10">
                        📍 <strong className="text-white">Адреса:</strong> {order.delivery_address}
                      </div>
                    )}
                  </div>
                )}

                {/* Нижній рядок: Сума, бонуси і Дії */}
                <div className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-extrabold text-white">
                      {order.total_price} ₴
                    </div>
                    {((order.bonus_spent && order.bonus_spent > 0) || (order.bonus_earned && order.bonus_earned > 0)) && (
                      <div className="flex items-center gap-2 text-[10px] mt-0.5">
                        {order.bonus_spent ? (
                          <span className="text-amber-400 font-medium">-{order.bonus_spent} б.</span>
                        ) : null}
                        {order.bonus_earned ? (
                          <span className="text-emerald-400 font-bold">+{order.bonus_earned} б. кешбек</span>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                      className="text-xs text-[#94A3B8] hover:text-white px-2 py-1.5 rounded-lg hover:bg-[#222731] font-semibold transition-colors cursor-pointer"
                    >
                      {isExpanded ? "Згорнути ▲" : "Деталі ▼"}
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenTracking(order.id)}
                      className="text-xs bg-[#222731] hover:bg-[#2A313C] text-white border border-white/10 px-2.5 py-1.5 rounded-xl font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span>📍</span>
                      <span>Трекінг</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onRepeatOrder(order)}
                      className="text-xs bg-[#D34528] hover:bg-[#B8351B] text-white px-3 py-1.5 rounded-xl font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1 shadow-xs"
                    >
                      <span>🔁</span>
                      <span>Повторити</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

