import { useEffect, useRef } from "react";

export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

interface TelegramLoginWidgetProps {
  botName: string;
  onAuth: (user: TelegramUser) => void;
  buttonSize?: "large" | "medium" | "small";
  cornerRadius?: number;
  requestAccess?: "write";
  showUserPic?: boolean;
  className?: string;
}

declare global {
  interface Window {
    [key: string]: unknown;
  }
}

export function TelegramLoginWidget({
  botName,
  onAuth,
  buttonSize = "large",
  cornerRadius,
  requestAccess = "write",
  showUserPic = true,
  className = "",
}: TelegramLoginWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onAuthRef = useRef(onAuth);
  onAuthRef.current = onAuth;

  const defaultRadius = buttonSize === "large" ? 20 : buttonSize === "medium" ? 14 : 10;
  const radius = cornerRadius ?? defaultRadius;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const callbackName = `tgWidgetAuthAdmin_${Math.random().toString(36).substring(2, 9)}`;

    window[callbackName] = (user: TelegramUser) => {
      onAuthRef.current(user);
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", botName);
    script.setAttribute("data-size", buttonSize);
    script.setAttribute("data-radius", String(radius));
    script.setAttribute("data-request-access", requestAccess);
    script.setAttribute("data-userpic", showUserPic ? "true" : "false");
    script.setAttribute("data-onauth", `${callbackName}(user)`);

    container.appendChild(script);

    const applyIframeFix = () => {
      const iframe = container.querySelector("iframe");
      if (iframe) {
        iframe.setAttribute("allowtransparency", "true");
        iframe.style.colorScheme = "light";
        iframe.style.backgroundColor = "transparent";
        iframe.style.border = "none";
        iframe.style.borderRadius = `${radius}px`;
        iframe.style.overflow = "hidden";
        iframe.style.display = "block";
      }
    };

    const observer = new MutationObserver(() => {
      applyIframeFix();
    });
    observer.observe(container, { childList: true, subtree: true });

    const t1 = setTimeout(applyIframeFix, 100);
    const t2 = setTimeout(applyIframeFix, 300);
    const t3 = setTimeout(applyIframeFix, 800);

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      if (container) {
        container.innerHTML = "";
      }
      delete window[callbackName];
    };
  }, [botName, buttonSize, radius, requestAccess, showUserPic]);

  return (
    <div
      ref={containerRef}
      style={{
        colorScheme: "light",
        backgroundColor: "transparent",
        borderRadius: `${radius}px`,
        overflow: "hidden",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: buttonSize === "large" ? "40px" : buttonSize === "medium" ? "28px" : "20px",
      }}
      className={`relative select-none ${className}`}
    />
  );
}
