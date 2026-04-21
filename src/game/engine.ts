import {
  Direction,
  GameSnapshot,
  GhostMode,
  GhostName,
  GhostState,
  MazeLayout,
  PlayerRole,
  PlayerState,
  TILE_PELLET,
  TILE_POWER,
  Vec2,
} from "./types";
import { buildMaze, isBlocked, wrapX } from "./maze";

const GHOST_NAMES: GhostName[] = ["blinky", "pinky", "inky", "clyde"];

const PACMAN_SPEED = 0.12; // tiles per tick (at 30Hz ~= 3.6 tiles/sec)
const GHOST_SPEED = 0.11;
const FRIGHTENED_SPEED = 0.07;
const EATEN_SPEED = 0.2;

const MODE_SCHEDULE: { mode: GhostMode; ticks: number }[] = [
  { mode: "scatter", ticks: 7 * 30 },
  { mode: "chase", ticks: 20 * 30 },
  { mode: "scatter", ticks: 7 * 30 },
  { mode: "chase", ticks: 20 * 30 },
  { mode: "scatter", ticks: 5 * 30 },
  { mode: "chase", ticks: 20 * 30 },
  { mode: "scatter", ticks: 5 * 30 },
  { mode: "chase", ticks: Number.POSITIVE_INFINITY },
];

const FRIGHTENED_DURATION = 8 * 30;

export interface RoomConfig {
  mode: "coop" | "versus"; // coop: one pacman + AI ghosts. versus: pacman vs human ghosts
  maxPlayers: number;
}

export class GameEngine {
  readonly maze: MazeLayout;
  readonly config: RoomConfig;
  tick = 0;
  status: GameSnapshot["status"] = "lobby";
  players = new Map<string, PlayerState>();
  ghosts: GhostState[] = [];
  pellets: Uint8Array;
  pelletsRemaining: number;
  score = 0;
  scheduleIdx = 0;
  scheduleRemaining = MODE_SCHEDULE[0].ticks;
  frightenedRemaining = 0;
  countdown = 0;
  winnerId: string | null = null;
  level = 1;

  private getPacmanSpeed(): number {
    return Math.min(0.2, PACMAN_SPEED + (this.level - 1) * 0.005);
  }

  private getGhostSpeed(): number {
    return Math.min(0.19, GHOST_SPEED + (this.level - 1) * 0.01);
  }

  private getFrightenedDuration(): number {
    return Math.max(2 * 30, FRIGHTENED_DURATION - (this.level - 1) * 30);
  }

  constructor(config: RoomConfig = { mode: "coop", maxPlayers: 4 }) {
    this.config = config;
    this.maze = buildMaze();
    this.pellets = new Uint8Array(this.maze.width * this.maze.height);
    for (let i = 0; i < this.maze.tiles.length; i++) {
      if (this.maze.tiles[i] === TILE_PELLET || this.maze.tiles[i] === TILE_POWER) {
        this.pellets[i] = 1;
      }
    }
    this.pelletsRemaining = this.maze.totalPellets;
    this.resetGhosts();
  }

  private resetGhosts() {
    // Staggered exit delays so they don't all leave at once.
    const exitDelay: Record<GhostName, number> = {
      blinky: 0,
      pinky: 30,
      inky: 90,
      clyde: 180,
    };
    this.ghosts = GHOST_NAMES.map((name) => {
      let controlledBy: string | null = null;
      for (const p of this.players.values()) {
        if (p.role === name) {
          controlledBy = p.id;
          break;
        }
      }
      return {
        name,
        controlledBy,
        pos: { ...this.maze.ghostStarts[name] },
        dir: "up",
        wanted: "up",
        mode: "leaving",
        modeTimer: exitDelay[name],
      };
    });
  }

  addPlayer(id: string, name: string): PlayerState {
    const role: PlayerRole = this.assignRole();
    const pos =
      role === "pacman"
        ? this.findPacmanSpawn()
        : { ...this.maze.ghostStarts[role] };
    const player: PlayerState = {
      id,
      name,
      role,
      pos,
      dir: "none",
      wanted: "none",
      alive: true,
      score: 0,
      lives: 2,
    };
    this.players.set(id, player);
    if (role !== "pacman") {
      const ghost = this.ghosts.find((g) => g.name === role);
      if (ghost) ghost.controlledBy = id;
    }
    return player;
  }

  private assignRole(): PlayerRole {
    const roles = Array.from(this.players.values()).map((p) => p.role);
    if (this.config.mode === "coop") {
      // All players are pac-men competing for the highest score.
      return "pacman";
    }
    // Versus: split players roughly 50/50 between pacmen and ghosts.
    // After this join there will be N+1 players; aim for ceil(N+1)/2 pacmen
    // so the first player is pacman, second is ghost, third is pacman, etc.
    const pacCount = roles.filter((r) => r === "pacman").length;
    const ghostCount = roles.length - pacCount;
    const assignPacman = pacCount <= ghostCount;
    if (assignPacman) return "pacman";
    const usedGhosts = new Set(roles.filter((r) => r !== "pacman"));
    for (const g of GHOST_NAMES) {
      if (!usedGhosts.has(g)) return g;
    }
    // All 4 ghost slots taken; fall back to pacman.
    return "pacman";
  }

  removePlayer(id: string) {
    const p = this.players.get(id);
    if (!p) return;
    this.players.delete(id);
    const ghost = this.ghosts.find((g) => g.controlledBy === id);
    if (ghost) ghost.controlledBy = null;
  }

  private findPacmanSpawn(): Vec2 {
    const base = this.maze.pacmanStart;
    const taken = Array.from(this.players.values())
      .filter((p) => p.role === "pacman")
      .map((p) => ({ x: Math.round(p.pos.x), y: Math.round(p.pos.y) }));
    const isTaken = (x: number, y: number) =>
      taken.some((t) => t.x === x && t.y === y);
    // Expanding ring search around the pacman start for a free open tile.
    for (let r = 0; r <= 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = base.x + dx;
          const y = base.y + dy;
          if (y < 0 || y >= this.maze.height) continue;
          const wx = ((x % this.maze.width) + this.maze.width) % this.maze.width;
          if (isBlocked(this.maze, wx, y)) continue;
          if (isTaken(wx, y)) continue;
          return { x: wx, y };
        }
      }
    }
    return { ...base };
  }

  renamePlayer(id: string, name: string): PlayerState | null {
    const p = this.players.get(id);
    if (!p) return null;
    p.name = name;
    return p;
  }

  setInput(id: string, dir: Direction) {
    const p = this.players.get(id);
    if (!p) return;
    p.wanted = dir;
    const ghost = this.ghosts.find((g) => g.controlledBy === id);
    if (ghost) ghost.wanted = dir;
  }

  start() {
    this.status = "running";
    this.countdown = 3 * 30;
  }

  step() {
    if (this.status !== "running") return;
    this.tick++;

    if (this.countdown > 0) {
      this.countdown--;
      return;
    }

    this.advanceSchedule();

    for (const player of this.players.values()) {
      if (player.role === "pacman" && player.alive) this.movePacman(player);
    }

    for (const ghost of this.ghosts) {
      this.moveGhost(ghost);
    }

    this.handleCollisions();
    this.checkWinConditions();
  }

  private advanceSchedule() {
    if (this.frightenedRemaining > 0) {
      this.frightenedRemaining--;
      if (this.frightenedRemaining === 0) {
        for (const g of this.ghosts) {
          if (g.mode === "frightened") g.mode = this.currentBaseMode();
        }
      }
      return;
    }
    this.scheduleRemaining--;
    if (this.scheduleRemaining <= 0 && this.scheduleIdx < MODE_SCHEDULE.length - 1) {
      this.scheduleIdx++;
      this.scheduleRemaining = MODE_SCHEDULE[this.scheduleIdx].ticks;
      const newMode = MODE_SCHEDULE[this.scheduleIdx].mode;
      for (const g of this.ghosts) {
        if (g.mode !== "eaten" && g.mode !== "leaving") g.mode = newMode;
      }
    }
  }

  private currentBaseMode(): GhostMode {
    return MODE_SCHEDULE[this.scheduleIdx].mode;
  }

  private movePacman(player: PlayerState) {
    const speed = this.getPacmanSpeed();
    tryTurn(player, this.maze, false);
    stepEntity(player, this.maze, speed, false);

    // Consume pellets when roughly centered on a tile
    const cx = Math.round(player.pos.x);
    const cy = Math.round(player.pos.y);
    if (Math.abs(player.pos.x - cx) < 0.3 && Math.abs(player.pos.y - cy) < 0.3) {
      const idx = cy * this.maze.width + wrapX(this.maze, cx);
      if (this.pellets[idx]) {
        const tile = this.maze.tiles[idx];
        this.pellets[idx] = 0;
        this.pelletsRemaining--;
        if (tile === TILE_POWER) {
          player.score += 50;
          this.score += 50;
          this.enterFrightened();
        } else {
          player.score += 10;
          this.score += 10;
        }
      }
    }
  }

  private enterFrightened() {
    this.frightenedRemaining = this.getFrightenedDuration();
    for (const g of this.ghosts) {
      if (g.mode !== "eaten" && g.mode !== "leaving") {
        g.mode = "frightened";
        g.dir = reverseDir(g.dir);
      }
    }
  }

  private moveGhost(ghost: GhostState) {
    // Wait inside the house before starting to leave.
    if (ghost.mode === "leaving" && ghost.modeTimer > 0) {
      ghost.modeTimer--;
      // Bob up and down slightly to feel alive — but just hold position.
      return;
    }

    const speed =
      ghost.mode === "frightened"
        ? FRIGHTENED_SPEED
        : ghost.mode === "eaten" || ghost.mode === "leaving"
        ? EATEN_SPEED
        : this.getGhostSpeed();

    const canUseGate = ghost.mode === "eaten" || ghost.mode === "leaving";

    if (ghost.controlledBy === null) {
      // AI: decide on tile centers. We run the step first and only make a new
      // decision when the ghost has just arrived at (or passed through) an
      // integer tile coordinate this tick — that's an intersection. Otherwise
      // we let it continue in its current direction, which avoids the
      // snap-to-center oscillation that trapped ghosts for a whole tile.
      stepEntity(ghost, this.maze, speed, canUseGate);
      const atIntersection =
        ghost.dir === "none" || onTileCenter(ghost, speed);
      if (atIntersection) {
        ghost.pos.x = Math.round(ghost.pos.x);
        ghost.pos.y = Math.round(ghost.pos.y);
        const next = this.chooseGhostDir(ghost);
        ghost.wanted = next;
        ghost.dir = next;
      }
    } else {
      tryTurn(ghost, this.maze, canUseGate);
      stepEntity(ghost, this.maze, speed, canUseGate);
    }

    // Leaving → once above the gate, transition to the active base mode.
    if (ghost.mode === "leaving") {
      const home = this.maze.ghostHome;
      if (Math.round(ghost.pos.y) <= home.y) {
        ghost.mode = this.frightenedRemaining > 0 ? "frightened" : this.currentBaseMode();
      }
    }

    // Eaten → respawn at starting slot, then start leaving again.
    if (ghost.mode === "eaten") {
      const start = this.maze.ghostStarts[ghost.name];
      if (
        Math.abs(ghost.pos.x - start.x) < 0.3 &&
        Math.abs(ghost.pos.y - start.y) < 0.3
      ) {
        ghost.pos = { ...start };
        ghost.mode = "leaving";
        ghost.modeTimer = 30;
        ghost.dir = "up";
        ghost.wanted = "up";
      }
    }
  }

  private chooseGhostDir(ghost: GhostState): Direction {
    const target = this.ghostTarget(ghost);
    const options: Direction[] = ["up", "left", "down", "right"];
    const reverse = reverseDir(ghost.dir);
    const canUseGate = ghost.mode === "eaten" || ghost.mode === "leaving";

    // While inside the house or heading back, greedy distance fails around
    // walls — use BFS so ghosts actually find the gate.
    if (ghost.mode === "leaving" || ghost.mode === "eaten") {
      const bfs = this.bfsDir(ghost.pos, target, canUseGate);
      if (bfs) return bfs;
    }

    let best: { dir: Direction; dist: number } | null = null;
    for (const d of options) {
      if (d === reverse && ghost.mode !== "frightened") continue;
      const nx = ghost.pos.x + dx(d);
      const ny = ghost.pos.y + dy(d);
      if (isBlocked(this.maze, Math.round(nx), Math.round(ny), canUseGate))
        continue;
      const dist = (nx - target.x) ** 2 + (ny - target.y) ** 2;
      if (!best || dist < best.dist) best = { dir: d, dist };
    }
    if (!best && ghost.mode !== "frightened") {
      // force reverse if dead-end
      return reverse;
    }
    if (ghost.mode === "frightened") {
      // random pick among valid
      const valid = options.filter((d) => {
        if (d === reverse) return false;
        const nx = ghost.pos.x + dx(d);
        const ny = ghost.pos.y + dy(d);
        return !isBlocked(this.maze, Math.round(nx), Math.round(ny));
      });
      if (valid.length) return valid[Math.floor(Math.random() * valid.length)];
      return reverse;
    }
    return best!.dir;
  }

  private bfsDir(from: Vec2, to: Vec2, allowGate: boolean): Direction | null {
    const W = this.maze.width;
    const H = this.maze.height;
    const sx = Math.round(from.x);
    const sy = Math.round(from.y);
    const tx = Math.round(to.x);
    const ty = Math.round(to.y);
    if (sx === tx && sy === ty) return "up";
    const key = (x: number, y: number) => y * W + x;
    const prev = new Map<number, { x: number; y: number; dir: Direction }>();
    const seen = new Uint8Array(W * H);
    const queue: Array<{ x: number; y: number }> = [{ x: sx, y: sy }];
    seen[key(sx, sy)] = 1;
    const deltas: Array<{ d: Direction; dx: number; dy: number }> = [
      { d: "up", dx: 0, dy: -1 },
      { d: "down", dx: 0, dy: 1 },
      { d: "left", dx: -1, dy: 0 },
      { d: "right", dx: 1, dy: 0 },
    ];
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur.x === tx && cur.y === ty) {
        // Walk back to find the first step out of (sx, sy).
        let cx = cur.x;
        let cy = cur.y;
        let firstDir: Direction | null = null;
        while (true) {
          const p = prev.get(key(cx, cy));
          if (!p) return firstDir;
          firstDir = p.dir;
          if (p.x === sx && p.y === sy) return firstDir;
          cx = p.x;
          cy = p.y;
        }
      }
      for (const { d, dx: ddx, dy: ddy } of deltas) {
        const nx = cur.x + ddx;
        const ny = cur.y + ddy;
        if (ny < 0 || ny >= H) continue;
        const wx = ((nx % W) + W) % W;
        if (seen[key(wx, ny)]) continue;
        if (isBlocked(this.maze, nx, ny, allowGate)) continue;
        seen[key(wx, ny)] = 1;
        prev.set(key(wx, ny), { x: cur.x, y: cur.y, dir: d });
        queue.push({ x: wx, y: ny });
      }
    }
    return null;
  }

  private ghostTarget(ghost: GhostState): Vec2 {
    if (ghost.mode === "eaten") return this.maze.ghostStarts[ghost.name];
    if (ghost.mode === "leaving") return this.maze.ghostHome;
    if (ghost.mode === "scatter") return this.maze.scatterTargets[ghost.name];
    // chase
    const pac = this.findPacman();
    if (!pac) return this.maze.scatterTargets[ghost.name];
    switch (ghost.name) {
      case "blinky":
        return pac.pos;
      case "pinky": {
        return aheadOf(pac, 4);
      }
      case "inky": {
        const pivot = aheadOf(pac, 2);
        const blinky = this.ghosts.find((g) => g.name === "blinky")!;
        return { x: pivot.x * 2 - blinky.pos.x, y: pivot.y * 2 - blinky.pos.y };
      }
      case "clyde": {
        const dist = Math.hypot(pac.pos.x - ghost.pos.x, pac.pos.y - ghost.pos.y);
        return dist > 8 ? pac.pos : this.maze.scatterTargets.clyde;
      }
    }
  }

  private findPacman(): PlayerState | null {
    for (const p of this.players.values()) if (p.role === "pacman" && p.alive) return p;
    return null;
  }

  private handleCollisions() {
    for (const player of this.players.values()) {
      if (player.role !== "pacman" || !player.alive) continue;
      for (const ghost of this.ghosts) {
        const ghostPlayer = ghost.controlledBy ? this.players.get(ghost.controlledBy) : null;
        if (ghostPlayer && !ghostPlayer.alive) continue;

        const d = Math.hypot(player.pos.x - ghost.pos.x, player.pos.y - ghost.pos.y);
        if (d < 0.6) {
          if (ghost.mode === "frightened") {
            ghost.mode = "eaten";
            player.score += 200;
            this.score += 200;
            // Ghost loses a life if human
            if (ghost.controlledBy) {
              const ghostPlayer = this.players.get(ghost.controlledBy);
              if (ghostPlayer) {
                ghostPlayer.lives--;
                if (ghostPlayer.lives <= 0) {
                  ghostPlayer.alive = false;
                }
              }
            }
          } else if (ghost.mode !== "eaten" && ghost.mode !== "leaving") {
            player.lives--;
            
            // Award points in versus mode
            if (this.config.mode === "versus" && ghost.controlledBy) {
              const ghostPlayer = this.players.get(ghost.controlledBy);
              if (ghostPlayer) ghostPlayer.score += 300;
              // Assist points for other ghost players
              for (const p of this.players.values()) {
                if (p.role !== "pacman" && p.id !== ghost.controlledBy) {
                  p.score += 50;
                }
              }
            }

            if (player.lives <= 0) {
              player.alive = false;
            } else {
              player.pos = this.findPacmanSpawn();
              player.dir = "none";
              player.wanted = "none";
            }
            return;
          }
        }
      }
    }
  }

  private checkWinConditions() {
    if (this.pelletsRemaining <= 0) {
      if (this.config.mode === "versus") {
        for (const p of this.players.values()) {
          if (p.role === "pacman" && p.alive) p.score += 500;
        }
      }
      this.startNextLevel();
      return;
    }
    const pacmen = Array.from(this.players.values()).filter((p) => p.role === "pacman");
    if (pacmen.length > 0 && pacmen.every((p) => !p.alive)) {
      if (this.config.mode === "versus") {
        for (const p of this.players.values()) {
          if (p.role !== "pacman") p.score += 500;
        }
      }
      this.status = "finished";
      this.winnerId = null;
    }
  }

  private startNextLevel() {
    this.level++;
    for (let i = 0; i < this.maze.tiles.length; i++) {
      if (this.maze.tiles[i] === TILE_PELLET || this.maze.tiles[i] === TILE_POWER) {
        this.pellets[i] = 1;
      }
    }
    this.pelletsRemaining = this.maze.totalPellets;
    
    // Reset positions
    for (const p of this.players.values()) {
      if (!p.alive) continue; // Keep dead players dead
      
      if (p.role === "pacman") {
        p.pos = this.findPacmanSpawn();
      } else {
        p.pos = { ...this.maze.ghostStarts[p.role as GhostName] };
      }
      p.dir = "none";
      p.wanted = "none";
    }
    this.resetGhosts();
    this.countdown = 3 * 30; // 3 seconds pause
  }

  snapshot(): GameSnapshot {
    return {
      tick: this.tick,
      status: this.status,
      players: Array.from(this.players.values()),
      ghosts: this.ghosts,
      pelletsRemaining: this.pelletsRemaining,
      pelletBits: Buffer.from(this.pellets).toString("base64"),
      score: this.score,
      winnerId: this.winnerId,
      countdown: this.countdown,
      level: this.level,
    };
  }
}

function dx(d: Direction): number {
  return d === "left" ? -1 : d === "right" ? 1 : 0;
}
function dy(d: Direction): number {
  return d === "up" ? -1 : d === "down" ? 1 : 0;
}
function reverseDir(d: Direction): Direction {
  switch (d) {
    case "up":
      return "down";
    case "down":
      return "up";
    case "left":
      return "right";
    case "right":
      return "left";
    default:
      return "none";
  }
}
function aheadOf(p: PlayerState, n: number): Vec2 {
  return { x: p.pos.x + dx(p.dir) * n, y: p.pos.y + dy(p.dir) * n };
}

interface Movable {
  pos: Vec2;
  dir: Direction;
  wanted: Direction;
}

function tryTurn(m: Movable, maze: MazeLayout, allowGate: boolean) {
  if (m.wanted === "none" || m.wanted === m.dir) return;
  const cx = Math.round(m.pos.x);
  const cy = Math.round(m.pos.y);
  // Only allow turning when near a tile center
  if (Math.abs(m.pos.x - cx) > 0.15 || Math.abs(m.pos.y - cy) > 0.15) return;
  const nx = cx + dx(m.wanted);
  const ny = cy + dy(m.wanted);
  if (!isBlocked(maze, nx, ny, allowGate)) {
    m.pos.x = cx;
    m.pos.y = cy;
    m.dir = m.wanted;
  }
}

// True iff `m`'s current position is within half a step of an integer tile
// center along its axis of motion — that's when we treat it as "at" the
// intersection for decision-making purposes. Half-step tolerance means each
// tile center is matched exactly once per pass regardless of float drift.
function onTileCenter(m: Movable, speed: number): boolean {
  const tol = speed / 2 + 1e-6;
  if (m.dir === "up" || m.dir === "down") {
    return Math.abs(m.pos.y - Math.round(m.pos.y)) <= tol;
  }
  if (m.dir === "left" || m.dir === "right") {
    return Math.abs(m.pos.x - Math.round(m.pos.x)) <= tol;
  }
  return true;
}

function stepEntity(m: Movable, maze: MazeLayout, speed: number, allowGate: boolean) {
  if (m.dir === "none") return;
  const nx = m.pos.x + dx(m.dir) * speed;
  const ny = m.pos.y + dy(m.dir) * speed;
  // Check collision at the leading edge tile
  const leadX = Math.round(nx + dx(m.dir) * 0.5);
  const leadY = Math.round(ny + dy(m.dir) * 0.5);
  if (isBlocked(maze, leadX, leadY, allowGate)) {
    // snap to tile center
    m.pos.x = Math.round(m.pos.x);
    m.pos.y = Math.round(m.pos.y);
    m.dir = "none";
    return;
  }
  m.pos.x = nx;
  m.pos.y = ny;
  // Horizontal tunnel wrap
  if (m.pos.x < -0.5) m.pos.x += maze.width;
  else if (m.pos.x > maze.width - 0.5) m.pos.x -= maze.width;
}
