import "server-only";
import type { DayState } from "@/lib/engine";
import { createClient } from "@/lib/supabase/server";
import { type DayRows, type MatchRow, rowsToState } from "./mapping";

export interface SharedDay {
  groupName: string;
  date: string;
  status: "open" | "closed";
  state: DayState;
  names: Record<string, string>;
  goalkeeperIds: string[];
  openMatch: MatchRow | null;
  serverNow: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public, read-only view of a match day by its share token. Never includes ratings. */
export async function loadSharedDay(token: string): Promise<SharedDay | null> {
  if (!UUID.test(token)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_shared_day", { p_token: token });
  if (error) {
    console.error("[ao-vivo] get_shared_day:", error.message);
    return null;
  }
  if (!data) return null;

  const d = data as Omit<DayRows, "draws"> & {
    group_name: string;
    server_now: string;
    draws: Omit<DayRows["draws"][number], "snapshot_before">[];
    players: { id: string; name: string; is_goalkeeper: boolean }[];
  };
  const rows: DayRows = {
    day: d.day,
    attendances: d.attendances,
    teams: d.teams,
    members: d.members,
    matches: d.matches,
    draws: d.draws.map((r) => ({ ...r, snapshot_before: undefined as never })),
  };
  return {
    groupName: d.group_name,
    date: d.day.date,
    status: d.day.status,
    state: rowsToState(rows),
    names: Object.fromEntries(d.players.map((p) => [p.id, p.name])),
    goalkeeperIds: d.players.filter((p) => p.is_goalkeeper).map((p) => p.id),
    openMatch: d.matches.find((m) => m.status !== "finished") ?? null,
    serverNow: new Date(d.server_now).getTime(),
  };
}
