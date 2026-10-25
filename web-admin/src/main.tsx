import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";

import { App } from "@/App";
import { initTelegramEnv } from "@/telegram/env";
import { initSdk } from "@/telegram/sdk";
import "@/styles/index.css";

initTelegramEnv();
initSdk();

try {
  const tg = (window as unknown as { Telegram?: { WebApp?: { ready?: () => void; expand?: () => void } } })
    ?.Telegram?.WebApp;
  tg?.ready?.();
  tg?.expand?.();
} catch { /* ignore */ }

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

const root = document.getElementById("root");
if (!root) throw new Error("Не знайдено #root у index.html");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/urban-bites/admin">
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
