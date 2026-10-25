import { useState, useEffect, useMemo } from "react";
import {
  useAdminOrderDetail,
  useAdminVariantChoices,
  useUpdateAdminOrder,
  useNotifyAdminOrder,
  useAdminProducts,
  useAdminOptionGroups,
} from "@/api/queries";
import { Spinner, ErrorBox, formatPrice } from "@/components/ui";
import { haptic, hapticNotify } from "@/telegram/sdk";
import { useBackButton } from "@/hooks/useBackButton";
import { calculateItemOptionsWithFreeQuota } from "@/utils/productOptions";
import {
  AddOptionToItemModal,
  type OrderItemDraft,
  type OrderItemOptionDraft,
} from "./AddOptionToItemModal";
import { OrderCustomerFields } from "./orderEdit/OrderCustomerFields";
import { OrderItemsList } from "./orderEdit/OrderItemsList";
import { AddDishSubmodal } from "./orderEdit/AddDishSubmodal";
import { OrderSourceBadge } from "../OrderSourceBadge";

export function OrderEditModal({
  orderId,
  onClose,
}: {
  orderId: number;
  onClose: () => void;
}) {
  useBackButton(onClose);

  const { data: order, isPending, error } = useAdminOrderDetail(orderId);
  const { data: variantChoices = [] } = useAdminVariantChoices();
  const { data: adminProducts = [] } = useAdminProducts();
  const { data: adminOptionGroups = [] } = useAdminOptionGroups();

  const updateOrder = useUpdateAdminOrder();
  const notifyOrder = useNotifyAdminOrder();

  const [status, setStatus] = useState<string>("");
  const [scheduledTime, setScheduledTime] = useState<string>("");
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [contactName, setContactName] = useState<string>("");
  const [contactPhone, setContactPhone] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [items, setItems] = useState<OrderItemDraft[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const [addDishOpen, setAddDishOpen] = useState(false);
  const [targetItemIdx, setTargetItemIdx] = useState<number | null>(null);
  const [notified, setNotified] = useState(false);

  if (order && !isInitialized) {
    setStatus(order.status);
    setScheduledTime(order.scheduled_time || "");
    setDeliveryAddress(order.delivery_address || "");
    setContactName(order.contact_name);
    setContactPhone(order.contact_phone);
    setComment(order.comment || "");

    const initialItems: OrderItemDraft[] = [];
    for (const g of order.groups) {
      for (const it of g.items) {
        const choice = variantChoices.find((vc) => vc.variant_id === it.variant_id);
        const prod = adminProducts.find(
          (p) =>
            p.id === choice?.product_id ||
            (it.variant_id && p.variants.some((v) => v.id === it.variant_id)) ||
            p.name.toLowerCase() === it.product_name.toLowerCase()
        );

        initialItems.push({
          id: it.id,
          variant_id: it.variant_id,
          product_id: prod?.id ?? choice?.product_id ?? null,
          product_name: it.product_name,
          variant_label: it.variant_label,
          unit_price: it.unit_price,
          qty: it.qty,
          options: it.options.map((o) => ({
            option_group_name: o.option_group_name,
            option_name: o.option_name,
            price_delta: o.price_delta,
            qty: o.qty,
          })),
        });
      }
    }
    setItems(initialItems);
    setIsInitialized(true);
  }

  const getProductForDraft = (it: OrderItemDraft) => {
    return adminProducts.find(
      (p) =>
        (it.product_id && p.id === it.product_id) ||
        (it.variant_id && p.variants.some((v) => v.id === it.variant_id)) ||
        p.name.toLowerCase() === it.product_name.toLowerCase()
    );
  };

  const getOptionRulesForDraft = (it: OrderItemDraft) => {
    const prod = getProductForDraft(it);
    return prod?.option_groups ?? [];
  };

  const calculatedTotal = useMemo(() => {
    return items.reduce((sum, it) => {
      const rules = getOptionRulesForDraft(it);
      const calc = calculateItemOptionsWithFreeQuota(it.options, rules, it.unit_price, it.qty);
      return sum + calc.itemSubtotal;
    }, 0);
  }, [items, adminProducts]);

  const handleUpdateItemQty = (idx: number, delta: number) => {
    const next = [...items];
    const newQty = next[idx].qty + delta;
    if (newQty > 0) {
      next[idx].qty = newQty;
      setItems(next);
    }
  };

  const handleRemoveItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const handleUpdateOptionQty = (
    itemIdx: number,
    groupName: string,
    optName: string,
    delta: number
  ) => {
    const next = [...items];
    const targetItem = next[itemIdx];
    const existingIdx = targetItem.options.findIndex(
      (o) =>
        o.option_group_name.trim().toLowerCase() === groupName.trim().toLowerCase() &&
        o.option_name.trim().toLowerCase() === optName.trim().toLowerCase()
    );

    if (existingIdx >= 0) {
      const current = targetItem.options[existingIdx];
      const newQty = current.qty + delta;
      if (newQty <= 0) {
        targetItem.options = targetItem.options.filter((_, i) => i !== existingIdx);
      } else {
        targetItem.options[existingIdx] = { ...current, qty: newQty };
      }
      setItems(next);
    }
  };

  const handleRemoveOption = (itemIdx: number, groupName: string, optName: string) => {
    const next = [...items];
    const targetItem = next[itemIdx];
    targetItem.options = targetItem.options.filter(
      (o) =>
        !(
          o.option_group_name.trim().toLowerCase() === groupName.trim().toLowerCase() &&
          o.option_name.trim().toLowerCase() === optName.trim().toLowerCase()
        )
    );
    setItems(next);
  };

  const handleAddOptionToItem = (
    itemIdx: number,
    groupName: string,
    optName: string,
    priceDelta: number
  ) => {
    const next = [...items];
    const targetItem = next[itemIdx];
    const existingIdx = targetItem.options.findIndex(
      (o) =>
        o.option_group_name.trim().toLowerCase() === groupName.trim().toLowerCase() &&
        o.option_name.trim().toLowerCase() === optName.trim().toLowerCase()
    );

    if (existingIdx >= 0) {
      targetItem.options[existingIdx].qty += 1;
    } else {
      targetItem.options.push({
        option_group_name: groupName.trim() || "Додатки",
        option_name: optName.trim(),
        price_delta: priceDelta,
        qty: 1,
      });
    }
    setItems(next);
  };

  const handleSave = () => {
    if (items.length === 0) {
      alert("Замовлення повинно містити щонайменше одну позицію!");
      return;
    }

    const preparedItems = items.map((it) => {
      const rules = getOptionRulesForDraft(it);
      const calc = calculateItemOptionsWithFreeQuota(it.options, rules, it.unit_price, it.qty);

      const preparedOptions: OrderItemOptionDraft[] = [];
      for (const b of calc.breakdown) {
        if (b.freeQty > 0 && b.paidQty === 0) {
          preparedOptions.push({
            option_group_name: b.option_group_name,
            option_name: b.option_name,
            price_delta: 0,
            qty: b.freeQty,
          });
        } else if (b.freeQty > 0 && b.paidQty > 0) {
          preparedOptions.push({
            option_group_name: b.option_group_name,
            option_name: b.option_name,
            price_delta: 0,
            qty: b.freeQty,
          });
          preparedOptions.push({
            option_group_name: b.option_group_name,
            option_name: b.option_name,
            price_delta: b.price_delta,
            qty: b.paidQty,
          });
        } else {
          preparedOptions.push({
            option_group_name: b.option_group_name,
            option_name: b.option_name,
            price_delta: b.price_delta,
            qty: b.paidQty,
          });
        }
      }

      return {
        variant_id: it.variant_id,
        product_name: it.product_name,
        variant_label: it.variant_label,
        unit_price: it.unit_price,
        qty: it.qty,
        options: preparedOptions,
      };
    });

    haptic("medium");
    updateOrder.mutate(
      {
        orderId,
        payload: {
          status,
          scheduled_time: scheduledTime || null,
          delivery_address: deliveryAddress,
          contact_name: contactName,
          contact_phone: contactPhone,
          comment: comment || null,
          items: preparedItems,
        },
      },
      {
        onSuccess: () => {
          hapticNotify("success");
          onClose();
        },
      }
    );
  };

  const handleNotify = () => {
    haptic("medium");
    notifyOrder.mutate(orderId, {
      onSuccess: () => {
        setNotified(true);
        hapticNotify("success");
        setTimeout(() => setNotified(false), 3000);
      },
    });
  };

  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origOverflow;
    };
  }, []);

  if (isPending) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain">
        <div
          className="rounded-2xl p-6 shadow-2xl"
          style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
        >
          <Spinner />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overscroll-contain">
        <div
          className="rounded-2xl p-6 max-w-sm w-full shadow-2xl"
          style={{ background: "var(--tg-theme-bg-color, #ffffff)", border: "1px solid var(--app-border)" }}
        >
          <ErrorBox message={error?.message || "Замовлення не знайдено"} onRetry={onClose} />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4 overscroll-contain">
      <div
        className="w-full max-h-[90dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-4 sm:max-w-lg space-y-4 overscroll-contain touch-pan-y shadow-2xl"
        style={{
          background: "var(--tg-theme-bg-color, #ffffff)",
          border: "1px solid var(--app-border)",
          color: "var(--tg-theme-text-color)",
        }}
      >
        {/* Заголовок */}
        <div
          className="flex items-center justify-between border-b pb-3"
          style={{ borderColor: "var(--app-border)" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">Зміна замовлення #{order.id}</h3>
              <OrderSourceBadge
                source={order.source}
                tableNumber={order.table_number}
                staffName={order.staff_name}
                showDetails
              />
            </div>
            <p className="text-xs opacity-60">
              {order.fulfillment_type === "delivery" ? "🛵 Доставка" : "🛍️ Самовивіз"} • 📅{" "}
              {order.created_at}
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity">
            ✕
          </button>
        </div>

        {/* Примітка про клієнта */}
        {order.user_admin_note && (
          <div
            className="rounded-xl p-2.5 text-xs"
            style={{
              background: "color-mix(in srgb, #f59e0b 15%, transparent)",
              color: "#b45309",
            }}
          >
            ⚠️ <b>Примітка про клієнта:</b> {order.user_admin_note}
          </div>
        )}

        {/* Основні параметри клієнта та доставки */}
        <OrderCustomerFields
          status={status}
          setStatus={setStatus}
          scheduledTime={scheduledTime}
          setScheduledTime={setScheduledTime}
          deliveryAddress={deliveryAddress}
          setDeliveryAddress={setDeliveryAddress}
          contactName={contactName}
          setContactName={setContactName}
          contactPhone={contactPhone}
          setContactPhone={setContactPhone}
          comment={comment}
          setComment={setComment}
          fulfillmentType={order.fulfillment_type}
        />

        {/* Список страв та додатків */}
        <OrderItemsList
          items={items}
          adminProducts={adminProducts}
          onUpdateItemQty={handleUpdateItemQty}
          onRemoveItem={handleRemoveItem}
          onUpdateOptionQty={handleUpdateOptionQty}
          onRemoveOption={handleRemoveOption}
          onOpenAddOption={(idx) => setTargetItemIdx(idx)}
          onOpenAddDish={() => setAddDishOpen(true)}
        />

        {/* Підсумок */}
        <div
          className="flex items-center justify-between border-t pt-3"
          style={{ borderColor: "var(--app-border)" }}
        >
          <span className="text-sm font-bold">Разом до сплати:</span>
          <span className="text-lg font-bold" style={{ color: "var(--tg-theme-button-color)" }}>
            {formatPrice(calculatedTotal)}
          </span>
        </div>

        {/* Кнопки збереження та сповіщення */}
        <div className="space-y-2 pt-2">
          <button
            onClick={handleSave}
            disabled={updateOrder.isPending}
            className="app-press w-full rounded-xl py-3 text-sm font-bold shadow-sm"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            {updateOrder.isPending ? "Збереження..." : "💾 Зберегти зміни"}
          </button>

          {order.telegram_id ? (
            <button
              onClick={handleNotify}
              disabled={notifyOrder.isPending || notified}
              className="app-press w-full rounded-xl py-2.5 text-xs font-semibold border"
              style={{ borderColor: "var(--app-border)" }}
            >
              {notified
                ? "✅ Сповіщення надіслано в Telegram!"
                : notifyOrder.isPending
                ? "Надсилання..."
                : "💬 Надіслати оновлений чек клієнту в Telegram"}
            </button>
          ) : (
            <div
              className="w-full rounded-xl py-2.5 px-3 text-xs text-center font-medium opacity-75 border"
              style={{
                borderColor: "var(--app-border)",
                background: "var(--app-surface-2)",
              }}
            >
              ℹ️ Сповіщення в Telegram недоступне (замовлення оформлено з сайту без Telegram)
            </div>
          )}
        </div>

        {/* Модалка вибору страви для додавання */}
        <AddDishSubmodal
          isOpen={addDishOpen}
          onClose={() => setAddDishOpen(false)}
          variantChoices={variantChoices}
          onSelect={(vc) => {
            setItems([
              ...items,
              {
                variant_id: vc.variant_id,
                product_id: vc.product_id,
                product_name: vc.product_name,
                variant_label: vc.variant_label,
                unit_price: vc.price,
                qty: 1,
                options: [],
              },
            ]);
          }}
        />

        {/* Модалка додавання опції */}
        {targetItemIdx !== null && items[targetItemIdx] && (
          <AddOptionToItemModal
            item={items[targetItemIdx]}
            productId={
              items[targetItemIdx].product_id ??
              getProductForDraft(items[targetItemIdx])?.id ??
              null
            }
            adminOptionGroups={adminOptionGroups}
            onAddOption={(groupName, optName, priceDelta) => {
              handleAddOptionToItem(targetItemIdx, groupName, optName, priceDelta);
            }}
            onClose={() => setTargetItemIdx(null)}
          />
        )}
      </div>
    </div>
  );
}
