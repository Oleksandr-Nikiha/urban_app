import { useEffect, useState } from "react";
import { fetchWebOrder } from "../api/client.ts";
import { useModalBehavior } from "../hooks/useModalBehavior.ts";
import type { OrderOut } from "../types/order.ts";
import { OrderDetailsCard } from "./tracking/OrderDetailsCard.tsx";
import { OrderTimeline } from "./tracking/OrderTimeline.tsx";

export const LAST_ORDER_STORAGE_KEY = "urban_last_order_id";
export const ORDERS_HISTORY_STORAGE_KEY = "urban_orders_history";

interface OrderTrackingModalProps {
  orderId: number | null;
  initialOrder?: OrderOut | null;
  isOpen: boolean;
  onClose: () => void;
  isNewlyCreated?: boolean;
}

export function OrderTrackingModal({
  orderId: propOrderId,
  initialOrder,
  isOpen,
  onClose,
  isNewlyCreated = false,
}: OrderTrackingModalProps) {
  useModalBehavior({ isOpen, onClose });

  const [currentOrderId, setCurrentOrderId] = useState<number | null>(
    propOrderId || initialOrder?.id || null,
  );
  const [order, setOrder] = useState<OrderOut | null>(initialOrder || null);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchIdInput, setSearchIdInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [recentOrderIds, setRecentOrderIds] = useState<number[]>([]);

  // Синхронізація при зміні пропсів
  useEffect(() => {
    if (propOrderId) {
      setCurrentOrderId(propOrderId);
    } else if (initialOrder) {
      setCurrentOrderId(initialOrder.id);
      setOrder(initialOrder);
    }
  }, [propOrderId, initialOrder]);

  // Завантаження локальної історії замовлень
  useEffect(() => {
    if (!isOpen) return;
    try {
      const savedHist = JSON.parse(
        localStorage.getItem(ORDERS_HISTORY_STORAGE_KEY) || "[]",
      );
      if (Array.isArray(savedHist)) {
        setRecentOrderIds(savedHist);
      }
    } catch {}
  }, [isOpen]);

  // Завантаження замовлення при відкритті або зміні ID
  useEffect(() => {
    if (!isOpen || !currentOrderId) return;

    let isMounted = true;

    if (!order || order.id !== currentOrderId) {
      setLoading(true);
      setError(null);
    }

    fetchWebOrder(currentOrderId)
      .then((data) => {
        if (!isMounted) return;
        setOrder(data);
        setError(null);
        try {
          localStorage.setItem(LAST_ORDER_STORAGE_KEY, String(data.id));
          const savedHist = JSON.parse(
            localStorage.getItem(ORDERS_HISTORY_STORAGE_KEY) || "[]",
          );
          const updated = Array.from(
            new Set([data.id, ...(Array.isArray(savedHist) ? savedHist : [])]),
          ).slice(0, 10);
          localStorage.setItem(ORDERS_HISTORY_STORAGE_KEY, JSON.stringify(updated));
          setRecentOrderIds(updated);
        } catch {}
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Не вдалося знайти замовлення");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, currentOrderId]);

  // Автоматичне опитування кожні 12 секунд для активних замовлень
  useEffect(() => {
    if (!isOpen || !currentOrderId || !order) return;

    if (["completed", "cancelled", "rejected"].includes(order.status)) {
      return;
    }

    const interval = setInterval(() => {
      fetchWebOrder(currentOrderId)
        .then((updated) => {
          setOrder(updated);
        })
        .catch(() => {});
    }, 12000);

    return () => clearInterval(interval);
  }, [isOpen, currentOrderId, order]);

  // Ручне оновлення статусу
  const handleManualRefresh = async () => {
    if (!currentOrderId || isRefreshing) return;
    setIsRefreshing(true);
    try {
      const data = await fetchWebOrder(currentOrderId);
      setOrder(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Помилка оновлення");
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // Пошук іншого замовлення за введеним номером
  const handleSearchOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(searchIdInput.trim().replace(/^#/, ""), 10);
    if (!parsed || isNaN(parsed)) return;
    setCurrentOrderId(parsed);
    setSearchIdInput("");
  };

  // Копіювання посилання на трекінг
  const handleCopyLink = () => {
    if (!order) return;
    const trackingUrl = `${window.location.origin}${window.location.pathname}?order=${order.id}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(trackingUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    } else {
      window.prompt("Скопіюйте посилання на відстеження:", trackingUrl);
    }
  };

  if (!isOpen) return null;

  const isDelivery = order?.fulfillment_type === "delivery";

  // Визначення кроку та опису статусу
  const getStepData = (status: string, isDeliv: boolean) => {
    if (status === "cancelled" || status === "rejected") {
      return {
        stepIndex: -1,
        isCancelled: true,
        title: "Замовлення скасовано ❌",
        desc: "На жаль, замовлення було скасовано або відхилено. Якщо у вас є запитання, зателефонуйте менеджеру.",
        badge: "bg-red-950/40 text-red-300 border-red-500/30",
      };
    }

    if (status === "completed") {
      return {
        stepIndex: 4,
        isCompleted: true,
        title: isDeliv ? "Замовлення доставлено! 🎉" : "Замовлення видано! 🎉",
        desc: "Дякуємо, що обираєте Urban Pizza & Sushi! Бажаємо смачного та чудового настрою!",
        badge: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
      };
    }

    if (status === "on_the_way" || status === "delivering") {
      return {
        stepIndex: 3,
        title: "Кур'єр уже в дорозі 🛵💨",
        desc: "Ваша гаряча піца та свіжі роли прямують за вказаною адресою в термосумці.",
        badge: "bg-amber-950/40 text-amber-300 border-amber-500/30",
      };
    }

    if (status === "ready" || status === "ready_for_pickup") {
      return {
        stepIndex: 3,
        title: isDeliv
          ? "Спаковано та чекає кур'єра 🛍️"
          : "Замовлення готове до видачі! 🛍️",
        desc: isDeliv
          ? "Страви свіжоприготовані та чекають передачі в доставку."
          : "Завітайте до нашого закладу: м. Київ, вул. Набережна, 12.",
        badge: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30",
      };
    }

    if (status === "in_progress" || status === "cooking") {
      return {
        stepIndex: 2,
        title: "Готується на кухні 👨‍🍳🔥",
        desc: "Наші піцайоло та сушисти готують ваше замовлення прямо зараз.",
        badge: "bg-orange-950/40 text-orange-300 border-orange-500/30",
      };
    }

    if (status === "confirmed") {
      return {
        stepIndex: 1,
        title: "Замовлення підтверджено ✅",
        desc: "Пекарня підтвердила деталі та готується до випікання страв своєчасно.",
        badge: "bg-sky-950/40 text-sky-300 border-sky-500/30",
      };
    }

    return {
      stepIndex: 0,
      title: "Очікує підтвердження пекарні ⏳",
      desc: "Замовлення надійшло до системи. Менеджер бере його в роботу.",
      badge: "bg-amber-950/40 text-amber-300 border-amber-500/30",
    };
  };

  const stepsList = isDelivery
    ? [
        { label: "Прийнято", icon: "📋" },
        { label: "Підтверджено", icon: "✅" },
        { label: "Готується", icon: "👨‍🍳" },
        { label: "У дорозі", icon: "🛵" },
        { label: "Доставлено", icon: "🎉" },
      ]
    : [
        { label: "Прийнято", icon: "📋" },
        { label: "Підтверджено", icon: "✅" },
        { label: "Готується", icon: "👨‍🍳" },
        { label: "Готово", icon: "🛍️" },
        { label: "Видано", icon: "🎉" },
      ];

  const currentStepInfo = order ? getStepData(order.status, isDelivery) : null;

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString("uk-UA", {
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#14171E] rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-white/10 z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200">
        {/* Хедер модалки */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#181B22]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl sm:text-3xl">📦</span>
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-[#F1F5F9]">
                {order ? `Замовлення #${order.id}` : "Відстеження замовлення"}
              </h2>
              <p className="text-xs text-[#94A3B8]">
                {order ? `Створено: ${formatDate(order.created_at)}` : "Перевірка статусу наживо"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {order && (
              <button
                type="button"
                onClick={handleManualRefresh}
                title="Оновити статус"
                disabled={isRefreshing}
                className="w-9 h-9 rounded-full bg-[#1F232B] hover:bg-[#252A34] text-[#F1F5F9] border border-white/10 flex items-center justify-center font-bold text-sm cursor-pointer shadow-sm active:scale-95 transition-transform"
              >
                <span className={isRefreshing ? "animate-spin" : ""}>🔄</span>
              </button>
            )}
            <button
              onClick={onClose}
              type="button"
              aria-label="Закрити"
              className="w-9 h-9 rounded-full bg-[#1F232B] hover:bg-[#252A34] text-[#F1F5F9] border border-white/10 flex items-center justify-center font-bold text-sm cursor-pointer shadow-sm active:scale-95 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Тіло модалки */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 overscroll-contain">
          {/* Святковий банер для щойно створеного замовлення */}
          {isNewlyCreated && order && (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-3 shadow-sm animate-in zoom-in-95 duration-300">
              <span className="text-2xl shrink-0">🎉</span>
              <div className="space-y-1">
                <div className="font-bold text-sm sm:text-base text-emerald-200">
                  Дякуємо! Замовлення успішно передано до пекарні
                </div>
                <p className="text-emerald-400 text-xs leading-relaxed">
                  Кухня вже отримала сповіщення. Ви можете слідкувати за приготуванням та доставкою прямо на цій сторінці.
                </p>
              </div>
            </div>
          )}

          {/* Індикатор завантаження або помилка */}
          {loading && !order && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
              <div className="w-10 h-10 border-3 border-[#D34528] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-semibold text-[#94A3B8]">
                Завантажуємо інформацію про замовлення...
              </p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-300 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
              <p className="text-xs text-red-400">
                Перевірте правильність номера замовлення або введіть інший нижче:
              </p>
              <form onSubmit={handleSearchOrder} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Введіть номер, наприклад: 42"
                  value={searchIdInput}
                  onChange={(e) => setSearchIdInput(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-red-500/40 bg-[#121417] text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-red-400"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-red-600 text-white font-bold text-xs rounded-xl hover:bg-red-700 transition-colors cursor-pointer"
                >
                  Знайти
                </button>
              </form>
            </div>
          )}

          {order && currentStepInfo && (
            <>
              {/* Хід виконання (Timeline) */}
              <OrderTimeline currentStepInfo={currentStepInfo} stepsList={stepsList} />

              {/* Деталізація замовлення */}
              <OrderDetailsCard order={order} />

              {/* Швидкі дії */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full bg-[#181B22] hover:bg-[#1E232B] text-[#F1F5F9] border border-white/10 py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all active:scale-98 flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>{copied ? "✅" : "🔗"}</span>
                  <span>{copied ? "Скопійовано!" : "Скопіювати лінк"}</span>
                </button>

                <a
                  href="tel:+380671127733"
                  className="w-full bg-[#D34528] hover:bg-[#B83820] text-white py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm transition-all active:scale-98 flex items-center justify-center gap-2 shadow-lg shadow-[#D34528]/20 cursor-pointer"
                >
                  <span>📞</span>
                  <span>Подзвонити в заклад</span>
                </a>
              </div>
            </>
          )}

          {recentOrderIds.length > 1 && (
            <div className="pt-4 border-t border-white/10 space-y-2">
              <span className="text-[11px] font-bold text-[#94A3B8] uppercase tracking-wider block">
                Ваші недавні замовлення:
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {recentOrderIds.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCurrentOrderId(id)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                      currentOrderId === id
                        ? "bg-[#D34528] text-white shadow-sm"
                        : "bg-[#1E232B] hover:bg-[#252A34] text-[#CBD5E1] border border-white/10"
                    }`}
                  >
                    #{id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Форма швидкого пошуку іншого замовлення */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs text-[#94A3B8]">
            <span>Потрібно відстежити інше замовлення?</span>
            <form onSubmit={handleSearchOrder} className="flex gap-1.5">
              <input
                type="text"
                placeholder="# замовлення"
                value={searchIdInput}
                onChange={(e) => setSearchIdInput(e.target.value)}
                className="w-24 px-2 py-1 text-xs rounded-lg border border-white/10 bg-[#121417] text-[#F1F5F9] placeholder:text-[#64748B] focus:outline-none focus:border-[#D34528]/60"
              />
              <button
                type="submit"
                className="px-2.5 py-1 bg-[#1F232B] hover:bg-[#252A34] text-[#CBD5E1] hover:text-white border border-white/10 rounded-lg font-bold text-[11px] cursor-pointer transition-colors"
              >
                Знайти
              </button>
            </form>
          </div>
        </div>

        {/* Футер модалки */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-white/10 bg-[#181B22] flex justify-end">
          <button
            onClick={onClose}
            type="button"
            className="w-full sm:w-auto bg-[#1F232B] hover:bg-[#252A34] text-[#F1F5F9] border border-white/10 py-2.5 px-6 rounded-xl font-bold text-sm shadow-sm transition-transform active:scale-95 cursor-pointer"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
