"use client";
import { useState } from "react";
import type { TeamLabel } from "@/lib/engine";
import { btn, input } from "@/lib/ui/styles";
import { finishMatchAction } from "./actions";
import { useDay } from "./DayScreen";
import { TEAM_STYLE } from "./view";

export function ResultDialog({
  home,
  away,
  seq,
  onClose,
}: {
  home: TeamLabel;
  away: TeamLabel;
  seq: number;
  onClose: () => void;
}) {
  const { view, run, pending } = useDay();
  const [tie, setTie] = useState(false);
  const [winner, setWinner] = useState<TeamLabel | null>(null);
  const [scoreHome, setScoreHome] = useState("");
  const [scoreAway, setScoreAway] = useState("");

  const sh = scoreHome === "" ? null : Number(scoreHome);
  const sa = scoreAway === "" ? null : Number(scoreAway);
  // If both scores are filled they decide the winner (or imply a tie).
  const scoreWinner = sh !== null && sa !== null && sh !== sa ? (sh > sa ? home : away) : null;
  const scoreTie = sh !== null && sa !== null && sh === sa;
  const isTie = tie || scoreTie;
  const effectiveWinner = scoreWinner ?? winner;

  const submit = () => {
    if (!effectiveWinner) return;
    run(
      () =>
        finishMatchAction(view.dayId, view.version, {
          winner: effectiveWinner,
          penalties: isTie,
          scoreHome: sh,
          scoreAway: sa,
        }),
      onClose,
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-surface border border-line p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="result-title" className="text-lg font-bold">
          Resultado da partida {seq}
        </h2>

        <div>
          <p className="text-sm text-muted mb-2">Placar (opcional)</p>
          <div className="flex items-center gap-2">
            <span className={`font-bold w-6 text-center ${TEAM_STYLE[home].text}`}>{home}</span>
            <input
              className={`${input} text-center`}
              inputMode="numeric"
              type="number"
              min={0}
              value={scoreHome}
              onChange={(e) => setScoreHome(e.target.value)}
              aria-label={`Gols do time ${home}`}
            />
            <span className="text-muted">×</span>
            <input
              className={`${input} text-center`}
              inputMode="numeric"
              type="number"
              min={0}
              value={scoreAway}
              onChange={(e) => setScoreAway(e.target.value)}
              aria-label={`Gols do time ${away}`}
            />
            <span className={`font-bold w-6 text-center ${TEAM_STYLE[away].text}`}>{away}</span>
          </div>
        </div>

        {!scoreWinner && (
          <>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-5"
                checked={isTie}
                disabled={scoreTie}
                onChange={(e) => setTie(e.target.checked)}
              />
              Empate: decidido nos pênaltis
            </label>
            <div>
              <p className="text-sm text-muted mb-2">{isTie ? "Quem venceu nos pênaltis?" : "Quem venceu?"}</p>
              <div className="grid grid-cols-2 gap-2">
                {[home, away].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setWinner(l)}
                    className={`h-16 rounded-2xl border-2 text-xl font-bold ${TEAM_STYLE[l].text} ${
                      winner === l ? `${TEAM_STYLE[l].bg} ${TEAM_STYLE[l].border}` : "border-line"
                    }`}
                  >
                    Time {l}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {scoreWinner && (
          <p className="text-sm">
            Vencedor pelo placar: <b className={TEAM_STYLE[scoreWinner].text}>Time {scoreWinner}</b>
          </p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button type="button" className={btn.ghost} onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className={btn.primary} disabled={!effectiveWinner || pending} onClick={submit}>
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
