import { useState } from "react";
import {
  useAdminOptionGroups,
  useAdminOptionGroupItems,
  useCreateOptionGroup,
  useUpdateOptionGroup,
  useDeleteOptionGroup,
  useAddOptionGroupItem,
  useUpdateOptionGroupItem,
  useDeleteOptionGroupItem,
  useAdminVariantChoices,
} from "@/api/queries";
import type {
  AdminOptionGroup,
  OptionGroupCreatePayload,
  OptionGroupUpdatePayload,
  OptionGroupItemCreatePayload,
} from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function OptionGroupsTab() {
  const { data: groups = [], isPending, error } = useAdminOptionGroups();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<AdminOptionGroup | null>(null);

  const [activeGroupId, setActiveGroupId] = useState<number | null>(null);
  const [addItemModalOpen, setAddItemModalOpen] = useState(false);

  const deleteGroup = useDeleteOptionGroup();

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Групи додатків ({groups.length})</h2>
          <p className="text-xs opacity-60">Соуси, сирні бортики, напої та інгредієнти</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            setEditingGroup(null);
            setModalOpen(true);
          }}
          className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          <span>+</span> Нова група
        </button>
      </div>

      {groups.length === 0 ? (
        <EmptyState icon="🧩" title="Немає груп додатків" hint="Створіть першу групу додатків, наприклад: 'Соуси' або 'Додатки до піци'" />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <OptionGroupCard
              key={g.id}
              group={g}
              onEdit={() => {
                setEditingGroup(g);
                setModalOpen(true);
              }}
              onDelete={() => {
                if (window.confirm(`Видалити групу "${g.name}"? Її буде вилучено з усіх страв.`)) {
                  hapticNotify("warning");
                  deleteGroup.mutate(g.id);
                }
              }}
              onAddItem={() => {
                setActiveGroupId(g.id);
                setAddItemModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      {/* Модалка створення/редагування групи */}
      {modalOpen && (
        <OptionGroupModal
          group={editingGroup}
          onClose={() => setModalOpen(false)}
        />
      )}

      {/* Модалка додавання позиції в групу */}
      {addItemModalOpen && activeGroupId && (
        <AddOptionItemModal
          groupId={activeGroupId}
          onClose={() => {
            setAddItemModalOpen(false);
            setActiveGroupId(null);
          }}
        />
      )}
    </div>
  );
}

function OptionGroupCard({
  group,
  onEdit,
  onDelete,
  onAddItem,
}: {
  group: AdminOptionGroup;
  onEdit: () => void;
  onDelete: () => void;
  onAddItem: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { data: items = [], isPending: itemsLoading } = useAdminOptionGroupItems(expanded ? group.id : 0);

  const deleteItem = useDeleteOptionGroupItem();
  const updateItem = useUpdateOptionGroupItem();

  return (
    <div
      className="app-card rounded-2xl p-3.5 transition-all"
      style={{ border: "1px solid var(--app-border)" }}
    >
      <div className="flex items-center justify-between">
        <div
          onClick={() => {
            haptic("light");
            setExpanded(!expanded);
          }}
          className="flex-1 cursor-pointer min-w-0"
        >
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold truncate">{group.name}</span>
            <span className="text-xs opacity-50">{expanded ? "▲" : "▼"}</span>
          </div>
          <p className="text-[11px] opacity-60">
            {group.items_count} позицій • підключено до {group.products_count} страв
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onEdit}
            className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
            title="Редагувати"
          >
            ✏️
          </button>
          <button
            onClick={onDelete}
            className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
            title="Видалити"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Розгорнутий список позицій у групі */}
      {expanded && (
        <div className="mt-3 border-t pt-2.5 space-y-2" style={{ borderColor: "var(--app-border)" }}>
          <div className="flex items-center justify-between text-xs font-semibold opacity-70">
            <span>Позиції та доплати:</span>
            <button
              onClick={onAddItem}
              className="text-[var(--tg-theme-button-color)] hover:underline"
            >
              + Додати позицію
            </button>
          </div>

          {itemsLoading ? (
            <Spinner />
          ) : items.length === 0 ? (
            <p className="text-xs opacity-50 py-1">Група порожня. Додайте соуси або топінги.</p>
          ) : (
            <div className="space-y-1.5">
              {items.map((it) => (
                <div
                  key={it.variant_id}
                  className="flex items-center justify-between rounded-xl px-2.5 py-2 text-xs"
                  style={{
                    background: "var(--app-surface-2)",
                    opacity: it.is_available ? 1 : 0.5,
                  }}
                >
                  <div className="min-w-0">
                    <p className="font-bold truncate">{it.product_name}</p>
                    <p className="text-[10px] opacity-60">{it.variant_label}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold">
                      {it.price_delta > 0 ? `+${it.price_delta.toFixed(0)} ₴` : "0 ₴"}
                    </span>
                    <button
                      onClick={() => {
                        haptic("light");
                        updateItem.mutate({
                          groupId: group.id,
                          variantId: it.variant_id,
                          payload: { is_available: !it.is_available },
                        });
                      }}
                      className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                      style={{
                        background: it.is_available
                          ? "color-mix(in srgb, #22c55e 15%, transparent)"
                          : "color-mix(in srgb, #ef4444 15%, transparent)",
                        color: it.is_available ? "#16a34a" : "#dc2626",
                      }}
                    >
                      {it.is_available ? "Активна" : "Стоп"}
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Вилучити "${it.product_name}" з групи?`)) {
                          hapticNotify("warning");
                          deleteItem.mutate({ groupId: group.id, variantId: it.variant_id });
                        }
                      }}
                      className="opacity-50 hover:opacity-100 text-xs pl-1"
                      title="Вилучити"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


function OptionGroupModal({
  group,
  onClose,
}: {
  group: AdminOptionGroup | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(group?.name || "");
  const [sortOrder, setSortOrder] = useState(group?.sort_order ?? 0);

  const createGroup = useCreateOptionGroup();
  const updateGroup = useUpdateOptionGroup();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (group) {
      const payload: OptionGroupUpdatePayload = {
        name: name.trim(),
        sort_order: Number(sortOrder),
      };
      updateGroup.mutate(
        { groupId: group.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: OptionGroupCreatePayload = {
        name: name.trim(),
        sort_order: Number(sortOrder),
      };
      createGroup.mutate(payload, {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      });
    }
  };

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{group ? "Редагування групи" : "Нова група додатків"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва групи додатків</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Соус до піци, Додатки, Напої..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">Порядок сортування</span>
            <input
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              className="app-press flex-1 rounded-xl py-2.5 font-bold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Зберегти
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddOptionItemModal({
  groupId,
  onClose,
}: {
  groupId: number;
  onClose: () => void;
}) {
  const { data: choices = [], isPending } = useAdminVariantChoices();
  const [selectedVariantId, setSelectedVariantId] = useState<string>("");
  const [priceDelta, setPriceDelta] = useState<string>("0");
  const [search, setSearch] = useState("");

  const addItem = useAddOptionGroupItem();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const vId = parseInt(selectedVariantId, 10);
    if (!vId) return;

    const payload: OptionGroupItemCreatePayload = {
      variant_id: vId,
      price_delta: parseFloat(priceDelta) || 0,
      sort_order: 0,
      is_available: true,
    };

    addItem.mutate(
      { groupId, payload },
      {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      },
    );
  };

  const filteredChoices = choices.filter(
    (c) =>
      search.trim() === "" ||
      c.product_name.toLowerCase().includes(search.toLowerCase()) ||
      c.variant_label.toLowerCase().includes(search.toLowerCase()),
  );

  const inputStyle = { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">Додати позицію в групу</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <span className="opacity-60">Пошук страви/соусу</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Фільтр страв..."
              className="mt-1 w-full rounded-xl px-3 py-2 text-xs outline-none"
              style={inputStyle}
            />
          </div>

          <label className="block">
            <span className="opacity-60">Виберіть варіант товару</span>
            {isPending ? (
              <Spinner />
            ) : (
              <select
                value={selectedVariantId}
                onChange={(e) => setSelectedVariantId(e.target.value)}
                required
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                <option value="">-- Оберіть товар зі списку --</option>
                {filteredChoices.map((c) => (
                  <option key={c.variant_id} value={c.variant_id}>
                    {c.product_name} ({c.variant_label}) - {c.price.toFixed(0)} ₴
                  </option>
                ))}
              </select>
            )}
          </label>

          <label className="block">
            <span className="opacity-60">Доплата як додаток (₴)</span>
            <input
              type="number"
              step="any"
              value={priceDelta}
              onChange={(e) => setPriceDelta(e.target.value)}
              placeholder="20 (0 = без доплати)"
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
            <span className="mt-1 block text-[10px] opacity-50">
              Ця сума додається до ціни страви при виборі даного додатку.
            </span>
          </label>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="app-press rounded-xl px-4 py-2.5 font-semibold opacity-70"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={!selectedVariantId}
              className="app-press flex-1 rounded-xl py-2.5 font-bold disabled:opacity-40"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              Додати в групу
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
