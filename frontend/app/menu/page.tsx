"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  createOrder,
  fetchItems,
  fetchOrderByTable,
  Item,
  Order,
  verifyCustomerLocation,
} from "../../lib/api";

type QtyMap = Record<string, number>;

export default function MenuPage() {
  const searchParams = useSearchParams();
  const tableParam = searchParams.get("table");
  const tableNumber = tableParam ? Number(tableParam) : NaN;

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [qty, setQty] = useState<QtyMap>({});
  const [note, setNote] = useState("");
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [runningOrder, setRunningOrder] = useState<Order | null>(null);
  const [sessionTimer, setSessionTimer] = useState<NodeJS.Timeout | null>(null);
  const disableLock =
    String(process.env.NEXT_PUBLIC_DISABLE_LOCATION_CHECK).toLowerCase() === "true";

  useEffect(() => {
    const init = async () => {
      try {
        if (typeof window === "undefined") return;
        if (disableLock) {
          const resp = await verifyCustomerLocation({ lat: 0, lng: 0 });
          // @ts-ignore
          (window as any).customerToken = resp.token;
          const timer = setTimeout(() => {
            // @ts-ignore
            (window as any).customerToken = null;
            window.location.href = "/session-expired";
          }, resp.expiresInSeconds * 1000);
          setSessionTimer(timer);
        } else {
          if (!navigator.geolocation) {
            setError("Geolocation not supported");
            setLoading(false);
            return;
          }
          await new Promise<void>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              async (pos) => {
                try {
                  const { latitude, longitude } = pos.coords;
                  const resp = await verifyCustomerLocation({
                    lat: latitude,
                    lng: longitude,
                  });
                  // @ts-ignore
                  (window as any).customerToken = resp.token;
                  const timer = setTimeout(() => {
                    // @ts-ignore
                    (window as any).customerToken = null;
                    window.location.href = "/session-expired";
                  }, resp.expiresInSeconds * 1000);
                  setSessionTimer(timer);
                  resolve();
                } catch (e: any) {
                  setError(e.message || "Location verification failed");
                  reject(e);
                }
              },
              (err) => {
                setError("Location permission required");
                reject(err);
              },
              { enableHighAccuracy: true, timeout: 10000 }
            );
          });
        }
        const itemsList = await fetchItems();
        setItems(itemsList);
        if (!Number.isNaN(tableNumber)) {
          const open = await fetchOrderByTable(tableNumber);
          setRunningOrder(open || null);
        }
      } catch {
        // swallow
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
      }
    };
  }, [tableNumber]);

  const total = useMemo(() => {
    return items.reduce(
      (sum, item) => sum + (qty[item._id] || 0) * item.price,
      0
    );
  }, [items, qty]);

  const grouped = useMemo(() => {
    return items.reduce<Record<string, Item[]>>((acc, item) => {
      const key = item.category || "Others";
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  const imageSrc = (item: Item) => (item.imageUrl || "").trim();

  const adjustQty = (id: string, delta: number) => {
    setQty((prev) => {
      const next = { ...prev, [id]: Math.max(0, (prev[id] || 0) + delta) };
      if (next[id] === 0) delete next[id];
      return next;
    });
  };

  const cartItems = useMemo(
    () =>
      Object.entries(qty)
        .filter(([, q]) => q > 0)
        .map(([itemId, q]) => {
          const item = items.find((i) => i._id === itemId);
          if (!item) return null;
          return { item, quantity: q };
        })
        .filter(Boolean) as { item: Item; quantity: number }[],
    [qty, items]
  );

  const placeOrder = async () => {
    if (!tableNumber || Number.isNaN(tableNumber)) {
      setError("Table number missing. Use the QR code link.");
      return;
    }
    const itemsToSend = Object.entries(qty)
      .filter(([, q]) => q > 0)
      .map(([itemId, q]) => ({ itemId, quantity: q }));
    if (itemsToSend.length === 0) {
      setError("Add at least one item");
      return;
    }

    setError(null);
    setPlacing(true);
    try {
      const order = await createOrder({
        tableNumber,
        items: itemsToSend,
        note: note.trim() || undefined,
      });
      setConfirmation(`Order placed! #${order._id}`);
      setQty({});
      setNote("");
      setCartOpen(false);
      // Lightweight push-style notification using the browser Notification API
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "default") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") {
              new Notification("Order placed", {
                body: `Table ${tableNumber}: ${itemsToSend.length} item(s)`,
              });
            }
          });
        } else if (Notification.permission === "granted") {
          new Notification("Order placed", {
            body: `Table ${tableNumber}: ${itemsToSend.length} item(s)`,
          });
        }
      }
    } catch (e: any) {
      setError(e.message || "Could not place order");
    } finally {
      setPlacing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-purple-900 text-gray-50">
      <div className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
        <header className="mb-6 rounded-3xl bg-white/10 backdrop-blur-md shadow-lg border border-white/10 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-200 font-semibold">
              Table {Number.isNaN(tableNumber) ? "?" : tableNumber}
            </p>
            <h1 className="text-3xl font-bold text-white">
              SREE KUMARAN SWEETS &amp; BAKERY
            </h1>
            <p className="text-gray-200/80">Fresh cakes, pastries, snacks, and drinks.</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-gray-100">
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-emerald-100 font-semibold border border-emerald-300/30">
              QR Ordering
            </span>
          </div>
        </header>

        {runningOrder && (
          <section className="mb-4 rounded-3xl bg-white/10 border border-white/10 p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-emerald-100">Running Items — Table {tableNumber}</p>
                <p className="text-lg font-semibold text-white">
                  ₹ {runningOrder.total.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() => setCartOpen(true)}
                className="rounded bg-emerald-600 px-3 py-2 text-sm text-white shadow"
              >
                Add More
              </button>
            </div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {runningOrder.items.map((i) => (
                <li key={i.itemId} className="text-sm text-gray-100 flex justify-between">
                  <span>{i.name}</span>
                  <span>
                    x{i.quantity} — ₹{(i.price * i.quantity).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Sticky cart button at top-right while scrolling */}
        <button
          onClick={() => setCartOpen(true)}
          aria-label="Open cart"
          className="fixed right-4 top-4 z-50 rounded-full bg-white/15 backdrop-blur border border-white/20 p-3 text-white shadow-lg hover:shadow-xl"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="h-6 w-6"
          >
            <path d="M3 4h2l1.2 9.2a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.6l1-5.4H6.1" />
            <circle cx="10" cy="19" r="1.3" />
            <circle cx="17" cy="19" r="1.3" />
          </svg>
          {cartItems.length > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-white px-1">
              {cartItems.length}
            </span>
          )}
        </button>

        {loading && <p className="text-gray-100">Loading menu...</p>}
        {error && (
          <p className="mb-3 rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-100 border border-red-400/30">
            {error}
          </p>
        )}
        {confirmation && (
          <p className="mb-3 rounded-lg bg-emerald-500/15 px-3 py-2 text-sm text-emerald-100 border border-emerald-300/30">
            {confirmation}
          </p>
        )}

        <div className="space-y-6">
          {Object.entries(grouped).map(([category, list]) => (
            <section key={category} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">{category}</h2>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((item) => {
                  const img = imageSrc(item);
                  const itemQty = qty[item._id] || 0;
                  return (
                    <article
                      key={item._id}
                      className="relative rounded-3xl border border-white/10 bg-white/10 shadow-lg overflow-hidden flex flex-col transition hover:-translate-y-0.5 hover:shadow-xl backdrop-blur-lg"
                    >
                      <div className="relative h-40 w-full">
                        {img ? (
                          <img
                            src={img}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full bg-gradient-to-br from-slate-700 to-slate-800" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-br from-black/10 via-transparent to-black/30" />
                        {itemQty > 0 && (
                          <span className="absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-emerald-500/90 px-2 text-xs font-bold text-white shadow">
                            {itemQty}
                          </span>
                        )}
                        <div className="absolute left-2 top-2 rounded-full bg-black/40 backdrop-blur px-2 py-1 text-xs font-semibold text-white shadow-sm">
                          ₹ {item.price.toFixed(2)}
                        </div>
                      </div>
                      <div className="flex flex-1 items-center justify-between p-4">
                        <div className="flex-1 pr-3">
                          <p className="font-semibold text-white leading-tight">
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-200/80">Fresh &amp; ready</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {itemQty > 0 && (
                            <button
                              onClick={() => adjustQty(item._id, -1)}
                              className="h-9 w-9 rounded-full border border-emerald-200/50 bg-white/20 text-lg font-bold text-emerald-100 shadow-sm hover:shadow"
                            >
                              -
                            </button>
                          )}
                          <button
                            onClick={() => adjustQty(item._id, 1)}
                            className="h-10 rounded-full bg-emerald-500 px-4 text-white text-sm font-semibold shadow hover:shadow-md transition"
                          >
                            {itemQty > 0 ? "Add more" : "Add"}
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-white/10 border border-white/10 shadow-lg p-4 sm:p-5 sticky bottom-4 sm:static backdrop-blur space-y-3">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-left sm:text-right">
              <p className="text-sm text-gray-200/80">Total</p>
              <p className="text-2xl font-bold text-white">₹ {total.toFixed(2)}</p>
            </div>
            <button
              onClick={placeOrder}
              disabled={placing}
              className="w-full sm:w-auto rounded-lg bg-emerald-500 px-5 py-3 text-white font-semibold shadow hover:shadow-md disabled:opacity-60"
            >
              {placing ? "Placing..." : "Place Order"}
            </button>
          </div>
        </div>

        {/* Cart drawer */}
        {cartOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/60">
            <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-slate-900 text-white shadow-2xl p-4 sm:p-5 animate-[fadeIn_0.15s_ease-out] border border-white/10">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-300">Your cart</p>
                  <h3 className="text-xl font-bold">Items selected</h3>
                </div>
                <button
                  onClick={() => setCartOpen(false)}
                  className="text-gray-400 hover:text-gray-200"
                >
                  ✕
                </button>
              </div>
              <div className="max-h-72 overflow-y-auto space-y-2">
                {cartItems.length === 0 && (
                  <p className="text-sm text-gray-400">No items added yet.</p>
                )}
                {cartItems.map(({ item, quantity }) => (
                  <div
                    key={item._id}
                    className="flex items-center justify-between rounded border border-white/10 p-2 bg-white/5"
                  >
                    <div className="flex-1 pr-2">
                      <p className="font-semibold text-white">{item.name}</p>
                      <p className="text-xs text-gray-300">
                        ₹ {item.price.toFixed(2)} x {quantity}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => adjustQty(item._id, -1)}
                        className="h-7 w-7 rounded-full border border-white/20 text-sm font-bold text-white"
                      >
                        -
                      </button>
                      <span className="w-6 text-center text-sm font-semibold">
                        {quantity}
                      </span>
                      <button
                        onClick={() => adjustQty(item._id, 1)}
                        className="h-7 w-7 rounded-full bg-emerald-500 text-white text-sm font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 space-y-3">
                <label className="block text-sm text-gray-200/90 space-y-2">
                  <span className="block">Note (optional)</span>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note for the order"
                    className="w-full rounded-lg border border-white/15 bg-white/5 text-white placeholder:text-gray-300 p-3 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-200/40"
                  />
                </label>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-300">Total</p>
                    <p className="text-xl font-bold text-white">₹ {total.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={placing || cartItems.length === 0}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-white font-semibold shadow hover:shadow-md disabled:opacity-60"
                  >
                    {placing ? "Placing..." : "Place Order"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
