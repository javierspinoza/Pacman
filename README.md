# Pac-Man LAN

Multiplayer Pac-Man para red local. Un host arranca el servidor, el resto se conectan desde la misma Wi-Fi y juegan en tiempo real vía WebSockets.

## Requisitos
- Node.js 20+
- pnpm 9+

## Arrancar
```bash
pnpm install
pnpm dev
```

El servidor escucha en `0.0.0.0:3000`. Verás algo como:

```
Local:    http://localhost:3000
Network:  http://192.168.1.50:3000
```

Los clientes de la misma red abren cualquiera de esas URLs. El servidor se anuncia vía mDNS (`_pacman._tcp`), así que otras instancias pueden detectarlo automáticamente en la sección "Servidores en tu red" del lobby.

## Cómo jugar
1. **Host:** introduce tu nombre, pulsa **Crear partida**, comparte el código de sala (4 letras).
2. **Invitados:** mismo lobby, pegan el código, pulsan **Unirse**.
3. El host pulsa **Iniciar partida** cuando todos estén dentro.
4. Controles: `← ↑ ↓ →` o `WASD`.

### Modos
- **Competitivo:** varios Pac-Men compiten por puntos; los fantasmas los controla la IA.
- **Asimétrico:** un jugador controla a Pac-Man, el resto a los fantasmas.

## Arquitectura
- **Next.js 15 (App Router) + TypeScript + Tailwind 4** en el cliente.
- **Custom server (`server.ts`)** integrando Next + **Socket.IO** (tick autoritativo a 30 Hz).
- **Canvas 2D** con `requestAnimationFrame` + interpolación entre snapshots.
- **Zustand** para estado cliente, **Zod** para validar mensajes.
- **bonjour-service** para el anuncio/descubrimiento mDNS.

## Estructura
```
src/
  app/              Next.js App Router (lobby, juego, API)
  components/       GameCanvas, Lobby, Scoreboard
  game/             Lógica pura (maze, engine, types)
  lib/              socket-client, store
  server/           RoomManager, GameRoom, discovery, protocolo Zod
server.ts           Entry point: Next + Socket.IO + mDNS
tests/              Vitest (unit)
```

## Tests
```bash
pnpm test            # unit (vitest)
pnpm typecheck       # tsc --noEmit
```

## Red
- Puerto por defecto: `3000` (configurable con `PORT=...`).
- Binding a `0.0.0.0`; asegúrate de que el firewall permite el puerto en LAN.
- Linux: `sudo ufw allow 3000/tcp`
- macOS: System Settings → Network → Firewall → permitir node.
- Windows: aceptar el diálogo la primera vez que arranques.

## Limitaciones del MVP
- No hay ranking persistente.
- Sin espectadores.
- Pathfinding de fantasmas: heurístico greedy (no BFS completo), funciona bien para el tablero clásico.
- Sin sprites bitmap; todo dibujado vectorial en canvas.
