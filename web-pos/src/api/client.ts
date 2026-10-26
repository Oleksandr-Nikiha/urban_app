import type {
  Category,
  CreateOrderPayload,
  CustomerData,
  PosCashOperationPayload,
  PosCloseTablePayload,
  PosOrder,
  PosOrderItemPayload,
  PosShiftClosePayload,
  PosShiftOpenPayload,
  StaffMember,
} from "../types";

export type { CreateOrderPayload };

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/urban-bites/api";

export const DEFAULT_PRODUCT_IMAGE =
  "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80";

export function getImageUrl(path: string | null | undefined): string {
  if (!path) return DEFAULT_PRODUCT_IMAGE;
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  if (path.startsWith("/api/")) return path.replace(/^\/api/, API_BASE);
  if (path.startsWith("/uploads/")) return `${API_BASE}${path}`;
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

export async function fetchStaffList(): Promise<StaffMember[]> {
  const res = await fetch(`${API_BASE}/pos/staff`);
  if (!res.ok) throw new Error("Не вдалося завантажити список персоналу");
  return res.json();
}

export async function authByPin(
  pin: string,
  staffId?: number
): Promise<{ token: string; staff: StaffMember }> {
  const res = await fetch(`${API_BASE}/pos/auth/pin`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pin, staff_id: staffId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка авторизації" }));
    throw new Error(err.detail || "Невірний PIN-код");
  }
  return res.json();
}

export async function fetchMenu(locationId: number): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/pos/menu?location_id=${locationId}`);
  if (!res.ok) throw new Error("Не вдалося завантажити меню закладу");
  return res.json();
}

export async function lookupCustomer(query: string): Promise<CustomerData> {
  const res = await fetch(`${API_BASE}/pos/customer?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Помилка пошуку гостя");
  return res.json();
}

export async function registerCustomer(
  phone: string,
  name?: string
): Promise<{ success: boolean; message: string; customer: CustomerData }> {
  const res = await fetch(`${API_BASE}/pos/customer/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, name: name || "Client" }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка реєстрації гостя" }));
    throw new Error(err.detail || "Не вдалося зареєструвати гостя");
  }
  return res.json();
}

export async function createPosOrder(payload: CreateOrderPayload) {
  const res = await fetch(`${API_BASE}/pos/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка створення замовлення" }));
    throw new Error(err.detail || "Не вдалося зберегти замовлення");
  }
  return res.json();
}

export async function toggleItemServed(itemId: number) {
  const res = await fetch(`${API_BASE}/pos/order-items/${itemId}/toggle-served`, {
    method: "PATCH",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка зміни статусу страви" }));
    throw new Error(err.detail || "Не вдалося змінити статус страви");
  }
  return res.json();
}

export async function addItemsToOrder(
  orderId: number,
  items: PosOrderItemPayload[]
) {
  const res = await fetch(`${API_BASE}/pos/orders/${orderId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка додавання страв" }));
    throw new Error(err.detail || "Не вдалося додати страви");
  }
  return res.json();
}

export async function closeTableOrder(
  orderId: number,
  payload: PosCloseTablePayload
) {
  const res = await fetch(`${API_BASE}/pos/orders/${orderId}/close-table`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка закриття столу" }));
    throw new Error(err.detail || "Не вдалося закрити стіл");
  }
  return res.json();
}

export async function fetchPosOrders(locationId: number): Promise<PosOrder[]> {
  const res = await fetch(`${API_BASE}/pos/orders?location_id=${locationId}`);
  if (!res.ok) throw new Error("Не вдалося завантажити замовлення");
  return res.json();
}

export async function updateOrderStatus(orderId: number, statusVal: string) {
  const res = await fetch(`${API_BASE}/pos/orders/${orderId}/status?status_val=${statusVal}`, {
    method: "PATCH",
  });
  if (!res.ok) throw new Error("Не вдалося змінити статус замовлення");
  return res.json();
}

export async function removeOrderItem(orderId: number, itemId: number) {
  const res = await fetch(`${API_BASE}/pos/orders/${orderId}/items/${itemId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка видалення страви" }));
    throw new Error(err.detail || "Не вдалося видалити страву");
  }
  return res.json();
}

export async function updateOrderItemQty(orderId: number, itemId: number, qty: number) {
  const res = await fetch(`${API_BASE}/pos/orders/${orderId}/items/${itemId}/qty`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ qty }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка зміни кількості" }));
    throw new Error(err.detail || "Не вдалося змінити кількість");
  }
  return res.json();
}

export async function cancelPosOrder(orderId: number, reason: string, staffName?: string) {
  const res = await fetch(`${API_BASE}/pos/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, staff_name: staffName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка скасування замовлення" }));
    throw new Error(err.detail || "Не вдалося скасувати замовлення");
  }
  return res.json();
}

export async function fetchCurrentShift(locationId: number) {
  const res = await fetch(`${API_BASE}/pos/shifts/current?location_id=${locationId}`);
  if (!res.ok) throw new Error("Помилка завантаження зміни");
  return res.json();
}

export async function openPosShift(payload: PosShiftOpenPayload) {
  const res = await fetch(`${API_BASE}/pos/shifts/open`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка відкриття зміни" }));
    throw new Error(err.detail || "Не вдалося відкрити зміну");
  }
  return res.json();
}

export async function addCashOperation(payload: PosCashOperationPayload) {
  const res = await fetch(`${API_BASE}/pos/shifts/cash-op`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка операції з готівкою" }));
    throw new Error(err.detail || "Не вдалося виконати операцію з готівкою");
  }
  return res.json();
}

export async function closePosShift(payload: PosShiftClosePayload) {
  const res = await fetch(`${API_BASE}/pos/shifts/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Помилка закриття зміни" }));
    throw new Error(err.detail || "Не вдалося закрити зміну");
  }
  return res.json();
}
