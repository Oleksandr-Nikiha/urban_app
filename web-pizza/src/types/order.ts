export const LAST_ORDER_STORAGE_KEY = "urban_last_order_id";

export interface WebOrderItemPayload {
  variant_id: number;
  qty: number;
  option_variant_ids?: number[];
}

export interface WebOrderCreatePayload {
  telegram_id?: number | null;
  location_id: number;
  fulfillment_type: "delivery" | "pickup";
  delivery_address?: string | null;
  contact_name: string;
  contact_phone: string;
  payment_method: "cash" | "card";
  scheduled_time?: string | null;
  comment?: string | null;
  source?: string;
  bonus_spent?: number;
  items: WebOrderItemPayload[];
}

export interface OrderItemOptionOut {
  id: number;
  option_group_name: string;
  option_name: string;
  price_delta: number;
  qty: number;
}

export interface OrderItemOut {
  id: number;
  variant_id: number | null;
  product_name: string;
  variant_label: string;
  unit_price: number;
  qty: number;
  subtotal: number;
  options: OrderItemOptionOut[];
}

export interface OrderGroupOut {
  id: number;
  location_id: number;
  location_name: string;
  status: string;
  subtotal: number;
  items: OrderItemOut[];
}

export interface OrderOut {
  id: number;
  telegram_id: number | null;
  status: string;
  fulfillment_type: string;
  delivery_address: string | null;
  contact_name: string;
  contact_phone: string;
  payment_method: string;
  scheduled_time: string | null;
  comment: string | null;
  total_price: number;
  bonus_spent?: number;
  bonus_earned?: number;
  created_at: string;
  source: string;
  groups: OrderGroupOut[];
}

export interface RepeatOrderPayload {
  replace_cart?: boolean;
}

export interface RepeatOrderResponse {
  added_count: number;
  unavailable_items: string[];
  price_changed: boolean;
  old_total: number;
  new_total: number;
}

