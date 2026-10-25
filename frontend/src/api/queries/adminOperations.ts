import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "@/api/client";
import type {
  AdminDeliveryAddress,
  AdminMe,
  AdminOrderDetail,
  AdminOrderListItem,
  AdminOrderUpdatePayload,
  AdminUser,
  AdminUserUpdatePayload,
  AnalyticsSummary,
  AnalyticsTopProduct,
  BonusAnalytics,
  BonusTransaction,
  Broadcast,
  BroadcastCreatePayload,
  BroadcastRecipientsCount,
  DeliveryAddressCreatePayload,
  DeliveryAddressUpdatePayload,
  LocationDeliverySettings,
  LocationDeliveryUpdatePayload,
  Manager,
  ManagerCreatePayload,
  ManagerUpdatePayload,
} from "@/api/types";
import { keys } from "./keys";

// ============================================================================
// Адмін-панель: Операційні сутності (Менеджери, Користувачі, Замовлення, Доставка, Аналітика)
// ============================================================================

// --- Права та статус співробітника ---

export function useAdminMe() {
  return useQuery({
    queryKey: keys.adminMe,
    queryFn: () => api.get<AdminMe>("/admin/me"),
    staleTime: 30000,
  });
}

// --- Управління менеджерами (Тільки Admin) ---

export function useAdminManagers() {
  return useQuery({
    queryKey: keys.adminManagers,
    queryFn: () => api.get<Manager[]>("/admin/managers"),
  });
}

export function useCreateManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: ManagerCreatePayload) => api.post<Manager>("/admin/managers", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminManagers });
    },
  });
}

export function useUpdateManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ managerId, payload }: { managerId: number; payload: ManagerUpdatePayload }) =>
      api.patch<Manager>(`/admin/managers/${managerId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminManagers });
    },
  });
}

export function useDeleteManager() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (managerId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/managers/${managerId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminManagers });
    },
  });
}

// --- Налаштування доставки закладів (Адмінка) ---

export function useAdminLocationsDelivery() {
  return useQuery({
    queryKey: keys.adminLocationsDelivery,
    queryFn: () => api.get<LocationDeliverySettings[]>("/admin/locations/delivery"),
  });
}

export function useUpdateLocationDelivery() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      locationId,
      payload,
    }: {
      locationId: number;
      payload: LocationDeliveryUpdatePayload;
    }) => api.patch<LocationDeliverySettings>(`/admin/locations/${locationId}/delivery`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminLocationsDelivery });
      void qc.invalidateQueries({ queryKey: keys.locations });
    },
  });
}

// --- Адмінські адреси доставки ---

export function useAdminDeliveryAddresses(params?: {
  city?: string;
  search?: string;
  isActive?: boolean;
}) {
  return useQuery({
    queryKey: keys.adminDeliveryAddresses(params),
    queryFn: () => {
      const searchParams = new URLSearchParams();
      if (params?.city) searchParams.append("city", params.city);
      if (params?.search) searchParams.append("search", params.search);
      if (params?.isActive !== undefined) searchParams.append("is_active", String(params.isActive));
      const qs = searchParams.toString() ? `?${searchParams.toString()}` : "";
      return api.get<AdminDeliveryAddress[]>(`/admin/delivery/addresses${qs}`);
    },
  });
}

export function useCreateAdminDeliveryAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DeliveryAddressCreatePayload) =>
      api.post<AdminDeliveryAddress>("/admin/delivery/addresses", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: ["delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: keys.deliveryCities });
    },
  });
}

export function useUpdateAdminDeliveryAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      addressId,
      payload,
    }: {
      addressId: number;
      payload: DeliveryAddressUpdatePayload;
    }) => api.patch<AdminDeliveryAddress>(`/admin/delivery/addresses/${addressId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: ["delivery", "addresses"] });
    },
  });
}

export function useDeleteAdminDeliveryAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addressId: number) =>
      api.delete<{ status: string; deleted_id: number }>(`/admin/delivery/addresses/${addressId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: ["delivery", "addresses"] });
      void qc.invalidateQueries({ queryKey: keys.deliveryCities });
    },
  });
}

// --- Керування користувачами (Адмінка) ---

export function useAdminUsers(query: string = "") {
  return useQuery({
    queryKey: keys.adminUsers(query),
    queryFn: () => {
      const qs = query ? `?query=${encodeURIComponent(query)}` : "";
      return api.get<AdminUser[]>(`/admin/users${qs}`);
    },
  });
}

export function useUpdateAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, payload }: { userId: number; payload: AdminUserUpdatePayload }) =>
      api.patch<AdminUser>(`/admin/users/${userId}`, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
    },
  });
}

export function useDeleteAdminUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      api.delete<{ status: string; message: string }>(`/admin/users/${userId}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["admin", "users"] });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: ["admin", "bonusAnalytics"] });
    },
  });
}

export function useBonusAnalytics() {
  return useQuery({
    queryKey: ["admin", "bonusAnalytics"],
    queryFn: () => api.get<BonusAnalytics>("/admin/bonuses/analytics"),
  });
}

export function useAdminUserBonusHistory(userId: number, enabled: boolean = true) {
  return useQuery({
    queryKey: ["admin", "users", userId, "bonusHistory"],
    queryFn: () => api.get<BonusTransaction[]>(`/admin/users/${userId}/bonus-history`),
    enabled: enabled && userId > 0,
  });
}

// --- Керування замовленнями (Адмінка) ---

export function useAdminOrders(params?: { status?: string | null; locationId?: number | null }) {
  return useQuery({
    queryKey: keys.adminOrders(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.status) sp.set("status", params.status);
      if (params?.locationId) sp.set("location_id", String(params.locationId));
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      return api.get<AdminOrderListItem[]>(`/admin/orders${qs}`);
    },
    refetchInterval: 3000,
  });
}

export function useAdminOrderDetail(orderId: number) {
  return useQuery({
    queryKey: keys.adminOrder(orderId),
    queryFn: () => api.get<AdminOrderDetail>(`/admin/orders/${orderId}`),
    enabled: orderId > 0,
  });
}

export function useUpdateAdminOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, payload }: { orderId: number; payload: AdminOrderUpdatePayload }) =>
      api.put<AdminOrderDetail>(`/admin/orders/${orderId}`, payload),
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: keys.adminOrder(vars.orderId) });
      void qc.invalidateQueries({ queryKey: ["admin", "orders"] });
      void qc.invalidateQueries({ queryKey: keys.order(vars.orderId) });
    },
  });
}

export function useNotifyAdminOrder() {
  return useMutation({
    mutationFn: (orderId: number) =>
      api.post<{ status: string; message: string }>(`/admin/orders/${orderId}/notify`),
  });
}

// --- Аналітика та статистика замовлень (Адмінка) ---

export function useAdminAnalyticsSummary(params?: { period?: string; locationId?: number | null }) {
  return useQuery({
    queryKey: keys.adminAnalyticsSummary(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.period) sp.set("period", params.period);
      if (params?.locationId) sp.set("location_id", String(params.locationId));
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      return api.get<AnalyticsSummary>(`/admin/analytics/summary${qs}`);
    },
  });
}

export function useAdminAnalyticsTopProducts(params?: {
  period?: string;
  locationId?: number | null;
  limit?: number;
}) {
  return useQuery({
    queryKey: keys.adminAnalyticsTopProducts(params),
    queryFn: () => {
      const sp = new URLSearchParams();
      if (params?.period) sp.set("period", params.period);
      if (params?.locationId) sp.set("location_id", String(params.locationId));
      if (params?.limit) sp.set("limit", String(params.limit));
      const qs = sp.toString() ? `?${sp.toString()}` : "";
      return api.get<AnalyticsTopProduct[]>(`/admin/analytics/top-products${qs}`);
    },
  });
}

// --- Маркетингові розсилки (Адмінка) ---

export function useAdminBroadcastRecipientsCount(segment: string) {
  return useQuery({
    queryKey: keys.adminBroadcastRecipientsCount(segment),
    queryFn: () =>
      api.get<BroadcastRecipientsCount>(
        `/admin/broadcasts/recipients-count?segment=${encodeURIComponent(segment)}`
      ),
    staleTime: 15000,
  });
}

export function useAdminBroadcasts() {
  return useQuery({
    queryKey: keys.adminBroadcasts,
    queryFn: () => api.get<Broadcast[]>("/admin/broadcasts"),
    refetchInterval: 8000,
  });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BroadcastCreatePayload) =>
      api.post<Broadcast>("/admin/broadcasts", payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.adminBroadcasts });
    },
  });
}
