"use client";
import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { btn, card, input, label } from "@/lib/ui/styles";
import { signIn, signUp } from "./actions";

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [inState, inAction] = useActionState(signIn, undefined);
  const [upState, upAction] = useActionState(signUp, undefined);
  const state = mode === "in" ? inState : upState;

  return (
    <div className={`${card} w-full max-w-sm p-5`}>
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
