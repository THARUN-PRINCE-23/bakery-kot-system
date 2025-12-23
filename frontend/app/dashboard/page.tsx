"use client";

import { useEffect, useState, useRef } from "react";
import {
  createItem,
  deleteItem,
  fetchItems,
  fetchOrders,
  Item,
  Order,
  printOrder,
  printKot,
  updateItem,
  updateOrderStatus,
} from "../../lib/api";
import { getSocket } from "../../lib/socket";

export default function DashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [notif, setNotif] = useState<{ table: number; count: number } | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const audioCtxRef = useRef<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [salesModalOpen, setSalesModalOpen] = useState(false);
  const [inventoryModalOpen, setInventoryModalOpen] = useState(false);
  const [hideBilled, setHideBilled] = useState(true);
  const [tableModalOpen, setTableModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<number | null>(null);
  const [showOnlyOpen, setShowOnlyOpen] = useState(true);
  const [itemForm, setItemForm] = useState<{
    _id?: string;
    name: string;
    price: string;
    category: string;
    imageUrl: string;
    available: boolean;
  }>({
    name: "",
    price: "",
    category: "Bakery",
    imageUrl: "",
    available: true,
  });

  const loadData = async () => {
    try {
      const [ordersResp, itemsResp] = await Promise.all([
        fetchOrders(),
        fetchItems(),
      ]);
      setOrders(Array.isArray(ordersResp) ? ordersResp : []);
      setItems(Array.isArray(itemsResp) ? itemsResp : []);
    } catch (e: any) {
      const msg = String(e?.message || "");
      if (msg.includes("(401)") || msg.toLowerCase().includes("unauthorized")) {
        if (typeof window !== "undefined") {
          window.location.href = "/dashboard/login";
        }
        return;
      }
      setError(msg || "Failed to load data");
      setOrders([]);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const t = window.localStorage.getItem("authToken");
      if (!t) {
        window.location.href = "/dashboard/login";
        return;
      }
    }
    let s: any = null;
    loadData().catch(() => setError("Failed to load data"));
    getSocket().then((socket) => {
      s = socket;
      socket.on("order:list", (list: Order[]) =>
        setOrders(Array.isArray(list) ? list : [])
      );
      socket.on("order:update", (order: Order) => {
        setOrders((prev) => {
          const base = Array.isArray(prev) ? prev : [];
          const existing = base.find((o) => o._id === order._id);
          if (!existing) {
            playBeep();
            setNotif({ table: order.tableNumber, count: order.items.length });
            setTimeout(() => setNotif(null), 5000);
            return [order, ...prev];
          }
          return base.map((o) => (o._id === order._id ? order : o));
        });
      });
    });
    return () => {
      if (s) {
        s.off("order:list");
        s.off("order:update");
      }
    };
  }, []);

  const enableSound = async () => {
    try {
      const Ctx: any =
        typeof window !== "undefined"
          ? (window as any).AudioContext || (window as any).webkitAudioContext
          : null;
      if (!Ctx) return;
      const ctx = new Ctx();
      if (ctx.state === "suspended" && ctx.resume) {
        await ctx.resume();
      }
      audioCtxRef.current = ctx;
      setSoundEnabled(true);
    } catch {}
  };

  const playBeep = () => {
    try {
      const Ctx: any =
        typeof window !== "undefined"
          ? (window as any).AudioContext || (window as any).webkitAudioContext
          : null;
      if (!Ctx) return;
      const ctx = audioCtxRef.current || new Ctx();
      if (ctx.state === "suspended" && ctx.resume) {
        // If context is suspended (autoplay policy), bail unless user enabled
        if (!soundEnabled) return;
        ctx.resume().catch(() => {});
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.value = 0.2;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        try {
          osc.stop();
        } catch {}
      }, 400);
      // short double beep
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "square";
          osc2.frequency.value = 660;
          gain2.gain.value = 0.2;
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start();
          setTimeout(() => {
            try {
              osc2.stop();
            } catch {}
          }, 300);
        } catch {}
      }, 150);
    } catch {}
  };

  const act = async (id: string, action: "BILLED" | "PRINT") => {
    setBusyId(id);
    setError(null);
    try {
      if (action === "PRINT") {
        await printOrder(id);
      } else {
        await updateOrderStatus(id, action);
      }
      const latest = await fetchOrders();
      setOrders(latest);
    } catch (e: any) {
      setError(e.message || "Failed to update order");
    } finally {
      setBusyId(null);
    }
  };

  const toggleAvailability = async (id: string, available: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      await updateItem(id, { available });
      setItems((prev) => prev.map((i) => (i._id === id ? { ...i, available } : i)));
    } catch (e: any) {
      setError(e.message || "Failed to update availability");
    } finally {
      setBusyId(null);
    }
  };

  const resetForm = () =>
    setItemForm({
      name: "",
      price: "",
      category: "Bakery",
      imageUrl: "",
      available: true,
    });

  const submitItem = async () => {
    setError(null);
    try {
      const payload = {
        name: itemForm.name.trim(),
        price: Number(itemForm.price),
        category: itemForm.category.trim() || "Bakery",
        imageUrl: itemForm.imageUrl.trim(),
        available: itemForm.available,
      };
      if (!payload.name || Number.isNaN(payload.price)) {
        setError("Name and price are required");
        return;
      }
      if (itemForm._id) {
        await updateItem(itemForm._id, payload);
      } else {
        await createItem(payload);
      }
      await loadData();
      resetForm();
      setItemModalOpen(false);
    } catch (e: any) {
      setError(e.message || "Failed to save item");
    }
  };

  const editItem = (item: Item) => {
    setItemForm({
      _id: item._id,
      name: item.name,
      price: String(item.price),
      category: item.category,
      imageUrl: item.imageUrl || "",
      available: item.available,
    });
    setItemModalOpen(true);
  };

  const removeItem = async (id: string) => {
    setError(null);
    try {
      await deleteItem(id);
      await loadData();
    } catch (e: any) {
      setError(e.message || "Failed to delete item");
    }
  };

  const safeOrders = Array.isArray(orders) ? orders : [];
  const filteredOrders = Array.isArray(orders)
    ? hideBilled
      ? safeOrders.filter((o) => o.status !== "BILLED")
      : safeOrders
    : [];

  const tables = Array.from(new Set(safeOrders.map((o) => o.tableNumber))).sort(
    (a, b) => a - b
  );

  const selectedTableOrders =
    selectedTable === null
      ? []
      : safeOrders.filter((o) => o.tableNumber === selectedTable);

  const selectedCurrentOrders = selectedTableOrders.filter(
    (o) => o.status === "OPEN"
  );
  const selectedPreviousOrders = selectedTableOrders.filter(
    (o) => o.status === "BILLED"
  );

  const today = new Date();
  const isSameDay = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
  const isSameMonth = (d1: Date, d2: Date) =>
    d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();

  const salesDaily = safeOrders.reduce(
    (acc, o) => {
      const d = new Date(o.createdAt);
      if (isSameDay(d, today)) {
        acc.amount += o.total;
        acc.count += 1;
      }
      return acc;
    },
    { amount: 0, count: 0 }
  );

  const salesMonthly = safeOrders.reduce(
    (acc, o) => {
      const d = new Date(o.createdAt);
      if (isSameMonth(d, today)) {
        acc.amount += o.total;
        acc.count += 1;
      }
      return acc;
    },
    { amount: 0, count: 0 }
  );

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 via-white to-white p-4 sm:p-6">
      {notif && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 text-white px-4 py-3 shadow-lg">
          <p className="font-semibold">New Order</p>
          <p className="text-sm">Table {notif.table} • {notif.count} item(s)</p>
          <button
            onClick={() => setNotif(null)}
            className="mt-2 rounded bg-white/20 px-2 py-1 text-xs hover:bg-white/30"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="mx-auto max-w-6xl">
        <header className="mb-5 flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white/80 p-4 shadow-sm backdrop-blur sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-emerald-600 font-semibold">
              Counter Dashboard
            </p>
            <h1 className="text-3xl font-bold">SREE KUMARAN SWEETS &amp; BAKERY</h1>
            <p className="text-gray-600 text-sm">Live orders and menu control</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={enableSound}
              className={`rounded-lg ${soundEnabled ? "bg-emerald-100 text-emerald-700" : "bg-emerald-600 text-white"} px-4 py-2 shadow hover:-translate-y-0.5 hover:shadow-md transition`}
              title={soundEnabled ? "Sound enabled" : "Enable sound for notifications"}
            >
              {soundEnabled ? "Sound Enabled" : "Enable Sound"}
            </button>
            <button
              onClick={() => {
                resetForm();
                setItemModalOpen(true);
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-white shadow hover:-translate-y-0.5 hover:shadow-md transition"
            >
              Manage Menu Items
            </button>
            <button
              onClick={() => setInventoryModalOpen(true)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-gray-800 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
            >
              Inventory
            </button>
            <button
              onClick={() => setSalesModalOpen(true)}
              className="rounded-lg border border-gray-200 px-4 py-2 text-gray-800 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition"
            >
              View Sales
            </button>
          </div>
        </header>

        {error && (
          <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="mb-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Live Orders</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setSelectedTable(tables[0] ?? null);
                  setShowOnlyOpen(true);
                  setTableModalOpen(true);
                }}
                disabled={tables.length === 0}
                className="rounded-lg border border-gray-200 px-3 py-1 text-xs sm:text-sm text-gray-800 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition disabled:opacity-50"
              >
                View Table Orders
              </button>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={hideBilled}
                  onChange={(e) => setHideBilled(e.target.checked)}
                />
                Hide billed
              </label>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Real-time
              </span>
            </div>
          </div>
        </section>

        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  Table
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  Items
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  Total
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order._id}>
                  <td className="px-4 py-3 font-semibold">Table {order.tableNumber}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <ul className="space-y-1">
                      {order.items.map((i) => (
                        <li key={i.itemId}>
                          {i.name} x{i.quantity} — ₹{(i.price * i.quantity).toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 font-semibold">₹ {order.total.toFixed(2)}</td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gray-100 px-2 py-1 text-xs font-semibold uppercase text-gray-700">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => act(order._id, "PRINT")}
                        disabled={busyId === order._id || order.status === "BILLED"}
                        className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                      >
                        Print Bill
                      </button>
                      <button
                        onClick={() => act(order._id, "BILLED")}
                        disabled={busyId === order._id || order.status === "BILLED"}
                        className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                      >
                        KOT Complete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-sm text-gray-500" colSpan={5}>
                    No orders to show.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {tableModalOpen && selectedTable !== null && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-gray-500">Table-wise Orders</p>
                  <h3 className="text-xl font-bold">
                    Table {selectedTable} Orders
                  </h3>
                </div>
                <button
                  onClick={() => setTableModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {tables.map((t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setSelectedTable(t);
                        setShowOnlyOpen(true);
                      }}
                      className={`rounded-full px-3 py-1 text-sm border ${
                        t === selectedTable
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-800 border-gray-300"
                      }`}
                    >
                      Table {t}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <button
                    onClick={() => setShowOnlyOpen(true)}
                    className={`rounded-full px-3 py-1 border text-xs sm:text-sm ${
                      showOnlyOpen
                        ? "bg-emerald-50 border-emerald-500 text-emerald-700"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    Current (OPEN)
                  </button>
                  <button
                    onClick={() => setShowOnlyOpen(false)}
                    className={`rounded-full px-3 py-1 border text-xs sm:text-sm ${
                      !showOnlyOpen
                        ? "bg-blue-50 border-blue-500 text-blue-700"
                        : "bg-white border-gray-300 text-gray-700"
                    }`}
                  >
                    Previous (BILLED)
                  </button>
                </div>
              </div>

              <div className="max-h-[60vh] overflow-y-auto space-y-4">
                {(showOnlyOpen ? selectedCurrentOrders : selectedPreviousOrders).map(
                  (order) => (
                    <div
                      key={order._id}
                      className="rounded-xl border border-gray-100 bg-gray-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm text-gray-600">
                            {new Date(order.createdAt).toLocaleString()}
                          </p>
                          <p className="text-lg font-semibold">
                            ₹ {order.total.toFixed(2)}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => printKot(order._id).catch((e) =>
                              setError(e.message || "Failed to print KOT")
                            )}
                            disabled={busyId === order._id}
                            className="rounded bg-emerald-600 px-3 py-1 text-sm text-white"
                          >
                            Print KOT
                          </button>
                          <button
                            onClick={() => act(order._id, "PRINT")}
                            disabled={busyId === order._id || order.status === "BILLED"}
                            className="rounded bg-indigo-600 px-3 py-1 text-sm text-white"
                          >
                            Print Bill
                          </button>
                          <button
                            onClick={() => act(order._id, "BILLED")}
                            disabled={busyId === order._id || order.status === "BILLED"}
                            className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                          >
                            Mark Billed
                          </button>
                        </div>
                      </div>
                      <ul className="mt-3 space-y-1 text-sm text-gray-800">
                        {order.items.map((i) => (
                          <li key={i.itemId} className="flex justify-between">
                            <span>{i.name}</span>
                            <span>
                              x{i.quantity} — ₹
                              {(i.price * i.quantity).toFixed(2)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                )}

                {(showOnlyOpen ? selectedCurrentOrders : selectedPreviousOrders)
                  .length === 0 && (
                  <p className="text-sm text-gray-500">
                    No {showOnlyOpen ? "current" : "previous"} orders for this table.
                  </p>
                )}
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setTableModalOpen(false)}
                  className="rounded border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {itemModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Menu Management</p>
                  <h3 className="text-xl font-bold">
                    {itemForm._id ? "Edit Item" : "Add New Item"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    resetForm();
                    setItemModalOpen(false);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-gray-700">
                  Name
                  <input
                    value={itemForm.name}
                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 p-2"
                    placeholder="Item name"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Price
                  <input
                    value={itemForm.price}
                    onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 p-2"
                    placeholder="Price"
                    type="number"
                    step="0.01"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Category
                  <input
                    value={itemForm.category}
                    onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 p-2"
                    placeholder="Category"
                  />
                </label>
                <label className="text-sm text-gray-700">
                  Image URL (optional)
                  <input
                    value={itemForm.imageUrl}
                    onChange={(e) => setItemForm({ ...itemForm, imageUrl: e.target.value })}
                    className="mt-1 w-full rounded border border-gray-300 p-2"
                    placeholder="https://..."
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={itemForm.available}
                    onChange={(e) => setItemForm({ ...itemForm, available: e.target.checked })}
                  />
                  Available
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  onClick={submitItem}
                  className="rounded bg-emerald-600 px-4 py-2 text-white shadow hover:scale-[1.01] transition"
                >
                  {itemForm._id ? "Update Item" : "Add Item"}
                </button>
                <button
                  onClick={resetForm}
                  className="rounded border border-gray-300 px-4 py-2 text-gray-700"
                >
                  Clear
                </button>
                <button
                  onClick={() => {
                    resetForm();
                    setItemModalOpen(false);
                  }}
                  className="ml-auto rounded border border-gray-200 px-4 py-2 text-gray-600 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-3 max-h-72 overflow-y-auto sm:grid-cols-2">
                {items.map((item) => (
                  <div
                    key={item._id}
                    className="rounded border border-gray-200 p-3 shadow-sm bg-white"
                  >
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-600">
                      ₹ {item.price.toFixed(2)} — {item.category}
                    </p>
                    <p className="text-xs text-gray-500">
                      {item.available ? "Available" : "Unavailable"}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => editItem(item)}
                        className="rounded border border-gray-300 px-3 py-1 text-sm"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeItem(item._id)}
                        className="rounded bg-red-600 px-3 py-1 text-sm text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-gray-500">No items yet.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {salesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-500">Sales Overview</p>
                  <h3 className="text-xl font-bold">Daily & Monthly</h3>
                </div>
                <button
                  onClick={() => setSalesModalOpen(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-gray-200 p-4 bg-emerald-50">
                  <p className="text-sm text-gray-600">Today</p>
                  <p className="text-2xl font-bold">₹ {salesDaily.amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">{salesDaily.count} orders</p>
                </div>
                <div className="rounded-lg border border-gray-200 p-4 bg-blue-50">
                  <p className="text-sm text-gray-600">This Month</p>
                  <p className="text-2xl font-bold">₹ {salesMonthly.amount.toFixed(2)}</p>
                  <p className="text-xs text-gray-600">{salesMonthly.count} orders</p>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setSalesModalOpen(false)}
                  className="rounded border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {inventoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
            <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl animate-[fadeIn_0.15s_ease-out]">
              <div className="mb-4 flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm text-gray-500">Inventory</p>
                  <h3 className="text-xl font-bold">Availability Control</h3>
                  <p className="text-sm text-gray-600">
                    Toggle availability or open an item to edit details.
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      resetForm();
                      setItemModalOpen(true);
                    }}
                    className="rounded border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Add / Edit Items
                  </button>
                  <button
                    onClick={() => setInventoryModalOpen(false)}
                    className="rounded border border-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[70vh] overflow-y-auto">
                {items.map((item) => (
                  <div
                    key={item._id}
                    className="rounded-xl border border-gray-100 bg-gray-50 p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 leading-tight">{item.name}</p>
                        <p className="text-xs text-gray-600">
                          ₹ {item.price.toFixed(2)} — {item.category}
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 border border-gray-200">
                        {item.available ? "Available" : "Unavailable"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs font-semibold text-gray-700">
                        <span>Available</span>
                        <button
                          onClick={() => toggleAvailability(item._id, !item.available)}
                          disabled={busyId === item._id}
                          aria-pressed={item.available}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                            item.available ? "bg-emerald-500" : "bg-gray-300"
                          } disabled:opacity-60`}
                        >
                          <span
                            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                              item.available ? "translate-x-5" : "translate-x-1"
                            }`}
                          />
                        </button>
                      </label>
                      <button
                        onClick={() => editItem(item)}
                        className="ml-auto rounded-full border border-gray-200 px-3 py-2 text-xs text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-gray-600">No items yet. Add one to get started.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
