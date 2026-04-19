"use client";
import { use, useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import GameCanvas from "@/components/GameCanvas";
import Scoreboard from "@/components/Scoreboard";
import { getSocket } from "@/lib/socket-client";
import { useGameStore } from "@/lib/store";
import type { Direction, GameSnapshot } from "@/game/types";
import { audio } from "@/lib/audio";

export default function GamePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const { roomId } = use(params);
  const router = useRouter();
  const {
    setLobby,
    setSnapshot,
    setAssigned,
    snapshot,
    lobby,
    playerId,
    playerName,
    reset,
  } = useGameStore();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const s = getSocket();
    const onAssigned = (p: {
      playerId: string;
      role: string;
      roomId: string;
    }) => setAssigned(p);
    const onLobby = (l: unknown) => setLobby(l as never);
    const onTick = (snap: GameSnapshot) => setSnapshot(snap);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    s.on("assigned", onAssigned);
    s.on("lobby", onLobby);
    s.on("tick", onTick);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    if (s.connected) setConnected(true);

    if (!playerId && playerName) {
      s.emit(
        "join_room",
        { playerName, roomId },
        (res: { ok: boolean; error?: string }) => {
          if (!res.ok) {
            alert(res.error ?? "No se pudo unir");
            router.push("/");
          }
        }
      );
    }

    return () => {
      s.off("assigned", onAssigned);
      s.off("lobby", onLobby);
      s.off("tick", onTick);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, [playerId, playerName, roomId, router, setAssigned, setLobby, setSnapshot]);

  const prevSnapRef = useRef<GameSnapshot | null>(null);

  useEffect(() => {
    if (!snapshot) return;
    if (!prevSnapRef.current) {
      prevSnapRef.current = snapshot;
      return;
    }
    const prev = prevSnapRef.current;
    const curr = snapshot;

    if (curr.score > prev.score) {
      if (curr.score - prev.score >= 50) {
        audio.playPowerUp();
      } else {
        audio.playChomp();
      }
    }

    if (curr.level > prev.level) {
      audio.playLevelUp();
    }

    curr.players.forEach((p) => {
      const pPrev = prev.players.find((pp) => pp.id === p.id);
      if (pPrev && pPrev.alive && !p.alive) {
        audio.playDeath();
      }
    });

    prevSnapRef.current = curr;
  }, [snapshot]);

  useEffect(() => {
    const s = getSocket();
    let lastSent: Direction | null = null;
    const sendDir = (d: Direction) => {
      if (d !== lastSent) {
        lastSent = d;
        s.emit("input", { direction: d });
      }
    };
    const down = (e: KeyboardEvent) => {
      audio.init();
      let d: Direction | null = null;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          d = "up";
          break;
        case "ArrowDown":
        case "s":
        case "S":
          d = "down";
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          d = "left";
          break;
        case "ArrowRight":
        case "d":
        case "D":
          d = "right";
          break;
      }
      if (d) {
        e.preventDefault();
        sendDir(d);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  const leave = () => {
    getSocket().emit("leave_room");
    reset();
    router.push("/");
  };

  const isCreator = lobby?.players[0]?.id === playerId;
  const isLobby = lobby?.status === "lobby";
  const hasEnoughPlayers = lobby ? lobby.players.length >= 2 : false;

  return (
    <main className="min-h-screen bg-[var(--bg-deep)] relative overflow-hidden flex flex-col items-center">
      {/* Background elements */}
      <div className="page-aura absolute inset-0 z-0"></div>
      <div className="stars z-0"></div>
      <div className="grain z-0"></div>

      {/* Top navigation rail */}
      <div className="relative z-10 w-full flex flex-col items-center pt-6 pb-4">
        <div className="w-full flex items-center justify-between px-12 absolute top-6">
          <div className="flex items-center gap-2 text-[10px] tracking-[0.2em] uppercase font-bold" style={{ color: "var(--ink-dim)" }}>
            <span
              className={`w-2 h-2 rounded-full ${connected ? "animate-pulse" : ""}`}
              style={{
                backgroundColor: connected ? "#00FFFF" : "var(--neon-blinky)",
                boxShadow: connected ? "0 0 10px #00FFFF" : "0 0 10px var(--neon-blinky)",
              }}
            />
            <span>{connected ? "Conectado" : "Desconectado"}</span>
          </div>

          <button
            onClick={leave}
            className="group flex items-center gap-3 px-6 py-2 rounded-full glass-hover transition-all duration-300"
            style={{ 
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.1)",
            }}
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] shadow-[0_0_10px_var(--gold)]"></span>
            <span className="text-[11px] tracking-[0.2em] uppercase font-bold text-white group-hover:text-[var(--gold)] transition-colors">
              Lobby
            </span>
            <span className="group-hover:translate-x-1 transition-transform text-white opacity-50">
              ›
            </span>
          </button>
        </div>

        <div className="text-center z-10">
          <div
            className="font-display text-4xl tracking-[0.15em] font-bold"
            style={{ 
              color: "var(--gold)",
              textShadow: "0 0 20px rgba(255, 215, 0, 0.5)",
            }}
          >
            PAC-MAN
          </div>
          <div
            className="flex items-center justify-center gap-2 text-[9px] tracking-[0.4em] uppercase mt-2 font-bold"
            style={{ color: "rgba(0, 255, 255, 0.8)" }}
          >
            <span>••</span>
            <span className="text-white">NEON ARCADE</span>
            <span>••</span>
          </div>
        </div>
      </div>

      {/* Top glowing line separator */}
      <div className="relative z-10 w-full max-w-[1200px] h-[2px] mb-8"
           style={{
             background: "linear-gradient(90deg, transparent 0%, rgba(0, 255, 255, 0.8) 50%, transparent 100%)",
             boxShadow: "0 0 15px rgba(0, 255, 255, 0.6)"
           }}>
      </div>

      {snapshot?.status === "finished" && <GameOver />}

      <section className="relative z-10 flex gap-8 items-start justify-center px-8 flex-1">
        <div className="flex flex-col items-center">
          <GameCanvas />
          
          {/* Controls moved to bottom */}
          <div className="flex items-center gap-6 mt-12 mb-6 text-[11px] tracking-[0.3em] uppercase font-bold">
            <KbdHint keys={["←", "W", "A", "→", "↓"]} />
          </div>
        </div>

        <Scoreboard />
      </section>

      {/* Footer signature */}
      <footer className="relative z-10 text-center pb-6 mt-auto w-full">
        <div className="w-full h-[2px] mb-6 opacity-30"
           style={{
             background: "linear-gradient(90deg, transparent 0%, rgba(0, 255, 255, 0.8) 20%, transparent 50%)",
             boxShadow: "0 0 15px rgba(0, 255, 255, 0.6)"
           }}>
        </div>
      </footer>
    </main>
  );
}

function KbdHint({ keys }: { keys: string[] }) {
  return (
    <span className="inline-flex items-center gap-2">
      {keys.map((k) => (
        <kbd
          key={k}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-[rgba(255,255,255,0.03)] border border-white/10 shadow-[0_4px_10px_rgba(0,0,0,0.5)] font-mono text-[12px] font-bold tracking-normal transition-all hover:bg-white/10 hover:border-[var(--neon-inky)] hover:shadow-[0_0_10px_var(--neon-inky)] cursor-default"
          style={{

            border: "1px solid rgba(255,255,255,0.1)",
            color: "var(--ink)",
            boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.5), 0 2px 5px rgba(0,0,0,0.2)"

          }}
        >
          {k}
        </kbd>
      ))}
    </span>
  );
}

function GameOver() {
  const { snapshot, lobby } = useGameStore();
  if (!snapshot || !lobby) return null;
  const winner = snapshot.winnerId
    ? lobby.players.find((p) => p.id === snapshot.winnerId)?.name
    : null;
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center p-6"
      style={{
        background: "rgba(5, 5, 10, 0.82)",
        backdropFilter: "blur(12px)",
      }}
    >
      <div className="glass rounded-sm p-10 max-w-md w-full text-center space-y-6 grain relative">
        <div
          className="eyebrow"
          style={{ color: "var(--gold)" }}
        >
          Fin de la partida
        </div>
        <h2
          className="font-display text-5xl"
          style={{ color: "var(--gold-soft)" }}
        >
          Game Over
        </h2>
        <div className="hairline" />
        {winner ? (
          <p className="font-display text-xl italic">
            Vencedor:{" "}
            <span style={{ color: "var(--gold-soft)" }}>{winner}</span>
          </p>
        ) : (
          <p
            className="font-display text-xl italic"
            style={{ color: "#c47676" }}
          >
            Los fantasmas se han impuesto
          </p>
        )}
        <div className="text-left space-y-3">
          <h3 className="eyebrow">Puntuaciones finales</h3>
          <ul className="space-y-1">
            {[...snapshot.players]
              .sort((a, b) => b.score - a.score)
              .map((p, i) => (
                <li
                  key={p.id}
                  className="flex justify-between items-baseline py-1.5"
                  style={{
                    borderBottom: "1px solid rgba(212,175,106,0.08)",
                  }}
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="font-mono text-[10px]"
                      style={{ color: "var(--ink-dim)" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>{p.name}</span>
                  </span>
                  <span className="font-mono tabular-nums">
                    {p.score.toLocaleString()}
                  </span>
                </li>
              ))}
          </ul>
        </div>
        <a
          href="/"
          className="inline-block px-10 py-3 rounded-sm mt-2"
          style={{
            background: "linear-gradient(180deg, #e8c989, #c9a466)",
            color: "#1a1420",
            letterSpacing: "0.25em",
            fontSize: "11px",
            fontWeight: 600,
            textTransform: "uppercase",
          }}
        >
          Volver al lobby
        </a>
      </div>
    </div>
  );
}
