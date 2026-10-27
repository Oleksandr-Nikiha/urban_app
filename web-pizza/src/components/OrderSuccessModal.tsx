import { useEffect, useState } from "react";
import { fetchWebOrder } from "../api/client.ts";
import { useModalBehavior } from "../hooks/useModalBehavior.ts";
import type { OrderOut } from "../types/order.ts";

export interface OrderSuccessModalProps {
  order: OrderOut;
  onClose: () => void;
  brandTitle?: string;
  brandPhone?: string;
  brandPhoneFormatted?: string;
  pickupAddress?: string;
}

export function OrderSuccessModal({
  order: initialOrder,
  onClose,
  brandTitle,
  brandPhone,
  brandPhoneFormatted,
  pickupAddress,
}: OrderSuccessModalProps) {
  useModalBehavior({ isOpen: true, onClose });
  const [order, setOrder] = useState<OrderOut>(initialOrder);

  // Періодичне опитування стану замовлення
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (order.status !== "completed" && order.status !== "cancelled") {
      interval = setInterval(() => {
        fetchWebOrder(order.id)
          .then((updated) => {
            setOrder(updated);
          })
          .catch(() => {});
      }, 10000);
    }
    return () => clearInterval(interval);
  }, [order.id, order.status]);

  const isCroissants =
    order.source === "web_croissants" ||
    (brandTitle && /croissant|bakery|пекарн/i.test(brandTitle));

  const resolvedBrandTitle =
    brandTitle || (isCroissants ? "Urban Bakery & Coffee" : "Urban Pizza & Sushi");
  const resolvedBrandPhone =
    brandPhone || (isCroissants ? "+380442220022" : "+380931127733");
  const resolvedBrandPhoneFormatted =
    brandPhoneFormatted ||
    (isCroissants ? "+380 (44) 222-00-22" : "+380 93 112 77 33");
  const resolvedPickupAddress =
    pickupAddress ||
    (isCroissants
      ? "вул. Велика Васильківська, 24"
      : "вул. Набережна, 12");

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "created":
        return { text: "Очікує підтвердження", color: "bg-amber-950/40 text-amber-300 border-amber-500/30" };
      case "confirmed":
        return { text: "Підтверджено кухнею", color: "bg-sky-950/40 text-sky-300 border-sky-500/30" };
      case "in_progress":
      case "cooking":
        return { text: "Готується на кухні", color: "bg-orange-950/40 text-orange-300 border-orange-500/30" };
      case "ready":
        return { text: "Готово до видачі", color: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30" };
      case "delivering":
        return { text: "Кур'єр уже в дорозі", color: "bg-indigo-950/40 text-indigo-300 border-indigo-500/30" };
      case "completed":
        return { text: "Виконано", color: "bg-emerald-950/40 text-emerald-300 border-emerald-500/30" };
      default:
        return { text: st, color: "bg-[#1E232B] text-[#CBD5E1] border-white/10" };
    }
  };

  const statusInfo = getStatusBadge(order.status);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-[#14171E] rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] overflow-y-auto shadow-2xl border border-white/10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 text-[#F1F5F9]">
        <div className="p-6 sm:p-8 text-center space-y-6">
          <div className="w-20 h-20 rounded-full bg-emerald-950/40 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center text-4xl mx-auto shadow-sm">
            🎉
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[#F1F5F9]">
              Замовлення #{order.id} прийнято!
            </h2>
            <p className="text-sm text-[#94A3B8] max-w-xs mx-auto">
              Дякуємо! Сповіщення вже надіслано на кухню {resolvedBrandTitle}.
            </p>
          </div>

          {/* Статус */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-xs sm:text-sm font-bold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-current animate-ping" />
            <span className={`px-2 py-0.5 rounded-full border ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>

          {/* Короткі деталі замовлення */}
          <div className="p-4 bg-[#181B22] rounded-2xl border border-white/10 text-left space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Отримувач:</span>
              <span className="font-bold text-[#F1F5F9]">{order.contact_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Телефон:</span>
              <span className="font-bold text-[#F1F5F9]">{order.contact_phone}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Спосіб:</span>
              <span className="font-bold text-[#F1F5F9]">
                {order.fulfillment_type === "delivery"
                  ? `🛵 Доставка: ${order.delivery_address || ""}`
                  : `🛍️ Самовивіз (${resolvedPickupAddress})`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#94A3B8]">Оплата:</span>
              <span className="font-bold text-[#F1F5F9]">
                {order.payment_method === "cash" ? "Готівка" : "Картка"}
              </span>
            </div>
            <div className="flex justify-between pt-2 border-t border-white/10 font-bold text-base">
              <span className="text-[#F1F5F9]">Сума до сплати:</span>
              <span className="text-[var(--brand-primary,#D34528)]">{order.total_price} ₴</span>
            </div>
          </div>

          <div className="p-4 bg-[#181B22] rounded-2xl border border-white/10 text-xs text-[#94A3B8] space-y-1">
            <p>
              Якщо у вас виникнуть запитання щодо замовлення, зателефонуйте нам:
            </p>
            <a
              href={`tel:${resolvedBrandPhone}`}
              className="font-bold text-[var(--brand-primary,#D34528)] hover:underline inline-block"
            >
              📞 {resolvedBrandPhoneFormatted}
            </a>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="w-full bg-[var(--brand-primary,#D34528)] hover:opacity-90 text-white py-3.5 px-6 rounded-2xl font-bold text-base shadow-lg shadow-[var(--brand-primary,#D34528)]/20 transition-all active:scale-98 cursor-pointer"
          >
            Зрозуміло, дякую!
          </button>
        </div>
      </div>
    </div>
  );
}
