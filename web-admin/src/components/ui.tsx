import { useState, type ReactNode } from "react";

export function Spinner() {
  return (
    <div className="flex justify-center py-12">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent opacity-40"
        role="status"
        aria-label="Завантаження"
      />
    </div>
  );
}

/** Скелетон для списку категорій */
export function CategorySkeleton() {
  return (
    <div className="space-y-4 px-4 pt-2">
      <div className="space-y-3">
        <div className="h-6 w-32 rounded-lg app-shimmer" />
        {[1, 2, 3].map((i) => (
          <div key={i} className="app-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl app-shimmer" />
              <div className="h-5 flex-1 rounded-lg app-shimmer" />
              <div className="h-4 w-4 rounded-full app-shimmer opacity-40" />
            </div>
            <div className="flex gap-2 pt-1">
              <div className="h-7 w-20 rounded-lg app-shimmer" />
              <div className="h-7 w-24 rounded-lg app-shimmer" />
              <div className="h-7 w-16 rounded-lg app-shimmer" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Скелетон для списку товарів */
export function ProductListSkeleton() {
  return (
    <div className="space-y-3 px-4 pt-2">
      <div className="h-6 w-36 rounded-lg app-shimmer mb-3" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="app-card flex items-center gap-3 rounded-2xl p-3">
          <div className="h-16 w-16 rounded-xl app-shimmer shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded-md app-shimmer" />
            <div className="h-3.5 w-1/3 rounded-md app-shimmer opacity-70" />
          </div>
          <div className="h-5 w-5 rounded-full app-shimmer opacity-30 shrink-0 mr-1" />
        </div>
      ))}
    </div>
  );
}

/** Скелетон для екрана товару */
export function ProductDetailSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="aspect-[4/3] w-full app-shimmer" />
      <div className="p-4 space-y-4 flex-1">
        <div className="h-6 w-2/3 rounded-lg app-shimmer" />
        <div className="h-4 w-full rounded-md app-shimmer opacity-60" />
        <div className="h-4 w-4/5 rounded-md app-shimmer opacity-60" />
        <div className="pt-3 space-y-2">
          <div className="h-4 w-20 rounded-md app-shimmer opacity-50" />
          <div className="flex gap-2">
            <div className="h-10 w-28 rounded-xl app-shimmer" />
            <div className="h-10 w-28 rounded-xl app-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="app-card app-rise mx-4 my-6 rounded-2xl p-4 text-sm">
      <p className="font-semibold text-rose-500 flex items-center gap-1.5">
        <span>⚠️</span>
        <span>Не вдалося завантажити</span>
      </p>
      <p className="mt-1.5 opacity-75 text-xs leading-relaxed">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="app-press mt-3 rounded-xl px-4 py-2 text-xs font-semibold"
          style={{ background: "var(--tg-theme-button-color)", color: "var(--tg-theme-button-text-color)" }}
        >
          Спробувати ще раз
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="app-rise flex flex-col items-center px-6 py-16 text-center">
      <div className="text-5xl">{icon}</div>
      <p className="mt-4 font-semibold text-base">{title}</p>
      {hint && <p className="mt-1 text-xs opacity-60 max-w-[260px] leading-relaxed">{hint}</p>}
    </div>
  );
}

/** Заголовок екрана */
export function ScreenTitle({
  children,
  onBack,
}: {
  children: ReactNode;
  onBack?: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 px-4 pb-2 pt-4">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="app-press flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-base font-bold transition-transform active:scale-95 shadow-sm border"
          style={{
            background: "var(--app-surface-2)",
            borderColor: "var(--app-border)",
            color: "var(--tg-theme-text-color)",
          }}
          aria-label="Назад"
        >
          ←
        </button>
      )}
      <h1 className="text-2xl font-extrabold tracking-tight truncate flex-1">{children}</h1>
    </div>
  );
}

/**
 * Заголовок секції всередині екрана: підкатегорія або заклад.
 * Липкий із матовим склом і фірмовою рискою акценту.
 */
export function SectionHeading({ children, sticky = true }: { children: ReactNode; sticky?: boolean }) {
  return (
    <h2
      className={`${sticky ? "sticky top-0 z-10 app-glass" : ""} mb-2 flex items-center gap-2 px-4 py-2 text-[15px] font-bold`}
    >
      <span
        className="h-4 w-1 shrink-0 rounded-full"
        style={{ background: "var(--tg-theme-button-color)" }}
        aria-hidden
      />
      {children}
    </h2>
  );
}

/**
 * Стильний Segmented Control (перемикач опцій, наприклад Доставка / Самовивіз)
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: string; disabled?: boolean }[];
  value: T;
  onChange: (val: T) => void;
}) {
  return (
    <div
      className="flex rounded-2xl p-1 gap-1"
      style={{ background: "var(--app-surface-2)" }}
      role="tablist"
    >
      {options.map((opt) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={isSelected}
            disabled={opt.disabled}
            onClick={() => onChange(opt.value)}
            className={`app-press relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold transition-all ${
              isSelected
                ? "shadow-sm"
                : opt.disabled
                  ? "opacity-30 cursor-not-allowed"
                  : "opacity-65 hover:opacity-100"
            }`}
            style={
              isSelected
                ? {
                    background: "var(--tg-theme-bg-color)",
                    color: "var(--tg-theme-button-color)",
                    boxShadow: "var(--app-shadow-sm)",
                  }
                : {
                    color: "inherit",
                  }
            }
          >
            {opt.icon && <span className="text-sm">{opt.icon}</span>}
            <span>{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Картинка товару зі скелетоном і проявленням.
 */
export function Thumb({
  src,
  className = "",
  rounded = "rounded-xl",
  fallback = "🍕",
  eager = false,
}: {
  src: string | null;
  className?: string;
  rounded?: string;
  fallback?: string;
  eager?: boolean;
}) {
  const [state, setState] = useState<"loading" | "ready" | "failed">(src ? "loading" : "failed");

  if (state === "failed") {
    return (
      <div
        className={`flex flex-col items-center justify-center ${rounded} ${className}`}
        style={{
          background: "color-mix(in srgb, var(--app-surface-2) 80%, transparent)",
          color: "var(--tg-theme-hint-color, #999)",
        }}
        aria-hidden
      >
        <span className="text-2xl select-none opacity-60">{fallback}</span>
      </div>
    );
  }

  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{ background: state === "loading" ? "var(--app-skeleton)" : undefined }}
    >
      <img
        src={src ?? ""}
        alt=""
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setState("ready")}
        onError={() => setState("failed")}
        className="h-full w-full object-cover transition-opacity duration-300"
        style={{ opacity: state === "ready" ? 1 : 0 }}
      />
    </div>
  );
}

export function formatPrice(value: number): string {
  // Ціни в каталозі цілі; копійки показуємо лише якщо вони справді є
  const hasCents = Math.round(value * 100) % 100 !== 0;
  return `${value.toFixed(hasCents ? 2 : 0)} ₴`;
}
