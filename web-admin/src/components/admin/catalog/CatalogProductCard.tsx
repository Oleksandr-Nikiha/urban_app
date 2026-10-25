import type { AdminProduct, AdminVariant } from "@/api/types";
import { Thumb } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

interface CatalogProductCardProps {
  product: AdminProduct;
  isSelected: boolean;
  uploadingProdId: number | null;
  onToggleSelect: (id: number) => void;
  onTriggerPhotoUpload: (id: number) => void;
  onEditProduct: (product: AdminProduct) => void;
  onDeleteProduct: (id: number, name: string) => void;
  onAddVariant: (productId: number) => void;
  onEditVariant: (productId: number, variant: AdminVariant) => void;
  onDeleteVariant: (variantId: number, variantLabel: string) => void;
  onConfigureOptions: (product: AdminProduct) => void;
}

export function CatalogProductCard({
  product: p,
  isSelected,
  uploadingProdId,
  onToggleSelect,
  onTriggerPhotoUpload,
  onEditProduct,
  onDeleteProduct,
  onAddVariant,
  onEditVariant,
  onDeleteVariant,
  onConfigureOptions,
}: CatalogProductCardProps) {
  return (
    <div
      className="app-card rounded-2xl p-3.5 transition-all"
      style={{
        border: isSelected
          ? "2px solid var(--tg-theme-button-color)"
          : "1px solid var(--app-border)",
        background: isSelected
          ? "color-mix(in srgb, var(--tg-theme-button-color) 7%, var(--app-surface))"
          : "var(--app-surface)",
        opacity: p.is_available ? 1 : 0.65,
      }}
    >
      <div className="flex gap-3 items-start">
        <div className="pt-1 shrink-0">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => {
              haptic("light");
              onToggleSelect(p.id);
            }}
            className="h-4 w-4 rounded cursor-pointer accent-[var(--tg-theme-button-color)]"
          />
        </div>
        <div
          className="relative h-16 w-16 shrink-0 cursor-pointer group"
          onClick={() => onTriggerPhotoUpload(p.id)}
          title="Натисніть, щоб змінити фото"
        >
          <Thumb src={p.image_url} className="h-16 w-16" />
          <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 flex items-center justify-center rounded-xl transition-opacity">
            <span className="text-base">📷</span>
          </div>
          {uploadingProdId === p.id && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <p className="truncate text-sm font-bold">{p.name}</p>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => onTriggerPhotoUpload(p.id)}
                disabled={uploadingProdId === p.id}
                className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
                title="Додати або змінити фото"
              >
                📷
              </button>
              <button
                onClick={() => {
                  haptic("light");
                  onEditProduct(p);
                }}
                className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
                title="Редагувати"
              >
                ✏️
              </button>
              <button
                onClick={() => {
                  if (window.confirm(`Видалити страву "${p.name}"?`)) {
                    hapticNotify("warning");
                    onDeleteProduct(p.id, p.name);
                  }
                }}
                className="app-press rounded-lg p-1 text-xs opacity-60 hover:opacity-100"
                title="Видалити"
              >
                🗑️
              </button>
            </div>
          </div>
          {p.description && (
            <p className="line-clamp-2 mt-0.5 text-xs opacity-60">{p.description}</p>
          )}
          <div className="mt-1 flex items-center gap-2 text-[11px] opacity-50">
            <span>{p.category_name}</span>
            {p.location_name && <span>• 📍 {p.location_name}</span>}
          </div>
        </div>
      </div>

      {/* Варіанти цін (розміри / порції) */}
      <div className="mt-3 border-t pt-2.5" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between text-xs font-semibold opacity-70">
          <span>Розміри та ціни:</span>
          <button
            onClick={() => {
              haptic("light");
              onAddVariant(p.id);
            }}
            className="text-[var(--tg-theme-button-color)] hover:underline"
          >
            + Додати розмір
          </button>
        </div>

        <div className="mt-1.5 space-y-1.5">
          {p.variants.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
              style={{
                background: "var(--app-surface-2)",
                opacity: v.is_available ? 1 : 0.5,
              }}
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{v.label}</span>
                {v.weight && <span className="opacity-50">({v.weight})</span>}
                {!v.is_available && (
                  <span className="rounded bg-red-500/20 px-1 py-0.2 text-[10px] text-red-500 font-bold">
                    СТОП
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{v.price.toFixed(0)} ₴</span>
                <button
                  onClick={() => {
                    haptic("light");
                    onEditVariant(p.id, v);
                  }}
                  className="opacity-50 hover:opacity-100 text-[11px]"
                >
                  ✏️
                </button>
                {p.variants.length > 1 && (
                  <button
                    onClick={() => {
                      if (window.confirm(`Видалити варіант "${v.label}"?`)) {
                        hapticNotify("warning");
                        onDeleteVariant(v.id, v.label);
                      }
                    }}
                    className="opacity-50 hover:opacity-100 text-[11px]"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Додатки (Модифікатори до страви) */}
      <div className="mt-2.5 border-t pt-2" style={{ borderColor: "var(--app-border)" }}>
        <div className="flex items-center justify-between text-xs font-semibold opacity-70">
          <span>Додатки до страви:</span>
          <button
            onClick={() => {
              haptic("light");
              onConfigureOptions(p);
            }}
            className="text-[var(--tg-theme-button-color)] hover:underline"
          >
            ⚙️ Налаштувати
          </button>
        </div>

        {p.option_groups && p.option_groups.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {p.option_groups.map((og) => (
              <span
                key={og.group_id}
                className="rounded-lg px-2.5 py-1 text-[11px] font-medium"
                style={{ background: "var(--app-surface-2)" }}
              >
                🧩 {og.group_name}{" "}
                <span className="opacity-60">
                  ({og.min_select}–{og.max_select}
                  {og.free_count > 0 ? `, б/к: ${og.free_count}` : ""})
                </span>
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-[11px] opacity-40">Немає додатків (натисніть Налаштувати)</p>
        )}
      </div>
    </div>
  );
}
