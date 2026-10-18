import { useState } from "react";
import { openLink } from "@telegram-apps/sdk-react";

import { useLocations } from "@/api/queries";
import { ErrorBox, ScreenTitle } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function ContactsPage() {
  const { data, isPending, error, refetch } = useLocations();
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  if (isPending) {
    return (
      <div className="space-y-4 px-4 pt-2">
        <div className="h-7 w-32 rounded-lg app-shimmer mb-4" />
        {[1, 2].map((i) => (
          <div key={i} className="app-card rounded-2xl p-4 space-y-3">
            <div className="h-5 w-40 rounded-md app-shimmer" />
            <div className="h-4 w-60 rounded-md app-shimmer opacity-60" />
            <div className="h-8 w-full rounded-xl app-shimmer opacity-40 pt-2" />
          </div>
        ))}
      </div>
    );
  }

  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  const handleOpenMap = (address: string) => {
    haptic("light");
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

    try {
      if (openLink.isAvailable()) {
        openLink(mapsUrl);
        return;
      }
    } catch {
      /* fallback */
    }
    window.open(mapsUrl, "_blank", "noopener,noreferrer");
  };


  const handleCall = (phone: string) => {
    haptic("medium");

    // 1. Копіюємо номер у буфер обміну (Telegram часто блокує tel: протокол у WebView)
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(phone).catch(() => {});
    }

    setCopiedPhone(phone);
    hapticNotify("success");
    setTimeout(() => {
      setCopiedPhone((cur) => (cur === phone ? null : cur));
    }, 4000);

    // 2. Best-effort перехід до системного діалера
    try {
      window.location.href = `tel:${phone.replace(/\s+/g, "")}`;
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="pb-8">
      <ScreenTitle>Контакти</ScreenTitle>

      {copiedPhone && (
        <div
          className="app-pop mx-4 mb-3 rounded-2xl p-3 text-xs font-semibold text-center border shadow-sm flex items-center justify-center gap-2"
          style={{
            background: "color-mix(in srgb, #22c55e 12%, var(--tg-theme-bg-color, #ffffff))",
            color: "#16a34a",
            borderColor: "color-mix(in srgb, #22c55e 30%, transparent)",
          }}
        >
          <span>✓</span>
          <span>Номер <b>{copiedPhone}</b> скопійовано для дзвінка!</span>
        </div>
      )}

      <div className="app-rise space-y-4 px-4 pt-1">
        {data.map((loc) => {
          const isBakery = loc.name.toLowerCase().includes("bakery") || loc.name.toLowerCase().includes("croissant");

          return (
            <section
              key={loc.id}
              className="app-card rounded-2xl p-4 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <img
                    src={isBakery ? `${import.meta.env.BASE_URL}logo-bakery.svg` : `${import.meta.env.BASE_URL}logo-pizza.svg`}
                    alt={loc.name}
                    className="h-10 w-10 rounded-full object-cover shadow-sm shrink-0"
                  />

                  <div>
                    <h2 className="font-bold text-base leading-snug">{loc.name}</h2>
                    <p className="mt-0.5 text-xs opacity-70 leading-relaxed">{loc.address}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenMap(loc.address)}
                  className="app-press shrink-0 rounded-xl px-2.5 py-1.5 text-xs font-semibold flex items-center gap-1 transition-all"
                  style={{ background: "var(--app-surface-2)" }}
                >
                  <span>📍</span>
                  <span>На карті</span>
                </button>
              </div>

              {/* Інформація про доставку */}
              <div
                className="mt-3.5 pt-3 border-t text-xs space-y-1.5"
                style={{ borderColor: "var(--app-border)" }}
              >
                <div className="flex items-center justify-between">
                  <span className="opacity-65 flex items-center gap-1.5">
                    <span>🛵</span>
                    <span>Години доставки:</span>
                  </span>
                  <span className="font-semibold">
                    {loc.delivery_start_time} – {loc.delivery_end_time}
                  </span>
                </div>

                {!loc.is_delivery_enabled && (
                  <p className="text-[11px] text-rose-500 font-semibold pt-1">
                    ⚠️ Доставка тимчасово призупинена (тільки самовивіз)
                  </p>
                )}
              </div>

              {/* Номери телефонів */}
              <div className="mt-3.5 pt-3 border-t flex flex-col gap-2" style={{ borderColor: "var(--app-border)" }}>
                <p className="text-[10px] uppercase font-bold tracking-wider opacity-40">Телефон для замовлень:</p>
                {loc.phones.map((phone) => {
                  const isCopied = copiedPhone === phone;
                  return (
                    <button
                      key={phone}
                      type="button"
                      onClick={() => handleCall(phone)}
                      className="app-press flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-semibold transition-all text-left"
                      style={{
                        background: isCopied
                          ? "color-mix(in srgb, #22c55e 14%, var(--app-surface-2))"
                          : "var(--app-surface-2)",
                        color: isCopied ? "#16a34a" : "var(--tg-theme-link-color)",
                      }}
                    >
                      <span className="flex items-center gap-2">
                        <span>📞</span>
                        <span className="font-bold tracking-wide">{phone}</span>
                      </span>
                      <span className="opacity-75 text-[11px] font-medium">
                        {isCopied ? "✓ Скопійовано" : "Зателефонувати →"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
