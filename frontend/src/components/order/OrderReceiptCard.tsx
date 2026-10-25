import type { Order, OrderGroup, OrderItem, OrderItemOption } from "@/api/types";
import { formatPrice } from "@/components/ui";

interface OrderReceiptCardProps {
  order: Order;
}

export function OrderReceiptCard({ order }: OrderReceiptCardProps) {
  return (
    <div className="app-card rounded-2xl p-4 space-y-2.5 text-xs">
      <p
        className="font-bold text-[13px] pb-1 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        Деталі чека
      </p>

      <div
        className="flex justify-between py-1 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <span className="opacity-60">Заклад</span>
        <span className="font-semibold">{order.groups[0]?.location_name || "Urban Bites"}</span>
      </div>
      <div
        className="flex justify-between py-1 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <span className="opacity-60">Спосіб</span>
        <span className="font-semibold">
          {order.fulfillment_type === "delivery" ? "🛵 Доставка кур'єром" : "🛍️ Самовивіз"}
        </span>
      </div>
      <div
        className="flex justify-between py-1 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <span className="opacity-60">Час</span>
        <span className="font-semibold">
          {order.scheduled_time ? `⏰ На ${order.scheduled_time}` : "⚡ Якнайшвидше"}
        </span>
      </div>
      {order.fulfillment_type === "delivery" && order.delivery_address && (
        <div
          className="flex justify-between py-1 border-b"
          style={{ borderColor: "var(--app-border)" }}
        >
          <span className="opacity-60">Адреса</span>
          <span className="font-semibold text-right max-w-[65%]">{order.delivery_address}</span>
        </div>
      )}
      <div
        className="flex justify-between py-1 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <span className="opacity-60">Отримувач</span>
        <span className="font-semibold">
          {order.contact_name} ({order.contact_phone})
        </span>
      </div>
      <div
        className="flex justify-between py-1 border-b"
        style={{ borderColor: "var(--app-border)" }}
      >
        <span className="opacity-60">Оплата</span>
        <span className="font-semibold">
          {order.payment_method === "cash"
            ? "💵 Готівка"
            : order.payment_method === "card"
              ? "💳 Термінал (картка)"
              : order.payment_method === "qr"
                ? "📱 QR-код у чеку"
                : order.payment_method}
        </span>
      </div>
      {order.comment && (
        <div
          className="flex justify-between py-1 border-b"
          style={{ borderColor: "var(--app-border)" }}
        >
          <span className="opacity-60">Коментар</span>
          <span className="italic max-w-[65%] text-right opacity-80">{order.comment}</span>
        </div>
      )}

      {/* Список страв */}
      <div className="pt-2 space-y-1.5">
        <p className="font-bold opacity-60 uppercase text-[10px] tracking-wider">
          Страви у замовленні:
        </p>
        {order.groups
          .flatMap((g: OrderGroup) => g.items)
          .map((item: OrderItem) => (
            <div key={item.id} className="flex justify-between text-xs py-1">
              <div className="truncate pr-2">
                <span className="font-medium">• {item.product_name}</span>
                <span className="opacity-60">
                  {" "}
                  ({item.variant_label}) × {item.qty}
                </span>
                {item.options.length > 0 && (
                  <span className="opacity-60 block pl-2 text-[11px]">
                    ↳ {item.options.map((o: OrderItemOption) => o.option_name).join(", ")}
                  </span>
                )}
              </div>
              <span className="font-bold shrink-0">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
      </div>

      <div
        className="flex justify-between pt-3 text-sm font-extrabold border-t"
        style={{ borderColor: "var(--app-border)" }}
      >
        <div>
          <span>Разом до сплати</span>
          {order.bonus_earned && order.bonus_earned > 0 ? (
            <div className="text-[11px] text-emerald-400 font-semibold mt-0.5">
              +{order.bonus_earned} бонусів нараховано
            </div>
          ) : null}
        </div>
        <div className="text-right">
          <span className="text-base text-[var(--tg-theme-button-color)]">
            {formatPrice(order.total_price)}
          </span>
          {order.bonus_spent && order.bonus_spent > 0 ? (
            <div className="text-[11px] text-amber-400 font-medium">
              Оплачено бонусами: -{order.bonus_spent} б.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
