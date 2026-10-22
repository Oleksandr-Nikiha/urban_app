import { useState } from "react";
import { toggleItemServed } from "../api/client";
import type { PosOrder } from "../types";
import { CloseTableModal } from "./CloseTableModal";

interface ActiveOrdersViewProps {
  orders: PosOrder[];
  onRefresh: () => void;
  onUpdateStatus: (orderId: number, statusVal: string) => Promise<void>;
  onAppendToOrder?: (order: PosOrder) => void;
}

export function ActiveOrdersView({
  orders,
  onRefresh,
  onUpdateStatus,
  onAppendToOrder,
}: ActiveOrdersViewProps) {
  const [filter, setFilter] = useState<"all" | "active" | "completed">("active");
  const [closingOrder, setClosingOrder] = useState<PosOrder | null>(null);
  const [togglingItemId, setTogglingItemId] = useState<number | null>(null);

  const filteredOrders = orders.filter((o) => {
    if (filter === "active") return o.status === "in_progress" || o.status === "ready";
    if (filter === "completed") return o.status === "completed" || o.status === "cancelled";
    return true;
  });

  const handleToggleServed = async (itemId: number) => {
    setTogglingItemId(itemId);
    try {
      await toggleItemServed(itemId);
      onRefresh();
    } catch (err) {
      console.error("Error toggling item served:", err);
    } finally {
      setTogglingItemId(null);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0B0D11] p-3 sm:p-5 md:p-6 overflow-hidden select-none pb-[calc(2.5rem+env(safe-area-inset-bottom,20px))]">
      {/* Top Bar Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-white/10 shrink-0 gap-2 sm:gap-4">
        <div className="flex items-center justify-between sm:justify-start space-x-3">
          <h2 className="text-base sm:text-lg font-bold text-white">Замовлення закладу</h2>
          <button
            type="button"
            onClick={onRefresh}
            className="p-1.5 sm:p-2 rounded-xl bg-[#13171F] border border-white/10 text-zinc-400 hover:text-white text-xs cursor-pointer active:scale-95 transition-all"
            title="Оновити"
          >
            🔄
          </button>
        </div>

        {/* Status filter tabs */}
        <div className="flex bg-[#13171F] p-1 rounded-xl border border-white/5 space-x-1 overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "active"
                ? "bg-amber-500 text-black shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            🔥 В роботі ({orders.filter((o) => o.status === "in_progress" || o.status === "ready").length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "completed"
                ? "bg-amber-500 text-black shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            ✅ Видані
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === "all"
                ? "bg-amber-500 text-black shadow"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            Всі
          </button>
        </div>
      </div>

      {/* Orders grid */}
      <div className="flex-1 overflow-y-auto py-3 sm:py-4">
        {filteredOrders.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
            <span className="text-3xl sm:text-4xl">📋</span>
            <p className="text-xs sm:text-sm font-semibold">Немає замовлень у цій категорії</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 pb-12 sm:pb-6">
            {filteredOrders.map((order) => {
              const isReady = order.status === "ready";
              const isCompleted = order.status === "completed";
              const isDineIn = order.fulfillment_type === "dine_in";

              return (
                <div
                  key={order.id}
                  className={`bg-[#13171F] border rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between transition-all shadow ${
                    isReady
                      ? "border-emerald-500/40 shadow-emerald-500/5"
                      : isCompleted
                      ? "border-white/5 opacity-70"
                      : "border-amber-500/30"
                  }`}
                >
                  <div>
                    {/* Order card top */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-extrabold text-white">
                          #{order.id}
                        </span>
                        {order.table_number ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold text-xs border border-amber-500/30">
                            Стіл #{order.table_number}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-sky-500/20 text-sky-300 font-bold text-xs border border-sky-500/30">
                            З собою
                          </span>
                        )}
                        {/* Payment badge */}
                        {order.is_paid ? (
                          <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-semibold text-[10px] border border-emerald-500/20">
                            ✓ {order.payment_method === "cash" ? "Готівка" : "Картка"}
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-300 font-semibold text-[10px] border border-amber-500/20 animate-pulse">
                            Не сплачено
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-zinc-400">
                        {order.time_str}
                      </span>
                    </div>

                    {/* Staff & Guest info */}
                    <div className="text-[11px] text-zinc-400 mb-2.5 flex items-center space-x-1.5 flex-wrap">
                      <span>👤 {order.staff_name || "Персонал"}</span>
                      {order.contact_name && (
                        <>
                          <span>•</span>
                          <span>Гість: {order.contact_name}</span>
                        </>
                      )}
                    </div>

                    {/* Interactive Items List */}
                    <div className="bg-[#0B0D11] rounded-xl p-2 sm:p-2.5 border border-white/5 mb-3 max-h-56 overflow-y-auto space-y-1">
                      {order.items && order.items.length > 0 ? (
                        order.items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between py-1 px-1 rounded-lg hover:bg-white/5 transition-colors text-xs border-b border-white/5 last:border-0"
                          >
                            <div className="flex items-center space-x-2 flex-1 pr-2 min-w-0">
                              <button
                                type="button"
                                disabled={togglingItemId === item.id}
                                onClick={() => handleToggleServed(item.id)}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all cursor-pointer shrink-0 ${
                                  item.is_served
                                    ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                    : "bg-white/5 border-white/10 text-zinc-400 hover:text-white"
                                }`}
                                title="Натисніть щоб відмітити винесення страви"
                              >
                                {item.is_served ? "✓ Подано" : "⬜ Подати"}
                              </button>
                              <span
                                className={`truncate font-medium ${
                                  item.is_served ? "line-through text-zinc-500" : "text-zinc-200"
                                }`}
                              >
                                {item.product_name}
                                {item.variant_label ? ` (${item.variant_label})` : ""}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <span className="text-zinc-400 font-semibold">×{item.qty}</span>
                              <span className="text-white font-bold">{item.subtotal} ₴</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-zinc-200 leading-relaxed font-medium p-1">
                          {order.items_summary}
                        </p>
                      )}

                      {order.comment && (
                        <p className="text-[11px] text-amber-400/90 italic pt-1 border-t border-white/5">
                          💬 {order.comment}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Card bottom: total and action buttons */}
                  <div className="pt-2 border-t border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-zinc-400 uppercase">
                          {order.is_paid ? "Сплачено" : "Рахунок"}
                        </p>
                        <p className="text-sm font-extrabold text-white">
                          {order.total_price} ₴
                        </p>
                      </div>

                      {/* Append items button for active tables */}
                      {onAppendToOrder && !isCompleted && isDineIn && (
                        <button
                          type="button"
                          onClick={() => onAppendToOrder(order)}
                          className="px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-bold border border-amber-500/20 transition-all cursor-pointer active:scale-95 flex items-center space-x-1"
                        >
                          <span>➕</span>
                          <span>Дозамовити</span>
                        </button>
                      )}
                    </div>

                    {/* Action buttons row */}
                    <div className="flex items-center justify-end space-x-2">
                      {/* Settle / Close table button */}
                      {!order.is_paid && !isCompleted && (
                        <button
                          type="button"
                          onClick={() => setClosingOrder(order)}
                          className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer active:scale-95 flex items-center space-x-1"
                        >
                          <span>💳</span>
                          <span>Розрахувати стіл</span>
                        </button>
                      )}

                      {/* Ready button */}
                      {order.status === "in_progress" && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(order.id, "ready")}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all cursor-pointer shadow active:scale-95"
                        >
                          ✓ Готово
                        </button>
                      )}

                      {/* Completed / Delivered button */}
                      {order.status === "ready" && order.is_paid && (
                        <button
                          type="button"
                          onClick={() => onUpdateStatus(order.id, "completed")}
                          className="px-3 py-1.5 rounded-xl bg-[#1A1F2B] hover:bg-[#252D40] text-zinc-300 hover:text-white text-xs font-bold border border-white/10 transition-all cursor-pointer active:scale-95"
                        >
                          Закрити
                        </button>
                      )}

                      {order.status === "completed" && (
                        <span className="text-xs font-bold text-emerald-400 flex items-center space-x-1">
                          <span>✓</span>
                          <span>Закрито</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Close Table Settlement Modal */}
      {closingOrder && (
        <CloseTableModal
          order={closingOrder}
          onClose={() => setClosingOrder(null)}
          onSuccess={() => {
            setClosingOrder(null);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}
