const API_BASE = "/urban-bites/api";
import type { DeliveryAddress } from "../types/catalog.ts";
import type { OrderOut } from "../types/order.ts";

export async function fetchDeliveryAddresses(city: string = "Київ"): Promise<DeliveryAddress[]> {
  const res = await fetch(`${API_BASE}/delivery/addresses?city=${encodeURIComponent(city)}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchWebOrdersHistory(
  params:
    | {
        phone?: string;
        telegramId?: number;
        telegram_id?: number | null;
        local_order_ids?: number[];
      }
    | string,
): Promise<OrderOut[]> {
  try {
    let query = "";
    if (typeof params === "string") {
      if (!params) return [];
      query = `phone=${encodeURIComponent(params)}`;
    } else {
      const parts: string[] = [];
      if (params.phone) parts.push(`phone=${encodeURIComponent(params.phone)}`);
      const tgId = params.telegramId ?? params.telegram_id;
      if (tgId) parts.push(`telegram_id=${tgId}`);
      if (params.local_order_ids && params.local_order_ids.length > 0) {
        parts.push(`order_ids=${params.local_order_ids.join(",")}`);
      }
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
  first_name?: string | null;
  last_name?: string | null;
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

