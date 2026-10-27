import { useEffect } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { ApiError, api, hasTelegramAuth } from "@/api/client";
import {
  GUEST_CART_EVENT,
  addGuestItem,
  clearGuestCart,
  getGuestCart,
  removeGuestItem,
  updateGuestItem,
  updateGuestItemQty,
} from "@/store/guestCart";
import type {
  Cart,
  CartItemOption,
  OptionSelection,
  User,
} from "@/api/types";
import { keys } from "./keys";

// --- Кошик ---
// Для авторизованих клієнтів (у Telegram) кошик живе на сервері.
// Для гостей без авторизації зберігається у localStorage браузера.

export async function isRegisteredUser(qc: QueryClient): Promise<boolean> {
  if (!hasTelegramAuth()) return false;
  const cached = qc.getQueryData<User | null>(keys.me);
  if (cached === null) return false;
  if (cached && typeof cached.id === "number") return true;

  try {
    const user = await qc.fetchQuery({
      queryKey: keys.me,
      queryFn: async () => {
        if (!hasTelegramAuth()) return null;
        try {
          return await api.get<User>("/me");
        } catch (e) {
          if (e instanceof ApiError && (e.status === 404 || e.status === 401)) return null;
          throw e;
        }
      },
      staleTime: 60_000,
    });
    return Boolean(user && typeof user.id === "number");
  } catch {
    return false;
  }
}

export function useCart() {
  const qc = useQueryClient();

  useEffect(() => {
    const handler = () => {
      void qc.invalidateQueries({ queryKey: keys.cart });
    };
    window.addEventListener(GUEST_CART_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(GUEST_CART_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, [qc]);

  return useQuery({
    queryKey: keys.cart,
    queryFn: async () => {
      const isRegistered = await isRegisteredUser(qc);
      if (!isRegistered) {
        return getGuestCart();
      }
      try {
        const guest = getGuestCart();
        if (guest.items.length > 0) {
          // Автоматична міграція гостьового кошика в серверний при переході в Telegram / після реєстрації
          let migrationFailed = false;
          for (const item of guest.items) {
            if (item.variant_id) {
              try {
                await api.post<Cart>("/cart/items", {
                  variant_id: item.variant_id,
                  qty: item.qty,
                  options: item.options.map((o) => ({
                    group_id: o.group_id,
                    variant_id: o.variant_id,
                    qty: o.qty,
                  })),
                });
              } catch (err) {
                if (err instanceof ApiError && (err.status === 404 || err.status === 401)) {
                  migrationFailed = true;
                  qc.setQueryData(keys.me, null);
                  return getGuestCart();
                }
                // ігноруємо помилки окремих недоступних товарів
              }
            }
          }
          if (!migrationFailed) {
            clearGuestCart();
          }
        }
        return await api.get<Cart>("/cart");
      } catch (e) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) {
          qc.setQueryData(keys.me, null);
          return getGuestCart();
        }
        throw e;
      }
    },
  });
}

export interface AddToCartInput {
  variant_id: number;
  qty: number;
  options: OptionSelection[];
  guest_meta?: {
    product_id: number;
    product_name: string;
    variant_label: string;
    weight: string | null;
    price: number;
    location_id: number;
    location_name: string;
    options_details: CartItemOption[];
    group_free_count?: Record<number, number>;
  };
}

export function useAddToCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: AddToCartInput) => {
      const isRegistered = await isRegisteredUser(qc);
      if (!isRegistered) {
        if (!v.guest_meta) {
          throw new Error("Не вистачає даних товару для кошика гостя");
        }
        return addGuestItem({
          product_id: v.guest_meta.product_id,
          product_name: v.guest_meta.product_name,
          variant_id: v.variant_id,
          variant_label: v.guest_meta.variant_label,
          weight: v.guest_meta.weight,
          price: v.guest_meta.price,
          qty: v.qty,
          location_id: v.guest_meta.location_id,
          location_name: v.guest_meta.location_name,
          options: v.options,
          options_details: v.guest_meta.options_details,
          group_free_count: v.guest_meta.group_free_count,
        });
      }

      try {
        return await api.post<Cart>("/cart/items", {
          variant_id: v.variant_id,
          qty: v.qty,
          options: v.options,
        });
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401) && v.guest_meta) {
          qc.setQueryData(keys.me, null);
          return addGuestItem({
            product_id: v.guest_meta.product_id,
            product_name: v.guest_meta.product_name,
            variant_id: v.variant_id,
            variant_label: v.guest_meta.variant_label,
            weight: v.guest_meta.weight,
            price: v.guest_meta.price,
            qty: v.qty,
            location_id: v.guest_meta.location_id,
            location_name: v.guest_meta.location_name,
            options: v.options,
            options_details: v.guest_meta.options_details,
            group_free_count: v.guest_meta.group_free_count,
          });
        }
        throw e;
      }
    },
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export interface UpdateCartItemPayload {
  itemId: number;
  qty?: number;
  variant_id?: number;
  options?: OptionSelection[];
  guest_meta?: {
    variant_label?: string;
    weight?: string | null;
    price?: number;
    options_details: CartItemOption[];
    group_free_count?: Record<number, number>;
  };
}

export function useUpdateCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: UpdateCartItemPayload) => {
      const isRegistered = await isRegisteredUser(qc);
      if (!isRegistered) {
        if (v.options !== undefined || v.guest_meta) {
          return updateGuestItem(v.itemId, {
            variant_id: v.variant_id,
            variant_label: v.guest_meta?.variant_label,
            weight: v.guest_meta?.weight,
            price: v.guest_meta?.price,
            qty: v.qty,
            options: v.options,
            options_details: v.guest_meta?.options_details,
            group_free_count: v.guest_meta?.group_free_count,
          });
        }
        return updateGuestItemQty(v.itemId, v.qty ?? 1);
      }

      try {
        return await api.patch<Cart>(`/cart/items/${v.itemId}`, {
          qty: v.qty,
          variant_id: v.variant_id,
          options: v.options,
        });
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401)) {
          qc.setQueryData(keys.me, null);
          if (v.options !== undefined || v.guest_meta) {
            return updateGuestItem(v.itemId, {
              variant_id: v.variant_id,
              variant_label: v.guest_meta?.variant_label,
              weight: v.guest_meta?.weight,
              price: v.guest_meta?.price,
              qty: v.qty,
              options: v.options,
              options_details: v.guest_meta?.options_details,
              group_free_count: v.guest_meta?.group_free_count,
            });
          }
          return updateGuestItemQty(v.itemId, v.qty ?? 1);
        }
        throw e;
      }
    },
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export function useRemoveCartItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: number) => {
      const isRegistered = await isRegisteredUser(qc);
      if (!isRegistered) {
        return removeGuestItem(itemId);
      }
      try {
        return await api.delete<Cart>(`/cart/items/${itemId}`);
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401)) {
          qc.setQueryData(keys.me, null);
          return removeGuestItem(itemId);
        }
        throw e;
      }
    },
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}

export function useClearCart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const isRegistered = await isRegisteredUser(qc);
      if (!isRegistered) {
        return clearGuestCart();
      }
      try {
        return await api.delete<Cart>("/cart");
      } catch (e) {
        if (e instanceof ApiError && (e.status === 404 || e.status === 401)) {
          qc.setQueryData(keys.me, null);
          return clearGuestCart();
        }
        throw e;
      }
    },
    onSuccess: (cart) => qc.setQueryData(keys.cart, cart),
  });
}
