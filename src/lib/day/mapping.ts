// Conversão entre as linhas do Supabase e o estado puro do engine.
// Sem dependência de servidor: testável e reutilizável.
import type { CoreState, DayState, DrawRecord, Match, Team, TeamLabel } from "@/lib/engine";

export interface MatchDayRow {
  id: string;
  group_id: string;
  date: string;
  status: "open" | "closed";
  players_per_team: number;
  minutes_normal: number;
  minutes_crowded: number;
  draw_cycle: number;
  version: number;
  share_token?: string;
}

export interface AttendanceRow {
  player_id: string;
  rsvp: "going" | "not_going" | null;
  checked_in_at: string | null;
  arrival_order: number | null;
  is_goalkeeper: boolean;
  drawn_in_cycle: boolean;
  played: boolean;
  left_at: string | null;
}

export interface TeamRow {
  label: TeamLabel;
  position: number;
  streak: number;
}

export interface TeamMemberRow {
  player_id: string;
  label: TeamLabel;
  joined_order: number;
}

export interface MatchRow {
  id: string;
  seq: number;
  home_label: TeamLabel;
  away_label: TeamLabel;
  duration_min: number;
  status: "pending" | "running" | "paused" | "finished";
  started_at: string | null;
  elapsed_ms: number;
  winner_label: TeamLabel | null;
  penalties: boolean;
  score_home: number | null;
  score_away: number | null;
}

export interface DrawRow {
  draw_no: number;
  kind: "formation" | "completion";
  match_seq: number | null;
  from_label: TeamLabel | null;
  to_label: TeamLabel | null;
  cycle: number;
  candidates: string[];
  picked: string[];
  from_waiting: string[];
  undone: boolean;
  snapshot_before: CoreState;
  created_at?: string;
}

export interface DayRows {
  day: MatchDayRow;
  attendances: AttendanceRow[];
  teams: TeamRow[];
  members: TeamMemberRow[];
  matches: MatchRow[];
  draws: DrawRow[];
}

export function rowsToState(rows: DayRows): DayState {
  const checked = rows.attendances
    .filter((a) => a.checked_in_at !== null && a.arrival_order !== null)
    .sort((a, b) => a.arrival_order! - b.arrival_order!);

  const sortedTeams = [...rows.teams].sort((a, b) => a.position - b.position);
  const teams: Team[] = sortedTeams.map((t) => ({
    label: t.label,
    streak: t.streak,
    members: rows.members
      .filter((m) => m.label === t.label)
      .sort((a, b) => a.joined_order - b.joined_order)
      .map((m) => m.player_id),
  }));
  const home = sortedTeams.find((t) => t.position === 0)?.label;
  const away = sortedTeams.find((t) => t.position === 1)?.label;

  const matches: Match[] = [...rows.matches]
    .sort((a, b) => a.seq - b.seq)
    .map((m) => ({
      seq: m.seq,
      home: m.home_label,
      away: m.away_label,
      durationMin: m.duration_min,
      result: m.winner_label
        ? {
            winner: m.winner_label,
            penalties: m.penalties,
            scoreHome: m.score_home,
            scoreAway: m.score_away,
          }
        : null,
    }));

  const draws: DrawRecord[] = [...rows.draws]
    .sort((a, b) => a.draw_no - b.draw_no)
    .map((d) => ({
      id: d.draw_no,
      kind: d.kind,
      matchSeq: d.match_seq,
      from: d.from_label,
      to: d.to_label,
      cycle: d.cycle,
      candidates: d.candidates,
      picked: d.picked,
      fromWaiting: d.from_waiting,
      undone: d.undone,
      before: d.snapshot_before,
    }));

  return {
    config: {
      n: rows.day.players_per_team,
      minutesNormal: rows.day.minutes_normal,
      minutesCrowded: rows.day.minutes_crowded,
    },
    arrivals: checked.map((a) => ({
      playerId: a.player_id,
      order: a.arrival_order!,
      isGoalkeeper: a.is_goalkeeper,
    })),
    teams,
    field: home && away ? [home, away] : null,
    queue: sortedTeams.filter((t) => t.position >= 2).map((t) => t.label),
    matches,
    drawCycle: rows.day.draw_cycle,
    drawnInCycle: checked.filter((a) => a.drawn_in_cycle).map((a) => a.player_id),
    played: checked.filter((a) => a.played).map((a) => a.player_id),
    left: checked.filter((a) => a.left_at !== null).map((a) => a.player_id),
    draws,
  };
}

/** Payload aceito por public.save_day_state. */
export function stateToPayload(s: DayState) {
  const drawn = new Set(s.drawnInCycle);
  const played = new Set(s.played);
  const left = new Set(s.left);
  const position = (label: TeamLabel) => {
    if (s.field?.[0] === label) return 0;
    if (s.field?.[1] === label) return 1;
    const i = s.queue.indexOf(label);
    if (i < 0) throw new Error(`Time ${label} fora do campo e da fila`);
    return 2 + i;
  };
  return {
    draw_cycle: s.drawCycle,
    players_per_team: s.config.n,
    minutes_normal: s.config.minutesNormal,
    minutes_crowded: s.config.minutesCrowded,
    arrivals: s.arrivals.map((a) => ({
      player_id: a.playerId,
      order: a.order,
      is_goalkeeper: a.isGoalkeeper,
      drawn: drawn.has(a.playerId),
      played: played.has(a.playerId),
      left: left.has(a.playerId),
    })),
    teams: s.teams.map((t) => ({
      label: t.label,
      position: position(t.label),
      streak: t.streak,
      members: t.members,
    })),
    matches: s.matches.map((m) => ({
      seq: m.seq,
      home: m.home,
      away: m.away,
      duration_min: m.durationMin,
      winner: m.result?.winner ?? null,
      penalties: m.result?.penalties ?? false,
      score_home: m.result?.scoreHome ?? null,
      score_away: m.result?.scoreAway ?? null,
    })),
    draws: s.draws.map((d) => ({
      draw_no: d.id,
      kind: d.kind,
      match_seq: d.matchSeq,
      from: d.from,
      to: d.to,
      cycle: d.cycle,
      candidates: d.candidates,
      picked: d.picked,
      from_waiting: d.fromWaiting,
      undone: d.undone,
      snapshot: d.before,
    })),
  };
}
