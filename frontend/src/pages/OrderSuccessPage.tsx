import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

import { useCancelOrder, useCart, useOrder, useRepeatOrder } from "@/api/queries";
import { keys } from "@/api/queries/keys";
import { ErrorBox, ScreenTitle, Spinner, formatPrice } from "@/components/ui";
import { WebHeader } from "@/components/WebHeader";
import { useBackButton } from "@/hooks/useBackButton";
import { isTelegramWebApp } from "@/telegram/env";
import { haptic, hapticNotify, showAlert } from "@/telegram/sdk";
import { OrderStatusCard } from "@/components/order/OrderStatusCard";
import { OrderReceiptCard } from "@/components/order/OrderReceiptCard";
import { CancelOrderModal } from "@/components/order/CancelOrderModal";

export function OrderSuccessPage() {
  const navigate = useNavigate();
  const { orderId } = useParams();
  const id = orderId ? parseInt(orderId, 10) : 0;

  useBackButton(() => navigate("/"));

  const qc = useQueryClient();
  const { data: order, isPending, error, refetch } = useOrder(id);
  const { data: cart } = useCart();
  const cancelOrder = useCancelOrder();
  const repeatOrder = useRepeatOrder();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  const handleRepeatOrder = () => {
    haptic("medium");
    repeatOrder.mutate(
      { orderId: id },
      {
        onSuccess: async (res) => {
          hapticNotify("success");
          if (res.unavailable_items && res.unavailable_items.length > 0) {
            await showAlert(
              `Товари додано до кошика за актуальними цінами!\n\nЗверніть увагу: деякі позиції наразі недоступні в меню:\n• ${res.unavailable_items.join("\n• ")}`,
              "Повторення замовлення",
            );
          } else if (res.price_changed) {
            await showAlert(
              `Товари додано до кошика за актуальними цінами!\nНова сума: ${formatPrice(res.new_total)} (було: ${formatPrice(res.old_total)})`,
              "Ціни оновлено",
            );
          }
          navigate("/cart");
        },
        onError: async (err) => {
          hapticNotify("error");
          await showAlert(
            err instanceof Error ? err.message : "Не вдалося повторити замовлення",
            "Помилка",
          );
        },
      }
    );
  };

  const handleConfirmCancel = () => {
    cancelOrder.mutate(order!.id, {
      onSuccess: () => {
        hapticNotify("success");
        setShowCancelModal(false);
      },
      onError: async (err) => {
        hapticNotify("error");
        setShowCancelModal(false);
        await showAlert(
          err instanceof Error ? err.message : "Помилка при скасуванні",
          "Скасування замовлення",
        );
      },
    });
  };

  useEffect(() => {
    if (!order) return;
    if (prevStatusRef.current && prevStatusRef.current !== order.status) {
      void qc.invalidateQueries({ queryKey: keys.orders });
      void qc.invalidateQueries({ queryKey: keys.me });
      void qc.invalidateQueries({ queryKey: ["auth", "bonusHistory"] });

      if (
        order.status === "confirmed" ||
        order.status === "ready" ||
        order.status === "completed" ||
        order.status === "delivered"
      ) {
        hapticNotify("success");
      } else if (order.status === "rejected" || order.status === "cancelled") {
        hapticNotify("error");
      } else {
        haptic("medium");
      }
    }
    prevStatusRef.current = order.status;
  }, [order?.status]);

  if (isPending) return <Spinner />;
  if (error || !order) {
    return (
      <div className="p-4">
        <ErrorBox message={error?.message || "Замовлення не знайдено"} onRetry={() => void refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg pb-8 bg-[var(--tg-theme-bg-color)]">
      <WebHeader title="Статус замовлення" showBack onBack={() => navigate("/")} />
      {isTelegramWebApp() && <ScreenTitle>Статус замовлення</ScreenTitle>}

      <div className="app-rise space-y-4 px-4">
        {/* Головна картка статусу */}
        <OrderStatusCard
          order={order}
          isCancelling={cancelOrder.isPending}
          onOpenCancelModal={() => setShowCancelModal(true)}
        />

        {/* Деталі замовлення (Чек) */}
        <OrderReceiptCard order={order} />

        {/* Підказка щодо оформлення замовлення з іншого закладу */}
        {cart?.items && cart.items.length > 0 && (
          <div
            className="app-card rounded-2xl p-4 space-y-2.5 border"
            style={{
              background: "var(--app-tint)",
              borderColor: "color-mix(in srgb, var(--tg-theme-button-color) 35%, transparent)",
            }}
          >
            <div
              className="flex items-center gap-1.5 font-bold text-xs"
              style={{ color: "var(--tg-theme-button-color)" }}
            >
              <span>🛵</span>
              <span>У кошику ще залишилися страви з іншого закладу</span>
            </div>
            <p className="text-xs leading-relaxed opacity-85">
              Нагадуємо: кожен заклад готує та доставляє замовлення окремим кур'єром.
            </p>
            <button
              onClick={() => {
                haptic("light");
                navigate("/cart");
              }}
              className="app-press w-full rounded-xl py-2.5 text-xs font-bold shadow-sm transition"
              style={{
                background: "var(--tg-theme-button-color)",
                color: "var(--tg-theme-button-text-color)",
              }}
            >
              Перейти до кошика ({cart.items.length}{" "}
              {cart.items.length === 1 ? "страва" : "страви"}) →
            </button>
          </div>
        )}

        {/* Сповіщення в Telegram */}
        <div
          className="rounded-2xl p-3.5 text-xs leading-relaxed"
          style={{ background: "var(--app-surface-2)" }}
        >
          <p className="font-semibold flex items-center gap-1.5">
            <span>💬</span>
            <span>Сповіщення в Telegram</span>
          </p>
          <p className="mt-1 opacity-75">
            Статус замовлення синхронізується автоматично. Ви також отримаєте push-сповіщення у чаті з
            ботом.
          </p>
        </div>

        {/* Кнопка повторити замовлення */}
        <button
          type="button"
          onClick={handleRepeatOrder}
          disabled={repeatOrder.isPending}
          className="app-press w-full rounded-xl py-3.5 font-bold transition flex items-center justify-center gap-2 border"
          style={{
            borderColor: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-color)",
            background: "transparent",
          }}
        >
          <span>🔁</span>
          <span>{repeatOrder.isPending ? "Додаємо до кошика..." : "Повторити це замовлення"}</span>
        </button>

        {/* Кнопка на головну */}
        <button
          onClick={() => {
            haptic("light");
            navigate("/");
          }}
          className="app-press w-full rounded-xl py-3.5 font-bold shadow-md transition"
          style={{
            background: "var(--tg-theme-button-color)",
            color: "var(--tg-theme-button-text-color)",
          }}
        >
          Повернутися до меню
        </button>
      </div>

      {/* Модальне вікно підтвердження скасування */}
      <CancelOrderModal
        orderId={order.id}
        isOpen={showCancelModal}
        isCancelling={cancelOrder.isPending}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
