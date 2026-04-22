import {
  MazeLayout,
  TileType,
  TILE_EMPTY,
  TILE_WALL,
  TILE_PELLET,
  TILE_POWER,
  TILE_GATE,
} from "./types";
import { LAYOUTS } from "./layouts";

export function buildMaze(layoutIndex: number = 0): MazeLayout {
  const raw = LAYOUTS[((layoutIndex % LAYOUTS.length) + LAYOUTS.length) % LAYOUTS.length];
  const width = 36;
  const height = raw.length;
  const tiles: TileType[] = new Array(width * height).fill(TILE_EMPTY);
  let pacmanStart = { x: 17, y: 24 };
  const ghostStarts = {
    blinky: { x: 20, y: 14 },
    pinky: { x: 15, y: 14 },
    inky: { x: 15, y: 16 },
    clyde: { x: 20, y: 16 },
  };
  let ghostHome = { x: 17, y: 11 };
  let totalPellets = 0;

  for (let y = 0; y < height; y++) {
    const row = raw[y].padEnd(width, " ").slice(0, width);
    for (let x = 0; x < width; x++) {
      const ch = row[x];
      const idx = y * width + x;
      switch (ch) {
        case "#":
          tiles[idx] = TILE_WALL;
          break;
        case ".":
          tiles[idx] = TILE_PELLET;
          totalPellets++;
          break;
        case "o":
          tiles[idx] = TILE_POWER;
          totalPellets++;
          break;
        case "-":
          tiles[idx] = TILE_GATE;
          break;
        case "P":
          pacmanStart = { x, y };
          tiles[idx] = TILE_EMPTY;
          break;
        case "B":
          ghostStarts.blinky = { x, y };
          tiles[idx] = TILE_EMPTY;
          break;
        case "I":
          ghostStarts.inky = { x, y };
          tiles[idx] = TILE_EMPTY;
          break;
        case "N":
          ghostStarts.pinky = { x, y };
          tiles[idx] = TILE_EMPTY;
          break;
        case "C":
          ghostStarts.clyde = { x, y };
          tiles[idx] = TILE_EMPTY;
          break;
        default:
          tiles[idx] = TILE_EMPTY;
      }
    }
  }

  // Derive the ghost-house exit target: the corridor tile directly above the gate.
  let gateMinX = width,
    gateMaxX = -1,
    gateY = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tiles[y * width + x] === TILE_GATE) {
        gateY = y;
        if (x < gateMinX) gateMinX = x;
        if (x > gateMaxX) gateMaxX = x;
      }
    }
  }
  if (gateY >= 0) {
    ghostHome = {
      x: Math.floor((gateMinX + gateMaxX) / 2),
      y: gateY - 1,
    };
  }

  return {
    width,
    height,
    tiles,
    pacmanStart,
    ghostStarts,
    ghostHome,
    scatterTargets: {
      blinky: { x: width - 2, y: 0 },
      pinky: { x: 1, y: 0 },
      inky: { x: width - 1, y: height - 1 },
      clyde: { x: 0, y: height - 1 },
    },
    totalPellets,
  };
}

export function tileAt(maze: MazeLayout, x: number, y: number): TileType {
  if (y < 0 || y >= maze.height) return TILE_WALL;
  const wx = ((x % maze.width) + maze.width) % maze.width;
  return maze.tiles[y * maze.width + wx];
}

export function isBlocked(
  maze: MazeLayout,
  x: number,
  y: number,
  allowGate = false
): boolean {
  const t = tileAt(maze, x, y);
  if (t === TILE_WALL) return true;
  if (t === TILE_GATE && !allowGate) return true;
  return false;
}

export function wrapX(maze: MazeLayout, x: number): number {
  return ((x % maze.width) + maze.width) % maze.width;
}
