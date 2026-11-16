"use client";

/** Nota 1–5. Interativa quando recebe onChange. */
export function Stars({
  value,
  onChange,
  size = "text-lg",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: string;
}) {
  return (
    <span className={`inline-flex ${size} leading-none`} aria-label={`Nota ${value} de 5`}>
      {[1, 2, 3, 4, 5].map((i) =>
        onChange ? (
          <button
            key={i}
            type="button"
            onClick={() => onChange(i)}
            className={`px-0.5 ${i <= value ? "text-accent" : "text-line"}`}
            aria-label={`Nota ${i}`}
          >
            ★
          </button>
        ) : (
          <span key={i} className={i <= value ? "text-accent" : "text-line"}>
            ★
          </span>
        ),
      )}
    </span>
  );
}
