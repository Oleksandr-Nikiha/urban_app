import { useState } from "react";
import {
  useAdminProducts,
  useToggleProductAvailability,
  useToggleVariantAvailability,
  useBulkProductAvailability,
} from "@/api/queries";
import { ErrorBox, Spinner, Thumb } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function StopListTab({ locationId }: { locationId?: number | null }) {
  const { data: products = [], isPending, error } = useAdminProducts({ locationId });
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

  const toggleProduct = useToggleProductAvailability();
  const toggleVariant = useToggleVariantAvailability();
  const bulkAvailability = useBulkProductAvailability();

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} />;

  const categoryNames = Array.from(new Set(products.map((p) => p.category_name).filter(Boolean))) as string[];

  const filtered = products.filter((p) => {
    const matchSearch =
      search.trim() === "" ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.category_name && p.category_name.toLowerCase().includes(search.toLowerCase()));
    const matchCat = filterCategory === null || p.category_name === filterCategory;
    return matchSearch && matchCat;
  });

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    haptic("light");
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filtered.map((p) => p.id));
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newSet = new Set([...selectedProductIds, ...filtered.map((p) => p.id)]);
      setSelectedProductIds(Array.from(newSet));
    }
  };

  const stoppedCount = products.filter(
    (p) => !p.is_available || p.variants.some((v) => !v.is_available),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold">Швидкий Стоп-лист</h2>
          <p className="text-xs opacity-60">
            {stoppedCount > 0
              ? `У стоп-листі: ${stoppedCount} позицій`
              : "Всі страви в наявності"}
          </p>
        </div>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={toggleSelectAll}
            className="app-press rounded-xl px-3 py-1.5 text-xs font-medium border transition-colors"
            style={{
              borderColor: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
              background: allFilteredSelected ? "var(--app-tint)" : "var(--app-surface)",
              color: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--tg-theme-text-color)",
            }}
          >
            {allFilteredSelected ? "✓ Вибрано всі" : "Вибрати всі"}
          </button>
        )}
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Швидкий пошук страви чи напою..."
        className="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-shadow focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
        style={{ background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }}
      />

      {categoryNames.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          <button
            onClick={() => {
              haptic("light");
              setFilterCategory(null);
            }}
            className="app-press shrink-0 rounded-full px-3 py-1 font-medium"
            style={
              filterCategory === null
                ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
            }
          >
            Всі ({products.length})
          </button>
          {categoryNames.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                haptic("light");
                setFilterCategory(cat);
              }}
              className="app-press shrink-0 rounded-full px-3 py-1 font-medium"
              style={
                filterCategory === cat
                  ? { background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }
                  : { background: "var(--app-surface)", color: "var(--tg-theme-text-color)" }
              }
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((p) => {
          const isSelected = selectedProductIds.includes(p.id);
          return (
            <div
              key={p.id}
              className="app-card rounded-2xl p-3.5 transition-all"
              style={{
                border: isSelected
                  ? "2px solid var(--tg-theme-button-color)"
                  : "1px solid var(--app-border)",
                background: isSelected
                  ? "color-mix(in srgb, var(--tg-theme-button-color) 8%, var(--app-surface))"
                  : !p.is_available
                  ? "color-mix(in srgb, #ef4444 8%, var(--app-surface))"
                  : "var(--app-surface)",
              }}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {
                      haptic("light");
                      toggleSelectProduct(p.id);
                    }}
                    className="h-4 w-4 rounded cursor-pointer accent-[var(--tg-theme-button-color)] shrink-0"
                  />
                  <Thumb src={p.image_url} className="h-12 w-12 shrink-0 rounded-xl" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{p.name}</p>
                    <p className="text-[11px] opacity-50">{p.category_name}</p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    haptic("medium");
                    toggleProduct.mutate({ productId: p.id, isAvailable: !p.is_available });
                  }}
                  className="app-press shrink-0 rounded-xl px-3 py-2 text-xs font-bold transition-colors"
                  style={
                    p.is_available
                      ? { background: "color-mix(in srgb, #22c55e 18%, transparent)", color: "#16a34a" }
                      : { background: "color-mix(in srgb, #ef4444 25%, transparent)", color: "#dc2626" }
                  }
                >
                  {p.is_available ? "✓ Доступно" : "⛔ НА СТОПІ"}
                </button>
              </div>

              {p.variants.length > 0 && (
                <div className="mt-3 border-t pt-2 space-y-1.5" style={{ borderColor: "var(--app-border)" }}>
                  <p className="text-[11px] font-semibold opacity-60">Окремі розміри/порції:</p>
                  <div className="grid grid-cols-1 gap-1.5">
                    {p.variants.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs"
                        style={{ background: "var(--app-surface-2)" }}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">{v.label}</span>
                          {v.weight && <span className="opacity-50">({v.weight})</span>}
                          <span className="font-bold opacity-80">{v.price.toFixed(0)} ₴</span>
                        </div>
                        <button
                          disabled={!p.is_available}
                          onClick={() => {
                            haptic("light");
                            toggleVariant.mutate({ variantId: v.id, isAvailable: !v.is_available });
                          }}
                          className="app-press rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-40"
                          style={
                            v.is_available && p.is_available
                              ? { background: "color-mix(in srgb, #22c55e 15%, transparent)", color: "#16a34a" }
                              : { background: "color-mix(in srgb, #ef4444 20%, transparent)", color: "#dc2626" }
                          }
                        >
                          {v.is_available && p.is_available ? "Доступний" : "На стопі"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Плаваюча панель масових дій у стоп-листі */}
      {selectedProductIds.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 mx-auto max-w-lg">
          <div
            className="app-card rounded-2xl p-3 shadow-2xl border flex flex-col gap-2.5 backdrop-blur-md"
            style={{
              background: "color-mix(in srgb, var(--tg-theme-bg-color) 94%, black)",
              borderColor: "var(--tg-theme-button-color)",
            }}
          >
            <div className="flex items-center justify-between text-xs px-1">
              <span className="font-bold">
                Обрано страв: <span className="text-[var(--tg-theme-button-color)] font-extrabold">{selectedProductIds.length}</span>
              </span>
              <button
                type="button"
                onClick={() => setSelectedProductIds([])}
                className="opacity-60 hover:opacity-100 font-medium"
              >
                ✕ Зняти вибір
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={bulkAvailability.isPending}
                onClick={() => {
                  haptic("medium");
                  bulkAvailability.mutate(
                    { product_ids: selectedProductIds, is_available: false },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                      },
                    },
                  );
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-red-500/30 bg-red-500/10 text-red-500 disabled:opacity-50"
              >
                ⛔ Поставити на стоп
              </button>

              <button
                type="button"
                disabled={bulkAvailability.isPending}
                onClick={() => {
                  haptic("medium");
                  bulkAvailability.mutate(
                    { product_ids: selectedProductIds, is_available: true },
                    {
                      onSuccess: () => {
                        hapticNotify("success");
                      },
                    },
                  );
                }}
                className="app-press rounded-xl py-2 px-2 text-xs font-bold text-center border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 disabled:opacity-50"
              >
                ✓ Зняти зі стопу
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
