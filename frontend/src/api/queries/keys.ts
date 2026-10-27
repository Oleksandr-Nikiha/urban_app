/** Ключі кешу зібрані в одному місці — щоб інвалідація не розповзалась по компонентах. */
export const keys = {
  me: ["me"] as const,
  bonusHistory: ["me", "bonuses", "history"] as const,
  categories: ["categories"] as const,
  products: (categoryId: number) => ["products", categoryId] as const,
  product: (productId: number) => ["product", productId] as const,
  cart: ["cart"] as const,
  locations: ["locations"] as const,
  orders: ["orders"] as const,
  order: (orderId: number) => ["order", orderId] as const,
  adminMe: ["admin", "me"] as const,
  deliveryCities: ["delivery", "cities"] as const,
  deliveryAddresses: (city?: string) => ["delivery", "addresses", city] as const,
};

