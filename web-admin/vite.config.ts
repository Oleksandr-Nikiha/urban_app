import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicHost = env.VITE_PUBLIC_HOST || "";
  const apiTarget = env.VITE_API_TARGET || "http://127.0.0.1:8010";

  return {
    base: "/urban-bites/admin/",
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },

    server: {
      host: "0.0.0.0",
      port: 5178,
      strictPort: true,
      allowedHosts: publicHost ? [publicHost] : true,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});
