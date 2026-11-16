"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { btn } from "@/lib/ui/styles";
import { timerAction } from "./actions";
import type { OpenMatchView } from "./view";

type WakeLockSentinelLike = { release: () => Promise<void> };

let audioCtx: AudioContext | null = null;
/** Must be called from a user gesture so iOS/Android allow sound later. */
function unlockAudio() {
  if (typeof window === "undefined") return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  audioCtx ??= new AC();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

function whistle() {
  navigator.vibrate?.([600, 200, 600, 200, 1000]);
  if (!audioCtx) return;
  const t0 = audioCtx.currentTime;
  [0, 0.45, 0.9].forEach((offset, i) => {
    const osc = audioCtx!.createOscillator();
    const gain = audioCtx!.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(i === 2 ? 2100 : 1800, t0 + offset);
    gain.gain.setValueAtTime(0.0001, t0 + offset);
    gain.gain.exponentialRampToValueAtTime(0.3, t0 + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + (i === 2 ? 0.8 : 0.35));
    osc.connect(gain).connect(audioCtx!.destination);
    osc.start(t0 + offset);
    osc.stop(t0 + offset + 0.85);
  });
}

function fmt(ms: number) {
  const neg = ms < 0;
  const total = Math.floor(Math.abs(ms) / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${neg ? "+" : ""}${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Timer({
  dayId,
  match,
  serverNow,
  disabled,
  onFinish,
}: {
  dayId: string;
  match: OpenMatchView;
  serverNow: number;
  disabled?: boolean;
  onFinish: () => void;
}) {
  const [local, setLocal] = useState({
    status: match.status,
    startedAt: match.startedAt,
    elapsedMs: match.elapsedMs,
  });
  const [skew, setSkew] = useState(() => serverNow - Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const alerted = useRef<string | null>(null);
  const wake = useRef<WakeLockSentinelLike | null>(null);

  // Server data wins whenever the page is re-rendered.
  useEffect(() => {
    setLocal({ status: match.status, startedAt: match.startedAt, elapsedMs: match.elapsedMs });
  }, [match.id, match.status, match.startedAt, match.elapsedMs]);
  useEffect(() => setSkew(serverNow - Date.now()), [serverNow]);

  const running = local.status === "running";
  const elapsed =
    local.elapsedMs + (running && local.startedAt ? now + skew - new Date(local.startedAt).getTime() : 0);
  const remaining = match.durationMin * 60_000 - elapsed;
  const timeUp = remaining <= 0;

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [running]);

  // Alert once per match when time runs out while watching.
  const wasPositive = useRef(remaining > 0);
  useEffect(() => {
    if (running && timeUp && wasPositive.current && alerted.current !== match.id) {
      alerted.current = match.id;
      whistle();
    }
    wasPositive.current = remaining > 0;
  }, [running, timeUp, remaining, match.id]);

  // Keep the screen on while the clock runs.
  useEffect(() => {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> };
    };
    if (!running || !nav.wakeLock) return;
    let cancelled = false;
    const acquire = () =>
      nav.wakeLock!.request("screen").then((s) => {
        if (cancelled) void s.release();
        else wake.current = s;
      }).catch(() => {});
    void acquire();
    const onVis = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void wake.current?.release();
      wake.current = null;
    };
  }, [running]);

  const act = (action: "start" | "pause" | "reset") => {
    if (action === "start") unlockAudio();
    start(async () => {
      setErr(null);
      const r = await timerAction(dayId, match.id, action);
      if (!r.ok || !r.match) {
        setErr(r.error ?? "Erro no cronômetro");
        return;
      }
      setSkew(new Date(r.serverNow!).getTime() - Date.now());
      setNow(Date.now());
      setLocal({ status: r.match.status as OpenMatchView["status"], startedAt: r.match.started_at, elapsedMs: Number(r.match.elapsed_ms) });
    });
  };

  return (
    <div className="text-center">
      <div
        className={`tabular font-bold leading-none text-[clamp(4rem,22vw,7.5rem)] ${timeUp ? "time-up text-danger" : ""}`}
        aria-live="polite"
      >
        {fmt(remaining)}
      </div>
      <div className="text-sm text-muted mt-1">
        {timeUp ? "Tempo esgotado!" : `Partida ${match.seq} · ${match.durationMin} min`}
        {local.status === "paused" && !timeUp && " · pausado"}
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4">
        {running ? (
          <button type="button" className={btn.ghost} onClick={() => act("pause")} disabled={pending || disabled}>
            ❚❚ Pausar
          </button>
        ) : (
          <button type="button" className={btn.primary} onClick={() => act("start")} disabled={pending || disabled}>
            ▶ {local.status === "pending" ? "Iniciar" : "Retomar"}
          </button>
        )}
        <button
          type="button"
          className={timeUp ? btn.primary : btn.ghost}
          onClick={() => {
            unlockAudio();
            onFinish();
          }}
          disabled={pending || disabled}
        >
          ■ Encerrar
        </button>
      </div>
      {local.status === "paused" && (
        <button
          type="button"
          className="mt-2 text-xs text-muted underline"
          onClick={() => confirm("Zerar o cronômetro desta partida?") && act("reset")}
          disabled={pending || disabled}
        >
          Zerar cronômetro
        </button>
      )}
      {err && <p className="text-danger text-sm mt-2">{err}</p>}
    </div>
  );
}
