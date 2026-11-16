"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { type DrawRecord, type TeamLabel, waitingList } from "@/lib/engine";
import { btn, card, input, label } from "@/lib/ui/styles";
import {
  closeDayAction,
  dayConfigAction,
  moveAction,
  reopenDayAction,
  reorderAction,
  swapAction,
  undoDrawAction,
} from "./actions";
import { useDay } from "./DayScreen";
import { TeamBadge } from "./TeamCard";

export function AdjustTab() {
  const { view } = useDay();
  const closed = view.status === "closed";
  return (
    <div className="space-y-4">
      {!closed && view.state.field && (
        <>
          <UndoDraw />
          <SwapPlayers />
          <MovePlayer />
          <QueueOrder />
        </>
      )}
      {!closed && <DayConfig />}
      <DrawHistory />
      <CloseDay />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={`${card} p-4 space-y-3`}>
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function drawText(d: DrawRecord, name: (id: string) => string) {
  if (d.kind === "formation") return `Formação de A × B (${d.candidates.length} primeiros)`;
  const parts = [`Após P${d.matchSeq}: ${d.from} → ${d.to}`];
  if (d.fromWaiting.length) parts.push(`espera: ${d.fromWaiting.map(name).join(", ")}`);
  if (d.picked.length) parts.push(`sorteados: ${d.picked.map(name).join(", ")}`);
  return parts.join(" · ");
}

function UndoDraw() {
  const { view, run, pending, name } = useDay();
  const last = [...view.state.draws].reverse().find((d) => !d.undone);
  const started = view.openMatch !== null && view.openMatch.status !== "pending";
  return (
    <Section title="Desfazer último sorteio">
      {last ? (
        <>
          <p className="text-sm text-muted">{drawText(last, name)}</p>
          <p className="text-xs text-muted">
            {last.kind === "formation"
              ? "Os times A e B voltam a não existir; você pode sortear de novo."
              : `A partida ${last.matchSeq} é reaberta para registrar o resultado de novo (novo sorteio).`}
          </p>
          {started && <p className="text-xs text-team-c">A partida atual já começou. Zere o cronômetro para desfazer.</p>}
          <button
            type="button"
            className={btn.danger}
            disabled={pending || started}
            onClick={() => confirm("Desfazer o último sorteio?") && run(() => undoDrawAction(view.dayId, view.version))}
          >
            Desfazer sorteio
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">Nenhum sorteio para desfazer.</p>
      )}
    </Section>
  );
}

function PlayerSelect({
  value,
  onChange,
  id,
  exclude,
}: {
  value: string;
  onChange: (v: string) => void;
  id: string;
  exclude?: string;
}) {
  const { view, name } = useDay();
  const waiting = waitingList(view.state);
  return (
    <select id={id} className={input} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Escolha…</option>
      {view.state.teams
        .slice()
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((t) => (
          <optgroup key={t.label} label={`Time ${t.label}`}>
            {t.members
              .filter((m) => m !== exclude)
              .map((m) => (
                <option key={m} value={m}>
                  {name(m)}
                </option>
              ))}
          </optgroup>
        ))}
      {waiting.length > 0 && (
        <optgroup label="Espera">
          {waiting
            .filter((m) => m !== exclude)
            .map((m) => (
              <option key={m} value={m}>
                {name(m)}
              </option>
            ))}
        </optgroup>
      )}
    </select>
  );
}

function SwapPlayers() {
  const { view, run, pending } = useDay();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  return (
    <Section title="Trocar jogadores entre times">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <PlayerSelect id="swap-a" value={a} onChange={setA} exclude={b} />
        <span className="text-muted">⇄</span>
        <PlayerSelect id="swap-b" value={b} onChange={setB} exclude={a} />
      </div>
      <button
        type="button"
        className={btn.ghost}
        disabled={!a || !b || pending}
        onClick={() =>
          run(
            () => swapAction(view.dayId, view.version, a, b),
            () => {
              setA("");
              setB("");
            },
          )
        }
      >
        Trocar
      </button>
    </Section>
  );
}

function MovePlayer() {
  const { view, run, pending } = useDay();
  const [p, setP] = useState("");
  const [to, setTo] = useState<string>("");
  return (
    <Section title="Mover jogador">
      <PlayerSelect id="move-p" value={p} onChange={setP} />
      <select className={input} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Destino">
        <option value="">Para…</option>
        {view.state.teams
          .map((t) => t.label)
          .sort()
          .map((l) => (
            <option key={l} value={l}>
              Time {l}
            </option>
          ))}
        <option value="__wait">Lista de espera</option>
      </select>
      <button
        type="button"
        className={btn.ghost}
        disabled={!p || !to || pending}
        onClick={() =>
          run(
            () => moveAction(view.dayId, view.version, p, to === "__wait" ? null : (to as TeamLabel)),
            () => {
              setP("");
              setTo("");
            },
          )
        }
      >
        Mover
      </button>
    </Section>
  );
}

function QueueOrder() {
  const { view, run, pending } = useDay();
  const q = view.state.queue;
  if (q.length < 2) return null;
  const move = (i: number, d: -1 | 1) => {
    const next = [...q];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    run(() => reorderAction(view.dayId, view.version, next));
  };
  return (
    <Section title="Ordem da fila">
      <ol className="space-y-2">
        {q.map((l, i) => (
          <li key={l} className="flex items-center gap-3">
            <span className="text-muted w-6">{i + 1}º</span>
            <TeamBadge label={l} />
            <span className="flex-1" />
            <button type="button" className={btn.small} disabled={i === 0 || pending} onClick={() => move(i, -1)} aria-label={`Subir ${l}`}>
              ↑
            </button>
            <button
              type="button"
              className={btn.small}
              disabled={i === q.length - 1 || pending}
              onClick={() => move(i, 1)}
              aria-label={`Descer ${l}`}
            >
              ↓
            </button>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function DayConfig() {
  const { view, run, pending } = useDay();
  const formed = view.state.field !== null;
  const [n, setN] = useState(view.config.n);
  const [mn, setMn] = useState(view.config.minutesNormal);
  const [mc, setMc] = useState(view.config.minutesCrowded);
  return (
    <Section title="Configuração deste jogo">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className={label} htmlFor="cfg-n">
            N (linha)
          </label>
          <input
            id="cfg-n"
            type="number"
            min={2}
            max={11}
            className={input}
            value={n}
            disabled={formed}
            onChange={(e) => setN(Number(e.target.value))}
          />
        </div>
        <div>
          <label className={label} htmlFor="cfg-mn">
            ≤ 3N (min)
          </label>
          <input id="cfg-mn" type="number" min={1} max={90} className={input} value={mn} onChange={(e) => setMn(Number(e.target.value))} />
        </div>
        <div>
          <label className={label} htmlFor="cfg-mc">
            &gt; 3N (min)
          </label>
          <input id="cfg-mc" type="number" min={1} max={90} className={input} value={mc} onChange={(e) => setMc(Number(e.target.value))} />
        </div>
      </div>
      {formed && <p className="text-xs text-muted">N não muda depois que os times foram formados.</p>}
      <button
        type="button"
        className={btn.ghost}
        disabled={pending}
        onClick={() =>
          run(() =>
            dayConfigAction(view.dayId, view.version, {
              ...(formed ? {} : { n }),
              minutesNormal: mn,
              minutesCrowded: mc,
            }),
          )
        }
      >
        Salvar
      </button>
    </Section>
  );
}

function DrawHistory() {
  const { view, name } = useDay();
  const draws = [...view.state.draws].reverse();
  if (!draws.length) return null;
  return (
    <Section title={`Histórico de sorteios (ciclo atual: ${view.state.drawCycle})`}>
      <ul className="space-y-2 text-sm">
        {draws.map((d) => (
          <li key={d.id} className={d.undone ? "line-through text-muted" : ""}>
            <span className="text-muted">#{d.id} · ciclo {d.cycle} · </span>
            {drawText(d, name)}
          </li>
        ))}
      </ul>
    </Section>
  );
}

function CloseDay() {
  const { view, run, pending } = useDay();
  const router = useRouter();
  const closed = view.status === "closed";
  return (
    <button
      type="button"
      className={`${closed ? btn.ghost : btn.danger} w-full`}
      disabled={pending}
      onClick={() => {
        if (closed) run(() => reopenDayAction(view.dayId));
        else if (confirm("Encerrar o jogo do dia?"))
          run(() => closeDayAction(view.dayId), () => router.push(`/grupos/${view.groupId}/jogos`));
      }}
    >
      {closed ? "Reabrir jogo" : "Encerrar jogo do dia"}
    </button>
  );
}
