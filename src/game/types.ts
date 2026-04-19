export type Direction = "up" | "down" | "left" | "right" | "none";

export type TileType = 0 | 1 | 2 | 3 | 4;
export const TILE_EMPTY: TileType = 0;
export const TILE_WALL: TileType = 1;
export const TILE_PELLET: TileType = 2;
export const TILE_POWER: TileType = 3;
export const TILE_GATE: TileType = 4;

export interface Vec2 {
  x: number;
  y: number;
}

export type GhostName = "blinky" | "pinky" | "inky" | "clyde";
export type GhostMode = "scatter" | "chase" | "frightened" | "eaten" | "leaving";
export type PlayerRole = "pacman" | GhostName;

export interface PlayerState {
  id: string;
  name: string;
  role: PlayerRole;
  pos: Vec2;
  dir: Direction;
  wanted: Direction;
  alive: boolean;
  score: number;
  lives: number;
}

export interface GhostState {
  name: GhostName;
  controlledBy: string | null;
  pos: Vec2;
  dir: Direction;
  wanted: Direction;
  mode: GhostMode;
  modeTimer: number;
}

export type GameStatus = "lobby" | "running" | "paused" | "finished";

export interface GameSnapshot {
  tick: number;
  status: GameStatus;
  players: PlayerState[];
  ghosts: GhostState[];
  pelletsRemaining: number;
  pelletBits: string;
  score: number;
  winnerId: string | null;
  countdown: number;
  level: number;
}

export interface MazeLayout {
  width: number;
  height: number;
  tiles: TileType[];
  pacmanStart: Vec2;
  ghostStarts: Record<GhostName, Vec2>;
  ghostHome: Vec2;
  scatterTargets: Record<GhostName, Vec2>;
  totalPellets: number;
}
