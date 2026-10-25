import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type {
  AdminCategory,
  AdminOptionGroup,
  AdminOptionGroupItem,
  AdminProduct,
  AdminVariant,
  BulkAvailabilityPayload,
  BulkOptionGroupPayload,
  CategoryCreatePayload,
  CategoryUpdatePayload,
  OptionGroupCreatePayload,
  OptionGroupItemCreatePayload,
  OptionGroupItemUpdatePayload,
  OptionGroupUpdatePayload,
  ProductCreatePayload,
  ProductOptionGroupAdmin,
  ProductOptionGroupAttachPayload,
  ProductOptionGroupUpdatePayload,
  ProductUpdatePayload,
  VariantCreatePayload,
  VariantSelectorChoice,
  VariantUpdatePayload,
} from "@/api/types";
import { keys } from "./keys";

// ============================================================================
// Адмін-панель: Каталог, Товари, Варіанти, Опції
// ============================================================================

// --- Категорії ---

export function useAdminCategories(locationId?: number | null) {
  return useQuery({
    queryKey: keys.adminCategories(locationId),
    queryFn: () => {
      const qs = locationId ? `?location_id=${locationId}` : "";
      return api.get<AdminCategory[]>(`/admin/categories${qs}`);
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoryCreatePayload) =>
      api.post<AdminCategory>("/admin/categories", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ categoryId, payload }: { categoryId: number; payload: CategoryUpdatePayload }) =>
      api.patch<AdminCategory>(`/admin/categories/${categoryId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: keys.categories });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/categories/${categoryId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: keys.categories });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

// --- Страви (Товари) ---

export function useAdminProducts(params?: { categoryId?: number | null; locationId?: number | null }) {
  return useQuery({
    queryKey: keys.adminProducts(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.categoryId) sp.set("category_id", String(params.categoryId));
      if (params?.locationId) sp.set("location_id", String(params.locationId));
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      return api.get<AdminProduct[]>(`/admin/products${qs}`);
    },
  });
}

export function useCreateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ProductCreatePayload) =>
      api.post<AdminProduct>("/admin/products", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: keys.categories });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, payload }: { productId: number; payload: ProductUpdatePayload }) =>
      api.patch<AdminProduct>(`/admin/products/${productId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (productId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/products/${productId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["admin", "categories"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// --- Варіанти цін ---

export function useCreateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, payload }: { productId: number; payload: VariantCreatePayload }) =>
      api.post<AdminVariant>(`/admin/products/${productId}/variants`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useUpdateVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, payload }: { variantId: number; payload: VariantUpdatePayload }) =>
      api.patch<AdminVariant>(`/admin/variants/${variantId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useDeleteVariant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (variantId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/variants/${variantId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// --- Швидкий стоп-лист ---

export function useToggleProductAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, isAvailable }: { productId: number; isAvailable: boolean }) =>
      api.patch<{ id: number; is_available: boolean }>(`/admin/products/${productId}/toggle-availability`, {
        is_available: isAvailable,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useToggleVariantAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ variantId, isAvailable }: { variantId: number; isAvailable: boolean }) =>
      api.patch<{ id: number; is_available: boolean }>(`/admin/variants/${variantId}/toggle-availability`, {
        is_available: isAvailable,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// --- Масові (Bulk) операції над стравами ---

export function useBulkProductAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkAvailabilityPayload) =>
      api.patch<{ updated_count: number; product_ids: number[]; is_available: boolean }>(
        "/admin/products/bulk/availability",
        payload,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

export function useBulkProductOptionGroups() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkOptionGroupPayload) =>
      api.post<{ updated_count: number; product_ids: number[]; action: string }>(
        "/admin/products/bulk/option-groups",
        payload,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: ["products"] });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

// --- Адмін-панель: Додатки (Option Groups) ---

export function useAdminOptionGroups() {
  return useQuery({
    queryKey: keys.adminOptionGroups,
    queryFn: () => api.get<AdminOptionGroup[]>("/admin/option-groups"),
  });
}

export function useCreateOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: OptionGroupCreatePayload) =>
      api.post<AdminOptionGroup>("/admin/option-groups", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

export function useUpdateOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: number; payload: OptionGroupUpdatePayload }) =>
      api.patch<AdminOptionGroup>(`/admin/option-groups/${groupId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

export function useDeleteOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/option-groups/${groupId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

// --- Позиції в групі додатків ---

export function useAdminOptionGroupItems(groupId: number) {
  return useQuery({
    queryKey: keys.adminOptionGroupItems(groupId),
    queryFn: () => api.get<AdminOptionGroupItem[]>(`/admin/option-groups/${groupId}/items`),
    enabled: groupId > 0,
  });
}

export function useAddOptionGroupItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, payload }: { groupId: number; payload: OptionGroupItemCreatePayload }) =>
      api.post<AdminOptionGroupItem>(`/admin/option-groups/${groupId}/items`, payload),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroupItems(vars.groupId) });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

export function useUpdateOptionGroupItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      groupId,
      variantId,
      payload,
    }: {
      groupId: number;
      variantId: number;
      payload: OptionGroupItemUpdatePayload;
    }) =>
      api.patch<AdminOptionGroupItem>(`/admin/option-groups/${groupId}/items/${variantId}`, payload),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroupItems(vars.groupId) });
    },
  });
}

export function useDeleteOptionGroupItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, variantId }: { groupId: number; variantId: number }) =>
      api.delete<{ status: string; message: string }>(
        `/admin/option-groups/${groupId}/items/${variantId}`,
      ),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroupItems(vars.groupId) });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

// --- Прив'язка додатків до страви ---

export function useAttachProductOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      payload,
    }: {
      productId: number;
      payload: ProductOptionGroupAttachPayload;
    }) =>
      api.post<ProductOptionGroupAdmin>(`/admin/products/${productId}/option-groups`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

export function useUpdateProductOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      productId,
      groupId,
      payload,
    }: {
      productId: number;
      groupId: number;
      payload: ProductOptionGroupUpdatePayload;
    }) =>
      api.patch<ProductOptionGroupAdmin>(
        `/admin/products/${productId}/option-groups/${groupId}`,
        payload,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
    },
  });
}

export function useDetachProductOptionGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ productId, groupId }: { productId: number; groupId: number }) =>
      api.delete<{ status: string; message: string }>(
        `/admin/products/${productId}/option-groups/${groupId}`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "products"] });
      void qc.invalidateQueries({ queryKey: keys.adminOptionGroups });
    },
  });
}

// --- Довідник варіантів для селектора ---

export function useAdminVariantChoices() {
  return useQuery({
    queryKey: keys.adminVariantChoices,
    queryFn: () => api.get<VariantSelectorChoice[]>("/admin/variant-choices"),
  });
}
