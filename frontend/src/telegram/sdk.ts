import {
  backButton,
  closingBehavior,
  hapticFeedback,
  init,
  miniApp,
  popup,
  requestContact,
  swipeBehavior,
  themeParams,
  viewport,
} from "@telegram-apps/sdk-react";

/**
 * Обгортки над SDK, які не падають поза Telegram.
 *
 * Mini App має працювати і в звичайному браузері (розробка, дебаг), а там
 * половини нативних можливостей немає. Тому кожен виклик — best effort:
 * не вийшло змонтувати кнопку чи смикнути вібрацію — не привід валити застосунок.
 */

let ready = false;

/**
 * Прибирає порожні --tg-theme-* зі стилю <html>.
 *
 * Не всі клієнти Telegram надсилають повний набір параметрів теми (найчастіше
 * бракує secondary_bg_color). SDK усе одно прив'язує змінну — з порожнім
 * значенням. Інлайн перебиває наш дефолт із index.css, а підстановка порожнечі
 * робить усю декларацію background недійсною: на темній темі плашки під
 * текстом просто зникають. Знімаємо такі змінні, щоб спрацював дефолт.
 */
function dropEmptyThemeVars(): void {
  const el = document.documentElement;
  for (let i = el.style.length - 1; i >= 0; i--) {
    const name = el.style[i];
    if (name.startsWith("--tg-theme-") && !el.style.getPropertyValue(name).trim()) {
      el.style.removeProperty(name);
    }
  }
}

/**
 * Застосовує фірмову урбаністичну колірну схему Urban Bites
 * замість стандартного синього кольору Telegram.
 */
function applyUrbanBrandTheme(): void {
  const el = document.documentElement;
  el.style.setProperty("--tg-theme-bg-color", "#12161A");
  el.style.setProperty("--tg-theme-secondary-bg-color", "#1A1F26");
  el.style.setProperty("--tg-theme-text-color", "#F4F5F7");
  el.style.setProperty("--tg-theme-hint-color", "#94A3B8");
  el.style.setProperty("--tg-theme-link-color", "#E05338");
  el.style.setProperty("--tg-theme-button-color", "#D34528");
  el.style.setProperty("--tg-theme-button-text-color", "#FFFFFF");
  el.style.setProperty("--app-surface", "#1A1F26");
  el.style.setProperty("--app-surface-2", "#242B35");
  el.style.setProperty("--app-surface-3", "#2E3744");
  el.style.setProperty("--app-border", "#2E3744");
  el.style.setProperty("--app-veil", "rgba(18, 22, 26, 0.88)");

  try {
    const headerColor = "#12161A";
    if (miniApp.setHeaderColor.isAvailable()) {
      miniApp.setHeaderColor(headerColor as `#${string}`);
    }
    if (miniApp.setBackgroundColor.isAvailable()) {
      miniApp.setBackgroundColor(headerColor as `#${string}`);
    }
  } catch { /* ignore */ }
}


export function initSdk(): void {
  // Негайно застосовуємо фірмову колірну схему Urban Bites, запобігаючи асинхронній гонці
  applyUrbanBrandTheme();

  if (ready) return;

  // Сповіщаємо Telegram (як нативний клієнт, так і iframe у web.telegram.org)
  // що застосунок готовий, не чекаючи можливих винятків від sdk-react:
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } })
      ?.Telegram?.WebApp;
    tg?.ready?.();
    tg?.expand?.();
  } catch { /* ignore */ }
  try {
    if (typeof window !== "undefined" && window.parent && window.parent !== window) {
      window.parent.postMessage(JSON.stringify({ eventType: "web_app_ready", eventData: "" }), "*");
      window.parent.postMessage(JSON.stringify({ eventType: "web_app_expand", eventData: "" }), "*");
    }
  } catch { /* ignore */ }

  try {
    init();
    if (miniApp.mountSync.isAvailable()) {
      miniApp.mountSync();
    }
    try {
      if (miniApp.ready.isAvailable()) {
        miniApp.ready();
      }
    } catch { /* ignore */ }
    // Безпечна прив'язка теми без гонки станів: перевірка наявності методів та асинхронний fallback
    try {
      if (themeParams.mountSync.isAvailable()) {
        themeParams.mountSync();
      } else if (themeParams.mount.isAvailable()) {
        void themeParams.mount().then(() => {
          if (themeParams.bindCssVars.isAvailable() && !themeParams.isCssVarsBound?.()) {
            themeParams.bindCssVars();
          }
          dropEmptyThemeVars();
          applyUrbanBrandTheme();
        }).catch(() => {});
      }

      if (themeParams.bindCssVars.isAvailable() && !themeParams.isCssVarsBound?.()) {
        themeParams.bindCssVars();
      }
      dropEmptyThemeVars();
      applyUrbanBrandTheme();

      if (themeParams.state?.sub) {
        themeParams.state.sub(() => {
          dropEmptyThemeVars();
          applyUrbanBrandTheme();
        });
      }
    } catch {
      applyUrbanBrandTheme();
    }

    if (viewport.mount.isAvailable()) {
      void viewport.mount().then(() => {
        if (viewport.bindCssVars.isAvailable()) viewport.bindCssVars();
      }).catch(() => {});
    }
    try {
      if (swipeBehavior.mount.isAvailable()) {
        swipeBehavior.mount();
        if (swipeBehavior.disableVertical.isAvailable()) {
          swipeBehavior.disableVertical();
        }
      }
    } catch { /* swipeBehavior недоступний у звичайному браузері */ }
    try {
      if (closingBehavior.mount.isAvailable()) {
        closingBehavior.mount();
        if (closingBehavior.enableConfirmation.isAvailable()) {
          closingBehavior.enableConfirmation();
        }
      }
    } catch { /* closingBehavior недоступний у звичайному браузері */ }
    ready = true;
  } catch {
    // Поза Telegram і без моку — працюємо як звичайний веб-застосунок
  }
}

/**
 * Показує нативний попап Telegram (alert) або fallback на window.alert у браузері.
 */
export async function showAlert(message: string, title?: string): Promise<void> {
  try {
    if (popup.open.isAvailable()) {
      await popup.open({
        title,
        message,
        buttons: [{ id: "ok", type: "ok" }],
      });
      return;
    }
  } catch { /* ignore */ }

  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { showAlert?: (msg: string, cb?: () => void) => void } } })
      ?.Telegram?.WebApp;
    if (tg?.showAlert) {
      await new Promise<void>((resolve) => tg.showAlert!(message, resolve));
      return;
    }
  } catch { /* ignore */ }

  if (typeof window !== "undefined") {
    window.alert(title ? `${title}\n\n${message}` : message);
  }
}

/**
 * Показує нативний діалог підтвердження Telegram (confirm) або fallback на window.confirm.
 */
export async function showConfirm(message: string, title?: string): Promise<boolean> {
  try {
    if (popup.open.isAvailable()) {
      const buttonId = await popup.open({
        title,
        message,
        buttons: [
          { id: "ok", type: "ok" },
          { id: "cancel", type: "cancel" },
        ],
      });
      return buttonId === "ok";
    }
  } catch { /* ignore */ }

  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { showConfirm?: (msg: string, cb?: (res: boolean) => void) => void } } })
      ?.Telegram?.WebApp;
    if (tg?.showConfirm) {
      return await new Promise<boolean>((resolve) => tg.showConfirm!(message, (res) => resolve(Boolean(res))));
    }
  } catch { /* ignore */ }

  if (typeof window !== "undefined") {
    return window.confirm(title ? `${title}\n\n${message}` : message);
  }
  return false;
}

/** Нативна кнопка «Назад» у шапці Telegram. Повертає функцію відписки. */
export function showBackButton(onClick: () => void): () => void {
  try {
    if (!backButton.mount.isAvailable()) return () => {};
    backButton.mount();
    backButton.show();
    const off = backButton.onClick(onClick);
    return () => {
      off();
      try { backButton.hide(); } catch { /* вже розмонтовано */ }
    };
  } catch {
    return () => {};
  }
}

export function hideBackButton(): void {
  try { if (backButton.isMounted()) backButton.hide(); } catch { /* ignore */ }
}

/** Тактильний відгук на дії: додати в кошик, +/−, видалити. */
export function haptic(style: "light" | "medium" | "heavy" = "light"): void {
  try {
    if (hapticFeedback.impactOccurred.isAvailable()) {
      hapticFeedback.impactOccurred(style);
      return;
    }
  } catch { /* ignore */ }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const ms = style === "heavy" ? 25 : style === "medium" ? 15 : 8;
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
}

export function hapticNotify(type: "error" | "success" | "warning"): void {
  try {
    if (hapticFeedback.notificationOccurred.isAvailable()) {
      hapticFeedback.notificationOccurred(type);
      return;
    }
  } catch { /* ignore */ }
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const pattern = type === "error" ? [30, 40, 30] : [15, 30];
    try { navigator.vibrate(pattern); } catch { /* ignore */ }
  }
}

/** Відкриває посилання в Telegram (чат бота, канал тощо) */
export function openTelegramLink(url: string): void {
  try {
    const tg = (window as unknown as { Telegram?: { WebApp?: { openTelegramLink?: (url: string) => void } } })
      ?.Telegram?.WebApp;
    if (tg?.openTelegramLink) {
      tg.openTelegramLink(url);
      return;
    }
  } catch {
    /* ignore */
  }
  window.open(url, "_blank");
}

/** Закриває Telegram Mini App фрейм */
export function closeMiniApp(): void {
  try {
    const tg = (window as unknown as {
      Telegram?: {
        WebApp?: {
          close?: () => void;
          disableClosingConfirmation?: () => void;
        };
      };
    })?.Telegram?.WebApp;
    if (tg) {
      tg.disableClosingConfirmation?.();
      tg.close?.();
      return;
    }
  } catch {
    /* ignore */
  }
  try {
    if (closingBehavior.disableConfirmation.isAvailable()) {
      closingBehavior.disableConfirmation();
    }
  } catch {
    /* ignore */
  }
  try {
    if (miniApp.close.isAvailable()) {
      miniApp.close();
    }
  } catch {
    /* ignore */
  }
}

/**
 * Запитує нативний контакт у Telegram Mini App (Bot API 6.9+).
 * Спочатку пробує @telegram-apps/sdk requestContact(), потім window.Telegram.WebApp.requestContact().
 * Повертає номер телефону (string), true (успішно надіслано боту), false (користувач скасував),
 * або null (якщо клієнт не підтримує нативний метод).
 */
export async function requestTelegramContact(): Promise<string | boolean | null> {
  // 1. Спроба через @telegram-apps/sdk-react
  try {
    if (requestContact.isAvailable()) {
      const result = await requestContact();
      if (result?.contact?.phone_number) {
        return result.contact.phone_number;
      }
      return true;
    }
  } catch (err: unknown) {
    const errStr = String(err);
    if (
      errStr.includes("AccessDenied") ||
      errStr.includes("denied") ||
      errStr.includes("cancel") ||
      errStr.includes("User denied")
    ) {
      return false;
    }
    /* fallback to window.Telegram below */
  }

  // 2. Спроба через window.Telegram.WebApp.requestContact
  try {
    const tg = (window as unknown as {
      Telegram?: {
        WebApp?: {
          isVersionAtLeast?: (ver: string) => boolean;
          requestContact?: (cb: (shared: boolean) => void) => void;
        };
      };
    })?.Telegram?.WebApp;

    if (
      tg?.requestContact &&
      (typeof tg.isVersionAtLeast === "function" ? tg.isVersionAtLeast("6.9") : true)
    ) {
      return await new Promise<boolean>((resolve) => {
        try {
          tg.requestContact!((shared: boolean) => {
            resolve(Boolean(shared));
          });
        } catch {
          resolve(false);
        }
      });
    }
  } catch {
    /* ignore */
  }

  return null;
}


