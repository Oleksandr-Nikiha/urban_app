import { useState } from "react";
import { authPhoneLogin } from "../../api/client.ts";
import { saveSharedProfile, type UserProfile } from "../../types/user.ts";
import { TelegramLoginWidget, type TelegramUser } from "./TelegramLoginWidget.tsx";

export interface PhoneAuthViewProps {
  onTelegramAuth: (user: TelegramUser) => void;
  onPhoneAuthSuccess?: (profile: UserProfile) => void;
  onCancel?: () => void;
  authReason?: "cabinet" | "checkout" | null;
  brandName?: string;
  cartEmoji?: string;
}

export function PhoneAuthView({
  onTelegramAuth,
  onPhoneAuthSuccess,
  onCancel,
  authReason,
  brandName,
  cartEmoji = "🛍️",
}: PhoneAuthViewProps) {
  const [method, setMethod] = useState<"phone" | "telegram">("phone");
  const [phone, setPhone] = useState("+380");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "urban_bites_tst_bot";

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDigits = phone.replace(/\D/g, "");
    if (cleanDigits.length < 10) {
      setError("Введіть коректний номер телефону (наприклад, +380 67 123 45 67)");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const userOut = await authPhoneLogin({
        phone: phone.trim(),
        full_name: name.trim() || undefined,
      });

      const updated: UserProfile = {
        id: userOut.id,
        name: userOut.full_name || name.trim() || "Клієнт",
        first_name: userOut.first_name || undefined,
        last_name: userOut.last_name || undefined,
        phone: userOut.phone || phone.trim(),
        telegram_id: userOut.telegram_id,
        street: userOut.delivery_address || "",
        additional_address: userOut.additional_address || "",
        house: "",
        apartment: "",
        bonuses: userOut.bonus_balance || 50,
        client_code: userOut.client_code || `UB-${userOut.id}`,
        is_phone_verified: true,
        isAuthenticated: true,
      };

      saveSharedProfile(updated);
      if (onPhoneAuthSuccess) {
        onPhoneAuthSuccess(updated);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Не вдалося увійти за номером телефону";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150 py-1 text-[#F1F5F9]">
      {/* Заголовок */}
      <div className="text-center space-y-1">
        <h3 className="font-display text-lg sm:text-xl font-bold text-white">
          {authReason === "checkout"
            ? "Швидкий вхід для замовлення"
            : brandName
            ? `Авторизація в ${brandName}`
            : "Авторизація в Urban Bites"}
        </h3>
        <p className="text-xs text-[#94A3B8] max-w-sm mx-auto">
          {authReason === "checkout"
            ? "Увійдіть для збереження адрес, історії замовлень та нарахування бонусів URBAN CLUB"
            : "Увійдіть за номером телефону або Telegram для перегляду накопичених бонусів та історії замовлень"}
        </p>
      </div>

      {authReason === "checkout" && (
        <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2.5 font-medium shadow-2xs">
          <span className="text-lg shrink-0">{cartEmoji}</span>
          <span className="leading-snug">
            <strong>Ваш кошик збережено!</strong> Після входу ви одразу повернетесь до підтвердження замовлення.
          </span>
        </div>
      )}

      {/* Перемикач способу авторизації */}
      <div className="flex bg-[#121417] p-1 rounded-2xl text-xs font-bold border border-white/10">
        <button
          type="button"
          onClick={() => {
            setMethod("phone");
            setError(null);
          }}
          className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            method === "phone"
              ? "bg-[var(--brand-primary,#D34528)] text-white shadow-xs"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <span>📱</span>
          <span>За телефоном</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod("telegram");
            setError(null);
          }}
          className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            method === "telegram"
              ? "bg-[#2A313C] text-white shadow-xs border border-white/10"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <span>✈️</span>
          <span>Telegram</span>
        </button>
      </div>

      {/* Спосіб 1: За номером телефону */}
      {method === "phone" && (
        <form onSubmit={handlePhoneSubmit} className="space-y-4">
          <div className="bg-[#181B22] p-5 sm:p-6 rounded-2xl border border-white/10 space-y-4 shadow-xl">
            <div className="space-y-1">
              <label className="block text-xs font-bold text-white">
                Номер телефону <span className="text-[var(--brand-primary,#E2583E)]">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+380 (__) ___-__-__"
                required
                className="w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#D34528)]/40 focus:border-[var(--brand-primary,#D34528)] transition-all"
              />
              <p className="text-[11px] text-[#94A3B8]">
                Єдиний номер для бонусного рахунку URBAN CLUB по всій мережі
              </p>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-bold text-white">
                Ваше ім'я <span className="text-xs text-[#94A3B8] font-normal">(за бажанням)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Олександр"
                className="w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-white placeholder:text-[#64748B] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#D34528)]/40 focus:border-[var(--brand-primary,#D34528)] transition-all"
              />
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[var(--brand-primary,#D34528)] hover:opacity-90 disabled:opacity-50 text-white py-3.5 px-4 rounded-xl font-bold text-sm shadow-lg shadow-[var(--brand-primary,#D34528)]/25 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {loading ? (
                <span>Синхронізація...</span>
              ) : (
                <>
                  <span>Увійти та отримати 50 бонусів</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Спосіб 2: Через Telegram */}
      {method === "telegram" && (
        <div className="space-y-4">
          <div className="bg-[#181B22] p-6 rounded-2xl border border-white/10 flex flex-col items-center justify-center gap-4 text-center shadow-xl">
            <div className="w-12 h-12 rounded-full bg-[#2AABEE]/20 flex items-center justify-center text-2xl text-[#2AABEE] border border-[#2AABEE]/30">
              ✈️
            </div>

            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">
                Офіційний Telegram Login
              </h4>
              <p className="text-[11px] text-[#94A3B8]">
                Авторизуйтеся через офіційний віджет або відкрийте нашого бота
              </p>
            </div>

            <div className="pt-1 pb-1">
              <TelegramLoginWidget
                botName={botUsername}
                onAuth={onTelegramAuth}
                buttonSize="large"
                cornerRadius={20}
              />
            </div>

            <div className="w-full pt-2 border-t border-white/10 flex flex-col gap-2">
              <a
                href={`https://t.me/${botUsername}?start=web_auth`}
                target="_blank"
                rel="noreferrer"
                className="w-full bg-[#2A313C] hover:bg-[#343D4B] text-white py-3 px-4 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-all flex items-center justify-center gap-2 border border-white/10"
              >
                <span>🤖</span>
                <span>Відкрити Urban Bites Bot (@{botUsername})</span>
              </a>
              <p className="text-[10px] text-[#94A3B8]">
                У Telegram-боті також доступний зручний нативний Mini App з повним меню
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Переваги URBAN CLUB */}
      <div className="bg-[#181B22] p-4 rounded-xl border border-white/10 text-xs space-y-2 text-[#CBD5E1]">
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">🎁</span>
          <span><strong className="text-[#F1F5F9]">+50 бонусів одразу:</strong> автоматично зараховуються при вході (1 бонус = 1 ₴)</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">🔄</span>
          <span><strong className="text-[#F1F5F9]">Єдина мережа:</strong> бонуси та історія діють по всій мережі закладів Urban Bites</span>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-base shrink-0">📍</span>
          <span><strong className="text-[#F1F5F9]">Збереження адрес:</strong> швидке оформлення замовлення без повторного вводу</span>
        </div>
      </div>

      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="w-full text-center text-xs text-[#94A3B8] hover:text-[#F1F5F9] font-semibold pt-1 cursor-pointer transition-colors"
        >
          ← Повернутися до кабінету
        </button>
      )}
    </div>
  );
}
