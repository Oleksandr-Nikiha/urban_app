import { useEffect, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";

import { hasAdminAuth, removeAdminToken } from "@/api/client";
import {
  isTelegramWebApp,
  getTelegramStartParam,
  isStartParamConsumed,
  markStartParamConsumed,
} from "@/telegram/env";
import { useAdminMe, useLocations } from "@/api/queries";
import { ErrorBox, Spinner } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { AdminSidebar } from "@/components/admin/layout/AdminSidebar";
import { AdminHeader } from "@/components/admin/layout/AdminHeader";
import { AdminMobileNav } from "@/components/admin/layout/AdminMobileNav";
import { AdminTabContent } from "@/components/admin/layout/AdminTabContent";
import type { AdminSection, AdminTab } from "@/components/admin/layout/types";

export function AdminPage() {
  const navigate = useNavigate();
  useBackButton(() => {
    if (isTelegramWebApp()) {
      navigate("/");
    }
  });

  const { data: adminMe, isPending: mePending, error: meError } = useAdminMe();
  const { data: locations = [] } = useLocations();

  const [searchParams, setSearchParams] = useSearchParams();
  const rawOrderId = searchParams.get("order_id") || searchParams.get("edit_order");
  const startParam = getTelegramStartParam();
  const startOrderMatch = startParam?.match(/^(?:order_?)?(\d+)$/i);
  const startOrderId =
    startOrderMatch && !isStartParamConsumed(startParam ?? undefined) ? startOrderMatch[1] : null;

  const [initialOrderId, setInitialOrderId] = useState<number | null>(() => {
    const raw = rawOrderId || startOrderId;
    return raw ? parseInt(raw, 10) : null;
  });

  const handleCloseEditingOrder = () => {
    setInitialOrderId(null);
    markStartParamConsumed();
    if (searchParams.has("order_id") || searchParams.has("edit_order")) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("order_id");
          next.delete("edit_order");
          return next;
        },
        { replace: true }
      );
    }
  };

  const [activeSection, setActiveSection] = useState<AdminSection>("operations");
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  const isSuperAdmin = adminMe?.role === "admin";
  const isTg = isTelegramWebApp();

  useEffect(() => {
    if (initialOrderId) {
      setActiveSection("operations");
      setActiveTab("orders");
    }
  }, [initialOrderId]);

  useEffect(() => {
    if (
      adminMe &&
      !isSuperAdmin &&
      (activeTab === "managers" || activeTab === "analytics" || activeTab === "broadcasts")
    ) {
      setActiveTab("orders");
      setActiveSection("operations");
    }
  }, [adminMe, isSuperAdmin, activeTab]);

  // Якщо менеджер прив'язаний до закладу — автоматично фіксуємо локацію
  const effectiveLocationId =
    adminMe?.role === "manager" ? (adminMe.location_id ?? null) : selectedLocationId;

  // Якщо ми у звичайному браузері і немає авторизації адміна — переходимо на екран входу
  if (!isTg && !hasAdminAuth()) {
    return <Navigate to="/login" replace />;
  }

  const handleLogout = () => {
    removeAdminToken();
    navigate("/login", { replace: true });
  };

  const handleGoToMenu = () => {
    navigate("/");
  };

  if (mePending) return <Spinner />;

  if (meError) {
    if (!isTg) {
      removeAdminToken();
      return <Navigate to="/login" replace />;
    }
    return <ErrorBox message={meError.message} onRetry={() => window.location.reload()} />;
  }

  if (!adminMe || !adminMe.is_staff) {
    if (!isTg) {
      removeAdminToken();
      return <Navigate to="/login" replace />;
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl">⛔</div>
        <p className="mt-4 text-lg font-bold">Доступ обмежено</p>
        <p className="mt-2 text-sm opacity-60">
          Цей розділ доступний лише для персоналу та адміністрації закладу.
        </p>
        <button
          onClick={() => navigate("/profile")}
          className="app-press mt-6 rounded-xl px-5 py-2.5 font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Повернутися в профіль
        </button>
      </div>
    );
  }

  const roleLabel = adminMe.role === "admin" ? "👑 Головний адмін" : "👔 Менеджер";
  const locationBadge = adminMe.location_name
    ? `📍 ${adminMe.location_name}`
    : adminMe.role === "admin"
      ? "🌐 Усі заклади"
      : "";

  return (
    <div className="min-h-screen pb-16 md:pb-8 flex flex-col md:flex-row bg-[var(--tg-theme-bg-color)]">
      {/* 💻 ДЕСКТОПНИЙ САЙДБАР */}
      <AdminSidebar
        roleLabel={roleLabel}
        locationBadge={locationBadge}
        isSuperAdmin={isSuperAdmin}
        selectedLocationId={selectedLocationId}
        locations={locations}
        activeSection={activeSection}
        activeTab={activeTab}
        isTelegram={isTg}
        onSelectLocation={setSelectedLocationId}
        onSelectTab={(sec, tab) => {
          setActiveSection(sec);
          setActiveTab(tab);
        }}
        onGoToMenu={handleGoToMenu}
        onLogout={handleLogout}
      />

      {/* Головна робоча зона */}
      <main className="flex-1 min-w-0">
        {/* Десктопний верхній бар */}
        <AdminHeader
          activeTab={activeTab}
          isSuperAdmin={isSuperAdmin}
          locationBadge={locationBadge}
          isTelegram={isTg}
          onGoToMenu={handleGoToMenu}
          onLogout={handleLogout}
        />

        {/* Мобільна навігація */}
        <AdminMobileNav
          roleLabel={roleLabel}
          locationBadge={locationBadge}
          isSuperAdmin={isSuperAdmin}
          activeSection={activeSection}
          activeTab={activeTab}
          selectedLocationId={selectedLocationId}
          locations={locations}
          isTelegram={isTg}
          onSelectSection={setActiveSection}
          onSelectTab={setActiveTab}
          onSelectLocation={setSelectedLocationId}
          onGoToMenu={handleGoToMenu}
          onLogout={handleLogout}
        />

        {/* Вміст активної вкладки */}
        <AdminTabContent
          activeTab={activeTab}
          adminMe={adminMe}
          effectiveLocationId={effectiveLocationId}
          locations={locations}
          isSuperAdmin={isSuperAdmin}
          initialOrderId={initialOrderId}
          isTelegram={isTg}
          onCloseEditingOrder={handleCloseEditingOrder}
          onGoToMenu={handleGoToMenu}
          onLogout={handleLogout}
        />
      </main>
    </div>
  );
}
