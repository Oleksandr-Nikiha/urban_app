import type { AdminTab } from "./types";

interface AdminHeaderProps {
  activeTab: AdminTab;
  isSuperAdmin: boolean;
  locationBadge: string;
  isTelegram: boolean;
  onGoToMenu: () => void;
  onLogout: () => void;
}

export function AdminHeader({
  activeTab,
  isSuperAdmin,
  locationBadge,
  isTelegram,
  onGoToMenu,
  onLogout,
}: AdminHeaderProps) {
  const getTabTitle = (tab: AdminTab) => {
    switch (tab) {
      case "catalog":
        return "🍕 Меню та категорії";
      case "options":
        return "🥫 Модифікатори та соуси";
      case "stoplist":
        return "⛔ Стоп-лист страв";
      case "delivery":
        return "🛵 Налаштування доставки";
      case "orders":
        return "📦 Замовлення";
      case "analytics":
        return "📊 Аналітика та статистика";
      case "broadcasts":
        return "📢 Маркетингові розсилки";
      case "users":
        return "👥 Клієнти закладу";
      case "managers":
        return isSuperAdmin ? "👔 Штат та ролі" : "";
      default:
        return "";
    }
  };

  return (
    <div className="hidden md:flex items-center justify-between border-b border-[var(--app-border)] bg-[var(--app-surface)] px-8 py-3.5">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-bold tracking-tight">{getTabTitle(activeTab)}</h2>
        {locationBadge && (
          <span
            className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ background: "var(--app-surface-2)" }}
          >
            {locationBadge}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        {isTelegram && (
          <button
            onClick={onGoToMenu}
            className="app-press rounded-xl px-3 py-1.5 text-xs font-bold border border-[var(--app-border)] bg-[var(--app-surface-2)] hover:bg-[var(--app-surface-3)] transition-colors flex items-center gap-1.5"
          >
            <span>🍽️</span>
            <span>До меню ресторану</span>
          </button>
        )}
        <button
          onClick={onLogout}
          className="rounded-xl px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          Вийти
        </button>
      </div>
    </div>
  );
}
