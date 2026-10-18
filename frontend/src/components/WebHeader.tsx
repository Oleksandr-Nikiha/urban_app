import { useNavigate } from "react-router-dom";
import { isTelegramWebApp } from "@/telegram/env";

interface WebHeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

/**
 * Верхня панель для звичайного веб-браузера.
 * Усередині Telegram автоматично приховується, бо там є нативний заголовок і BackButton.
 */
export function WebHeader({ title, showBack = false, onBack }: WebHeaderProps) {
  const navigate = useNavigate();

  if (isTelegramWebApp()) {
    return null;
  }

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b px-4 py-3 app-glass"
      style={{ borderColor: "var(--app-border)" }}
    >
      <div className="flex items-center gap-2.5">
        {showBack && (
          <button
            type="button"
            onClick={onBack ?? (() => void navigate(-1))}
            className="app-press flex h-8 w-8 items-center justify-center rounded-xl text-base font-bold transition-transform active:scale-95"
            style={{ background: "var(--app-surface-2)" }}
            aria-label="Назад"
          >
            ←
          </button>
        )}
        {title ? (
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
        ) : (
          <span className="flex items-center gap-2 font-bold tracking-tight text-sm">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="Urban Bites" className="h-6 w-6 rounded-full object-cover shadow-xs" />
            <span>Urban Bites</span>
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide"
          style={{
            background: "var(--app-surface-2)",
            color: "var(--tg-theme-hint-color)",
          }}
        >
          Онлайн-замовлення
        </span>
      </div>
    </header>
  );
}

