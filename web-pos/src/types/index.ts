export interface StaffMember {
  id: number;
  staff_name: string;
  role: string;
  location_id: number | null;
  location_name: string | null;
}

export interface OptionItem {
  id: number;
  variant_id: number;
  name: string;
  price: number;
}

export interface OptionGroup {
  group_id: number;
  name: string;
  min_select: number;
  max_select: number;
  free_count: number;
  items: OptionItem[];
}

export interface ProductVariant {
  id: number;
  product_id: number;
  label: string;
  price: number;
  weight: string | null;
  is_available: boolean;
  sort_order: number;
}

export interface Product {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  is_available: boolean;
  sort_order: number;
  variants: ProductVariant[];
  option_groups: OptionGroup[];
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  parent_id: number | null;
  sort_order: number;
  products?: Product[];
}

export interface CartItemOption {
  option_item_id: number;
  variant_id: number;
  name: string;
  price: number;
  qty: number;
  group_id?: number;
  group_name?: string;
}

export interface CartItem {
  cart_id: string; // unique frontend id (variant_id + options)
  product_id: number;
  product_name: string;
  image_url: string | null;
  variant_id: number;
  variant_label: string;
  unit_price: number;
  qty: number;
  options: CartItemOption[];
  comment?: string;
}

export interface CustomerData {
  found: boolean;
  telegram_id?: number | null;
  first_name?: string | null;
  phone?: string | null;
  bonus_balance: number;
  orders_count?: number;
}

export interface PosOrderItemDetail {
  id: number;
  order_id: number;
  variant_id: number;
  product_name: string;
  variant_label: string;
  unit_price: number;
  qty: number;
  subtotal: number;
  is_served: boolean;
}

export interface PosOrder {
  id: number;
  status: string;
  fulfillment_type: string;
  table_number: string | null;
  staff_name: string | null;
  payment_method: string;
  is_paid: boolean;
  total_price: number;
  bonus_spent: number;
  discount_percent?: number;
  comment: string | null;
  contact_phone?: string | null;
  contact_name?: string | null;
  time_str: string;
  items_summary: string;
  cancel_reason?: string | null;
  items?: PosOrderItemDetail[];
}

export interface PosCashOperation {
  id: number;
  staff_name: string;
  operation_type: "cash_in" | "cash_out";
  amount: number;
  reason: string;
  time_str: string;
}

export interface PosShift {
  id: number;
  location_id: number;
  opened_by_name: string;
  closed_by_name?: string | null;
  opened_at_str: string;
  status: "open" | "closed";
  opening_cash: number;
  closing_cash_actual?: number | null;
  closing_cash_expected: number;
  cash_inflow: number;
  cash_outflow: number;
  orders_count: number;
  total_revenue: number;
  cash_revenue: number;
  card_revenue: number;
  bonus_spent_total: number;
  notes?: string | null;
  cash_operations?: PosCashOperation[];
}
