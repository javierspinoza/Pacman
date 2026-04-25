"use client";
import { useEffect, useRef } from "react";
import { useGameStore } from "@/lib/store";
import type {
  GameSnapshot,
  GhostName,
  PlayerState,
  TileType,
} from "@/game/types";
import {
  TILE_PELLET,
  TILE_POWER,
  TILE_WALL,
  TILE_GATE,
} from "@/game/types";

const CELL = 22;

// Neon Palette matching the CSS variables
const GHOST_COLORS: Record<GhostName, string> = {
  blinky: "#FF003C",
  pinky: "#FF00FF",
  inky: "#00FFFF",
  clyde: "#FFA500",
};

// Pre-rendered maze cache — redraw only when layout changes.
let mazeCache: {
  key: string;
  canvas: HTMLCanvasElement;
} | null = null;

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const { lobby, snapshot, prevSnapshot, snapshotReceivedAt, playerId } =
        useGameStore.getState();
      if (!lobby) {
        rafRef.current = requestAnimationFrame(render);
        return;
      }
      const width = lobby.maze.width * CELL;
      const height = lobby.maze.height * CELL;
      if (canvas.width !== width) canvas.width = width;
      if (canvas.height !== height) canvas.height = height;

      // Pure deep space black for maximum contrast
      ctx.fillStyle = "#010005";
      ctx.fillRect(0, 0, width, height);

      drawMaze(ctx, lobby.maze);
      if (snapshot) drawPellets(ctx, lobby.maze, snapshot);

      if (snapshot) {
        if (snapshot.fruits && snapshot.fruits.length > 0) {
          drawFruits(ctx, snapshot.fruits);
        }
        if (snapshot.lasers && snapshot.lasers.length > 0) {
          drawLasers(ctx, snapshot.lasers);
        }
        const alpha = computeInterpAlpha(snapshotReceivedAt);
        drawEntities(ctx, snapshot, prevSnapshot, alpha, playerId);
      }

      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="relative p-2 rounded-2xl" style={{ border: "1px solid rgba(0, 255, 255, 0.2)", boxShadow: "inset 0 0 20px rgba(0, 255, 255, 0.1), 0 0 30px rgba(0, 255, 255, 0.1)" }}>
      {/* Decorative corner ornaments */}
      <CornerOrnament className="absolute -top-1 -left-1" />
      <CornerOrnament className="absolute -top-1 -right-1 rotate-90" />
      <CornerOrnament className="absolute -bottom-1 -left-1 -rotate-90" />
      <CornerOrnament className="absolute -bottom-1 -right-1 rotate-180" />
      <canvas
        ref={canvasRef}
        className="block mx-auto rounded-xl"
        style={{
          boxShadow: "0 0 0 1px rgba(0, 255, 255, 0.1)",
        }}
      />
    </div>
  );
}

function CornerOrnament({ className = "" }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      className={`pointer-events-none ${className}`}
      style={{ color: "rgba(0, 255, 255, 1)", filter: "drop-shadow(0 0 6px rgba(0, 255, 255, 0.8))" }}
    >
      <path
        d="M2 22 L2 2 L22 2"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

function computeInterpAlpha(receivedAt: number): number {
  if (!receivedAt) return 1;
  const elapsed = performance.now() - receivedAt;
  return Math.min(1, elapsed / 33);
}

function mazeKey(maze: { width: number; height: number; tiles: TileType[] }) {
  let h = `${maze.width}x${maze.height}|`;
  for (let i = 0; i < maze.tiles.length; i += 7) h += maze.tiles[i];
  return h;
}

function drawMaze(
  ctx: CanvasRenderingContext2D,
  maze: { width: number; height: number; tiles: TileType[] }
) {
  const key = mazeKey(maze);
  const w = maze.width * CELL;
  const h = maze.height * CELL;
  if (!mazeCache || mazeCache.key !== key) {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    renderMazeTo(off.getContext("2d")!, maze);
    mazeCache = { key, canvas: off };
  }
  ctx.drawImage(mazeCache.canvas, 0, 0);
}

function renderMazeTo(
  ctx: CanvasRenderingContext2D,
  maze: { width: number; height: number; tiles: TileType[] }
) {
  const isWall = (x: number, y: number) => {
    if (x < 0 || x >= maze.width || y < 0 || y >= maze.height) return true;
    return maze.tiles[y * maze.width + x] === TILE_WALL;
  };

  const pad = 2.5;
  const radius = 6;

  // --- Pass 1: Neon cyan aura beneath walls ---
  ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
  ctx.shadowBlur = 10;
  ctx.strokeStyle = "rgba(0, 255, 255, 0.9)";
  ctx.lineWidth = 3.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (!isWall(x, y)) continue;
      drawWallCell(ctx, x, y, isWall, pad, radius);
    }
  }

  // --- Pass 2: Dark core to create the hollow double-line effect ---
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#010005"; // Match canvas background
  ctx.lineWidth = 1.5;
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (!isWall(x, y)) continue;
      drawWallCell(ctx, x, y, isWall, pad, radius);
    }
  }

  // --- Gate: Neon pink horizontal line ---
  ctx.shadowBlur = 15;
  ctx.shadowColor = "rgba(255, 0, 255, 0.9)";
  ctx.strokeStyle = "rgba(255, 0, 255, 1)";
  ctx.lineWidth = 2.5;
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      if (maze.tiles[y * maze.width + x] !== TILE_GATE) continue;
      const px = x * CELL;
      const py = y * CELL;
      ctx.beginPath();
      ctx.moveTo(px, py + CELL / 2);
      ctx.lineTo(px + CELL, py + CELL / 2);
      ctx.stroke();
    }
  }
  ctx.shadowBlur = 0;
}

function drawWallCell(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  isWall: (x: number, y: number) => boolean,
  pad: number,
  radius: number
) {
  const px = x * CELL;
  const py = y * CELL;
  const L = px + pad;
  const R = px + CELL - pad;
  const T = py + pad;
  const B = py + CELL - pad;
  const top = isWall(x, y - 1);
  const bot = isWall(x, y + 1);
  const lft = isWall(x - 1, y);
  const rgt = isWall(x + 1, y);

  ctx.beginPath();
  if (!top) {
    ctx.moveTo(lft ? L - pad : L + radius, T);
    ctx.lineTo(rgt ? R + pad : R - radius, T);
    if (!rgt && !isWall(x + 1, y - 1)) {
      ctx.quadraticCurveTo(R, T, R, T + radius);
    }
  }
  if (!rgt) {
    ctx.moveTo(R, top ? T - pad : T + radius);
    ctx.lineTo(R, bot ? B + pad : B - radius);
    if (!bot && !isWall(x + 1, y + 1)) {
      ctx.quadraticCurveTo(R, B, R - radius, B);
    }
  }
  if (!bot) {
    ctx.moveTo(rgt ? R + pad : R - radius, B);
    ctx.lineTo(lft ? L - pad : L + radius, B);
    if (!lft && !isWall(x - 1, y + 1)) {
      ctx.quadraticCurveTo(L, B, L, B - radius);
    }
  }
  if (!lft) {
    ctx.moveTo(L, bot ? B + pad : B - radius);
    ctx.lineTo(L, top ? T - pad : T + radius);
    if (!top && !isWall(x - 1, y - 1)) {
      ctx.quadraticCurveTo(L, T, L + radius, T);
    }
  }
  ctx.stroke();
}

function drawPellets(
  ctx: CanvasRenderingContext2D,
  maze: { width: number; height: number; tiles: TileType[] },
  snap: GameSnapshot
) {
  const pellets = decodePellets(snap.pelletBits, maze.tiles.length);
  const pulse = 0.7 + 0.3 * Math.sin(performance.now() / 260);
  for (let y = 0; y < maze.height; y++) {
    for (let x = 0; x < maze.width; x++) {
      const idx = y * maze.width + x;
      if (!pellets[idx]) continue;
      const t = maze.tiles[idx];
      const px = x * CELL + CELL / 2;
      const py = y * CELL + CELL / 2;
      if (t === TILE_POWER) {
        // Power pellet — bright pulsing orb
        ctx.save();
        ctx.shadowColor = "rgba(0, 255, 255, 1)";
        ctx.shadowBlur = 25 * pulse;
        const grad = ctx.createRadialGradient(
          px - 2,
          py - 2,
          1,
          px,
          py,
          CELL * 0.35
        );
        grad.addColorStop(0, "#FFFFFF");
        grad.addColorStop(0.5, "#00FFFF");
        grad.addColorStop(1, "#005555");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(
          px,
          py,
          CELL * 0.3 * (0.8 + 0.2 * pulse),
          0,
          Math.PI * 2
        );
        ctx.fill();
        ctx.restore();
      } else if (t === TILE_PELLET) {
        // Regular pellet — bright neon dot
        ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
        ctx.shadowBlur = 5;
        ctx.fillStyle = "#E0FFFF";
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
}

function decodePellets(bits: string, len: number): Uint8Array {
  try {
    const bin = atob(bits);
    const out = new Uint8Array(len);
    for (let i = 0; i < Math.min(bin.length, len); i++)
      out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(len);
  }
}

function drawEntities(
  ctx: CanvasRenderingContext2D,
  snap: GameSnapshot,
  prev: GameSnapshot | null,
  alpha: number,
  selfId: string | null
) {
  for (const ghost of snap.ghosts) {
    const prevGhost = prev?.ghosts.find((g) => g.name === ghost.name);
    const x = lerp(prevGhost?.pos.x ?? ghost.pos.x, ghost.pos.x, alpha);
    const y = lerp(prevGhost?.pos.y ?? ghost.pos.y, ghost.pos.y, alpha);
    const ghostPlayer = snap.players.find((p) => p.role === ghost.name);
    const isDeadPlayer = ghostPlayer ? !ghostPlayer.alive : false;
    drawGhost(ctx, x, y, ghost.name, ghost.mode, ghost.dir, snap.tick, isDeadPlayer, ghost.activePower);
  }

  for (const player of snap.players) {
    if (!player.alive) continue; 
    
    let x, y;
    if (player.role === "pacman") {
      const prevP = prev?.players.find((p) => p.id === player.id);
      x = lerp(prevP?.pos.x ?? player.pos.x, player.pos.x, alpha);
      y = lerp(prevP?.pos.y ?? player.pos.y, player.pos.y, alpha);
      const invuln = (player.respawnInvulnTicks ?? 0) > 0;
      if (invuln && Math.floor(snap.tick / 4) % 2 === 0) continue;
      drawPacman(ctx, x, y, player.dir, snap.tick, player.id === selfId, player.activePower, snap.pacmenVulnerableRemaining > 0);
    } else {
      const ghost = snap.ghosts.find(g => g.name === player.role);
      if (!ghost) continue;
      const prevGhost = prev?.ghosts.find((g) => g.name === ghost.name);
      x = lerp(prevGhost?.pos.x ?? ghost.pos.x, ghost.pos.x, alpha);
      y = lerp(prevGhost?.pos.y ?? ghost.pos.y, ghost.pos.y, alpha);
    }
    
    drawNameTag(ctx, x, y - 0.75, player.name, player.id === selfId);
  }

  if (snap.countdown > 0) {
    const n = Math.ceil(snap.countdown / 30);
    const W = ctx.canvas.width;
    const H = ctx.canvas.height;
    // Vignette overlay, dark
    const v = ctx.createRadialGradient(W / 2, H / 2, 20, W / 2, H / 2, W);
    v.addColorStop(0, "rgba(0,0,0,0.6)");
    v.addColorStop(1, "rgba(0,0,0,0.95)");
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.shadowColor = "rgba(255, 215, 0, 0.8)";
    ctx.shadowBlur = 40;
    ctx.fillStyle = "#FFD700";
    ctx.font =
      "700 120px var(--font-display), 'Cormorant Garamond', 'Playfair Display', Georgia, serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(n), W / 2, H / 2);
    ctx.restore();

    // Glowing horizontal rules above/below
    ctx.shadowColor = "rgba(255, 215, 0, 0.5)";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "rgba(255, 215, 0, 0.8)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 80, H / 2 - 80);
    ctx.lineTo(W / 2 + 80, H / 2 - 80);
    ctx.moveTo(W / 2 - 80, H / 2 + 80);
    ctx.lineTo(W / 2 + 80, H / 2 + 80);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
}

function lerp(a: number, b: number, t: number): number {
  if (Math.abs(b - a) > 5) return b;
  return a + (b - a) * t;
}

function drawPacman(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  dir: PlayerState["dir"],
  tick: number,
  isSelf: boolean,
  activePower: any,
  vulnerable: boolean = false
) {
  const cx = tileX * CELL + CELL / 2;
  const cy = tileY * CELL + CELL / 2;
  const r = CELL * 0.44;
  const mouthPhase = (Math.sin((tick / 30) * Math.PI * 4) + 1) / 2;
  const mouthAngle = 0.08 + mouthPhase * 0.55;

  let rot = 0;
  if (dir === "up") rot = -Math.PI / 2;
  else if (dir === "down") rot = Math.PI / 2;
  else if (dir === "left") rot = Math.PI;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);

  if (activePower?.type === "strawberry") {
    ctx.globalAlpha = 0.4;
  }

  if (activePower?.type === "melon") {
    ctx.strokeStyle = "rgba(0, 255, 255, 0.9)";
    ctx.shadowColor = "rgba(0, 255, 255, 0.8)";
    ctx.shadowBlur = 15;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  if (isSelf || activePower?.type === "cherry") {
    // Intense neon yellow ring for self or speed boost
    ctx.strokeStyle = activePower?.type === "cherry" ? "rgba(255, 0, 0, 0.9)" : "rgba(255, 230, 0, 0.9)";
    ctx.shadowColor = activePower?.type === "cherry" ? "rgba(255, 0, 0, 0.8)" : "rgba(255, 230, 0, 0.8)";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Neon yellow body (or blue/white flash when vulnerable)
  const flashBlue = vulnerable && Math.floor(tick / 6) % 2 === 0;
  const flashWhite = vulnerable && Math.floor(tick / 6) % 2 === 1;
  ctx.shadowColor = vulnerable ? "rgba(0, 100, 255, 1)" : "rgba(255, 230, 0, 1)";
  ctx.shadowBlur = 20;
  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  if (flashBlue) {
    grad.addColorStop(0, "#AACCFF");
    grad.addColorStop(0.4, "#0040FF");
    grad.addColorStop(1, "#001A80");
  } else if (flashWhite) {
    grad.addColorStop(0, "#FFFFFF");
    grad.addColorStop(0.4, "#E0E0FF");
    grad.addColorStop(1, "#8888BB");
  } else {
    grad.addColorStop(0, "#FFFFFF");
    grad.addColorStop(0.4, "#FFE600");
    grad.addColorStop(1, "#CCB800");
  }
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r, mouthAngle, Math.PI * 2 - mouthAngle);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawGhost(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  name: GhostName,
  mode: string,
  dir: PlayerState["dir"],
  tick: number,
  isDeadPlayer: boolean = false,
  activePower: any
) {
  const cx = tileX * CELL + CELL / 2;
  const cy = tileY * CELL + CELL / 2;
  const r = CELL * 0.44;
  const frightFlash =
    mode === "frightened"
      ? Math.floor(tick / 6) % 2 === 0
        ? "#0000FF"
        : "#FFFFFF"
      : null;
  const base =
    mode === "eaten"
      ? "rgba(255,255,255,0.2)"
      : frightFlash ?? GHOST_COLORS[name];

  ctx.save();
  if (isDeadPlayer || activePower?.type === "strawberry") {
    ctx.globalAlpha = 0.3;
  }

  if (activePower?.type === "melon") {
    ctx.shadowColor = "rgba(0, 255, 255, 0.9)";
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "rgba(0, 255, 255, 1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  } else if (activePower?.type === "cherry") {
    ctx.shadowColor = "rgba(255, 0, 0, 0.9)";
    ctx.shadowBlur = 15;
    ctx.strokeStyle = "rgba(255, 0, 0, 1)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Vibrant neon glow
  if (mode !== "eaten") {
    ctx.shadowColor = base;
    ctx.shadowBlur = 20;
  }

  // Build the classic silhouette
  ctx.beginPath();
  ctx.arc(cx, cy - 1, r, Math.PI, 0);
  ctx.lineTo(cx + r, cy + r - 2);
  const feet = 5;
  const step = (r * 2) / feet;
  const wave = tick % 30 < 15 ? 0 : 1;
  for (let i = 0; i < feet; i++) {
    const x1 = cx + r - step * (i + 1);
    const y1 = cy + r - ((i + wave) % 2 === 0 ? 4 : 0);
    ctx.lineTo(x1, y1);
  }
  ctx.closePath();

  // Vertical gradient body for depth
  const grad = ctx.createLinearGradient(cx, cy - r, cx, cy + r);
  grad.addColorStop(0, shade(base, 0.4));
  grad.addColorStop(0.5, base);
  grad.addColorStop(1, shade(base, -0.3));
  ctx.fillStyle = grad;
  ctx.fill();

  // Bright white core edge
  if (mode !== "eaten") {
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  // Eyes — bright white
  const eyeDir = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
    none: { x: 0, y: 0 },
  }[dir];

  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(cx - r * 0.32, cy - 2, r * 0.22, 0, Math.PI * 2);
  ctx.arc(cx + r * 0.32, cy - 2, r * 0.22, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  ctx.fillStyle = mode === "frightened" ? "#FF0000" : "#000000";
  ctx.beginPath();
  ctx.arc(
    cx - r * 0.32 + eyeDir.x * 1.8,
    cy - 2 + eyeDir.y * 1.8,
    r * 0.12,
    0,
    Math.PI * 2
  );
  ctx.arc(
    cx + r * 0.32 + eyeDir.x * 1.8,
    cy - 2 + eyeDir.y * 1.8,
    r * 0.12,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

// Lighten/darken a hex color by amount in [-1, 1]. Handles #rrggbb and rgba().
function shade(color: string, amt: number): string {
  if (color.startsWith("rgba")) return color; // skip on eaten mode translucent
  let hex = color.replace("#", "");
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  if (hex.length !== 6) return color;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const mix = (c: number) => {
    if (amt >= 0) return Math.round(c + (255 - c) * amt);
    return Math.round(c * (1 + amt));
  };
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(mix(r))}${h(mix(g))}${h(mix(b))}`;
}

function drawNameTag(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number,
  name: string,
  isSelf: boolean
) {
  const cx = tileX * CELL + CELL / 2;
  const cy = tileY * CELL + CELL / 2;
  
  // Offset the tag upwards
  const tagY = cy - 25; 
  
  ctx.font = "600 10px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  const w = ctx.measureText(name).width + 16;
  
  const mainColor = isSelf ? "rgba(255, 215, 0, 0.9)" : "rgba(0, 255, 255, 0.7)";
  const bgColor = isSelf ? "rgba(0, 0, 0, 0.8)" : "rgba(0, 0, 0, 0.6)";

  // Draw connecting line
  ctx.beginPath();
  ctx.moveTo(cx, cy - 12);
  ctx.lineTo(cx, tagY + 8);
  ctx.lineTo(cx + 8, tagY + 8); // small elbow
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 1;
  ctx.stroke();

  // Neon tag background
  ctx.fillStyle = bgColor;
  ctx.shadowColor = isSelf ? "rgba(255, 215, 0, 0.3)" : "rgba(0, 255, 255, 0.2)";
  ctx.shadowBlur = 5;
  
  roundRect(ctx, cx - w / 2 + 10, tagY - 8, w, 16, 4);
  ctx.fill();
  
  // Bright border
  ctx.shadowBlur = 0;
  ctx.strokeStyle = mainColor;
  ctx.lineWidth = 1;
  ctx.stroke();
  
  ctx.fillStyle = isSelf ? "#FFE600" : "#00FFFF";
  ctx.fillText(name, cx + 10, tagY + 3);
  ctx.textAlign = "start";
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawDeadMark(
  ctx: CanvasRenderingContext2D,
  tileX: number,
  tileY: number
) {
  const cx = tileX * CELL + CELL / 2;
  const cy = tileY * CELL + CELL / 2;
  ctx.strokeStyle = "rgba(224,107,122,0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 6);
  ctx.lineTo(cx + 6, cy + 6);
  ctx.moveTo(cx + 6, cy - 6);
  ctx.lineTo(cx - 6, cy + 6);
  ctx.stroke();
}

function drawFruits(ctx: CanvasRenderingContext2D, fruits: any[]) {
  const fruitEmojis: Record<string, string> = {
    cherry: "🍒",
    strawberry: "🍓",
    apple: "🍏",
    melon: "🍈",
    powerpellet: "🫐",
    shuffle: "🌀",
  };
  const fruitColors: Record<string, string> = {
    cherry: "rgba(255, 0, 0, 0.8)",
    strawberry: "rgba(255, 105, 180, 0.8)",
    apple: "rgba(50, 205, 50, 0.8)",
    melon: "rgba(0, 255, 255, 0.8)",
    powerpellet: "rgba(0, 200, 255, 1)",
    shuffle: "rgba(180, 0, 255, 0.9)",
  };

  for (const f of fruits) {
    const cx = f.pos.x * CELL + CELL / 2;
    const cy = f.pos.y * CELL + CELL / 2;
    const emoji = fruitEmojis[f.type] || "🍎";
    const glowColor = fruitColors[f.type] || "rgba(255, 255, 255, 0.8)";

    ctx.save();
    ctx.translate(cx, cy);
    // Suave pulsación
    const pulse = 1 + Math.sin(f.expiresInTicks / 5) * 0.15;
    ctx.scale(pulse, pulse);

    // Resplandor neón detrás del emoji
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 15;
    
    // Fuente para asegurar que el emoji se vea bien
    ctx.font = `${CELL * 0.85}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Dibujar el emoji (la sombra se aplica automáticamente)
    ctx.fillText(emoji, 0, 1); // +1 y para centrarlo visualmente mejor

    // Añadir un pequeño destello blanco en el centro para dar más vida
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.arc(-CELL * 0.15, -CELL * 0.15, CELL * 0.1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

function drawLasers(ctx: CanvasRenderingContext2D, lasers: any[]) {
  for (const l of lasers) {
    const cx = l.x * CELL + CELL / 2;
    const cy = l.y * CELL + CELL / 2;
    
    let endX = cx;
    let endY = cy;
    
    if (l.dir === "up") endY -= l.length * CELL;
    else if (l.dir === "down") endY += l.length * CELL;
    else if (l.dir === "left") endX -= l.length * CELL;
    else if (l.dir === "right") endX += l.length * CELL;

    ctx.save();
    ctx.globalAlpha = Math.max(0, l.expiresInTicks / 15);
    
    ctx.shadowColor = "#32CD32";
    ctx.shadowBlur = 20;
    ctx.strokeStyle = "#32CD32";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(endX, endY);
    ctx.stroke();
    
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.restore();
  }
}
