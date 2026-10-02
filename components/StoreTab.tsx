"use client";

import { useEffect, useMemo, useState } from "react";

type Money = { amount: string; currencyCode: string };

type ShopifyVariant = {
  id: string;
  title: string;
  availableForSale: boolean;
  price: Money;
  options: { name: string; value: string }[];
  image: { url: string; alt: string | null } | null;
};

type ShopifyProductOption = { name: string; values: string[] };

type ShopifyProduct = {
  id: string;
  title: string;
  handle: string;
  description: string;
  availableForSale: boolean;
  image: { url: string; alt: string | null } | null;
  priceRange: { min: Money; max: Money };
  options: ShopifyProductOption[];
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

// Finds the one variant (if any) whose selected options exactly match the
// shopper's current picks across every option (Color, Size, ...).
function findMatchingVariant(product: ShopifyProduct, picks: Record<string, string>) {
  return product.variants.find((v) => v.options.every((o) => picks[o.name] === o.value));
}

function ProductCard({ product, onAdd }: { product: ShopifyProduct; onAdd: (line: CartLine) => void }) {
  const firstAvailable = product.variants.find((v) => v.availableForSale) || product.variants[0];

  const [picks, setPicks] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const opt of firstAvailable?.options || []) initial[opt.name] = opt.value;
    return initial;
  });
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const hasOptions = product.options.length > 0;
  const selectedVariant = hasOptions ? findMatchingVariant(product, picks) : firstAvailable;
  const noSuchCombo = hasOptions && !selectedVariant;
  const soldOut = !product.availableForSale || !selectedVariant?.availableForSale;

  const displayImage = selectedVariant?.image || product.image;

  const priceLabel =
    product.priceRange.min.amount === product.priceRange.max.amount
      ? formatMoney(product.priceRange.min)
      : `From ${formatMoney(product.priceRange.min)}`;

  // For a given option value, is there ANY variant that combines it with the
  // shopper's other current picks? Used to gray out combinations that don't
  // exist (e.g. an out-of-stock size for the currently picked color).
  function valueIsReachable(optionName: string, value: string) {
    return product.variants.some(
      (v) =>
        v.availableForSale &&
        v.options.every((o) => (o.name === optionName ? o.value === value : picks[o.name] === o.value))
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-brand-bg">
      <div className="aspect-square w-full bg-brand-raised">
        {displayImage ? (
          <img src={displayImage.url} alt={displayImage.alt || product.title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-brand-textFaint">No image</div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="font-bold">{product.title}</div>
        <div className="text-lg font-bold text-brand-orange">{priceLabel}</div>

        {product.options.map((option) => (
          <div key={option.name}>
            <label className="field-label">{option.name}</label>
            <select
              className="block w-full rounded-lg border border-white/15 bg-brand-raisedHover p-2 text-sm text-brand-text"
              value={picks[option.name] || ""}
              onChange={(e) => setPicks((prev) => ({ ...prev, [option.name]: e.target.value }))}
            >
              {option.values.map((value) => (
                <option key={value} value={value} disabled={!valueIsReachable(option.name, value)}>
                  {value}
                  {!valueIsReachable(option.name, value) ? " (Unavailable)" : ""}
                </option>
              ))}
            </select>
          </div>
        ))}

        {noSuchCombo && <div className="text-xs text-red-400">That combination isn't available.</div>}

        <div className="mt-auto flex items-center gap-2 pt-2">
          <div className="flex items-center rounded-lg border border-white/15">
            <button
              type="button"
              className="px-3 py-1 text-lg font-bold text-brand-textSecondary hover:text-brand-text"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              aria-label="Decrease quantity"
            >
              −
            </button>
            <span className="min-w-[2ch] text-center text-sm">{quantity}</span>
            <button
              type="button"
              className="px-3 py-1 text-lg font-bold text-brand-textSecondary hover:text-brand-text"
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
              soldOut || !selectedVariant
                ? "cursor-not-allowed bg-white/10 text-brand-textFaint"
                : justAdded
                ? "bg-emerald-600 text-brand-text"
                : "bg-brand-orange text-brand-text hover:bg-brand-orange/80"
            }`}
            onClick={() => {
              if (!selectedVariant) return;
              onAdd({
                variantId: selectedVariant.id,
                productTitle: product.title,
                variantTitle: hasOptions ? selectedVariant.title : "",
                price: selectedVariant.price,
                image: displayImage?.url || null,
                quantity,
              });
              setJustAdded(true);
              setTimeout(() => setJustAdded(false), 1200);
            }}
          >
            {!selectedVariant ? "Unavailable" : soldOut ? "Sold out" : justAdded ? "Added!" : "Add to cart"}
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
    // Sticky (not fixed) at the end of the store section: it rides just above
    // the league's mobile tab bar (~57px tall) while you browse, and stops at
    // the end of the store instead of floating over the tab bar or footer.
    <div className="sticky bottom-[4.25rem] z-30 mt-4 md:bottom-4 md:ml-auto md:w-96">
      <div className="rounded-xl border border-brand-orange bg-brand-panel shadow-2xl">
        {expanded && (
          <div className="max-h-64 space-y-2 overflow-y-auto border-b border-white/10 p-3">
            {lines.map((line) => (
              <div key={line.variantId} className="flex items-center gap-2 text-sm">
                {line.image ? (
                  <img src={line.image} alt="" className="h-10 w-10 rounded object-cover" />
                ) : (
                  <div className="h-10 w-10 rounded bg-brand-raised" />
                )}
                <div className="flex-1">
                  <div className="font-bold">{line.productTitle}</div>
                  <div className="text-xs text-brand-textMuted">
                    {line.variantTitle ? `${line.variantTitle} · ` : ""}Qty {line.quantity}
                  </div>
                </div>
                <div className="font-bold text-brand-orange">
                  {formatMoney({ amount: String(Number(line.price.amount) * line.quantity), currencyCode: line.price.currencyCode })}
                </div>
                <button
                  type="button"
                  className="px-2 text-brand-textFaint hover:text-red-400"
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
          <span className="font-bold text-brand-orange">{formatMoney({ amount: String(subtotal), currencyCode: currency })}</span>
        </button>

        <div className="px-4 pb-4">
          {checkoutError && <div className="mb-2 text-xs text-red-400">{checkoutError}</div>}
          <button
            type="button"
            disabled={checkingOut}
            onClick={onCheckout}
            className="w-full rounded-lg bg-brand-orange py-2 font-bold text-brand-text hover:bg-brand-orange/80 disabled:cursor-not-allowed disabled:opacity-60"
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
    <section className="rounded-2xl border border-white/10 bg-brand-panel p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-2xl uppercase text-brand-text">Store</h2>
        <p className="text-sm text-brand-textMuted">Checkout is handled securely by Shopify.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900 bg-red-950/40 p-4 text-sm text-red-300">
          Couldn't load the store: {error}
        </div>
      )}

      {!products && !error && (
        <div className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-brand-bg">
              <div className="aspect-square bg-white/10" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="h-4 w-1/3 rounded bg-white/10" />
              </div>
            </div>
          ))}
        </div>
      )}

      {products && !products.length && !error && (
        <div className="rounded-xl border border-white/10 bg-brand-bg p-6 text-center text-brand-textMuted">
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
