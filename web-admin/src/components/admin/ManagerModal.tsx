import { useState, useMemo } from "react";
import { useAdminUsers, useAdminManagers, useCreateManager, useUpdateManager } from "@/api/queries";
import type { AdminUser, Location, Manager } from "@/api/types";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function ManagerModal({
  manager,
  locations,
  initialUser = null,
  onClose,
}: {
  manager: Manager | null;
  locations: Location[];
  initialUser?: AdminUser | null;
  onClose: () => void;
}) {
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(initialUser);
  const [telegramId, setTelegramId] = useState(
    manager
      ? String(manager.telegram_id)
      : initialUser?.telegram_id
      ? String(initialUser.telegram_id)
      : "",
  );
  const [selectionMode, setSelectionMode] = useState<"client" | "manual">(
    manager ? "manual" : "client",
  );
  const [clientSearch, setClientSearch] = useState("");
  const [role, setRole] = useState<"admin" | "manager">(manager?.role || "manager");
  const [locationId, setLocationId] = useState<string>(
    manager?.location_id ? String(manager.location_id) : "",
  );

  const { data: users = [], isPending: isUsersPending } = useAdminUsers(clientSearch);
  const { data: managers = [] } = useAdminManagers();

  const createManager = useCreateManager();
  const updateManager = useUpdateManager();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedLoc = locationId ? Number(locationId) : null;

    if (manager) {
      updateManager.mutate(
        {
          managerId: manager.id,
          payload: {
            role,
            location_id: parsedLoc,
          },
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const tid = parseInt(telegramId.trim(), 10);
      if (isNaN(tid)) {
        alert("Оберіть клієнта зі списку або введіть числовий Telegram ID");
        return;
      }
      createManager.mutate(
        {
          telegram_id: tid,
          role,
          location_id: parsedLoc,
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
          onError: (err) => {
            alert(`Помилка: ${err.message}`);
          },
        },
      );
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  const filteredUsers = useMemo(() => {
    if (!users) return [];
    if (!clientSearch.trim()) return users.slice(0, 10);
    const q = clientSearch.toLowerCase().trim();
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.phone.includes(q) ||
        (u.telegram_id != null && String(u.telegram_id).includes(q)),
    ).slice(0, 15);
  }, [users, clientSearch]);

  const existingManager = useMemo(() => {
    if (!telegramId) return null;
    const tid = parseInt(telegramId, 10);
    return managers.find((m) => m.telegram_id === tid);
  }, [managers, telegramId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-md rounded-t-3xl sm:rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto bg-white dark:bg-[#1c1c1e] shadow-2xl"
        style={{ border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between pb-2 border-b" style={{ borderColor: "var(--app-border)" }}>
          <h3 className="font-bold text-base flex items-center gap-2">
            <span>{manager ? "✏️" : "👔"}</span>
            <span>{manager ? "Редагування співробітника" : "Призначити співробітника"}</span>
          </h3>
          <button onClick={onClose} className="p-1 rounded-full opacity-60 hover:opacity-100 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Якщо створюємо нового співробітника: вибір клієнта або ручне введення */}
          {!manager && (
            <div className="space-y-2">
              <div className="flex rounded-xl p-1 gap-1" style={{ background: "var(--app-surface-2)" }}>
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setSelectionMode("client");
                  }}
                  className={`flex-1 py-2 text-center rounded-lg font-semibold transition ${
                    selectionMode === "client"
                      ? "shadow-sm bg-white dark:bg-[#2c2c2e] text-[var(--tg-theme-text-color)]"
                      : "opacity-60"
                  }`}
                >
                  👥 З бази клієнтів
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setSelectionMode("manual");
                  }}
                  className={`flex-1 py-2 text-center rounded-lg font-semibold transition ${
                    selectionMode === "manual"
                      ? "shadow-sm bg-white dark:bg-[#2c2c2e] text-[var(--tg-theme-text-color)]"
                      : "opacity-60"
                  }`}
                >
                  ✏️ Ввести ID вручну
                </button>
              </div>

              {selectionMode === "client" ? (
                <div className="space-y-2">
                  {selectedUser ? (
                    <div
                      className="rounded-2xl p-3 border flex items-center justify-between"
                      style={{
                        background: "color-mix(in srgb, #10b981 10%, var(--app-surface))",
                        borderColor: "color-mix(in srgb, #10b981 40%, transparent)",
                      }}
                    >
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">👤</span>
                          <span className="font-bold text-xs">{selectedUser.full_name}</span>
                          {existingManager && (
                            <span className="text-[10px] rounded px-1.5 py-0.2 font-semibold bg-amber-500/20 text-amber-500">
                              Вже в штаті
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[11px] opacity-70">
                          📞 {selectedUser.phone} {selectedUser.telegram_id ? (
                            <>• 🆔 <span className="font-mono font-semibold">{selectedUser.telegram_id}</span></>
                          ) : (
                            <>• 🌐 <span className="font-sans font-semibold">Веб-клієнт</span></>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedUser(null);
                          setTelegramId("");
                        }}
                        className="text-xs font-semibold text-blue-500 hover:underline px-2 py-1"
                      >
                        Змінити
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="relative">
                        <input
                          type="text"
                          value={clientSearch}
                          onChange={(e) => setClientSearch(e.target.value)}
                          placeholder="Пошук за ім'ям, телефоном або Telegram ID..."
                          className="w-full rounded-xl p-2.5 pr-8 text-xs outline-none focus:ring-2 focus:ring-blue-500 border border-[var(--app-border)]"
                          style={inputStyle}
                        />
                        {clientSearch && (
                          <button
                            type="button"
                            onClick={() => setClientSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-40 hover:opacity-100"
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      <div
                        className="max-h-44 overflow-y-auto rounded-xl border border-[var(--app-border)] p-1 divide-y divide-[var(--app-border)] text-xs"
                        style={{ background: "var(--app-surface-2)" }}
                      >
                        {isUsersPending ? (
                          <div className="p-3 text-center opacity-60">Завантаження клієнтів...</div>
                        ) : filteredUsers.length === 0 ? (
                          <div className="p-3 text-center opacity-50">
                            Клієнтів не знайдено
                          </div>
                        ) : (
                          filteredUsers.map((u) => {
                            const isMgr = u.telegram_id ? managers.find((m) => m.telegram_id === u.telegram_id) : undefined;
                            return (
                              <button
                                key={u.id}
                                type="button"
                                onClick={() => {
                                  setSelectedUser(u);
                                  setTelegramId(u.telegram_id ? String(u.telegram_id) : "");
                                }}
                                className="w-full text-left p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition flex items-center justify-between gap-2"
                              >
                                <div className="truncate">
                                  <p className="font-semibold text-xs flex items-center gap-1.5 truncate">
                                    <span>{isMgr ? "👔" : "👤"}</span>
                                    <span className="truncate">{u.full_name}</span>
                                    {isMgr && (
                                      <span className="text-[9px] shrink-0 px-1 py-0.2 rounded bg-amber-500/15 text-amber-500 font-bold">
                                        В штаті
                                      </span>
                                    )}
                                  </p>
                                  <p className="text-[11px] opacity-60 font-mono">
                                    📞 {u.phone} {u.telegram_id ? `• 🆔 ${u.telegram_id}` : "• 🌐 Веб"}
                                  </p>
                                </div>
                                <span className="text-xs text-blue-500 font-bold shrink-0">
                                  Обрати →
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <label className="block">
                  <span className="opacity-60">Telegram ID</span>
                  <input
                    type="number"
                    value={telegramId}
                    onChange={(e) => setTelegramId(e.target.value)}
                    placeholder="123456789"
                    required
                    className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-[var(--app-border)]"
                    style={inputStyle}
                  />
                  <span className="mt-1 block text-[10px] opacity-50">
                    Користувач вже повинен відкрити бот або додаток, щоб бути в базі.
                  </span>
                </label>
              )}
            </div>
          )}

          {manager && (
            <div className="rounded-xl p-3 border border-[var(--app-border)] bg-[var(--app-surface-2)]">
              <p className="font-bold text-xs">👤 {manager.full_name}</p>
              <p className="text-[11px] opacity-70 mt-0.5">📞 {manager.phone} • 🆔 {manager.telegram_id}</p>
            </div>
          )}

          <label className="block">
            <span className="opacity-60 font-medium">Роль співробітника</span>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "manager")}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-[var(--app-border)]"
              style={inputStyle}
            >
              <option value="manager">Менеджер закладу</option>
              <option value="admin">Головний адміністратор</option>
            </select>
          </label>

          <label className="block">
            <span className="opacity-60 font-medium">Заклад (прив'язка)</span>
            <select
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none border border-[var(--app-border)]"
              style={inputStyle}
            >
              <option value="">Без прив'язки (всі заклади)</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70 border border-[var(--app-border)]"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={createManager.isPending || updateManager.isPending}
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              {createManager.isPending || updateManager.isPending ? "Збереження..." : "Зберегти"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
