import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { loadDay } from "@/lib/day/repo";
import { requireUser } from "@/lib/supabase/server";
import { DayScreen } from "./DayScreen";
import type { DayView } from "./view";

export const metadata = { title: "Jogo do dia" };
export const dynamic = "force-dynamic";

export default async function DayPage({ params }: { params: Promise<{ dayId: string }> }) {
  const { dayId } = await params;
  const { supabase } = await requireUser();
  const ctx = await loadDay(supabase, dayId);
  if (!ctx) notFound();

  const { rows, state } = ctx;
  const open = rows.matches.find((m) => m.status !== "finished") ?? null;
  const checked = new Set(state.arrivals.map((a) => a.playerId));

  const view: DayView = {
    dayId,
    groupId: rows.day.group_id,
    groupName: ctx.groupName,
    date: rows.day.date,
    status: rows.day.status,
    version: rows.day.version,
    config: state.config,
    players: ctx.players.filter((p) => p.active || checked.has(p.id)),
    state: { ...state, draws: state.draws.map((d) => ({ ...d, before: undefined as never })) },
    openMatch: open && {
      id: open.id,
      seq: open.seq,
      home: open.home_label,
      away: open.away_label,
      durationMin: open.duration_min,
      status: open.status,
      startedAt: open.started_at,
      elapsedMs: Number(open.elapsed_ms),
    },
    serverNow: Date.now(),
  };

  const date = new Date(`${rows.day.date}T12:00:00`).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });

  return (
    <>
      <Header back={{ href: `/grupos/${rows.day.group_id}/jogos`, label: ctx.groupName }} title={`Jogo · ${date}`} />
      <DayScreen view={view} />
    </>
  );
}
