import { useState } from "react";
import {
  useAdminMe,
  useAdminManagers,
  useUpdateManager,
  useDeleteManager,
} from "@/api/queries";
import type { Location, Manager } from "@/api/types";
import { ErrorBox, Spinner } from "@/components/ui";
import { ManagerModal } from "./ManagerModal";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function ManagersTab({ locations }: { locations: Location[] }) {
  const { data: adminMe } = useAdminMe();
  if (adminMe && adminMe.role !== "admin") {
    return (
      <ErrorBox message="Доступ обмежено. Розділ доступний лише для головного адміністратора." />
    );
  }

  const { data: managers = [], isPending, error } = useAdminManagers();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingManager, setEditingManager] = useState<Manager | null>(null);

  const updateManager = useUpdateManager();
  const deleteManager = useDeleteManager();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Співробітники ({managers.length})</h2>
          <p className="text-xs opacity-60">Управління доступом до адмінки та модерації</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            setEditingManager(null);
            setModalOpen(true);
          }}
          className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          <span>+</span> Додати
        </button>
      </div>

      <div className="space-y-2.5">
        {managers.map((m) => {
          const isSuper = m.role === "admin";
          return (
            <div
              key={m.id}
              className="app-card rounded-2xl p-3.5 transition-all"
              style={{
                border: "1px solid var(--app-border)",
                opacity: m.is_active ? 1 : 0.5,
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-base">{isSuper ? "👑" : "👔"}</span>
                    <span className="text-sm font-bold">{m.full_name}</span>
                    <span
                      className="rounded-full px-2 py-0.2 text-[10px] font-bold"
                      style={{
                        background: isSuper
                          ? "color-mix(in srgb, #f59e0b 20%, transparent)"
                          : "var(--app-tint)",
                        color: isSuper ? "#d97706" : "var(--tg-theme-button-color)",
                      }}
                    >
                      {isSuper ? "Адміністратор" : "Менеджер"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs opacity-70">📞 {m.phone}</p>
                  <p className="text-[11px] opacity-50">
                    ID: {m.telegram_id} {m.location_name && `• 📍 ${m.location_name}`}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => {
                      haptic("light");
                      updateManager.mutate({
                        managerId: m.id,
                        payload: { is_active: !m.is_active },
                      });
                    }}
                    className="app-press rounded-lg px-2 py-1 text-[11px] font-bold"
                    style={{
                      background: m.is_active
                        ? "color-mix(in srgb, #22c55e 15%, transparent)"
                        : "color-mix(in srgb, #ef4444 15%, transparent)",
                      color: m.is_active ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {m.is_active ? "Активний" : "Вимкнений"}
                  </button>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        haptic("light");
                        setEditingManager(m);
                        setModalOpen(true);
                      }}
                      className="opacity-60 hover:opacity-100 text-xs"
                      title="Редагувати"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Видалити співробітника ${m.full_name}?`)) {
                          hapticNotify("warning");
                          deleteManager.mutate(m.id);
                        }
                      }}
                      className="opacity-60 hover:opacity-100 text-xs"
                      title="Видалити"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <ManagerModal
          manager={editingManager}
          locations={locations}
          onClose={() => setModalOpen(false)}
        />
      )}
    </div>
  );
}
