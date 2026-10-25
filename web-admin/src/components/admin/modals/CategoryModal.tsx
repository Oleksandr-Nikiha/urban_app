import { useState, useEffect, useMemo } from "react";
import { useCreateCategory, useUpdateCategory } from "@/api/queries";
import type { AdminCategory, Location, CategoryCreatePayload, CategoryUpdatePayload } from "@/api/types";
import { hapticNotify } from "@/telegram/sdk";

export function CategoryModal({
  category,
  locations,
  defaultLocationId,
  isSuperAdmin,
  existingCategories,
  onClose,
  onDelete,
}: {
  category: AdminCategory | null;
  locations: Location[];
  defaultLocationId: number;
  isSuperAdmin: boolean;
  existingCategories: AdminCategory[];
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const [name, setName] = useState(category?.name || "");
  const [icon, setIcon] = useState(category?.icon || "🍕");
  const [isVisible, setIsVisible] = useState(category?.is_visible ?? true);
  const [locId, setLocId] = useState(category?.location_id || defaultLocationId);

  const currentRootCats = useMemo(
    () => existingCategories.filter((c) => c.parent_id === null && c.location_id === Number(locId)),
    [existingCategories, locId]
  );
  const lastOrder = useMemo(
    () => (currentRootCats.length > 0 ? Math.max(...currentRootCats.map((c) => c.sort_order)) : 0),
    [currentRootCats]
  );

  const [sortOrder, setSortOrder] = useState(category?.sort_order ?? (lastOrder + 1));

  useEffect(() => {
    if (!category) {
      setSortOrder(lastOrder + 1);
    }
  }, [lastOrder, category]);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (category) {
      const payload: CategoryUpdatePayload = {
        name: name.trim(),
        icon: icon.trim() || null,
        parent_id: null,
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };
      if (isSuperAdmin) payload.location_id = Number(locId);

      updateCategory.mutate(
        { categoryId: category.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: CategoryCreatePayload = {
        name: name.trim(),
        location_id: Number(locId),
        parent_id: null,
        icon: icon.trim() || null,
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };

      createCategory.mutate(payload, {
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
          <h3 className="font-bold text-base">{category ? "Редагування категорії" : "Нова категорія"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Піца, Напої, Десерти..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="opacity-60">Іконка (емодзі)</span>
              <input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🍕"
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm text-center outline-none"
                style={inputStyle}
              />
            </label>

            <label className="block">
              <span className="opacity-60">Порядок (останній: {lastOrder})</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>
          </div>
          <p className="text-[10px] opacity-50">
            Якщо вписати порядковий номер у середину списку, наступні категорії автоматично зсунуться на +1.
          </p>

          {isSuperAdmin && (
            <label className="block">
              <span className="opacity-60">Заклад</span>
              <select
                value={locId}
                onChange={(e) => setLocId(Number(e.target.value))}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="flex items-center gap-2 pt-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible}
              onChange={(e) => setIsVisible(e.target.checked)}
              className="h-4 w-4 rounded"
            />
            <span className="font-medium">Видима для клієнтів</span>
          </label>

          <div className="flex gap-2 pt-3">
            {category && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Видалити категорію "${category.name}" та всі її страви?`)) {
                    onDelete(category.id);
                  }
                }}
                className="app-press rounded-xl px-4 py-2.5 font-semibold text-red-500 bg-red-500/10"
              >
                Видалити
              </button>
            )}
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
