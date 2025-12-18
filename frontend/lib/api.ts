const API_BASE = process.env.NEXT_PUBLIC_API_URL;

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
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/items`);
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
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) throw new Error("Failed to update item");
  return res.json();
}

export async function deleteItem(id: string) {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/items/${id}`,
    { method: "DELETE" }
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
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to place order");
  return res.json();
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/orders`);
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
      headers: { "Content-Type": "application/json" },
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
    }
  );
  if (!res.ok) throw new Error("Failed to print order");
  return res.json();
}
