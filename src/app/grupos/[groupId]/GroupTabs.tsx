"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function GroupTabs({ groupId }: { groupId: string }) {
  const path = usePathname();
  const base = `/grupos/${groupId}`;
  const tabs = [
    { href: base, label: "Jogadores" },
    { href: `${base}/jogos`, label: "Jogos" },
    { href: `${base}/config`, label: "Configurações" },
  ];
  return (
    <nav className="border-b border-line bg-bg">
      <div className="mx-auto max-w-2xl px-4 flex gap-1">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`px-3 h-11 inline-flex items-center text-sm font-medium border-b-2 ${
                active ? "border-accent text-ink" : "border-transparent text-muted"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
