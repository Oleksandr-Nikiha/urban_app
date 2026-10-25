import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { showBackButton } from "@/telegram/sdk";

/**
 * Показує нативну кнопку «Назад» Telegram, поки екран змонтований.
 * За замовчуванням веде на попередній екран історії.
 */
export function useBackButton(onBack?: () => void): void {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = onBack ?? (() => void navigate(-1));
    return showBackButton(handler);
  }, [navigate, onBack]);
}
