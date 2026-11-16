import { notFound } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { GroupConfigForm } from "./GroupConfigForm";

export const metadata = { title: "Configurações" };

export default async function ConfigPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  const { supabase } = await requireUser();
  const { data: g } = await supabase
    .from("groups")
    .select("id, name, players_per_team, minutes_normal, minutes_crowded")
    .eq("id", groupId)
    .maybeSingle();
  if (!g) notFound();
  return <GroupConfigForm group={g} />;
}
