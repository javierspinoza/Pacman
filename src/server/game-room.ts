import type { Server, Socket } from "socket.io";
import { GameEngine, RoomConfig } from "../game/engine";

const TICK_HZ = 30;
const TICK_MS = 1000 / TICK_HZ;

function clientIdOf(socket: Socket): string {
  const cid = (socket.handshake.auth as { clientId?: string } | undefined)?.clientId;
  return cid && typeof cid === "string" && cid.length > 0 ? cid : socket.id;
}

export class GameRoom {
  readonly id: string;
  readonly engine: GameEngine;
  private interval: NodeJS.Timeout | null = null;
  // sockets keyed by clientId (stable across reloads)
  private sockets = new Map<string, Socket>();
  private rematchVotes = new Set<string>();

  constructor(id: string, private io: Server, config?: RoomConfig) {
    this.id = id;
    this.engine = new GameEngine(config);
  }

  addSocket(socket: Socket, playerName: string) {
    const cid = clientIdOf(socket);
    // If a previous socket for this client is still here, kick it out.
    const prev = this.sockets.get(cid);
    if (prev && prev.id !== socket.id) {
      prev.leave(this.id);
      try {
        prev.disconnect(true);
      } catch {
        /* noop */
      }
    }
    // Update name on rejoin, but keep same player entry.
    const existed = this.engine.players.has(cid);
    const player = existed
      ? this.engine.renamePlayer(cid, playerName)!
      : this.engine.addPlayer(cid, playerName);
    this.sockets.set(cid, socket);
    socket.join(this.id);
    socket.data.clientId = cid;
    socket.data.roomId = this.id;
    socket.emit("assigned", { playerId: cid, role: player.role, roomId: this.id });
    this.broadcastLobby();
  }

  removeSocket(socket: Socket) {
    const cid = socket.data.clientId ?? clientIdOf(socket);
    // Only remove if this socket is the current one for that client.
    const current = this.sockets.get(cid);
    if (current && current.id !== socket.id) return;
    this.engine.removePlayer(cid);
    socket.leave(this.id);
    this.sockets.delete(cid);
    this.broadcastLobby();
    if (this.sockets.size === 0) this.stop();
  }

  setInput(socket: Socket, direction: Parameters<GameEngine["setInput"]>[1]) {
    const cid = socket.data.clientId ?? clientIdOf(socket);
    this.engine.setInput(cid, direction);
  }

  start() {
    if (this.interval) return;
    this.engine.start();
    this.interval = setInterval(() => {
      this.engine.step();
      this.io.to(this.id).emit("tick", this.engine.snapshot(Array.from(this.rematchVotes)));
      if (this.engine.status === "finished") this.stop();
    }, TICK_MS);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  voteRematch(socket: Socket) {
    const cid = socket.data.clientId ?? clientIdOf(socket);
    this.rematchVotes.add(cid);
    // Send immediate snapshot update so UI reacts
    this.io.to(this.id).emit("tick", this.engine.snapshot(Array.from(this.rematchVotes)));
  }

  restartGame(socket: Socket) {
    const cid = socket.data.clientId ?? clientIdOf(socket);
    const players = Array.from(this.engine.players.values());
    if (players.length > 0 && players[0].id !== cid) return false;

    // Kick players who didn't vote
    for (const p of players) {
      // The creator is implicitly ready
      if (!this.rematchVotes.has(p.id) && p.id !== cid) {
        this.engine.removePlayer(p.id);
        const s = this.sockets.get(p.id);
        if (s) {
          s.emit("kicked");
          s.leave(this.id);
          this.sockets.delete(p.id);
        }
      }
    }
    
    this.engine.resetGame();
    this.rematchVotes.clear();
    this.broadcastLobby();
    this.io.to(this.id).emit("tick", this.engine.snapshot(Array.from(this.rematchVotes)));
    return true;
  }

  get size() {
    return this.sockets.size;
  }

  get isRunning() {
    return this.interval !== null;
  }

  private broadcastLobby() {
    this.io.to(this.id).emit("lobby", {
      roomId: this.id,
      status: this.engine.status,
      players: Array.from(this.engine.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
      })),
      maze: {
        width: this.engine.maze.width,
        height: this.engine.maze.height,
        tiles: this.engine.maze.tiles,
      },
    });
  }

  broadcastMazeTo(socket: Socket) {
    socket.emit("lobby", {
      roomId: this.id,
      status: this.engine.status,
      players: Array.from(this.engine.players.values()).map((p) => ({
        id: p.id,
        name: p.name,
        role: p.role,
      })),
      maze: {
        width: this.engine.maze.width,
        height: this.engine.maze.height,
        tiles: this.engine.maze.tiles,
      },
    });
  }
}

export class RoomManager {
  private rooms = new Map<string, GameRoom>();
  constructor(private io: Server) {}

  create(config?: RoomConfig): GameRoom {
    const id = generateRoomCode();
    const room = new GameRoom(id, this.io, config);
    this.rooms.set(id, room);
    return room;
  }

  get(id: string): GameRoom | undefined {
    return this.rooms.get(id.toUpperCase());
  }

  destroyIfEmpty(id: string) {
    const room = this.rooms.get(id);
    if (room && room.size === 0) {
      room.stop();
      this.rooms.delete(id);
    }
  }

  list() {
    return Array.from(this.rooms.values()).map((r) => ({
      id: r.id,
      players: r.size,
      status: r.engine.status,
    }));
  }
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 4; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
