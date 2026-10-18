import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // Публічний домен, через який Telegram відкриває Mini App (caddy + TLS на хості)
  const publicHost = env.VITE_PUBLIC_HOST || "";

  return {
    base: "/urban-bites/app/",
    plugins: [react(), tailwindcss()],

    resolve: {
      // Щоб не писати "../../components/..." — імпортуємо як "@/components/..."
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },

    server: {
      host: "0.0.0.0",   // контейнер має слухати ззовні, не лише 127.0.0.1
      port: 5173,
      strictPort: true,  // краще впасти, ніж мовчки зайняти інший порт

      // Vite за замовчуванням відхиляє запити з незнайомим заголовком Host —
      // без цього запити з домену повертають "Blocked request"
      allowedHosts: publicHost ? [publicHost] : [],

      // API на тому самому шляху /api і локально, і через caddy:
      // тут його проксює сам Vite, у проді — caddy
      proxy: {
        "/api": {
          target: "http://api:8000",   // ім'я сервісу в docker-мережі
          changeOrigin: true,
        },
      },

      // HMR-клієнт завжди йде через публічний домен: сторінка віддається
      // по HTTPS, тож ws:// був би заблокований як mixed content
      hmr: publicHost
        ? { protocol: "wss", host: publicHost, clientPort: 443 }
        : undefined,
    },
  };
});
