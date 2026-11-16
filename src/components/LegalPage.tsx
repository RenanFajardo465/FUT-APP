import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <Link href="/login" className="text-sm text-muted">
        ← {APP_NAME}
      </Link>
      <h1 className="text-2xl font-bold mt-4">{title}</h1>
      <p className="text-sm text-muted mt-1">Última atualização: {updated}</p>
      <div className="mt-6 space-y-4 leading-relaxed text-ink/90 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-ink [&_h2]:pt-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-accent [&_a]:underline">
        {children}
      </div>
    </main>
  );
}
