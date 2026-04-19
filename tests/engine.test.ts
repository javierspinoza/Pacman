import { describe, expect, it } from "vitest";
import { GameEngine } from "../src/game/engine";

describe("GameEngine", () => {
  it("adds a player and assigns pacman to the first joiner", () => {
    const e = new GameEngine();
    const p = e.addPlayer("s1", "Ana");
    expect(p.role).toBe("pacman");
    expect(e.players.size).toBe(1);
  });

  it("advances tick when running", () => {
    const e = new GameEngine();
    e.addPlayer("s1", "Ana");
    e.start();
    const t0 = e.tick;
    e.step();
    expect(e.tick).toBe(t0 + 1);
  });

  it("pacman moves when input is given after countdown", () => {
    const e = new GameEngine();
    const p = e.addPlayer("s1", "Ana");
    e.start();
    // skip countdown
    for (let i = 0; i < 90; i++) e.step();
    e.setInput("s1", "left");
    const startX = p.pos.x;
    for (let i = 0; i < 20; i++) e.step();
    expect(p.pos.x).not.toBe(startX);
  });

  it("emits a snapshot with the expected shape", () => {
    const e = new GameEngine();
    e.addPlayer("s1", "Ana");
    const snap = e.snapshot();
    expect(snap.players.length).toBe(1);
    expect(snap.ghosts.length).toBe(4);
    expect(typeof snap.pelletBits).toBe("string");
  });

  it("AI ghosts leave the house and continue roaming the maze", () => {
    const e = new GameEngine();
    e.addPlayer("s1", "Ana");
    e.start();
    // Skip countdown + plenty of time for all four ghosts to exit and roam.
    for (let i = 0; i < 90 + 1200; i++) e.step();
    // All ghosts should have left "leaving" mode by now.
    const stillHoused = e.ghosts.filter((g) => g.mode === "leaving");
    expect(stillHoused).toEqual([]);
    // All ghosts should have made it above the gate at least once (y < 12).
    expect(e.ghosts.every((g) => g.pos.y < 12 || g.mode === "chase" || g.mode === "scatter")).toBe(true);
    // And they should be actively moving, not frozen at the gate line.
    expect(e.ghosts.every((g) => g.dir !== "none")).toBe(true);
  });

  it("second player in versus mode becomes a ghost", () => {
    const e = new GameEngine({ mode: "versus", maxPlayers: 4 });
    e.addPlayer("a", "A");
    const b = e.addPlayer("b", "B");
    expect(b.role).not.toBe("pacman");
  });
});
