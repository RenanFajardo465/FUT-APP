import Link from "next/link";
import { APP_NAME } from "@/lib/app-config";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-10">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">⚽</div>
        <h1 className="text-3xl font-bold">{APP_NAME}</h1>
        <p className="text-muted mt-1">Organize sua pelada do check-in ao apito final.</p>
      </div>
      <LoginForm urlError={erro} />
      <footer className="mt-8 flex gap-4 text-xs text-muted">
        <Link href="/privacidade" className="underline">
          Política de Privacidade
        </Link>
        <Link href="/termos" className="underline">
          Termos de Uso
        </Link>
      </footer>
    </main>
  );
}
