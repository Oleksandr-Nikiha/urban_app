import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, api, setAdminToken } from "@/api/client";
import { TelegramLoginWidget, type TelegramUser } from "@/components/auth/TelegramLoginWidget";
import { Spinner } from "@/components/ui";
import { isTelegramWebApp } from "@/telegram/env";
import { haptic, openTelegramLink } from "@/telegram/sdk";

interface AuthSessionResponse {
  session_id: string;
  bot_url: string;
  tg_url?: string;
  code?: string;
  expires_in?: number;
}

interface AuthStatusResponse {
  status: "pending" | "approved" | "rejected" | "expired";
  token?: string;
  error?: string;
}

interface AdminTokenResponse {
  token: string;
  telegram_id: number;
  name?: string;
  role: string;
  location_id?: number | null;
}

function isMobileOrTablet(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isMobileUA = /Android|webOS|iPhone|iPad|IEMobile|Opera Mini/i.test(ua);
  const isIPad = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  return isMobileUA || isIPad;
}

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AuthSessionResponse | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(false);
  const [isWebAppChecking, setIsWebAppChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualToken, setManualToken] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);
  const [showQrFallback, setShowQrFallback] = useState(false);
  const [isWidgetAuthenticating, setIsWidgetAuthenticating] = useState(false);

  const [copied, setCopied] = useState(false);

  // Якщо відкривається у Telegram WebApp з валідним initData -> авто-вхід
  useEffect(() => {
    if (!isTelegramWebApp()) {
      return;
    }

    const tryAutoWebAppAuth = async () => {
      setIsWebAppChecking(true);
      setError(null);
      try {
        const res = await api.post<AdminTokenResponse>("/admin/auth/telegram-webapp");
        if (res.token) {
          setAdminToken(res.token);
          navigate("/" + window.location.search, { replace: true });
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 403) {
          setError("У доступі відмовлено: ваш Telegram-акаунт не має прав адміністратора.");
        } else {
          // Якщо автоматичний вхід не пройшов, залишаємо можливість ручного входу
          console.warn("Помилка автоматичної авторизації WebApp:", err);
        }
      } finally {
        setIsWebAppChecking(false);
      }
    };

    void tryAutoWebAppAuth();
  }, [navigate]);

  // Створюємо нову сесію для QR-коду (завантажується у фоні)
  const initSession = async () => {
    setIsLoadingSession(true);
    try {
      const res = await api.post<AuthSessionResponse>("/admin/auth/session");
      setSession(res);
    } catch (err) {
      console.warn("Не вдалося створити сесію для QR-коду:", err);
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    void initSession();
  }, []);

  // Авторизація через офіційний Telegram Login Widget у браузері
  const handleWidgetAuth = async (user: TelegramUser) => {
    setIsWidgetAuthenticating(true);
    setError(null);
    try {
      const res = await api.post<AdminTokenResponse>("/admin/auth/telegram-widget", user);
      if (res.token) {
        setAdminToken(res.token);
        navigate("/" + window.location.search, { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.detail
          : "Помилка перевірки авторизації Telegram. Спробуйте ще раз.",
      );
    } finally {
      setIsWidgetAuthenticating(false);
    }
  };

  const extractBotUsername = (url: string): string => {
    try {
      const match = url.match(/t\.me\/([^/?]+)/);
      const parsed = match ? match[1] : "ncoffee_app_tst_bot";
      return parsed === "domapizza_bot" ? "ncoffee_app_tst_bot" : parsed;
    } catch {
      return "ncoffee_app_tst_bot";
    }
  };

  const handleCopyCode = async () => {
    if (!session?.code) return;
    try {
      await navigator.clipboard.writeText(session.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const botUsername = session ? extractBotUsername(session.bot_url) : "ncoffee_app_tst_bot";
  const startParam = session?.code ? `admin_${session.code}` : (session ? `admin_${session.session_id}` : "");
  const webBotUrl = `https://t.me/${botUsername}?start=${startParam}`;
  const appBotUrl = session?.tg_url || `tg://resolve?domain=${botUsername}&start=${startParam}`;

  const handleQrClick = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    haptic("light");

    if (isTelegramWebApp()) {
      openTelegramLink(webBotUrl);
      return;
    }

    try {
      window.location.href = appBotUrl;
      setTimeout(() => {
        window.location.href = webBotUrl;
      }, 1500);
    } catch {
      window.location.href = webBotUrl;
    }
  };

  // Опитуємо статус сесії (якщо відкритий фолбек QR-коду)
  useEffect(() => {
    if (!session?.session_id) return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await api.get<AuthStatusResponse>(
          `/admin/auth/session/${session.session_id}`,
        );

        if (!active) return;

        if (res.status === "approved" && res.token) {
          clearInterval(interval);
          setAdminToken(res.token);
          navigate("/" + window.location.search, { replace: true });
        } else if (res.status === "rejected" || res.status === "expired") {
          clearInterval(interval);
          setError(
            res.error || (res.status === "expired" ? "Час дії сесії вичерпано" : "Вхід відхилено"),
          );
        }
      } catch {
        // ігноруємо помилки опитування
      }
    }, 2000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [session?.session_id, navigate]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const token = manualToken.trim();
    if (!token) return;
    setAdminToken(token);
    navigate("/" + window.location.search, { replace: true });
  };

  const isMobile = isMobileOrTablet();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 text-zinc-100 antialiased">
      {/* Кнопка повернення до меню */}
      {isTelegramWebApp() && (
        <div className="mb-4 flex w-full max-w-md items-center justify-between">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="app-press inline-flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <span>← 🍽️</span>
            <span>До меню ресторану</span>
          </button>
        </div>
      )}

      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/90 p-8 shadow-2xl backdrop-blur-xl">
        {/* Логотип */}
        <div className="flex flex-col items-center text-center">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="Urban Bites"
            className="h-16 w-16 rounded-2xl shadow-inner object-cover border border-amber-500/20"
          />
          <h1 className="mt-4 text-2xl font-bold tracking-tight">Urban Bites Admin</h1>

          <p className="mt-1 text-xs text-zinc-400">
            Панель керування меню та закладами
          </p>
        </div>

        {/* Основний вміст */}
        <div className="mt-8 space-y-6">
          {isWebAppChecking || isWidgetAuthenticating ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Spinner />
              <p className="mt-3 text-xs text-zinc-400">
                {isWidgetAuthenticating
                  ? "Перевірка облікового запису адміністратора..."
                  : "Авторизація через Telegram WebApp..."}
              </p>
            </div>
          ) : (
            <div className="space-y-5 text-center">
              {error && (
                <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-center animate-in fade-in">
                  <p className="text-sm font-semibold text-rose-400">{error}</p>
                </div>
              )}

              {/* Telegram Login Widget — основний швидкий спосіб входу */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 text-center shadow-inner">
                <p className="text-xs font-semibold text-blue-300">
                  Швидкий вхід через Telegram
                </p>
                <p className="mt-1 text-[11px] text-zinc-400">
                  Авторизація адміністратора в 1 клік
                </p>
                <div className="mt-4 flex justify-center min-h-[44px] items-center">
                  <TelegramLoginWidget
                    botName={botUsername}
                    onAuth={handleWidgetAuth}
                    buttonSize="large"
                    cornerRadius={20}
                  />
                </div>
              </div>

              {/* Альтернатива: QR-код або перехід у бот */}
              <div className="pt-1">
                {!showQrFallback ? (
                  <button
                    type="button"
                    onClick={() => setShowQrFallback(true)}
                    className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                  >
                    <span>📷 Вхід за QR-кодом або кодом сесії</span>
                    <span>↓</span>
                  </button>
                ) : (
                  <div className="space-y-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4 animate-in fade-in">
                    <div className="text-xs text-zinc-400">
                      <p className="font-medium text-zinc-200">Вхід за QR-кодом або кодом</p>
                      <p className="mt-1 leading-relaxed">
                        {isMobile
                          ? "Натисніть на QR-код для переходу в бот або надішліть код."
                          : "Відскануйте QR-код камерою телефону або надішліть код боту."}
                      </p>
                    </div>

                    {isLoadingSession ? (
                      <div className="py-8 flex justify-center">
                        <Spinner />
                      </div>
                    ) : session ? (
                      <>
                        {/* QR код */}
                        {isMobile || isTelegramWebApp() ? (
                          <button
                            type="button"
                            onClick={handleQrClick}
                            className="app-press mx-auto block h-40 w-40 rounded-2xl border-2 border-blue-500/50 bg-white p-2 shadow-lg transition-transform active:scale-95 hover:border-blue-400 cursor-pointer"
                            title="Натисніть для переходу в Telegram"
                          >
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                                webBotUrl,
                              )}&size=160x160&margin=0`}
                              alt="QR-код для входу"
                              className="h-full w-full rounded-xl object-contain pointer-events-none select-none"
                            />
                          </button>
                        ) : (
                          <div className="mx-auto flex h-40 w-40 items-center justify-center rounded-2xl border border-zinc-800 bg-white p-2 shadow-inner">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                                webBotUrl,
                              )}&size=160x160&margin=0`}
                              alt="QR-код для входу"
                              className="h-full w-full rounded-xl object-contain pointer-events-none select-none"
                            />
                          </div>
                        )}

                        {/* Блок з 6-значним кодом */}
                        {session.code && (
                          <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2.5 text-center">
                            <p className="text-[11px] text-zinc-400">
                              Код для бота{" "}
                              <a
                                href={`https://t.me/${botUsername}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-blue-400 hover:underline"
                              >
                                @{botUsername}
                              </a>
                              :
                            </p>
                            <div className="mt-1 flex items-center justify-center gap-3">
                              <span className="font-mono text-lg font-bold tracking-widest text-amber-400">
                                {session.code}
                              </span>
                              <button
                                type="button"
                                onClick={() => void handleCopyCode()}
                                className="rounded-lg bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-300 hover:bg-zinc-700 transition-colors"
                              >
                                {copied ? "✓ Скопійовано" : "Скопіювати"}
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Індикатор очікування */}
                        <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 pt-1">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                          </span>
                          <span>Очікуємо підтвердження у боті...</span>
                        </div>
                      </>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Вхід за токеном вручну */}
          <div className="border-t border-zinc-800/80 pt-4 text-center">
            {!showManualInput ? (
              <button
                type="button"
                onClick={() => setShowManualInput(true)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Ввести токен доступу вручну
              </button>
            ) : (
              <form onSubmit={handleManualSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Вставте admin token"
                  value={manualToken}
                  onChange={(e) => setManualToken(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={!manualToken.trim()}
                  className="w-full rounded-xl bg-zinc-800 py-2.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50 cursor-pointer"
                >
                  Увійти за токеном
                </button>
              </form>
            )}
          </div>
        </div>
      </div>

      {!isTelegramWebApp() && (
        <div className="mt-4 text-center">
          <p className="text-xs text-zinc-500">
            Клієнтське меню та замовлення доступні виключно через{" "}
            <a
              href={`https://t.me/${botUsername}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:underline inline-flex items-center gap-1 font-medium"
            >
              <span>Telegram-бот</span>
              <span>↗</span>
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
