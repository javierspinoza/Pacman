import { createServer } from "node:http";
import os from "node:os";
import next from "next";
import { Server as SocketIOServer } from "socket.io";
import { RoomManager } from "./src/server/game-room";
import {
  CreateRoomSchema,
  InputSchema,
  JoinRoomSchema,
} from "./src/server/protocol";
import { startDiscovery, getLanAddresses } from "./src/server/discovery";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT ?? 3000);
const hostname = "0.0.0.0";

async function main() {
  const app = next({ dev, hostname, port });
  const handle = app.getRequestHandler();
  await app.prepare();

  const httpServer = createServer((req, res) => handle(req, res));
  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    pingInterval: 10000,
    pingTimeout: 5000,
  });
  const rooms = new RoomManager(io);

  io.on("connection", (socket) => {
    socket.on("create_room", (raw, ack) => {
      const parsed = CreateRoomSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.({ ok: false, error: "Invalid payload" });
        return;
      }
      leaveAllRooms(socket);
      const room = rooms.create({ mode: parsed.data.mode, maxPlayers: 8 });
      room.addSocket(socket, parsed.data.playerName);
      ack?.({ ok: true, roomId: room.id });
    });

    socket.on("join_room", (raw, ack) => {
      const parsed = JoinRoomSchema.safeParse(raw);
      if (!parsed.success) {
        ack?.({ ok: false, error: "Invalid payload" });
        return;
      }
      const room = rooms.get(parsed.data.roomId);
      if (!room) {
        ack?.({ ok: false, error: "Room not found" });
        return;
      }
      if (room.size >= 8) {
        ack?.({ ok: false, error: "Room full" });
        return;
      }
      if (room.engine.config.mode !== parsed.data.mode) {
        ack?.({ ok: false, error: "La modalidad seleccionada no coincide con la de la sala" });
        return;
      }
      leaveAllRooms(socket);
      room.addSocket(socket, parsed.data.playerName);
      ack?.({ ok: true, roomId: room.id });
    });

    socket.on("start_game", (raw, ack) => {
      const roomId = findRoomIdFor(socket);
      const room = roomId ? rooms.get(roomId) : undefined;
      if (!room) {
        ack?.({ ok: false, error: "Not in a room" });
        return;
      }
      
      const cid = socket.data.clientId;
      const players = Array.from(room.engine.players.values());
      if (players.length > 0 && players[0].id !== cid) {
        ack?.({ ok: false, error: "Solo el creador puede iniciar la partida" });
        return;
      }
      if (players.length < 2) {
        ack?.({ ok: false, error: "Faltan jugadores para iniciar" });
        return;
      }

      room.start();
      ack?.({ ok: true });
    });

    socket.on("input", (raw) => {
      const parsed = InputSchema.safeParse(raw);
      if (!parsed.success) return;
      const roomId = findRoomIdFor(socket);
      const room = roomId ? rooms.get(roomId) : undefined;
      if (!room) return;
      room.setInput(socket, parsed.data.direction);
    });

    socket.on("leave_room", () => {
      leaveAllRooms(socket);
    });

    socket.on("rematch", () => {
      const roomId = findRoomIdFor(socket);
      const room = roomId ? rooms.get(roomId) : undefined;
      if (room) {
        room.voteRematch(socket);
      }
    });

    socket.on("restart_game", (raw, ack) => {
      const roomId = findRoomIdFor(socket);
      const room = roomId ? rooms.get(roomId) : undefined;
      if (!room) {
        ack?.({ ok: false, error: "Not in a room" });
        return;
      }
      const ok = room.restartGame(socket);
      if (!ok) {
        ack?.({ ok: false, error: "Only the creator can restart" });
      } else {
        ack?.({ ok: true });
      }
    });

    socket.on("disconnect", () => {
      leaveAllRooms(socket);
    });

    function leaveAllRooms(s: typeof socket) {
      for (const r of [...s.rooms]) {
        if (r === s.id) continue;
        const room = rooms.get(r);
        if (room) {
          room.removeSocket(s);
          rooms.destroyIfEmpty(room.id);
        }
      }
    }

    function findRoomIdFor(s: typeof socket): string | null {
      for (const r of s.rooms) {
        if (r !== s.id) return r;
      }
      return null;
    }
  });

  httpServer.listen(port, hostname, async () => {
    const addrs = getLanAddresses();
    const host = os.hostname();
    console.log(`\n  🟡 Pac-Man LAN server\n`);
    console.log(`  Local:    http://localhost:${port}`);
    for (const a of addrs) console.log(`  Network:  http://${a}:${port}`);
    console.log("");
    await startDiscovery(port, host);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
