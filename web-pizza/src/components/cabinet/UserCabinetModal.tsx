import { useEffect, useState } from "react";
import {
  authTelegramWidget,
  fetchDeliveryAddresses,
  fetchWebOrder,
  fetchWebOrdersHistory,
  fetchWebProfile,
  updateWebProfile,
} from "../../api/client.ts";
import { useCart } from "../../context/CartContext.tsx";
import { useModalBehavior } from "../../hooks/useModalBehavior.ts";
import type { DeliveryAddress, ProductVariant } from "../../types/catalog.ts";
import type { OrderOut } from "../../types/order.ts";
import {
  clearSharedProfile,
  getSharedCookie,
  isUserAuthenticated,
  loadSavedProfile,
  saveSharedProfile,
  type UserProfile,
} from "../../types/user.ts";
import { CUSTOMER_STORAGE_KEY, type SavedCustomer } from "../CheckoutModal.tsx";
import { ORDERS_HISTORY_STORAGE_KEY } from "../OrderTrackingModal.tsx";
import { UserAvatar } from "../ui/UserAvatar.tsx";
import { LoyaltyBonusTab } from "./LoyaltyBonusTab.tsx";
import { OrdersHistoryTab } from "./OrdersHistoryTab.tsx";
import { PhoneAuthView } from "./PhoneAuthView.tsx";
import { ProfileSettingsTab } from "./ProfileSettingsTab.tsx";
import type { TelegramUser } from "./TelegramLoginWidget.tsx";

interface UserCabinetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTracking: (orderId: number) => void;
  onOpenCart: () => void;
  onProfileUpdated?: (profile: UserProfile) => void;
  isAuthenticated?: boolean;
  authReason?: "cabinet" | "checkout" | null;
  onAuthSuccess?: (profile: UserProfile) => void;
}

export function UserCabinetModal({
  isOpen,
  onClose,
  onOpenTracking,
  onOpenCart,
  onProfileUpdated,
  isAuthenticated = false,
  authReason = null,
  onAuthSuccess,
}: UserCabinetModalProps) {
  useModalBehavior({ isOpen, onClose });
  const { addItem } = useCart();
  const [currentView, setCurrentView] = useState<"profile" | "orders" | "auth" | "loyalty">("auth");
  const [profile, setProfile] = useState<UserProfile>({
    name: "",
    phone: "",
    street: "",
    house: "",
    apartment: "",
    bonuses: 50,
    isAuthenticated: false,
  });
  const [orders, setOrders] = useState<OrderOut[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [streetsList, setStreetsList] = useState<DeliveryAddress[]>([]);

  // Синхронізація вкладки з авторизацією
  useEffect(() => {
    if (isOpen) {
      if (!isAuthenticated) {
        setCurrentView("auth");
      } else {
        setCurrentView("profile");
      }
    }
  }, [isOpen, isAuthenticated]);

  // Завантаження профілю з пам'яті при відкритті
  useEffect(() => {
    if (!isOpen) return;

    if (isAuthenticated) {
      fetchDeliveryAddresses("Київ")
        .then(setStreetsList)
        .catch(() => setStreetsList([]));
    }

    try {
      let savedProf = loadSavedProfile();
      let currentProfile: UserProfile = {
        name: "",
        phone: "",
        street: "",
        house: "",
        apartment: "",
        bonuses: 50,
        isAuthenticated: false,
      };

      if (!savedProf) {
        const cookiePhone = getSharedCookie("urban_auth_phone");
        const cookieTg = getSharedCookie("urban_auth_tg");
        if (cookiePhone || cookieTg) {
          savedProf = {
            name: "Клієнт",
            phone: cookiePhone || "",
            telegram_id: cookieTg ? Number(cookieTg) : null,
            street: "",
            house: "",
            apartment: "",
            bonuses: 50,
            isAuthenticated: true,
          };
        }
      }

      if (savedProf && isUserAuthenticated(savedProf)) {
        const isVerified = Boolean(savedProf.is_phone_verified || savedProf.telegram_id);
        currentProfile = {
          ...currentProfile,
          ...savedProf,
          is_phone_verified: isVerified,
          bonuses: savedProf.bonuses ?? 50,
          isAuthenticated: true,
        };
        setProfile(currentProfile);

        // Синхронізуємо актуальні дані з сервера (верифікація, збережені адреси, ПІБ, бонуси)
        if (currentProfile.telegram_id || currentProfile.phone) {
          void fetchWebProfile({
            telegram_id: currentProfile.telegram_id,
            phone: currentProfile.phone,
          }).then((serverUser) => {
            if (serverUser) {
              setProfile((prev) => {
                const merged: UserProfile = {
                  ...prev,
                  name: serverUser.full_name || prev.name,
                  first_name: serverUser.first_name || prev.first_name,
                  last_name: serverUser.last_name || prev.last_name,
                  phone: serverUser.phone || prev.phone,
                  telegram_id: serverUser.telegram_id || prev.telegram_id,
                  is_phone_verified:
                    serverUser.is_phone_verified ||
                    Boolean(serverUser.telegram_id) ||
                    Boolean(prev.telegram_id),
                  street: prev.street || serverUser.delivery_address || "",
                  additional_address: prev.additional_address || serverUser.additional_address || "",
                  client_code: serverUser.client_code || prev.client_code,
                  bonuses: serverUser.bonus_balance ?? prev.bonuses ?? 50,
                };
                saveSharedProfile(merged);
                if (onProfileUpdated) onProfileUpdated(merged);
                return merged;
              });
            }
          });
        }

        if (isAuthenticated) {
          void loadOrders(currentProfile.phone, currentProfile.telegram_id, false);
        }
        return;
      }

      setProfile(currentProfile);
    } catch (err) {
      console.error("Помилка завантаження профілю", err);
    }
  }, [isOpen, isAuthenticated]);

  // Живе авто-оновлення замовлень кожні 4 секунди поки відкрите вікно для авторизованого користувача
  useEffect(() => {
    if (!isOpen || !isAuthenticated || (!profile.phone && !profile.telegram_id)) return;

    const timer = setInterval(() => {
      void loadOrders(profile.phone, profile.telegram_id, true);
    }, 4000);

    const handleOrderCreated = (e: Event) => {
      const customEvent = e as CustomEvent<OrderOut>;
      if (customEvent.detail) {
        setOrders((prev) => {
          const exists = prev.some((o) => o.id === customEvent.detail.id);
          return exists ? prev : [customEvent.detail, ...prev];
        });
      }
      void loadOrders(profile.phone, profile.telegram_id, true);
    };

    window.addEventListener("urban:order_created", handleOrderCreated);

    return () => {
      clearInterval(timer);
      window.removeEventListener("urban:order_created", handleOrderCreated);
    };
  }, [isOpen, isAuthenticated, profile.phone, profile.telegram_id]);

  const loadOrders = async (
    phone: string,
    telegramId?: number | null,
    silent: boolean = false,
  ) => {
    if (!isAuthenticated) return;
    if (!silent) setLoadingOrders(true);
    try {
      let fetchedOrders: OrderOut[] = [];

      // 1. Запит за номером телефону або telegram_id
      if (phone || telegramId) {
        fetchedOrders = await fetchWebOrdersHistory({
          phone: phone || undefined,
          telegramId: telegramId ? Number(telegramId) : undefined,
        });
      }

      // 2. Додатково перевіряємо локальну історію замовлень
      const savedHist = JSON.parse(
        localStorage.getItem(ORDERS_HISTORY_STORAGE_KEY) || "[]",
      );
      if (Array.isArray(savedHist) && savedHist.length > 0) {
        const existingIds = new Set(fetchedOrders.map((o) => o.id));
        const missingIds = savedHist.filter((id) => typeof id === "number" && !existingIds.has(id));

        if (missingIds.length > 0) {
          const additional = await Promise.allSettled(
            missingIds.slice(0, 5).map((id) => fetchWebOrder(id)),
          );
          for (const res of additional) {
            if (res.status === "fulfilled" && res.value) {
              fetchedOrders.push(res.value);
            }
          }
        }
      }

      // Сортування від найновіших до старіших
      fetchedOrders.sort((a, b) => b.id - a.id);
      setOrders(fetchedOrders);

      // Оновлюємо бонуси: 50 вітальних + 5% від виконаних замовлень
      const completedSum = fetchedOrders
        .filter((o) => o.status === "completed")
        .reduce((sum, o) => sum + o.total_price, 0);
      const calculatedBonuses = 50 + Math.floor(completedSum * 0.05);

      setProfile((prev) => ({ ...prev, bonuses: calculatedBonuses }));
    } catch (err) {
      if (!silent) console.error("Помилка завантаження замовлень", err);
    } finally {
      if (!silent) setLoadingOrders(false);
    }
  };

  const handleSaveProfile = async (updated: UserProfile) => {
    const isVerified = Boolean(updated.is_phone_verified || updated.telegram_id);
    const toSave: UserProfile = {
      ...updated,
      is_phone_verified: isVerified,
    };
    setProfile(toSave);
    saveSharedProfile(toSave);
    try {
      const cust: SavedCustomer = {
        name: toSave.name,
        phone: toSave.phone,
        street: toSave.street,
        house: toSave.house,
        apartment: toSave.apartment,
      };
      localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(cust));
    } catch {}

    if (onProfileUpdated) {
      onProfileUpdated(toSave);
    }

    if (toSave.telegram_id || toSave.phone) {
      const fullAddress = [toSave.street, toSave.house, toSave.apartment]
        .filter(Boolean)
        .join(", ");
      try {
        const userOut = await updateWebProfile({
          telegram_id: toSave.telegram_id || null,
          phone: toSave.phone || null,
          full_name: toSave.name || null,
          delivery_address: fullAddress || null,
          additional_address: toSave.additional_address || null,
          bonus_balance: toSave.bonuses,
        });
        if (userOut) {
          setProfile((prev) => {
            const synced: UserProfile = {
              ...prev,
              is_phone_verified:
                userOut.is_phone_verified ||
                Boolean(userOut.telegram_id) ||
                Boolean(prev.telegram_id),
              client_code: userOut.client_code || prev.client_code,
              bonuses: userOut.bonus_balance ?? prev.bonuses ?? 50,
            };
            saveSharedProfile(synced);
            if (onProfileUpdated) onProfileUpdated(synced);
            return synced;
          });
        }
      } catch (err) {
        console.warn("Помилка авто-синхронізації профілю на сервері:", err);
      }
    }

    if (toSave.phone || toSave.telegram_id) {
      void loadOrders(toSave.phone, toSave.telegram_id, true);
    }
  };

  const handlePhoneAuthSuccess = (updatedProfile: UserProfile) => {
    setProfile(updatedProfile);
    saveSharedProfile(updatedProfile);
    if (onProfileUpdated) onProfileUpdated(updatedProfile);
    if (onAuthSuccess) {
      onAuthSuccess(updatedProfile);
    } else {
      setCurrentView("profile");
      void loadOrders(updatedProfile.phone, updatedProfile.telegram_id, false);
    }
  };

  const handleTelegramAuth = async (user: TelegramUser) => {
    try {
      const userOut = await authTelegramWidget(user);
      const updatedProfile: UserProfile = {
        ...profile,
        name: userOut.full_name || profile.name || user.first_name || "",
        phone: userOut.phone || profile.phone,
        telegram_id: userOut.telegram_id,
        username: user.username,
        avatar_url: user.photo_url || profile.avatar_url,
        bonuses: Math.max(profile.bonuses, userOut.bonus_balance ?? 50),
        client_code: userOut.client_code || `UB-${userOut.telegram_id}`,
        is_phone_verified: true,
        isAuthenticated: true,
      };
      if (userOut.delivery_address && !profile.street) {
        updatedProfile.street = userOut.delivery_address;
      }
      setProfile(updatedProfile);
      saveSharedProfile(updatedProfile);
      if (onProfileUpdated) onProfileUpdated(updatedProfile);
      if (onAuthSuccess) {
        onAuthSuccess(updatedProfile);
      } else {
        setCurrentView("profile");
        void loadOrders(updatedProfile.phone, updatedProfile.telegram_id, false);
      }
    } catch (err) {
      console.error("Помилка авторизації Telegram віджета:", err);
    }
  };

  const handleDisconnectTelegram = () => {
    const updated: UserProfile = {
      ...profile,
      telegram_id: null,
      username: null,
      avatar_url: null,
      is_phone_verified: false,
    };
    handleSaveProfile(updated);
    void loadOrders(updated.phone, null, false);
  };

  const handleLogout = () => {
    clearSharedProfile();
    try {
      localStorage.removeItem(CUSTOMER_STORAGE_KEY);
    } catch {}
    const empty: UserProfile = {
      name: "",
      phone: "",
      street: "",
      house: "",
      apartment: "",
      bonuses: 0,
      is_phone_verified: false,
      isAuthenticated: false,
      telegram_id: null,
      username: null,
      avatar_url: null,
    };
    setProfile(empty);
    setOrders([]);
    setCurrentView("auth");
    if (onProfileUpdated) {
      onProfileUpdated(empty);
    }
  };

  const handleRepeatOrder = (order: OrderOut) => {
    const allItems = order.groups.flatMap((g) => g.items);

    for (const item of allItems) {
      const variant: ProductVariant = {
        id: item.variant_id ?? 0,
        label: item.variant_label,
        weight: null,
        price: item.unit_price,
      };

      const selectedOptions = (item.options || []).map((opt) => ({
        groupId: opt.id,
        groupName: opt.option_group_name,
        option: {
          variant_id: opt.id,
          name: opt.option_name,
          price_delta: opt.price_delta,
        },
      }));

      const extraPerUnit = selectedOptions.reduce((sum, o) => sum + o.option.price_delta, 0);

      addItem({
        productId: item.id,
        productName: item.product_name,
        imageUrl: null,
        variant,
        selectedOptions,
        qty: item.qty,
        extraPerUnit,
      });
    }

    onClose();
    onOpenCart();
  };

  if (!isOpen) return null;

  const ordersCount = orders.length;
  const activeOrdersCount = orders.filter(
    (o) =>
      o.status !== "completed" &&
      o.status !== "rejected" &&
      o.status !== "cancelled",
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative bg-[#14171E] rounded-t-3xl sm:rounded-3xl max-w-xl w-full max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden shadow-2xl border border-white/10 z-10 animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 text-[#F1F5F9]">
        {/* Хедер модалки */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-[#181B22] shadow-2xs">
          <div className="flex items-center gap-3">
            {isAuthenticated && currentView !== "profile" ? (
              <button
                type="button"
                onClick={() => setCurrentView("profile")}
                className="w-9 h-9 rounded-full bg-[#1E232B] hover:bg-[#282F3B] text-white border border-white/10 flex items-center justify-center font-bold text-sm cursor-pointer shadow-2xs active:scale-95 transition-all"
                title="Назад до профілю"
              >
                ←
              </button>
            ) : isAuthenticated ? (
              <UserAvatar
                avatarUrl={profile.avatar_url}
                name={profile.name || profile.username}
                size="md"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#1E232B] border border-white/10 flex items-center justify-center text-lg shrink-0 text-white">
                {authReason === "checkout" ? "🛍️" : "🔐"}
              </div>
            )}
            <div>
              <h2 className="font-display text-lg sm:text-xl font-bold text-white">
                {!isAuthenticated
                  ? authReason === "checkout"
                    ? "Вхід для замовлення"
                    : "Вхід до кабінету"
                  : currentView === "orders"
                  ? "Мої замовлення"
                  : currentView === "loyalty"
                  ? "Бонусна програма"
                  : currentView === "auth"
                  ? "Авторизація"
                  : profile.name
                  ? `Вітаємо, ${profile.name.split(" ")[0]}!`
                  : "Особистий кабінет"}
              </h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-xs text-[#94A3B8]">
                  {!isAuthenticated
                    ? authReason === "checkout"
                      ? "Авторизуйтесь, щоб оформити замовлення"
                      : "Авторизуйтесь для перегляду профілю"
                    : profile.phone ? profile.phone : "Профіль клієнта Urban Bites"}
                </p>
                {isAuthenticated && profile.telegram_id && (
                  <span className="text-[10px] bg-blue-950/60 text-blue-300 border border-blue-500/30 font-semibold px-2 py-0.2 rounded-full">
                    Telegram ✓
                  </span>
                )}
                {isAuthenticated && (profile.is_phone_verified || Boolean(profile.telegram_id)) && (
                  <span className="text-[10px] bg-emerald-950/60 text-emerald-300 border border-emerald-500/30 font-semibold px-2 py-0.2 rounded-full">
                    Верифіковано ✓
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            aria-label="Закрити"
            className="w-9 h-9 rounded-full bg-[#1E232B] hover:bg-[#282F3B] text-white border border-white/10 flex items-center justify-center font-bold text-sm cursor-pointer shadow-xs active:scale-95 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Тіло модального вікна */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 overscroll-contain">
          {!isAuthenticated || currentView === "auth" ? (
            <PhoneAuthView
              authReason={authReason}
              onTelegramAuth={handleTelegramAuth}
              onPhoneAuthSuccess={handlePhoneAuthSuccess}
              onCancel={isAuthenticated ? () => setCurrentView("profile") : undefined}
            />
          ) : currentView === "orders" ? (
            <OrdersHistoryTab
              orders={orders}
              loading={loadingOrders}
              onRepeatOrder={handleRepeatOrder}
              onOpenTracking={(id) => {
                onClose();
                onOpenTracking(id);
              }}
              onRefresh={() => void loadOrders(profile.phone, profile.telegram_id, false)}
            />
          ) : currentView === "loyalty" ? (
            <LoyaltyBonusTab
              bonuses={profile.bonuses ?? 50}
              phone={profile.phone}
              clientCode={profile.client_code}
              telegramId={profile.telegram_id}
            />
          ) : (
            <ProfileSettingsTab
              profile={profile}
              ordersCount={ordersCount}
              activeOrdersCount={activeOrdersCount}
              streetsList={streetsList}
              onOpenOrders={() => setCurrentView("orders")}
              onOpenLoyalty={() => setCurrentView("loyalty")}
              onSaveProfile={handleSaveProfile}
              onLogout={handleLogout}
              onOpenPhoneAuth={() => setCurrentView("auth")}
              onTelegramAuth={handleTelegramAuth}
              onDisconnectTelegram={handleDisconnectTelegram}
            />
          )}
        </div>

        {/* Футер */}
        <div className="shrink-0 p-3 sm:p-4 border-t border-white/10 bg-[#181B22] flex items-center justify-between">
          <div className="text-[11px] text-[#94A3B8]">
            {currentView === "orders" ? (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Авто-оновлення статусів активне
              </span>
            ) : (
              <span>Urban Pizza & Sushi • м. Київ</span>
            )}
          </div>

          <button
            onClick={onClose}
            type="button"
            className="bg-[#222731] hover:bg-[#2A313C] text-white py-2 px-6 rounded-xl font-bold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 cursor-pointer border border-white/10"
          >
            Закрити
          </button>
        </div>
      </div>
    </div>
  );
}
