"use client";
import { useGameStore } from "@/lib/store";
import { getSocket } from "@/lib/socket-client";

const ROLE_LABEL: Record<string, string> = {
  pacman: "PAC-MAN",
  blinky: "BLINKY",
  pinky: "PINKY",
  inky: "INKY",
  clyde: "CLYDE",
};
const ROLE_DOT: Record<string, string> = {
  pacman: "var(--neon-pacman)",
  blinky: "var(--neon-blinky)",
  pinky: "var(--neon-pinky)",
  inky: "var(--neon-inky)",
  clyde: "var(--neon-clyde)",
};

function PacmanIcon({ color }: { color: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={color} xmlns="http://www.w3.org/2000/svg" style={{ filter: `drop-shadow(0 0 5px ${color})` }}>
      <path d="M12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C6.47715 22 2 17.5228 2 12C2 6.47715 6.47715 2 12 2ZM12 12L22 7C22 7 22 17 22 17L12 12Z" />
      <circle cx="12" cy="6" r="2" fill="#000" />
    </svg>
  );
}

export default function Scoreboard() {
  const { lobby, snapshot, playerId } = useGameStore();
  if (!lobby) return null;
  const scores = new Map<string, number>();
  snapshot?.players.forEach((p) => scores.set(p.id, p.score));

  const totalPellets = lobby.maze.tiles.filter(
    (t) => t === 2 || t === 3
  ).length;
  const remaining = snapshot?.pelletsRemaining ?? totalPellets;
  const collected = totalPellets - remaining;
  const progress =
    totalPellets > 0 ? (collected / totalPellets) * 100 : 0;

  const sorted = [...lobby.players].sort(
    (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0)
  );

  const isCreator = lobby?.players[0]?.id === playerId;
  const isLobby = lobby?.status === "lobby";
  const hasEnoughPlayers = lobby.players.length >= 2;

  return (
    <aside className="w-[380px] shrink-0 glass rounded-xl p-8 flex flex-col gap-8 relative overflow-hidden h-[600px]">
      
      {/* Top Header */}
      <header className="text-center">
        <div className="font-display text-2xl tracking-[0.1em] font-bold" style={{ color: "var(--gold)", textShadow: "0 0 10px rgba(255, 215, 0, 0.4)" }}>
          PAC-MAN
        </div>
        <div className="flex items-center justify-center gap-2 text-[8px] tracking-[0.4em] uppercase mt-1 font-bold" style={{ color: "rgba(0, 255, 255, 0.8)" }}>
          <span>••</span>
          <span className="text-white opacity-80">NEON ARCADE</span>
          <span>••</span>
        </div>
      </header>

      <div className="hairline" />

      {/* Room ID and Score */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold)] shadow-[0_0_8px_var(--gold)]"></span>
            <span className="eyebrow">SALA</span>
          </div>
          {snapshot?.level && (
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-inky)] shadow-[0_0_8px_var(--neon-inky)]"></span>
              <span className="eyebrow" style={{ color: "var(--neon-inky)" }}>NIVEL {snapshot.level}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-end justify-between">
          <div className="font-display text-5xl tracking-[0.08em] leading-none" style={{ color: "var(--gold)", textShadow: "0 0 15px rgba(255, 215, 0, 0.4)" }}>
            {lobby.roomId}
          </div>
          <div className="flex items-center gap-1.5 text-[14px] font-mono font-bold" style={{ color: "var(--gold)" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9C5 11.38 6.19 13.47 8 14.74V17C8 17.55 8.45 18 9 18H15C15.55 18 16 17.55 16 17V14.74C17.81 13.47 19 11.38 19 9C19 5.13 15.87 2 12 2ZM14 20C14 20.55 13.55 21 13 21H11C10.45 21 10 20.55 10 20V19H14V20Z"/></svg>
            +{collected}
          </div>
        </div>
      </section>

      {/* Progress Bar */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">PUNTAJE</span>
          <span className="font-mono text-[11px] font-bold" style={{ color: "var(--ink-dim)" }}>
            {collected} / {totalPellets}
          </span>
        </div>
        <div
          className="relative h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.05)" }}
        >
          <div
            className="absolute top-0 left-0 h-full transition-all duration-300 ease-out"
            style={{
              width: `${progress}%`,
              background: "linear-gradient(90deg, #00FFFF, #FF00FF)",
              boxShadow: "0 0 10px rgba(0, 255, 255, 0.8)",
            }}
          />
          {/* Glowing tip */}
          <div 
            className="absolute top-0 h-full w-4"
            style={{
              left: `calc(${progress}% - 4px)`,
              background: "white",
              boxShadow: "0 0 15px 5px rgba(255, 255, 255, 0.8)"
            }}
          />
        </div>
      </section>

      <div className="hairline" />

      {/* Players List */}
      <section className="space-y-4 flex-1 min-h-0 flex flex-col">
        <div className="flex items-baseline justify-between shrink-0">
          <span className="eyebrow">JUGADORES</span>
          <span className="font-mono text-[12px] font-bold" style={{ color: "var(--ink)" }}>
            {lobby.players.length}
          </span>
        </div>
        <ul className="space-y-3 overflow-y-auto pr-2 flex-1 scrollbar-thin scrollbar-thumb-[rgba(255,255,255,0.1)] scrollbar-track-transparent">
          {sorted.map((p, i) => {
            const playerScore = scores.get(p.id) ?? 0;
            const isMe = p.id === playerId;
            const roleColor = ROLE_DOT[p.role] ?? "var(--gold)";
            
            return (
              <li
                key={p.id}
                className="group flex items-center justify-between py-3 px-4 rounded-lg"
                style={{
                  border: isMe ? "1px solid rgba(0, 255, 255, 0.5)" : "1px solid transparent",
                  boxShadow: isMe ? "inset 0 0 15px rgba(0, 255, 255, 0.1), 0 0 15px rgba(0, 255, 255, 0.2)" : "none",
                  background: isMe ? "rgba(0, 255, 255, 0.05)" : "transparent"
                }}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <span className="font-mono text-[10px] w-5 font-bold" style={{ color: "var(--ink-dim)" }}>
                    #{String(i + 1).padStart(2, "0")}
                  </span>
                  
                  <PacmanIcon color={roleColor} />
                  
                  <div className="min-w-0 flex flex-col">
                    <span className="truncate text-sm font-bold flex items-center gap-2" style={{ color: "var(--gold)" }}>
                      {p.name}
                      {isMe && <span className="text-[14px]">•••</span>}
                    </span>
                    <span className="text-[9px] tracking-widest uppercase font-bold" style={{ color: "var(--ink-dim)" }}>
                      {ROLE_LABEL[p.role] ?? p.role}
                    </span>
                  </div>
                </div>
                <span className="font-mono text-sm tabular-nums font-bold" style={{ color: "var(--neon-inky)" }}>
                  {playerScore.toLocaleString()}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Footer / Start Button */}
      <div className="mt-auto flex justify-center pb-2 shrink-0">
        {isLobby && isCreator ? (
          <button
            disabled={!hasEnoughPlayers}
            onClick={() => getSocket().emit("start_game", {}, () => {})}
            className="group relative px-12 py-3 rounded-lg transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-1 w-full"
            style={{
              background: "rgba(0, 255, 255, 0.1)",
              border: "1px solid rgba(0, 255, 255, 0.6)",
              color: "white",
              letterSpacing: "0.15em",
              fontSize: "13px",
              fontWeight: 800,
              textTransform: "uppercase",
              boxShadow: "0 0 20px rgba(0, 255, 255, 0.4), inset 0 0 10px rgba(0, 255, 255, 0.2)",
            }}
          >
            <span className="relative z-10 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]">
              {hasEnoughPlayers ? "INICIAR PARTIDA" : "ESPERANDO..."}
            </span>
            {/* Bright bottom glow on hover */}
            <div className="absolute -bottom-2 left-1/4 right-1/4 h-2 bg-[var(--gold)] opacity-0 group-hover:opacity-100 blur-lg transition-opacity"></div>
          </button>
        ) : (snapshot?.status === "lobby" || (snapshot?.countdown ?? 0) > 0) ? (
          <p className="font-display italic text-sm text-center animate-pulse w-full py-3" style={{ color: "var(--gold)", textShadow: "0 0 10px rgba(255, 215, 0, 0.3)" }}>
            {snapshot?.countdown && snapshot.countdown > 0
              ? snapshot.status === "running"
                ? `INICIANDO NIVEL ${snapshot.level} EN ${Math.ceil(snapshot.countdown / 30)}…`
                : `Iniciando en ${Math.ceil(snapshot.countdown / 30)}…`
              : "ESPERANDO AL CREADOR..."}
          </p>
        ) : null}
      </div>

    </aside>
  );
}
