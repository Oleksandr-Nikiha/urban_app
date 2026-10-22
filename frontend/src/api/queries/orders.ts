import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, hasTelegramAuth } from "@/api/client";
import { clearGuestCart, getGuestCart } from "@/store/guestCart";
import type { Order, OrderCreatePayload, RepeatOrderResponse } from "@/api/types";
import { keys } from "./keys";

// --- Замовлення (Клієнтські) ---

export function useCreateOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: OrderCreatePayload) => {
      if (!hasTelegramAuth()) {
        const guestCart = getGuestCart();
        const targetLocId = payload.location_id ?? (guestCart.items[0]?.location_id || 2);
        const filteredItems = payload.items ?? guestCart.items
          .filter((it) => !payload.location_id || it.location_id === payload.location_id)
          .map((it) => ({
            variant_id: it.variant_id ?? 0,
            qty: it.qty,
            option_variant_ids: it.options.flatMap((o) => Array(o.qty).fill(o.variant_id)),
          }));

        const webPayload = {
          location_id: targetLocId,
          fulfillment_type: payload.fulfillment_type,
          delivery_address: payload.delivery_address,
          contact_name: payload.contact_name,
          contact_phone: payload.contact_phone,
          payment_method: payload.payment_method === "qr" ? "card" : payload.payment_method,
          scheduled_time: payload.scheduled_time,
          comment: payload.comment,
          source: "web",
          items: filteredItems,
        };
        const order = await api.post<Order>("/orders/web", webPayload);
        clearGuestCart();
        return order;
      }
      return api.post<Order>("/orders", payload);
    },
    onSuccess: () => {
      // Очищуємо та оновлюємо дані кошика
      void qc.invalidateQueries({ queryKey: keys.cart });
    },
  });
}

export function useOrders() {
  return useQuery({
    queryKey: keys.orders,
    queryFn: () => api.get<Order[]>("/orders"),
    enabled: hasTelegramAuth(),
    refetchInterval: (query) => {
      const orders = query.state.data;
      if (!orders || orders.length === 0) return 10000;
      const hasActive = orders.some(
        (o) => !["completed", "delivered", "rejected", "cancelled"].includes(o.status),
      );
      // Лайв-режим: при активних замовленнях оновлюємо що 3 секунди
      return hasActive ? 3000 : 15000;
    },
    refetchOnWindowFocus: true,
  });
}

export function useOrder(orderId: number) {
  return useQuery({
    queryKey: keys.order(orderId),
    queryFn: () => {
      if (!hasTelegramAuth()) {
        return api.get<Order>(`/orders/web/${orderId}`);
      }
      return api.get<Order>(`/orders/${orderId}`);
    },
    enabled: orderId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 3000;
      // Опитуємо кожні 3 секунди, поки замовлення активне
      const terminalStatuses = ["completed", "delivered", "rejected", "cancelled"];
      return !terminalStatuses.includes(status) ? 3000 : false;
    },
    refetchOnWindowFocus: true,
  });
}

export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: number) =>
      api.post<Order>(`/orders/${orderId}/cancel`),
    onSuccess: (updatedOrder) => {
      qc.invalidateQueries({ queryKey: keys.orders });
      qc.setQueryData(keys.order(updatedOrder.id), updatedOrder);
    },
  });
}

export function useRepeatOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      replaceCart = true,
    }: {
      orderId: number;
      replaceCart?: boolean;
    }) =>
      api.post<RepeatOrderResponse>(`/orders/${orderId}/repeat`, {
        replace_cart: replaceCart,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.cart });
    },
  });
}
