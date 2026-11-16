import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DayState, Rng } from "@/lib/engine";
import {
  type AttendanceRow,
  type DayRows,
  type DrawRow,
  type MatchDayRow,
  type MatchRow,
  type TeamMemberRow,
  type TeamRow,
  rowsToState,
  stateToPayload,
} from "./mapping";

export interface PlayerInfo {
  id: string;
  name: string;
  isGoalkeeper: boolean;
  active: boolean;
  rating: number | null;
}

export interface DayContext {
  rows: DayRows;
  state: DayState;
  groupName: string;
  players: PlayerInfo[];
}

function must<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

export async function loadDay(supabase: SupabaseClient, dayId: string): Promise<DayContext | null> {
  const dayRes = await supabase
    .from("match_days")
    .select("*, groups(name)")
    .eq("id", dayId)
    .maybeSingle();
  const dayWithGroup = must(dayRes) as (MatchDayRow & { groups: { name: string } }) | null;
  if (!dayWithGroup) return null;
  const { groups, ...day } = dayWithGroup;

  const [attendances, teams, members, matches, draws, players, ratings] = await Promise.all([
    supabase
      .from("attendances")
      .select("player_id, rsvp, checked_in_at, arrival_order, is_goalkeeper, drawn_in_cycle, played, left_at")
      .eq("match_day_id", dayId),
    supabase.from("teams").select("label, position, streak").eq("match_day_id", dayId),
    supabase.from("team_members").select("player_id, label, joined_order").eq("match_day_id", dayId),
    supabase.from("matches").select("*").eq("match_day_id", dayId),
    supabase.from("draws").select("*").eq("match_day_id", dayId),
    supabase.from("players").select("id, name, is_goalkeeper, active").eq("group_id", day.group_id),
    supabase.from("player_ratings").select("player_id, rating").eq("group_id", day.group_id),
  ]);

  const rows: DayRows = {
    day,
    attendances: must(attendances) as AttendanceRow[],
    teams: must(teams) as TeamRow[],
    members: must(members) as TeamMemberRow[],
    matches: must(matches) as MatchRow[],
    draws: must(draws) as DrawRow[],
  };
  const ratingMap = new Map(
    (must(ratings) as { player_id: string; rating: number }[]).map((r) => [r.player_id, r.rating]),
  );
  const playerRows = must(players) as {
    id: string;
    name: string;
    is_goalkeeper: boolean;
    active: boolean;
  }[];

  return {
    rows,
    state: rowsToState(rows),
    groupName: groups.name,
    players: playerRows
      .map((p) => ({
        id: p.id,
        name: p.name,
        isGoalkeeper: p.is_goalkeeper,
        active: p.active,
        rating: ratingMap.get(p.id) ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
  };
}

export async function saveDay(
  supabase: SupabaseClient,
  dayId: string,
  version: number,
  state: DayState,
): Promise<number> {
  const { data, error } = await supabase.rpc("save_day_state", {
    p_day: dayId,
    p_version: version,
    p_state: stateToPayload(state),
  });
  if (error) throw new Error(error.message);
  return data as number;
}

/** Cryptographically strong RNG for real draws. */
export const secureRng: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
};

export function ratingsOf(players: PlayerInfo[]): Record<string, number> {
  return Object.fromEntries(players.filter((p) => p.rating !== null).map((p) => [p.id, p.rating!]));
}
