import { useState } from "react";
import { useProduct, useAdminOptionGroupItems } from "@/api/queries";
import { Spinner, formatPrice } from "@/components/ui";
import { haptic } from "@/telegram/sdk";
import { useBackButton } from "@/hooks/useBackButton";
import type { AdminOptionGroup } from "@/api/types";

export interface OrderItemOptionDraft {
  option_group_name: string;
  option_name: string;
  price_delta: number;
  qty: number;
}

export interface OrderItemDraft {
  id?: number;
  variant_id?: number | null;
  product_id?: number | null;
  product_name: string;
  variant_label: string;
  unit_price: number;
  qty: number;
  options: OrderItemOptionDraft[];
}

export function AddOptionToItemModal({
  item,
  productId,
  adminOptionGroups,
  onAddOption,
  onClose,
}: {
  item: OrderItemDraft;
  productId: number | null;
  adminOptionGroups: AdminOptionGroup[];
  onAddOption: (groupName: string, optName: string, priceDelta: number) => void;
  onClose: () => void;
}) {
  useBackButton(onClose);

  const { data: productDetail, isPending: prodLoading } = useProduct(productId ?? 0);

  const hasLinked = Boolean(
    productDetail?.option_groups && productDetail.option_groups.length > 0
  );

  const [activeTab, setActiveTab] = useState<"linked" | "existing" | "custom">("linked");
  const [selectedDbGroupId, setSelectedDbGroupId] = useState<number>(() => {
    return adminOptionGroups.length > 0 ? adminOptionGroups[0].id : 0;
  });

  const { data: dbGroupItems = [], isPending: dbItemsLoading } = useAdminOptionGroupItems(
    activeTab === "existing" ? selectedDbGroupId : 0
  );

  const [customGroup, setCustomGroup] = useState("Додатки");
  const [customName, setCustomName] = useState("");
  const [customPrice, setCustomPrice] = useState("0");

  const selectedGroupName =
    adminOptionGroups.find((g) => g.id === selectedDbGroupId)?.name || "Додатки";

  const totalAddedOpts = item.options.reduce((s, o) => s + o.qty, 0);

  return (
    <div className="fixed inset-0 z-60 flex items-end justify-center bg-black/70 sm:items-center p-0 sm:p-4 overscroll-contain">
      <div
        className="w-full max-h-[85dvh] overflow-y-auto rounded-t-3xl sm:rounded-2xl p-4 sm:max-w-md space-y-4 overscroll-contain touch-pan-y shadow-2xl"
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
            <h4 className="text-sm font-bold">Додати додатки / опції</h4>
            <p className="text-xs opacity-60 truncate max-w-[260px]">
              {item.product_name} ({item.variant_label})
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity"
          >
            ✕
          </button>
        </div>

        {/* Перемикач вкладок */}
        <div
          className="grid grid-cols-3 gap-1 rounded-xl p-1 text-xs font-semibold"
          style={{ background: "var(--app-surface-2)" }}
        >
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setActiveTab("linked");
            }}
            className={`app-press rounded-lg py-2 text-center transition-all ${
              activeTab === "linked" ? "shadow-sm font-bold" : "opacity-65"
            }`}
            style={
              activeTab === "linked"
                ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                : undefined
            }
          >
            ⭐ Прив'язані
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setActiveTab("existing");
            }}
            className={`app-press rounded-lg py-2 text-center transition-all ${
              activeTab === "existing" ? "shadow-sm font-bold" : "opacity-65"
            }`}
            style={
              activeTab === "existing"
                ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                : undefined
            }
          >
            📋 З меню
          </button>
          <button
            type="button"
            onClick={() => {
              haptic("light");
              setActiveTab("custom");
            }}
            className={`app-press rounded-lg py-2 text-center transition-all ${
              activeTab === "custom" ? "shadow-sm font-bold" : "opacity-65"
            }`}
            style={
              activeTab === "custom"
                ? { background: "var(--tg-theme-bg-color)", color: "var(--tg-theme-text-color)" }
                : undefined
            }
          >
            ✏️ Власний
          </button>
        </div>

        {/* ВМІСТ: 1. Прив'язані додатки до страви */}
        {activeTab === "linked" && (
          <div className="space-y-3 min-h-[140px]">
            {prodLoading ? (
              <div className="py-6">
                <Spinner />
              </div>
            ) : hasLinked && productDetail ? (
              <div className="space-y-3">
                {productDetail.option_groups.map((group) => {
                  const freeLabel =
                    group.free_count > 0
                      ? group.free_count * item.qty === 1
                        ? "1 включено"
                        : `${group.free_count * item.qty} включено`
                      : "";

                  return (
                    <div
                      key={group.group_id}
                      className="rounded-xl p-3 border space-y-2 text-xs"
                      style={{
                        borderColor: "var(--app-border)",
                        background: "var(--app-surface-2)",
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs">{group.name}</span>
                        {freeLabel && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                            🎁 {freeLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {group.items.map((opt) => {
                          const alreadyPickedQty =
                            item.options.find(
                              (o) =>
                                o.option_group_name.trim().toLowerCase() ===
                                  group.name.trim().toLowerCase() &&
                                o.option_name.trim().toLowerCase() ===
                                  opt.name.trim().toLowerCase()
                            )?.qty ?? 0;

                          return (
                            <button
                              key={opt.variant_id}
                              type="button"
                              onClick={() => {
                                haptic("light");
                                onAddOption(group.name, opt.name, opt.price_delta);
                              }}
                              className="app-press inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border shadow-sm transition-all"
                              style={{
                                background:
                                  alreadyPickedQty > 0
                                    ? "var(--app-tint)"
                                    : "var(--tg-theme-bg-color)",
                                borderColor:
                                  alreadyPickedQty > 0
                                    ? "var(--tg-theme-button-color)"
                                    : "var(--app-border)",
                                color:
                                  alreadyPickedQty > 0
                                    ? "var(--tg-theme-button-color)"
                                    : "var(--tg-theme-text-color)",
                              }}
                            >
                              <span>+ {opt.name}</span>
                              <span className="opacity-60 text-[10px]">
                                ({opt.price_delta > 0 ? `+${formatPrice(opt.price_delta)}` : "0 ₴"})
                              </span>
                              {alreadyPickedQty > 0 && (
                                <span className="rounded-full bg-emerald-500 text-white text-[9px] px-1 font-bold">
                                  ×{alreadyPickedQty}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                className="rounded-xl p-4 text-center space-y-2 border"
                style={{ borderColor: "var(--app-border)", background: "var(--app-surface-2)" }}
              >
                <div className="text-2xl">🍽️</div>
                <p className="text-xs font-medium">До цієї страви немає прив'язаних додатків у БД</p>
                <p className="text-[11px] opacity-60">
                  Ви можете обрати соуси/додатки із загального меню або додати власний вручну.
                </p>
                <div className="flex justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("existing")}
                    className="app-press rounded-xl px-3 py-1.5 text-xs font-semibold"
                    style={{ background: "var(--app-tint)", color: "var(--tg-theme-button-color)" }}
                  >
                    📋 Обрати з меню
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("custom")}
                    className="app-press rounded-xl px-3 py-1.5 text-xs font-semibold border"
                    style={{ borderColor: "var(--app-border)" }}
                  >
                    ✏️ Власний
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ВМІСТ: 2. Всі наявні в меню (будь-яка група з БД) */}
        {activeTab === "existing" && (
          <div className="space-y-3 min-h-[140px]">
            <div>
              <label className="block mb-1 text-xs font-semibold opacity-70">
                Група додатків із БД:
              </label>
              <select
                value={selectedDbGroupId}
                onChange={(e) => setSelectedDbGroupId(Number(e.target.value))}
                className="w-full rounded-xl border border-[var(--app-border)] p-2.5 text-xs font-medium outline-none"
                style={{ background: "var(--app-surface-2)", color: "var(--tg-theme-text-color)" }}
              >
                {adminOptionGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.items_count} поз.)
                  </option>
                ))}
              </select>
            </div>

            {dbItemsLoading ? (
              <div className="py-4">
                <Spinner />
              </div>
            ) : dbGroupItems.length === 0 ? (
              <div className="text-center py-4 text-xs opacity-60">
                У цій групі немає наявних позицій
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[35vh] overflow-y-auto">
                <p className="text-[11px] font-semibold opacity-60">
                  Натисніть на додаток, щоб додати до страви:
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {dbGroupItems.map((gi) => {
                    const optLabel = gi.variant_label || gi.product_name;
                    const alreadyPickedQty =
                      item.options.find(
                        (o) =>
                          o.option_group_name.trim().toLowerCase() ===
                            selectedGroupName.trim().toLowerCase() &&
                          o.option_name.trim().toLowerCase() === optLabel.trim().toLowerCase()
                      )?.qty ?? 0;

                    return (
                      <button
                        key={gi.variant_id}
                        type="button"
                        onClick={() => {
                          haptic("light");
                          onAddOption(selectedGroupName, optLabel, gi.price_delta);
                        }}
                        className="app-press inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs font-semibold border shadow-sm transition-all"
                        style={{
                          background:
                            alreadyPickedQty > 0
                              ? "var(--app-tint)"
                              : "var(--tg-theme-bg-color)",
                          borderColor:
                            alreadyPickedQty > 0
                              ? "var(--tg-theme-button-color)"
                              : "var(--app-border)",
                          color:
                            alreadyPickedQty > 0
                              ? "var(--tg-theme-button-color)"
                              : "var(--tg-theme-text-color)",
                        }}
                      >
                        <span>+ {optLabel}</span>
                        <span className="opacity-60 text-[10px]">
                          ({gi.price_delta > 0 ? `+${gi.price_delta} ₴` : "0 ₴"})
                        </span>
                        {alreadyPickedQty > 0 && (
                          <span className="rounded-full bg-emerald-500 text-white text-[9px] px-1 font-bold">
                            ×{alreadyPickedQty}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ВМІСТ: 3. Власний додаток (кастомний текст) */}
        {activeTab === "custom" && (
          <div className="space-y-2.5 text-xs min-h-[140px]">
            <div>
              <label className="block mb-1 font-semibold opacity-70">Назва групи:</label>
              <input
                type="text"
                value={customGroup}
                onChange={(e) => setCustomGroup(e.target.value)}
                placeholder="Наприклад: Додатки, Побажання..."
                className="w-full rounded-xl p-2.5 outline-none border border-[var(--app-border)] font-medium"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold opacity-70">
                Назва додатку / побажання:
              </label>
              <input
                type="text"
                placeholder="Наприклад: Подвійний сир, Без цибулі..."
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                className="w-full rounded-xl p-2.5 outline-none border border-[var(--app-border)] font-medium"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>
            <div>
              <label className="block mb-1 font-semibold opacity-70">Доплата (₴):</label>
              <input
                type="number"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full rounded-xl p-2.5 outline-none border border-[var(--app-border)] font-medium"
                style={{ background: "var(--app-surface-2)" }}
              />
            </div>

            <button
              type="button"
              onClick={() => {
                if (!customName.trim()) return;
                haptic("light");
                onAddOption(
                  customGroup.trim() || "Додатки",
                  customName.trim(),
                  parseFloat(customPrice) || 0
                );
                setCustomName("");
                setCustomPrice("0");
              }}
              className="app-press w-full rounded-xl py-2.5 text-xs font-bold shadow-sm mt-1"
              style={{
                background: "var(--tg-theme-button-color)",
                color: "var(--tg-theme-button-text-color)",
              }}
            >
              + Додати цей кастомний додаток
            </button>
          </div>
        )}

        {/* Підсумок доданих опцій та кнопка закриття */}
        <div
          className="flex items-center justify-between border-t pt-3"
          style={{ borderColor: "var(--app-border)" }}
        >
          <span className="text-xs opacity-70">
            Додано опцій до страви: <b>{totalAddedOpts}</b>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="app-press rounded-xl px-4 py-2 text-xs font-bold"
            style={{
              background: "var(--tg-theme-button-color)",
              color: "var(--tg-theme-button-text-color)",
            }}
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
