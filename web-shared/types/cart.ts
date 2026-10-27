import type { ProductOptionItem, ProductVariant } from "./catalog.ts";

export interface SelectedOptionWithGroup {
  groupId: number;
  groupName: string;
  option: ProductOptionItem;
  qty?: number;
}

export interface CartItem {
  id: string; // унікальний ключ позиції
  productId: number;
  productName: string;
  imageUrl: string | null;
  variant: ProductVariant;
  selectedOptions: SelectedOptionWithGroup[];
  qty: number;
  extraPerUnit: number; // вартість опцій на 1 шт
  itemSubtotal: number; // (variant.price + extraPerUnit) * qty
}

export interface CartState {
  items: CartItem[];
  totalQty: number;
  totalPrice: number;
}

