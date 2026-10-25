/**
 * Фірмова палітра темної теми Urban Bites.
 * Застосовується як з !important в CSS, так і динамічно в JS,
 * запобігаючи перебиванню теми нативними клієнтами Telegram.
 */
export const URBAN_THEME_VARS = {
  "--tg-theme-bg-color": "#12161A",
  "--tg-theme-secondary-bg-color": "#1A1F26",
  "--tg-theme-text-color": "#F4F5F7",
  "--tg-theme-hint-color": "#94A3B8",
  "--tg-theme-link-color": "#E05338",
  "--tg-theme-button-color": "#D34528",
  "--tg-theme-button-text-color": "#FFFFFF",
  "--app-surface": "#1A1F26",
  "--app-surface-2": "#242B35",
  "--app-surface-3": "#2E3744",
  "--app-border": "#2E3744",
  "--app-border-focus": "#E05338",
  "--app-veil": "rgba(18, 22, 26, 0.88)",
} as const;

let observerInitialized = false;

/**
 * Негайне встановлення фірмових CSS-змінних на <html>.
 */
export function enforceUrbanTheme(): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;

  for (const [key, value] of Object.entries(URBAN_THEME_VARS)) {
    el.style.setProperty(key, value, "important");
  }

  // Також синхронізуємо color-scheme на html та body
  el.style.colorScheme = "dark";
  if (document.body) {
    document.body.style.backgroundColor = "#12161A";
    document.body.style.color = "#F4F5F7";
    document.body.style.colorScheme = "dark";
  }
}

/**
 * Налаштовує спостерігач (MutationObserver) та перехоплювач подій Telegram,
 * щоб Telegram не міг затерти або скинути брендову тему Urban Bites.
 */
export function initThemeProtection(): void {
  enforceUrbanTheme();

  if (typeof window === "undefined" || observerInitialized) return;
  observerInitialized = true;

  // 1. Слухач нативного Telegram WebApp 'themeChanged'
  try {
    const tg = (window as unknown as {
      Telegram?: {
        WebApp?: {
          onEvent?: (eventType: string, cb: () => void) => void;
          setHeaderColor?: (color: string) => void;
          setBackgroundColor?: (color: string) => void;
        };
      };
    })?.Telegram?.WebApp;

    if (tg?.onEvent) {
      tg.onEvent("themeChanged", () => {
        enforceUrbanTheme();
        try {
          tg.setHeaderColor?.("#12161A");
          tg.setBackgroundColor?.("#12161A");
        } catch { /* ignore */ }
      });
    }
    try {
      tg?.setHeaderColor?.("#12161A");
      tg?.setBackgroundColor?.("#12161A");
    } catch { /* ignore */ }
  } catch { /* ignore */ }

  // 2. MutationObserver на style атрибут <html> для запобігання підміні
  try {
    const el = document.documentElement;
    let isReverting = false;

    const observer = new MutationObserver(() => {
      if (isReverting) return;
      // Перевіряємо, чи якась змінна змінилася від нашого значення
      const currentBg = el.style.getPropertyValue("--tg-theme-bg-color");
      if (currentBg !== "#12161A") {
        isReverting = true;
        enforceUrbanTheme();
        isReverting = false;
      }
    });

    observer.observe(el, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
  } catch { /* ignore */ }
}
