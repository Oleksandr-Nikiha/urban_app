import { useEffect, useState } from "react";
import { registerCustomer } from "../api/client";
import type { CustomerData } from "../types";

interface RegisterCustomerModalProps {
  isOpen: boolean;
  initialPhone?: string;
  onClose: () => void;
  onSuccess: (customer: CustomerData) => void;
}

export function RegisterCustomerModal({
  isOpen,
  initialPhone = "",
  onClose,
  onSuccess,
}: RegisterCustomerModalProps) {
  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState("Client");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPhone(initialPhone);
      setName("Client");
      setErrorMsg(null);
    }
  }, [isOpen, initialPhone]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) {
      setErrorMsg("Введіть номер телефону гостя");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await registerCustomer(cleanPhone, name.trim() || "Client");
      onSuccess(res.customer);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Помилка реєстрації гостя");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#13171F] border border-white/10 rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className="text-xl">👤➕</span>
            <div>
              <h3 className="font-bold text-white text-sm">Реєстрація гостя</h3>
              <p className="text-[11px] text-zinc-400">URBAN CLUB лояльність</p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center">
              {errorMsg}
            </div>
          )}

          {/* Bonus Info Banner */}
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 flex items-start space-x-2.5">
            <span className="text-lg leading-none">🎁</span>
            <div className="text-[11px] text-amber-200/90 leading-tight">
              <span className="font-bold text-amber-400 block">50 вітальних бонусів</span>
              Після реєстрації клієнт отримає 50 ₴ на бонусний рахунок та зможе списувати їх у закладі.
            </div>
          </div>

          {/* Phone Field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-400 block uppercase tracking-wider">
              Номер телефону
            </label>
            <input
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0631234567 або +380..."
              autoFocus
              className="w-full bg-[#1A1F2B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <p className="text-[10px] text-zinc-500">
              Формат будь-який — система автоматично збереже як <span className="text-zinc-300 font-mono">+380...</span>
            </p>
          </div>

          {/* Name Field */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-zinc-400 block uppercase tracking-wider">
              Імʼя гостя
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Client"
              className="w-full bg-[#1A1F2B] border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
            />
            <p className="text-[10px] text-zinc-500">
              Стандартне імʼя — <span className="text-zinc-300 font-semibold">Client</span>, або вкажіть реальне імʼя гостя.
            </p>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="py-3 rounded-2xl bg-white/5 hover:bg-white/10 disabled:opacity-40 text-zinc-300 font-bold text-xs cursor-pointer transition-colors"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-95 disabled:opacity-40 text-black font-extrabold text-xs shadow-lg shadow-amber-500/20 flex items-center justify-center space-x-1.5 cursor-pointer transition-all"
            >
              {loading ? (
                <span>Реєстрація...</span>
              ) : (
                <>
                  <span>Зареєструвати</span>
                  <span className="text-[11px] opacity-75">(+50 ₴)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
