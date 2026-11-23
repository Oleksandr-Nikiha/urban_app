import { Suspense, lazy } from "react";
import { haptic, closeMiniApp } from "@/telegram/sdk";
import type { AdminTab } from "./types";
import type { AdminMe, Location } from "@/api/types";

const AnalyticsTab = lazy(() => import("@/components/admin/AnalyticsTab").then((m) => ({ default: m.AnalyticsTab })));
const BroadcastsTab = lazy(() => import("@/components/admin/BroadcastsTab").then((m) => ({ default: m.BroadcastsTab })));
const OrdersTab = lazy(() => import("@/components/admin/OrdersTab").then((m) => ({ default: m.OrdersTab })));
const CatalogTab = lazy(() => import("@/components/admin/CatalogTab").then((m) => ({ default: m.CatalogTab })));
const OptionGroupsTab = lazy(() => import("@/components/admin/OptionGroupsTab").then((m) => ({ default: m.OptionGroupsTab })));
const StopListTab = lazy(() => import("@/components/admin/StopListTab").then((m) => ({ default: m.StopListTab })));
const DeliverySettingsTab = lazy(() => import("@/components/admin/DeliverySettingsTab").then((m) => ({ default: m.DeliverySettingsTab })));
const UsersTab = lazy(() => import("@/components/admin/UsersTab").then((m) => ({ default: m.UsersTab })));
const ManagersTab = lazy(() => import("@/components/admin/ManagersTab").then((m) => ({ default: m.ManagersTab })));

interface AdminTabContentProps {
  activeTab: AdminTab;
  adminMe: AdminMe;
  effectiveLocationId: number | null;
  locations: Location[];
  isSuperAdmin: boolean;
  initialOrderId: number | null;
  isTelegram: boolean;
  onCloseEditingOrder: () => void;
  onGoToMenu: () => void;
  onLogout: () => void;
}

export function AdminTabContent({
  activeTab,
  adminMe,
  effectiveLocationId,
  locations,
  isSuperAdmin,
  initialOrderId,
  isTelegram,
  onCloseEditingOrder,
  onGoToMenu,
  onLogout,
}: AdminTabContentProps) {
  return (
    <div className="mt-4 px-4 md:px-8 max-w-7xl pb-12">
      <Suspense
        fallback={
          <div className="flex h-64 items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
          </div>
        }
      >
        {activeTab === "orders" && (
          <OrdersTab
            locationId={effectiveLocationId}
            initialEditingOrderId={initialOrderId}
            onCloseEditingOrder={onCloseEditingOrder}
          />
        )}
        {activeTab === "analytics" && isSuperAdmin && (
          <AnalyticsTab locationId={effectiveLocationId} />
        )}
        {activeTab === "broadcasts" && isSuperAdmin && <BroadcastsTab />}
        {activeTab === "catalog" && (
          <CatalogTab
            locationId={effectiveLocationId}
            locations={locations}
            isSuperAdmin={adminMe.role === "admin"}
            userLocationId={adminMe.location_id}
          />
        )}
        {activeTab === "options" && <OptionGroupsTab />}
        {activeTab === "stoplist" && <StopListTab locationId={effectiveLocationId} />}
        {activeTab === "delivery" && (
          <DeliverySettingsTab
            locationId={effectiveLocationId}
            isSuperAdmin={adminMe.role === "admin"}
          />
        )}
        {activeTab === "users" && isSuperAdmin && (
          <UsersTab locations={locations} isSuperAdmin={isSuperAdmin} />
        )}
        {activeTab === "managers" && isSuperAdmin && (
          <ManagersTab locations={locations} />
        )}
      </Suspense>

      {/* Кнопка повернення до меню ресторану внизу сторінки (мобільна) */}
      <div className="md:hidden mt-8 px-4 pb-6 space-y-2">
        {isTelegram && (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onGoToMenu();
            }}
            className="app-press w-full flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold shadow-sm transition-all border"
            style={{
              background: "var(--app-surface)",
              borderColor: "var(--app-border)",
              color: "var(--tg-theme-button-color)",
            }}
          >
            <span>🍽️</span>
            <span>Повернутися до меню ресторану</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            haptic("light");
            onLogout();
          }}
          className="app-press w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-rose-500 hover:bg-rose-500/10 border border-rose-500/20 transition-colors"
        >
          <span>🚪</span>
          <span>Вийти з акаунта адміна</span>
        </button>
        {isTelegram && (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              closeMiniApp();
            }}
            className="app-press w-full flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
          >
            <span>✕</span>
            <span>Закрити застосунок</span>
          </button>
        )}
      </div>
    </div>
  );
}
