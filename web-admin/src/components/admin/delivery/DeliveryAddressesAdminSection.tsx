import { useState, useMemo } from "react";
import {
  useAdminDeliveryAddresses,
  useCreateAdminDeliveryAddress,
  useUpdateAdminDeliveryAddress,
  useDeleteAdminDeliveryAddress,
} from "@/api/queries";
import type { AdminDeliveryAddress } from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";
import { DeliveryAddressModal } from "./DeliveryAddressModal";

export function DeliveryAddressesAdminSection() {
  const { data: addresses = [], isPending, error, refetch } = useAdminDeliveryAddresses();
  const createAddress = useCreateAdminDeliveryAddress();
  const updateAddress = useUpdateAdminDeliveryAddress();
  const deleteAddress = useDeleteAdminDeliveryAddress();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "stoplist">("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<AdminDeliveryAddress | null>(null);

  const totalCount = addresses.length;
  const activeCount = addresses.filter((a) => a.is_active).length;
  const stoplistCount = totalCount - activeCount;

  const filteredAddresses = useMemo(() => {
    const q = search.trim().toLowerCase();
    return addresses.filter((a) => {
      const matchSearch =
        !q ||
        a.street.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q) ||
        (a.notes && a.notes.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (statusFilter === "active") return a.is_active;
      if (statusFilter === "stoplist") return !a.is_active;
      return true;
    });
  }, [addresses, search, statusFilter]);

  const handleToggleActive = (addr: AdminDeliveryAddress) => {
    haptic("medium");
    updateAddress.mutate(
      {
        addressId: addr.id,
        payload: { is_active: !addr.is_active },
      },
      {
        onSuccess: () => hapticNotify("success"),
        onError: () => hapticNotify("error"),
      }
    );
  };

  const handleDelete = (addr: AdminDeliveryAddress) => {
    if (!window.confirm(`Видалити адресу "${addr.street}" з довідника?`)) {
      return;
    }
    hapticNotify("warning");
    deleteAddress.mutate(addr.id, {
      onSuccess: () => hapticNotify("success"),
      onError: () => hapticNotify("error"),
    });
  };

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      {/* Інформаційна плашка */}
      <div
        className="rounded-2xl p-4 text-xs leading-relaxed border"
        style={{
          background: "var(--app-tint)",
          color: "var(--tg-theme-link-color)",
          borderColor: "color-mix(in srgb, var(--tg-theme-link-color) 30%, transparent)",
        }}
      >
        <p className="font-semibold text-[13px] flex items-center gap-1.5">
          <span>📍</span>
          <span>Керування довідником адрес та стоплистом</span>
        </p>
        <p className="mt-1 opacity-90">
          Клієнти обирають вулиці виключно з цього довідника. Якщо на певну вулицю тимчасово
          перекрито рух чи неможлива доставка — вимкніть її (переведіть у <b>стоплист</b>), і клієнти
          не зможуть обрати її для замовлення.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 pt-2 border-t border-black/10">
          <span className="rounded-full bg-white/40 px-2.5 py-0.5 text-[11px] font-semibold">
            Всього адрес: <b>{totalCount}</b>
          </span>
          <span className="rounded-full bg-emerald-500/20 text-emerald-700 px-2.5 py-0.5 text-[11px] font-semibold">
            🟢 Доставляємо: <b>{activeCount}</b>
          </span>
          <span className="rounded-full bg-rose-500/20 text-rose-700 px-2.5 py-0.5 text-[11px] font-semibold">
            🔴 Стоплист: <b>{stoplistCount}</b>
          </span>
        </div>
      </div>

      {/* Панель керування: пошук, фільтри, кнопка додавання */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Пошук вулиці..."
            className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-2.5 pr-8 text-xs outline-none focus:ring-2 focus:ring-blue-500"
            style={{ color: "var(--tg-theme-text-color)" }}
          />
          {search ? (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-50 hover:opacity-100"
            >
              ✕
            </button>
          ) : (
            <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs opacity-40">
              🔍
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Фільтр статусу */}
          <div
            className="flex rounded-xl p-0.5 text-xs font-semibold"
            style={{ background: "var(--app-surface-2)" }}
          >
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                statusFilter === "all"
                  ? "bg-[var(--app-surface)] shadow-sm font-bold text-[var(--tg-theme-text-color)]"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              Всі ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter("active")}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                statusFilter === "active"
                  ? "bg-[var(--app-surface)] shadow-sm font-bold text-emerald-600"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              🟢 Активні ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter("stoplist")}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] transition ${
                statusFilter === "stoplist"
                  ? "bg-[var(--app-surface)] shadow-sm font-bold text-rose-600"
                  : "opacity-60 hover:opacity-100"
              }`}
            >
              🔴 Стоп ({stoplistCount})
            </button>
          </div>

          <button
            onClick={() => {
              haptic("light");
              setEditingAddress(null);
              setIsModalOpen(true);
            }}
            className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-sm flex items-center gap-1.5"
            style={{ background: "var(--tg-theme-button-color)" }}
          >
            <span>+</span>
            <span>Додати адресу</span>
          </button>
        </div>
      </div>

      {/* Список адрес */}
      {filteredAddresses.length === 0 ? (
        <EmptyState
          icon="📍"
          title="Адрес не знайдено"
          hint={
            search
              ? `За запитом "${search}" нічого не знайдено`
              : "Додайте першу адресу до довідника"
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredAddresses.map((addr) => {
            const isUpdating =
              updateAddress.isPending && updateAddress.variables?.addressId === addr.id;
            return (
              <div
                key={addr.id}
                className="app-card rounded-2xl p-3.5 flex flex-col justify-between gap-3 border transition-all"
                style={{
                  background: addr.is_active
                    ? "var(--app-surface)"
                    : "color-mix(in srgb, #ef4444 4%, var(--app-surface))",
                  borderColor: addr.is_active
                    ? "var(--app-border)"
                    : "color-mix(in srgb, #ef4444 30%, transparent)",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-sm tracking-tight truncate">
                        {addr.street}
                      </h4>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          addr.is_active
                            ? "bg-emerald-500/15 text-emerald-600"
                            : "bg-rose-500/15 text-rose-600"
                        }`}
                      >
                        {addr.is_active ? "🟢 Доставляємо" : "🔴 Стоплист"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs opacity-60">📍 м. {addr.city}</p>
                    {addr.notes && (
                      <p className="mt-1 text-[11px] text-amber-600 dark:text-amber-400 opacity-90 italic">
                        💬 {addr.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Нижня панель дій */}
                <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[var(--app-border)]">
                  <button
                    type="button"
                    disabled={isUpdating}
                    onClick={() => handleToggleActive(addr)}
                    className="app-press flex-1 rounded-xl py-1.5 px-3 text-xs font-semibold transition flex items-center justify-center gap-1.5 shadow-xs"
                    style={{
                      background: addr.is_active
                        ? "color-mix(in srgb, #ef4444 12%, transparent)"
                        : "color-mix(in srgb, #22c55e 12%, transparent)",
                      color: addr.is_active ? "#ef4444" : "#22c55e",
                      border: `1px solid ${
                        addr.is_active
                          ? "color-mix(in srgb, #ef4444 25%, transparent)"
                          : "color-mix(in srgb, #22c55e 25%, transparent)"
                      }`,
                    }}
                  >
                    <span>{addr.is_active ? "⛔" : "✅"}</span>
                    <span>{addr.is_active ? "У стоплист" : "Відновити доставку"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      haptic("light");
                      setEditingAddress(addr);
                      setIsModalOpen(true);
                    }}
                    className="app-press rounded-xl border border-[var(--app-border)] bg-[var(--app-surface-2)] p-2 text-xs opacity-75 hover:opacity-100"
                    title="Редагувати"
                  >
                    ✏️
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(addr)}
                    className="app-press rounded-xl border border-rose-500/20 bg-rose-500/10 p-2 text-xs text-rose-500 opacity-75 hover:opacity-100"
                    title="Видалити адресу"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Модальне вікно створення / редагування */}
      {isModalOpen && (
        <DeliveryAddressModal
          initialData={editingAddress}
          onClose={() => {
            setIsModalOpen(false);
            setEditingAddress(null);
          }}
          onSave={(payload) => {
            if (editingAddress) {
              updateAddress.mutate(
                { addressId: editingAddress.id, payload },
                {
                  onSuccess: () => {
                    hapticNotify("success");
                    setIsModalOpen(false);
                    setEditingAddress(null);
                  },
                  onError: () => hapticNotify("error"),
                }
              );
            } else {
              createAddress.mutate(
                {
                  city: payload.city || "Київ",
                  street: payload.street || "",
                  is_active: payload.is_active ?? true,
                  notes: payload.notes,
                },
                {
                  onSuccess: () => {
                    hapticNotify("success");
                    setIsModalOpen(false);
                  },
                  onError: () => hapticNotify("error"),
                }
              );
            }
          }}
          isSaving={createAddress.isPending || updateAddress.isPending}
        />
      )}
    </div>
  );
}
