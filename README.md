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

### Modos de Juego
- **Cooperativo (Coop):** Varios Pac-Men colaboran para comer todos los puntos (pellets) del laberinto mientras evitan a los fantasmas controlados por la IA.
- **Competitivo (Versus):** Los jugadores pueden elegir ser Pac-Man o uno de los fantasmas (Blinky, Pinky, Inky, Clyde). Los Pac-Men ganan puntos comiendo pellets, mientras que los fantasmas ganan puntos eliminando a los Pac-Men (300 puntos para el asesino, 50 puntos de asistencia para los demás fantasmas).
  - Los fantasmas controlados por jugadores que mueren se vuelven "espectros" (transparentes) y continúan en la partida observando e interfiriendo mínimamente hasta el final.

### Mecánicas Especiales

**Revanchas:**
Al finalizar una partida, se mostrará un podio. El anfitrión verá un botón de **INICIAR REVANCHA** y los demás jugadores un botón de **PEDIR REVANCHA**. Los jugadores que pidan revancha quedarán en la sala y comenzarán automáticamente el siguiente nivel/partida cuando el creador lo decida. Quienes no la pidan serán expulsados a la pantalla de inicio.

**Frutas y Poderes:**
Durante la partida, aparecerán aleatoriamente frutas en el laberinto que otorgan poderes especiales por tiempo limitado o efectos inmediatos, aplicables tanto a Pac-Men como a Fantasmas:
- 🍒 **Cereza (Velocidad):** Aumenta la velocidad de movimiento un 50% durante 5 segundos.
- 🍓 **Fresa (Invisibilidad):** El jugador se vuelve semitransparente y puede atravesar a sus oponentes sin morir durante 5 segundos.
- 🍏 **Manzana (Rayo Láser):** Al comerla, dispara un rayo láser instantáneo en la dirección en la que mira el personaje. Cualquier oponente en esa línea recta (hasta encontrar un muro) será eliminado.
- 🍈 **Melón (Congelación):** Congela en el lugar a todos los oponentes del mapa durante 3 segundos.

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
