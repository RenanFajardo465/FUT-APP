"use client";
import { useState } from "react";
import { btn } from "@/lib/ui/styles";

/** Shares the public live link (no login, no ratings) via the native share sheet or WhatsApp. */
export function ShareButton({ token, groupName }: { token: string; groupName: string }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/ao-vivo/${token}`;
  const text = `⚽ ${groupName}: acompanhe os times, a fila e os sorteios ao vivo`;

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: groupName, text, url });
        return;
      } catch {
        // cancelado ou indisponível: cai nas opções manuais
      }
    }
    setOpen((v) => !v);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen(true);
    }
  };

  return (
    <div className="space-y-2">
      <button type="button" className={`${btn.ghost} w-full`} onClick={share}>
        📲 Compartilhar acompanhamento ao vivo
      </button>
      {open && (
        <div className="rounded-xl border border-line bg-surface p-3 space-y-2 text-sm">
          <p className="text-muted">
            Quem abrir o link vê times, fila, cronômetro e sorteios, sem login. As notas não aparecem.
          </p>
          <input readOnly value={url} className="w-full h-10 rounded-lg bg-surface-2 border border-line px-2 text-xs" onFocus={(e) => e.target.select()} />
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className={btn.small} onClick={copy}>
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            <a
              className={`${btn.small} bg-[#25D366]/15 border-[#25D366]/50`}
              href={`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
