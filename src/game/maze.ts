import {
  MazeLayout,
  TileType,
  TILE_EMPTY,
  TILE_WALL,
  TILE_PELLET,
  TILE_POWER,
  TILE_GATE,
} from "./types";

// 28x31 maze. Classic Pac-Man-style layout with one enclosed ghost house.
// Legend:
//  #  wall        .  pellet       o  power pellet
//  -  ghost gate  P  pacman spawn (empty)
//  B N I C = ghost spawn slots (empty tile)
//  space   = empty corridor (no pellet)
const RAW: string[] = [
  "############################",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#o####.#####.##.#####.####o#",
  "#.####.#####.##.#####.####.#",
  "#..........................#",
  "#.####.##.########.##.####.#",
  "#.####.##.########.##.####.#",
  "#......##....##....##......#",
  "######.##### ## #####.######",
  "     #.##### ## #####.#     ",
  "     #.##          ##.#     ",
  "     #.## ###--### ##.#     ",
  "######.## #      # ##.######",
  "      .   # N  B #   .      ",
  "######.## # I  C # ##.######",
  "     #.## ######## ##.#     ",
  "     #.##          ##.#     ",
  "     #.## ######## ##.#     ",
  "######.## ######## ##.######",
  "#............##............#",
  "#.####.#####.##.#####.####.#",
  "#.####.#####.##.#####.####.#",
  "#o..##.......P........##..o#",
  "###.##.##.########.##.##.###",
  "###.##.##.########.##.##.###",
  "#......##....##....##......#",
  "#.##########.##.##########.#",
  "#.##########.##.##########.#",
  "#..........................#",
  "############################",
];

export function buildMaze(): MazeLayout {
  const width = 28;
  const height = RAW.length;
  const tiles: TileType[] = new Array(width * height).fill(TILE_EMPTY);
  let pacmanStart = { x: 13, y: 23 };
  const ghostStarts = {
    blinky: { x: 15, y: 14 },
    pinky: { x: 12, y: 14 },
    inky: { x: 12, y: 15 },
    clyde: { x: 15, y: 15 },
  };
  let ghostHome = { x: 13, y: 11 };
  let totalPellets = 0;

  for (let y = 0; y < height; y++) {
    const row = RAW[y].padEnd(width, " ").slice(0, width);
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
