import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { requireUser } from "@/lib/supabase/server";
import { btn, card } from "@/lib/ui/styles";
import { startDay } from "../../actions";

export const metadata = { title: "Jogos" };

function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function DaysPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase } = await requireUser();
  const { data: days } = await supabase
    .from("match_days")
    .select("id, date, status, players_per_team, matches(count), attendances(count)")
    .eq("group_id", groupId)
    .not("attendances.checked_in_at", "is", null)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(50);

  const open = days?.find((d) => d.status === "open");

  return (
    <div className="space-y-4">
      {open ? (
        <Link href={`/dia/${open.id}`} className={`${btn.primary} w-full h-14 text-lg`}>
          Continuar jogo de hoje →
        </Link>
      ) : (
        <form action={startDay.bind(null, groupId)}>
          <SubmitButton className={`${btn.primary} w-full h-14 text-lg`} pendingText="Abrindo…">
            ⚽ Iniciar jogo do dia
          </SubmitButton>
        </form>
      )}

      <h2 className="font-semibold pt-2">Histórico</h2>
      {days?.length ? (
        <ul className="space-y-2">
          {days.map((d) => {
            const matches = (d.matches as unknown as { count: number }[])[0]?.count ?? 0;
            const present = (d.attendances as unknown as { count: number }[])[0]?.count ?? 0;
            return (
              <li key={d.id}>
                <Link href={`/dia/${d.id}`} className={`${card} p-3 flex items-center justify-between`}>
                  <span className="capitalize">{fmtDate(d.date)}</span>
                  <span className="text-sm text-muted">
                    {present} presentes · {Math.max(0, matches - (d.status === "open" ? 1 : 0))} partidas
                    {d.status === "open" && <span className="ml-2 text-accent">● aberto</span>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-muted text-sm">Nenhum jogo ainda.</p>
      )}
    </div>
  );
}
