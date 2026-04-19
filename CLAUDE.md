# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # tsx server.ts — Next.js + Socket.IO + mDNS on 0.0.0.0:3000
pnpm build        # next build (does NOT build server.ts; runtime uses tsx)
pnpm start        # NODE_ENV=production tsx server.ts
pnpm lint         # next lint (ESLint 9 + eslint-config-next)
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run (Node env, tests/**/*.test.ts)
pnpm test:watch   # vitest in watch mode

# Run a single test file / filter by name
pnpm vitest run tests/engine.test.ts
pnpm vitest run -t "pellet collision"

# Override port
PORT=4000 pnpm dev
```

Node 20+, pnpm 9+. Use `pnpm`, not `npm`/`yarn` (lockfile is `pnpm-lock.yaml`).

## Architecture

This is a real-time LAN multiplayer Pac-Man. The key architectural decision is a **server-authoritative** model: clients send only input intents (a desired direction); the server owns all game state and broadcasts snapshots.

### Process layout

There is one Node process, started by [server.ts](server.ts). It hosts:
1. Next.js 15 (App Router) via a custom server — required to attach Socket.IO to the same HTTP server/port.
2. A Socket.IO server (all realtime traffic).
3. mDNS advertisement of `_pacman._tcp` so peers on the LAN can auto-discover the host.

`pnpm build` only builds the Next bundle; the server itself always runs through `tsx` (see `start` script). Treat `server.ts` as source that ships as-is.

### Server-authoritative loop

- [src/game/engine.ts](src/game/engine.ts) — `GameEngine` is **pure** logic: maze, pellets, players, ghosts, ghost AI (greedy heuristic, not full BFS — see `PLAN.md` vs. `README.md`), scatter/chase/frightened mode schedule. It has no Socket.IO or Next.js imports. All unit tests target this module.
- [src/server/game-room.ts](src/server/game-room.ts) — `GameRoom` wraps one engine and runs a `setInterval` tick at **30 Hz** (`TICK_MS = 1000/30`). Each tick calls `engine.step()` then emits a `tick` snapshot to the room. `RoomManager` owns the map of rooms keyed by 4-char codes (alphabet excludes ambiguous chars like `O`, `0`, `1`, `I`).
- [server.ts](server.ts) — Wires socket events (`create_room`, `join_room`, `start_game`, `input`, `leave_room`, `disconnect`) to `RoomManager`/`GameRoom` methods. Every inbound payload is validated with Zod schemas from [src/server/protocol.ts](src/server/protocol.ts) before touching engine state.

### Stable client identity

Sockets disconnect/reconnect constantly (tab reloads, Wi-Fi blips). `GameRoom` keys players by a **stable `clientId`** passed in `socket.handshake.auth.clientId`, falling back to `socket.id`. Consequences when editing:
- Do **not** use `socket.id` as a player key inside the engine — use the clientId (the room pulls it from `socket.data.clientId`).
- On rejoin, `addSocket` detects an existing player entry and renames rather than recreating — preserves score/position.
- If a second socket shows up for the same clientId, the old socket is kicked (`prev.disconnect(true)`). This is intentional deduplication.

### Wire protocol (client ⇄ server)

Client → server events (all Zod-validated in `server.ts`): `create_room`, `join_room`, `start_game`, `input`, `leave_room`. All use ack callbacks `({ ok, error?, roomId? })`.

Server → client events: `assigned` (your playerId + role on join), `lobby` (room state + full maze tiles), `tick` (per-frame snapshot from `engine.snapshot()`).

**Rule:** new fields sent to clients go through `engine.snapshot()` / the `lobby` payload. Do not emit ad-hoc events from inside `GameRoom` without updating both sides.

### Client rendering

- [src/components/GameCanvas.tsx](src/components/GameCanvas.tsx) — Canvas 2D with `requestAnimationFrame`, interpolating between the two most recent server snapshots. Do not drive movement from local keystrokes; keystrokes only emit `input` events.
- [src/lib/store.ts](src/lib/store.ts) — Zustand store holds latest snapshots, lobby state, socket connection.
- [src/lib/socket-client.ts](src/lib/socket-client.ts) — Creates the Socket.IO client and passes a persistent `clientId` (stored in `localStorage`) via `auth`.

### Maze & coordinates

[src/game/maze.ts](src/game/maze.ts) defines the 28×31 classic layout as a flat tile array. Tile constants (`TILE_WALL`, `TILE_PELLET`, `TILE_POWER`, …) live in [src/game/types.ts](src/game/types.ts). The engine uses **sub-tile float positions** with `PACMAN_SPEED`/`GHOST_SPEED` in tiles-per-tick; `wrapX` handles the horizontal tunnel. When editing movement/collision, respect that positions are fractional — integer tile indexing requires `Math.floor`.

### Game modes

`RoomConfig.mode` is `"coop"` (one human Pac-Man, AI ghosts) or `"versus"` (one human Pac-Man, human-controlled ghosts). Role assignment happens in `engine.addPlayer`. The README calls these "Competitivo"/"Asimétrico" — same thing, different names.

## Conventions

- **Path alias:** `@/*` → `src/*` (both `tsconfig.json` and `vitest.config.ts`). Use it in app code; tests under `tests/` tend to use relative imports.
- **Strict TS** is on. `noEmit: true` — the runtime is `tsx`, not `tsc`.
- **Validation at the boundary only.** Zod parses every client message in `server.ts`; internal engine code assumes already-validated inputs and does not re-check.
- **Pure engine.** Keep `src/game/*` free of Node/Socket.IO imports so it stays trivially unit-testable and deterministic (tests rely on this).
- Tests are Vitest in **Node environment** (`vitest.config.ts`). There are no DOM/Playwright tests yet despite what `PLAN.md` aspires to.
