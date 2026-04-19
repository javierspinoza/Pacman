"use client";
import { create } from "zustand";
import type { GameSnapshot, TileType } from "@/game/types";

export interface LobbyState {
  roomId: string;
  status: GameSnapshot["status"];
  players: { id: string; name: string; role: string }[];
  maze: { width: number; height: number; tiles: TileType[] };
}

interface Store {
  playerId: string | null;
  playerName: string;
  role: string | null;
  roomId: string | null;
  lobby: LobbyState | null;
  snapshot: GameSnapshot | null;
  prevSnapshot: GameSnapshot | null;
  snapshotReceivedAt: number;
  setPlayerName: (n: string) => void;
  setAssigned: (p: { playerId: string; role: string; roomId: string }) => void;
  setLobby: (l: LobbyState) => void;
  setSnapshot: (s: GameSnapshot) => void;
  reset: () => void;
}

export const useGameStore = create<Store>((set) => ({
  playerId: null,
  playerName:
    typeof window !== "undefined"
      ? localStorage.getItem("pacman.name") ?? ""
      : "",
  role: null,
  roomId: null,
  lobby: null,
  snapshot: null,
  prevSnapshot: null,
  snapshotReceivedAt: 0,
  setPlayerName: (n) => {
    if (typeof window !== "undefined") localStorage.setItem("pacman.name", n);
    set({ playerName: n });
  },
  setAssigned: ({ playerId, role, roomId }) => set((state) => {
    if (state.roomId && state.roomId !== roomId) {
      return { playerId, role, roomId, snapshot: null, prevSnapshot: null, lobby: null };
    }
    return { playerId, role, roomId };
  }),
  setLobby: (lobby) => set({ lobby }),
  setSnapshot: (s) =>
    set((prev) => ({
      prevSnapshot: prev.snapshot,
      snapshot: s,
      snapshotReceivedAt: performance.now(),
    })),
  reset: () =>
    set({
      playerId: null,
      role: null,
      roomId: null,
      lobby: null,
      snapshot: null,
      prevSnapshot: null,
    }),
}));
