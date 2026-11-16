"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { btn, card, input, label } from "@/lib/ui/styles";
import { signIn, signInWithGoogle, signUp } from "./actions";

const URL_ERRORS: Record<string, string> = {
  google: "Não foi possível entrar com o Google. Tente novamente.",
  link: "Link inválido ou expirado. Entre novamente.",
};

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginForm({ urlError }: { urlError?: string }) {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction] = useActionState(signIn, undefined);
  const [upState, upAction] = useActionState(signUp, undefined);
  const state = mode === "in" ? inState : upState;

  return (
    <div className={`${card} w-full max-w-sm p-5`}>
      <form action={signInWithGoogle}>
        <SubmitButton className={`${btn.ghost} w-full bg-white! text-neutral-800! border-white`} pendingText="Abrindo o Google…">
          <GoogleIcon />
          Continuar com Google
        </SubmitButton>
      </form>
      {urlError && URL_ERRORS[urlError] && (
        <p className="text-danger text-sm mt-3" role="alert">
          {URL_ERRORS[urlError]}
        </p>
      )}
      <div className="flex items-center gap-3 my-5 text-xs text-muted">
        <span className="h-px flex-1 bg-line" />
        ou com e-mail
        <span className="h-px flex-1 bg-line" />
      </div>
      <div className="grid grid-cols-2 gap-1 p-1 bg-surface-2 rounded-xl mb-5" role="tablist">
        {(["in", "up"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`h-9 rounded-lg text-sm font-medium ${mode === m ? "bg-accent text-accent-ink" : "text-muted"}`}
          >
            {m === "in" ? "Entrar" : "Criar conta"}
          </button>
        ))}
      </div>
      <form action={mode === "in" ? inAction : upAction} className="space-y-4">
        {mode === "up" && (
          <div>
            <label className={label} htmlFor="name">
              Seu nome
            </label>
            <input id="name" name="name" className={input} required autoComplete="name" />
          </div>
        )}
        <div>
          <label className={label} htmlFor="email">
            E-mail
          </label>
          <input id="email" name="email" type="email" className={input} required autoComplete="email" />
        </div>
        <div>
          <label className={label} htmlFor="password">
            Senha
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className={input}
            required
            minLength={6}
            autoComplete={mode === "in" ? "current-password" : "new-password"}
          />
        </div>
        {state?.error && (
          <p className="text-danger text-sm" role="alert">
            {state.error}
          </p>
        )}
        {state?.message && (
          <p className="text-accent text-sm" role="status">
            {state.message}
          </p>
        )}
        <SubmitButton className={`${btn.primary} w-full`} pendingText="Aguarde…">
          {mode === "in" ? "Entrar" : "Criar conta"}
        </SubmitButton>
      </form>
    </div>
  );
}
