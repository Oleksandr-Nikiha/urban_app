import type { AdminCategory } from "@/api/types";
import { haptic } from "@/telegram/sdk";

interface SubcategoryBarProps {
  subcategories: AdminCategory[];
  rootCategories: AdminCategory[];
  selectedParentCat: AdminCategory | null | undefined;
  selectedParentCatId: number | null;
  selectedSubCatId: number | null;
  onSelectSubcategory: (subId: number | null, parentId?: number) => void;
  onOpenCreate: () => void;
  onEditSubcategory: (subcategory: AdminCategory) => void;
}

export function SubcategoryBar({
  subcategories,
  rootCategories,
  selectedParentCat,
  selectedParentCatId,
  selectedSubCatId,
  onSelectSubcategory,
  onOpenCreate,
  onEditSubcategory,
}: SubcategoryBarProps) {
  const visibleSubcats = selectedParentCatId
    ? subcategories.filter((s) => s.parent_id === selectedParentCatId)
    : subcategories;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">
            Підкатегорії {selectedParentCat ? `(${selectedParentCat.name})` : `(${subcategories.length})`}
          </h2>
          <p className="text-[11px] opacity-60">Підрозділи страв без власних емодзі</p>
        </div>
        <button
          onClick={() => {
            haptic("light");
            onOpenCreate();
          }}
          className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          <span>+</span> Підкатегорія
        </button>
      </div>

      {selectedParentCatId && visibleSubcats.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-3 text-center text-xs opacity-50"
          style={{ borderColor: "var(--app-border)" }}
        >
          У категорії «{selectedParentCat?.name}» немає підкатегорій. Натисніть «+ Підкатегорія», щоб створити.
        </div>
      ) : !selectedParentCatId && visibleSubcats.length === 0 ? (
        <div
          className="rounded-xl border border-dashed p-3 text-center text-xs opacity-50"
          style={{ borderColor: "var(--app-border)" }}
        >
          Немає створених підкатегорій
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar md:flex-wrap">
          {selectedParentCatId && (
            <button
              onClick={() => {
                haptic("light");
                onSelectSubcategory(null);
              }}
              className="app-press shrink-0 rounded-xl px-3.5 py-2 text-xs font-medium transition-all"
              style={
                selectedSubCatId === null
                  ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                  : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
              }
            >
              Всі в {selectedParentCat?.name}
            </button>
          )}
          {visibleSubcats.map((sub) => {
            const isSelected = selectedSubCatId === sub.id;
            const parentOfSub = rootCategories.find((r) => r.id === sub.parent_id);
            return (
              <div
                key={sub.id}
                className="flex shrink-0 items-center overflow-hidden rounded-xl border text-xs transition-all"
                style={{
                  borderColor: isSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                  background: isSelected ? "var(--app-tint)" : "var(--app-surface)",
                }}
              >
                <button
                  onClick={() => {
                    haptic("light");
                    onSelectSubcategory(sub.id, sub.parent_id ?? undefined);
                  }}
                  className="px-3 py-2 font-medium flex items-center"
                >
                  {!selectedParentCatId && parentOfSub && (
                    <span className="opacity-50 mr-1">{parentOfSub.name} →</span>
                  )}
                  <span>{sub.name}</span>
                  <span className="ml-1 opacity-50">({sub.products_count})</span>
                </button>
                <button
                  onClick={() => {
                    haptic("light");
                    onEditSubcategory(sub);
                  }}
                  title="Редагувати підкатегорію"
                  className="px-2 py-2 opacity-40 hover:opacity-100"
                >
                  ✏️
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
