import { useState } from "react";

interface PaymentModalProps {
  method: "cash" | "card";
  totalAmount: number;
  tableNumber: string;
  fulfillmentType: "dine_in" | "pickup";
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export function PaymentModal({
  method,
  totalAmount,
  tableNumber,
  fulfillmentType,
  onClose,
  onConfirm,
}: PaymentModalProps) {
  const [cashReceived, setCashReceived] = useState<number>(totalAmount);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const change = Math.max(0, cashReceived - totalAmount);

  const handleCashPreset = (amount: number) => {
    setCashReceived(amount);
  };

  const handlePay = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await onConfirm();
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message || "Помилка обробки платежу");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
      <div className="w-full max-w-md bg-[#13171F] border-t sm:border border-white/10 rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        {success ? (
          <div className="py-10 flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center text-3xl sm:text-4xl text-emerald-400 shadow-xl shadow-emerald-500/20 animate-bounce">
              ✓
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">Чек сплачено!</h2>
            <p className="text-xs text-zinc-400">Замовлення передано на кухню</p>
          </div>
        ) : (
          <>
            {/* Modal header */}
            <div className="flex items-center justify-between pb-3 sm:pb-4 border-b border-white/10 shrink-0">
              <div className="flex items-center space-x-2.5">
                <span className="text-xl sm:text-2xl">{method === "cash" ? "💵" : "💳"}</span>
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white leading-tight">
                    {method === "cash" ? "Оплата готівкою" : "Оплата карткою (термінал)"}
                  </h2>
                  <p className="text-[10px] sm:text-[11px] text-zinc-400">
                    {fulfillmentType === "dine_in"
                      ? `Стіл #${tableNumber || "—"}`
                      : "Takeaway / З собою"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Total display */}
            <div className="my-4 sm:my-5 p-3.5 sm:p-4 rounded-2xl bg-[#0B0D11] border border-white/5 text-center">
              <p className="text-[11px] sm:text-xs font-semibold text-zinc-400 mb-0.5">
                Сума до сплати
              </p>
              <p className="text-2xl sm:text-3xl font-extrabold text-amber-400">{totalAmount} ₴</p>
            </div>

            {/* Cash change calculator */}
            {method === "cash" && (
              <div className="space-y-3 sm:space-y-4 mb-3 sm:mb-4">
                <label className="text-[11px] sm:text-xs font-bold text-zinc-400 uppercase tracking-wider block">
                  Отримано від клієнта
                </label>
                <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
                  {[totalAmount, 200, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleCashPreset(val)}
                      className={`py-1.5 sm:py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        cashReceived === val
                          ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow"
                          : "bg-[#1A1F2B] border-white/5 text-zinc-300 hover:border-white/20"
                      }`}
                    >
                      {val === totalAmount ? "Без решти" : `${val} ₴`}
                    </button>
                  ))}
                </div>

                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(Number(e.target.value))}
                    className="w-full bg-[#1A1F2B] border border-white/10 rounded-xl px-4 py-2 sm:py-2.5 text-sm font-bold text-white text-center focus:outline-none focus:border-amber-500"
                  />
                </div>

                {cashReceived >= totalAmount && (
                  <div className="p-2.5 sm:p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-300">Решта гостю:</span>
                    <span className="text-sm sm:text-base font-extrabold text-emerald-400">
                      {change} ₴
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Card prompt */}
            {method === "card" && (
              <div className="my-3 sm:my-4 p-4 sm:p-5 rounded-2xl bg-[#1A1F2B] border border-white/5 flex flex-col items-center justify-center space-y-1.5 sm:space-y-2 text-center">
                <span className="text-2xl sm:text-3xl animate-pulse">📡</span>
                <p className="text-xs font-bold text-zinc-200">
                  Прикладіть банківську картку або телефон до терміналу
                </p>
                <p className="text-[10px] sm:text-[11px] text-zinc-400">
                  Після сигналу терміналу підтвердіть замовлення
                </p>
              </div>
            )}

            {errorMsg && (
              <div className="p-3 my-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold text-center animate-bounce">
                {errorMsg}
              </div>
            )}

            {/* Submit button */}
            <button
              type="button"
              disabled={loading || (method === "cash" && cashReceived < totalAmount)}
              onClick={handlePay}
              className="w-full py-3.5 sm:py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-98 disabled:opacity-40 text-black font-extrabold text-xs sm:text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center space-x-2 cursor-pointer transition-all mt-1 sm:mt-2"
            >
              {loading ? (
                <span>Обробка замовлення...</span>
              ) : (
                <>
                  <span>✓</span>
                  <span>
                    {method === "cash" ? `Оплачено (Решта: ${change} ₴)` : "Оплата успішна, закрити"}
                  </span>
                </>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
