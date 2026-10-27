import { retrieveRawInitData } from "@telegram-apps/sdk-react";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "/urban-bites/api";

/** Помилка з HTTP-статусом — щоб UI міг відрізнити 401 від 404 і мережевого збою. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly detail: string,
  ) {
    super(detail);
    this.name = "ApiError";
  }
}

/**
 * Бекенд не має окремої авторизації: особу він дістає з підписаного initData.
 * Тож заголовок чіпляємо до кожного запиту — публічні ендпоінти його просто ігнорують.
 */
export function getRawInitData(): string | null {
  try {
    const raw = retrieveRawInitData();
    if (raw) return raw;
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
    if (tg?.initData) return tg.initData;

    // Fallback: витягуємо tgWebAppData з hash або search (якщо SDK ще не ініціалізував об'єкт)
    if (window.location.hash) {
      try {
        const hp = new URLSearchParams(window.location.hash.replace(/^#\/?/, ""));
        const data = hp.get("tgWebAppData");
        if (data) return data;
      } catch {}
    }
    if (window.location.search) {
      try {
        const sp = new URLSearchParams(window.location.search);
        const data = sp.get("tgWebAppData");
        if (data) return data;
      } catch {}
    }
  }
  return null;
}


export const USER_TOKEN_KEY = "urban_user_token";

export function getUserToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(USER_TOKEN_KEY);
}

export function setUserToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_TOKEN_KEY, token);
}

export function removeUserToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USER_TOKEN_KEY);
}

export function hasTelegramAuth(): boolean {
  return Boolean(getRawInitData()) || Boolean(getUserToken());
}

export const ADMIN_TOKEN_KEY = "urban_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
}

export function removeAdminToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function hasAdminAuth(): boolean {
  return Boolean(getAdminToken()) || hasTelegramAuth();
}

function authHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const raw = getRawInitData();
  if (raw) {
    headers["X-Telegram-Init-Data"] = raw;
  }
  const userToken = getUserToken();
  if (userToken) {
    headers["X-Auth-Token"] = userToken;
    if (!headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${userToken}`;
    }
  }
  const adminToken = getAdminToken();
  if (adminToken) {
    headers["X-Admin-Token"] = adminToken;
    headers["Authorization"] = `Bearer ${adminToken}`;
  }
  return headers;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...authHeaders(),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401 && (path.startsWith("/admin") || path.startsWith("/api/admin"))) {
      removeAdminToken();
    }
    // FastAPI віддає помилку як {"detail": "..."} або як список помилок валідації
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
      else if (Array.isArray(body?.detail)) detail = body.detail[0]?.msg ?? detail;
    } catch {
      /* тіло не JSON — лишаємо статус */
    }
    throw new ApiError(res.status, detail);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
