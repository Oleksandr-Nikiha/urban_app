import { useState } from "react";
import { cancelPosOrder } from "../api/client";
import type { PosOrder } from "../types";

interface CancelOrderModalProps {
  order: PosOrder;
  staffName?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_REASONS = [
  "Помилка введення офіціанта",
  "Гість відмовився від замовлення",
  "Страва закінчилась (стоп-лист)",
  "Помилковий дублікат чеку",
  "Гість пішов не дочекавшись",
];

export function CancelOrderModal({
  order,
  staffName,
  onClose,
  onSuccess,
}: CancelOrderModalProps) {
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirm = async () => {
    if (!reason.trim()) {
      setErrorMsg("Будь ласка, вкажіть причину скасування");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await cancelPosOrder(order.id, reason.trim(), staffName);
      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || "Помилка при скасуванні замовлення");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-[#13171F] border border-rose-500/30 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="text-xl">⚠️</span>
            <h3 className="text-base sm:text-lg font-bold text-white">
              Скасування чеку #{order.id}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Order Summary badge */}
          <div className="p-3 bg-[#0B0D11] rounded-2xl border border-white/5 flex items-center justify-between">
            <div>
              <p className="text-xs text-zinc-400">
                {order.table_number ? `Стіл #${order.table_number}` : "Замовлення з собою"}
                {order.contact_name ? ` • ${order.contact_name}` : ""}
              </p>
              <p className="text-sm font-bold text-white">
                Сума: {order.total_price} ₴
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-rose-500/10 text-rose-400 text-xs font-bold border border-rose-500/20">
              Повне скасування
            </span>
          </div>

          {/* Warning banner */}
          <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 text-rose-300 text-xs leading-relaxed">
            📢 <strong>Увага:</strong> скасування чеку фіксується в аудиті та надсилається сповіщенням адміністрації в Telegram. Якщо замовлення списувало бонуси гостя, вони повертаються автоматично.
          </div>

          {/* Quick Reasons Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">
              Швидкі причини:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer text-left ${
                    reason === r
                      ? "bg-rose-500/20 border-rose-500/50 text-rose-200"
                      : "bg-[#0B0D11] border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Reason Text Area */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-zinc-300">
              Причина скасування (обов&apos;язково):
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Вкажіть конкретну причину скасування замовлення..."
              className="w-full bg-[#0B0D11] border border-white/10 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-rose-500 transition-colors resize-none"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-500/20 rounded-xl border border-rose-500/40 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-end space-x-2 shrink-0">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs sm:text-sm font-semibold transition-all cursor-pointer"
          >
            Назад
          </button>
          <button
            type="button"
            disabled={loading || !reason.trim()}
            onClick={handleConfirm}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-lg shadow-rose-600/30 transition-all cursor-pointer active:scale-95 flex items-center space-x-1.5"
          >
            {loading ? (
              <span>Скасування...</span>
            ) : (
              <>
                <span>❌</span>
                <span>Підтвердити скасування</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
