"use client";
import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getOrCreateClientId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("pacman.clientId");
  if (!id) {
    id =
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36));
    localStorage.setItem("pacman.clientId", id);
  }
  return id;
}

export function getClientId(): string {
  return getOrCreateClientId();
}

export function getSocket(): Socket {
  if (socket) return socket;
  socket = io({
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    auth: { clientId: getOrCreateClientId() },
  });
  return socket;
}
