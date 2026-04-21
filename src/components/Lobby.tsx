"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSocket } from "@/lib/socket-client";
import { useGameStore } from "@/lib/store";

export default function Lobby() {
  const router = useRouter();
  const { playerName, setPlayerName, setAssigned, setLobby } = useGameStore();
  const [mode, setMode] = useState<"coop" | "versus">("coop");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [servers, setServers] = useState<
    Array<{ name: string; addresses: string[]; port: number }>
  >([]);

  useEffect(() => {
    const s = getSocket();
    const onAssigned = (p: {
      playerId: string;
      role: string;
      roomId: string;
    }) => {
      setAssigned(p);
    };
    const onLobby = (l: unknown) => setLobby(l as never);
    s.on("assigned", onAssigned);
    s.on("lobby", onLobby);
    return () => {
      s.off("assigned", onAssigned);
      s.off("lobby", onLobby);
    };
  }, [setAssigned, setLobby]);

  useEffect(() => {
    fetch("/api/servers")
      .then((r) => r.json())
      .then((d) => setServers(d.servers ?? []))
      .catch(() => {});
  }, []);

  function createRoom() {
    if (!playerName.trim()) {
      setError("Introduce un nombre");
      return;
    }
    setBusy(true);
    setError(null);
    getSocket().emit(
      "create_room",
      { playerName: playerName.trim(), mode },
      (res: { ok: boolean; roomId?: string; error?: string }) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error ?? "Error");
          return;
        }
        router.push(`/game/${res.roomId}`);
      }
    );
  }

  function joinRoom() {
    if (!playerName.trim()) {
      setError("Introduce un nombre");
      return;
    }
    if (!joinCode.trim()) {
      setError("Código de sala requerido");
      return;
    }
    setBusy(true);
    setError(null);
    getSocket().emit(
      "join_room",
      {
        playerName: playerName.trim(),
        roomId: joinCode.trim().toUpperCase(),
        mode,
      },
      (res: { ok: boolean; roomId?: string; error?: string }) => {
        setBusy(false);
        if (!res.ok) {
          setError(res.error ?? "Error");
          return;
        }
        router.push(`/game/${res.roomId}`);
      }
    );
  }

  return (
    <main className="min-h-screen page-aura grain relative flex items-center justify-center p-6">
      <div className="w-full max-w-lg glass rounded-xl p-10 space-y-8 relative">
        {/* Wordmark */}
        <header className="text-center space-y-1.5">
          <div
            className="font-display text-4xl leading-none"
            style={{
              color: "var(--gold)",
              textShadow: "0 0 20px rgba(255, 215, 0, 0.4), 0 0 40px rgba(255, 215, 0, 0.2)",
            }}
          >
            Pac·Man
          </div>
          <div
            className="text-[9px] uppercase mt-2"
            style={{ color: "var(--ink-dim)" }}
          >
            Neon Labyrinth
          </div>
          <div className="flex items-center justify-center gap-3 pt-4">
            <span className="hairline w-12" />
            <span
              className="text-[9px] tracking-[0.3em] uppercase"
              style={{ color: "rgba(255, 255, 255, 0.4)" }}
            >
              Multijugador Local
            </span>
            <span className="hairline w-12" />
          </div>
        </header>

        {/* Name */}
        <Field label="Tu nombre">
          <input
            className="w-full bg-transparent px-2 py-3 outline-none font-display text-sm transition-all duration-300"
            style={{
              color: "var(--ink)",
              borderBottom: "2px solid rgba(255, 215, 0, 0.2)",
              textShadow: "0 0 10px rgba(255, 255, 255, 0.1)",
            }}
            onFocus={(e) => {
              e.target.style.borderBottom = "2px solid var(--gold)";
              e.target.style.background = "rgba(255,215,0,0.03)";
            }}
            onBlur={(e) => {
              e.target.style.borderBottom = "2px solid rgba(255, 215, 0, 0.2)";
              e.target.style.background = "transparent";
            }}
            value={playerName}
            maxLength={20}
            onChange={(e) => setPlayerName(e.target.value)}
            placeholder="Jugador 1"
          />
        </Field>

        {/* Mode selector */}
        <Field label="Modalidad">
          <div className="grid grid-cols-2 gap-4">
            <ModeCard
              active={mode === "coop"}
              title="Competitivo"
              subtitle="Varios Pac-Men"
              onClick={() => setMode("coop")}
            />
            <ModeCard
              active={mode === "versus"}
              title="Asimétrico"
              subtitle="Pac vs Fantasmas"
              onClick={() => setMode("versus")}
            />
          </div>
        </Field>

        <div className="hairline" />

        {/* Actions */}
        <div className="space-y-4">
          <button
            disabled={busy}
            onClick={createRoom}
            className="w-full py-4 rounded-lg disabled:opacity-40 transition-all duration-300 transform hover:-translate-y-1"
            style={{
              background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
              color: "#030014",
              fontSize: "10px",
              textTransform: "uppercase",
              boxShadow:
                "0 10px 25px -5px rgba(255, 215, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.4)",
            }}
          >
            Crear partida
          </button>

          <div className="flex items-center gap-3">
            <span className="flex-1 hairline" style={{ height: 1 }} />
            <span
              className="text-[8px] uppercase"
              style={{ color: "var(--ink-dim)" }}
            >
              o unirse
            </span>
            <span className="flex-1 hairline" style={{ height: 1 }} />
          </div>

          <div className="flex gap-3">
            <input
              className="flex-1 bg-transparent px-4 py-3 outline-none font-mono uppercase text-center text-sm transition-all"
              style={{
                color: "var(--gold)",
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255, 215, 0, 0.2)",
                borderRadius: "8px",
              }}
              onFocus={(e) => {
                e.target.style.border = "1px solid var(--gold)";
                e.target.style.boxShadow = "0 0 15px rgba(255, 215, 0, 0.2)";
              }}
              onBlur={(e) => {
                e.target.style.border = "1px solid rgba(255, 215, 0, 0.2)";
                e.target.style.boxShadow = "none";
              }}
              placeholder="CÓDIGO"
              value={joinCode}
              maxLength={4}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            />
            <button
              disabled={busy}
              onClick={joinRoom}
              className="px-8 py-3 rounded-lg disabled:opacity-40 transition-all duration-300 hover:-translate-y-1"
              style={{
                background: "rgba(255,255,255,0.05)",
                color: "var(--ink)",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                fontSize: "10px",
                textTransform: "uppercase",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "var(--gold-soft)";
                e.currentTarget.style.boxShadow = "0 0 20px rgba(255, 215, 0, 0.15)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              Entrar
            </button>
          </div>
        </div>

        {error && (
          <p
            className="text-[10px] text-center font-display mt-2"
            style={{ color: "var(--neon-blinky)", textShadow: "0 0 10px rgba(255,0,60,0.5)" }}
          >
            {error}
          </p>
        )}

        {servers.length > 0 && (
          <>
            <div className="hairline" />
            <div className="space-y-3">
              <div className="flex items-baseline justify-between">
                <span className="eyebrow">Servidores en tu red</span>
                <span
                  className="text-[10px] font-mono"
                  style={{ color: "var(--ink-dim)" }}
                >
                  {servers.length}
                </span>
              </div>
              <ul className="space-y-1">
                {servers.map((s, i) => (
                  <li
                    key={i}
                    className="flex justify-between items-center py-3 px-4 text-sm glass-hover rounded-md cursor-pointer"
                  >
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{s.name}</span>
                    <span
                      className="font-mono text-[11px]"
                      style={{ color: "var(--gold-soft)" }}
                    >
                      {s.addresses[0]}:{s.port}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        <div
          className="text-center text-[11px] tracking-[0.25em] uppercase pt-4"
          style={{ color: "rgba(255,255,255,0.2)" }}
        >
          ← ↑ ↓ → · WASD
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <label className="eyebrow block text-shadow-sm">{label}</label>
      {children}
    </div>
  );
}

function ModeCard({
  active,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left p-5 rounded-xl transition-all duration-300 transform ${active ? "scale-105" : "hover:scale-[1.02]"}`}
      style={{
        border: active
          ? "1px solid var(--gold)"
          : "1px solid rgba(255,255,255,0.08)",
        background: active
          ? "linear-gradient(135deg, rgba(255,215,0,0.15) 0%, rgba(255,215,0,0.02) 100%)"
          : "rgba(255,255,255,0.02)",
        boxShadow: active
          ? "inset 0 1px 0 rgba(255,255,255,0.1), 0 10px 20px -5px rgba(255,215,0,0.2)"
          : "none",
      }}
    >
      <div
        className="font-display text-[10px] mb-2"
        style={{
          color: active ? "var(--gold)" : "var(--ink)",
          textShadow: active ? "0 0 15px rgba(255,215,0,0.3)" : "none",
        }}
      >
        {title}
      </div>
      <div
        className="text-[8px] uppercase"
        style={{ color: active ? "var(--ink)" : "var(--ink-dim)" }}
      >
        {subtitle}
      </div>
    </button>
  );
}
