"use client";
import { useState } from "react";
import { canFormTeams, goalkeepers, lineArrivals, matchDuration, teamOf, waitingList } from "@/lib/engine";
import { Stars } from "@/components/Stars";
import { btn, card, input } from "@/lib/ui/styles";
import {
  addGuestAction,
  checkInAction,
  formTeamsAction,
  leftAction,
  returnedAction,
  undoCheckInAction,
} from "./actions";
import { useDay } from "./DayScreen";
import { TeamBadge } from "./TeamCard";

export function CheckInTab({ onFormed }: { onFormed: () => void }) {
  const { view, run, pending } = useDay();
  const { state, dayId, version } = view;
  const closed = view.status === "closed";
  const [q, setQ] = useState("");
  const [guestOpen, setGuestOpen] = useState(false);

  const line = lineArrivals(state);
  const gks = goalkeepers(state);
  const n = state.config.n;
  const orderOf = new Map(state.arrivals.map((a) => [a.playerId, a.order]));
  const waiting = new Set(waitingList(state));
  const filter = (name: string) => name.toLocaleLowerCase("pt-BR").includes(q.toLocaleLowerCase("pt-BR"));

  const left = new Set(state.left);
  const gone = view.players.filter((p) => left.has(p.id) && filter(p.name));
  const arrived = view.players
    .filter((p) => orderOf.has(p.id) && !left.has(p.id) && filter(p.name))
    .sort((a, b) => orderOf.get(b.id)! - orderOf.get(a.id)!); // mais recente primeiro
  const notArrived = view.players.filter((p) => !orderOf.has(p.id) && filter(p.name));

  return (
    <div className="space-y-4">
      <section className={`${card} p-4`}>
        <div className="grid grid-cols-3 text-center">
          <Stat value={line.length} label="na linha" />
          <Stat value={gks.length} label="goleiros" />
          <Stat value={`${matchDuration(state)}'`} label="por partida" />
        </div>
        {!state.field && (
          <div className="mt-4">
            {canFormTeams(state) ? (
              <button
                type="button"
                className={`${btn.primary} w-full h-14 text-lg`}
                disabled={pending || closed}
                onClick={() => run(() => formTeamsAction(dayId, version), onFormed)}
              >
                🎲 Gerar times A × B
              </button>
            ) : (
              <p className="text-center text-sm text-muted">
                Faltam <b className="text-ink">{2 * n - line.length}</b> jogadores de linha para sortear A × B ({2 * n}{" "}
                primeiros a chegar, N = {n}).
              </p>
            )}
          </div>
        )}
      </section>

      <div className="flex gap-2">
        <input
          className={input}
          placeholder="Buscar jogador…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="search"
        />
        <button type="button" className={btn.ghost} onClick={() => setGuestOpen((v) => !v)} disabled={closed}>
          + Avulso
        </button>
      </div>

      {guestOpen && <GuestForm onDone={() => setGuestOpen(false)} />}

      {notArrived.length > 0 && (
        <section>
          <h2 className="text-sm text-muted mb-2">Toque para registrar a chegada</h2>
          <ul className="grid grid-cols-2 gap-2">
            {notArrived.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={pending || closed}
                  onClick={() => run(() => checkInAction(dayId, version, p.id))}
                  className="w-full h-12 rounded-xl bg-surface border border-line px-3 text-left truncate active:bg-surface-2 disabled:opacity-50"
                >
                  {p.isGoalkeeper && "🧤 "}
                  {p.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {arrived.length > 0 && (
        <section>
          <h2 className="text-sm text-muted mb-2">Chegaram (ordem de chegada)</h2>
          <ul className="space-y-1.5">
            {arrived.map((p) => {
              const team = teamOf(state, p.id);
              const played = state.played.includes(p.id);
              return (
                <li key={p.id} className={`${card} flex items-center gap-3 px-3 h-12`}>
                  <span className="tabular w-8 text-center font-bold text-accent">#{orderOf.get(p.id)}</span>
                  <span className="flex-1 truncate">
                    {p.isGoalkeeper && "🧤 "}
                    {p.name}
                  </span>
                  {team && <TeamBadge label={team} className="size-7 text-sm" />}
                  {waiting.has(p.id) && <span className="text-xs text-team-c">espera</span>}
                  {!closed && (
                    <button
                      type="button"
                      className="text-xs rounded-md border border-line px-2 h-7 text-muted"
                      disabled={pending}
                      aria-label={`${p.name} foi embora`}
                      onClick={() => {
                        if (confirm(`${p.name} foi embora? Ele sai do time e deixa de contar como presente.`)) {
                          run(() => leftAction(dayId, version, p.id));
                        }
                      }}
                    >
                      Saiu
                    </button>
                  )}
                  {!played && !closed && (
                    <button
                      type="button"
                      className="text-muted text-sm px-2"
                      disabled={pending}
                      aria-label={`Desfazer check-in de ${p.name}`}
                      onClick={() => {
                        if (confirm(`Desfazer o check-in de ${p.name}? (use se foi registrado por engano)`)) {
                          run(() => undoCheckInAction(dayId, version, p.id));
                        }
                      }}
                    >
                      ↺
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {gone.length > 0 && (
        <section>
          <h2 className="text-sm text-muted mb-2">Foram embora</h2>
          <ul className="space-y-1.5">
            {gone.map((p) => (
              <li key={p.id} className={`${card} flex items-center gap-3 px-3 h-12 opacity-70`}>
                <span className="flex-1 truncate line-through decoration-muted">
                  {p.isGoalkeeper && "🧤 "}
                  {p.name}
                </span>
                {!closed && (
                  <button
                    type="button"
                    className="text-xs rounded-md border border-line px-2 h-7"
                    disabled={pending}
                    onClick={() => run(() => returnedAction(dayId, version, p.id))}
                  >
                    Voltou
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted mt-1">Quem volta entra como nova chegada, no fim da ordem.</p>
        </section>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div>
      <div className="text-2xl font-bold tabular">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}

function GuestForm({ onDone }: { onDone: () => void }) {
  const { view, run, pending } = useDay();
  const [name, setName] = useState("");
  const [rating, setRating] = useState(3);
  const [gk, setGk] = useState(false);
  return (
    <form
      className={`${card} p-3 space-y-3`}
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addGuestAction(view.dayId, view.version, name, rating, gk), onDone);
      }}
    >
      <input
        className={input}
        placeholder="Nome do avulso (fica salvo no grupo)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoFocus
      />
      <div className="flex items-center justify-between">
        <Stars value={rating} onChange={setRating} size="text-2xl" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={gk} onChange={(e) => setGk(e.target.checked)} className="size-5" />
          Goleiro
        </label>
      </div>
      <button type="submit" className={`${btn.primary} w-full`} disabled={pending}>
        Adicionar e fazer check-in
      </button>
    </form>
  );
}
