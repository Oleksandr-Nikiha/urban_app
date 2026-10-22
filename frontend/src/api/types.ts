export interface Category {
  id: number;
  name: string;
  icon: string | null;
  parent_id: number | null;
  location_id: number;
  location_name: string;
  sort_order: number;
}

export interface ProductListItem {
  id: number;
  name: string;
  image_url: string | null;
  price_from: number;
  category_id: number;
  category_name: string;
}

export interface ProductVariant {
  id: number;
  label: string;
  weight: string | null;
  price: number;
}

export interface OptionItem {
  variant_id: number;
  name: string;
  price_delta: number;
}

export interface OptionGroup {
  group_id: number;
  name: string;
  min_select: number;
  max_select: number;
  free_count: number;
  items: OptionItem[];
}

export interface ProductDetail {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  variants: ProductVariant[];
  option_groups: OptionGroup[];
}

export interface BonusMeResponse {
  bonus_balance: number;
  total_spent: number;
  cashback_rate: number;
  tier_name: string;
  next_tier_name: string | null;
  next_tier_threshold: number | null;
  amount_to_next_tier: number | null;
}

export interface BonusLedgerItem {
  id: number;
  order_id: number | null;
  amount: number;
  balance_after: number;
  type: "accrual" | "spend" | "manual_adjustment";
  description: string;
  created_at: string;
}

export interface BonusHistoryResponse {
  items: BonusLedgerItem[];
  total: number;
  page: number;
  limit: number;
}

export interface OrderCreateRequest {
  fulfillment_type: "delivery" | "takeaway";
  contact_name: string;
  contact_phone: string;
  payment_method: string;
  bonus_spent?: number;
  comment?: string;
}

export interface OrderCreateResponse {
  id: number;
  status: string;
  total_price: number;
  bonus_spent: number;
  created_at: string;
}

export interface AdminBonusAnalytics {
  total_bonuses_issued: number;
  total_bonuses_spent: number;
  current_total_liability: number;
  active_users_count: number;
  tier_distribution: Record<string, number>;
}

export interface AdminBonusTransactionItem {
  id: number;
  user_id: number;
  user_name: string;
  order_id: number | null;
  amount: number;
  balance_after: number;
  type: string;
  description: string;
  admin_id: number | null;
  created_at: string;
}

export interface AdminBonusTransactionsResponse {
  items: AdminBonusTransactionItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface AdminAdjustBonusRequest {
  amount: number;
  reason: string;
}

export interface AdminAdjustBonusResponse {
  status: string;
  user_id: number;
  previous_balance: number;
  new_balance: number;
  transaction_id: number;
}
