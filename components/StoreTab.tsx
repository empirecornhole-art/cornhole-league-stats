"use client";

import { useEffect, useMemo, useState } from "react";

type Money = { amount: string; currencyCode: string };

type ShopifyVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  options: { name: string; value: string }[];
};

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  availableForSale: boolean;
  image: { url: string; alt: string | null } | null;
  priceRange: { min: Money; max: Money };
  variants: ShopifyVariant[];
};

type CartLine = {
  variantId: string;
  productTitle: string;
  variantTitle: string;
  price: Money;
  image: string | null;
  quantity: number;
};

function formatMoney(money: Money) {
  const amount = Number(money.amount);
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: money.currencyCode || "USD" }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

function ProductCard({ product, onAdd }: { product: ShopifyProduct; onAdd: (line: CartLine) => void }) {
  const firstAvailable = product.variants.find((v) => v.availableForSale) || product.variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id || "");
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selectedVariant = product.variants.find((v) => v.id === variantId) || firstAvailable;
  const showVariantPicker = product.variants.length > 1;
  const soldOut = !product.availableForSale || !selectedVariant?.availableForSale;

  const priceLabel =
    product.priceRange.min.amount === product.priceRange.max.amount
      ? formatMoney(product.priceRange.min)
      : `From ${formatMoney(product.priceRange.min)}`;

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-neutral-800 bg-[#101010]">
      <div className="aspect-square w-full bg-[#1a1a1a]">
        {product.image ? (
          <img src={product.image.url} alt={product.image.alt || product.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-600">No image</div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="font-black">{product.title}</div>
        <div className="text-lg font-black text-[#f04a22]">{priceLabel}</div>

        {showVariantPicker && (
          <select
            className="rounded-lg border border-neutral-700 bg-[#242424] p-2 text-sm text-white"
            value={variantId}
            onChange={(e) => setVariantId(e.target.value)}
          >
            {product.variants.map((v) => (
              <option key={v.id} value={v.id} disabled={!v.availableForSale}>
                {v.title}
                {!v.availableForSale ? " (Sold out)" : ""}
              </option>
            ))}
          </select>
        )}

        <div className="mt-auto flex items-center gap-2 pt-2">
          <div className="flex items-center rounded-lg border border-neutral-700">
            <button
              type="button"
              className="px-3 py-1 text-lg font-bold text-neutral-300 hover:text-white"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="min-w-[2ch] text-center text-sm">{quantity}</span>
            <button
              type="button"
              className="px-3 py-1 text-lg font-bold text-neutral-300 hover:text-white"
              onClick={() => setQuantity((q) => Math.min(99, q + 1))}
              aria-label="Increase quantity"
            >
              +
            </button>
          </div>

          <button
            type="button"
            disabled={soldOut || !selectedVariant}
            className={`flex-1 rounded-lg py-2 text-sm font-bold transition ${
              soldOut
                ? "cursor-not-allowed bg-neutral-800 text-neutral-500"
                : justAdded
                ? "bg-emerald-600 text-white"
                : "bg-[#f04a22] text-white hover:bg-[#f04a22]/80"
            }`}
            onClick={() => {
              if (!selectedVariant) return;
              onAdd({
                variantId: selectedVariant.id,
                productTitle: product.title,
                variantTitle: showVariantPicker ? selectedVariant.title : "",
                price: selectedVariant.price,
                image: product.image?.url || null,
                quantity,
              });
              setJustAdded(true);
              setTimeout(() => setJustAdded(false), 1200);
            }}
          >
            {soldOut ? "Sold out" : justAdded ? "Added!" : "Add to cart"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CartBar({
  lines,
  onRemove,
  onCheckout,
  checkingOut,
  checkoutError,
}: {
  lines: CartLine[];
  onRemove: (variantId: string) => void;
  onCheckout: () => void;
  checkingOut: boolean;
  checkoutError: string | null;
}) {
  const [expanded, setExpanded] = useState(false);

  const itemCount = lines.reduce((sum, l) => sum + l.quantity, 0);
  const subtotal = lines.reduce((sum, l) => sum + Number(l.price.amount) * l.quantity, 0);
  const currency = lines[0]?.price.currencyCode || "USD";

  if (!lines.length) return null;

  return (
    <div className="fixed bottom-16 left-4 right-4 z-40 md:bottom-4 md:left-auto md:right-4 md:w-96">
      <div className="rounded-xl border border-[#f04a22] bg-[#141414] shadow-2xl">
        {expanded && (
          <div className="max-h-64 space-y-2 overflow-y-auto border-b border-neutral-800 p-3">
            {lines.map((line) => (
              <div key={line.variantId} className="flex items-center gap-2 text-sm">
                {line.image ? (
                  <img src={line.image} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded bg-[#1a1a1a]" />
                )}
                <div className="flex-1">
                  <div className="font-bold">{line.productTitle}</div>
                  <div className="text-xs text-neutral-400">
                    {line.variantTitle ? `${line.variantTitle} · ` : ""}Qty {line.quantity}
                  </div>
                </div>
                <div className="font-bold text-[#f04a22]">
                  {formatMoney({ amount: String(Number(line.price.amount) * line.quantity), currencyCode: line.price.currencyCode })}
                </div>
                <button
                  type="button"
                  className="px-2 text-neutral-500 hover:text-red-400"
                  onClick={() => onRemove(line.variantId)}
                  aria-label={`Remove ${line.productTitle} from cart`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="flex w-full items-center justify-between px-4 py-3 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <span className="font-bold">
            🛒 {itemCount} item{itemCount === 1 ? "" : "s"}
          </span>
          <span className="font-black text-[#f04a22]">{formatMoney({ amount: String(subtotal), currencyCode: currency })}</span>
        </button>

        <div className="px-4 pb-4">
          {checkoutError && <div className="mb-2 text-xs text-red-400">{checkoutError}</div>}
          <button
            type="button"
            disabled={checkingOut}
            onClick={onCheckout}
            className="w-full rounded-lg bg-[#f04a22] py-2 font-bold text-white hover:bg-[#f04a22]/80 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkingOut ? "Starting checkout..." : "Checkout"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function StoreTab() {
  const [products, setProducts] = useState<ShopifyProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/shopify/products")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.error);
          setProducts([]);
        } else {
          setProducts(data.products || []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Couldn't reach the store right now. Try again in a bit.");
          setProducts([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const addToCart = (line: CartLine) => {
    setCheckoutError(null);
    setCart((prev) => {
      const existing = prev.find((l) => l.variantId === line.variantId);
      if (existing) {
        return prev.map((l) => (l.variantId === line.variantId ? { ...l, quantity: l.quantity + line.quantity } : l));
      }
      return [...prev, line];
    });
  };

  const removeFromCart = (variantId: string) => {
    setCart((prev) => prev.filter((l) => l.variantId !== variantId));
  };

  const checkout = async () => {
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/shopify/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: cart.map((l) => ({ variantId: l.variantId, quantity: l.quantity })) }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setCheckoutError(data.error || "Something went wrong starting checkout.");
        setCheckingOut(false);
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setCheckoutError("Couldn't reach checkout. Try again.");
      setCheckingOut(false);
    }
  };

  const sortedProducts = useMemo(() => products || [], [products]);

  return (
    <section className="rounded-2xl border border-neutral-800 bg-[#141414] p-4 shadow-xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black">Store</h2>
        <p className="text-sm text-neutral-400">Checkout is handled securely by Shopify.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          Couldn't load the store: {error}
        </div>
      )}

      {!products && !error && (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-neutral-800 bg-[#101010]">
              <div className="aspect-square bg-neutral-800" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-neutral-800" />
                <div className="h-4 w-1/3 rounded bg-neutral-800" />
              </div>
            </div>
          ))}
        </div>
      )}

      {products && !products.length && !error && (
        <div className="rounded-xl border border-neutral-800 bg-[#101010] p-6 text-center text-neutral-400">
          No products available right now.
        </div>
      )}

      {sortedProducts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={addToCart} />
          ))}
        </div>
      )}

      <CartBar lines={cart} onRemove={removeFromCart} onCheckout={checkout} checkingOut={checkingOut} checkoutError={checkoutError} />
    </section>
  );
}
