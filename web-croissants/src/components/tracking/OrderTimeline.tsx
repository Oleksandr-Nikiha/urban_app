interface StepInfo {
  stepIndex: number;
  isCancelled?: boolean;
  isCompleted?: boolean;
  title: string;
  desc: string;
  badge: string;
}

interface StepItem {
  label: string;
  icon: string;
}

export interface OrderTimelineProps {
  currentStepInfo: StepInfo;
  stepsList: StepItem[];
}

export function OrderTimeline({ currentStepInfo, stepsList }: OrderTimelineProps) {
  return (
    <div className="space-y-4">
      {/* Головна картка поточного статусу */}
      <div className={`p-4 sm:p-5 rounded-2xl border ${currentStepInfo.badge} space-y-3`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider opacity-80">
            Поточний статус
          </span>
          <span className="text-xs font-semibold opacity-75">
            Автооновлення кожні 12 сек
          </span>
        </div>
        <div>
          <h3 className="font-display text-lg sm:text-xl font-bold leading-tight">
            {currentStepInfo.title}
          </h3>
          <p className="text-xs sm:text-sm mt-1 leading-relaxed opacity-90">
            {currentStepInfo.desc}
          </p>
        </div>
      </div>

      {/* Візуальний шкальний степер (Timeline) */}
      {!currentStepInfo.isCancelled && (
        <div className="bg-[#181B22] p-4 sm:p-5 rounded-2xl border border-white/10 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-[#94A3B8]">
            Етапи виконання
          </div>

          <div className="relative flex items-center justify-between">
            {/* Лінія бекграунду */}
            <div className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-[#252A34] z-0" />

            {/* Активна лінія прогресу */}
            <div
              className="absolute left-4 top-1/2 -translate-y-1/2 h-1 bg-emerald-500 transition-all duration-700 z-0"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    100,
                    (currentStepInfo.stepIndex / (stepsList.length - 1)) * 100,
                  ),
                )}%`,
              }}
            />

            {/* Кроки степера */}
            {stepsList.map((st, idx) => {
              const isPassed = idx < currentStepInfo.stepIndex;
              const isCurrent = idx === currentStepInfo.stepIndex;

              return (
                <div
                  key={st.label}
                  className="relative z-10 flex flex-col items-center group"
                >
                  <div
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs sm:text-sm font-bold transition-all duration-300 ${
                      isPassed
                        ? "bg-emerald-500 text-white shadow-sm ring-4 ring-[#181B22]"
                        : isCurrent
                        ? "bg-[var(--brand-primary,#D34528)] text-white ring-4 ring-[var(--brand-primary,#D34528)]/20 shadow-md scale-110"
                        : "bg-[#14171E] text-[#94A3B8] border border-white/10 ring-4 ring-[#181B22]"
                    }`}
                  >
                    {isPassed ? "✓" : st.icon}
                  </div>
                  <span
                    className={`text-[10px] sm:text-xs font-bold mt-2 whitespace-nowrap text-center ${
                      isCurrent
                        ? "text-[#F1F5F9] font-extrabold"
                        : isPassed
                        ? "text-emerald-400"
                        : "text-[#94A3B8]"
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
