const API_BASE = "/urban-bites/api";
import type {
  Category,
  DeliveryAddress,
  LocationInfo,
  ProductDetail,
  ProductListItem,
} from "../types/catalog.ts";
import type { OrderOut, WebOrderCreatePayload } from "../types/order.ts";

export const CROISSANTS_LOCATION_ID = 2;

export const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80";

export function getImageUrl(path: string | null | undefined): string {
  if (!path) return DEFAULT_PRODUCT_IMAGE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api/")) return path.replace(/^\/api/, API_BASE);
  if (path.startsWith("/uploads/")) return `${API_BASE}${path}`;
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

export async function fetchCategories(locationId: number = CROISSANTS_LOCATION_ID): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories?location_id=${locationId}`);
  if (!res.ok) throw new Error("Не вдалося завантажити категорії");
  return res.json();
}

export async function fetchProductsByCategory(categoryId: number): Promise<ProductListItem[]> {
  const res = await fetch(`${API_BASE}/categories/${categoryId}/products`);
  if (!res.ok) throw new Error("Не вдалося завантажити страви категорії");
  return res.json();
}

export async function fetchProductDetail(productId: number): Promise<ProductDetail> {
  const res = await fetch(`${API_BASE}/products/${productId}`);
  if (!res.ok) throw new Error("Не вдалося завантажити інформацію про страву");
  return res.json();
}

export async function fetchLocationInfo(locationId: number = CROISSANTS_LOCATION_ID): Promise<LocationInfo | null> {
  const res = await fetch(`${API_BASE}/locations`);
  if (!res.ok) throw new Error("Не вдалося завантажити інформацію про заклад");
  const list: LocationInfo[] = await res.json();
  return list.find((loc) => loc.id === locationId) || list[0] || null;
}

export async function fetchDeliveryAddresses(city: string = "Київ"): Promise<DeliveryAddress[]> {
  const res = await fetch(`${API_BASE}/delivery/addresses?city=${encodeURIComponent(city)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function submitWebOrder(payload: WebOrderCreatePayload): Promise<OrderOut> {
  const res = await fetch(`${API_BASE}/orders/web`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Не вдалося оформити замовлення");
  }

  return res.json();
}

export async function fetchWebOrder(orderId: number): Promise<OrderOut> {
  const res = await fetch(`${API_BASE}/orders/web/${orderId}`);
  if (!res.ok) throw new Error("Замовлення не знайдено");
  return res.json();
}

export async function fetchWebOrdersHistory(
  params: { phone?: string; telegramId?: number } | string,
): Promise<OrderOut[]> {
  try {
    let query = "";
    if (typeof params === "string") {
      if (!params) return [];
      query = `phone=${encodeURIComponent(params)}`;
    } else {
      const parts: string[] = [];
      if (params.phone) parts.push(`phone=${encodeURIComponent(params.phone)}`);
      if (params.telegramId) parts.push(`telegram_id=${params.telegramId}`);
      if (parts.length === 0) return [];
      query = parts.join("&");
    }

    const res = await fetch(`${API_BASE}/orders/web/history?${query}`);
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export interface TelegramWidgetUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

export interface UserOut {
  id: number;
  telegram_id?: number | null;
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  phone: string;
  delivery_address?: string | null;
  additional_address?: string | null;
  is_phone_verified: boolean;
  bonus_balance: number;
  client_code: string;
  bot_username?: string;
}

export async function authTelegramWidget(user: TelegramWidgetUser): Promise<UserOut> {
  const res = await fetch(`${API_BASE}/auth/telegram-widget`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(user),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Не вдалося авторизуватися через Telegram");
  }
  return res.json();
}

export interface WebProfileUpdatePayload {
  telegram_id?: number | null;
  phone?: string | null;
  full_name?: string | null;
  delivery_address?: string | null;
  additional_address?: string | null;
  bonus_balance?: number | null;
}

export async function fetchWebProfile(params: {
  telegram_id?: number | null;
  phone?: string | null;
}): Promise<UserOut | null> {
  const parts: string[] = [];
  if (params.telegram_id) parts.push(`telegram_id=${params.telegram_id}`);
  if (params.phone) parts.push(`phone=${encodeURIComponent(params.phone)}`);
  if (parts.length === 0) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/web-profile?${parts.join("&")}`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function updateWebProfile(payload: WebProfileUpdatePayload): Promise<UserOut> {
  const res = await fetch(`${API_BASE}/auth/web-profile`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Не вдалося зберегти профіль на сервері");
  }
  return res.json();
}

export async function authPhoneLogin(payload: {
  phone: string;
  full_name?: string;
  telegram_id?: number | null;
}): Promise<UserOut> {
  const res = await fetch(`${API_BASE}/auth/phone-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || "Не вдалося увійти за номером телефону");
  }
  return res.json();
}




