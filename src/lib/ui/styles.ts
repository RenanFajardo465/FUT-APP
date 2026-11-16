const btnBase =
  "inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 font-semibold transition active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none select-none";

export const btn = {
  primary: `${btnBase} bg-accent text-accent-ink`,
  ghost: `${btnBase} bg-surface-2 text-ink border border-line`,
  danger: `${btnBase} bg-danger/15 text-danger border border-danger/40`,
  small:
    "inline-flex items-center justify-center gap-1 rounded-lg px-3 h-9 text-sm font-medium bg-surface-2 border border-line active:scale-[.98] disabled:opacity-40 disabled:pointer-events-none",
};

export const input =
  "h-11 w-full rounded-xl bg-surface-2 border border-line px-3 text-ink placeholder:text-muted/70 focus:outline-2 focus:outline-accent";
export const card = "rounded-2xl bg-surface border border-line";
export const label = "block text-sm text-muted mb-1";
