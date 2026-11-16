export type TeamLabel = "A" | "B" | "C" | "D";
export const LABELS: TeamLabel[] = ["A", "B", "C", "D"];
export const MAX_TEAMS = 4;

/** Random number generator in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

export interface DayConfig {
  /** Line players per team (N). */
  n: number;
  /** Match length when line players present <= 3N. */
  minutesNormal: number;
  /** Match length when line players present > 3N. */
  minutesCrowded: number;
}

export interface Arrival {
  playerId: string;
  /** 1-based arrival order. Base of every priority. */
  order: number;
  isGoalkeeper: boolean;
}

export interface Team {
  label: TeamLabel;
  /** Player ids, in the order they joined the team. */
  members: string[];
  /** Consecutive matches played without leaving the field. */
  streak: number;
}

export interface MatchResult {
  winner: TeamLabel;
  /** True when the match was tied and decided on penalties. */
  penalties: boolean;
  scoreHome?: number | null;
  scoreAway?: number | null;
}

export interface Match {
  seq: number;
  home: TeamLabel;
  away: TeamLabel;
  durationMin: number;
  result: MatchResult | null;
}

/** Everything that defines the day, minus the draw history. */
export interface CoreState {
  config: DayConfig;
  arrivals: Arrival[];
  teams: Team[];
  /** Teams on the field [home, away]; null until A and B are formed. */
  field: [TeamLabel, TeamLabel] | null;
  /** Teams waiting, in FIFO order. */
  queue: TeamLabel[];
  matches: Match[];
  drawCycle: number;
  /** Players already drawn in the current fairness cycle. */
  drawnInCycle: string[];
  /** Players who already finished at least one match. */
  played: string[];
}

export interface DrawRecord {
  id: number;
  kind: "formation" | "completion";
  /** Match whose end triggered the completion (null for formation). */
  matchSeq: number | null;
  from: TeamLabel | null;
  to: TeamLabel | null;
  cycle: number;
  candidates: string[];
  /** Players drawn from the leaving team. For formation: team A members. */
  picked: string[];
  /** Late arrivals (waiting list) that filled the team before the draw. */
  fromWaiting: string[];
  undone: boolean;
  before: CoreState;
}

export interface DayState extends CoreState {
  draws: DrawRecord[];
}

export class EngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EngineError";
  }
}
