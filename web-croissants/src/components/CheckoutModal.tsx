import { useEffect, useState } from "react";
import { CROISSANTS_LOCATION_ID, fetchDeliveryAddresses, submitWebOrder, updateWebProfile } from "../api/client.ts";
import { useCart } from "../context/CartContext.tsx";
import type { DeliveryAddress } from "../types/catalog.ts";
import type { OrderOut, WebOrderCreatePayload, WebOrderItemPayload } from "../types/order.ts";
import { formatPhoneOnInput, handlePhoneKeyDown, formatPhoneNumber, isValidUkrainianPhone, normalizeE164Phone } from "../utils/phone.ts";
import { getWorkingHoursInfo } from "../utils/workingHours.ts";
import { AddressFields } from "./checkout/AddressFields.tsx";
import { CustomerInfoFields } from "./checkout/CustomerInfoFields.tsx";
import { useModalBehavior } from "../hooks/useModalBehavior.ts";
import { LAST_ORDER_STORAGE_KEY, ORDERS_HISTORY_STORAGE_KEY } from "./OrderTrackingModal.tsx";
import { isUserAuthenticated, saveSharedProfile, USER_PROFILE_STORAGE_KEY, type UserProfile } from "../types/user.ts";
import { calculateBonusCashback, getBonusCashbackPercentLabel } from "../utils/bonus.ts";

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (order: OrderOut, updatedProfile?: UserProfile) => void;
  isAuthenticated?: boolean;
  userProfile?: UserProfile | null;
  onRequireAuth?: () => void;
  onAuthSuccess?: (profile: UserProfile) => void;
}

export const CUSTOMER_STORAGE_KEY = "urban_customer_details_v1";

export interface SavedCustomer {
  name: string;
  phone: string;
  street: string;
  house: string;
  apartment: string;
}

export function CheckoutModal({
  isOpen,
  onClose,
  onSuccess,
  isAuthenticated = false,
  userProfile,
  onRequireAuth,
  onAuthSuccess,
}: CheckoutModalProps) {
  useModalBehavior({ isOpen, onClose });

  const { items, totalPrice, clearCart } = useCart();

  const [fulfillmentType, setFulfillmentType] = useState<"delivery" | "pickup">("delivery");
  const [street, setStreet] = useState("");
  const [house, setHouse] = useState("");
  const [apartment, setApartment] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card">("cash");
  const [scheduledTime, setScheduledTime] = useState("");
  const [isAsap, setIsAsap] = useState(true);
  const [comment, setComment] = useState("");
  const [saveDetails, setSaveDetails] = useState(true);
  const [isAutofilled, setIsAutofilled] = useState(false);
  const [useBonuses, setUseBonuses] = useState(false);

  const [streetsList, setStreetsList] = useState<DeliveryAddress[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hoursInfo = getWorkingHoursInfo();

  const userBonusBalance = userProfile?.bonuses ?? 0;
  // Дозволяємо сплатити бонусами до 30% вартості замовлення або до суми балансу (щонайменше 1 грн до сплати)
  const maxBonusDiscount = Math.min(
    userBonusBalance,
    Math.min(Math.floor(totalPrice * 0.3), Math.max(0, totalPrice - 1))
  );
  const bonusDiscount = useBonuses ? maxBonusDiscount : 0;
  const finalPrice = Math.max(0, totalPrice - bonusDiscount);

  // Завантаження збережених контактів та адресного довідника
  useEffect(() => {
    if (isOpen) {
      fetchDeliveryAddresses("Київ")
        .then(setStreetsList)
        .catch(() => setStreetsList([]));

      // Пріоритет: дані авторизованого профілю
      if (userProfile && isUserAuthenticated(userProfile)) {
        let loadedAny = false;
        if (userProfile.name && !name) {
          setName(userProfile.name);
          loadedAny = true;
        }
        if (userProfile.phone && !phone) {
          setPhone(formatPhoneNumber(userProfile.phone));
          loadedAny = true;
        }
        if (userProfile.street && !street) {
          setStreet(userProfile.street);
          loadedAny = true;
        }
        if (userProfile.house && !house) {
          setHouse(userProfile.house);
          loadedAny = true;
        }
        if (userProfile.apartment && !apartment) {
          setApartment(userProfile.apartment);
          loadedAny = true;
        }
        if (loadedAny) {
          setIsAutofilled(true);
        }
        return;
      }

      try {
        const saved = localStorage.getItem(CUSTOMER_STORAGE_KEY);
        if (saved) {
          const data: SavedCustomer = JSON.parse(saved);
          let loadedAny = false;
          if (data.name && !name) {
            setName(data.name);
            loadedAny = true;
          }
          if (data.phone && !phone) {
            setPhone(formatPhoneNumber(data.phone));
            loadedAny = true;
          }
          if (data.street && !street) {
            setStreet(data.street);
            loadedAny = true;
          }
          if (data.house && !house) {
            setHouse(data.house);
            loadedAny = true;
          }
          if (data.apartment && !apartment) {
            setApartment(data.apartment);
            loadedAny = true;
          }
          if (loadedAny) {
            setIsAutofilled(true);
          }
        }
      } catch (err) {
        console.error("Помилка читання збережених даних", err);
      }
    }
  }, [isOpen, isAuthenticated, userProfile]);

  if (!isOpen) return null;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneOnInput(e.target.value, phone);
    setPhone(formatted);
  };

  const handleClearSavedData = () => {
    try {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch {}
    setName("");
    setPhone("");
    setStreet("");
    setHouse("");
    setApartment("");
    setIsAutofilled(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Будь ласка, вкажіть ваше ім'я");
      return;
    }

    if (!isValidUkrainianPhone(phone)) {
      setError("Вкажіть коректний контактний номер телефону (наприклад: +380 44 222 00 22)");
      return;
    }

    const cleanPhone = normalizeE164Phone(phone);

    let fullAddress: string | null = null;
    if (fulfillmentType === "delivery") {
      if (!street.trim()) {
        setError("Оберіть або вкажіть вулицю для доставки");
        return;
      }
      if (!house.trim()) {
        setError("Вкажіть номер будинку");
        return;
      }
      fullAddress = `м. Київ, ${street.trim()}, буд. ${house.trim()}${
        apartment.trim() ? `, кв./офіс ${apartment.trim()}` : ""
      }`;
    }

    const orderItems: WebOrderItemPayload[] = items.map((i) => ({
      variant_id: i.variant.id,
      qty: i.qty,
      option_variant_ids: i.selectedOptions.flatMap((o) =>
        Array(Math.max(1, o.qty || 1)).fill(o.option.variant_id),
      ),
    }));

    let tgId: number | null = null;
    if (isAuthenticated) {
      try {
        const savedProf = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
        if (savedProf) {
          const parsed = JSON.parse(savedProf);
          if (parsed.telegram_id) tgId = Number(parsed.telegram_id);
        }
      } catch {}
    }

    let finalComment = comment.trim();
    if (bonusDiscount > 0) {
      const bonusNote = `[Оплачено бонусами URBAN CLUB: -${bonusDiscount} ₴, до сплати: ${finalPrice} ₴]`;
      finalComment = finalComment ? `${finalComment} • ${bonusNote}` : bonusNote;
    }

    const payload: WebOrderCreatePayload = {
      telegram_id: tgId,
      location_id: CROISSANTS_LOCATION_ID,
      fulfillment_type: fulfillmentType,
      delivery_address: fullAddress,
      contact_name: name.trim(),
      contact_phone: cleanPhone,
      payment_method: paymentMethod,
      scheduled_time: isAsap ? null : scheduledTime.trim() || null,
      comment: finalComment || null,
      bonus_spent: bonusDiscount,
      source: "web_croissants",
      items: orderItems,
    };

    setSubmitting(true);
    try {
      const createdOrder = await submitWebOrder(payload);

      // Збереження даних клієнта для швидких наступних замовлень
      if (saveDetails) {
        try {
          const toSave: SavedCustomer = {
            name: name.trim(),
            phone: cleanPhone,
            street: street.trim(),
            house: house.trim(),
            apartment: apartment.trim(),
          };
          localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(toSave));
        } catch (saveErr) {
          console.error("Не вдалося зберегти дані клієнта у localStorage", saveErr);
        }
      }

      clearCart();
      try {
        localStorage.setItem(LAST_ORDER_STORAGE_KEY, String(createdOrder.id));
        const savedHist = JSON.parse(
          localStorage.getItem(ORDERS_HISTORY_STORAGE_KEY) || "[]",
        );
        const updated = Array.from(
          new Set([createdOrder.id, ...(Array.isArray(savedHist) ? savedHist : [])]),
        ).slice(0, 10);
        localStorage.setItem(ORDERS_HISTORY_STORAGE_KEY, JSON.stringify(updated));

        // Оновлюємо бонуси: списуємо використані (кешбек буде нараховано сервером після виконання)
        const prevProfStr = localStorage.getItem(USER_PROFILE_STORAGE_KEY);
        const prevProf = prevProfStr ? JSON.parse(prevProfStr) : {};
        const prevBonus = typeof prevProf.bonuses === "number" ? prevProf.bonuses : 50;
        const newBonusBalance = Math.max(0, prevBonus - bonusDiscount);

        const updatedProf: UserProfile = {
          ...prevProf,
          name: name.trim(),
          phone: cleanPhone,
          street: street.trim(),
          house: house.trim(),
          apartment: apartment.trim(),
          telegram_id: createdOrder.telegram_id || prevProf.telegram_id || null,
          bonuses: newBonusBalance,
          client_code: prevProf.client_code || (createdOrder.telegram_id ? `UB-${createdOrder.telegram_id}` : undefined),
          is_phone_verified: Boolean(createdOrder.telegram_id || prevProf.is_phone_verified),
          isAuthenticated: Boolean(prevProf.isAuthenticated || createdOrder.telegram_id || cleanPhone),
        };
        saveSharedProfile(updatedProf);

        if (updatedProf.phone || updatedProf.telegram_id) {
          void updateWebProfile({
            phone: updatedProf.phone,
            telegram_id: updatedProf.telegram_id,
            bonus_balance: newBonusBalance,
          });
        }

        // Сповіщаємо інші компоненти (кабінет, відстеження) про нове замовлення
        window.dispatchEvent(new CustomEvent("urban:order_created", { detail: createdOrder }));

        if (onAuthSuccess && isUserAuthenticated(updatedProf)) {
          onAuthSuccess(updatedProf);
        }
        onSuccess(createdOrder, updatedProf);
        onClose();
        return;
      } catch {}
      onSuccess(createdOrder);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Помилка при оформленні замовлення";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative bg-[#14171E] rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-white/10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 text-[#F1F5F9]">
        {/* Хедер модалки */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#181B22]">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
              Оформлення замовлення
            </h2>
            <p className="text-[11px] sm:text-xs text-[#94A3B8] mt-0.5">
              Urban Bakery & Coffee • м. Київ, вул. Велика Васильківська, 24
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-full bg-[#1E232B] hover:bg-[#282F3B] text-white border border-white/10 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Форма */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 overscroll-contain">
            {!isAuthenticated && onRequireAuth && (
              <div className="p-3.5 rounded-2xl bg-[#181B22] border border-white/10 flex items-center justify-between gap-3 text-xs text-[#CBD5E1]">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-base shrink-0">🎁</span>
                  <span>
                    Маєте акаунт?{" "}
                    <span className="font-semibold text-white">Увійдіть для нарахування бонусів</span>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="shrink-0 bg-[#222731] hover:bg-[#2A313C] border border-white/10 text-white text-xs font-semibold px-3 py-1.5 rounded-xl cursor-pointer transition-colors active:scale-95"
                >
                  Увійти
                </button>
              </div>
            )}

            {hoursInfo.checkoutNotice && (
              <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/30 text-amber-200 text-xs sm:text-sm flex items-start gap-3">
                <span className="text-lg shrink-0">🌙</span>
                <div className="leading-relaxed font-medium">
                  {hoursInfo.checkoutNotice}
                </div>
              </div>
            )}

            {error && (
              <div className="p-3.5 rounded-2xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs sm:text-sm font-medium flex items-center gap-2">
                <span>⚠️</span>
                <span>{error}</span>
              </div>
            )}

            {isAutofilled && (
              <div className="flex items-center justify-between bg-[#181B22] border border-white/10 px-3.5 py-2 rounded-xl text-xs text-[#CBD5E1]">
                <span className="flex items-center gap-1.5">
                  <span>✨</span>
                  <span>Ваші дані автозаповнено для швидкого замовлення</span>
                </span>
                <button
                  type="button"
                  onClick={handleClearSavedData}
                  className="text-[#E69A38] hover:underline font-semibold text-[11px] cursor-pointer"
                >
                  Очистити
                </button>
              </div>
            )}

            {/* Спосіб отримання */}
            <div className="space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
                Спосіб отримання
              </label>
              <div className="grid grid-cols-2 gap-3 p-1.5 bg-[#121417] rounded-2xl border border-white/10">
                <button
                  type="button"
                  onClick={() => setFulfillmentType("delivery")}
                  className={`py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    fulfillmentType === "delivery"
                      ? "bg-[#222731] text-white shadow-sm border border-white/10"
                      : "text-[#94A3B8] hover:text-white"
                  }`}
                >
                  <span>🛵</span>
                  <span>Доставка</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFulfillmentType("pickup")}
                  className={`py-3 px-4 rounded-xl text-sm font-bold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    fulfillmentType === "pickup"
                      ? "bg-[#222731] text-white shadow-sm border border-white/10"
                      : "text-[#94A3B8] hover:text-white"
                  }`}
                >
                  <span>🛍️</span>
                  <span>Самовивіз</span>
                </button>
              </div>
            </div>

            {/* Адресні поля */}
            <AddressFields
              fulfillmentType={fulfillmentType}
              street={street}
              setStreet={setStreet}
              house={house}
              setHouse={setHouse}
              apartment={apartment}
              setApartment={setApartment}
              streetsList={streetsList}
            />

            {/* Контактні дані та параметри */}
            <CustomerInfoFields
              name={name}
              setName={setName}
              phone={phone}
              onPhoneChange={handlePhoneChange}
              onPhoneKeyDown={handlePhoneKeyDown}
              saveDetails={saveDetails}
              setSaveDetails={setSaveDetails}
              isAsap={isAsap}
              setIsAsap={setIsAsap}
              scheduledTime={scheduledTime}
              setScheduledTime={setScheduledTime}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              comment={comment}
              setComment={setComment}
              isPhoneVerified={Boolean(userProfile?.is_phone_verified)}
            />

            {/* Бонуси URBAN CLUB */}
            {isAuthenticated && userBonusBalance > 0 && (
              <div className="p-4 rounded-2xl bg-[#181B22] border border-white/10 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="text-xl">✨</span>
                    <div>
                      <div className="text-xs font-bold text-white">Бонуси URBAN CLUB</div>
                      <div className="text-[11px] text-[#94A3B8]">
                        Доступно: <strong className="text-[#E69A38] font-bold">{userBonusBalance} ₴</strong> (до -{maxBonusDiscount} ₴ на це замовлення)
                      </div>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useBonuses}
                      onChange={(e) => setUseBonuses(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-[#222731] border border-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#E69A38]"></div>
                  </label>
                </div>
                {useBonuses && (
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs text-[#CBD5E1] font-semibold">
                    <span>Списання бонусів:</span>
                    <span className="text-emerald-400 font-bold">-{bonusDiscount} ₴</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Підсумок і кнопка відправки */}
          <div className="shrink-0 p-4 sm:p-5 border-t border-white/10 bg-[#181B22] flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] text-[#94A3B8]">Разом до сплати:</div>
              <div className="flex items-baseline gap-2">
                <div className="text-xl sm:text-2xl font-extrabold text-white">
                  {finalPrice} ₴
                </div>
                {bonusDiscount > 0 && (
                  <span className="text-xs text-[#94A3B8] line-through font-medium">
                    {totalPrice} ₴
                  </span>
                )}
              </div>
              {finalPrice > 50 ? (
                <div className="text-[10px] text-emerald-400 font-medium">
                  + {calculateBonusCashback(finalPrice)} бонусів кешбеку ({getBonusCashbackPercentLabel(finalPrice)}) після виконання
                </div>
              ) : (
                <div className="text-[10px] text-[#94A3B8] font-medium">
                  Бонуси нараховуються від 50 ₴
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex-1 max-w-xs bg-[#E69A38] hover:bg-[#D4892A] disabled:opacity-50 text-white py-3 sm:py-3.5 px-5 rounded-2xl font-bold text-sm sm:text-base shadow-lg shadow-[#E69A38]/25 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
            >
              {submitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Оформлення...</span>
                </>
              ) : (
                <span>Підтвердити замовлення</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
