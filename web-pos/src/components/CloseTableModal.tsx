import { useState } from "react";
import { closeTableOrder, lookupCustomer } from "../api/client";
import type { CustomerData, PosOrder } from "../types";

interface CloseTableModalProps {
  order: PosOrder;
  onClose: () => void;
  onSuccess: () => void;
}

export function CloseTableModal({ order, onClose, onSuccess }: CloseTableModalProps) {
  const [customerPhone, setCustomerPhone] = useState(order.contact_phone || "");
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [bonusSpent, setBonusSpent] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subtotal = order.total_price;
  const finalTotal = Math.max(0, subtotal - bonusSpent);

  const handleLookup = async () => {
    if (!customerPhone.trim()) return;
    setLookingUp(true);
    setErrorMsg(null);
    try {
      const res = await lookupCustomer(customerPhone);
      setCustomer(res);
      if (!res.found) {
        setErrorMsg("Гостя за таким номером не знайдено");
      }
    } catch {
      setErrorMsg("Помилка пошуку клієнта");
    } finally {
      setLookingUp(false);
    }
  };

  const handleToggleBonus = () => {
    if (!customer) return;
    if (bonusSpent > 0) {
      setBonusSpent(0);
    } else {
      const toSpend = Math.min(subtotal, customer.bonus_balance);
      setBonusSpent(toSpend);
    }
  };

  const handleClose = async (method: "cash" | "card") => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await closeTableOrder(order.id, {
        payment_method: method,
        bonus_spent: bonusSpent,
        customer_phone: customerPhone || undefined,
        customer_name: customer?.first_name || order.contact_name || undefined,
      });
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Не вдалося закрити стіл");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#13171F] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">💳</span>
            <div>
              <h3 className="font-bold text-white text-sm">Розрахунок столу</h3>
              <p className="text-[11px] text-zinc-400">
                Стіл #{order.table_number || "—"} • Чек #{order.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* Loyalty Search */}
          <div className="bg-[#0B0D11] border border-white/5 rounded-2xl p-3 space-y-2">
            <span className="text-[11px] font-bold text-zinc-400 block uppercase tracking-wider">
              Картка лояльності гостя
            </span>
            <div className="flex items-center space-x-2">
              <input
                type="tel"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, ""))}
                onKeyDown={(e) => e.key === "Enter" && handleLookup()}
                placeholder="0631234567"
                className="flex-1 bg-[#1A1F2B] border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <button
                type="button"
                onClick={handleLookup}
                disabled={lookingUp || !customerPhone}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 text-xs font-bold text-zinc-200 cursor-pointer"
              >
                {lookingUp ? "..." : "Знайти"}
              </button>
            </div>

            {customer && customer.found && (
              <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-emerald-400">
                    {customer.first_name || "Гість"}
                  </p>
                  <p className="text-[10px] text-zinc-400">
                    Баланс: <span className="font-bold text-amber-400">{customer.bonus_balance} ₴</span>
                  </p>
                </div>
                {customer.bonus_balance > 0 && subtotal > 0 && (
                  <button
                    type="button"
                    onClick={handleToggleBonus}
                    className={`text-[10px] font-bold px-2 py-1 rounded-lg border cursor-pointer ${
                      bonusSpent > 0
                        ? "bg-amber-500 border-amber-400 text-black shadow"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                    }`}
                  >
                    {bonusSpent > 0 ? `Списано -${bonusSpent} ₴` : "Списати"}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="bg-[#0B0D11] border border-white/5 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex justify-between text-xs text-zinc-400">
              <span>Сума замовлення</span>
              <span className="font-semibold text-white">{subtotal} ₴</span>
            </div>
            {bonusSpent > 0 && (
              <div className="flex justify-between text-xs text-emerald-400 font-semibold">
                <span>Бонуси</span>
                <span>-{bonusSpent} ₴</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-2 border-t border-white/5">
              <span className="text-xs font-bold text-zinc-300">Сума до сплати</span>
              <span className="text-2xl font-black text-amber-400">{finalTotal} ₴</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 pt-1 pb-2">
            <button
              type="button"
              disabled={loading}
              onClick={() => handleClose("cash")}
              className="py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-xs shadow-lg shadow-emerald-600/20 flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
            >
              <span className="text-lg">💵</span>
              <span>Готівка</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handleClose("card")}
              className="py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 flex flex-col items-center justify-center space-y-1 cursor-pointer transition-all active:scale-95"
            >
              <span className="text-lg">💳</span>
              <span>Картка / Термінал</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
