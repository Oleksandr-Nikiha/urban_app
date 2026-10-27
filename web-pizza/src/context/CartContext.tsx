import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { CartItem, SelectedOptionWithGroup } from "../types/cart.ts";
import type { ProductVariant } from "../types/catalog.ts";

export interface CartContextType {
  items: CartItem[];
  totalQty: number;
  totalPrice: number;
  addItem: (params: {
    productId: number;
    productName: string;
    imageUrl: string | null;
    variant: ProductVariant;
    selectedOptions: SelectedOptionWithGroup[];
    qty: number;
    extraPerUnit: number;
  }) => void;
  updateQty: (itemId: string, newQty: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export interface CartProviderProps {
  children: ReactNode;
  storageKey?: string;
}

export function CartProvider({ children, storageKey = "urban_cart_v1" }: CartProviderProps) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (e) {
      console.error("Не вдалося зберегти кошик у localStorage", e);
    }
  }, [items, storageKey]);

  const addItem = ({
    productId,
    productName,
    imageUrl,
    variant,
    selectedOptions,
    qty,
    extraPerUnit,
  }: {
    productId: number;
    productName: string;
    imageUrl: string | null;
    variant: ProductVariant;
    selectedOptions: SelectedOptionWithGroup[];
    qty: number;
    extraPerUnit: number;
  }) => {
    // Формуємо унікальний ключ позиції
    const optionIds = selectedOptions
      .map((o) => `${o.option.variant_id}x${o.qty || 1}`)
      .sort()
      .join("_");
    const itemKey = `${variant.id}:${optionIds}`;

    setItems((prev) => {
      const existingIndex = prev.findIndex((i) => i.id === itemKey);
      if (existingIndex > -1) {
        const next = [...prev];
        const current = next[existingIndex];
        const newQty = current.qty + qty;
        next[existingIndex] = {
          ...current,
          qty: newQty,
          itemSubtotal: (variant.price + extraPerUnit) * newQty,
        };
        return next;
      }

      const newItem: CartItem = {
        id: itemKey,
        productId,
        productName,
        imageUrl,
        variant,
        selectedOptions,
        qty,
        extraPerUnit,
        itemSubtotal: (variant.price + extraPerUnit) * qty,
      };

      return [...prev, newItem];
    });
  };

  const updateQty = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeItem(itemId);
      return;
    }
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            qty: newQty,
            itemSubtotal: (item.variant.price + item.extraPerUnit) * newQty,
          };
        }
        return item;
      }),
    );
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const clearCart = () => {
    setItems([]);
  };

  const totalQty = items.reduce((acc, i) => acc + i.qty, 0);
  const totalPrice = items.reduce((acc, i) => acc + i.itemSubtotal, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        totalQty,
        totalPrice,
        addItem,
        updateQty,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}
