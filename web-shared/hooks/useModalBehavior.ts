import { useEffect } from "react";

interface UseModalBehaviorOptions {
  isOpen: boolean;
  onClose: () => void;
  closeOnEsc?: boolean;
  lockScroll?: boolean;
}

/**
 * Керування стандартною поведінкою модальних вікон:
 * - Блокування прокрутки сторінки (body scroll lock) під модалкою
 * - Закриття клавішею Escape
 */
export function useModalBehavior({
  isOpen,
  onClose,
  closeOnEsc = true,
  lockScroll = true,
}: UseModalBehaviorOptions) {
  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, closeOnEsc]);

  useEffect(() => {
    if (!isOpen || !lockScroll) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen, lockScroll]);
}
