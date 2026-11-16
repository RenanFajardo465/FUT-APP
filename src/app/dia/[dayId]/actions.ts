"use server";
import { revalidatePath } from "next/cache";
import {
  type DayConfig,
  type DayState,
  EngineError,
  type MatchResult,
  type TeamLabel,
  checkIn,
  finishMatch,
  formTeams,
  markLeft,
  markReturned,
  movePlayer,
  removeCheckIn,
  reorderQueue,
  swapPlayers,
  undoLastDraw,
  updateConfig,
} from "@/lib/engine";
import { type DayContext, loadDay, ratingsOf, saveDay, secureRng } from "@/lib/day/repo";
import { requireUser } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

type Mutation = (ctx: DayContext & { openMatchStarted: boolean }) => DayState | Promise<DayState>;

/** Load → apply engine → save atomically (optimistic version check). */
async function mutate(dayId: string, version: number, fn: Mutation): Promise<ActionResult> {
  const { supabase } = await requireUser();
  try {
    const ctx = await loadDay(supabase, dayId);
    if (!ctx) return { ok: false, error: "Jogo não encontrado." };
    if (ctx.rows.day.status !== "open") return { ok: false, error: "Este jogo já foi encerrado." };
    if (ctx.rows.day.version !== version) {
      return { ok: false, error: "O jogo foi alterado em outro aparelho. Atualizando…" };
    }
    const open = ctx.rows.matches.find((m) => m.status !== "finished");
    const next = await fn({ ...ctx, openMatchStarted: !!open && open.status !== "pending" });
    await saveDay(supabase, dayId, version, next);
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    if (!(e instanceof EngineError)) console.error("[day action]", e);
    return { ok: false, error: message };
  } finally {
    revalidatePath(`/dia/${dayId}`);
  }
}

export async function checkInAction(dayId: string, version: number, playerId: string) {
  return mutate(dayId, version, ({ state, players, openMatchStarted }) => {
    const p = players.find((x) => x.id === playerId);
    if (!p) throw new EngineError("Jogador não encontrado");
    return checkIn(state, playerId, p.isGoalkeeper, { openMatchStarted });
  });
}

export async function undoCheckInAction(dayId: string, version: number, playerId: string) {
  return mutate(dayId, version, ({ state, openMatchStarted }) =>
    removeCheckIn(state, playerId, { openMatchStarted }),
  );
}

/** Jogador foi embora durante o dia (mantém o histórico). */
export async function leftAction(dayId: string, version: number, playerId: string) {
  return mutate(dayId, version, ({ state, openMatchStarted }) =>
    markLeft(state, playerId, { openMatchStarted }),
  );
}

/** Jogador que tinha saído voltou: entra como nova chegada. */
export async function returnedAction(dayId: string, version: number, playerId: string) {
  return mutate(dayId, version, ({ state, openMatchStarted }) =>
    markReturned(state, playerId, { openMatchStarted }),
  );
}

/** Cria um jogador avulso no grupo e já faz o check-in. */
export async function addGuestAction(
  dayId: string,
  version: number,
  name: string,
  rating: number,
  isGoalkeeper: boolean,
) {
  const clean = name.trim().slice(0, 60);
  if (!clean) return { ok: false, error: "Informe o nome." } as ActionResult;
  return mutate(dayId, version, async ({ state, rows, openMatchStarted }) => {
    const { supabase } = await requireUser();
    const { data, error } = await supabase
      .from("players")
      .insert({ group_id: rows.day.group_id, name: clean, is_goalkeeper: isGoalkeeper })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    const r = Math.min(5, Math.max(1, Math.round(rating) || 3));
    await supabase.from("player_ratings").insert({ player_id: data.id, group_id: rows.day.group_id, rating: r });
    return checkIn(state, data.id, isGoalkeeper, { openMatchStarted });
  });
}

export async function formTeamsAction(dayId: string, version: number) {
  return mutate(dayId, version, ({ state, players }) => formTeams(state, ratingsOf(players), secureRng));
}

export async function finishMatchAction(dayId: string, version: number, result: MatchResult) {
  return mutate(dayId, version, ({ state }) => finishMatch(state, result, secureRng).state);
}

export async function undoDrawAction(dayId: string, version: number) {
  return mutate(dayId, version, ({ state, openMatchStarted }) => {
    if (openMatchStarted) {
      throw new EngineError("A partida seguinte já começou; zere o cronômetro antes de desfazer.");
    }
    return undoLastDraw(state);
  });
}

export async function swapAction(dayId: string, version: number, p1: string, p2: string) {
  return mutate(dayId, version, ({ state }) => swapPlayers(state, p1, p2));
}

export async function moveAction(dayId: string, version: number, playerId: string, to: TeamLabel | null) {
  return mutate(dayId, version, ({ state }) => movePlayer(state, playerId, to));
}

export async function reorderAction(dayId: string, version: number, order: TeamLabel[]) {
  return mutate(dayId, version, ({ state }) => reorderQueue(state, order));
}

export async function dayConfigAction(dayId: string, version: number, config: Partial<DayConfig>) {
  const valid =
    (config.n === undefined || (Number.isInteger(config.n) && config.n >= 2 && config.n <= 11)) &&
    (config.minutesNormal === undefined || (config.minutesNormal >= 1 && config.minutesNormal <= 90)) &&
    (config.minutesCrowded === undefined || (config.minutesCrowded >= 1 && config.minutesCrowded <= 90));
  if (!valid) return { ok: false, error: "Valores inválidos." } as ActionResult;
  return mutate(dayId, version, ({ state, openMatchStarted }) =>
    updateConfig(state, config, { openMatchStarted }),
  );
}

export interface TimerResult {
  ok: boolean;
  error?: string;
  match?: { status: string; started_at: string | null; elapsed_ms: number };
  serverNow?: string;
}

export async function timerAction(
  dayId: string,
  matchId: string,
  action: "start" | "pause" | "reset",
): Promise<TimerResult> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("match_timer", { p_match: matchId, p_action: action });
  revalidatePath(`/dia/${dayId}`);
  if (error) return { ok: false, error: error.message };
  const d = data as { match: TimerResult["match"]; server_now: string };
  return { ok: true, match: d.match, serverNow: d.server_now };
}

export async function closeDayAction(dayId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("match_days").update({ status: "closed" }).eq("id", dayId);
  revalidatePath(`/dia/${dayId}`);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function reopenDayAction(dayId: string): Promise<ActionResult> {
  const { supabase } = await requireUser();
  const { data: day } = await supabase.from("match_days").select("group_id").eq("id", dayId).single();
  const { count } = await supabase
    .from("match_days")
    .select("id", { count: "exact", head: true })
    .eq("group_id", day?.group_id ?? "")
    .eq("status", "open");
  if (count) return { ok: false, error: "Já existe outro jogo aberto neste grupo. Encerre-o antes." };
  const { error } = await supabase.from("match_days").update({ status: "open" }).eq("id", dayId);
  revalidatePath(`/dia/${dayId}`);
  return error ? { ok: false, error: error.message } : { ok: true };
}
