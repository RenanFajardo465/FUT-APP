import { notFound } from "next/navigation";
import { loadSharedDay } from "@/lib/day/shared";
import { LiveView } from "./LiveView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ao vivo", robots: { index: false, follow: false } };

export default async function LivePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const day = await loadSharedDay(token);
  if (!day) notFound();
  const { state } = day;
  return (
    <LiveView
      groupName={day.groupName}
      date={day.date}
      status={day.status}
      state={state}
      names={day.names}
      openMatch={
        day.openMatch && {
          seq: day.openMatch.seq,
          durationMin: day.openMatch.duration_min,
          status: day.openMatch.status,
          startedAt: day.openMatch.started_at,
          elapsedMs: Number(day.openMatch.elapsed_ms),
        }
      }
      serverNow={day.serverNow}
    />
  );
}
