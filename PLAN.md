# Plan: Pac-Man Multijugador en Red Local

## 1. Visión General

Crear un juego de Pac-Man multijugador en tiempo real donde varios usuarios conectados a la misma red LAN puedan jugar simultáneamente. Un jugador controla a Pac-Man y otros controlan a los fantasmas (o varios Pac-Men compitiendo por puntos), sincronizados vía WebSockets.

### Objetivos clave
- Descubrimiento automático del servidor en la red local (sin configurar IPs manualmente).
- Latencia baja (<50 ms) entre jugadores en la misma LAN.
- Soporte para 2–4 jugadores por partida.
- Interfaz moderna y responsive.

---

## 2. Stack Tecnológico

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| Framework | **Next.js 15** (App Router) | SSR, rutas API, estructura clara |
| Lenguaje | **TypeScript** | Tipado estricto para lógica de juego |
| Estilos | **Tailwind CSS 4** | Prototipado rápido de UI |
| Render del juego | **HTML5 Canvas** + `requestAnimationFrame` | Mejor rendimiento que DOM para sprites |
| Tiempo real | **Socket.IO** (sobre WebSocket) | Reconexión automática, rooms, fallback |
| Servidor | **Node.js** custom server (`server.ts`) | Necesario para integrar Socket.IO con Next.js |
| Estado cliente | **Zustand** | Ligero, sin boilerplate |
| Descubrimiento LAN | **Bonjour / mDNS** (`bonjour-service`) | Anuncio del servidor en la red |
| Validación | **Zod** | Esquemas de mensajes entre cliente/servidor |
| Testing | **Vitest** + **Playwright** | Unit + E2E |
| Lint/Format | **ESLint** + **Prettier** | — |

---

## 3. Arquitectura

```
┌─────────────────┐       WebSocket        ┌──────────────────┐
│  Cliente Next   │◄──────────────────────►│  Servidor Node   │
│  (Canvas + UI)  │       Socket.IO        │  (Game Loop)     │
└─────────────────┘                        └──────────────────┘
        ▲                                           │
        │ HTTP/SSR                                  │ mDNS
        ▼                                           ▼
┌─────────────────┐                        ┌──────────────────┐
│  Next.js pages  │                        │  Anuncio LAN     │
└─────────────────┘                        └──────────────────┘
```

### Modelo autoritativo en servidor
- El **servidor** mantiene la verdad absoluta del estado del juego (posiciones, puntos, vidas).
- Los **clientes** envían solo inputs (dirección deseada) y renderizan el estado recibido.
- Esto previene trampas y mantiene consistencia entre jugadores.

### Game loop
- Tick del servidor: **30 Hz** (33 ms por frame).
- Broadcast del estado: `{ players, ghosts, pellets, score, tick }` a todos los clientes de la sala.
- Interpolación en cliente para suavizar el movimiento entre ticks.

---

## 4. Estructura de Carpetas

```
pacman/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Lobby / menú principal
│   │   ├── game/[roomId]/page.tsx # Pantalla de juego
│   │   └── layout.tsx
│   ├── components/
│   │   ├── GameCanvas.tsx        # Renderizado del tablero
│   │   ├── Lobby.tsx
│   │   ├── Scoreboard.tsx
│   │   └── ServerList.tsx        # Servidores detectados en LAN
│   ├── game/
│   │   ├── engine.ts             # Lógica pura del juego
│   │   ├── maze.ts               # Definición del laberinto
│   │   ├── entities.ts           # Pac-Man, Fantasmas
│   │   ├── collision.ts
│   │   └── types.ts
│   ├── lib/
│   │   ├── socket-client.ts
│   │   └── store.ts              # Zustand
│   └── server/
│       ├── index.ts              # Custom server
│       ├── game-room.ts          # Estado de una sala
│       ├── discovery.ts          # mDNS
│       └── protocol.ts           # Esquemas Zod
├── public/
│   └── sprites/
├── tests/
├── server.ts                     # Entry point (Next + Socket.IO)
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── PLAN.md
```

---

## 5. Protocolo de Mensajes

**Cliente → Servidor**
- `join_room { roomId, playerName }`
- `input { direction: "up"|"down"|"left"|"right" }`
- `leave_room`

**Servidor → Cliente**
- `room_state { players, spectators, status }`
- `game_tick { entities, pellets, scores, tick }`
- `game_over { winner, finalScores }`
- `error { code, message }`

Todos los mensajes validados con **Zod** en ambos lados.

---

## 6. Fases de Implementación

### Fase 1 — Fundamentos (días 1–2)
- [ ] `create-next-app` con TypeScript + Tailwind.
- [ ] Configurar ESLint, Prettier, Vitest.
- [ ] Custom server con Socket.IO integrado.
- [ ] "Hello world" WebSocket: cliente conecta y recibe ping.

### Fase 2 — Motor de juego singleplayer (días 3–5)
- [ ] Definir laberinto clásico de Pac-Man (matriz 28×31).
- [ ] Renderizado en Canvas con Tailwind envolviendo la UI.
- [ ] Movimiento de Pac-Man con teclado (flechas/WASD).
- [ ] Colisiones con paredes y pellets.
- [ ] Puntuación y condiciones de victoria.

### Fase 3 — Fantasmas con IA básica (días 6–7)
- [ ] 4 fantasmas con pathfinding simple (BFS al jugador).
- [ ] Modos: scatter / chase / frightened (power pellets).
- [ ] Detección de colisión Pac-Man ↔ fantasma.

### Fase 4 — Multijugador LAN (días 8–11)
- [ ] Sistema de salas (room codes de 4 letras).
- [ ] Estado autoritativo en servidor, game loop a 30 Hz.
- [ ] Sincronización + interpolación en cliente.
- [ ] Reconciliación de inputs.
- [ ] Modo competitivo: varios Pac-Men compiten por pellets.
- [ ] Modo asimétrico: 1 Pac-Man vs N fantasmas humanos.

### Fase 5 — Descubrimiento en LAN (día 12)
- [ ] Servidor anuncia servicio `_pacman._tcp` vía mDNS.
- [ ] Cliente escanea y lista servidores detectados.
- [ ] Fallback: unirse por IP manual.

### Fase 6 — Pulido (días 13–15)
- [ ] Animaciones de sprites, sonidos (waka-waka).
- [ ] UI del lobby con Tailwind (lista jugadores, chat básico).
- [ ] Pantalla de game over con ranking.
- [ ] Tests E2E con Playwright (2 clientes simulados).
- [ ] README con instrucciones de despliegue local.

---

## 7. Consideraciones de Red

- **Puerto**: 3000 (Next.js) + 3001 (Socket.IO) o unificado vía custom server.
- **Firewall**: documentar cómo abrir el puerto en Windows/macOS/Linux.
- **Binding**: `0.0.0.0` para aceptar conexiones LAN, no solo localhost.
- **Latencia**: medir RTT y mostrarlo en UI.
- **Desconexiones**: timeout de 5 s, reintegrar al jugador si vuelve.

---

## 8. Criterios de Aceptación (MVP)

1. 2–4 jugadores en máquinas distintas de la misma red pueden unirse a una partida.
2. El servidor aparece automáticamente en la lista de clientes sin configurar IP.
3. Movimiento fluido sin "teleports" visibles (interpolación correcta).
4. Puntuación y estado final consistentes entre todos los clientes.
5. Reconexión automática si un cliente pierde Wi-Fi brevemente.

---

## 9. Extensiones Futuras (fuera del MVP)

- Modo torneo con brackets.
- Mapas personalizados (editor).
- Espectadores.
- Despliegue opcional en internet (WebRTC TURN server).
- Leaderboard persistente con SQLite.

---

## 10. Cómo arrancar (una vez implementado)

```bash
# Servidor (host)
pnpm install
pnpm dev            # escucha en 0.0.0.0:3000

# Clientes (misma red)
# Abrir navegador en http://<ip-del-host>:3000
# O usar el descubrimiento automático desde la app
```
