import { useRef, useState } from "react";
import { api } from "@/api/client";
import { useCreateProduct, useUpdateProduct } from "@/api/queries";
import type { AdminProduct, AdminCategory, ProductCreatePayload, ProductUpdatePayload } from "@/api/types";
import { hapticNotify } from "@/telegram/sdk";

export function ProductModal({
  product,
  categories,
  defaultCategoryId,
  onClose,
}: {
  product: AdminProduct | null;
  categories: AdminCategory[];
  defaultCategoryId: number;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name || "");
  const [categoryId, setCategoryId] = useState(product?.category_id || defaultCategoryId);
  const [description, setDescription] = useState(product?.description || "");
  const [imageUrl, setImageUrl] = useState(product?.image_url || "");
  const [sortOrder, setSortOrder] = useState(product?.sort_order ?? 0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      setUploadError("Розмір файлу не повинен перевищувати 15 МБ");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.upload<{ url: string }>("/admin/upload", formData);
      setImageUrl(res.url);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : "Помилка завантаження файлу");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const [initialVariantLabel, setInitialVariantLabel] = useState("Стандарт");
  const [initialVariantPrice, setInitialVariantPrice] = useState("150");
  const [initialVariantWeight, setInitialVariantWeight] = useState("");

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (product) {
      const payload: ProductUpdatePayload = {
        name: name.trim(),
        category_id: Number(categoryId),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        sort_order: Number(sortOrder),
      };
      updateProduct.mutate(
        { productId: product.id, payload },
        {
          onSuccess: () => {
            hapticNotify("success");
            onClose();
          },
        },
      );
    } else {
      const payload: ProductCreatePayload = {
        name: name.trim(),
        category_id: Number(categoryId),
        description: description.trim() || null,
        image_url: imageUrl.trim() || null,
        sort_order: Number(sortOrder),
        is_available: true,
        variants: [
          {
            label: initialVariantLabel.trim() || "Стандарт",
            price: parseFloat(initialVariantPrice) || 0,
            weight: initialVariantWeight.trim() || null,
            sort_order: 0,
            is_available: true,
          },
        ],
      };
      createProduct.mutate(payload, {
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
        className="app-card w-full max-w-sm rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "var(--tg-theme-bg-color)", border: "1px solid var(--app-border)" }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-base">{product ? "Редагування страви" : "Нова страва"}</h3>
          <button onClick={onClose} className="opacity-50 text-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <label className="block">
            <span className="opacity-60">Назва страви</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Маргарита, Чізбургер..."
              required
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          <label className="block">
            <span className="opacity-60">Категорія / Підкатегорія</span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(Number(e.target.value))}
              className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={inputStyle}
            >
              {(() => {
                const roots = categories.filter((c) => c.parent_id === null);
                const subsByParent = new Map<number, AdminCategory[]>();
                categories
                  .filter((c) => c.parent_id !== null)
                  .forEach((c) => {
                    const list = subsByParent.get(c.parent_id!) || [];
                    list.push(c);
                    subsByParent.set(c.parent_id!, list);
                  });

                return roots.map((root) => {
                  const subs = subsByParent.get(root.id) || [];
                  if (subs.length > 0) {
                    return (
                      <optgroup
                        key={root.id}
                        label={`${root.icon ? `${root.icon} ` : ""}${root.name} (${root.location_name || ""})`}
                      >
                        {subs.map((s) => (
                          <option key={s.id} value={s.id}>
                            {root.name} → {s.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  }
                  return (
                    <option key={root.id} value={root.id}>
                      {root.icon ? `${root.icon} ` : ""}{root.name} ({root.location_name || ""})
                    </option>
                  );
                });
              })()}
            </select>
          </label>

          <label className="block">
            <span className="opacity-60">Опис / Склад</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Склад, алергени або особливості страви..."
              className="mt-1 w-full rounded-xl px-3 py-2 text-sm outline-none"
              style={inputStyle}
            />
          </label>

          {/* Фотографія страви */}
          <div className="block space-y-2">
            <span className="opacity-60 text-xs font-semibold">Фотографія страви</span>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />

            {imageUrl.trim() ? (
              <div
                className="flex items-center gap-3 rounded-xl p-3 border"
                style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}
              >
                <img
                  src={imageUrl.trim()}
                  alt="Прев'ю"
                  className="h-16 w-16 rounded-xl object-cover border border-white/10 shrink-0"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
                <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      className="app-press rounded-lg px-3 py-1.5 text-xs font-semibold"
                      style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
                    >
                      {isUploading ? "⏳ Завантаження..." : "🔄 Змінити фото"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className="app-press rounded-lg px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/10 hover:bg-red-500/20"
                    >
                      🗑️ Видалити
                    </button>
                  </div>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="/api/uploads/... або https://..."
                    className="w-full rounded-lg px-2 py-1 text-[11px] opacity-70 outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
            ) : (
              <div
                className="flex flex-col items-center justify-center rounded-xl p-4 border border-dashed text-center space-y-2"
                style={{ borderColor: "var(--app-border)", background: "var(--app-surface)" }}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="app-press rounded-xl px-4 py-2 text-xs font-semibold flex items-center gap-2 shadow-sm"
                  style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
                >
                  {isUploading ? "⏳ Завантаження..." : "📷 Додати фото"}
                </button>
                <div className="w-full pt-1">
                  <span className="opacity-40 text-[10px] block mb-1">або посилання вручну:</span>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="/api/uploads/... або https://..."
                    className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </div>
              </div>
            )}
            {uploadError && <p className="text-xs text-red-500">{uploadError}</p>}
          </div>

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

          {!product && (
            <div className="rounded-xl border p-3 space-y-2" style={{ borderColor: "var(--app-border)" }}>
              <span className="font-bold opacity-80">Початковий варіант ціни:</span>
              <div className="grid grid-cols-3 gap-2">
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Розмір</span>
                  <input
                    value={initialVariantLabel}
                    onChange={(e) => setInitialVariantLabel(e.target.value)}
                    placeholder="30 см"
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Ціна (₴)</span>
                  <input
                    type="number"
                    value={initialVariantPrice}
                    onChange={(e) => setInitialVariantPrice(e.target.value)}
                    placeholder="180"
                    required
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
                <label className="block col-span-1">
                  <span className="opacity-50 text-[10px]">Вага / Об'єм</span>
                  <input
                    value={initialVariantWeight}
                    onChange={(e) => setInitialVariantWeight(e.target.value)}
                    placeholder="450 г"
                    className="mt-0.5 w-full rounded-lg px-2 py-1.5 text-xs outline-none"
                    style={inputStyle}
                  />
                </label>
              </div>
            </div>
          )}

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
              {product ? "Зберегти" : "Створити страву"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
