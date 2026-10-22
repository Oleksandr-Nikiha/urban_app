import React from "react";

interface CheckoutBonusRedeemProps {
  userBalance: number;
  orderTotal: number;
  bonusToSpend: number;
  onChangeBonusToSpend: (value: number) => void;
}

export const CheckoutBonusRedeem: React.FC<CheckoutBonusRedeemProps> = ({
  userBalance,
  orderTotal,
  bonusToSpend,
  onChangeBonusToSpend,
}) => {
  if (userBalance <= 0) return null;

  const maxAllowed = Math.min(userBalance, orderTotal);

  const handleMaxClick = () => {
    onChangeBonusToSpend(maxAllowed);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    if (isNaN(val)) return;
    const clamped = Math.max(0, Math.min(val, maxAllowed));
    onChangeBonusToSpend(clamped);
  };

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-800 p-4 mb-4 transition-all">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 text-base">🪙</span>
          <span className="text-sm font-semibold text-white">Оплата бонусами URBAN CLUB</span>
        </div>
        <span className="text-xs text-slate-400">
          Доступно: <strong className="text-amber-400">{userBalance}</strong>
        </span>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <div className="relative flex-1">
          <input
            type="number"
            min={0}
            max={maxAllowed}
            value={bonusToSpend || ""}
            onChange={handleInputChange}
            placeholder="0"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:border-amber-500 text-sm placeholder-slate-600"
          />
          <span className="absolute right-3 top-2.5 text-xs text-slate-500 font-medium">
            бонусів
          </span>
        </div>
        <button
          type="button"
          onClick={handleMaxClick}
          className="px-3 py-2 rounded-xl text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 active:scale-95 transition-all"
        >
          Списати макс.
        </button>
      </div>

      {bonusToSpend > 0 && (
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-800/80 text-xs">
          <span className="text-slate-400">Знижка за бонуси:</span>
          <span className="text-emerald-400 font-semibold">-{bonusToSpend} ₴</span>
        </div>
      )}
    </div>
  );
};
