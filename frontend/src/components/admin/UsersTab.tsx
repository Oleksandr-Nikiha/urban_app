import { useState } from "react";
import {
  useAdminUsers,
  useUpdateAdminUser,
  useDeleteAdminUser,
  useBonusAnalytics,
  useAdminUserBonusHistory,
} from "@/api/queries";
import type { AdminUser, Location } from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { ManagerModal } from "./ManagerModal";
import { haptic, hapticNotify, showConfirm } from "@/telegram/sdk";

export function UsersTab({
  locations = [],
  isSuperAdmin = false,
}: {
  locations?: Location[];
  isSuperAdmin?: boolean;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const { data: users = [], isPending, error } = useAdminUsers(query);
  const { data: bonusStats } = useBonusAnalytics();
  const [staffModalUser, setStaffModalUser] = useState<AdminUser | null>(null);

  const updateUser = useUpdateAdminUser();
  const deleteUser = useDeleteAdminUser();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setQuery(searchInput.trim());
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold">База клієнтів ({users.length})</h2>
        <p className="text-xs opacity-60">
          Пошук за номером телефону, ім'ям або Telegram ID, бонуси та керування клієнтами
        </p>
      </div>

      {/* Аналітика бонусного фонду URBAN CLUB (для суперадміна) */}
      {isSuperAdmin && bonusStats && (
        <div
          className="app-card rounded-2xl p-4 space-y-3"
          style={{
            background: "color-mix(in srgb, #f59e0b 8%, var(--app-surface))",
            border: "1px solid color-mix(in srgb, #f59e0b 25%, var(--app-border))",
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
              <span>💳</span>
              <span>Аналітика URBAN CLUB</span>
            </span>
            <span className="text-[11px] opacity-70">
              Учасників з бонусами: <strong>{bonusStats.total_users_with_bonuses}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-black/10 border border-black/5">
              <span className="text-[10px] opacity-70 block">Баланс фонду</span>
              <strong className="text-sm text-amber-400 font-extrabold">{bonusStats.total_bonus_pool} б.</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-black/10 border border-black/5">
              <span className="text-[10px] opacity-70 block">Нараховано</span>
              <strong className="text-sm text-emerald-400 font-extrabold">+{bonusStats.total_bonuses_issued} б.</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-black/10 border border-black/5">
              <span className="text-[10px] opacity-70 block">Списано</span>
              <strong className="text-sm text-amber-500 font-extrabold">-{bonusStats.total_bonuses_redeemed} б.</strong>
            </div>
            <div className="p-2.5 rounded-xl bg-black/10 border border-black/5">
              <span className="text-[10px] opacity-70 block">Чеків з бонусами</span>
              <strong className="text-sm text-white font-extrabold">{bonusStats.total_orders_with_cashback}</strong>
            </div>
          </div>
        </div>
      )}

      {/* Пошук за номером телефону */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            placeholder="Номер телефону (+380...), ім'я або Telegram ID"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="w-full rounded-xl p-3 pr-8 text-xs font-medium outline-none transition focus:ring-2 focus:ring-blue-500"
            style={{ background: "var(--app-surface-2)" }}
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => {
                setSearchInput("");
                setQuery("");
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm opacity-40 hover:opacity-100"
            >
              ✕
            </button>
          )}
        </div>
        <button
          type="submit"
          className="app-press rounded-xl px-4 py-2.5 text-xs font-semibold"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
          }}
        >
          🔍 Пошук
        </button>
      </form>

      {isPending ? (
        <Spinner />
      ) : error ? (
        <ErrorBox message={error.message} />
      ) : users.length === 0 ? (
        <EmptyState
          icon="👤"
          title="Користувачів не знайдено"
          hint="Спробуйте змінити критерії пошуку"
        />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserCard
              key={u.id}
              user={u}
              isSuperAdmin={isSuperAdmin}
              onToggleBlock={async () => {
                const action = u.is_blocked ? "розблокувати" : "заблокувати";
                const confirmed = await showConfirm(
                  `Ви впевнені, що хочете ${action} користувача ${u.full_name}?`,
                );
                if (confirmed) {
                  updateUser.mutate({ userId: u.id, payload: { is_blocked: !u.is_blocked } });
                }
              }}
              onTogglePhoneVerified={async () => {
                const action = u.is_phone_verified
                  ? "зняти верифікацію телефону"
                  : "встановити верифікацію телефону";
                const message = `Ви впевнені, що хочете ${action} для клієнта ${u.full_name}? ${
                  u.is_phone_verified
                    ? "Клієнт зможе самостійно змінити свій номер у профілі."
                    : ""
                }`;
                const confirmed = await showConfirm(message);
                if (confirmed) {
                  updateUser.mutate({
                    userId: u.id,
                    payload: { is_phone_verified: !u.is_phone_verified },
                  });
                }
              }}
              onSaveNote={(note) => {
                updateUser.mutate({ userId: u.id, payload: { admin_note: note } });
              }}
              onAdjustBonuses={(adjustment, reason) => {
                updateUser.mutate({
                  userId: u.id,
                  payload: {
                    bonus_adjustment: adjustment,
                    bonus_adjustment_reason: reason,
                  },
                });
              }}
              onSetBonusBalance={(balance, reason) => {
                updateUser.mutate({
                  userId: u.id,
                  payload: {
                    bonus_balance: balance,
                    bonus_adjustment_reason: reason,
                  },
                });
              }}
              onDelete={
                isSuperAdmin
                  ? async () => {
                      const confirmed = await showConfirm(
                        `Видалити користувача ${u.full_name} (${u.phone})? Цю дію не можна скасувати.`,
                        "Видалення клієнта",
                      );
                      if (confirmed) {
                        deleteUser.mutate(u.id, {
                          onSuccess: () => hapticNotify("success"),
                          onError: () => hapticNotify("error"),
                        });
                      }
                    }
                  : undefined
              }
              onPromoteToStaff={isSuperAdmin ? () => setStaffModalUser(u) : undefined}
              isUpdating={updateUser.isPending}
              isDeleting={deleteUser.isPending}
            />
          ))}
        </div>
      )}

      {isSuperAdmin && staffModalUser && (
        <ManagerModal
          manager={null}
          initialUser={staffModalUser}
          locations={locations}
          onClose={() => setStaffModalUser(null)}
        />
      )}
    </div>
  );
}

function UserCard({
  user,
  isSuperAdmin,
  onToggleBlock,
  onTogglePhoneVerified,
  onSaveNote,
  onAdjustBonuses,
  onSetBonusBalance,
  onDelete,
  onPromoteToStaff,
  isUpdating,
  isDeleting,
}: {
  user: AdminUser;
  isSuperAdmin?: boolean;
  onToggleBlock: () => void;
  onTogglePhoneVerified: () => void;
  onSaveNote: (note: string) => void;
  onAdjustBonuses?: (adjustment: number, reason: string) => void;
  onSetBonusBalance?: (balance: number, reason: string) => void;
  onDelete?: () => void;
  onPromoteToStaff?: () => void;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [note, setNote] = useState(user.admin_note || "");
  const [isNoteDirty, setIsNoteDirty] = useState(false);
  const [copiedTid, setCopiedTid] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [bonusAmount, setBonusAmount] = useState("");
  const [bonusReason, setBonusReason] = useState("");
  const [showBonusHistory, setShowBonusHistory] = useState(false);

  const handleCopyTid = (e: React.MouseEvent) => {
    e.stopPropagation();
    haptic("light");
    if (!user.telegram_id) return;
    const tidStr = String(user.telegram_id);
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(tidStr).then(() => {
        setCopiedTid(true);
        setTimeout(() => setCopiedTid(false), 2000);
      });
    } else {
      const el = document.createElement("textarea");
      el.value = tidStr;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopiedTid(true);
      setTimeout(() => setCopiedTid(false), 2000);
    }
  };

  const handleAddBonuses = () => {
    const val = Math.abs(parseInt(bonusAmount.trim(), 10));
    if (!val || isNaN(val)) return;
    haptic("medium");
    onAdjustBonuses?.(val, bonusReason.trim() || "Нарахування адміністратором");
    setBonusAmount("");
    setBonusReason("");
  };

  const handleDeductBonuses = () => {
    const val = Math.abs(parseInt(bonusAmount.trim(), 10));
    if (!val || isNaN(val)) return;
    haptic("medium");
    onAdjustBonuses?.(-val, bonusReason.trim() || "Списання адміністратором");
    setBonusAmount("");
    setBonusReason("");
  };

  const handleSetBalance = () => {
    const val = parseInt(bonusAmount.trim(), 10);
    if (isNaN(val) || val < 0) return;
    haptic("medium");
    onSetBonusBalance?.(val, bonusReason.trim() || "Встановлення балансу");
    setBonusAmount("");
    setBonusReason("");
  };

  return (
    <div
      className="app-card rounded-2xl p-3.5 sm:p-4 transition-all"
      style={{
        border: user.is_blocked ? "1px solid #ef4444" : "1px solid var(--app-border)",
        background: user.is_blocked
          ? "color-mix(in srgb, #ef4444 6%, var(--app-surface))"
          : "var(--app-surface)",
      }}
    >
      {/* Шапка картки клієнта: Ім'я, статуси та кнопка видалення */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <span className="text-base shrink-0">{user.is_blocked ? "⛔" : "👤"}</span>
            <span className="text-sm font-bold break-words leading-snug" title={user.full_name}>
              {user.full_name}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: user.is_blocked
                  ? "color-mix(in srgb, #ef4444 20%, transparent)"
                  : "color-mix(in srgb, #10b981 20%, transparent)",
                color: user.is_blocked ? "#ef4444" : "#10b981",
              }}
            >
              {user.is_blocked ? "Заблоковано" : "Активний"}
            </span>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
              style={{
                background: user.is_phone_verified
                  ? "color-mix(in srgb, #10b981 15%, transparent)"
                  : "color-mix(in srgb, #f59e0b 15%, transparent)",
                color: user.is_phone_verified ? "#059669" : "#d97706",
              }}
            >
              {user.is_phone_verified ? "✓ Верифіковано" : "⚠️ Не верифіковано"}
            </span>
            <span
              className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold"
              style={{
                background: "color-mix(in srgb, #f59e0b 20%, transparent)",
                color: "#d97706",
              }}
            >
              ✨ {user.bonus_balance ?? 0} б.
            </span>
          </div>
        </div>

        {isSuperAdmin && onDelete && (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onDelete();
            }}
            disabled={isDeleting}
            title="Видалити користувача"
            className="app-press shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-xs opacity-60 hover:opacity-100 transition cursor-pointer"
            style={{
              background: "color-mix(in srgb, #ef4444 12%, var(--app-surface-2))",
              border: "1px solid color-mix(in srgb, #ef4444 25%, transparent)",
            }}
          >
            🗑️
          </button>
        )}
      </div>

      {/* Інформація про клієнта: Телефон, Telegram ID, замовлення, дата */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs opacity-80">
        <a href={`tel:${user.phone}`} className="font-semibold text-blue-500 hover:underline">
          📞 {user.phone}
        </a>
        {user.telegram_id ? (
          <button
            type="button"
            onClick={handleCopyTid}
            title="Натисніть, щоб скопіювати Telegram ID"
            className="app-press inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-mono font-semibold transition border cursor-pointer"
            style={{
              background: copiedTid
                ? "color-mix(in srgb, #10b981 20%, var(--app-surface-2))"
                : "var(--app-surface-2)",
              color: copiedTid ? "#10b981" : "inherit",
              borderColor: copiedTid ? "#10b981" : "var(--app-border)",
            }}
          >
            <span>🆔 {user.telegram_id}</span>
            <span className="text-[10px] font-sans font-medium">
              {copiedTid ? "✓ Скопійовано" : "📋"}
            </span>
          </button>
        ) : (
          <span
            className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-mono opacity-60 border"
            style={{ borderColor: "var(--app-border)" }}
            title="Користувач зареєстрований через веб-сайт"
          >
            🌐 Веб
          </span>
        )}
        <span>🛍️ Замовлень: {user.orders_count}</span>
        <span>📅 {user.created_at}</span>
      </div>
      {user.delivery_address && (
        <p className="mt-1 text-xs opacity-60 break-words">📍 Адреса: {user.delivery_address}</p>
      )}

      {/* Рядок дій: Бонуси, Персонал, Верифікація, Блокування */}
      <div className="mt-3 pt-2.5 border-t flex flex-wrap items-center gap-1.5" style={{ borderColor: "var(--app-border)" }}>
        {isSuperAdmin && onAdjustBonuses && (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setShowBonusModal(!showBonusModal);
            }}
            title="Керування бонусами клієнта"
            className="app-press flex h-7 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition cursor-pointer"
            style={{
              background: showBonusModal
                ? "#d97706"
                : "color-mix(in srgb, #f59e0b 18%, var(--app-surface-2))",
              color: showBonusModal ? "#ffffff" : "#d97706",
              border: "1px solid color-mix(in srgb, #f59e0b 35%, transparent)",
            }}
          >
            <span>✨</span>
            <span>Бонуси ({user.bonus_balance ?? 0})</span>
          </button>
        )}

        {onPromoteToStaff && (
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onPromoteToStaff();
            }}
            title="Призначити співробітником"
            className="app-press flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition cursor-pointer"
            style={{
              background: "color-mix(in srgb, #3b82f6 15%, var(--app-surface-2))",
              color: "#3b82f6",
              border: "1px solid color-mix(in srgb, #3b82f6 30%, transparent)",
            }}
          >
            <span>👔</span>
            <span>У персонал</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            haptic("light");
            const action = user.is_phone_verified
              ? "зняти верифікацію телефону"
              : "встановити верифікацію телефону";
            if (
              window.confirm(
                `Ви впевнені, що хочете ${action} для клієнта ${user.full_name}? ${
                  user.is_phone_verified
                    ? "Клієнт зможе самостійно змінити свій номер у профілі."
                    : ""
                }`,
              )
            ) {
              onTogglePhoneVerified();
            }
          }}
          disabled={isUpdating}
          title={
            user.is_phone_verified
              ? "Зняти верифікацію (дозволити клієнту змінити телефон)"
              : "Позначити телефон як верифікований"
          }
          className="app-press flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition cursor-pointer"
          style={{
            background: user.is_phone_verified
              ? "color-mix(in srgb, #f59e0b 15%, var(--app-surface-2))"
              : "color-mix(in srgb, #10b981 15%, var(--app-surface-2))",
            color: user.is_phone_verified ? "#d97706" : "#059669",
            border: "1px solid var(--app-border)",
          }}
        >
          <span>{user.is_phone_verified ? "📱✕" : "📱✓"}</span>
          <span>{user.is_phone_verified ? "Зняти вериф." : "Верифікувати"}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            haptic("light");
            onToggleBlock();
          }}
          disabled={isUpdating}
          title={user.is_blocked ? "Розблокувати клієнта" : "Заблокувати клієнта"}
          className="app-press flex h-7 items-center justify-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition cursor-pointer"
          style={{
            background: user.is_blocked
              ? "color-mix(in srgb, #10b981 15%, var(--app-surface-2))"
              : "color-mix(in srgb, #ef4444 15%, var(--app-surface-2))",
            color: user.is_blocked ? "#10b981" : "#ef4444",
            border: "1px solid var(--app-border)",
          }}
        >
          <span>{user.is_blocked ? "🔓" : "🚫"}</span>
          <span>{user.is_blocked ? "Розблокувати" : "Заблокувати"}</span>
        </button>
      </div>

      {/* Панель керування бонусами клієнта */}
      {showBonusModal && isSuperAdmin && (
        <div
          className="mt-3 border pt-3 space-y-3 rounded-xl p-3"
          style={{
            borderColor: "color-mix(in srgb, #f59e0b 35%, var(--app-border))",
            background: "color-mix(in srgb, #f59e0b 6%, var(--app-surface-2))",
          }}
        >
          <div className="flex items-center justify-between text-xs font-bold text-amber-500">
            <span className="flex items-center gap-1.5">
              <span>✨</span>
              <span>
                Керування бонусами (баланс: <span className="font-mono text-sm underline">{user.bonus_balance ?? 0}</span> б.)
              </span>
            </span>
            <button
              type="button"
              onClick={() => setShowBonusModal(false)}
              className="text-[11px] opacity-60 hover:opacity-100 cursor-pointer"
            >
              ✕ Закрити
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-1">
              <label className="block text-[10px] font-semibold opacity-70 mb-1">
                Кількість балів:
              </label>
              <input
                type="number"
                min="0"
                placeholder="Наприклад: 50"
                value={bonusAmount}
                onChange={(e) => setBonusAmount(e.target.value)}
                className="w-full rounded-xl p-2.5 text-xs font-mono font-bold outline-none border border-transparent focus:border-amber-500"
                style={{ background: "var(--app-surface)" }}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] font-semibold opacity-70 mb-1">
                Причина (опціонально):
              </label>
              <input
                type="text"
                placeholder="Наприклад: Подарунок, компенсація, акція"
                value={bonusReason}
                onChange={(e) => setBonusReason(e.target.value)}
                className="w-full rounded-xl p-2.5 text-xs outline-none border border-transparent focus:border-amber-500"
                style={{ background: "var(--app-surface)" }}
              />
            </div>
          </div>

          {/* Кнопки: + Кількість, - Кількість, Встановити */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              type="button"
              disabled={isUpdating || !bonusAmount || Number(bonusAmount) <= 0}
              onClick={handleAddBonuses}
              className="app-press flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition disabled:opacity-40 cursor-pointer"
              style={{
                background: "color-mix(in srgb, #10b981 18%, var(--app-surface))",
                color: "#10b981",
                border: "1px solid color-mix(in srgb, #10b981 40%, transparent)",
              }}
              title="Додати вказану кількість балів до поточного балансу"
            >
              <span className="text-sm font-bold">➕</span>
              <span>+ {bonusAmount ? Number(bonusAmount) : ""}</span>
            </button>

            <button
              type="button"
              disabled={isUpdating || !bonusAmount || Number(bonusAmount) <= 0}
              onClick={handleDeductBonuses}
              className="app-press flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition disabled:opacity-40 cursor-pointer"
              style={{
                background: "color-mix(in srgb, #ef4444 18%, var(--app-surface))",
                color: "#ef4444",
                border: "1px solid color-mix(in srgb, #ef4444 40%, transparent)",
              }}
              title="Списати вказану кількість балів з поточного балансу"
            >
              <span className="text-sm font-bold">➖</span>
              <span>- {bonusAmount ? Number(bonusAmount) : ""}</span>
            </button>

            <button
              type="button"
              disabled={isUpdating || bonusAmount === "" || isNaN(Number(bonusAmount)) || Number(bonusAmount) < 0}
              onClick={handleSetBalance}
              className="app-press flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-xs font-bold transition disabled:opacity-40 cursor-pointer"
              style={{
                background: "var(--tg-theme-button-color, #D34528)",
                color: "var(--tg-theme-button-text-color, #ffffff)",
              }}
              title="Встановити точний баланс балів користувача"
            >
              <span>🎯</span>
              <span>Встановити</span>
            </button>
          </div>

          {/* Історія нарахування та списання балів користувача */}
          <div className="pt-2 border-t" style={{ borderColor: "color-mix(in srgb, #f59e0b 20%, var(--app-border))" }}>
            <button
              type="button"
              onClick={() => setShowBonusHistory(!showBonusHistory)}
              className="w-full flex items-center justify-between text-[11px] font-semibold opacity-80 hover:opacity-100 py-1 cursor-pointer"
            >
              <span className="flex items-center gap-1.5">
                <span>📜</span>
                <span>Історія операцій з балами</span>
              </span>
              <span>{showBonusHistory ? "▲ Приховати" : "▼ Переглянути історію"}</span>
            </button>

            {showBonusHistory && <UserBonusHistoryList userId={user.id} />}
          </div>
        </div>
      )}

      {/* Поле примітки до профілю */}
      <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-semibold opacity-70">
            📝 Примітка до профілю (надходить менеджеру для підтвердження):
          </label>
          {isNoteDirty && (
            <button
              onClick={() => {
                haptic("medium");
                onSaveNote(note);
                setIsNoteDirty(false);
              }}
              disabled={isUpdating}
              className="app-press rounded-lg px-2 py-0.5 text-[11px] font-bold"
              style={{
                background: "var(--tg-theme-button-color)",
                color: "var(--tg-theme-button-text-color)",
              }}
            >
              Зберегти
            </button>
          )}
        </div>
        <textarea
          value={note}
          rows={2}
          placeholder="Наприклад: Постійний клієнт, просить не дзвонити у двері"
          onChange={(e) => {
            setNote(e.target.value);
            setIsNoteDirty(true);
          }}
          className="w-full rounded-xl p-2.5 text-xs outline-none transition focus:ring-2 focus:ring-blue-500"
          style={{ background: "var(--app-surface-2)" }}
        />
      </div>
    </div>
  );
}

function UserBonusHistoryList({ userId }: { userId: number }) {
  const { data: history = [], isPending } = useAdminUserBonusHistory(userId, true);

  if (isPending) {
    return <div className="text-[11px] opacity-60 py-2 text-center">Завантаження історії...</div>;
  }

  if (history.length === 0) {
    return (
      <div className="text-[11px] opacity-60 py-2 text-center">
        Історія операцій з балами відсутня
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
      {history.map((tx) => (
        <div
          key={tx.id}
          className="flex items-center justify-between text-[11px] rounded-lg p-2"
          style={{ background: "var(--app-surface)" }}
        >
          <div className="min-w-0 flex-1 pr-2">
            <div className="font-medium truncate">{tx.description || "Операція з балами"}</div>
            <div className="text-[10px] opacity-60">
              {new Date(tx.created_at).toLocaleString("uk-UA", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}
              {tx.order_id && ` • Замовлення #${tx.order_id}`}
            </div>
          </div>
          <div className="text-right shrink-0">
            <span
              className={`font-mono font-bold ${
                tx.amount > 0 ? "text-emerald-500" : "text-rose-500"
              }`}
            >
              {tx.amount > 0 ? `+${tx.amount}` : tx.amount} б.
            </span>
            <div className="text-[9px] opacity-60 font-mono">Після: {tx.balance_after} б.</div>
          </div>
        </div>
      ))}
    </div>
  );
}
