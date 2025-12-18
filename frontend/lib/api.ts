import { io, Socket } from "socket.io-client";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:4000";

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
  status: "PENDING" | "PREPARING" | "PREPARED" | "BILLED";
  note?: string;
  createdAt: string;
};

export async function fetchItems(): Promise<Item[]> {
  const res = await fetch(`${API_URL}/items`);
  return res.json();
}

export async function createItem(payload: {
  name: string;
  category?: string;
  price: number;
  imageUrl?: string;
  available?: boolean;
}): Promise<Item> {
  const res = await fetch(`${API_URL}/items`, {
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
  const res = await fetch(`${API_URL}/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to update item");
  return res.json();
}

export async function deleteItem(id: string) {
  const res = await fetch(`${API_URL}/items/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to delete item");
  return res.json();
}

export async function createOrder(payload: {
  tableNumber: number;
  items: { itemId: string; quantity: number }[];
  note?: string;
}): Promise<Order> {
  const res = await fetch(`${API_URL}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to place order");
  return res.json();
}

export async function fetchOrders(): Promise<Order[]> {
  const res = await fetch(`${API_URL}/orders`);
  return res.json();
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order> {
  const res = await fetch(`${API_URL}/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Failed to update status");
  return res.json();
}

export async function printOrder(id: string) {
  const res = await fetch(`${API_URL}/orders/${id}/print`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to print order");
  return res.json();
}

let socket: Socket | null = null;
export function getSocket(): Socket {
  if (!socket) {
    socket = io(SOCKET_URL);
  }
  return socket;
}

