import { useQuery } from "@tanstack/react-query";

import { api } from "@/api/client";
import type {
  Category,
  DeliveryAddress,
  Location,
  ProductDetail,
  ProductListItem,
} from "@/api/types";
import { keys } from "./keys";

// --- Каталог і контакти (публічні) ---

export function useCategories() {
  return useQuery({ queryKey: keys.categories, queryFn: () => api.get<Category[]>("/categories") });
}

export function useProducts(categoryId: number) {
  return useQuery({
    queryKey: keys.products(categoryId),
    queryFn: () => api.get<ProductListItem[]>(`/categories/${categoryId}/products`),
  });
}

export function useProduct(productId: number) {
  return useQuery({
    queryKey: keys.product(productId),
    queryFn: () => api.get<ProductDetail>(`/products/${productId}`),
  });
}

export function useLocations() {
  return useQuery({ queryKey: keys.locations, queryFn: () => api.get<Location[]>("/locations") });
}

// --- Довідник адрес доставки (Клієнтські) ---

export function useDeliveryCities() {
  return useQuery({
    queryKey: keys.deliveryCities,
    queryFn: () => api.get<string[]>("/delivery/cities"),
    staleTime: 10 * 60 * 1000,
  });
}

export function useDeliveryAddresses(city: string = "Київ") {
  return useQuery({
    queryKey: keys.deliveryAddresses(city),
    queryFn: () =>
      api.get<DeliveryAddress[]>(`/delivery/addresses?city=${encodeURIComponent(city)}`),
    staleTime: 5 * 60 * 1000,
  });
}
