import { requireUser } from "@/lib/supabase/server";
import { PlayersManager, type PlayerItem } from "./PlayersManager";

export const metadata = { title: "Jogadores" };

export default async function PlayersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase } = await requireUser();
  const [players, ratings] = await Promise.all([
    supabase.from("players").select("id, name, is_goalkeeper, active").eq("group_id", groupId),
    supabase.from("player_ratings").select("player_id, rating").eq("group_id", groupId),
  ]);
  const r = new Map((ratings.data ?? []).map((x) => [x.player_id, x.rating as number]));
  const items: PlayerItem[] = (players.data ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      isGoalkeeper: p.is_goalkeeper,
      active: p.active,
      rating: r.get(p.id) ?? 3,
    }))
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, "pt-BR"));

  return <PlayersManager groupId={groupId} players={items} />;
}
