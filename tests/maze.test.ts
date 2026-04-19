import { describe, expect, it } from "vitest";
import { buildMaze, isBlocked, tileAt } from "../src/game/maze";
import { TILE_PELLET, TILE_POWER, TILE_WALL } from "../src/game/types";

describe("maze", () => {
  const maze = buildMaze();

  it("has the expected dimensions", () => {
    expect(maze.width).toBe(28);
    expect(maze.height).toBe(31);
  });

  it("counts pellets", () => {
    const pellets = maze.tiles.filter((t) => t === TILE_PELLET || t === TILE_POWER).length;
    expect(pellets).toBe(maze.totalPellets);
    expect(pellets).toBeGreaterThan(0);
  });

  it("has solid walls at the borders (top row)", () => {
    for (let x = 0; x < maze.width; x++) {
      expect(tileAt(maze, x, 0)).toBe(TILE_WALL);
    }
  });

  it("pacman starts on an open tile", () => {
    expect(isBlocked(maze, maze.pacmanStart.x, maze.pacmanStart.y)).toBe(false);
  });

  it("horizontal tunnels wrap (tile at x=-1 equals tile at x=width-1)", () => {
    const y = 14; // ghost-row tunnel
    const left = tileAt(maze, -1, y);
    const right = tileAt(maze, maze.width - 1, y);
    expect(left).toBe(right);
  });
});
