import { useState, useEffect, useMemo } from "react";
import { useCreateCategory, useUpdateCategory } from "@/api/queries";
import type { AdminCategory, CategoryCreatePayload, CategoryUpdatePayload } from "@/api/types";
import { hapticNotify } from "@/telegram/sdk";

export function SubcategoryModal({
  subcategory,
  rootCategories,
  defaultParentId,
  existingCategories,
  onClose,
  onDelete,
}: {
  subcategory: AdminCategory | null;
  rootCategories: AdminCategory[];
  defaultParentId?: number | null;
  existingCategories: AdminCategory[];
  onClose: () => void;
  onDelete: (id: number) => void;
}) {
  const [parentId, setParentId] = useState<number>(
    subcategory?.parent_id || defaultParentId || (rootCategories[0]?.id ?? 1)
  );
  const [name, setName] = useState(subcategory?.name || "");

  const selectedParent = useMemo(
    () => rootCategories.find((c) => c.id === Number(parentId)),
    [rootCategories, parentId]
  );

  const currentSubcats = useMemo(
    () => existingCategories.filter((c) => c.parent_id === Number(parentId)),
    [existingCategories, parentId]
  );

  const lastOrder = useMemo(
    () => (currentSubcats.length > 0 ? Math.max(...currentSubcats.map((c) => c.sort_order)) : 0),
    [currentSubcats]
  );

  const [sortOrder, setSortOrder] = useState<number>(
    subcategory?.sort_order ?? (lastOrder + 1)
  );
  const [isVisible, setIsVisible] = useState(subcategory?.is_visible ?? true);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  useEffect(() => {
    if (!subcategory) {
      setSortOrder(lastOrder + 1);
    }
  }, [lastOrder, subcategory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !parentId) return;

    if (subcategory) {
      const payload: CategoryUpdatePayload = {
        name: name.trim(),
        parent_id: Number(parentId),
        icon: null, // У підкатегорій немає емодзі
        sort_order: Number(sortOrder),
        is_visible: isVisible,
      };
      if (selectedParent) {
        payload.location_id = selectedParent.location_id;
      }

      updateCategory.mutate(
        { categoryId: subcategory.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        }
      );
    } else {
      if (!selectedParent) return;
      const payload: CategoryCreatePayload = {
        name: name.trim(),
        location_id: selectedParent.location_id,
        parent_id: Number(parentId),
        icon: null, // У підкатегорій немає емодзі
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
          <h3 className="font-bold text-base">
            {subcategory ? "Редагування підкатегорії" : "Нова підкатегорія"}
          </h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Батьківська категорія</span>
            <select
              value={parentId}
              onChange={(e) => setParentId(Number(e.target.value))}
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              {rootCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon ? `${c.icon} ` : ""}{c.name} ({c.location_name || ""})
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="opacity-60">Назва підкатегорії</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Фірмові, Ролліни, Сети з ролів..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <div>
            <label className="block">
              <span className="opacity-60">
                Порядок сортування (останній у категорії: {lastOrder})
              </span>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={inputStyle}
              />
            </label>
            <p className="text-[10px] opacity-50 mt-1">
              Якщо вписати номер у середину списку, наступні підкатегорії зсунуться на +1.
            </p>
          </div>

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
            {subcategory && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Видалити підкатегорію "${subcategory.name}" та всі її страви?`)) {
                    onDelete(subcategory.id);
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
