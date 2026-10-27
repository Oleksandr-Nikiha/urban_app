import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { CartProvider } from "./context/CartContext.tsx";
import "./index.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Не знайдено елемент #root");
}

createRoot(rootElement).render(
  <StrictMode>
    <CartProvider storageKey="urban_croissants_cart_v1">
      <App />
    </CartProvider>
  </StrictMode>,
);

