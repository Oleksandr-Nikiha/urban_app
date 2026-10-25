interface OrderCustomerFieldsProps {
  status: string;
  setStatus: (s: string) => void;
  scheduledTime: string;
  setScheduledTime: (t: string) => void;
  deliveryAddress: string;
  setDeliveryAddress: (a: string) => void;
  contactName: string;
  setContactName: (n: string) => void;
  contactPhone: string;
  setContactPhone: (p: string) => void;
  comment: string;
  setComment: (c: string) => void;
  fulfillmentType: string;
}

export function OrderCustomerFields({
  status,
  setStatus,
  scheduledTime,
  setScheduledTime,
  deliveryAddress,
  setDeliveryAddress,
  contactName,
  setContactName,
  contactPhone,
  setContactPhone,
  comment,
  setComment,
  fulfillmentType,
}: OrderCustomerFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div>
          <label className="block mb-1 font-semibold opacity-70">Статус замовлення:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-xl border border-[var(--app-border)] p-2.5 font-medium outline-none"
            style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
          >
            <option value="pending_moderation">⏳ Очікує підтвердження</option>
            <option value="confirmed">✅ Підтверджено</option>
            <option value="in_progress">👨‍🍳 Готується</option>
            <option value="ready">🛍️ Готове до видачі (самовивіз)</option>
            <option value="on_the_way">🛵 В дорозі (доставка)</option>
            <option value="completed">🏁 Виконано</option>
            <option value="rejected">❌ Відхилено</option>
            <option value="cancelled">🚫 Скасовано</option>
          </select>
        </div>

        <div>
          <label className="block mb-1 font-semibold opacity-70">
            ⏰ Бажаний час (10:30-21:30):
          </label>
          <input
            type="time"
            value={scheduledTime}
            min="10:30"
            max="21:30"
            onChange={(e) => setScheduledTime(e.target.value)}
            className="w-full rounded-xl border border-[var(--app-border)] p-2.5 font-medium outline-none"
            style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
          />
        </div>
      </div>

      <div className="space-y-2 text-xs">
        {fulfillmentType === "delivery" && (
          <div>
            <label className="block mb-1 font-semibold opacity-70">Адреса доставки:</label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="w-full rounded-xl p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)" }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block mb-1 font-semibold opacity-70">Ім'я клієнта:</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              className="w-full rounded-xl p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)" }}
            />
          </div>
          <div>
            <label className="block mb-1 font-semibold opacity-70">Телефон:</label>
            <input
              type="text"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className="w-full rounded-xl p-2.5 font-medium outline-none"
              style={{ background: "var(--app-surface-2)" }}
            />
          </div>
        </div>

        <div>
          <label className="block mb-1 font-semibold opacity-70">Коментар:</label>
          <input
            type="text"
            value={comment}
            placeholder="Коментар клієнта або менеджера..."
            onChange={(e) => setComment(e.target.value)}
            className="w-full rounded-xl p-2.5 font-medium outline-none"
            style={{ background: "var(--app-surface-2)" }}
          />
        </div>
      </div>
    </>
  );
}
