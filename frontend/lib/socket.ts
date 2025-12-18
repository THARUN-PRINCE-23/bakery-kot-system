"use client";

import type { Socket } from "socket.io-client";

let socket: Socket | null = null;

export async function getSocket(): Promise<Socket> {
  if (socket) return socket;
  const { io } = await import("socket.io-client");
  const url =
    process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL;
  socket = io(url as string);
  return socket;
}
