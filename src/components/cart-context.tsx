"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { CartItem } from "@/lib/types";

type CartContextValue = {
  items: CartItem[];
  totalItems: number;
  addItem: (slug: string, quantity?: number) => void;
  removeItem: (slug: string) => void;
  updateItem: (slug: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const storageKey = "nebula-cart";

function readStorage(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(storageKey, JSON.stringify(items));
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    setItems(readStorage());
  }, []);

  useEffect(() => {
    writeStorage(items);
  }, [items]);

  const api = useMemo<CartContextValue>(() => {
    return {
      items,
      totalItems: items.reduce((total, item) => total + item.quantity, 0),
      addItem: (slug, quantity = 1) => {
        setItems((prev) => {
          const existing = prev.find((item) => item.slug === slug);
          if (existing) {
            return prev.map((item) =>
              item.slug === slug
                ? { ...item, quantity: item.quantity + quantity }
                : item,
            );
          }
          return [...prev, { slug, quantity }];
        });
      },
      removeItem: (slug) => {
        setItems((prev) => prev.filter((item) => item.slug !== slug));
      },
      updateItem: (slug, quantity) => {
        if (quantity <= 0) {
          setItems((prev) => prev.filter((item) => item.slug !== slug));
          return;
        }
        setItems((prev) =>
          prev.map((item) =>
            item.slug === slug ? { ...item, quantity } : item,
          ),
        );
      },
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider.");
  }
  return context;
}
