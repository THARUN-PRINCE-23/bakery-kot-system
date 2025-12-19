const API_BASE = (
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000"
).replace(/\/+$/, "");

// ---------- utils ----------

async function parseJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  throw new Error(
    text && text.startsWith("<")
      ? "Received HTML. Check API base URL."
      : text || `HTTP ${res.status}`
  );
}

function getAuthToken(): string | null {
  try {
    if (typeof window !== "undefined") {
      const adminToken = window.localStorage.getItem("authToken");
      // customer token injected in window (QR flow)
      // @ts-ignore
      const customerToken =
        typeof window !== "undefined" ? (window as any).customerToken : null;
      return adminToken || customerToken || null;
    }
  } catch {}
  return null;
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function jsonHeaders(): HeadersInit {
  return {
    "Content-Type": "application/json",
    ...authHeaders(),
  };
}

// ---------- types ----------

export type Item = {
  _id: string;
  name: string;
  category: string;
  price: number;
  imageUrl?: string;
  available: boolean;
};

export type OrderItem = {
  itemId: string;
  name: string;
  price: number;
  quantity: number;
};

export type Order = {
  _id: string;
  tableNumber: number;
  items: OrderItem[];
  total: number;
  status: "OPEN" | "BILLED";
  note?: string;
  createdAt: string;
};

// ---------- items ----------

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${API_BASE}/api/items`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await parseJson(res).catch(() => ({} as any));
    throw new Error(body.error || `Failed to fetch items (${res.status})`);
  }
  return parseJson(res);
}

export async function createItem(payload: {
  name: string;
  category?: string;
  price: number;
  imageUrl?: string;
  available?: boolean;
}): Promise<Item> {
  const res = await fetch(`${API_BASE}/api/items`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create item");
  return parseJson(res);
}

export async function updateItem(
  id: string,
  payload: Partial<Omit<Item, "_id">>
): Promise<Item> {
  const res = await fetch(`${API_BASE}/api/items/${id}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update item");
  return parseJson(res);
}

export async function deleteItem(id: string) {
  const res = await fetch(`${API_BASE}/api/items/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete item");
  return parseJson(res);
}

// ---------- orders ----------

export async function createOrder(payload: {
  tableNumber: number;
  items: { itemId: string; quantity: number }[];
  note?: string;
}): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to place order");
  return parseJson(res);
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${API_BASE}/api/orders`, {
    headers: authHeaders(),
  });
  if (!res.ok) {
    const body = await parseJson(res).catch(() => ({} as any));
    throw new Error(body.error || `Failed to fetch orders (${res.status})`);
  }
  return parseJson(res);
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order> {
  const res = await fetch(`${API_BASE}/api/orders/${id}/status`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return parseJson(res);
}

export async function fetchOrderByTable(
  tableNumber: number
): Promise<Order | null> {
  const res = await fetch(
    `${API_BASE}/api/orders/by-table/${tableNumber}`,
    {
      headers: authHeaders(),
    }
  );
  if (!res.ok) throw new Error("Failed to fetch order by table");
  return parseJson(res);
}

// ---------- print ----------

export async function printOrder(id: string) {
  const res = await fetch(`${API_BASE}/api/orders/${id}/print`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to print order");
  return parseJson(res);
}

export async function printKot(id: string) {
  const res = await fetch(`${API_BASE}/api/orders/${id}/print-kot`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error("Failed to print KOT");
  return parseJson(res);
}

// ---------- auth ----------

export async function login(payload: {
  username: string;
  password: string;
}) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await parseJson(res).catch(() => ({} as any));
    throw new Error(body.error || "Login failed");
  }
  return parseJson(res) as Promise<{ token: string }>;
}

export async function getCustomerToken() {
  const res = await fetch(`${API_BASE}/api/auth/customer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const body = await parseJson(res).catch(() => ({} as any));
    throw new Error(body.error || "Failed to get customer access");
  }
  return parseJson(res) as Promise<{
    token: string;
    expiresInSeconds: number;
  }>;
}
