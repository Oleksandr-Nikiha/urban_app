import { useState, useMemo } from "react";
import {
  useAdminLocationsDelivery,
  useUpdateLocationDelivery,
} from "@/api/queries";
import type { LocationDeliverySettings } from "@/api/types";
import { EmptyState, ErrorBox, Spinner } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";
import { LocationDeliveryCard } from "./delivery/LocationDeliveryCard";
import { DeliveryAddressesAdminSection } from "./delivery/DeliveryAddressesAdminSection";

// ============================================================================
// 5. ВКЛАДКА НАЛАШТУВАННЯ ДОСТАВКИ ТА НАВАНТАЖЕННЯ
// ============================================================================

interface DeliverySettingsTabProps {
  locationId?: number | null;
  isSuperAdmin: boolean;
}

export function DeliverySettingsTab({ locationId }: DeliverySettingsTabProps) {
  const [subTab, setSubTab] = useState<"locations" | "addresses">("locations");
  const { data: deliverySettings = [], isPending, error, refetch } = useAdminLocationsDelivery();
  const updateDelivery = useUpdateLocationDelivery();

  const filtered = useMemo(() => {
    if (!locationId) return deliverySettings;
    return deliverySettings.filter((loc: LocationDeliverySettings) => loc.id === locationId);
  }, [deliverySettings, locationId]);

  if (isPending) return <Spinner />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  return (
    <div className="space-y-4">
      {/* Підвкладки: Заклади / Адреси */}
      <div
        className="flex rounded-xl p-1 text-xs font-semibold"
        style={{ background: "var(--app-surface-2)" }}
      >
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setSubTab("locations");
          }}
          className={`app-press flex-1 rounded-lg py-2 transition-all ${
            subTab === "locations"
              ? "bg-[var(--app-surface)] shadow-sm font-bold text-[var(--tg-theme-text-color)]"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          🛵 Заклади та години
        </button>
        <button
          type="button"
          onClick={() => {
            haptic("light");
            setSubTab("addresses");
          }}
          className={`app-press flex-1 rounded-lg py-2 transition-all ${
            subTab === "addresses"
              ? "bg-[var(--app-surface)] shadow-sm font-bold text-[var(--tg-theme-text-color)]"
              : "opacity-60 hover:opacity-100"
          }`}
        >
          📍 Довідник адрес (Стоплист)
        </button>
      </div>

      {subTab === "locations" ? (
        <div className="space-y-4">
          <div
            className="rounded-2xl p-4 text-xs leading-relaxed border"
            style={{
              background: "var(--app-tint)",
              color: "var(--tg-theme-link-color)",
              borderColor: "color-mix(in srgb, var(--tg-theme-link-color) 30%, transparent)",
            }}
          >
            <p className="font-semibold text-[13px] flex items-center gap-1.5">
              <span>🛵</span>
              <span>Керування доставкою та навантаженням</span>
            </p>
            <p className="mt-1 opacity-90">
              У разі перевантаження кухні або браку кур'єрів ви можете <b>вимкнути доставку</b> для
              закладу в один клік. Клієнти зможуть оформлювати замовлення виключно на самовивіз.
              Також тут налаштовуються години роботи доставки.
            </p>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon="🛵"
              title="Закладів не знайдено"
              hint="Не вдалося знайти налаштування для обраного закладу"
            />
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filtered.map((loc: LocationDeliverySettings) => (
                <LocationDeliveryCard
                  key={loc.id}
                  location={loc}
                  onUpdate={(payload) => {
                    updateDelivery.mutate(
                      { locationId: loc.id, payload },
                      {
                        onSuccess: () => hapticNotify("success"),
                        onError: () => hapticNotify("error"),
                      }
                    );
                  }}
                  isUpdating={updateDelivery.isPending}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <DeliveryAddressesAdminSection />
      )}
    </div>
  );
}
