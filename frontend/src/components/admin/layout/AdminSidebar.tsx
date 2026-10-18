import type { AdminSection, AdminTab } from "./types";
import type { Location } from "@/api/types";

interface AdminSidebarProps {
  roleLabel: string;
  locationBadge: string;
  isSuperAdmin: boolean;
  selectedLocationId: number | null;
  locations: Location[];
  activeSection: AdminSection;
  activeTab: AdminTab;
  isTelegram: boolean;
  onSelectLocation: (id: number | null) => void;
  onSelectTab: (section: AdminSection, tab: AdminTab) => void;
  onGoToMenu: () => void;
  onLogout: () => void;
}

export function AdminSidebar({
  roleLabel,
  locationBadge,
  isSuperAdmin,
  selectedLocationId,
  locations,
  activeSection,
  activeTab,
  isTelegram,
  onSelectLocation,
  onSelectTab,
  onGoToMenu,
  onLogout,
}: AdminSidebarProps) {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col justify-between border-r border-[var(--app-border)] bg-[var(--app-surface)] p-4 min-h-screen sticky top-0 h-screen overflow-y-auto">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <img
              src={`${import.meta.env.BASE_URL}logo.svg`}
              alt="Urban Bites"
              className="h-10 w-10 rounded-xl shadow-xs object-cover border border-amber-500/20"
            />
            <div>
              <h1 className="font-bold text-sm leading-tight">Urban Bites Admin</h1>
              <p className="text-[10px] opacity-60">Панель керування</p>
            </div>
          </div>
          {isTelegram && (
            <button
              onClick={onGoToMenu}
              className="app-press rounded-xl px-2.5 py-1.5 text-xs font-bold border border-[var(--app-border)] bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)] transition-colors flex items-center gap-1"
              title="Перейти до меню ресторану"
            >
              <span>🍽️</span>
              <span className="text-[11px]">Меню</span>
            </button>
          )}
        </div>

        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-3 space-y-1.5">
          <div className="flex items-center">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold"
              style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
            >
              {roleLabel}
            </span>
          </div>
          {locationBadge && <p className="text-[11px] opacity-70 font-medium">{locationBadge}</p>}
        </div>

        {isSuperAdmin && (
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider opacity-60 block mb-1">
              Заклад
            </label>
            <select
              value={selectedLocationId ?? ""}
              onChange={(e) => onSelectLocation(e.target.value ? Number(e.target.value) : null)}
              className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] px-2.5 py-2 text-xs font-medium focus:outline-none"
            >
              <option value="">🌐 Усі заклади</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  📍 {loc.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider opacity-40 px-2 mb-1.5">
            Операції закладу
          </p>
          {[
            { tab: "orders" as AdminTab, label: "Замовлення", icon: "📦" },
            { tab: "catalog" as AdminTab, label: "Меню та категорії", icon: "🍕" },
            { tab: "options" as AdminTab, label: "Модифікатори та соуси", icon: "🥫" },
            { tab: "stoplist" as AdminTab, label: "Стоп-лист", icon: "⛔" },
            { tab: "delivery" as AdminTab, label: "Доставка та години", icon: "🛵" },
          ].map((item) => (
            <button
              key={item.tab}
              onClick={() => onSelectTab("operations", item.tab)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all text-left ${
                activeTab === item.tab && activeSection === "operations"
                  ? "shadow-sm font-bold"
                  : "opacity-70 hover:opacity-100 hover:bg-[var(--app-surface-2)]"
              }`}
              style={
                activeTab === item.tab && activeSection === "operations"
                  ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                  : undefined
              }
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          {isSuperAdmin && (
            <>
              <p className="text-[9px] font-bold uppercase tracking-wider opacity-40 px-2 pt-3 mb-1.5">
                Керування та аналітика
              </p>
              {[
                { tab: "analytics" as AdminTab, label: "Аналітика", icon: "📊" },
                { tab: "broadcasts" as AdminTab, label: "Розсилки", icon: "📢" },
                { tab: "users" as AdminTab, label: "Клієнти", icon: "👥" },
                { tab: "managers" as AdminTab, label: "Штат і ролі", icon: "👔" },
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => onSelectTab("management", item.tab)}
                  className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all text-left ${
                    activeTab === item.tab && activeSection === "management"
                      ? "shadow-sm font-bold"
                      : "opacity-70 hover:opacity-100 hover:bg-[var(--app-surface-2)]"
                  }`}
                  style={
                    activeTab === item.tab && activeSection === "management"
                      ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                      : undefined
                  }
                >
                  <span>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </>
          )}
        </nav>
      </div>

      <div className="pt-3 border-t border-[var(--app-border)]">
        <button
          onClick={onLogout}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <span>🚪</span>
          <span>Вийти з адмінки</span>
        </button>
      </div>
    </aside>
  );
}
