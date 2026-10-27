import { useEffect, useState } from "react";
import type { DeliveryAddress } from "../../types/catalog.ts";
import type { UserProfile } from "../../types/user.ts";
import {
  formatPhoneOnInput,
  handlePhoneKeyDown,
  formatPhoneNumber,
  isValidUkrainianPhone,
  normalizeE164Phone,
} from "../../utils/phone.ts";
import { type TelegramUser } from "./TelegramLoginWidget.tsx";

export interface ProfileSettingsTabProps {
  profile: UserProfile;
  ordersCount: number;
  activeOrdersCount: number;
  streetsList: DeliveryAddress[];
  onOpenOrders: () => void;
  onOpenLoyalty?: () => void;
  onSaveProfile: (updated: UserProfile) => void;
  onLogout: () => void;
  onOpenPhoneAuth?: () => void;
  onTelegramAuth?: (user: TelegramUser) => void;
  onDisconnectTelegram?: () => void;
}

export function ProfileSettingsTab({
  profile,
  ordersCount,
  activeOrdersCount,
  streetsList,
  onOpenOrders,
  onOpenLoyalty,
  onSaveProfile,
  onLogout,
  onOpenPhoneAuth,
  onDisconnectTelegram,
}: ProfileSettingsTabProps) {
  const initialFirstName = profile.first_name || profile.name.split(" ")[0] || "";
  const initialLastName =
    profile.last_name || (profile.name.includes(" ") ? profile.name.split(" ").slice(1).join(" ") : "");

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(formatPhoneNumber(profile.phone));
  const [street, setStreet] = useState(profile.street);
  const [house, setHouse] = useState(profile.house);
  const [apartment, setApartment] = useState(profile.apartment);
  const [additionalAddress, setAdditionalAddress] = useState(profile.additional_address || "");

  const [isEditingMainAddress, setIsEditingMainAddress] = useState(!profile.street);
  const [isEditingAdditionalAddress, setIsEditingAdditionalAddress] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "urban_bites_tst_bot";

  useEffect(() => {
    setFirstName(profile.first_name || profile.name.split(" ")[0] || "");
    setLastName(
      profile.last_name || (profile.name.includes(" ") ? profile.name.split(" ").slice(1).join(" ") : ""),
    );
    setPhone(formatPhoneNumber(profile.phone));
    setStreet(profile.street);
    setHouse(profile.house);
    setApartment(profile.apartment);
    setAdditionalAddress(profile.additional_address || "");
  }, [profile]);

  const formatActiveBadge = (count: number) => {
    if (count % 10 === 1 && count % 100 !== 11) {
      return `${count} активне`;
    }
    if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return `${count} активні`;
    }
    return `${count} активних`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneOnInput(e.target.value, phone);
    setPhone(formatted);
  };

  const fullDeliveryAddress = [street, house ? `буд. ${house}` : "", apartment ? `кв. ${apartment}` : ""]
    .filter(Boolean)
    .join(", ");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!firstName.trim()) {
      setError("Вкажіть ваше ім'я");
      return;
    }

    if (phone && !isValidUkrainianPhone(phone)) {
      setError("Вкажіть коректний мобільний номер (+380...)");
      return;
    }

    const cleanPhone = phone ? normalizeE164Phone(phone) : "";
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    const isPhoneVerified = Boolean(profile.is_phone_verified || profile.telegram_id);

    const updated: UserProfile = {
      ...profile,
      name: fullName,
      first_name: firstName.trim(),
      last_name: lastName.trim() || undefined,
      phone: cleanPhone,
      street: street.trim(),
      house: house.trim(),
      apartment: apartment.trim(),
      additional_address: additionalAddress.trim() || undefined,
      is_phone_verified: isPhoneVerified,
      client_code: profile.client_code || `UB-${profile.telegram_id || "77"}`,
    };

    onSaveProfile(updated);
    setSavedSuccess(true);
    setIsEditingMainAddress(false);
    setIsEditingAdditionalAddress(false);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const clientCode = profile.client_code || `UB-${profile.telegram_id || "77"}`;
  const bonusBalance = profile.bonuses ?? 50;

  return (
    <form onSubmit={handleSave} className="space-y-5 animate-in fade-in duration-150">
      {savedSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm font-bold flex items-center gap-2">
          <span>✓</span>
          <span>Дані успішно збережено</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs sm:text-sm font-semibold flex items-center gap-2">
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* Секція: Мої замовлення */}
      <section>
        <div
          onClick={onOpenOrders}
          className="flex items-center justify-between rounded-2xl p-4 cursor-pointer transition-all bg-[#181B22] border border-white/10 hover:border-[var(--brand-primary,#D34528)]/50 shadow-lg group"
        >
          <div className="flex items-center gap-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl bg-[#1F232B] group-hover:scale-105 transition-transform border border-white/5">
              📦
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-[#F1F5F9]">Мої замовлення</p>
                {activeOrdersCount > 0 ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-amber-950/50 text-amber-400 border border-amber-500/30 animate-pulse">
                    {formatActiveBadge(activeOrdersCount)}
                  </span>
                ) : ordersCount > 0 ? (
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold bg-[#252A34] text-[#CBD5E1] border border-white/5">
                    {ordersCount}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {ordersCount > 0
                  ? `Історія та статус ${ordersCount} ${ordersCount === 1 ? "замовлення" : "замовлень"}`
                  : "Історія та статус замовлень"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[var(--brand-primary,#D34528)] font-bold text-sm group-hover:translate-x-1 transition-transform">
            <span>Переглянути</span>
            <span>→</span>
          </div>
        </div>
      </section>

      {/* Секція 1: Мої дані */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] px-1">
          Мої дані
        </p>

        <div className="bg-[#181B22] p-4 sm:p-5 rounded-2xl border border-white/10 space-y-3.5 shadow-lg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Прізвище
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Шевченко"
                className="w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[var(--brand-primary,#D34528)]/60 focus:ring-1 focus:ring-[var(--brand-primary,#D34528)]/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94A3B8] mb-1">
                Імʼя *
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Олександр"
                className="w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[var(--brand-primary,#D34528)]/60 focus:ring-1 focus:ring-[var(--brand-primary,#D34528)]/60"
              />
            </div>
          </div>

          {/* Номер телефону з бейджем верифікації */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#94A3B8]">№ Телефону</span>
              {profile.is_phone_verified || Boolean(profile.telegram_id) ? (
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  ✓ Верифіковано (🔒 закріплено)
                </span>
              ) : (
                <span className="text-[11px] font-bold text-amber-400 bg-amber-950/50 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                  ⚠️ Не верифіковано
                </span>
              )}
            </div>

            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              onKeyDown={handlePhoneKeyDown}
              disabled={Boolean(profile.is_phone_verified || profile.telegram_id)}
              placeholder="+380 (XX) XXX-XX-XX"
              className={`w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-mono tracking-tight text-[#F1F5F9] placeholder:text-[#64748B] ${
                profile.is_phone_verified || Boolean(profile.telegram_id)
                  ? "opacity-60 cursor-not-allowed bg-[#0F1115]"
                  : "focus:outline-none focus:border-[var(--brand-primary,#D34528)]/60 focus:ring-1 focus:ring-[var(--brand-primary,#D34528)]/60"
              }`}
            />

            {!(profile.is_phone_verified || Boolean(profile.telegram_id)) && (
              <div className="rounded-xl p-3 bg-amber-950/30 border border-amber-500/30 text-xs text-amber-300 space-y-2 mt-2 shadow-sm">
                <p className="leading-relaxed text-[11px]">
                  Номер не верифіковано. Ви можете змінити його вище та зберегти профіль, або підтвердити поточний номер через наш Telegram-бот.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <a
                    href={`https://t.me/${botUsername}?start=verify_phone`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 bg-[var(--brand-primary,#D34528)] hover:opacity-90 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer"
                  >
                    <span>📱</span>
                    <span>Підтвердити телефон у боті →</span>
                  </a>
                  {onOpenPhoneAuth && (
                    <button
                      type="button"
                      onClick={onOpenPhoneAuth}
                      className="flex items-center gap-1 bg-[#1F232B] border border-white/10 text-[#CBD5E1] hover:text-white hover:bg-[#252A34] px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      <span>🔑</span>
                      <span>Вхід за телефоном / кодом</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Секція 2: Мої адреси доставки */}
      <section className="space-y-3">
        <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] px-1">
          Мої адреси доставки
        </p>

        <div className="space-y-3">
          {/* 1. Основна адреса */}
          {isEditingMainAddress ? (
            <div className="bg-[#181B22] rounded-2xl border border-white/10 p-4 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between border-b pb-2 border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">📍</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                    Основна адреса доставки (м. Київ)
                  </span>
                </div>
                {street && (
                  <button
                    type="button"
                    onClick={() => setIsEditingMainAddress(false)}
                    className="text-xs font-semibold text-[var(--brand-primary,#D34528)] hover:underline cursor-pointer"
                  >
                    Згорнути ✕
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  Вулиця
                </label>
                <input
                  type="text"
                  list="cabinet-streets-datalist"
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="Введіть або оберіть вулицю..."
                  className="w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[var(--brand-primary,#D34528)]/60 focus:ring-1 focus:ring-[var(--brand-primary,#D34528)]/60"
                />
                <datalist id="cabinet-streets-datalist">
                  {streetsList.map((s) => (
                    <option key={s.id} value={s.street} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                    Будинок
                  </label>
                  <input
                    type="text"
                    value={house}
                    onChange={(e) => setHouse(e.target.value)}
                    placeholder="Напр. 15, 2Д"
                    className="w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[var(--brand-primary,#D34528)]/60 focus:ring-1 focus:ring-[var(--brand-primary,#D34528)]/60"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                    Квартира / Офіс
                  </label>
                  <input
                    type="text"
                    value={apartment}
                    onChange={(e) => setApartment(e.target.value)}
                    placeholder="Опціонально"
                    className="w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[var(--brand-primary,#D34528)]/60 focus:ring-1 focus:ring-[var(--brand-primary,#D34528)]/60"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#181B22] flex items-center justify-between rounded-2xl p-3.5 border border-white/10 shadow-lg">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-950/40 text-lg text-blue-400 border border-blue-500/20">
                  📍
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Основна адреса
                    </span>
                    {fullDeliveryAddress ? (
                      <span className="rounded-full bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-bold text-emerald-400">
                        Збережено
                      </span>
                    ) : (
                      <span className="rounded-full bg-amber-950/50 border border-amber-500/30 px-2 py-0.2 text-[10px] font-semibold text-amber-400">
                        Не вказано
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-[#F1F5F9] truncate">
                    {fullDeliveryAddress || "Вкажіть адресу для швидкого замовлення"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingMainAddress(true)}
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border border-white/10 bg-[#1F232B] hover:bg-[#252A34] text-[var(--brand-primary,#D34528)] cursor-pointer transition-colors"
              >
                {fullDeliveryAddress ? "Змінити" : "+ Додати"}
              </button>
            </div>
          )}

          {/* 2. Додаткова адреса */}
          {isEditingAdditionalAddress ? (
            <div className="bg-[#181B22] rounded-2xl border border-white/10 p-4 space-y-3.5 shadow-lg">
              <div className="flex items-center justify-between border-b pb-2 border-white/10">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🏢</span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#CBD5E1]">
                    Додаткова адреса (робота, рідні)
                  </span>
                </div>
                {additionalAddress && (
                  <button
                    type="button"
                    onClick={() => setIsEditingAdditionalAddress(false)}
                    className="text-xs font-semibold text-[var(--brand-primary,#D34528)] hover:underline cursor-pointer"
                  >
                    Згорнути ✕
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#94A3B8] mb-1">
                  Адреса
                </label>
                <input
                  type="text"
                  value={additionalAddress}
                  onChange={(e) => setAdditionalAddress(e.target.value)}
                  placeholder="Напр. м. Київ, вул. Набережна, 12, офіс 4"
                  className="w-full bg-[#121417] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[var(--brand-primary,#D34528)]/60 focus:ring-1 focus:ring-[var(--brand-primary,#D34528)]/60"
                />
              </div>
            </div>
          ) : (
            <div className="bg-[#181B22] flex items-center justify-between rounded-2xl p-3.5 border border-white/10 shadow-lg">
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-950/40 text-lg text-purple-400 border border-purple-500/20">
                  🏢
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#94A3B8]">
                      Додаткова адреса
                    </span>
                    {additionalAddress ? (
                      <span className="rounded-full bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-bold text-emerald-400">
                        Збережено
                      </span>
                    ) : (
                      <span className="rounded-full bg-[#252A34] px-2 py-0.2 text-[10px] font-semibold text-[#94A3B8] border border-white/5">
                        Не вказано
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm font-medium text-[#F1F5F9] truncate">
                    {additionalAddress || "Офіс, робота або адреса рідних"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingAdditionalAddress(true)}
                className="shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold border border-white/10 bg-[#1F232B] hover:bg-[#252A34] text-[var(--brand-primary,#D34528)] cursor-pointer transition-colors"
              >
                {additionalAddress ? "Змінити" : "+ Додати"}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Секція 3: Картка клієнта */}
      <section className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] px-1">
          Картка клієнта
        </p>

        <div
          onClick={onOpenLoyalty}
          role={onOpenLoyalty ? "button" : undefined}
          tabIndex={onOpenLoyalty ? 0 : undefined}
          onKeyDown={onOpenLoyalty ? (e) => (e.key === "Enter" || e.key === " " ? onOpenLoyalty() : null) : undefined}
          className={`relative overflow-hidden rounded-3xl p-5 shadow-xl bg-gradient-to-br from-[#181B22] via-[#222834] to-[#14171E] text-white border border-white/10 text-left ${
            onOpenLoyalty ? "cursor-pointer hover:border-[var(--brand-primary,#D34528)]/60 hover:shadow-2xl transition-all" : ""
          }`}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--brand-primary,#D34528)]">
                  URBAN CLUB
                </span>
                <span className="text-xs">✨</span>
              </div>
              <p className="mt-1 text-lg font-bold tracking-tight text-[#F1F5F9]">
                {profile.name || "Гість"}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold bg-[var(--brand-primary,#D34528)]/20 text-[var(--brand-primary,#D34528)] border border-[var(--brand-primary,#D34528)]/30">
              <span>●</span>
              <span>Active</span>
            </div>
          </div>

          <div className="mt-8 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                Номер картки
              </p>
              <p className="font-mono text-sm font-bold tracking-widest text-[#CBD5E1]">
                {clientCode}
              </p>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-[#94A3B8]">
                Бонуси
              </p>
              <p className="text-xl font-extrabold text-[var(--brand-primary,#D34528)]">
                {bonusBalance} <span className="text-xs font-semibold opacity-70">бал.</span>
              </p>
            </div>
          </div>

          <div className="mt-4 border-t border-white/10 pt-2.5 flex items-center justify-between">
            <p className="text-[11px] text-[#94A3B8] leading-relaxed">
              Бонусна програма: нарахування та оплата замовлень балами у закладах Urban Bites.
            </p>
            {onOpenLoyalty && (
              <span className="text-[11px] font-bold text-[var(--brand-primary,#D34528)] shrink-0 ml-2 hover:underline">
                Деталі →
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Кнопка збереження */}
      <div className="pt-2">
        <button
          type="submit"
          className="w-full bg-[var(--brand-primary,#D34528)] hover:opacity-90 text-white py-3 rounded-xl font-bold text-sm shadow-lg shadow-[var(--brand-primary,#D34528)]/20 transition-transform active:scale-95 cursor-pointer"
        >
          Зберегти зміни
        </button>
      </div>

      {/* Дії облікового запису */}
      <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10 text-xs">
        <button
          type="button"
          onClick={onLogout}
          className="text-red-400 hover:text-red-300 font-semibold cursor-pointer transition-colors"
        >
          Вийти з профілю
        </button>

        {profile.telegram_id ? (
          <button
            type="button"
            onClick={onDisconnectTelegram}
            className="text-slate-400 hover:text-slate-200 font-semibold cursor-pointer transition-colors"
          >
            Від'єднати Telegram (@{profile.username || profile.telegram_id})
          </button>
        ) : onOpenPhoneAuth ? (
          <button
            type="button"
            onClick={onOpenPhoneAuth}
            className="text-[var(--brand-primary,#D34528)] hover:underline font-bold cursor-pointer"
          >
            Увійти через інший акаунт →
          </button>
        ) : null}
      </div>
    </form>
  );
}
