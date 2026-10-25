import type { AdminMe } from "@/api/types";
import { haptic } from "@/telegram/sdk";
import { isTelegramWebApp } from "@/telegram/env";

interface AdminStaffBannerProps {
  adminMe?: AdminMe | null;
}

export function AdminStaffBanner({ adminMe }: AdminStaffBannerProps) {
  if (!adminMe?.is_staff) return null;

  const handleOpenAdmin = () => {
    haptic("light");
    const adminUrl = "/urban-bites/admin/";
    if (isTelegramWebApp()) {
      try {
        const tg = (window as unknown as {
          Telegram?: { WebApp?: { openLink?: (url: string) => void } };
        })?.Telegram?.WebApp;
        if (tg?.openLink) {
          tg.openLink(window.location.origin + adminUrl);
          return;
        }
      } catch {
        /* ignore */
      }
    }
    window.location.href = adminUrl;
  };

  return (
    <section className="app-rise">
      <div
        className="app-card relative overflow-hidden rounded-2xl p-4 transition-all"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--tg-theme-button-color) 16%, var(--app-surface)), var(--app-surface))",
          border: "1px solid color-mix(in srgb, var(--tg-theme-button-color) 40%, transparent)",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">
              {adminMe.role === "admin" ? "👑" : "👔"}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold">Адмін-панель</p>
                <span
                  className="rounded-full px-2 py-0.2 text-[10px] font-bold"
                  style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
                >
                  {adminMe.role === "admin" ? "Адміністратор" : "Менеджер"}
                </span>
              </div>
              <p className="text-xs opacity-60">
                {adminMe.location_name ? `Заклад: ${adminMe.location_name}` : "Управління закладами, меню та стоп-листом"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAdmin}
            className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
              boxShadow: "var(--app-shadow)",
            }}
          >
            Відкрити →
          </button>
        </div>
      </div>
    </section>
  );
}
