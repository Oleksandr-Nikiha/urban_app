import React, { useEffect, useState } from "react";
import { bonusApi } from "../api/client";
import { BonusMeResponse } from "../api/types";

export const BonusWidget: React.FC = () => {
  const [bonus, setBonus] = useState<BonusMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    bonusApi
      .getMyBonuses()
      .then(setBonus)
      .catch(() => setBonus(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse bg-slate-900/80 border border-slate-800 rounded-2xl p-4 h-24 mb-4" />
    );
  }

  if (!bonus) return null;

  const progressPercent = bonus.next_tier_threshold
    ? Math.min(100, Math.round((bonus.total_spent / bonus.next_tier_threshold) * 100))
    : 100;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 border border-amber-500/20 p-4 shadow-xl mb-4 transition-all hover:border-amber-500/40">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/10 text-amber-400 font-bold text-sm border border-amber-500/30">
            ★
          </span>
          <div>
            <span className="text-xs font-semibold tracking-wider text-amber-400 uppercase">URBAN CLUB</span>
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {bonus.tier_name}
            </span>
          </div>
        </div>
        <div className="text-xs font-medium px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          {bonus.cashback_rate}% кешбек
        </div>
      </div>

      <div className="flex items-baseline justify-between mt-1">
        <div>
          <div className="text-2xl font-black tracking-tight text-white">
            {bonus.bonus_balance} <span className="text-sm font-normal text-amber-400/90">бонусів</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            1 бонус = 1 ₴ на наступні замовлення
          </p>
        </div>
        {bonus.next_tier_name && bonus.amount_to_next_tier && (
          <div className="text-right text-xs text-slate-400">
            Ще <span className="font-semibold text-slate-200">{bonus.amount_to_next_tier} ₴</span> до{" "}
            <span className="text-amber-400 font-medium">{bonus.next_tier_name}</span>
          </div>
        )}
      </div>

      {bonus.next_tier_threshold && (
        <div className="mt-3 w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-emerald-400 h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
};
