"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { type DayState, type Team, getTeam, goalkeepers, waitingList } from "@/lib/engine";
import { APP_NAME } from "@/lib/app-config";
import { card } from "@/lib/ui/styles";
import { TEAM_STYLE } from "@/app/dia/[dayId]/view";

const REFRESH_MS = 5000;

interface LiveMatch {
  seq: number;
  durationMin: number;
  status: "pending" | "running" | "paused" | "finished";
  startedAt: string | null;
  elapsedMs: number;
}

function fmt(ms: number) {
  const total = Math.floor(Math.abs(ms) / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${ms < 0 ? "+" : ""}${m}:${s}`;
}

export function LiveView({
  groupName,
  date,
  status,
  state,
  names,
  openMatch,
  serverNow,
}: {
  groupName: string;
  date: string;
  status: "open" | "closed";
  state: DayState;
  names: Record<string, string>;
  openMatch: LiveMatch | null;
  serverNow: number;
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [skew, setSkew] = useState(() => serverNow - Date.now());
  const name = (id: string) => names[id] ?? "?";

  // Re-fetch from the server every few seconds (only while the page is visible).
  useEffect(() => {
    if (status !== "open") return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [router, status]);
  useEffect(() => setSkew(serverNow - Date.now()), [serverNow]);

  const running = openMatch?.status === "running";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [running]);

  const remaining = openMatch
    ? openMatch.durationMin * 60_000 -
      (openMatch.elapsedMs +
        (running && openMatch.startedAt ? now + skew - new Date(openMatch.startedAt).getTime() : 0))
    : 0;

  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  const finished = state.matches.filter((m) => m.result);
  const lastFinished = finished[finished.length - 1];
  const recentDraws = state.draws.filter(
    (d) => !d.undone && d.kind === "completion" && lastFinished && d.matchSeq === lastFinished.seq,
  );
  const drawnIn = recentDraws.flatMap((d) => [...d.picked, ...d.fromWaiting]);
  const waiting = waitingList(state);
  const gks = goalkeepers(state);
  const present = state.arrivals.filter((a) => !state.left.includes(a.playerId));

  return (
    <main className="mx-auto max-w-2xl px-4 py-5 pb-16 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="text-xs text-muted">⚽ {APP_NAME} · ao vivo</div>
          <h1 className="text-xl font-bold">{groupName}</h1>
          <div className="text-sm text-muted capitalize">{dateLabel}</div>
        </div>
        {status === "open" ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-accent">
            <span className="size-2 rounded-full bg-accent animate-pulse" /> ao vivo
          </span>
        ) : (
          <span className="text-xs text-muted">encerrado</span>
        )}
      </header>

      {!state.field ? (
        <section className={`${card} p-5 text-center space-y-2`}>
          <p className="text-muted">Os times ainda não foram sorteados.</p>
          <p className="text-3xl font-bold tabular">{present.length}</p>
          <p className="text-sm text-muted">presentes até agora</p>
          {present.length > 0 && (
            <p className="text-sm pt-2">
              {[...present]
                .sort((a, b) => a.order - b.order)
                .map((a) => `${a.order}. ${name(a.playerId)}`)
                .join(" · ")}
            </p>
          )}
        </section>
      ) : (
        <>
          <section className={`${card} p-4 text-center`}>
            <div className="flex items-center justify-center gap-3">
              <Badge label={state.field[0]} />
              <span className="text-muted text-xl">×</span>
              <Badge label={state.field[1]} />
            </div>
            {openMatch && (
              <>
                <div
                  className={`tabular font-bold leading-none mt-3 text-[clamp(3.5rem,18vw,6rem)] ${
                    remaining <= 0 ? "text-danger" : ""
                  }`}
                >
                  {fmt(remaining)}
                </div>
                <div className="text-sm text-muted mt-1">
                  Partida {openMatch.seq}
                  {openMatch.status === "pending" && " · aguardando início"}
                  {openMatch.status === "paused" && " · pausada"}
                  {remaining <= 0 && openMatch.status !== "pending" && " · tempo esgotado"}
                </div>
              </>
            )}
          </section>

          {recentDraws.length > 0 && (
            <section className="rounded-2xl border border-accent/40 bg-accent/5 p-3 text-sm space-y-1">
              <p>
                <b>Partida {recentDraws[0].matchSeq}:</b> saiu o {recentDraws[0].from}.
              </p>
              {recentDraws.map((d) => (
                <p key={d.id}>
                  {d.fromWaiting.length > 0 && <>Da espera para o {d.to}: {d.fromWaiting.map(name).join(", ")}. </>}
                  {d.picked.length > 0 && (
                    <>
                      Sorteados do {d.from} para o {d.to}: <b>{d.picked.map(name).join(", ")}</b>.
                    </>
                  )}
                </p>
              ))}
            </section>
          )}

          <Section title="Em campo">
            <div className="grid sm:grid-cols-2 gap-2">
              {state.field.map((l) => (
                <LiveTeam key={l} team={getTeam(state, l)} n={state.config.n} name={name} highlight={drawnIn} />
              ))}
            </div>
          </Section>

          {state.queue.length > 0 && (
            <Section title="Fila (próximo primeiro)">
              {state.queue.map((l, i) => (
                <LiveTeam
                  key={l}
                  team={getTeam(state, l)}
                  n={state.config.n}
                  name={name}
                  caption={i === 0 ? "Joga a seguir" : `${i + 1}º na fila`}
                />
              ))}
            </Section>
          )}

          {waiting.length > 0 && (
            <section className={`${card} p-3 text-sm`}>
              <b className="text-team-c">Espera:</b> {waiting.map(name).join(", ")}
            </section>
          )}
        </>
      )}

      {gks.length > 0 && (
        <section className={`${card} p-3 text-sm`}>
          <b className="text-muted">🧤 Goleiros:</b> {gks.map((g) => name(g.playerId)).join(", ")}
        </section>
      )}

      {finished.length > 0 && (
        <Section title="Resultados">
          <ul className={`${card} divide-y divide-line`}>
            {[...finished].reverse().map((m) => (
              <li key={m.seq} className="flex items-center gap-2 px-3 h-11 text-sm">
                <span className="text-muted w-8">P{m.seq}</span>
                <span className="flex-1">
                  {m.home} × {m.away}
                  {m.result?.scoreHome != null && m.result?.scoreAway != null && (
                    <span className="text-muted">
                      {" "}
                      · {m.result.scoreHome}–{m.result.scoreAway}
                    </span>
                  )}
                </span>
                <span>
                  Venceu <b>{m.result!.winner}</b>
                  {m.result!.penalties && <span className="text-muted"> (pên.)</span>}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <p className="text-center text-xs text-muted pt-4">Atualiza sozinho a cada {REFRESH_MS / 1000} segundos.</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Badge({ label }: { label: string }) {
  const s = TEAM_STYLE[label as keyof typeof TEAM_STYLE];
  return (
    <span
      className={`inline-flex items-center justify-center size-12 text-2xl rounded-lg font-bold border ${s.text} ${s.bg} ${s.border}`}
    >
      {label}
    </span>
  );
}

function LiveTeam({
  team,
  n,
  name,
  caption,
  highlight = [],
}: {
  team: Team;
  n: number;
  name: (id: string) => string;
  caption?: string;
  highlight?: string[];
}) {
  const s = TEAM_STYLE[team.label];
  const missing = n - team.members.length;
  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-3`}>
      <div className="flex items-baseline justify-between mb-2">
        <span className={`font-semibold ${s.text}`}>Time {team.label}</span>
        <span className="text-xs text-muted">
          {caption ? `${caption} · ` : ""}
          {team.members.length}/{n}
        </span>
      </div>
      {missing > 0 && <div className="text-xs text-team-c mb-1">Incompleto: faltam {missing}</div>}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
        {team.members.map((id) => (
          <li key={id} className={`truncate ${highlight.includes(id) ? "text-accent font-semibold" : ""}`}>
            {highlight.includes(id) && "↪ "}
            {name(id)}
          </li>
        ))}
      </ul>
    </div>
  );
}
