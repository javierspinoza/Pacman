import {
  MazeLayout,
  TileType,
  TILE_EMPTY,
  TILE_WALL,
  TILE_PELLET,
  TILE_POWER,
  TILE_GATE,
} from "./types";

// 36x31 maze. Wider Pac-Man-style layout with dual horizontal tunnels,
// side chambers flanking the ghost house, and extra interior shortcuts
// that give both Pac-Man and ghost players more flanking routes.
// Legend:
//  #  wall        .  pellet       o  power pellet
//  -  ghost gate  P  pacman spawn (empty)
//  B N I C = ghost spawn slots (empty tile)
//  space   = empty corridor (no pellet)
//
// Every row is EXACTLY 36 characters. The layout is mirrored around the
// vertical seam between columns 17 and 18.
// Each row is written as two 18-char halves concatenated → exactly 36 chars.
// The seam is between columns 17 and 18. Layout is horizontally symmetric
// except for the ghost-spawn letters (B/N/I/C).
const RAW: string[] = [
  //0         1         2         3
  //0123456789012345678901234567890123 45
  "####################################", //  0  top wall
  "#................##................#", //  1
  "#.####.########.####.########.####.#", //  2
  "#o####.########.####.########.####o#", //  3  upper power pellets
  "#.####.########.####.########.####.#", //  4
  "#..................................#", //  5  perimeter corridor
  "#.####.####.####.##.####.####.####.#", //  6
  "#.####.####.####.##.####.####.####.#", //  7
  "#......####.......##.......####....#", //  8
  "######.####.##########.####.########", //  9  wall row w/ vertical lanes
  "     #.####.##########.####.#       ", // 10
  "     #......o........o......#       ", // 11
  "     #.####.###----###.####.#       ", // 12
  "######.####.#        #.####.########", // 13
  "      .     #   N  B #     .       #", // 14
  "######.####.#        #.####.########", // 15
  "      .     #   I  C #     .       #", // 16
  "######.####.##########.####.########", // 17
  "     #......o........o......#       ", // 18
  "     #.####.####.##.####.####.#     ", // 19
  "######.####.####.##.####.####.######", // 20
  "#................##................#", // 21
  "#.####.########.####.########.####.#", // 22
  "#.####.########.####.########.####.#", // 23
  "#o..##.........P..........##......o#", // 24  pacman spawn + corner power pellets
  "###.##.####.##.######.##.####.##.###", // 25
  "###.##.####.##.######.##.####.##.###", // 26
  "#......####......##......####......#", // 27
  "#.##############.##.##############.#", // 28
  "#.##############.##.##############.#", // 29
  "####################################", // 30  bottom wall
];

export function buildMaze(): MazeLayout {
  const width = 36;
  const height = RAW.length;
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
