"use server";
import { createClient } from "@/lib/supabase/server";

export interface SharedStartResult {
  ok: boolean;
  /** true se este play iniciou o cronômetro; false se alguém já tinha iniciado. */
  started?: boolean;
  match?: { seq: number; status: string; started_at: string | null; elapsed_ms: number; duration_min: number } | null;
  serverNow?: string;
  error?: string;
}

/** Play público no cronômetro: só o primeiro play conta (garantido no banco). */
export async function sharedStartAction(token: string, seq: number): Promise<SharedStartResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("shared_start_timer", { p_token: token, p_seq: seq });
  if (error) return { ok: false, error: error.message };
  const d = data as { started: boolean; match: SharedStartResult["match"]; server_now: string };
  return { ok: true, started: d.started, match: d.match, serverNow: d.server_now };
}
