import { useEffect, useState } from "react";
import type { PosShift, StaffMember } from "../types";

interface PosHeaderProps {
  currentLocationId: number;
  onLocationChange: (locId: number) => void;
  staff: StaffMember;
  activeOrdersCount: number;
  activeTab: "terminal" | "orders";
  onTabChange: (tab: "terminal" | "orders") => void;
  onLock: () => void;
  shiftData: { isOpen: boolean; shift: PosShift | null };
  onOpenShiftModal: () => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export function PosHeader({
  currentLocationId,
  onLocationChange,
  staff,
  activeOrdersCount,
  activeTab,
  onTabChange,
  onLock,
  shiftData,
  onOpenShiftModal,
  soundEnabled,
  onToggleSound,
}: PosHeaderProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("uk-UA", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const { isOpen, shift } = shiftData;

  return (
    <header className="h-14 sm:h-16 bg-[#13171F] border-b border-white/10 px-3 sm:px-5 flex items-center justify-between shrink-0 select-none gap-2">
      {/* Brand & Location Selector */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        <div className="flex items-center space-x-1 sm:space-x-2">
          <span className="text-xl sm:text-2xl">⚡</span>
          <span className="font-bold text-sm sm:text-lg text-white tracking-tight hidden xs:inline">
            POS
          </span>
        </div>

        <div className="h-5 w-px bg-white/10 hidden sm:block" />

        {/* Location toggle */}
        <div className="flex bg-[#0B0D11] p-0.5 sm:p-1 rounded-xl border border-white/5">
          <button
            type="button"
            onClick={() => onLocationChange(1)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
              currentLocationId === 1
                ? "bg-amber-500 text-black shadow-md font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>🍕</span>
            <span className="hidden md:inline">Pizza & Sushi</span>
          </button>
          <button
            type="button"
            onClick={() => onLocationChange(2)}
            className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer flex items-center space-x-1 ${
              currentLocationId === 2
                ? "bg-amber-500 text-black shadow-md font-bold"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>🥐</span>
            <span className="hidden md:inline">Bakery</span>
          </button>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex items-center space-x-1 bg-[#0B0D11] p-0.5 sm:p-1 rounded-xl border border-white/5">
        <button
          type="button"
          onClick={() => onTabChange("terminal")}
          className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 sm:space-x-1.5 ${
            activeTab === "terminal"
              ? "bg-[#1E2533] text-amber-400 border border-amber-500/30 shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <span>🛒</span>
          <span className="hidden sm:inline">Термінал</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange("orders")}
          className={`px-2.5 sm:px-4 py-1 sm:py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 sm:space-x-1.5 ${
            activeTab === "orders"
              ? "bg-[#1E2533] text-amber-400 border border-amber-500/30 shadow"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <span>📋</span>
          <span className="hidden sm:inline">Чеки</span>
          {activeOrdersCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-extrabold text-[10px]">
              {activeOrdersCount}
            </span>
          )}
        </button>
      </div>

      {/* Shift status, Sound toggle, Staff badge, Clock & Lock */}
      <div className="flex items-center space-x-2 sm:space-x-2.5 shrink-0">
        {/* Shift status button */}
        <button
          type="button"
          onClick={onOpenShiftModal}
          className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer active:scale-95 flex items-center space-x-1.5 ${
            isOpen
              ? "bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
              : "bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border-rose-500/30 animate-pulse"
          }`}
          title="Керування касовою зміною"
        >
          <span className={`w-2 h-2 rounded-full ${isOpen ? "bg-emerald-400" : "bg-rose-400"}`} />
          <span className="hidden sm:inline">
            {isOpen ? `Зміна #${shift?.id || ""}` : "Каса закрита"}
          </span>
          <span className="sm:hidden">
            {isOpen ? "Каса" : "Закрито"}
          </span>
        </button>

        {/* Sound toggle button */}
        <button
          type="button"
          onClick={onToggleSound}
          title={soundEnabled ? "Звукові сповіщення увімкнено (натисніть щоб вимкнути)" : "Звукові сповіщення вимкнено"}
          className={`p-2 rounded-xl border text-xs sm:text-sm transition-all cursor-pointer active:scale-95 ${
            soundEnabled
              ? "bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30"
              : "bg-white/5 hover:bg-white/10 text-zinc-500 border-white/10"
          }`}
        >
          {soundEnabled ? "🔔" : "🔕"}
        </button>

        {/* Clock */}
        <div className="text-right hidden xl:block">
          <p className="text-xs font-bold text-white">{time}</p>
          <p className="text-[10px] text-zinc-400">Київ</p>
        </div>

        {/* Staff badge */}
        <div className="flex items-center space-x-1.5 bg-[#1A1F2B] border border-white/5 px-2 sm:px-3 py-1 rounded-xl">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <p className="text-xs font-bold text-zinc-200 leading-tight max-w-[70px] sm:max-w-[110px] truncate">
            {staff.staff_name}
          </p>
        </div>

        {/* Lock button */}
        <button
          type="button"
          onClick={onLock}
          title="Заблокувати термінал"
          className="p-2 sm:p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 transition-all cursor-pointer active:scale-95 flex items-center justify-center text-xs sm:text-sm shrink-0"
        >
          🔒
        </button>
      </div>
    </header>
  );
}
