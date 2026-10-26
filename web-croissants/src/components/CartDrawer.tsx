import { getImageUrl } from "../api/client.ts";
import { useCart } from "../context/CartContext.tsx";
import { useModalBehavior } from "../hooks/useModalBehavior.ts";

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenCheckout: () => void;
  isAuthenticated?: boolean;
}

export function CartDrawer({
  isOpen,
  onClose,
  onOpenCheckout,
  isAuthenticated = false,
}: CartDrawerProps) {
  useModalBehavior({ isOpen, onClose });

  const { items, totalQty, totalPrice, updateQty, removeItem, clearCart } = useCart();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Клік по фону для закриття */}
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#14171E] h-full flex flex-col shadow-2xl z-10 border-l border-white/10 animate-in slide-in-from-right duration-300 text-[#F1F5F9]">
        {/* Хедер кошика */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-[#181B22]">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🛍️</span>
            <div>
              <h2 className="font-display text-xl font-bold text-white">Ваш кошик</h2>
              <p className="text-xs text-[#94A3B8]">
                {totalQty > 0 ? `${totalQty} позицій у кошику` : "Поки що порожньо"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="w-9 h-9 rounded-full bg-[#1E232B] hover:bg-[#282F3B] text-white border border-white/10 flex items-center justify-center font-bold text-sm transition-transform active:scale-95 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Список страв */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4 text-[#94A3B8]">
              <div className="w-20 h-20 rounded-full bg-[#181B22] border border-white/10 flex items-center justify-center text-4xl shadow-inner">
                🥐
              </div>
              <div className="space-y-1">
                <p className="font-display text-lg font-bold text-white">
                  Кошик порожній
                </p>
                <p className="text-xs max-w-xs text-[#94A3B8]">
                  Оберіть хрусткі круасани, свіжу випічку або спешелті-каву у нашому меню
                </p>
              </div>
              <button
                onClick={onClose}
                type="button"
                className="bg-[#E69A38] hover:bg-[#D4892A] text-white px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
              >
                До меню
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl border border-white/10 bg-[#181B22] hover:bg-[#1C2028] transition-colors space-y-3"
              >
                <div className="flex items-start gap-3">
                  <img
                    src={getImageUrl(item.imageUrl)}
                    alt={item.productName}
                    className="w-16 h-16 rounded-xl object-cover bg-[#121419] border border-white/10"
                  />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-white truncate">
                      {item.productName}
                    </h4>
                    <div className="text-xs text-[#94A3B8] mt-0.5">
                      {item.variant.label}
                      {item.variant.weight &&
                        ` (${/[а-яА-Яa-zA-Z]/.test(item.variant.weight) ? item.variant.weight : `${item.variant.weight} г`})`}
                    </div>
                    {item.selectedOptions.length > 0 && (
                      <div className="text-[11px] text-[#E69A38] mt-1 line-clamp-2">
                        +{" "}
                        {item.selectedOptions
                          .map((o) =>
                            (o.qty && o.qty > 1)
                              ? `${o.option.name} × ${o.qty}`
                              : o.option.name,
                          )
                          .join(", ")}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => removeItem(item.id)}
                    type="button"
                    title="Видалити"
                    className="text-[#94A3B8] hover:text-red-400 transition-colors text-xs p-1 cursor-pointer"
                  >
                    🗑️
                  </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <div className="flex items-center gap-2 bg-[#121417] rounded-xl border border-white/10 p-1">
                    <button
                      onClick={() => updateQty(item.id, item.qty - 1)}
                      type="button"
                      className="w-6 h-6 rounded-lg text-xs font-bold text-white hover:bg-[#1E232B] flex items-center justify-center cursor-pointer"
                    >
                      −
                    </button>
                    <span className="w-5 text-center text-xs font-bold text-white">
                      {item.qty}
                    </span>
                    <button
                      onClick={() => updateQty(item.id, item.qty + 1)}
                      type="button"
                      className="w-6 h-6 rounded-lg text-xs font-bold text-white hover:bg-[#1E232B] flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  <div className="text-right">
                    <span className="font-extrabold text-sm text-white">
                      {item.itemSubtotal} ₴
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Футер кошика з кнопкою чекауту */}
        {items.length > 0 && (
          <div className="p-5 border-t border-white/10 bg-[#181B22] space-y-4">
            {/* Підказка щодо безкоштовної доставки */}
            <div
              className={`rounded-2xl p-3.5 border transition-all ${
                totalPrice >= 250
                  ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
                  : "bg-[#14171E] border-white/10 text-[#94A3B8]"
              } space-y-2`}
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold flex items-center gap-1.5">
                  {totalPrice >= 250 ? (
                    <>
                      <span className="text-sm">🎉</span>
                      <span>Безкоштовна доставка по Києву активна!</span>
                    </>
                  ) : (
                    <>
                      <span>🛵</span>
                      <span>
                        Додайте ще на{" "}
                        <strong className="text-[#E69A38] font-extrabold">
                          {250 - totalPrice} ₴
                        </strong>{" "}
                        для безкоштовної доставки
                      </span>
                    </>
                  )}
                </span>
                <span
                  className={`text-[11px] font-extrabold ${
                    totalPrice >= 250 ? "text-emerald-400" : "text-[#E69A38]"
                  }`}
                >
                  {Math.min(100, Math.round((totalPrice / 250) * 100))}%
                </span>
              </div>
              <div className="w-full h-2 bg-[#121417] rounded-full overflow-hidden border border-white/5">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    totalPrice >= 250
                      ? "bg-emerald-500"
                      : "bg-gradient-to-r from-[#C68B59] to-[#E69A38]"
                  }`}
                  style={{ width: `${Math.min(100, (totalPrice / 250) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-[#94A3B8] font-medium">Сума замовлення:</span>
              <span className="font-extrabold text-xl text-white">
                {totalPrice} ₴
              </span>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  onClose();
                  onOpenCheckout();
                }}
                type="button"
                className="w-full bg-[#E69A38] hover:bg-[#D4892A] text-white py-3.5 px-4 rounded-2xl font-bold text-base shadow-lg shadow-[#E69A38]/25 transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Оформити замовлення</span>
                <span>→</span>
              </button>

              {!isAuthenticated && (
                <p className="text-[11px] text-center text-[#94A3B8] flex items-center justify-center gap-1.5 pt-0.5">
                  <span>⚡</span>
                  <span>Швидке замовлення без обов’язкової реєстрації</span>
                </p>
              )}

              <button
                onClick={clearCart}
                type="button"
                className="w-full text-xs text-[#94A3B8] hover:text-red-400 transition-colors py-1 cursor-pointer"
              >
                Очистити весь кошик
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

