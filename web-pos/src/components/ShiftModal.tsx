import { useState } from "react";
import { addCashOperation, closePosShift, openPosShift } from "../api/client";
import type { PosShift, StaffMember } from "../types";

interface ShiftModalProps {
  locationId: number;
  currentStaff: StaffMember;
  shiftData: { isOpen: boolean; shift: PosShift | null };
  onClose: () => void;
  onRefreshShift: () => void;
}

export function ShiftModal({
  locationId,
  currentStaff,
  shiftData,
  onClose,
  onRefreshShift,
}: ShiftModalProps) {
  const { isOpen, shift } = shiftData;

  // View mode inside modal: "view" | "cash_op" | "close_form"
  const [mode, setMode] = useState<"view" | "cash_op" | "close_form">("view");

  // Open shift form
  const [openingCash, setOpeningCash] = useState<string>("500");
  const [openingNotes, setOpeningNotes] = useState<string>("");

  // Cash op form
  const [opType, setOpType] = useState<"cash_in" | "cash_out">("cash_in");
  const [opAmount, setOpAmount] = useState<string>("");
  const [opReason, setOpReason] = useState<string>("");

  // Close shift form
  const [actualCash, setActualCash] = useState<string>(
    shift ? String(shift.closing_cash_expected) : ""
  );
  const [closingNotes, setClosingNotes] = useState<string>("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleOpenShift = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      await openPosShift({
        location_id: locationId,
        opened_by_id: currentStaff.id,
        opened_by_name: currentStaff.staff_name,
        opening_cash: parseFloat(openingCash) || 0,
        notes: openingNotes.trim() || undefined,
      });
      onRefreshShift();
      setMode("view");
    } catch (err: any) {
      setErrorMsg(err.message || "Не вдалося відкрити зміну");
    } finally {
      setLoading(false);
    }
  };

  const handleCashOp = async () => {
    const val = parseFloat(opAmount);
    if (!val || val <= 0) {
      setErrorMsg("Введіть коректну суму");
      return;
    }
    if (!opReason.trim()) {
      setErrorMsg("Вкажіть причину операції");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await addCashOperation({
        location_id: locationId,
        staff_name: currentStaff.staff_name,
        operation_type: opType,
        amount: val,
        reason: opReason.trim(),
      });
      onRefreshShift();
      setOpAmount("");
      setOpReason("");
      setMode("view");
    } catch (err: any) {
      setErrorMsg(err.message || "Помилка проведення операції");
    } finally {
      setLoading(false);
    }
  };

  const handleCloseShift = async () => {
    const val = parseFloat(actualCash);
    if (isNaN(val) || val < 0) {
      setErrorMsg("Введіть фактичну суму готівки");
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await closePosShift({
        location_id: locationId,
        closed_by_id: currentStaff.id,
        closed_by_name: currentStaff.staff_name,
        closing_cash_actual: val,
        notes: closingNotes.trim() || undefined,
      });
      onRefreshShift();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Не вдалося закрити зміну");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-[#13171F] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <span className="text-xl">💼</span>
            <div>
              <h3 className="font-bold text-white text-sm">
                {!isOpen
                  ? "Відкриття касової зміни"
                  : mode === "close_form"
                  ? "Закриття зміни (Z-звіт)"
                  : mode === "cash_op"
                  ? "Службова операція з касою"
                  : `Касова зміна #${shift?.id}`}
              </h3>
              <p className="text-[11px] text-zinc-400">
                {currentStaff.staff_name} • {currentStaff.location_name || "Заклад"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs text-center font-medium">
              {errorMsg}
            </div>
          )}

          {/* 1. If Shift is CLOSED: Open Shift Form */}
          {!isOpen && (
            <div className="space-y-4 py-2">
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3 text-xs text-amber-300 space-y-1">
                <p className="font-bold">⚠️ Зміна наразі закрита</p>
                <p className="text-[11px] text-zinc-300">
                  Введіть розмінну готівку в касі на початок дня та натисніть «Відкрити зміну».
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Розмінна готівка в касі (грн)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder="500"
                  className="w-full bg-[#0B0D11] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                  Коментар (опціонально)
                </label>
                <input
                  type="text"
                  value={openingNotes}
                  onChange={(e) => setOpeningNotes(e.target.value)}
                  placeholder="Наприклад: ранкова зміна"
                  className="w-full bg-[#0B0D11] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleOpenShift}
                className="w-full py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-extrabold text-sm shadow-lg shadow-emerald-600/20 flex items-center justify-center space-x-2 cursor-pointer transition-all active:scale-95 mt-2"
              >
                <span>🟢</span>
                <span>Відкрити касову зміну</span>
              </button>
            </div>
          )}

          {/* 2. If Shift is OPEN: View mode */}
          {isOpen && shift && mode === "view" && (
            <div className="space-y-4">
              {/* Financial Snapshot */}
              <div className="bg-[#0B0D11] border border-white/5 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-white/5">
                  <span className="text-zinc-400">Відкрив:</span>
                  <span className="font-bold text-white">
                    {shift.opened_by_name} ({shift.opened_at_str})
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                  <div className="bg-[#13171F] p-2 rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-400 block uppercase">Початкова каса</span>
                    <span className="text-sm font-bold text-white">{shift.opening_cash} ₴</span>
                  </div>
                  <div className="bg-[#13171F] p-2 rounded-xl border border-white/5">
                    <span className="text-[10px] text-zinc-400 block uppercase">Чеків закрито</span>
                    <span className="text-sm font-bold text-amber-400">{shift.orders_count} шт</span>
                  </div>
                </div>

                {/* Revenue breakdown */}
                <div className="space-y-1 pt-1 text-xs">
                  <div className="flex justify-between text-zinc-300">
                    <span>💵 Виторг готівкою:</span>
                    <span className="font-bold text-white">{shift.cash_revenue} ₴</span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>💳 Виторг терміналом:</span>
                    <span className="font-bold text-white">{shift.card_revenue} ₴</span>
                  </div>
                  <div className="flex justify-between text-zinc-300">
                    <span>🎁 Списано бонусів:</span>
                    <span className="font-bold text-amber-300">{shift.bonus_spent_total} ₴</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-extrabold pt-1 border-t border-white/5">
                    <span>Загальний виторг:</span>
                    <span className="text-sm">{shift.total_revenue} ₴</span>
                  </div>
                </div>

                {/* Inflow / Outflow & Expected Cash */}
                <div className="pt-2 border-t border-white/5 text-xs space-y-1">
                  <div className="flex justify-between text-zinc-400">
                    <span>Службові внесення (+):</span>
                    <span className="font-semibold text-emerald-400">+{shift.cash_inflow} ₴</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>Службові вилучення (-):</span>
                    <span className="font-semibold text-rose-400">-{shift.cash_outflow} ₴</span>
                  </div>
                  <div className="flex justify-between items-baseline pt-1.5 border-t border-white/5">
                    <span className="font-bold text-zinc-200">Очікувана готівка в касі:</span>
                    <span className="text-lg font-black text-amber-400">
                      {shift.closing_cash_expected} ₴
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons: Cash Op & Close Shift */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("cash_op")}
                  className="py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1"
                >
                  <span>📥/📤</span>
                  <span>Внесення / Вилучення</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActualCash(String(shift.closing_cash_expected));
                    setMode("close_form");
                  }}
                  className="py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-black shadow-md shadow-amber-500/20 transition-all cursor-pointer flex items-center justify-center space-x-1"
                >
                  <span>🏁</span>
                  <span>Закрити зміну</span>
                </button>
              </div>

              {/* History of cash operations */}
              {shift.cash_operations && shift.cash_operations.length > 0 && (
                <div className="pt-2">
                  <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">
                    Останні операції зміни
                  </span>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {shift.cash_operations.map((op) => (
                      <div
                        key={op.id}
                        className="bg-[#0B0D11] border border-white/5 rounded-xl p-2 flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span
                              className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                                op.operation_type === "cash_in"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-rose-500/20 text-rose-300"
                              }`}
                            >
                              {op.operation_type === "cash_in" ? "+ Внесення" : "- Вилучення"}
                            </span>
                            <span className="text-zinc-400 text-[10px]">{op.time_str}</span>
                          </div>
                          <p className="text-zinc-300 text-[11px] mt-0.5">{op.reason}</p>
                        </div>
                        <span
                          className={`font-black ${
                            op.operation_type === "cash_in" ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {op.operation_type === "cash_in" ? "+" : "-"}
                          {op.amount} ₴
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 3. Cash Operation Form (Внесення / Вилучення) */}
          {isOpen && mode === "cash_op" && (
            <div className="space-y-3.5 py-1">
              <div className="grid grid-cols-2 gap-2 bg-[#0B0D11] p-1 rounded-2xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setOpType("cash_in")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    opType === "cash_in"
                      ? "bg-emerald-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  📥 Внесення
                </button>
                <button
                  type="button"
                  onClick={() => setOpType("cash_out")}
                  className={`py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    opType === "cash_out"
                      ? "bg-rose-600 text-white shadow"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  📤 Вилучення
                </button>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Сума (грн)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={opAmount}
                  onChange={(e) => setOpAmount(e.target.value)}
                  placeholder="наприклад: 200"
                  className="w-full bg-[#0B0D11] border border-white/10 rounded-xl px-3.5 py-2 text-sm text-white font-bold focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Причина операції
                </label>
                <input
                  type="text"
                  value={opReason}
                  onChange={(e) => setOpReason(e.target.value)}
                  placeholder="наприклад: розмін готівки, інкасація, закупівля серветок..."
                  className="w-full bg-[#0B0D11] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Назад
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCashOp}
                  className="flex-1 py-3 rounded-2xl bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-black shadow cursor-pointer transition-all"
                >
                  Зберегти операцію
                </button>
              </div>
            </div>
          )}

          {/* 4. Close Shift Form (Z-звіт) */}
          {isOpen && mode === "close_form" && shift && (
            <div className="space-y-3.5 py-1">
              <div className="bg-[#0B0D11] border border-white/5 rounded-2xl p-3 text-xs space-y-2">
                <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider pb-1 border-b border-white/5">
                  Касовий підсумок зміни
                </div>

                <div className="space-y-1 text-zinc-300">
                  <div className="flex justify-between">
                    <span>Початкова каса:</span>
                    <span className="font-semibold text-white">{shift.opening_cash} ₴</span>
                  </div>
                  <div className="flex justify-between">
                    <span>💵 Виторг готівкою:</span>
                    <span className="font-bold text-emerald-400">+{shift.cash_revenue} ₴</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>📥 Службові внесення:</span>
                    <span className="font-semibold text-emerald-300">+{shift.cash_inflow} ₴</span>
                  </div>
                  <div className="flex justify-between text-zinc-400">
                    <span>📤 Службові вилучення:</span>
                    <span className="font-semibold text-rose-400">-{shift.cash_outflow} ₴</span>
                  </div>
                </div>

                {/* Formula breakdown */}
                <div className="pt-2 border-t border-white/5 flex justify-between items-baseline">
                  <div>
                    <span className="font-bold text-amber-400 block text-xs">
                      Очікувана готівка в касі:
                    </span>
                    <span className="text-[10px] text-zinc-500 block">
                      (Початкова + Внесення + Готівка) - Вилучення
                    </span>
                  </div>
                  <span className="font-black text-amber-400 text-base">
                    {shift.closing_cash_expected} ₴
                  </span>
                </div>

                {/* Terminal Separately */}
                <div className="pt-2 border-t border-white/5 space-y-1">
                  <div className="flex justify-between items-center text-zinc-300">
                    <span className="flex items-center space-x-1">
                      <span>💳</span>
                      <span>Термінал (окремо, безготівка):</span>
                    </span>
                    <span className="font-bold text-cyan-400 text-xs">{shift.card_revenue} ₴</span>
                  </div>
                  {shift.bonus_spent_total > 0 && (
                    <div className="flex justify-between text-zinc-400 text-[11px]">
                      <span>🎁 Списано бонусів:</span>
                      <span className="font-semibold text-amber-300">{shift.bonus_spent_total} ₴</span>
                    </div>
                  )}
                  <div className="flex justify-between text-zinc-400 text-[11px] pt-1 border-t border-white/5">
                    <span>Всього замовлень:</span>
                    <span className="font-semibold text-white">{shift.orders_count}</span>
                  </div>
                  <div className="flex justify-between text-zinc-400 text-[11px]">
                    <span>Загальний оборот (готівка + картка):</span>
                    <span className="font-bold text-emerald-400">{shift.total_revenue} ₴</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Фактична готівка в касі (перераховано)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-[#0B0D11] border border-white/10 rounded-xl px-3.5 py-2 text-base text-white font-black focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Difference indicator */}
              {actualCash !== "" && !isNaN(parseFloat(actualCash)) && (
                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-zinc-400">Розбіжність каси:</span>
                  {(() => {
                    const diff = round2(parseFloat(actualCash) - shift.closing_cash_expected);
                    if (diff === 0) {
                      return <span className="font-bold text-emerald-400">Ідеально (0.00 ₴)</span>;
                    }
                    if (diff > 0) {
                      return <span className="font-bold text-amber-400">Надлишок +{diff} ₴</span>;
                    }
                    return <span className="font-bold text-rose-400">Нестача {diff} ₴</span>;
                  })()}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider block mb-1">
                  Примітки до закриття (опціонально)
                </label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Зауваження до каси..."
                  className="w-full bg-[#0B0D11] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setMode("view")}
                  className="flex-1 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold cursor-pointer transition-colors"
                >
                  Назад
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCloseShift}
                  className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-xs font-black shadow-lg shadow-rose-600/20 cursor-pointer transition-all active:scale-95"
                >
                  Підтвердити Z-звіт
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function round2(val: number): number {
  return Math.round(val * 100) / 100;
}
