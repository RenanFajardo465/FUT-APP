"use client";
import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { card, input } from "@/lib/ui/styles";
import { createGroup } from "./actions";

export function CreateGroupForm() {
  const [state, action] = useActionState(createGroup, undefined);
  return (
    <form action={action} className={`${card} p-4 space-y-3`}>
      <h2 className="font-semibold">Novo grupo</h2>
      <div className="flex gap-2">
        <input name="name" placeholder="Ex.: Pelada de quinta" className={input} required maxLength={80} />
        <SubmitButton pendingText="…">Criar</SubmitButton>
      </div>
      {state?.error && <p className="text-danger text-sm">{state.error}</p>}
    </form>
  );
}
