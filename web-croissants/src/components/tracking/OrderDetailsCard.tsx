import type { OrderOut } from "../../types/order.ts";

export interface OrderDetailsCardProps {
  order: OrderOut;
  pickupAddress?: string;
}

export function OrderDetailsCard({ order, pickupAddress }: OrderDetailsCardProps) {
  const isDelivery = order.fulfillment_type === "delivery";
  const defaultPickupAddress =
    order.source === "web_croissants"
      ? "вул. Велика Васильківська, 24"
      : "вул. Набережна, 12";
  const resolvedPickupAddress = pickupAddress || defaultPickupAddress;

  return (
    <div className="space-y-4">
      {/* Деталі доставки та контакти */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#181B22] border border-white/10 space-y-3.5 text-xs sm:text-sm shadow-lg">
        <div className="text-xs font-bold uppercase tracking-wider text-[#94A3B8] pb-1 border-b border-white/10">
          Інформація про замовлення
        </div>

        <div className="flex justify-between items-start gap-4">
          <span className="text-[#94A3B8] shrink-0">Отримувач:</span>
          <span className="font-bold text-[#F1F5F9] text-right">
            {order.contact_name} •{" "}
            <a
              href={`tel:${order.contact_phone}`}
              className="hover:underline text-[var(--brand-primary,#D34528)]"
            >
              {order.contact_phone}
            </a>
          </span>
        </div>

        <div className="flex justify-between items-start gap-4">
          <span className="text-[#94A3B8] shrink-0">Спосіб:</span>
          <span className="font-bold text-[#F1F5F9] text-right">
            {isDelivery ? (
              <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-950/50 px-2 py-0.5 rounded-md border border-emerald-500/30">
                🛵 Доставка: {order.delivery_address || "м. Київ"}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[var(--brand-primary,#D34528)] bg-[var(--brand-primary,#D34528)]/10 px-2 py-0.5 rounded-md border border-[var(--brand-primary,#D34528)]/30">
                🛍️ Самовивіз: {resolvedPickupAddress}
              </span>
            )}
          </span>
        </div>

        <div className="flex justify-between items-start gap-4">
          <span className="text-[#94A3B8] shrink-0">Час виконання:</span>
          <span className="font-bold text-[#F1F5F9] text-right">
            {order.scheduled_time
              ? `🕒 На бажаний час: ${order.scheduled_time}`
              : "⚡ Якнайшвидше (орієнтовно 35–45 хв)"}
          </span>
        </div>

        <div className="flex justify-between items-start gap-4">
          <span className="text-[#94A3B8] shrink-0">Оплата:</span>
          <span className="font-bold text-[#F1F5F9] text-right">
            {order.payment_method === "cash"
              ? "💵 Готівкою під час отримання"
              : "💳 Банківською карткою"}
          </span>
        </div>

        {order.comment && (
          <div className="pt-2 border-t border-white/10">
            <span className="text-[#94A3B8] block mb-1">Коментар до замовлення:</span>
            <p className="bg-[#121417] p-2.5 rounded-xl border border-white/10 text-[#CBD5E1] italic text-xs">
              «{order.comment}»
            </p>
          </div>
        )}
      </div>

      {/* Склад замовлених страв */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[#181B22] border border-white/10 space-y-3 shadow-lg">
        <div className="flex items-center justify-between pb-1 border-b border-white/10">
          <span className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
            Склад замовлення
          </span>
          <span className="text-xs text-[#94A3B8]">
            {order.groups.reduce((acc, g) => acc + g.items.length, 0)} позицій
          </span>
        </div>

        <div className="divide-y divide-white/5 space-y-0.5">
          {order.groups.flatMap((g) => g.items).map((item) => (
            <div key={item.id} className="py-2.5 flex items-start justify-between gap-3 text-xs sm:text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-bold text-[#F1F5F9]">
                  {item.product_name}
                </div>
                <div className="text-[11px] text-[#94A3B8] mt-0.5">
                  {item.variant_label} • {item.qty} шт × {item.unit_price} ₴
                </div>
                {item.options && item.options.length > 0 && (
                  <div className="text-[11px] text-[var(--brand-primary,#E2A066)] mt-0.5">
                    + {item.options.map((o) => `${o.option_name} (+${o.price_delta} ₴)`).join(", ")}
                  </div>
                )}
              </div>
              <div className="font-extrabold text-[#F1F5F9] shrink-0">
                {item.subtotal} ₴
              </div>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-white/10 flex items-center justify-between font-bold">
          <span className="text-sm text-[#F1F5F9]">Сума до сплати:</span>
          <span className="text-xl text-[var(--brand-primary,#D34528)] font-extrabold">
            {order.total_price} ₴
          </span>
        </div>
      </div>
    </div>
  );
}
