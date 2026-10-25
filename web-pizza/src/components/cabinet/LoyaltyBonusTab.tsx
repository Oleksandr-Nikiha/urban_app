import { useEffect, useState } from "react";
import { fetchBonusHistory, type BonusTransaction } from "../../api/bonuses.ts";

interface LoyaltyBonusTabProps {
  bonuses: number;
  phone: string;
  clientCode?: string;
  telegramId?: number | null;
}

export function LoyaltyBonusTab({ bonuses, phone, clientCode, telegramId }: LoyaltyBonusTabProps) {
  const botUsername = import.meta.env.VITE_TELEGRAM_BOT_USERNAME || "urban_bites_tst_bot";
  const [history, setHistory] = useState<BonusTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (phone || telegramId) {
      setLoadingHistory(true);
      fetchBonusHistory({ phone, telegram_id: telegramId })
        .then(setHistory)
        .finally(() => setLoadingHistory(false));
    }
  }, [phone, telegramId]);

  const tiers = [
    { range: "50,01 – 100 ₴", percent: "1%", desc: "Базовий перекус або кава" },
    { range: "100,01 – 700 ₴", percent: "3%", desc: "Щоденні обіди та десерти" },
    { range: "700,01 – 1 200 ₴", percent: "5%", desc: "Замовлення на двох, піца та сети" },
    { range: "1 200,01 – 1 800 ₴", percent: "7%", desc: "Компанії та дружні посиденьки" },
    { range: "Понад 1 800 ₴", percent: "10%", desc: "Максимальний рівень на великі свята" },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-150 text-[#F1F5F9]">
      {/* Картка балансу бонусів */}
      <div className="bg-gradient-to-br from-[#12161A] via-[#1E232B] to-[#12161A] text-white rounded-3xl p-6 sm:p-7 shadow-lg border border-white/10 relative overflow-hidden">
        <div className="absolute right-[-10px] bottom-[-20px] text-8xl opacity-15 select-none pointer-events-none">
          ✨
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
              URBAN CLUB • МЕРЕЖА URBAN BITES
            </span>
            <div className="flex items-center gap-1.5">
              {clientCode && (
                <span className="text-xs font-mono font-bold bg-amber-500 px-2 py-0.5 rounded-full text-[#0F1115]">
                  {clientCode}
                </span>
              )}
              <span className="text-xs bg-white/10 px-2.5 py-0.5 rounded-full text-[#CBD5E1]">
                {phone ? phone : "Гість"}
              </span>
            </div>
          </div>

          <div>
            <div className="text-3xl sm:text-4xl font-extrabold text-amber-400">
              {bonuses} <span className="text-xl sm:text-2xl font-bold text-white">бонусів</span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-1">
              1 бонус = 1 гривня знижки у Urban Pizza & Sushi та Urban Bakery & Coffee
            </p>
          </div>
        </div>
      </div>

      {/* Шкала нарахування */}
      <div className="bg-[#181B22] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5 shadow-2xs">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 pb-1 border-b border-white/10 flex items-center justify-between">
          <span>Шкала кешбеку URBAN CLUB</span>
          <span className="text-[10px] text-[#94A3B8] font-normal normal-case">від 50 ₴ у чеку</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
          {tiers.map((t) => (
            <div key={t.percent} className="p-2.5 rounded-xl bg-white/5 border border-white/5 flex flex-col justify-between">
              <span className="text-[11px] text-[#94A3B8]">{t.range}</span>
              <span className="text-base font-bold text-amber-400 mt-0.5">{t.percent}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Історія бонусів */}
      <div className="bg-[#181B22] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5 shadow-2xs">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 pb-1 border-b border-white/10 flex items-center justify-between">
          <span>Історія нарахування та списання</span>
          {loadingHistory && <span className="text-[10px] text-[#94A3B8] font-normal">Оновлення...</span>}
        </div>

        {history.length === 0 ? (
          <div className="text-xs text-[#94A3B8] py-3 text-center">
            {loadingHistory ? "Завантаження операцій..." : "Історія бонусних операцій поки порожня"}
          </div>
        ) : (
          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {history.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-white">
                    {tx.description || (tx.amount > 0 ? "Нарахування бонусів" : "Списання бонусів")}
                  </div>
                  <div className="text-[10px] text-[#94A3B8]">
                    {new Date(tx.created_at).toLocaleString("uk-UA", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`text-sm font-bold ${
                      tx.amount > 0 ? "text-emerald-400" : "text-amber-400"
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount}` : tx.amount} б.
                  </span>
                  <div className="text-[10px] text-[#94A3B8]">Залишок: {tx.balance_after}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Як накопичувати та витрачати бонуси */}
      <div className="bg-[#181B22] rounded-2xl p-4 sm:p-5 border border-white/10 space-y-3.5 shadow-2xs">
        <div className="text-xs font-bold uppercase tracking-wider text-amber-400 pb-1 border-b border-white/10">
          Правила програми
        </div>

        <div className="space-y-3 text-xs sm:text-sm text-[#CBD5E1]">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🎁</span>
            <div>
              <strong className="text-white block">50 вітальних бонусів</strong>
              Миттєве нарахування 50 бонусів кожному новому учаснику при першому вході.
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">💳</span>
            <div>
              <strong className="text-white block">Оплата бонусами до 30%</strong>
              Розраховуйтесь накопиченими бонусами за піцу, випічку та напої (до 30% вартості замовлення).
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0">🔄</span>
            <div>
              <strong className="text-white block">Кешбек від 1% до 10%</strong>
              Нараховується автоматично після успішного виконання замовлення (від 50 ₴ у чеку).
            </div>
          </div>
        </div>
      </div>

      {/* Бот для перевірки бонусів */}
      <div className="p-4 rounded-2xl bg-[#181B22] border border-white/10 flex items-center justify-between gap-3 text-xs">
        <div className="space-y-0.5">
          <div className="font-bold text-white">Миттєва синхронізація з Telegram</div>
          <p className="text-[#94A3B8]">Авторизуйтеся у боті @{botUsername} для перегляду чеків та кешбеку в 1 клік</p>
        </div>
        <a
          href={`https://t.me/${botUsername}?start=cabinet`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 bg-amber-500 hover:bg-amber-400 text-[#0F1115] px-3.5 py-2 rounded-xl font-extrabold transition-colors shadow-xs"
        >
          Відкрити бота
        </a>
      </div>
    </div>
  );
}
