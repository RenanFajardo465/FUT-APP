import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";
import { signOut } from "@/app/login/actions";

export function Header({ back, title }: { back?: { href: string; label: string }; title?: string }) {
  return (
    <header className="sticky top-0 z-20 bg-bg/90 backdrop-blur border-b border-line pt-[env(safe-area-inset-top)]">
      <div className="mx-auto max-w-2xl px-4 h-14 flex items-center gap-3">
        {back ? (
          <Link href={back.href} className="text-muted text-sm shrink-0">
            ← {back.label}
          </Link>
        ) : (
          <Link href="/grupos" className="font-bold text-accent shrink-0">
            ⚽ {APP_NAME}
          </Link>
        )}
        <h1 className="font-semibold truncate flex-1">{title}</h1>
        <form action={signOut}>
          <button className="text-sm text-muted" type="submit">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
