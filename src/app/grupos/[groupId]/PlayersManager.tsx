"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Stars } from "@/components/Stars";
import { SubmitButton } from "@/components/SubmitButton";
import { btn, card, input } from "@/lib/ui/styles";
import { createPlayer, deletePlayer, updatePlayer } from "../actions";

export interface PlayerItem {
  id: string;
  name: string;
  isGoalkeeper: boolean;
  active: boolean;
  rating: number;
}

export function PlayersManager({ groupId, players }: { groupId: string; players: PlayerItem[] }) {
  const [state, action] = useActionState(createPlayer.bind(null, groupId), undefined);
  const [rating, setRating] = useState(3);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      setRating(3);
      formRef.current?.querySelector<HTMLInputElement>("input[name=name]")?.focus();
    }
  }, [state]);

  const active = players.filter((p) => p.active);
  const line = active.filter((p) => !p.isGoalkeeper).length;

  return (
    <div className="space-y-4">
      <form ref={formRef} action={action} className={`${card} p-4 space-y-3`}>
        <h2 className="font-semibold">Adicionar jogador</h2>
        <input name="name" placeholder="Nome ou apelido" className={input} required maxLength={60} />
        <input type="hidden" name="rating" value={rating} />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted">Nota</span>
            <Stars value={rating} onChange={setRating} size="text-2xl" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="is_goalkeeper" className="size-5 accent-[var(--color-accent)]" />
            Goleiro
          </label>
        </div>
        {state?.error && <p className="text-danger text-sm">{state.error}</p>}
        <SubmitButton className={`${btn.primary} w-full`}>Adicionar</SubmitButton>
      </form>

      <p className="text-sm text-muted">
        {active.length} ativos ({line} de linha, {active.length - line} goleiros). A nota só é visível para
        você.
      </p>

      <ul className="space-y-2">
        {players.map((p) => (
          <PlayerRow key={p.id} groupId={groupId} player={p} />
        ))}
      </ul>
    </div>
  );
}

function PlayerRow({ groupId, player }: { groupId: string; player: PlayerItem }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = (patch: Parameters<typeof updatePlayer>[2]) =>
    start(async () => {
      const r = await updatePlayer(groupId, player.id, patch);
      setError(r?.error ?? null);
      if (!r?.error) setEditing(false);
    });

  return (
    <li className={`${card} p-3 ${player.active ? "" : "opacity-50"} ${pending ? "animate-pulse" : ""}`}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          {editing ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save({ name });
              }}
              className="flex gap-2"
            >
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} autoFocus />
              <button className={btn.small} type="submit">
                OK
              </button>
            </form>
          ) : (
            <button type="button" className="text-left w-full" onClick={() => setEditing(true)}>
              <span className="font-medium">{player.name}</span>
              {player.isGoalkeeper && (
                <span className="ml-2 text-xs rounded bg-surface-2 border border-line px-1.5 py-0.5">🧤 GOL</span>
              )}
              {!player.active && <span className="ml-2 text-xs text-muted">inativo</span>}
            </button>
          )}
        </div>
        <Stars value={player.rating} onChange={(v) => save({ rating: v })} />
      </div>
      {editing && (
        <div className="flex flex-wrap gap-2 mt-3">
          <button type="button" className={btn.small} onClick={() => save({ isGoalkeeper: !player.isGoalkeeper })}>
            {player.isGoalkeeper ? "Virar jogador de linha" : "Virar goleiro"}
          </button>
          <button type="button" className={btn.small} onClick={() => save({ active: !player.active })}>
            {player.active ? "Desativar" : "Reativar"}
          </button>
          <button
            type="button"
            className={`${btn.small} text-danger`}
            onClick={() => {
              if (!confirm(`Excluir ${player.name}?`)) return;
              start(async () => {
                const r = await deletePlayer(groupId, player.id);
                setError(r?.error ?? null);
              });
            }}
          >
            Excluir
          </button>
          <button type="button" className={`${btn.small} ml-auto`} onClick={() => setEditing(false)}>
            Fechar
          </button>
        </div>
      )}
      {error && <p className="text-danger text-sm mt-2">{error}</p>}
    </li>
  );
}
