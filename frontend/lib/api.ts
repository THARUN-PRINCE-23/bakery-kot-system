const API_BASE = process.env.NEXT_PUBLIC_API_URL;

function getAuthToken(): string | null {
  try {
    if (typeof window !== "undefined") {
      const adminToken = window.localStorage.getItem("authToken");
      // @ts-ignore
      const customerToken = typeof window !== "undefined" ? (window as any).customerToken : null;
      return adminToken || customerToken || null;
    }
  } catch {}
  return null;
}

function authHeaders() {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

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

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/items`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch items (${res.status})`);
  }
  return res.json();
}

export async function createItem(payload: {
  name: string;
  category?: string;
  price: number;
  imageUrl?: string;
  available?: boolean;
}): Promise<Item> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create item");
  return res.json();
}

export async function updateItem(
  id: string,
  payload: Partial<Omit<Item, "_id">>
): Promise<Item> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/items/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error("Failed to update item");
  return res.json();
}

export async function deleteItem(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/items/${id}`,
    { method: "DELETE", headers: { ...authHeaders() } }
  );
  if (!res.ok) throw new Error("Failed to delete item");
  return res.json();
}

export async function createOrder(payload: {
  tableNumber: number;
  items: { itemId: string; quantity: number }[];
  note?: string;
}): Promise<Order> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to place order");
  return res.json();
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Failed to fetch orders (${res.status})`);
  }
  return res.json();
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/orders/${id}/status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status }),
    }
  );
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}

export async function printOrder(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/orders/${id}/print`,
    {
      method: "POST",
      headers: { ...authHeaders() },
    }
  );
  if (!res.ok) throw new Error("Failed to print order");
  return res.json();
}

export async function printKot(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/orders/${id}/print-kot`,
    {
      method: "POST",
      headers: { ...authHeaders() },
    }
  );
  if (!res.ok) throw new Error("Failed to print order");
  return res.json();
}

export async function login(payload: { username: string; password: string }) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error || "Login failed");
  return res.json() as Promise<{ token: string }>;
}

export async function verifyCustomerLocation(payload: { lat: number; lng: number }) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/auth/customer-location`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error((await res.json()).error || "Location verify failed");
  return res.json() as Promise<{ token: string; expiresInSeconds: number }>;
}

export async function fetchOrderByTable(tableNumber: number): Promise<Order | null> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/orders/by-table/${tableNumber}`,
    { headers: { ...authHeaders() } }
  );
  if (!res.ok) throw new Error("Failed to fetch order by table");
  return res.json();
}
