import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import {
  useAdminMe,
  useLogout,
  useMe,
  useOrders,
  useUpdateProfile,
} from "@/api/queries";
import { keys } from "@/api/queries/keys";
import { AdminStaffBanner } from "@/components/profile/AdminStaffBanner";
import { ClubCard } from "@/components/profile/ClubCard";
import { GuestAuthSection } from "@/components/profile/GuestAuthSection";
import { MyOrdersCard } from "@/components/profile/MyOrdersCard";
import { PersonalInfoFields } from "@/components/profile/PersonalInfoFields";
import { ProfileAddressesSection } from "@/components/profile/ProfileAddressesSection";
import { ErrorBox, ScreenTitle, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";

export function ProfilePage() {
  const qc = useQueryClient();
  const { data: user, isPending, error, refetch } = useMe();
  const { data: adminMe } = useAdminMe();
  const { data: orders } = useOrders();
  const updateProfile = useUpdateProfile();
  const logout = useLogout();

  // Лайв-синхронізація: якщо статус будь-якого замовлення змінився, оновлюємо дані профілю та бонуси
  const ordersSignature = orders?.map((o) => `${o.id}:${o.status}`).join(",") || "";
  const prevOrdersSig = useRef(ordersSignature);
  useEffect(() => {
    if (prevOrdersSig.current && prevOrdersSig.current !== ordersSignature) {
      void refetch();
      void qc.invalidateQueries({ queryKey: keys.me });
      void qc.invalidateQueries({ queryKey: ["auth", "bonusHistory"] });
    }
    prevOrdersSig.current = ordersSignature;
  }, [ordersSignature, refetch, qc]);

  // Витягуємо ім'я та прізвище: спочатку з окремих полів, якщо порожні — парсимо full_name
  const initialFirstName = user?.first_name || user?.full_name?.split(" ")[0] || "";
  const initialLastName =
    user?.last_name || (user?.full_name && user.full_name.split(" ").slice(1).join(" ")) || "";

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [phone, setPhone] = useState(user?.phone || "");
  const [deliveryAddress, setDeliveryAddress] = useState(user?.delivery_address || "");
  const [additionalAddress, setAdditionalAddress] = useState(user?.additional_address || "");
  const [isEditingMainAddress, setIsEditingMainAddress] = useState(false);
  const [isEditingAdditionalAddress, setIsEditingAdditionalAddress] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Оновлюємо внутрішній стан, якщо дані користувача змінилися з сервера
  const [loadedUserId, setLoadedUserId] = useState<number | null>(null);
  useEffect(() => {
    if (user && user.id !== loadedUserId) {
      setLoadedUserId(user.id);
      setFirstName(user.first_name || user.full_name?.split(" ")[0] || "");
      setLastName(user.last_name || (user.full_name && user.full_name.split(" ").slice(1).join(" ")) || "");
      setPhone(user.phone || "");
      setDeliveryAddress(user.delivery_address || "");
      setAdditionalAddress(user.additional_address || "");
    }
  }, [user, loadedUserId]);

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;
  if (!user) {
    return <GuestAuthSection />;
  }

  const isDirty =
    firstName.trim() !== (initialFirstName || "").trim() ||
    lastName.trim() !== (initialLastName || "").trim() ||
    (!user.is_phone_verified && phone.trim() !== (user.phone || "").trim()) ||
    deliveryAddress.trim() !== (user.delivery_address || "").trim() ||
    additionalAddress.trim() !== (user.additional_address || "").trim();

  const canSave =
    firstName.trim().length > 0 &&
    (!user.is_phone_verified ? phone.trim().length >= 9 : true) &&
    isDirty &&
    !updateProfile.isPending;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setSavedSuccess(false);
    updateProfile.mutate(
      {
        first_name: firstName.trim(),
        last_name: lastName.trim() || null,
        phone: !user.is_phone_verified ? phone.trim() : undefined,
        delivery_address: deliveryAddress.trim() || null,
        additional_address: additionalAddress.trim() || null,
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          setSavedSuccess(true);
          setIsEditingMainAddress(false);
          setIsEditingAdditionalAddress(false);
          setTimeout(() => setSavedSuccess(false), 3000);
        },
        onError: () => {
          hapticNotify("error");
        },
      },
    );
  };

  const clientCode = user.client_code || `DM-${user.telegram_id}`;
  const bonusBalance = user.bonus_balance ?? 0;

  return (
    <div className="pb-8">
      <ScreenTitle>Профіль</ScreenTitle>

      <form onSubmit={handleSave} className="space-y-6 px-4 pt-1">
        {/* Секція для співробітників: Перехід до Адмін-панелі */}
        <AdminStaffBanner adminMe={adminMe} />

        {/* Секція: Мої замовлення */}
        <MyOrdersCard orders={orders} />

        {/* Секція 1: Мої дані */}
        <PersonalInfoFields
          firstName={firstName}
          setFirstName={setFirstName}
          lastName={lastName}
          setLastName={setLastName}
          phone={phone}
          setPhone={setPhone}
          isPhoneVerified={Boolean(user.is_phone_verified)}
          verifiedPhone={user.phone || ""}
          botUsername={user.bot_username}
          onFieldChange={() => setSavedSuccess(false)}
          onRefetchUser={async () => {
            await refetch();
          }}
        />

        {/* Секція 2: Мої адреси доставки */}
        <ProfileAddressesSection
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          additionalAddress={additionalAddress}
          setAdditionalAddress={setAdditionalAddress}
          isEditingMainAddress={isEditingMainAddress}
          setIsEditingMainAddress={setIsEditingMainAddress}
          isEditingAdditionalAddress={isEditingAdditionalAddress}
          setIsEditingAdditionalAddress={setIsEditingAdditionalAddress}
          onAddressChange={() => setSavedSuccess(false)}
        />

        {/* Секція 3: Картка клієнта */}
        <ClubCard
          fullName={user.full_name || `${firstName} ${lastName}`.trim() || "Клієнт"}
          clientCode={clientCode}
          bonusBalance={bonusBalance}
        />

        {/* Статус повідомлення про успіх або помилку */}
        {savedSuccess && (
          <p
            className="app-pop rounded-xl px-4 py-2.5 text-center text-xs font-medium"
            style={{ background: "color-mix(in srgb, #22c55e 12%, transparent)", color: "#22c55e" }}
          >
            ✓ Дані успішно збережено
          </p>
        )}

        {updateProfile.isError && (
          <p
            className="rounded-xl px-4 py-2.5 text-center text-xs font-medium"
            style={{ background: "color-mix(in srgb, #ef4444 12%, transparent)", color: "#ef4444" }}
          >
            {updateProfile.error.message}
          </p>
        )}

        {/* Кнопка збереження */}
        <button
          type="submit"
          disabled={!canSave}
          onClick={() => haptic("light")}
          className="app-press w-full rounded-xl py-3 font-semibold transition-all disabled:opacity-40"
          style={
            canSave
              ? {
                  background: "var(--tg-theme-button-color)",
                  color: "var(--tg-theme-button-text-color)",
                  boxShadow: "var(--app-shadow)",
                }
              : {
                  background: "var(--app-surface)",
                  color: "currentColor",
                }
          }
        >
          {updateProfile.isPending ? "Зберігаємо…" : "Зберегти зміни"}
        </button>

        {/* Вийти з акаунту */}
        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => {
              haptic("medium");
              logout();
            }}
            className="text-xs opacity-50 hover:opacity-90 underline font-medium"
          >
            Вийти з профілю
          </button>
        </div>
      </form>
    </div>
  );
}
