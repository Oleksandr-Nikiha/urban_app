import { haptic } from "@/telegram/sdk";
import type { AdminSection, AdminTab } from "./types";
import type { Location } from "@/api/types";

interface AdminMobileNavProps {
  roleLabel: string;
  locationBadge: string;
  isSuperAdmin: boolean;
  activeSection: AdminSection;
  activeTab: AdminTab;
  selectedLocationId: number | null;
  locations: Location[];
  isTelegram: boolean;
  onSelectSection?: (section: AdminSection) => void;
  onSelectTab: ((tab: AdminTab) => void) | ((section: AdminSection, tab: AdminTab) => void);
  onSelectLocation: (id: number | null) => void;
  onGoToMenu: () => void;
  onLogout: () => void;
}

export function AdminMobileNav({
  roleLabel,
  locationBadge,
  isSuperAdmin,
  activeSection,
  activeTab,
  selectedLocationId,
  locations,
  isTelegram,
  onSelectSection,
  onSelectTab,
  onSelectLocation,
  onGoToMenu,
  onLogout,
}: AdminMobileNavProps) {
  const handleSelectTab = (tab: AdminTab, section: AdminSection = activeSection) => {
    haptic("light");
    if (onSelectTab.length >= 2) {
      (onSelectTab as (section: AdminSection, tab: AdminTab) => void)(section, tab);
    } else {
      (onSelectTab as (tab: AdminTab) => void)(tab);
    }
  };
  return (
    <div className="md:hidden px-4 pt-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {isTelegram && (
            <button
              type="button"
              onClick={() => {
                haptic("light");
                onGoToMenu();
              }}
              className="app-press inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-bold border shadow-sm transition-all shrink-0"
              style={{
                background: "var(--app-surface-2)",
                borderColor: "var(--app-border)",
                color: "var(--tg-theme-button-color)",
              }}
              title="Повернутися до меню ресторану"
            >
              <span>🍽️</span>
              <span>До меню</span>
            </button>
          )}
          <h1 className="text-base sm:text-xl font-bold tracking-tight truncate">Адмін-панель</h1>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
            >
              {roleLabel}
            </span>
            {locationBadge && <span className="text-[10px] opacity-60">{locationBadge}</span>}
          </div>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onLogout();
            }}
            className="app-press rounded-xl p-1.5 text-sm border border-rose-500/30 text-rose-500 hover:bg-rose-500/10 transition-colors"
            title="Вийти з акаунта адміна"
            aria-label="Вийти з акаунта адміна"
          >
            🚪
          </button>
        </div>
      </div>

      {/* 1. Глобальний перемикач на 2 розділи (тільки для головного адміна) */}
      {isSuperAdmin && (
        <div
          className="mt-3 grid grid-cols-2 gap-1 rounded-xl p-1 text-xs font-semibold"
          style={{ background: "var(--app-surface-2)" }}
        >
          <button
            onClick={() => {
              haptic("light");
              onSelectSection?.("operations");
              if (
                activeTab === "users" ||
                activeTab === "managers" ||
                activeTab === "analytics" ||
                activeTab === "broadcasts"
              ) {
                handleSelectTab("orders", "operations");
              }
            }}
            className={`app-press rounded-lg py-2 text-center transition-all ${
              activeSection === "operations" ? "shadow-sm font-bold" : "opacity-65"
            }`}
            style={
              activeSection === "operations"
                ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                : undefined
            }
          >
            🍕 Заклад (Операційний)
          </button>
          <button
            onClick={() => {
              haptic("light");
              onSelectSection?.("management");
              if (
                activeTab !== "users" &&
                activeTab !== "managers" &&
                activeTab !== "analytics" &&
                activeTab !== "broadcasts"
              ) {
                handleSelectTab("analytics", "management");
              }
            }}
            className={`app-press rounded-lg py-2 text-center transition-all ${
              activeSection === "management" ? "shadow-sm font-bold" : "opacity-65"
            }`}
            style={
              activeSection === "management"
                ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                : undefined
            }
          >
            📊 Керування та аналітика
          </button>
        </div>
      )}

      {/* 2. Підвкладки розділу "Заклад" */}
      {activeSection === "operations" && (
        <div
          className="mt-2 flex rounded-xl p-1 text-xs font-medium overflow-x-auto no-scrollbar gap-1 overscroll-contain touch-pan-x"
          style={{ background: "var(--app-surface-2)" }}
        >
          {[
            { tab: "orders" as AdminTab, label: "📦 Замовлення" },
            { tab: "catalog" as AdminTab, label: "🍕 Меню" },
            { tab: "options" as AdminTab, label: "🥫 Опції" },
            { tab: "stoplist" as AdminTab, label: "⛔ Стоп" },
            { tab: "delivery" as AdminTab, label: "🛵 Доставка" },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => handleSelectTab(item.tab, "operations")}
              className={`app-press flex-1 shrink-0 whitespace-nowrap rounded-lg px-2.5 py-2 text-center transition-all ${
                activeTab === item.tab ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === item.tab
                  ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                  : undefined
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* 2. Підвкладки розділу "Керування та аналітика" (тільки для головного адміна) */}
      {activeSection === "management" && isSuperAdmin && (
        <div
          className="mt-2 flex rounded-xl p-1 text-xs font-medium gap-1 overflow-x-auto no-scrollbar"
          style={{ background: "var(--app-surface-2)" }}
        >
          {[
            { tab: "analytics" as AdminTab, label: "📊 Аналітика" },
            { tab: "broadcasts" as AdminTab, label: "📢 Розсилки" },
            { tab: "users" as AdminTab, label: "👥 Клієнти" },
            { tab: "managers" as AdminTab, label: "👔 Штат" },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => handleSelectTab(item.tab, "management")}
              className={`app-press flex-1 min-w-[75px] rounded-lg py-2 text-center transition-all ${
                activeTab === item.tab ? "shadow-sm font-bold" : "opacity-70"
              }`}
              style={
                activeTab === item.tab
                  ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                  : undefined
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      )}

      {/* Фільтр по закладах для Admin */}
      {isSuperAdmin &&
        (activeTab === "orders" ||
          activeTab === "catalog" ||
          activeTab === "stoplist" ||
          activeTab === "delivery" ||
          activeTab === "analytics") &&
        locations.length > 1 && (
          <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <button
              onClick={() => {
                haptic("light");
                onSelectLocation(null);
              }}
              className="app-press shrink-0 rounded-full px-3 py-1.5 font-medium transition-all"
              style={
                selectedLocationId === null
                  ? {
                      background: "var(--tg-theme-button-color)",
                      color: "var(--tg-theme-button-text-color)",
                    }
                  : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
              }
            >
              Всі заклади
            </button>
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => {
                  haptic("light");
                  onSelectLocation(loc.id);
                }}
                className="app-press shrink-0 rounded-full px-3 py-1.5 font-medium transition-all"
                style={
                  selectedLocationId === loc.id
                    ? {
                        background: "var(--tg-theme-button-color)",
                        color: "var(--tg-theme-button-text-color)",
                      }
                    : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
                }
              >
                {loc.name}
              </button>
            ))}
          </div>
        )}
    </div>
  );
}
