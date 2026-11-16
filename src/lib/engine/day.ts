import {
  type Arrival,
  type CoreState,
  type DayConfig,
  type DayState,
  type DrawRecord,
  EngineError,
  LABELS,
  MAX_TEAMS,
  type Match,
  type MatchResult,
  type Rng,
  type Team,
  type TeamLabel,
} from "./types";
import { balancedSplit } from "./balance";
import { fairDraw } from "./fairDraw";

// ---------------------------------------------------------------------------
// Construction & queries
// ---------------------------------------------------------------------------

export function createDay(config: DayConfig): DayState {
  if (!Number.isInteger(config.n) || config.n < 1) {
    throw new EngineError("N deve ser um inteiro >= 1");
  }
  return {
    config: { ...config },
    arrivals: [],
    teams: [],
    field: null,
    queue: [],
    matches: [],
    drawCycle: 1,
    drawnInCycle: [],
    played: [],
    left: [],
    draws: [],
  };
}

function hasLeft(s: CoreState, playerId: string): boolean {
  return (s.left ?? []).includes(playerId);
}

/** Line players present (checked in and not gone), by arrival order. */
export function lineArrivals(s: CoreState): Arrival[] {
  return s.arrivals
    .filter((a) => !a.isGoalkeeper && !hasLeft(s, a.playerId))
    .sort((a, b) => a.order - b.order);
}

/** Goalkeepers present, by arrival order. */
export function goalkeepers(s: CoreState): Arrival[] {
  return s.arrivals
    .filter((a) => a.isGoalkeeper && !hasLeft(s, a.playerId))
    .sort((a, b) => a.order - b.order);
}

/** Everyone present (line + goalkeepers). */
export function presentCount(s: CoreState): number {
  return s.arrivals.filter((a) => !hasLeft(s, a.playerId)).length;
}

export function teamsFormed(s: CoreState): boolean {
  return s.field !== null;
}

export function getTeam(s: CoreState, label: TeamLabel): Team {
  const t = s.teams.find((x) => x.label === label);
  if (!t) throw new EngineError(`Time ${label} não existe`);
  return t;
}

export function teamOf(s: CoreState, playerId: string): TeamLabel | null {
  return s.teams.find((t) => t.members.includes(playerId))?.label ?? null;
}

/** Line players checked in but without a team (only meaningful after formation). */
export function waitingList(s: CoreState): string[] {
  if (!teamsFormed(s)) return [];
  return lineArrivals(s)
    .map((a) => a.playerId)
    .filter((id) => teamOf(s, id) === null);
}

export function isComplete(s: CoreState, t: Team): boolean {
  return t.members.length >= s.config.n;
}

/** Match length for a match created now: <= 3N line players → normal, else crowded. */
export function matchDuration(s: CoreState): number {
  return lineArrivals(s).length <= 3 * s.config.n
    ? s.config.minutesNormal
    : s.config.minutesCrowded;
}

export function openMatch(s: CoreState): Match | null {
  const m = s.matches[s.matches.length - 1];
  return m && m.result === null ? m : null;
}

/** The team that will enter the field next (head of the queue). */
export function nextTeam(s: CoreState): TeamLabel | null {
  return s.queue[0] ?? null;
}

/** Players who will need to be drawn when the next team enters (preview). */
export function canFormTeams(s: CoreState): boolean {
  return !teamsFormed(s) && lineArrivals(s).length >= 2 * s.config.n;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function clone<T>(x: T): T {
  return structuredClone(x);
}

function core(s: DayState): CoreState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { draws, ...rest } = s;
  return clone(rest);
}

/**
 * Places waiting players (by arrival order) into the incomplete team at the
 * end of the queue, creating new teams (C, D) while under the max.
 */
function placeWaiting(s: CoreState): void {
  if (!teamsFormed(s)) return;
  for (const id of waitingList(s)) {
    let target = [...s.queue]
      .reverse()
      .map((l) => getTeam(s, l))
      .find((t) => !isComplete(s, t));
    if (!target) {
      if (s.teams.length >= MAX_TEAMS) return; // waiting list
      const used = new Set(s.teams.map((t) => t.label));
      const label = LABELS.find((l) => !used.has(l))!;
      target = { label, members: [], streak: 0 };
      s.teams.push(target);
      s.queue.push(label);
    }
    target.members.push(id);
  }
}

function refreshOpenDuration(s: CoreState): void {
  const m = openMatch(s);
  if (m) m.durationMin = matchDuration(s);
}

function nextDrawId(s: DayState): number {
  return s.draws.reduce((max, d) => Math.max(max, d.id), 0) + 1;
}

// ---------------------------------------------------------------------------
// Actions (all pure: return a new state)
// ---------------------------------------------------------------------------

export interface CheckInOptions {
  /** If false the open match's duration is recalculated (it hasn't started). */
  openMatchStarted?: boolean;
}

export function checkIn(
  state: DayState,
  playerId: string,
  isGoalkeeper: boolean,
  opts: CheckInOptions = {},
): DayState {
  if (state.arrivals.some((a) => a.playerId === playerId)) {
    throw new EngineError("Jogador já fez check-in");
  }
  const s = clone(state);
  const order = s.arrivals.reduce((m, a) => Math.max(m, a.order), 0) + 1;
  s.arrivals.push({ playerId, order, isGoalkeeper });
  if (!isGoalkeeper) placeWaiting(s);
  if (!opts.openMatchStarted) refreshOpenDuration(s);
  return s;
}

/** Undo a check-in. Not allowed once the player has finished a match. */
export function removeCheckIn(
  state: DayState,
  playerId: string,
  opts: CheckInOptions = {},
): DayState {
  if (!state.arrivals.some((a) => a.playerId === playerId)) {
    throw new EngineError("Jogador não fez check-in");
  }
  if (state.played.includes(playerId)) {
    throw new EngineError("Jogador já jogou; não é possível desfazer o check-in");
  }
  const s = clone(state);
  s.arrivals = s.arrivals.filter((a) => a.playerId !== playerId);
  s.left = (s.left ?? []).filter((id) => id !== playerId);
  s.drawnInCycle = s.drawnInCycle.filter((id) => id !== playerId);
  removeFromTeams(s, playerId);
  placeWaiting(s);
  if (!opts.openMatchStarted) refreshOpenDuration(s);
  return s;
}

function removeFromTeams(s: CoreState, playerId: string): void {
  for (const t of s.teams) t.members = t.members.filter((id) => id !== playerId);
  // Drop empty queued teams.
  const empty = new Set(
    s.teams.filter((t) => t.members.length === 0 && !s.field?.includes(t.label)).map((t) => t.label),
  );
  s.teams = s.teams.filter((t) => !empty.has(t.label));
  s.queue = s.queue.filter((l) => !empty.has(l));
}

/**
 * A player went home during the day. They leave their team (which becomes
 * incomplete) and stop counting as present; their history is kept.
 * A team in the queue is completed by the normal rule when it enters; a team
 * on the field finishes the match short and is completed when it ends.
 */
export function markLeft(state: DayState, playerId: string, opts: CheckInOptions = {}): DayState {
  if (!state.arrivals.some((a) => a.playerId === playerId)) {
    throw new EngineError("Jogador não fez check-in");
  }
  if (hasLeft(state, playerId)) throw new EngineError("Jogador já saiu");
  const s = clone(state);
  s.left = [...(s.left ?? []), playerId];
  s.drawnInCycle = s.drawnInCycle.filter((id) => id !== playerId);
  removeFromTeams(s, playerId);
  placeWaiting(s);
  if (!opts.openMatchStarted) refreshOpenDuration(s);
  return s;
}

/** A player who had left came back: rejoins as a new arrival (end of the order). */
export function markReturned(state: DayState, playerId: string, opts: CheckInOptions = {}): DayState {
  if (!hasLeft(state, playerId)) throw new EngineError("Jogador não está marcado como saída");
  const s = clone(state);
  s.left = s.left.filter((id) => id !== playerId);
  const order = s.arrivals.reduce((m, a) => Math.max(m, a.order), 0) + 1;
  const arrival = s.arrivals.find((a) => a.playerId === playerId)!;
  arrival.order = order;
  if (!arrival.isGoalkeeper) placeWaiting(s);
  if (!opts.openMatchStarted) refreshOpenDuration(s);
  return s;
}

/**
 * Forms A and B by balanced draw among the first 2N line arrivals. Later
 * arrivals form C and D by arrival order (no balancing).
 */
export function formTeams(
  state: DayState,
  ratings: Record<string, number>,
  rng: Rng,
): DayState {
  if (teamsFormed(state)) throw new EngineError("Times já formados");
  const n = state.config.n;
  const line = lineArrivals(state);
  if (line.length < 2 * n) {
    throw new EngineError(`São necessários ${2 * n} jogadores de linha (há ${line.length})`);
  }
  const s = clone(state);
  const pool = line.slice(0, 2 * n).map((a) => a.playerId);
  const [a, b] = balancedSplit(pool, ratings, rng);
  s.teams = [
    { label: "A", members: a, streak: 0 },
    { label: "B", members: b, streak: 0 },
  ];
  s.field = ["A", "B"];
  s.queue = [];
  placeWaiting(s);
  s.matches = [{ seq: 1, home: "A", away: "B", durationMin: matchDuration(s), result: null }];
  s.draws.push({
    id: nextDrawId(s),
    kind: "formation",
    matchSeq: null,
    from: null,
    to: null,
    cycle: s.drawCycle,
    candidates: pool,
    picked: a,
    fromWaiting: [],
    undone: false,
    before: core(state),
  });
  return s;
}

export interface FinishOutcome {
  state: DayState;
  left: TeamLabel | null;
  entered: TeamLabel | null;
  /** Completion of the entering team (null if it was already complete). */
  draw: DrawRecord | null;
  /** All completions made (entering team and, if short, the staying team). */
  draws: DrawRecord[];
}

/**
 * Registers the result of the open match and applies the rotation:
 *  - the team that completed 2 consecutive matches leaves; otherwise the loser
 *    leaves (this covers match 1 and ties decided on penalties);
 *  - the leaving team goes to the end of the queue, the head of the queue enters;
 *  - if the entering team is incomplete it is filled first with waiting late
 *    arrivals, then by fair draw among the leaving team.
 * With only 2 teams and nobody waiting there is no rotation.
 */
export function finishMatch(state: DayState, result: MatchResult, rng: Rng): FinishOutcome {
  const m = openMatch(state);
  if (!m || !state.field) throw new EngineError("Não há partida em aberto");
  if (result.winner !== m.home && result.winner !== m.away) {
    throw new EngineError("Vencedor precisa ser um dos times em campo");
  }
  const s = clone(state);
  const match = openMatch(s)!;
  match.result = { ...result };

  const home = getTeam(s, match.home);
  const away = getTeam(s, match.away);
  home.streak += 1;
  away.streak += 1;
  for (const id of [...home.members, ...away.members]) {
    if (!s.played.includes(id)) s.played.push(id);
  }

  // No rotation: only two teams.
  if (s.queue.length === 0) {
    s.matches.push({
      seq: match.seq + 1,
      home: match.home,
      away: match.away,
      durationMin: matchDuration(s),
      result: null,
    });
    return { state: s, left: null, entered: null, draw: null, draws: [] };
  }

  const loser = result.winner === home.label ? away : home;
  const tired = [home, away].filter((t) => t.streak >= 2);
  const leaving = tired.length === 1 ? tired[0] : loser;
  const staying = leaving === home ? away : home;
  leaving.streak = 0;

  const enteringLabel = s.queue.shift()!;
  const entering = getTeam(s, enteringLabel);
  const before = core(state);
  const draws: DrawRecord[] = [];
  // Entering team first (main rule); then the staying team, if someone left it.
  for (const target of [entering, staying]) {
    const d = completeTeam(s, target, leaving, match.seq, before, rng);
    if (d) draws.push(d);
  }
  const draw = draws.find((d) => d.to === entering.label) ?? null;

  if (leaving.members.length > 0) {
    s.queue.push(leaving.label);
  } else {
    s.teams = s.teams.filter((t) => t.label !== leaving.label);
  }
  s.field = [staying.label, entering.label];
  placeWaiting(s);
  s.matches.push({
    seq: match.seq + 1,
    home: staying.label,
    away: entering.label,
    durationMin: matchDuration(s),
    result: null,
  });
  return { state: s, left: leaving.label, entered: entering.label, draw, draws };
}

/**
 * Fills `target` up to N: waiting players first (by arrival order), then a
 * fair draw among the members of the team that just left.
 */
function completeTeam(
  s: DayState,
  target: Team,
  leaving: Team,
  matchSeq: number,
  before: CoreState,
  rng: Rng,
): DrawRecord | null {
  const needed = s.config.n - target.members.length;
  if (needed <= 0) return null;
  const fromWaiting = waitingList(s).slice(0, needed);
  target.members.push(...fromWaiting);
  const stillNeeded = needed - fromWaiting.length;
  const candidates = [...leaving.members];
  const cycleAtDraw = s.drawCycle;
  let picked: string[] = [];
  if (stillNeeded > 0 && candidates.length > 0) {
    const r = fairDraw({
      candidates,
      needed: stillNeeded,
      drawnInCycle: s.drawnInCycle,
      present: lineArrivals(s).map((a) => a.playerId),
      cycle: s.drawCycle,
      rng,
    });
    picked = r.picked;
    s.drawnInCycle = r.drawnInCycle;
    s.drawCycle = r.cycle;
    leaving.members = leaving.members.filter((id) => !picked.includes(id));
    target.members.push(...picked);
  }
  if (fromWaiting.length === 0 && picked.length === 0) return null;
  const record: DrawRecord = {
    id: nextDrawId(s),
    kind: "completion",
    matchSeq,
    from: leaving.label,
    to: target.label,
    cycle: cycleAtDraw,
    candidates: picked.length > 0 ? candidates : [],
    picked,
    fromWaiting,
    undone: false,
    before,
  };
  s.draws.push(record);
  return record;
}

/**
 * Undoes the last draw (formation or completion) by restoring the state from
 * before it. For a completion this also reopens the match whose end triggered
 * it, so the admin registers the result again. Check-ins made after the draw
 * are preserved.
 */
export function undoLastDraw(state: DayState): DayState {
  const last = [...state.draws].reverse().find((d) => !d.undone);
  if (!last) throw new EngineError("Não há sorteio para desfazer");
  const finished = state.matches.filter((m) => m.result !== null);
  const lastFinished = finished[finished.length - 1]?.seq ?? null;
  const stillRecent =
    last.kind === "formation" ? lastFinished === null : last.matchSeq === lastFinished;
  if (!stillRecent) {
    throw new EngineError("Só é possível desfazer o sorteio da última partida encerrada");
  }
  const before: CoreState = { ...clone(last.before), left: clone(last.before.left ?? []) };
  const known = new Set(before.arrivals.map((a) => a.playerId));
  const lateArrivals = state.arrivals
    .filter((a) => !known.has(a.playerId))
    .sort((a, b) => a.order - b.order);

  let s: DayState = {
    ...before,
    draws: state.draws.map((d) =>
      d.id === last.id || (last.kind === "completion" && d.kind === "completion" && d.matchSeq === last.matchSeq)
        ? { ...d, undone: true }
        : d,
    ),
  };
  for (const a of lateArrivals) {
    s = clone(s);
    s.arrivals.push({ ...a });
    if (!a.isGoalkeeper) placeWaiting(s);
  }
  // Departures registered after the draw still apply.
  for (const id of state.left ?? []) {
    if (!before.left.includes(id)) s = markLeft(s, id, { openMatchStarted: true });
  }
  refreshOpenDuration(s);
  return s;
}

/** Swaps two players. Either may be in a team or in the waiting list. */
export function swapPlayers(state: DayState, p1: string, p2: string): DayState {
  if (p1 === p2) throw new EngineError("Escolha dois jogadores diferentes");
  const s = clone(state);
  const t1 = s.teams.find((t) => t.members.includes(p1));
  const t2 = s.teams.find((t) => t.members.includes(p2));
  if (!t1 && !t2) throw new EngineError("Nenhum dos jogadores está em um time");
  if (t1 === t2) throw new EngineError("Os jogadores já estão no mesmo time");
  if (t1) t1.members = t1.members.map((id) => (id === p1 ? p2 : id));
  if (t2) t2.members = t2.members.map((id) => (id === p2 ? p1 : id));
  return s;
}

/** Moves a player to another team (or to the waiting list with `to = null`). */
export function movePlayer(state: DayState, playerId: string, to: TeamLabel | null): DayState {
  const line = lineArrivals(state).some((a) => a.playerId === playerId);
  if (!line) throw new EngineError("Jogador de linha sem check-in");
  const s = clone(state);
  for (const t of s.teams) t.members = t.members.filter((id) => id !== playerId);
  if (to) getTeam(s, to).members.push(playerId);
  return s;
}

/** Sets a new queue order. Must be a permutation of the current queue. */
export function reorderQueue(state: DayState, order: TeamLabel[]): DayState {
  const a = [...state.queue].sort().join();
  const b = [...order].sort().join();
  if (a !== b || new Set(order).size !== order.length) {
    throw new EngineError("A nova ordem precisa conter exatamente os times da fila");
  }
  const s = clone(state);
  s.queue = [...order];
  return s;
}

/** Updates N / match times for the day. N can only change before formation. */
export function updateConfig(
  state: DayState,
  config: Partial<DayConfig>,
  opts: CheckInOptions = {},
): DayState {
  if (config.n !== undefined && config.n !== state.config.n && teamsFormed(state)) {
    throw new EngineError("N não pode mudar depois de formar os times");
  }
  const s = clone(state);
  s.config = { ...s.config, ...config };
  if (!opts.openMatchStarted) refreshOpenDuration(s);
  return s;
}
