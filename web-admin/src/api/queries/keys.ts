/** Ключі кешу зібрані в одному місці — щоб інвалідація не розповзалась по компонентах. */
export const keys = {
  me: ["me"] as const,
  categories: ["categories"] as const,
  products: (categoryId: number) => ["products", categoryId] as const,
  product: (productId: number) => ["product", productId] as const,
  cart: ["cart"] as const,
  locations: ["locations"] as const,
  orders: ["orders"] as const,
  order: (orderId: number) => ["order", orderId] as const,
  adminMe: ["admin", "me"] as const,
  adminManagers: ["admin", "managers"] as const,
  adminCategories: (locationId?: number | null) => ["admin", "categories", locationId] as const,
  adminProducts: (params?: { categoryId?: number | null; locationId?: number | null }) =>
    ["admin", "products", params] as const,
  adminOptionGroups: ["admin", "option-groups"] as const,
  adminOptionGroupItems: (groupId: number) => ["admin", "option-groups", groupId, "items"] as const,
  adminVariantChoices: ["admin", "variant-choices"] as const,
  adminLocationsDelivery: ["admin", "locations", "delivery"] as const,
  adminDeliveryAddresses: (params?: { city?: string; search?: string; isActive?: boolean }) =>
    ["admin", "delivery", "addresses", params] as const,
  deliveryCities: ["delivery", "cities"] as const,
  deliveryAddresses: (city?: string) => ["delivery", "addresses", city] as const,
  adminUsers: (query: string) => ["admin", "users", query] as const,
  adminOrders: (params?: { status?: string | null; locationId?: number | null }) =>
    ["admin", "orders", params?.status, params?.locationId] as const,
  adminOrder: (orderId: number) => ["admin", "order", orderId] as const,
  adminAnalyticsSummary: (params?: { period?: string; locationId?: number | null }) =>
    ["admin", "analytics", "summary", params] as const,
  adminAnalyticsTopProducts: (params?: { period?: string; locationId?: number | null; limit?: number }) =>
    ["admin", "analytics", "top-products", params] as const,
  adminBroadcastRecipientsCount: (segment: string) =>
    ["admin", "broadcasts", "recipients-count", segment] as const,
  adminBroadcasts: ["admin", "broadcasts"] as const,
};
