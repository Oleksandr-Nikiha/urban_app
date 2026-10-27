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

export interface ProductOptionItem {
  variant_id: number;
  name: string;
  price_delta: number;
}

export interface ProductOptionGroup {
  group_id: number;
  name: string;
  min_select: number;
  max_select: number;
  free_count: number;
  items: ProductOptionItem[];
}

export interface ProductDetail {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  variants: ProductVariant[];
  option_groups: ProductOptionGroup[];
}

export interface LocationInfo {
  id: number;
  name: string;
  address: string;
  phones: string[];
  is_delivery_enabled: boolean;
  delivery_start_time: string;
  delivery_end_time: string;
}

export interface DeliveryAddress {
  id: number;
  city: string;
  street: string;
}

