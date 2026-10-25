import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useAddToCart, useCart, useLocations, useProduct, useUpdateCartItem } from "@/api/queries";
import { ErrorBox, ProductDetailSkeleton, Thumb, formatPrice } from "@/components/ui";
import { useBackButton } from "@/hooks/useBackButton";
import { haptic, hapticNotify } from "@/telegram/sdk";
import type { CartItemOption, OptionGroup, OptionSelection } from "@/api/types";
import {
  chipStyle,
  effectiveLimits,
  groupCost,
  isFixed,
  unitsIn,
  type Picks,
} from "@/utils/productOptions";
import { ProductOptionGroups } from "@/components/product/ProductOptionGroups";
import { ProductBottomBar } from "@/components/product/ProductBottomBar";

export function ProductPage() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = state as { location_id?: number; location_name?: string; editCartItemId?: number } | undefined;
  const editCartItemId = locationState?.editCartItemId ?? (searchParams.get("edit_cart_item") ? Number(searchParams.get("edit_cart_item")) : null);

  const { data: locations } = useLocations();
  const { data: cartData } = useCart();
  const handleBack = () => {
    haptic("light");
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/");
    }
  };
  useBackButton(handleBack);

  const { data, isPending, error, refetch } = useProduct(Number(productId));
  const addToCart = useAddToCart();
  const updateCartItem = useUpdateCartItem();

  const cartItemToEdit = useMemo(() => {
    if (!editCartItemId || !cartData?.items) return null;
    return cartData.items.find((it) => it.id === editCartItemId) ?? null;
  }, [editCartItemId, cartData]);

  const [variantId, setVariantId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(false);
  const [picked, setPicked] = useState<Record<number, Picks>>({});
  const optionsContainerRef = useRef<HTMLDivElement>(null);
  const initializedFromCart = useRef(false);

  useEffect(() => {
    if (cartItemToEdit && !initializedFromCart.current && data) {
      initializedFromCart.current = true;
      setQty(cartItemToEdit.qty);
      const matchingVariant = data.variants.find((v) => v.label === cartItemToEdit.variant_label);
      if (matchingVariant) {
        setVariantId(matchingVariant.id);
      }
      const initialPicks: Record<number, Picks> = {};
      for (const opt of cartItemToEdit.options) {
        if (!initialPicks[opt.group_id]) initialPicks[opt.group_id] = {};
        initialPicks[opt.group_id][opt.variant_id] = opt.qty;
      }
      setPicked(initialPicks);
    }
  }, [cartItemToEdit, data]);

  if (isPending) return <ProductDetailSkeleton />;
  if (error) return <ErrorBox message={error.message} onRetry={() => void refetch()} />;

  const selected = data.variants.find((v) => v.id === variantId) ?? data.variants[0];

  const picksFor = (group: OptionGroup): Picks => {
    if (picked[group.group_id] !== undefined) {
      return picked[group.group_id];
    }
    if (isFixed(group)) {
      return Object.fromEntries(group.items.map((i) => [i.variant_id, qty]));
    }
    // Для груп з одним товаром і безкоштовною квотою (наприклад, Васабі, Імбир)
    // за замовчуванням підставляємо включену безкоштовну кількість
    if (group.items.length === 1 && group.free_count > 0) {
      const q = Math.min(group.free_count, group.max_select || group.free_count);
      return { [group.items[0].variant_id]: q * qty };
    }
    if (group.min_select === 1 && group.max_select === 1 && group.items.length > 0) {
      return { [group.items[0].variant_id]: 1 * qty };
    }
    return {};
  };

  function setPicks(group: OptionGroup, next: Picks) {
    setShowErrors(false);
    setPicked((prev) => ({ ...prev, [group.group_id]: next }));
  }

  function pickOne(group: OptionGroup, optionVariantId: number) {
    const current = picksFor(group);
    haptic("light");
    if (current[optionVariantId] && group.min_select >= 1) {
      return;
    }
    setPicks(group, current[optionVariantId] ? {} : { [optionVariantId]: 1 });
  }

  function changeQty(group: OptionGroup, optionVariantId: number, delta: number) {
    const current = picksFor(group);
    const { max } = effectiveLimits(group, qty);

    if (delta > 0 && unitsIn(current) >= max) {
      hapticNotify("warning");
      return;
    }

    const next = { ...current };
    const value = (next[optionVariantId] ?? 0) + delta;
    if (value <= 0) delete next[optionVariantId];
    else next[optionVariantId] = value;

    haptic("light");
    setPicks(group, next);
  }

  const unfilled = data.option_groups.filter(
    (g) => unitsIn(picksFor(g)) < effectiveLimits(g, qty).min,
  );
  const overLimit = data.option_groups.filter(
    (g) => unitsIn(picksFor(g)) > effectiveLimits(g, qty).max,
  );
  const canAdd = Boolean(selected) && unfilled.length === 0 && overLimit.length === 0;

  const optionsDelta = data.option_groups.reduce(
    (sum, g) => sum + groupCost(g, picksFor(g), qty),
    0,
  );
  const total = selected ? selected.price * qty + optionsDelta : 0;

  const handleAddToCart = () => {
    if (!canAdd) {
      setShowErrors(true);
      hapticNotify("warning");
      return;
    }
    if (!selected) return;
    const options: OptionSelection[] = data.option_groups.flatMap((g) =>
      Object.entries(picksFor(g))
        .filter(([_, optionQty]) => optionQty > 0)
        .map(([optionVariantId, optionQty]) => ({
          group_id: g.group_id,
          variant_id: Number(optionVariantId),
          qty: optionQty,
        })),
    );
    const optionsDetails: CartItemOption[] = [];
    const groupFreeCount: Record<number, number> = {};

    for (const g of data.option_groups) {
      groupFreeCount[g.group_id] = g.free_count;
      const picks = picksFor(g);
      for (const item of g.items) {
        const pickedQty = picks[item.variant_id] ?? 0;
        if (pickedQty > 0) {
          optionsDetails.push({
            group_id: g.group_id,
            variant_id: item.variant_id,
            name: item.name,
            label: "порція",
            price_delta: item.price_delta,
            qty: pickedQty,
          });
        }
      }
    }

    const locId = locationState?.location_id ?? 1;
    const locName =
      locationState?.location_name ??
      locations?.find((l) => l.id === locId)?.name ??
      "Urban Pizza & Sushi";

    if (cartItemToEdit) {
      updateCartItem.mutate(
        {
          itemId: cartItemToEdit.id,
          variant_id: selected.id,
          qty,
          options,
          guest_meta: {
            variant_label: selected.label,
            weight: selected.weight,
            price: selected.price,
            options_details: optionsDetails,
            group_free_count: groupFreeCount,
          },
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            void navigate("/cart");
          },
          onError: () => hapticNotify("error"),
        },
      );
    } else {
      addToCart.mutate(
        {
          variant_id: selected.id,
          qty,
          options,
          guest_meta: {
            product_id: data.id,
            product_name: data.name,
            variant_label: selected.label,
            weight: selected.weight,
            price: selected.price,
            location_id: locId,
            location_name: locName,
            options_details: optionsDetails,
            group_free_count: groupFreeCount,
          },
        },
        {
          onSuccess: () => {
            hapticNotify("success");
            setAddedSuccess(true);
            setTimeout(() => setAddedSuccess(false), 2500);
          },
          onError: () => hapticNotify("error"),
        },
      );
    }
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col bg-[var(--tg-theme-bg-color)]">
      {/* Кнопка "Назад" */}
      <button
        type="button"
        onClick={handleBack}
        className="app-press fixed left-3.5 top-[max(0.875rem,calc(env(safe-area-inset-top)+0.5rem))] z-40 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white backdrop-blur-md shadow-lg border border-white/20 active:scale-95 text-lg font-bold transition-all"
        aria-label="Назад"
      >
        ←
      </button>

      {/* Скролована частина зі стравою та опціями */}
      <div className="flex-1 pb-6">
        <div className="relative overflow-hidden">
          <Thumb src={data.image_url} rounded="" className="aspect-[4/3] w-full text-6xl" eager />
          <div
            className="absolute inset-x-0 bottom-0 h-10 pointer-events-none"
            style={{
              background: "linear-gradient(to top, var(--tg-theme-bg-color), transparent)",
            }}
          />
        </div>

        <div className="px-4" ref={optionsContainerRef}>
          <div className="app-rise pt-3">
            <h1 className="text-2xl font-bold tracking-tight">{data.name}</h1>
            {data.description && (
              <p className="mt-2 text-sm leading-relaxed opacity-70">{data.description}</p>
            )}
          </div>

          {data.variants.length > 0 && (
            <div className="app-rise mt-5">
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider opacity-50">
                Варіант / Розмір
              </p>
              <div className="flex flex-wrap gap-2">
                {data.variants.map((v) => {
                  const active = v.id === selected?.id;
                  return (
                    <button
                      key={v.id}
                      onClick={() => {
                        haptic("light");
                        setVariantId(v.id);
                      }}
                      className="app-press rounded-xl px-3.5 py-2.5 text-left text-sm transition-all"
                      style={chipStyle(active)}
                    >
                      <span className="font-semibold">{v.label}</span>
                      {v.weight && <span className="ml-2 text-xs opacity-65">{v.weight}</span>}
                      <span className="ml-2.5 font-bold">{formatPrice(v.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <ProductOptionGroups
            optionGroups={data.option_groups}
            qty={qty}
            showErrors={showErrors}
            picksFor={picksFor}
            onPickOne={pickOne}
            onChangeQty={changeQty}
          />
        </div>
      </div>

      {/* Фіксована плаваюча панель дії внизу */}
      <ProductBottomBar
        qty={qty}
        setQty={setQty}
        total={total}
        canAdd={canAdd}
        showErrors={showErrors}
        unfilledNames={unfilled.map((g) => g.name.toLowerCase())}
        addedSuccess={addedSuccess}
        isPending={addToCart.isPending || updateCartItem.isPending}
        isEdit={Boolean(cartItemToEdit)}
        errorMessage={addToCart.isError ? addToCart.error.message : null}
        onAdd={handleAddToCart}
        onGoToCart={() => {
          haptic("light");
          navigate("/cart");
        }}
      />
    </div>
  );
}
