"use client";
import { useState } from "react";
import { getTeam, goalkeepers, waitingList } from "@/lib/engine";
import { btn, card } from "@/lib/ui/styles";
import { useDay } from "./DayScreen";
import { ResultDialog } from "./ResultDialog";
import { TeamBadge, TeamCard } from "./TeamCard";
import { Timer } from "./Timer";

export function GameTab({ goCheckIn }: { goCheckIn: () => void }) {
  const { view, name } = useDay();
  const { state } = view;
  const [finishing, setFinishing] = useState(false);
  const closed = view.status === "closed";

  if (!state.field) {
    return (
      <div className={`${card} p-6 text-center space-y-3`}>
        <p className="text-muted">Os times ainda não foram formados.</p>
        <button type="button" className={btn.primary} onClick={goCheckIn}>
          Ir para o check-in
        </button>
      </div>
    );
  }

  const [homeL, awayL] = state.field;
  const home = getTeam(state, homeL);
  const away = getTeam(state, awayL);
  const finished = state.matches.filter((m) => m.result);
  const lastFinished = finished[finished.length - 1];
  const recentDraws = state.draws.filter(
    (d) => !d.undone && d.kind === "completion" && lastFinished && d.matchSeq === lastFinished.seq,
  );
  const drawnIn = recentDraws.flatMap((d) => [...d.picked, ...d.fromWaiting]);

  // Who leaves when the current match ends.
  const tired = [home, away].filter((t) => t.streak + 1 >= 2);
  const leaving =
    state.queue.length === 0
      ? "Sem rodízio: só 2 times."
      : tired.length === 1
        ? `Ao final sai o time ${tired[0].label} (2 jogos seguidos), independente do resultado.`
        : "Ao final sai o perdedor (empate: pênaltis).";

  const next = state.queue[0] ? getTeam(state, state.queue[0]) : null;
  const rest = state.queue.slice(1).map((l) => getTeam(state, l));
  const waiting = waitingList(state);
  const gks = goalkeepers(state);

  return (
    <div className="space-y-4">
      <section className={`${card} p-4`}>
        <div className="flex items-center justify-center gap-3 mb-4">
          <TeamBadge label={homeL} className="size-12 text-2xl" />
          <span className="text-muted text-xl">×</span>
          <TeamBadge label={awayL} className="size-12 text-2xl" />
        </div>
        {view.openMatch && (
          <Timer
            dayId={view.dayId}
            match={view.openMatch}
            serverNow={view.serverNow}
            disabled={closed}
            onFinish={() => setFinishing(true)}
          />
        )}
        <p className="text-xs text-muted text-center mt-3">{leaving}</p>
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

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted">Em campo</h2>
        <div className="grid sm:grid-cols-2 gap-2">
          <TeamCard team={home} caption={`${home.streak} jogo(s) seguido(s)`} highlight={drawnIn} />
          <TeamCard team={away} caption={`${away.streak} jogo(s) seguido(s)`} highlight={drawnIn} />
        </div>
      </section>

      {next && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Joga a seguir</h2>
          <TeamCard
            team={next}
            caption={
              next.members.length < view.config.n
                ? "Será completado com atrasados e sorteio do time que sair"
                : "Entra no lugar de quem sair"
            }
          />
        </section>
      )}

      {rest.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Fila</h2>
          {rest.map((t, i) => (
            <TeamCard key={t.label} team={t} compact caption={`${i + 2}º na fila`} />
          ))}
        </section>
      )}

      {waiting.length > 0 && (
        <section className={`${card} p-3`}>
          <h2 className="text-sm font-semibold text-team-c mb-1">Lista de espera ({waiting.length})</h2>
          <p className="text-sm">{waiting.map(name).join(", ")}</p>
          <p className="text-xs text-muted mt-1">Entram primeiro quando um time incompleto for completado.</p>
        </section>
      )}

      {gks.length > 0 && (
        <section className={`${card} p-3`}>
          <h2 className="text-sm font-semibold text-muted mb-1">🧤 Goleiros</h2>
          <p className="text-sm">{gks.map((g) => name(g.playerId)).join(", ")}</p>
        </section>
      )}

      {finished.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-muted">Partidas</h2>
          <ul className={`${card} divide-y divide-line`}>
            {[...finished].reverse().map((m) => (
              <li key={m.seq} className="flex items-center gap-2 px-3 h-11 text-sm">
                <span className="text-muted w-8">P{m.seq}</span>
                <span className="flex-1">
                  {m.home} × {m.away}
                  {m.result?.scoreHome != null && m.result?.scoreAway != null && (
                    <span className="text-muted"> · {m.result.scoreHome}–{m.result.scoreAway}</span>
                  )}
                </span>
                <span>
                  Venceu <b>{m.result!.winner}</b>
                  {m.result!.penalties && <span className="text-muted"> (pên.)</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {finishing && view.openMatch && (
        <ResultDialog home={homeL} away={awayL} seq={view.openMatch.seq} onClose={() => setFinishing(false)} />
      )}
    </div>
  );
}
