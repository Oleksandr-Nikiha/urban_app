import type { AdminCategory } from "@/api/types";
import { haptic } from "@/telegram/sdk";

interface CategoryBarProps {
  rootCategories: AdminCategory[];
  selectedParentCatId: number | null;
  onSelectCategory: (id: number | null) => void;
  onOpenCreate: () => void;
  onEditCategory: (category: AdminCategory) => void;
}

export function CategoryBar({
  rootCategories,
  selectedParentCatId,
  onSelectCategory,
  onOpenCreate,
  onEditCategory,
}: CategoryBarProps) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Категорії ({rootCategories.length})</h2>
          <p className="text-[11px] opacity-60">Основні розділи меню (Піца, Суші, Закуски...)</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            onOpenCreate();
          }}
          className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          <span>+</span> Категорія
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar md:flex-wrap">
        <button
          onClick={() => {
            haptic("light");
            onSelectCategory(null);
          }}
          className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all"
          style={
            selectedParentCatId === null
              ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
              : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
          }
        >
          Всі розділи
        </button>
        {rootCategories.map((c) => {
          const isSelected = selectedParentCatId === c.id;
          return (
            <div
              key={c.id}
              className="flex shrink-0 items-center overflow-hidden rounded-xl border text-xs transition-all"
              style={{
                borderColor: isSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                background: isSelected ? "var(--app-tint)" : "var(--app-surface)",
              }}
            >
              <button
                onClick={() => {
                  haptic("light");
                  onSelectCategory(c.id);
                }}
                className="px-3 py-2 font-medium flex items-center gap-1"
              >
                {c.icon && <span>{c.icon}</span>}
                <span>{c.name}</span>
              </button>
              <button
                onClick={() => {
                  haptic("light");
                  onEditCategory(c);
                }}
                title="Редагувати категорію"
                className="px-2 py-2 opacity-40 hover:opacity-100"
              >
                ✏️
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
