import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { requireUser } from "@/lib/supabase/server";
import { GroupTabs } from "./GroupTabs";

export default async function GroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { supabase } = await requireUser();
  const { data: group } = await supabase.from("groups").select("id, name").eq("id", groupId).maybeSingle();
  if (!group) notFound();

  return (
    <>
      <Header back={{ href: "/grupos", label: "Grupos" }} title={group.name} />
      <GroupTabs groupId={groupId} />
      <main className="mx-auto max-w-2xl px-4 py-5">{children}</main>
    </>
  );
}
