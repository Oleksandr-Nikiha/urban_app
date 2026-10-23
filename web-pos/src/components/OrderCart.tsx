import { useState } from "react";
import type { CartItem, CustomerData } from "../types";

interface OrderCartProps {
  items: CartItem[];
  onUpdateQty: (cartId: string, delta: number) => void;
  onRemoveItem: (cartId: string) => void;
  onClearCart: () => void;
  fulfillmentType: "dine_in" | "pickup";
  onFulfillmentTypeChange: (type: "dine_in" | "pickup") => void;
  tableNumber: string;
  onTableNumberChange: (table: string) => void;
  customer: CustomerData | null;
  customerQuery: string;
  onCustomerQueryChange: (q: string) => void;
  onLookupCustomer: () => void;
  bonusSpent: number;
  onToggleBonus: () => void;
  orderComment: string;
  onOrderCommentChange: (c: string) => void;
  onStartPayment: (method: "cash" | "card") => void;
  onSendToKitchen?: () => void;
  appendingOrderId?: number | null;
  onAppendConfirm?: () => void;
  onCancelAppend?: () => void;
  onBackToMenu?: () => void;
}

export function OrderCart({
  items,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  fulfillmentType,
  onFulfillmentTypeChange,
  tableNumber,
  onTableNumberChange,
  customer,
  customerQuery,
  onCustomerQueryChange,
  onLookupCustomer,
  bonusSpent,
  onToggleBonus,
  orderComment,
  onOrderCommentChange,
  onStartPayment,
  onSendToKitchen,
  appendingOrderId,
  onAppendConfirm,
  onCancelAppend,
  onBackToMenu,
}: OrderCartProps) {
  const [showCommentInput, setShowCommentInput] = useState(false);

  const subtotal = items.reduce((acc, curr) => acc + curr.unit_price * curr.qty, 0);
  const finalTotal = Math.max(0, subtotal - bonusSpent);

  return (
    <aside className="w-full lg:w-[400px] xl:w-[440px] bg-[#13171F] lg:border-l border-white/10 flex flex-col h-full select-none shrink-0">
      {/* Header & Order Type Switcher */}
      <div className="p-3 sm:p-4 border-b border-white/10 space-y-3">
        {appendingOrderId && (
          <div className="bg-amber-500/20 border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between">
            <div className="text-xs">
              <span className="font-extrabold text-amber-300">➕ Дозамовлення</span>
              <p className="text-[11px] text-zinc-300">
                Стіл #{tableNumber} • Замовлення #{appendingOrderId}
              </p>
            </div>
            {onCancelAppend && (
              <button
                type="button"
                onClick={onCancelAppend}
                className="px-2 py-1 rounded-lg bg-black/40 hover:bg-black/60 text-zinc-300 text-[10px] font-bold cursor-pointer"
              >
                Скасувати
              </button>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {onBackToMenu && (
              <button
                type="button"
                onClick={onBackToMenu}
                className="lg:hidden p-1.5 -ml-1 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center space-x-1 cursor-pointer"
              >
                <span>←</span>
                <span>Меню</span>
              </button>
            )}
            <span className="text-lg">🧾</span>
            <h2 className="font-bold text-sm text-white uppercase tracking-wider">
              {appendingOrderId ? `Дозамовлення #${appendingOrderId}` : "Поточний чек"}
            </h2>
          </div>
          {items.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-xs text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
            >
              Очистити
            </button>
          )}
        </div>

        {/* Fulfillment type toggle */}
        {!appendingOrderId && (
          <>
            <div className="grid grid-cols-2 gap-2 bg-[#0B0D11] p-1 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => onFulfillmentTypeChange("dine_in")}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  fulfillmentType === "dine_in"
                    ? "bg-amber-500 text-black shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>🍽️</span>
                <span>В закладі</span>
              </button>
              <button
                type="button"
                onClick={() => onFulfillmentTypeChange("pickup")}
                className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
                  fulfillmentType === "pickup"
                    ? "bg-amber-500 text-black shadow-md"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span>🛍️</span>
                <span>Takeaway</span>
              </button>
            </div>

            {/* Table number selector for Dine-In */}
            {fulfillmentType === "dine_in" && (
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-zinc-400 whitespace-nowrap">Стіл:</span>
                <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5 flex-1">
                  {["1", "2", "3", "4", "5", "6", "Бар"].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onTableNumberChange(t)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all cursor-pointer shrink-0 ${
                        tableNumber === t
                          ? "bg-amber-500/20 border-amber-500 text-amber-300"
                          : "bg-[#1A1F2B] border-white/5 text-zinc-400 hover:text-white"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={tableNumber}
                  onChange={(e) => onTableNumberChange(e.target.value)}
                  placeholder="№"
                  className="w-12 bg-[#1A1F2B] border border-white/10 rounded-lg px-1.5 py-1 text-center text-xs text-white font-bold focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Cart Items List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {items.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2">
            <span className="text-4xl">🛒</span>
            <p className="text-xs font-semibold">Чек порожній</p>
            <p className="text-[11px] text-zinc-600 text-center max-w-[200px]">
              Натисніть на страву в меню, щоб додати її до замовлення
            </p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.cart_id}
              className="bg-[#1A1F2B] border border-white/5 rounded-2xl p-3 flex flex-col space-y-2 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-bold text-white leading-tight">
                      {item.product_name}
                    </span>
                    {item.variant_label && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 text-amber-300 font-semibold">
                        {item.variant_label}
                      </span>
                    )}
                  </div>
                  {item.options.length > 0 && (
                    <p className="text-[10px] text-zinc-400 mt-0.5">
                      {item.options
                        .map((o) => `${o.name}${(o.qty || 1) > 1 ? ` ×${o.qty}` : ""}`)
                        .join(", ")}
                    </p>
                  )}
                  {item.comment && (
                    <p className="text-[10px] text-amber-400/80 italic mt-0.5">
                      💬 {item.comment}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveItem(item.cart_id)}
                  className="text-zinc-500 hover:text-rose-400 text-xs p-1 cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Stepper & Subtotal */}
              <div className="flex items-center justify-between pt-1 border-t border-white/5">
                <div className="flex items-center space-x-1.5 bg-[#13171F] border border-white/5 rounded-xl p-0.5">
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.cart_id, -1)}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-bold text-white flex items-center justify-center cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-5 text-center text-xs font-bold text-white">
                    {item.qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateQty(item.cart_id, 1)}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-white/10 active:scale-95 text-xs font-bold text-white flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </div>
                <span className="text-xs font-extrabold text-white">
                  {item.unit_price * item.qty} ₴
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer Loyalty & Comment Drawer */}
      <div className="p-3 sm:p-4 border-t border-white/10 bg-[#0E1117] space-y-2.5 sm:space-y-3 pb-12 sm:pb-6 shrink-0">
        {/* Customer Search / URBAN CLUB */}
        <div className="bg-[#13171F] border border-white/5 rounded-xl p-2.5">
          <div className="flex items-center space-x-2">
            <span className="text-xs">💳</span>
            <input
              type="tel"
              inputMode="numeric"
              pattern="[0-9]*"
              value={customerQuery}
              onChange={(e) => onCustomerQueryChange(e.target.value.replace(/\D/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && onLookupCustomer()}
              placeholder="Телефон (лише цифри, напр. 063...)"
              className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={onLookupCustomer}
              className="text-[11px] font-bold px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-zinc-300 cursor-pointer"
            >
              Знайти
            </button>
          </div>

          {/* Customer result */}
          {customer && customer.found && (
            <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-emerald-400">
                  {customer.first_name || "Гість"}
                </p>
                <p className="text-[10px] text-zinc-400">
                  Бонуси: <span className="font-bold text-amber-400">{customer.bonus_balance} ₴</span>
                </p>
              </div>
              {fulfillmentType !== "dine_in" && customer.bonus_balance > 0 && subtotal > 0 && (
                <button
                  type="button"
                  onClick={onToggleBonus}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    bonusSpent > 0
                      ? "bg-amber-500 border-amber-400 text-black shadow"
                      : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                  }`}
                >
                  {bonusSpent > 0 ? `Списано -${bonusSpent} ₴` : "Списати бонуси"}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Kitchen comment input toggle */}
        {showCommentInput ? (
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={orderComment}
              onChange={(e) => onOrderCommentChange(e.target.value)}
              placeholder="Загальний коментар на кухню..."
              className="flex-1 bg-[#13171F] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <button
              type="button"
              onClick={() => setShowCommentInput(false)}
              className="text-zinc-500 hover:text-white text-xs px-2 cursor-pointer"
            >
              ✕
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCommentInput(true)}
            className="text-[11px] text-zinc-400 hover:text-amber-400 flex items-center space-x-1 cursor-pointer transition-colors"
          >
            <span>💬</span>
            <span>+ Додати коментар до всього чека</span>
          </button>
        )}

        {/* Totals */}
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span>Сума замовлення</span>
            <span>{subtotal} ₴</span>
          </div>
          {fulfillmentType !== "dine_in" && bonusSpent > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-400 font-semibold">
              <span>Списано бонусів</span>
              <span>-{bonusSpent} ₴</span>
            </div>
          )}
          <div className="flex items-center justify-between text-base font-extrabold text-white pt-1">
            <span>{fulfillmentType === "dine_in" && !appendingOrderId ? "Попередній рахунок" : "До сплати"}</span>
            <span className="text-xl text-amber-400">
              {fulfillmentType === "dine_in" && !appendingOrderId ? subtotal : finalTotal} ₴
            </span>
          </div>
        </div>

        {/* Action Buttons: depending on Dine-in / Takeaway / Appending */}
        <div className="pt-1">
          {appendingOrderId ? (
            <button
              type="button"
              disabled={items.length === 0}
              onClick={onAppendConfirm}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none active:scale-98 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all"
            >
              <span className="text-base">👨‍🍳</span>
              <span>Відправити дозамовлення на кухню</span>
            </button>
          ) : fulfillmentType === "dine_in" ? (
            <button
              type="button"
              disabled={items.length === 0}
              onClick={onSendToKitchen}
              className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none active:scale-98 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all"
            >
              <span className="text-base">👨‍🍳</span>
              <span>Відправити замовлення на кухню (Стіл #{tableNumber || "1"})</span>
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => onStartPayment("cash")}
                className="py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none active:scale-98 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 flex flex-col items-center justify-center space-y-0.5 cursor-pointer transition-all"
              >
                <span className="text-base">💵</span>
                <span>Готівка</span>
              </button>
              <button
                type="button"
                disabled={items.length === 0}
                onClick={() => onStartPayment("card")}
                className="py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:pointer-events-none active:scale-98 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 flex flex-col items-center justify-center space-y-0.5 cursor-pointer transition-all"
              >
                <span className="text-base">💳</span>
                <span>Картка / POS</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
