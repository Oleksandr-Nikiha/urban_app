import type { Order } from "@/api/types";
import { haptic } from "@/telegram/sdk";

const getSteps = (fulfillmentType?: string) => [
  { key: "pending_moderation", label: "Прийнято", icon: "📝" },
  { key: "confirmed", label: "Підтверджено", shortMobile: ["Підтвер-", "джено"], icon: "👍" },
  { key: "in_progress", label: "Готується", icon: "👨‍🍳" },
  {
    key: fulfillmentType === "delivery" ? "on_the_way" : "ready",
    label: fulfillmentType === "delivery" ? "В дорозі" : "Готово",
    icon: fulfillmentType === "delivery" ? "🛵" : "🛍️",
  },
  { key: "completed", label: "Виконано", icon: "🎉" },
];

function getStepIndex(status: string) {
  switch (status) {
    case "pending_moderation":
    case "pending":
      return 0;
    case "confirmed":
      return 1;
    case "in_progress":
    case "cooking":
      return 2;
    case "ready":
    case "ready_for_pickup":
    case "on_the_way":
    case "delivering":
      return 3;
    case "completed":
    case "delivered":
      return 4;
    default:
      return 0;
  }
}

interface OrderStatusCardProps {
  order: Order;
  isCancelling: boolean;
  onOpenCancelModal: () => void;
}

export function OrderStatusCard({
  order,
  isCancelling,
  onOpenCancelModal,
}: OrderStatusCardProps) {
  const statusBadge = () => {
    switch (order.status) {
      case "confirmed":
        return {
          text: "Підтверджено",
          subtitle: "Замовлення підтверджено! Ми вже розпочали приготування 🍕✨",
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
        };
      case "cooking":
      case "in_progress":
        return {
          text: "Готується на кухні",
          subtitle: "Ваші страви просто зараз готуються кухарями! 👨‍🍳",
          color: "#3b82f6",
          bg: "rgba(59, 130, 246, 0.12)",
        };
      case "on_the_way":
      case "delivering":
        return {
          text: "Кур'єр у дорозі",
          subtitle: "Кур'єр уже прямує до вас із вашим гарячим замовленням! 🛵💨",
          color: "#0891b2",
          bg: "rgba(6, 182, 212, 0.12)",
        };
      case "ready":
      case "ready_for_pickup":
        return {
          text: order.fulfillment_type === "delivery" ? "Кур'єр у дорозі" : "Готове до видачі",
          subtitle:
            order.fulfillment_type === "delivery"
              ? "Кур'єр уже прямує до вас із вашим гарячим замовленням! 🛵💨"
              : "Ваше замовлення вже чекає на вас у закладі! 🛍️✨",
          color: "#8b5cf6",
          bg: "rgba(139, 92, 246, 0.12)",
        };
      case "delivered":
      case "completed":
        return {
          text: order.status === "delivered" ? "Доставлено" : "Виконано",
          subtitle: "Смачного! Дякуємо, що обираєте Urban Bites.",
          color: "#22c55e",
          bg: "rgba(34, 197, 94, 0.12)",
        };
      case "rejected":
        return {
          text: "Відхилено",
          subtitle:
            "На жаль, замовлення відхилено. Менеджер закладу зателефонує для уточнення деталей.",
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.12)",
        };
      case "cancelled":
        return {
          text: "Скасовано",
          subtitle:
            "Замовлення було скасовано. Якщо у вас виникли запитання, зверніться до закладу.",
          color: "#ef4444",
          bg: "rgba(239, 68, 68, 0.12)",
        };
      case "pending_moderation":
      default:
        return {
          text: "Очікує підтвердження",
          subtitle:
            "Менеджер закладу перевіряє ваше замовлення. Це триває лише кілька хвилин.",
          color: "#eab308",
          bg: "rgba(234, 179, 8, 0.12)",
        };
    }
  };

  const badge = statusBadge();
  const steps = getSteps(order.fulfillment_type);
  const currentStep = getStepIndex(order.status);
  const isNegative = order.status === "rejected" || order.status === "cancelled";

  const getStatusEmoji = () => {
    if (order.status === "rejected") return "😔";
    if (order.status === "cancelled") return "🚫";
    if (order.status === "completed" || order.status === "delivered") return "🎉";
    if (order.status === "on_the_way" || order.status === "delivering") return "🛵";
    if (order.status === "ready" || order.status === "ready_for_pickup") return "🛍️";
    if (order.status === "in_progress" || order.status === "cooking") return "👨‍🍳";
    if (order.status === "confirmed") return "👍";
    return "🍕";
  };

  return (
    <div className="app-card rounded-2xl p-5 text-center transition-all">
      <div className="text-5xl">{getStatusEmoji()}</div>
      <h2 className="mt-3 text-lg font-bold">Замовлення #{order.id}</h2>
      <p className="mt-1 text-xs opacity-75 leading-relaxed max-w-[280px] mx-auto">
        {badge.subtitle}
      </p>

      <div
        className="mt-3.5 inline-block rounded-full px-3.5 py-1 text-xs font-bold"
        style={{ background: badge.bg, color: badge.color }}
      >
        {badge.text}
      </div>

      {/* Інтерактивний степер кроків */}
      {!isNegative && (
        <div className="mt-6 pt-4 border-t" style={{ borderColor: "var(--app-border)" }}>
          <div className="relative w-full">
            <div
              className="absolute left-[10%] right-[10%] top-3 h-0.5 -z-0 overflow-hidden"
              style={{ background: "var(--app-surface-2)" }}
            >
              <div
                className="h-full transition-all duration-500"
                style={{
                  background: "var(--tg-theme-button-color)",
                  width: `${(currentStep / (steps.length - 1)) * 100}%`,
                }}
              />
            </div>

            <div className="grid grid-cols-5 relative z-10">
              {steps.map((step, idx) => {
                const isDone = idx < currentStep;
                const isActive = idx === currentStep;
                return (
                  <div key={step.key} className="flex flex-col items-center gap-1.5 min-w-0">
                    <div
                      className={`h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all shrink-0 ${
                        isActive ? "ring-4 ring-blue-500/20 app-pop" : ""
                      }`}
                      style={{
                        background:
                          isDone || isActive
                            ? "var(--tg-theme-button-color)"
                            : "var(--app-surface-2)",
                        color:
                          isDone || isActive
                            ? "var(--tg-theme-button-text-color)"
                            : "var(--tg-theme-hint-color)",
                      }}
                    >
                      {isDone ? "✓" : idx + 1}
                    </div>
                    <span
                      className="text-[9px] sm:text-[10px] font-semibold transition-opacity text-center leading-[1.15] w-full px-0.5 min-h-[24px] flex flex-col items-center justify-start"
                      style={{
                        opacity: isActive ? 1 : isDone ? 0.85 : 0.45,
                        color: isActive ? "var(--tg-theme-button-color)" : "inherit",
                      }}
                    >
                      {step.shortMobile ? (
                        <>
                          <span className="hidden sm:inline">{step.label}</span>
                          <span className="sm:hidden leading-[1.1]">
                            {step.shortMobile[0]}
                            <br />
                            {step.shortMobile[1]}
                          </span>
                        </>
                      ) : (
                        <span>{step.label}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Кнопка скасування для клієнта */}
      {order.status === "pending_moderation" && (
        <div
          className="mt-5 pt-3.5 border-t flex flex-col items-center gap-1.5"
          style={{ borderColor: "var(--app-border)" }}
        >
          <button
            type="button"
            onClick={() => {
              haptic("light");
              onOpenCancelModal();
            }}
            disabled={isCancelling}
            className="app-press rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5"
            style={{
              color: "#ef4444",
              background: "color-mix(in srgb, #ef4444 10%, transparent)",
            }}
          >
            <span>🚫</span>
            <span>{isCancelling ? "Скасування..." : "Скасувати замовлення"}</span>
          </button>
          <p className="text-[10px] opacity-50">
            Ви можете скасувати замовлення, поки заклад його не підтвердив
          </p>
        </div>
      )}
    </div>
  );
}
