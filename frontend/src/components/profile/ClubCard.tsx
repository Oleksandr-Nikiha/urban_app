import { useState } from "react";
import { useMyBonusHistory } from "@/api/queries";
import { haptic } from "@/telegram/sdk";

interface ClubCardProps {
  fullName: string;
  clientCode: string;
  bonusBalance: number;
}

export function ClubCard({ fullName, clientCode, bonusBalance }: ClubCardProps) {
  const [showHistory, setShowHistory] = useState(false);
  const { data: history = [], isPending } = useMyBonusHistory();

  const tiers = [
    { range: "50 – 100 ₴", percent: "1%" },
    { range: "100 – 700 ₴", percent: "3%" },
    { range: "700 – 1 200 ₴", percent: "5%" },
    { range: "1 200 – 1 800 ₴", percent: "7%" },
    { range: "> 1 800 ₴", percent: "10%" },
  ];

  return (
    <section className="app-rise space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Картка клієнта</p>
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setShowHistory(!showHistory);
          }}
          className="app-press text-xs font-bold text-[var(--tg-theme-button-color)] hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>📜</span>
          <span>{showHistory ? "Сховати історію" : "Історія балів"}</span>
        </button>
      </div>

      <div
        className="app-card relative overflow-hidden rounded-3xl p-5 shadow-lg transition-all"
        style={{
          background:
            "linear-gradient(145deg, color-mix(in srgb, var(--tg-theme-button-color) 25%, var(--app-surface)), color-mix(in srgb, var(--tg-theme-button-color) 8%, var(--app-surface)))",
          border: "1px solid color-mix(in srgb, var(--tg-theme-button-color) 35%, transparent)",
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img
                src={`${import.meta.env.BASE_URL}logo-club.svg`}
                alt="Urban Club"
                className="h-5 w-5 rounded-full object-cover shadow-xs"
              />
              <span className="text-xs font-extrabold uppercase tracking-widest text-[var(--tg-theme-button-color)]">
                URBAN CLUB
              </span>
              <span className="text-xs">✨</span>
            </div>
            <p className="mt-1 text-lg font-bold tracking-tight">{fullName}</p>
          </div>
          <div
            className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
          >
            <span>●</span>
            <span>Active</span>
          </div>
        </div>

        <div className="mt-8 flex items-end justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider opacity-50">Номер картки</p>
            <p className="font-mono text-sm font-bold tracking-widest">{clientCode}</p>
          </div>

          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider opacity-50">Бонуси</p>
            <p className="text-xl font-extrabold text-[var(--tg-theme-button-color)]">
              {bonusBalance} <span className="text-xs font-semibold opacity-70">бал.</span>
            </p>
          </div>
        </div>

        <div className="mt-4 border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
          <p className="text-[11px] opacity-50">
            Бонусна програма: нарахування 1–10% кешбеку та оплата замовлень балами Urban Club у закладах Urban Bites.
          </p>
        </div>
      </div>

      {/* Шкала кешбеку */}
      <div className="app-card rounded-2xl p-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-[var(--tg-theme-button-color)] flex items-center gap-1.5">
            <span>⚡</span>
            <span>Кешбек з кожного чека</span>
          </span>
          <span className="text-[10px] opacity-60 font-normal">від 50 ₴</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          {tiers.map((t) => (
            <div key={t.percent} className="rounded-xl p-1.5 border border-white/5 bg-black/10">
              <span className="text-[9px] opacity-60 block truncate">{t.range}</span>
              <strong className="text-xs text-[var(--tg-theme-button-color)] font-extrabold">{t.percent}</strong>
            </div>
          ))}
        </div>
      </div>

      {/* Плашка історії нарахувань та списань */}
      {showHistory && (
        <div className="app-card rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between text-xs font-bold border-b pb-2" style={{ borderColor: "var(--app-border)" }}>
            <span className="flex items-center gap-1.5">
              <span>📜</span>
              <span>Історія операцій з балами</span>
            </span>
            <span className="text-[10px] opacity-50">Останні транзакції</span>
          </div>

          {isPending ? (
            <div className="py-4 text-center text-xs opacity-60">Завантаження історії...</div>
          ) : history.length === 0 ? (
            <div className="py-4 text-center text-xs opacity-60">Операцій з балами поки не знайдено</div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {history.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 text-xs"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  <div className="space-y-0.5 min-w-0 pr-2">
                    <p className="font-semibold text-white truncate">
                      {tx.description || (tx.amount > 0 ? "Нарахування бонусів" : "Списання бонусів")}
                    </p>
                    <p className="text-[10px] opacity-50">
                      {new Date(tx.created_at).toLocaleString("uk-UA", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span
                      className={`text-sm font-extrabold ${
                        tx.amount > 0 ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount} б.
                    </span>
                    <p className="text-[10px] opacity-50">Залишок: {tx.balance_after}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
