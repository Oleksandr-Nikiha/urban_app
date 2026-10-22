// Типи дзеркалять Pydantic-схеми бекенду (api/src/schemas/).
// При зміні схем на бекенді — оновити тут.

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  /** null = коренева категорія. Дерево дворівневе: корінь → підкатегорія. */
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
  /** Підкатегорія, до якої належить товар — за нею групуємо список у секції. */
  category_id: number;
  category_name: string;
}

export interface ProductVariant {
  id: number;
  label: string;
  weight: string | null;
  price: number;
}

/** Одна позиція в групі опцій. variant_id — те, що відправляємо назад у кошик. */
export interface OptionItem {
  variant_id: number;
  name: string;
  price_delta: number;
}

/**
 * Група опцій товару: «Соус до картоплі», «Напій 0.5 л».
 * min_select/max_select приходять зі звʼязку товар↔група, а не з самої групи:
 * та сама група для хенд-рола це 1 з 3, а для СЕТу — 3 з 3.
 */
export interface OptionGroup {
  group_id: number;
  name: string;
  min_select: number;
  max_select: number;
  /** Скільки порцій у групі безкоштовні: соус до картоплі — перша. */
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

export interface User {
  id: number;
  telegram_id: number;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone: string;
  is_phone_verified?: boolean;
  delivery_address: string | null;
  additional_address?: string | null;
  client_code?: string | null;
  bonus_balance?: number;
  bot_username?: string | null;
  auth_token?: string | null;
}

export interface UserUpdatePayload {
  first_name: string;
  last_name?: string | null;
  phone?: string | null;
  delivery_address?: string | null;
  additional_address?: string | null;
}

export interface RegisterPayload {
  full_name: string;
  phone: string;
  delivery_address: string | null;
}

/** Вибір опції для відправки в кошик. */
export interface OptionSelection {
  group_id: number;
  variant_id: number;
  /** Кілька порцій однієї опції: два кетчупи — це qty = 2, а не два записи. */
  qty: number;
}

export interface CartItemOption {
  group_id: number;
  variant_id: number;
  /** Назва товару-опції: «Кетчуп». */
  name: string;
  /** Мітка варіанта: «0.5 л». Для соусів це «порція» — показуємо не завжди. */
  label: string;
  price_delta: number;
  qty: number;
}

export interface CartItem {
  id: number;
  product_id: number;
  variant_id?: number | null;
  product_name: string;
  variant_label: string;
  weight: string | null;
  price: number;
  qty: number;
  subtotal: number;
  location_id: number;
  location_name: string;
  options: CartItemOption[];
  group_free_count?: Record<number, number>;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

export interface Location {
  id: number;
  name: string;
  address: string;
  phones: string[];
  is_delivery_enabled: boolean;
  delivery_start_time: string;
  delivery_end_time: string;
}

export interface OrderCreatePayload {
  fulfillment_type: "delivery" | "pickup";
  location_id?: number | null;
  delivery_address?: string | null;
  contact_name: string;
  contact_phone: string;
  payment_method: "cash" | "card" | "qr";
  scheduled_time?: string | null;
  comment?: string | null;
  items?: Array<{
    variant_id: number;
    qty: number;
    option_variant_ids?: number[];
  }>;
}

export interface OrderItemOption {
  id: number;
  option_group_name: string;
  option_name: string;
  price_delta: number;
  qty: number;
}

export interface OrderItem {
  id: number;
  variant_id: number | null;
  product_name: string;
  variant_label: string;
  unit_price: number;
  qty: number;
  subtotal: number;
  options: OrderItemOption[];
}

export interface OrderGroup {
  id: number;
  location_id: number;
  location_name: string;
  status: string;
  subtotal: number;
  items: OrderItem[];
}

export interface Order {
  id: number;
  telegram_id: number;
  status: string;
  fulfillment_type: "delivery" | "pickup";
  delivery_address: string | null;
  contact_name: string;
  contact_phone: string;
  payment_method: "cash" | "card" | "qr" | string;
  scheduled_time?: string | null;
  comment: string | null;
  total_price: number;
  created_at: string;
  groups: OrderGroup[];
}

export interface RepeatOrderResponse {
  added_count: number;
  unavailable_items: string[];
  price_changed: boolean;
  old_total: number;
  new_total: number;
}

// --- Адмін-панель ---

export interface AdminMe {
  is_staff: boolean;
  role?: "admin" | "manager" | null;
  location_id?: number | null;
  location_name?: string | null;
}

export interface Manager {
  id: number;
  telegram_id: number;
  full_name: string;
  phone: string;
  role: "admin" | "manager";
  location_id: number | null;
  location_name: string | null;
  is_active: boolean;
}

export interface ManagerCreatePayload {
  telegram_id: number;
  role: "admin" | "manager";
  location_id?: number | null;
}

export interface ManagerUpdatePayload {
  role?: "admin" | "manager";
  location_id?: number | null;
  is_active?: boolean;
}

export interface AdminCategory {
  id: number;
  name: string;
  icon: string | null;
  parent_id: number | null;
  location_id: number;
  location_name?: string | null;
  sort_order: number;
  is_visible: boolean;
  products_count: number;
}

export interface CategoryCreatePayload {
  name: string;
  location_id: number;
  parent_id?: number | null;
  icon?: string | null;
  sort_order?: number;
  is_visible?: boolean;
}

export interface CategoryUpdatePayload {
  name?: string;
  location_id?: number;
  parent_id?: number | null;
  icon?: string | null;
  sort_order?: number;
  is_visible?: boolean;
}

export interface AdminVariant {
  id: number;
  product_id: number;
  label: string;
  price: number;
  weight: string | null;
  sort_order: number;
  is_available: boolean;
}

export interface VariantCreatePayload {
  label: string;
  price: number;
  weight?: string | null;
  sort_order?: number;
  is_available?: boolean;
}

export interface VariantUpdatePayload {
  label?: string;
  price?: number;
  weight?: string | null;
  sort_order?: number;
  is_available?: boolean;
}

export interface ProductOptionGroupAdmin {
  product_id: number;
  group_id: number;
  group_name: string;
  min_select: number;
  max_select: number;
  free_count: number;
  sort_order: number;
}

export interface AdminProduct {
  id: number;
  name: string;
  category_id: number;
  category_name?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  description: string | null;
  image?: string | null;
  image_url: string | null;
  sort_order: number;
  is_available: boolean;
  variants: AdminVariant[];
  option_groups: ProductOptionGroupAdmin[];
}

export interface ProductCreatePayload {
  name: string;
  category_id: number;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  sort_order?: number;
  is_available?: boolean;
  variants?: VariantCreatePayload[];
}

export interface ProductUpdatePayload {
  name?: string;
  category_id?: number;
  description?: string | null;
  image?: string | null;
  image_url?: string | null;
  sort_order?: number;
  is_available?: boolean;
}

export interface AvailabilityPayload {
  is_available: boolean;
}

// --- Додатки (Групи опцій) ---

export interface AdminOptionGroup {
  id: number;
  name: string;
  sort_order: number;
  items_count: number;
  products_count: number;
}

export interface OptionGroupCreatePayload {
  name: string;
  sort_order?: number;
}

export interface OptionGroupUpdatePayload {
  name?: string;
  sort_order?: number;
}

export interface AdminOptionGroupItem {
  group_id: number;
  variant_id: number;
  product_id: number;
  product_name: string;
  variant_label: string;
  price_delta: number;
  sort_order: number;
  is_available: boolean;
}

export interface OptionGroupItemCreatePayload {
  variant_id: number;
  price_delta?: number;
  sort_order?: number;
  is_available?: boolean;
}

export interface OptionGroupItemUpdatePayload {
  price_delta?: number;
  sort_order?: number;
  is_available?: boolean;
}

export interface ProductOptionGroupAttachPayload {
  group_id: number;
  min_select?: number;
  max_select?: number;
  free_count?: number;
  sort_order?: number;
}

export interface ProductOptionGroupUpdatePayload {
  min_select?: number;
  max_select?: number;
  free_count?: number;
  sort_order?: number;
}

export interface BulkAvailabilityPayload {
  product_ids: number[];
  is_available: boolean;
}

export interface BulkOptionGroupPayload {
  action: "attach" | "detach" | "replace" | "clear";
  product_ids: number[];
  group_id?: number | null;
  min_select?: number;
  max_select?: number;
  free_count?: number;
  groups?: ProductOptionGroupAttachPayload[] | null;
}


export interface VariantSelectorChoice {
  variant_id: number;
  product_id: number;
  product_name: string;
  variant_label: string;
  price: number;
  category_name?: string | null;
}

export interface LocationDeliverySettings {
  id: number;
  name: string;
  address: string;
  is_delivery_enabled: boolean;
  delivery_start_time: string;
  delivery_end_time: string;
}

export interface LocationDeliveryUpdatePayload {
  is_delivery_enabled?: boolean;
  delivery_start_time?: string;
  delivery_end_time?: string;
}

// --- Довідник адрес доставки та адресний стоплист ---

export interface DeliveryAddress {
  id: number;
  city: string;
  street: string;
}

export interface AdminDeliveryAddress {
  id: number;
  city: string;
  street: string;
  is_active: boolean;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface DeliveryAddressCreatePayload {
  city?: string;
  street: string;
  is_active?: boolean;
  notes?: string | null;
  sort_order?: number;
}

export interface DeliveryAddressUpdatePayload {
  city?: string;
  street?: string;
  is_active?: boolean;
  notes?: string | null;
  sort_order?: number;
}

// --- Керування користувачами (Адмінка) ---

export interface AdminUser {
  id: number;
  telegram_id: number | null;
  full_name: string;
  phone: string;
  delivery_address: string | null;
  is_blocked: boolean;
  is_phone_verified?: boolean;
  admin_note: string | null;
  orders_count: number;
  created_at: string;
}

export interface AdminUserUpdatePayload {
  is_blocked?: boolean;
  admin_note?: string | null;
  is_phone_verified?: boolean;
}

// --- Керування та редагування замовлень (Адмінка) ---

export interface AdminOrderItemOption {
  id: number;
  option_group_name: string;
  option_name: string;
  price_delta: number;
  qty: number;
}

export interface AdminOrderItem {
  id: number;
  order_group_id: number;
  variant_id: number | null;
  product_name: string;
  variant_label: string;
  unit_price: number;
  qty: number;
  subtotal: number;
  options: AdminOrderItemOption[];
}

export interface AdminOrderGroup {
  id: number;
  order_id: number;
  location_id: number;
  location_name?: string | null;
  status: string;
  subtotal: number;
  items: AdminOrderItem[];
}

export interface AdminOrderListItem {
  id: number;
  telegram_id?: number | null;
  status: string;
  fulfillment_type: string;
  delivery_address: string | null;
  contact_name: string;
  contact_phone: string;
  payment_method: string;
  scheduled_time: string | null;
  comment: string | null;
  total_price: number;
  created_at: string;
  items_summary: string;
  location_id: number | null;
  location_name: string | null;
  user_is_blocked: boolean;
  user_admin_note: string | null;
  source?: string | null;
}

export interface AdminOrderDetail {
  id: number;
  telegram_id?: number | null;
  status: string;
  fulfillment_type: string;
  delivery_address: string | null;
  contact_name: string;
  contact_phone: string;
  payment_method: string;
  scheduled_time: string | null;
  comment: string | null;
  total_price: number;
  created_at: string;
  user_is_blocked: boolean;
  user_admin_note: string | null;
  source?: string | null;
  groups: AdminOrderGroup[];
}

export interface AdminOrderUpdatePayload {
  scheduled_time?: string | null;
  status?: string;
  delivery_address?: string | null;
  contact_name?: string;
  contact_phone?: string;
  comment?: string | null;
  items?: {
    variant_id?: number | null;
    product_name: string;
    variant_label: string;
    unit_price: number;
    qty: number;
    options: {
      option_group_name: string;
      option_name: string;
      price_delta: number;
      qty: number;
    }[];
  }[];
}

// --- Аналітика та статистика (Фаза 5.1) ---

export interface AnalyticsKPI {
  revenue: number;
  orders_count: number;
  avg_order_value: number;
  customers_count: number;
}

export interface AnalyticsStatusBreakdown {
  status: string;
  count: number;
  total_amount: number;
}

export interface AnalyticsFulfillmentBreakdown {
  fulfillment_type: string;
  count: number;
  total_amount: number;
}

export interface AnalyticsPaymentBreakdown {
  payment_method: string;
  count: number;
  total_amount: number;
}

export interface AnalyticsLocationBreakdown {
  location_id: number;
  location_name: string;
  orders_count: number;
  revenue: number;
}

export interface AnalyticsDynamicsPoint {
  date: string;
  orders_count: number;
  revenue: number;
}

export interface AnalyticsSummary {
  period: string;
  kpi: AnalyticsKPI;
  by_status: AnalyticsStatusBreakdown[];
  by_fulfillment: AnalyticsFulfillmentBreakdown[];
  by_payment: AnalyticsPaymentBreakdown[];
  by_location: AnalyticsLocationBreakdown[];
  dynamics: AnalyticsDynamicsPoint[];
}

export interface AnalyticsTopProduct {
  product_name: string;
  variant_label: string;
  total_qty: number;
  total_revenue: number;
}

// --- Маркетингові розсилки (Фаза 5.2) ---

export type BroadcastSegment = "all" | "active_30d" | "inactive" | "top_orders";

export interface BroadcastCreatePayload {
  title: string;
  text: string;
  image_url?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  segment: BroadcastSegment;
}

export interface Broadcast {
  id: number;
  author_id: number;
  author_name?: string | null;
  title: string;
  text: string;
  image_url?: string | null;
  button_text?: string | null;
  button_url?: string | null;
  segment: BroadcastSegment;
  status: "sending" | "completed" | "failed";
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
  completed_at?: string | null;
}

export interface BroadcastRecipientsCount {
  segment: string;
  count: number;
}

