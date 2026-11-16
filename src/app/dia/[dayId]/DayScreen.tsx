"use client";
import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { presentCount } from "@/lib/engine";
import type { ActionResult } from "./actions";
import type { DayView } from "./view";
import { CheckInTab } from "./CheckInTab";
import { GameTab } from "./GameTab";
import { AdjustTab } from "./AdjustTab";
import { ShareButton } from "./ShareButton";

interface DayCtx {
  view: DayView;
  pending: boolean;
  /** Runs a server action, shows errors and refreshes on conflicts. */
  run: (fn: () => Promise<ActionResult>, onOk?: () => void) => void;
  name: (playerId: string) => string;
  rating: (playerId: string) => number;
}

const Ctx = createContext<DayCtx | null>(null);
export const useDay = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDay fora do DayScreen");
  return c;
};

type Tab = "checkin" | "jogo" | "ajustes";

export function DayScreen({ view }: { view: DayView }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(view.state.field ? "jogo" : "checkin");

  const byId = new Map(view.players.map((p) => [p.id, p]));
  const ctx: DayCtx = {
    view,
    pending,
    run: (fn, onOk) =>
      start(async () => {
        setError(null);
        const r = await fn();
        if (!r.ok) {
          setError(r.error);
          router.refresh();
        } else {
          onOk?.();
        }
      }),
    name: (id) => byId.get(id)?.name ?? "?",
    rating: (id) => byId.get(id)?.rating ?? 3,
  };

  const present = presentCount(view.state);
  const tabs: { id: Tab; label: string }[] = [
    { id: "checkin", label: `Check-in (${present})` },
    { id: "jogo", label: "Jogo" },
    { id: "ajustes", label: "Ajustes" },
  ];

  return (
    <Ctx.Provider value={ctx}>
      <nav className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-10 bg-bg border-b border-line">
        <div className="mx-auto max-w-2xl px-4 grid grid-cols-3">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`h-11 text-sm font-medium border-b-2 ${
                tab === t.id ? "border-accent text-ink" : "border-transparent text-muted"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>
      {pending && <div className="fixed top-0 inset-x-0 h-0.5 bg-accent animate-pulse z-50" />}
      {error && (
        <div
          role="alert"
          className="fixed bottom-4 inset-x-4 z-50 mx-auto max-w-md rounded-xl bg-danger text-white px-4 py-3 shadow-lg flex gap-3 items-start"
        >
          <span className="flex-1 text-sm">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar">
            ✕
          </button>
        </div>
      )}
      {view.status === "closed" && (
        <div className="mx-auto max-w-2xl px-4 pt-4">
          <p className="rounded-xl border border-line bg-surface p-3 text-sm text-muted">
            Este jogo foi encerrado. Você pode consultar, ou reabrir na aba Ajustes.
          </p>
        </div>
      )}
      <main className="mx-auto max-w-2xl px-4 py-4 pb-24">
        {view.shareToken && view.status === "open" && tab !== "ajustes" && (
          <div className="mb-4">
            <ShareButton token={view.shareToken} groupName={view.groupName} />
          </div>
        )}
        {tab === "checkin" && <CheckInTab onFormed={() => setTab("jogo")} />}
        {tab === "jogo" && <GameTab goCheckIn={() => setTab("checkin")} />}
        {tab === "ajustes" && <AdjustTab />}
      </main>
    </Ctx.Provider>
  );
}
