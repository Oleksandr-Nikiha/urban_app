import type React from "react";

export interface CustomerInfoFieldsProps {
  name: string;
  setName: (v: string) => void;
  phone: string;
  onPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhoneKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  saveDetails: boolean;
  setSaveDetails: (v: boolean) => void;
  isAsap: boolean;
  setIsAsap: (v: boolean) => void;
  scheduledTime: string;
  setScheduledTime: (v: string) => void;
  paymentMethod: "cash" | "card";
  setPaymentMethod: (v: "cash" | "card") => void;
  comment: string;
  setComment: (v: string) => void;
  isPhoneVerified?: boolean;
}

export function CustomerInfoFields({
  name,
  setName,
  phone,
  onPhoneChange,
  onPhoneKeyDown,
  saveDetails,
  setSaveDetails,
  isAsap,
  setIsAsap,
  scheduledTime,
  setScheduledTime,
  paymentMethod,
  setPaymentMethod,
  comment,
  setComment,
  isPhoneVerified = false,
}: CustomerInfoFieldsProps) {
  return (
    <div className="space-y-5">
      {/* Контактні дані */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-[#94A3B8] mb-1">
            Ваше ім'я *
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Як до вас звертатися?"
            className="w-full bg-[#121417] border border-white/10 text-white placeholder:text-[#64748B] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#D34528)]/40"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-bold text-[#94A3B8]">
              Номер телефону *
            </label>
            {isPhoneVerified && (
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.2 rounded-full border border-emerald-500/30">
                ✓ Верифіковано
              </span>
            )}
          </div>
          <input
            type="tel"
            required
            value={phone}
            onChange={onPhoneChange}
            onKeyDown={onPhoneKeyDown}
            disabled={isPhoneVerified}
            placeholder="+380 (XX) XXX-XX-XX"
            className={`w-full border rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-tight ${
              isPhoneVerified
                ? "bg-[#1A1D24] border-white/10 text-[#94A3B8] opacity-80 cursor-not-allowed"
                : "bg-[#121417] border-white/10 text-white placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#D34528)]/40"
            }`}
          />
        </div>
      </div>

      {/* Чекбокс запам'ятати мої дані */}
      <label className="flex items-center gap-2.5 text-xs text-[#94A3B8] cursor-pointer select-none">
        <input
          type="checkbox"
          checked={saveDetails}
          onChange={(e) => setSaveDetails(e.target.checked)}
          className="accent-[var(--brand-primary,#D34528)] w-4 h-4 rounded"
        />
        <span>Запам'ятати мої контактні дані для наступних замовлень</span>
      </label>

      {/* Час отримання */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
          Час отримання
        </label>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm font-semibold text-white cursor-pointer">
            <input
              type="radio"
              name="time_type"
              checked={isAsap}
              onChange={() => setIsAsap(true)}
              className="accent-[var(--brand-primary,#D34528)]"
            />
            <span>Якнайшвидше (від 30 хв)</span>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-white cursor-pointer">
            <input
              type="radio"
              name="time_type"
              checked={!isAsap}
              onChange={() => setIsAsap(false)}
              className="accent-[var(--brand-primary,#D34528)]"
            />
            <span>На певний час</span>
          </label>
        </div>
        {!isAsap && (
          <input
            type="text"
            value={scheduledTime}
            onChange={(e) => setScheduledTime(e.target.value)}
            placeholder="Наприклад: 14:30 або на завтра 09:00"
            className="w-full bg-[#121417] border border-white/10 text-white placeholder:text-[#64748B] rounded-xl px-3.5 py-2.5 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#D34528)]/40"
          />
        )}
      </div>

      {/* Спосіб оплати */}
      <div className="space-y-2">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
          Спосіб оплати
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPaymentMethod("cash")}
            className={`p-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              paymentMethod === "cash"
                ? "border-[var(--brand-primary,#D34528)] bg-[var(--brand-primary,#D34528)]/15 text-white ring-2 ring-[var(--brand-primary,#D34528)]/20"
                : "border-white/10 bg-[#121417] text-[#94A3B8] hover:text-white"
            }`}
          >
            <span>💵</span>
            <span>Готівка</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod("card")}
            className={`p-3 rounded-2xl border text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
              paymentMethod === "card"
                ? "border-[var(--brand-primary,#D34528)] bg-[var(--brand-primary,#D34528)]/15 text-white ring-2 ring-[var(--brand-primary,#D34528)]/20"
                : "border-white/10 bg-[#121417] text-[#94A3B8] hover:text-white"
            }`}
          >
            <span>💳</span>
            <span>Карткою при отриманні</span>
          </button>
        </div>
      </div>

      {/* Коментар */}
      <div>
        <label className="block text-xs font-bold text-[#94A3B8] mb-1">
          Коментар до замовлення
        </label>
        <textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Побажання щодо пакування, код домофону тощо..."
          className="w-full bg-[#121417] border border-white/10 text-white placeholder:text-[#64748B] rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#D34528)]/40"
        />
      </div>
    </div>
  );
}
