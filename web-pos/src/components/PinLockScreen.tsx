import { useState } from "react";
import type { StaffMember } from "../types";

interface PinLockScreenProps {
  staffList: StaffMember[];
  onSuccess: (staff: StaffMember, token: string) => void;
  onAuth: (pin: string, staffId?: number) => Promise<{ token: string; staff: StaffMember }>;
}

export function PinLockScreen({ staffList, onSuccess, onAuth }: PinLockScreenProps) {
  const [selectedStaff, setSelectedStaff] = useState<StaffMember | null>(null);
  const [pin, setPin] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleDigit = async (digit: string) => {
    if (loading) return;
    if (pin.length >= 6) return;

    const nextPin = pin + digit;
    setPin(nextPin);
    setError(null);

    // Auto submit on 4 digits
    if (nextPin.length === 4) {
      setLoading(true);
      try {
        const res = await onAuth(nextPin, selectedStaff?.id);
        onSuccess(res.staff, res.token);
      } catch (err: any) {
        setError(err.message || "Невірний PIN-код");
        setTimeout(() => {
          setPin("");
          setError(null);
        }, 1200);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleClear = () => {
    setPin("");
    setError(null);
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0B0D11] flex flex-col items-center justify-center p-3 sm:p-6 select-none overflow-y-auto">
      <div className="w-full max-w-sm sm:max-w-md bg-[#13171F] border border-white/10 rounded-3xl p-5 sm:p-7 shadow-2xl flex flex-col items-center my-auto">
        {/* Brand logo & header */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-xl sm:text-2xl shadow-inner shrink-0">
            ⚡
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white leading-tight">
              Urban POS
            </h1>
            <p className="text-[11px] sm:text-xs text-zinc-400">Термінал офіціанта</p>
          </div>
        </div>

        {/* Staff selector pills */}
        <div className="w-full mb-3 sm:mb-4">
          <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5 text-center">
            Працівник зміни:
          </label>
          <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center max-h-28 sm:max-h-36 overflow-y-auto p-1">
            {staffList.map((s) => {
              const isSelected = selectedStaff?.id === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setSelectedStaff(s);
                    setPin("");
                    setError(null);
                  }}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all duration-150 flex items-center space-x-1.5 sm:space-x-2 border cursor-pointer ${
                    isSelected
                      ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-md shadow-amber-500/10"
                      : "bg-[#1A1F2B] border-white/5 text-zinc-300 hover:border-white/20"
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span className="truncate max-w-[130px]">{s.staff_name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* PIN dots display */}
        <div className="flex items-center space-x-3 sm:space-x-4 my-2 sm:my-3">
          {[0, 1, 2, 3].map((idx) => (
            <div
              key={idx}
              className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full transition-all duration-200 ${
                pin.length > idx
                  ? error
                    ? "bg-rose-500 scale-125 shadow-lg shadow-rose-500/50"
                    : "bg-amber-400 scale-110 shadow-lg shadow-amber-400/50"
                  : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {error && (
          <p className="text-xs sm:text-sm font-medium text-rose-400 my-1 animate-bounce">
            {error}
          </p>
        )}

        {/* Numeric touch keypad */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full max-w-[260px] sm:max-w-[280px] mt-1 sm:mt-2">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={loading}
              onClick={() => handleDigit(digit)}
              className="h-13 sm:h-16 rounded-xl sm:rounded-2xl bg-[#1C2230] hover:bg-[#252D40] active:scale-95 text-xl sm:text-2xl font-bold text-white border border-white/5 shadow transition-all cursor-pointer flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            disabled={loading}
            onClick={handleClear}
            className="h-13 sm:h-16 rounded-xl sm:rounded-2xl bg-[#1C2230]/60 hover:bg-[#252D40] active:scale-95 text-xs sm:text-sm font-semibold text-zinc-400 border border-white/5 transition-all cursor-pointer flex items-center justify-center"
          >
            C
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => handleDigit("0")}
            className="h-13 sm:h-16 rounded-xl sm:rounded-2xl bg-[#1C2230] hover:bg-[#252D40] active:scale-95 text-xl sm:text-2xl font-bold text-white border border-white/5 shadow transition-all cursor-pointer flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleBackspace}
            className="h-13 sm:h-16 rounded-xl sm:rounded-2xl bg-[#1C2230]/60 hover:bg-[#252D40] active:scale-95 text-base sm:text-lg font-bold text-zinc-400 border border-white/5 transition-all cursor-pointer flex items-center justify-center"
          >
            ⌫
          </button>
        </div>

        <p className="text-[10px] sm:text-[11px] text-zinc-500 mt-4 text-center">
          Тестовий PIN: <code className="text-zinc-300 bg-white/5 px-1 py-0.5 rounded">1111</code> або <code className="text-zinc-300 bg-white/5 px-1 py-0.5 rounded">2222</code>
        </p>
      </div>
    </div>
  );
}
