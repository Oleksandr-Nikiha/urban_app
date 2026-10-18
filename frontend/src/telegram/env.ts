// frontend/src/telegram/env.ts
import { isTMA, mockTelegramEnv } from "@telegram-apps/sdk-react";

export function isTelegramWebApp(): boolean {
  if (typeof window === "undefined") return false;
  const tg = (window as unknown as { Telegram?: { WebApp?: { initData?: string } } }).Telegram?.WebApp;
  if (tg && typeof tg.initData === "string" && tg.initData.trim().length > 0) {
    return true;
  }
  // Перевірка наявності tgWebAppData у hash або search (Telegram Web / Desktop / Mobile)
  if (
    window.location.hash.includes("tgWebAppData") ||
    window.location.search.includes("tgWebAppData") ||
    window.location.hash.includes("tgWebAppVersion") ||
    window.location.search.includes("tgWebAppVersion")
  ) {
    return true;
  }
  return false;
}

export function getTelegramStartParam(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Пряма перевірка в об'єкті window.Telegram.WebApp
  try {
    const tg = (
      window as unknown as {
        Telegram?: {
          WebApp?: {
            initDataUnsafe?: { start_param?: string };
            initData?: string;
          };
        };
      }
    )?.Telegram?.WebApp;

    if (tg?.initDataUnsafe?.start_param) {
      return tg.initDataUnsafe.start_param;
    }
    if (tg?.initData) {
      const initParams = new URLSearchParams(tg.initData);
      const p =
        initParams.get("start_param") ||
        initParams.get("startapp") ||
        initParams.get("tgWebAppStartParam");
      if (p) return p;
    }
  } catch {
    /* ignore */
  }

  const parseParamFromQuery = (query: string): string | null => {
    if (!query) return null;
    try {
      const clean = query.replace(/^[#?]/, "");
      const params = new URLSearchParams(clean);

      // Прямі ключі
      const direct =
        params.get("start_param") ||
        params.get("startapp") ||
        params.get("tgWebAppStartParam");
      if (direct) return direct;

      // Прямий order_id
      const orderId = params.get("order_id") || params.get("edit_order");
      if (orderId) return `order_${orderId}`;

      // Перевірка всередині tgWebAppData (Telegram десктоп/мобільний передає всередині нього)
      const rawTgData = params.get("tgWebAppData");
      if (rawTgData) {
        const innerParams = new URLSearchParams(rawTgData);
        const inner =
          innerParams.get("start_param") ||
          innerParams.get("startapp") ||
          innerParams.get("tgWebAppStartParam");
        if (inner) return inner;

        const innerOrderId =
          innerParams.get("order_id") || innerParams.get("edit_order");
        if (innerOrderId) return `order_${innerOrderId}`;
      }
    } catch {
      /* ignore */
    }
    return null;
  };

  // 2. Параметри в window.location.search (?startapp=... або ?tgWebAppData=...)
  if (window.location.search) {
    const res = parseParamFromQuery(window.location.search);
    if (res) return res;
  }

  // 3. Параметри в window.location.hash (#tgWebAppData=... або #startapp=...)
  if (window.location.hash) {
    const hashStr = window.location.hash;
    const res = parseParamFromQuery(hashStr);
    if (res) return res;

    // Обробка складних хеш-роутів на зразок "#/?order_id=3"
    if (hashStr.includes("?")) {
      const resQuery = parseParamFromQuery(hashStr.split("?")[1]);
      if (resQuery) return resQuery;
    }
  }

  return null;
}

const CONSUMED_START_PARAM_KEY = "urban_consumed_start_param";

export function isStartParamConsumed(param?: string | null): boolean {
  if (typeof window === "undefined") return false;
  try {
    const target = param ?? getTelegramStartParam();
    if (!target) return false;
    return sessionStorage.getItem(CONSUMED_START_PARAM_KEY) === target;
  } catch {
    return false;
  }
}

export function markStartParamConsumed(param?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const target = param ?? getTelegramStartParam();
    if (target) {
      sessionStorage.setItem(CONSUMED_START_PARAM_KEY, target);
    }
  } catch {
    /* ignore */
  }
}


export function initTelegramEnv(): void {
  // Блокуємо мокинг у продакшені на рівні збірки
  if (import.meta.env.PROD) {
    return;
  }

  // Не мокаємо Telegram для адмін-панелі на ПК
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/admin")) {
    return;
  }

  // Якщо ми реально в Telegram — перериваємо ініціалізацію моку
  if (isTMA()) {
    return;
  }

  const initDataRaw = import.meta.env.VITE_DEV_INIT_DATA;

  if (!initDataRaw) {
    // У режимі браузера без токена працюємо як звичайний гість
    return;
  }

  // Ініціалізуємо мокове середовище для SDK 3.x тільки за явним запитом
  if (
    typeof window !== "undefined" &&
    !window.location.search.includes("mock") &&
    !window.location.hash.includes("tgWebAppData")
  ) {
    return;
  }

  // Ініціалізуємо мокове середовище для SDK 3.x
  mockTelegramEnv({
    launchParams: {
      tgWebAppData: initDataRaw,
      tgWebAppThemeParams: {
        accentTextColor: '#6ab2f2',
        bgColor: '#17212b',
        buttonColor: '#5288c1',
        buttonTextColor: '#ffffff',
        destructiveTextColor: '#ec3942',
        headerBgColor: '#17212b',
        hintColor: '#708499',
        linkColor: '#6ab3f3',
        secondaryBgColor: '#232e3c',
        sectionBgColor: '#17212b',
        sectionHeaderTextColor: '#6ab3f3',
        subtitleTextColor: '#708499',
        textColor: '#f5f5f5',
      },
      tgWebAppVersion: '7.2',
      tgWebAppPlatform: 'tdesktop',
    }
  });
}