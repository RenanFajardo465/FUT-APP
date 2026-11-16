"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: boolean } | undefined;

function int(form: FormData, key: string, min: number, max: number): number | null {
  const v = Number(form.get(key));
  return Number.isInteger(v) && v >= min && v <= max ? v : null;
}

function text(form: FormData, key: string, max: number): string {
  return String(form.get(key) ?? "").trim().slice(0, max);
}

// ---------------------------------------------------------------- grupos

export async function createGroup(_: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name", 80);
  if (!name) return { error: "Dê um nome ao grupo." };
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("groups")
    .insert({ name, owner_id: user.id })
    .select("id")
    .single();
  if (error) return { error: error.message };
  redirect(`/grupos/${data.id}`);
}

export async function updateGroup(groupId: string, _: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name", 80);
  const n = int(form, "players_per_team", 2, 11);
  const normal = int(form, "minutes_normal", 1, 90);
  const crowded = int(form, "minutes_crowded", 1, 90);
  if (!name || n === null || normal === null || crowded === null) {
    return { error: "Confira os valores: N entre 2 e 11, tempos entre 1 e 90 min." };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("groups")
    .update({ name, players_per_team: n, minutes_normal: normal, minutes_crowded: crowded })
    .eq("id", groupId);
  if (error) return { error: error.message };
  revalidatePath(`/grupos/${groupId}`, "layout");
  return { ok: true };
}

export async function deleteGroup(groupId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message);
  revalidatePath("/grupos");
  redirect("/grupos");
}

// ---------------------------------------------------------------- jogadores

export async function createPlayer(groupId: string, _: FormState, form: FormData): Promise<FormState> {
  const name = text(form, "name", 60);
  const rating = int(form, "rating", 1, 5);
  if (!name) return { error: "Informe o nome." };
  if (rating === null) return { error: "Nota de 1 a 5." };
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("players")
    .insert({ group_id: groupId, name, is_goalkeeper: form.get("is_goalkeeper") === "on" })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const r = await supabase
    .from("player_ratings")
    .insert({ player_id: data.id, group_id: groupId, rating });
  if (r.error) return { error: r.error.message };
  revalidatePath(`/grupos/${groupId}`);
  return { ok: true };
}

export async function updatePlayer(
  groupId: string,
  playerId: string,
  patch: { name?: string; rating?: number; isGoalkeeper?: boolean; active?: boolean },
): Promise<FormState> {
  const { supabase } = await requireUser();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 60);
    if (!name) return { error: "Nome não pode ficar vazio." };
    row.name = name;
  }
  if (patch.isGoalkeeper !== undefined) row.is_goalkeeper = patch.isGoalkeeper;
  if (patch.active !== undefined) row.active = patch.active;
  if (Object.keys(row).length) {
    const { error } = await supabase.from("players").update(row).eq("id", playerId);
    if (error) return { error: error.message };
  }
  if (patch.rating !== undefined) {
    if (!Number.isInteger(patch.rating) || patch.rating < 1 || patch.rating > 5) {
      return { error: "Nota de 1 a 5." };
    }
    const { error } = await supabase.from("player_ratings").upsert({
      player_id: playerId,
      group_id: groupId,
      rating: patch.rating,
      updated_at: new Date().toISOString(),
    });
    if (error) return { error: error.message };
  }
  revalidatePath(`/grupos/${groupId}`);
  return { ok: true };
}

export async function deletePlayer(groupId: string, playerId: string): Promise<FormState> {
  const { supabase } = await requireUser();
  const { count } = await supabase
    .from("attendances")
    .select("id", { count: "exact", head: true })
    .eq("player_id", playerId)
    .not("checked_in_at", "is", null);
  if (count) {
    return { error: "Jogador já participou de jogos. Desative-o em vez de excluir." };
  }
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) return { error: error.message };
  revalidatePath(`/grupos/${groupId}`);
  return { ok: true };
}

// ---------------------------------------------------------------- jogo do dia

export async function startDay(groupId: string) {
  const { supabase } = await requireUser();
  const open = await supabase
    .from("match_days")
    .select("id")
    .eq("group_id", groupId)
    .eq("status", "open")
    .limit(1)
    .maybeSingle();
  if (open.data) redirect(`/dia/${open.data.id}`);

  const g = await supabase
    .from("groups")
    .select("players_per_team, minutes_normal, minutes_crowded")
    .eq("id", groupId)
    .single();
  if (g.error) throw new Error(g.error.message);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
  const { data, error } = await supabase
    .from("match_days")
    .insert({ group_id: groupId, date: today, ...g.data })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/dia/${data.id}`);
}
