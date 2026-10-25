import { useState, useMemo, useRef } from "react";
import {
  useAdminCategories,
  useAdminProducts,
  useDeleteCategory,
  useDeleteProduct,
  useDeleteVariant,
  useUpdateProduct,
  useBulkProductAvailability,
} from "@/api/queries";
import { api } from "@/api/client";
import { compressImageFile } from "@/utils/imageCompression";
import type { AdminCategory, AdminProduct, AdminVariant, Location } from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";
import { CategoryBar } from "./catalog/CategoryBar";
import { SubcategoryBar } from "./catalog/SubcategoryBar";
import { CatalogProductCard } from "./catalog/CatalogProductCard";
import { BulkActionsBar } from "./catalog/BulkActionsBar";
import { ProductOptionsModal } from "./modals/ProductOptionsModal";
import { BulkProductOptionsModal } from "./modals/BulkProductOptionsModal";
import { CategoryModal } from "./modals/CategoryModal";
import { SubcategoryModal } from "./modals/SubcategoryModal";
import { ProductModal } from "./modals/ProductModal";
import { VariantModal } from "./modals/VariantModal";

export function CatalogTab({
  locationId,
  locations,
  isSuperAdmin,
  userLocationId,
}: {
  locationId?: number | null;
  locations: Location[];
  isSuperAdmin: boolean;
  userLocationId?: number | null;
}) {
  const { data: categories = [], isPending: catLoading, error: catError } = useAdminCategories(locationId);
  const [selectedParentCatId, setSelectedParentCatId] = useState<number | null>(null);
  const [selectedSubCatId, setSelectedSubCatId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const rootCategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id === null)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [categories]
  );
  const subcategories = useMemo(
    () =>
      categories
        .filter((c) => c.parent_id !== null)
        .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id),
    [categories]
  );

  const selectedParentCat = useMemo(
    () => (selectedParentCatId ? rootCategories.find((c) => c.id === selectedParentCatId) : null),
    [rootCategories, selectedParentCatId]
  );
  const selectedSubCat = useMemo(
    () => (selectedSubCatId ? subcategories.find((c) => c.id === selectedSubCatId) : null),
    [subcategories, selectedSubCatId]
  );

  const effectiveCategoryId = selectedSubCatId || selectedParentCatId || null;

  const { data: products = [], isPending: prodLoading, error: prodError } = useAdminProducts({
    categoryId: effectiveCategoryId,
    locationId: locationId,
  });

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const matchName = p.name.toLowerCase().includes(q);
      const matchDesc = p.description ? p.description.toLowerCase().includes(q) : false;
      const matchCat = p.category_name ? p.category_name.toLowerCase().includes(q) : false;
      const matchVariant = p.variants?.some((v) => v.label.toLowerCase().includes(q)) ?? false;
      return matchName || matchDesc || matchCat || matchVariant;
    });
  }, [products, search]);

  // Модальні вікна
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<AdminCategory | null>(null);

  const [subcatModalOpen, setSubcatModalOpen] = useState(false);
  const [editingSubcategory, setEditingSubcategory] = useState<AdminCategory | null>(null);

  const [prodModalOpen, setProdModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);

  const [variantModalOpen, setVariantModalOpen] = useState(false);
  const [targetProductForVariant, setTargetProductForVariant] = useState<number | null>(null);
  const [editingVariant, setEditingVariant] = useState<AdminVariant | null>(null);

  const [optionsModalOpen, setOptionsModalOpen] = useState(false);
  const [targetProductForOptions, setTargetProductForOptions] = useState<AdminProduct | null>(null);

  // Масові операції (Bulk)
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [bulkOptionsModalOpen, setBulkOptionsModalOpen] = useState(false);
  const bulkAvailability = useBulkProductAvailability();

  const toggleSelectProduct = (id: number) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allFilteredSelected =
    filteredProducts.length > 0 &&
    filteredProducts.every((p) => selectedProductIds.includes(p.id));

  const toggleSelectAll = () => {
    haptic("light");
    if (allFilteredSelected) {
      const filteredIdSet = new Set(filteredProducts.map((p) => p.id));
      setSelectedProductIds((prev) => prev.filter((id) => !filteredIdSet.has(id)));
    } else {
      const newSet = new Set([...selectedProductIds, ...filteredProducts.map((p) => p.id)]);
      setSelectedProductIds(Array.from(newSet));
    }
  };

  const deleteCategory = useDeleteCategory();
  const deleteProduct = useDeleteProduct();
  const deleteVariant = useDeleteVariant();
  const updateProduct = useUpdateProduct();

  const catalogFileInputRef = useRef<HTMLInputElement>(null);
  const targetProdIdRef = useRef<number | null>(null);
  const [uploadingProdId, setUploadingProdId] = useState<number | null>(null);

  const handleQuickPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const prodId = targetProdIdRef.current;
    if (!file || !prodId) return;
    if (file.size > 25 * 1024 * 1024) {
      hapticNotify("error");
      if (catalogFileInputRef.current) catalogFileInputRef.current.value = "";
      targetProdIdRef.current = null;
      return;
    }
    setUploadingProdId(prodId);
    try {
      const optimizedFile = await compressImageFile(file);
      const formData = new FormData();
      formData.append("file", optimizedFile);
      const res = await api.upload<{ url: string }>("/admin/upload", formData);
      await updateProduct.mutateAsync({ productId: prodId, payload: { image_url: res.url } });
      hapticNotify("success");
    } catch {
      hapticNotify("error");
    } finally {
      setUploadingProdId(null);
      targetProdIdRef.current = null;
      if (catalogFileInputRef.current) catalogFileInputRef.current.value = "";
    }
  };

  const triggerPhotoUpload = (prodId: number) => {
    haptic("light");
    targetProdIdRef.current = prodId;
    catalogFileInputRef.current?.click();
  };

  if (catLoading) return <Spinner />;
  if (catError) return <ErrorBox message={catError.message} />;

  const defaultLocation = locationId || userLocationId || (locations[0]?.id ?? 1);

  return (
    <div className="space-y-6">
      {/* 1. Блок категорій */}
      <CategoryBar
        rootCategories={rootCategories}
        selectedParentCatId={selectedParentCatId}
        onSelectCategory={(id) => {
          setSelectedParentCatId(id);
          setSelectedSubCatId(null);
        }}
        onOpenCreate={() => {
          setEditingCategory(null);
          setCatModalOpen(true);
        }}
        onEditCategory={(cat) => {
          setEditingCategory(cat);
          setCatModalOpen(true);
        }}
      />

      {/* 2. Блок підкатегорій */}
      <SubcategoryBar
        subcategories={subcategories}
        rootCategories={rootCategories}
        selectedParentCat={selectedParentCat}
        selectedParentCatId={selectedParentCatId}
        selectedSubCatId={selectedSubCatId}
        onSelectSubcategory={(subId, parentId) => {
          setSelectedSubCatId(subId);
          if (parentId && selectedParentCatId !== parentId) {
            setSelectedParentCatId(parentId);
          }
        }}
        onOpenCreate={() => {
          setEditingSubcategory(null);
          setSubcatModalOpen(true);
        }}
        onEditSubcategory={(sub) => {
          setEditingSubcategory(sub);
          setSubcatModalOpen(true);
        }}
      />

      {/* 3. Блок страв */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-bold">
            Страви{" "}
            {selectedSubCat
              ? `в «${selectedSubCat.name}»`
              : selectedParentCat
              ? `в «${selectedParentCat.name}» (всі)`
              : "(всі)"}{" "}
            <span className="text-xs font-normal opacity-60">
              ({filteredProducts.length}
              {search.trim() ? ` з ${products.length}` : ""})
            </span>
          </h2>
          <div className="flex items-center gap-2">
            {filteredProducts.length > 0 && (
              <button
                type="button"
                onClick={toggleSelectAll}
                className="app-press rounded-xl px-2.5 py-1.5 text-xs font-medium border transition-colors"
                style={{
                  borderColor: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--app-border)",
                  background: allFilteredSelected ? "var(--app-tint)" : "var(--app-surface)",
                  color: allFilteredSelected ? "var(--tg-theme-button-color)" : "var(--tg-theme-text-color)",
                }}
              >
                {allFilteredSelected ? "✓ Вибрано всі" : "Вибрати всі"}
              </button>
            )}
            <button
              onClick={() => {
                haptic("light");
                setEditingProduct(null);
                setProdModalOpen(true);
              }}
              className="app-press flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
              style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
            >
              <span>+</span> Страва
            </button>
          </div>
        </div>

        {/* Швидкий пошук страв у меню */}
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Швидкий пошук страви за назвою, описом або складом..."
            className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-4 py-2.5 pl-10 text-sm outline-none transition focus:border-[var(--tg-theme-button-color)] focus:ring-1 focus:ring-[var(--tg-theme-button-color)]"
            style={{ color: "var(--tg-theme-text-color)" }}
          />
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm opacity-50">
            🔍
          </span>
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-xs opacity-50 hover:opacity-100"
              title="Очистити пошук"
            >
              ✕
            </button>
          )}
        </div>

        {prodLoading ? (
          <Spinner />
        ) : prodError ? (
          <ErrorBox message={prodError.message} />
        ) : products.length === 0 ? (
          <EmptyState icon="🍕" title="Немає страв" hint="Додайте першу страву за допомогою кнопки вище" />
        ) : filteredProducts.length === 0 ? (
          <div className="app-card rounded-2xl p-6 text-center space-y-3">
            <span className="text-3xl">🔍</span>
            <p className="font-bold text-sm">Нічого не знайдено</p>
            <p className="text-xs opacity-60">
              За запитом «{search}» не знайдено жодної страви. Спробуйте змінити пошуковий запит або обрати іншу категорію.
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="app-press rounded-xl px-4 py-2 text-xs font-semibold"
              style={{ background: "var(--app-surface-2)" }}
            >
              Скинути пошук
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredProducts.map((p) => (
              <CatalogProductCard
                key={p.id}
                product={p}
                isSelected={selectedProductIds.includes(p.id)}
                uploadingProdId={uploadingProdId}
                onToggleSelect={toggleSelectProduct}
                onTriggerPhotoUpload={triggerPhotoUpload}
                onEditProduct={(prod) => {
                  setEditingProduct(prod);
                  setProdModalOpen(true);
                }}
                onDeleteProduct={(id) => {
                  deleteProduct.mutate(id);
                }}
                onAddVariant={(productId) => {
                  setTargetProductForVariant(productId);
                  setEditingVariant(null);
                  setVariantModalOpen(true);
                }}
                onEditVariant={(productId, variant) => {
                  setTargetProductForVariant(productId);
                  setEditingVariant(variant);
                  setVariantModalOpen(true);
                }}
                onDeleteVariant={(variantId) => {
                  deleteVariant.mutate(variantId);
                }}
                onConfigureOptions={(prod) => {
                  setTargetProductForOptions(prod);
                  setOptionsModalOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {/* Плаваюча панель масових дій */}
      <BulkActionsBar
        selectedCount={selectedProductIds.length}
        isPending={bulkAvailability.isPending}
        onClearSelection={() => setSelectedProductIds([])}
        onSetAvailability={(available) => {
          bulkAvailability.mutate(
            { product_ids: selectedProductIds, is_available: available },
            {
              onSuccess: () => {
                hapticNotify("success");
              },
            },
          );
        }}
        onOpenBulkOptions={() => setBulkOptionsModalOpen(true)}
      />

      {/* Модальне вікно масового налаштування додатків */}
      {bulkOptionsModalOpen && selectedProductIds.length > 0 && (
        <BulkProductOptionsModal
          productIds={selectedProductIds}
          onClose={() => setBulkOptionsModalOpen(false)}
          onSuccess={() => {
            setSelectedProductIds([]);
          }}
        />
      )}

      {/* Модальне вікно Категорії */}
      {catModalOpen && (
        <CategoryModal
          category={editingCategory}
          locations={locations}
          defaultLocationId={defaultLocation}
          isSuperAdmin={isSuperAdmin}
          existingCategories={categories}
          onClose={() => setCatModalOpen(false)}
          onDelete={(id) => {
            deleteCategory.mutate(id);
            setCatModalOpen(false);
          }}
        />
      )}

      {/* Модальне вікно Підкатегорії */}
      {subcatModalOpen && (
        <SubcategoryModal
          subcategory={editingSubcategory}
          rootCategories={rootCategories}
          defaultParentId={selectedParentCatId}
          existingCategories={categories}
          onClose={() => setSubcatModalOpen(false)}
          onDelete={(id) => {
            deleteCategory.mutate(id);
            setSubcatModalOpen(false);
          }}
        />
      )}

      {/* Модальне вікно Страви */}
      {prodModalOpen && (
        <ProductModal
          product={editingProduct}
          categories={categories}
          defaultCategoryId={effectiveCategoryId || categories[0]?.id || 1}
          onClose={() => setProdModalOpen(false)}
        />
      )}

      {/* Модальне вікно Варіанту ціни */}
      {variantModalOpen && targetProductForVariant && (
        <VariantModal
          productId={targetProductForVariant}
          variant={editingVariant}
          onClose={() => {
            setVariantModalOpen(false);
            setTargetProductForVariant(null);
            setEditingVariant(null);
          }}
        />
      )}

      {/* Модальне вікно налаштування додатків для страви */}
      {optionsModalOpen && targetProductForOptions && (
        <ProductOptionsModal
          product={targetProductForOptions}
          onClose={() => {
            setOptionsModalOpen(false);
            setTargetProductForOptions(null);
          }}
        />
      )}

      {/* Прихований інпут для швидкої зміни фото страв */}
      <input
        ref={catalogFileInputRef}
        type="file"
        accept="image/*"
        onChange={handleQuickPhotoUpload}
        className="hidden"
      />
    </div>
  );
}
