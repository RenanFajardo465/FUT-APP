"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { btn, card, input, label } from "@/lib/ui/styles";
import { deleteGroup, updateGroup } from "../../actions";

interface Group {
  id: string;
  name: string;
  players_per_team: number;
  minutes_normal: number;
  minutes_crowded: number;
}

export function GroupConfigForm({ group }: { group: Group }) {
  const [state, action] = useActionState(updateGroup.bind(null, group.id), undefined);
  const [n, setN] = useState(group.players_per_team);

  return (
    <div className="space-y-6">
      <form action={action} className={`${card} p-4 space-y-4`}>
        <div>
          <label className={label} htmlFor="name">
            Nome do grupo
          </label>
          <input id="name" name="name" defaultValue={group.name} className={input} required maxLength={80} />
        </div>
        <div>
          <label className={label} htmlFor="n">
            Jogadores de linha por time (N)
          </label>
          <input
            id="n"
            name="players_per_team"
            type="number"
            min={2}
            max={11}
            value={n}
            onChange={(e) => setN(Number(e.target.value))}
            className={input}
            inputMode="numeric"
          />
          <p className="text-xs text-muted mt-1">
            Times A e B são formados quando {2 * n || "2N"} jogadores fizerem check-in. Goleiros não contam.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label} htmlFor="mn">
              Até {3 * n || "3N"} na linha
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mn"
                name="minutes_normal"
                type="number"
                min={1}
                max={90}
                defaultValue={group.minutes_normal}
                className={input}
                inputMode="numeric"
              />
              <span className="text-muted text-sm">min</span>
            </div>
          </div>
          <div>
            <label className={label} htmlFor="mc">
              Mais de {3 * n || "3N"}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="mc"
                name="minutes_crowded"
                type="number"
                min={1}
                max={90}
                defaultValue={group.minutes_crowded}
                className={input}
                inputMode="numeric"
              />
              <span className="text-muted text-sm">min</span>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted">
          Alterações valem para os próximos jogos do dia. Um jogo já aberto usa a configuração dele (ajustável na
          aba Ajustes do jogo).
        </p>
        {state?.error && <p className="text-danger text-sm">{state.error}</p>}
        {state?.ok && <p className="text-accent text-sm">Salvo!</p>}
        <SubmitButton className={`${btn.primary} w-full`}>Salvar</SubmitButton>
      </form>

      <form
        action={deleteGroup.bind(null, group.id)}
        onSubmit={(e) => {
          if (!confirm(`Excluir o grupo "${group.name}" e todo o histórico? Não dá para desfazer.`)) {
            e.preventDefault();
          }
        }}
      >
        <button type="submit" className={`${btn.danger} w-full`}>
          Excluir grupo
        </button>
      </form>
    </div>
  );
}
