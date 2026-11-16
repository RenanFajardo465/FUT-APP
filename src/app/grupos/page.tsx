import Link from "next/link";
import { Header } from "@/components/Header";
import { requireUser } from "@/lib/supabase/server";
import { card } from "@/lib/ui/styles";
import { CreateGroupForm } from "./CreateGroupForm";

export const metadata = { title: "Meus grupos" };

export default async function GroupsPage() {
  const { supabase } = await requireUser();
  const { data: groups } = await supabase
    .from("groups")
    .select("id, name, players_per_team, players(count), match_days(id, status)")
    .order("created_at");

  return (
    <>
      <Header title="Meus grupos" />
      <main className="mx-auto max-w-2xl px-4 py-5 space-y-4">
        {groups?.length ? (
          <ul className="space-y-3">
            {groups.map((g) => {
              const players = (g.players as unknown as { count: number }[])[0]?.count ?? 0;
              const open = (g.match_days as { id: string; status: string }[]).find(
                (d) => d.status === "open",
              );
              return (
                <li key={g.id} className={`${card} flex items-center`}>
                  <Link href={`/grupos/${g.id}`} className="flex-1 p-4 min-w-0">
                    <div className="font-semibold truncate">{g.name}</div>
                    <div className="text-sm text-muted">
                      {players} jogadores · {g.players_per_team} na linha
                    </div>
                  </Link>
                  {open && (
                    <Link
                      href={`/dia/${open.id}`}
                      className="m-3 shrink-0 rounded-lg bg-accent text-accent-ink px-3 h-9 inline-flex items-center text-sm font-semibold"
                    >
                      Jogo de hoje →
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-muted text-center py-6">
            Você ainda não tem grupos. Crie o primeiro abaixo.
          </p>
        )}
        <CreateGroupForm />
      </main>
    </>
  );
}
