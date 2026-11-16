"use client";
import type { Team } from "@/lib/engine";
import { useDay } from "./DayScreen";
import { TEAM_STYLE } from "./view";

export function TeamBadge({ label, className = "" }: { label: string; className?: string }) {
  const s = TEAM_STYLE[label as keyof typeof TEAM_STYLE];
  return (
    <span
      className={`inline-flex items-center justify-center size-8 rounded-lg font-bold border ${s.text} ${s.bg} ${s.border} ${className}`}
    >
      {label}
    </span>
  );
}

export function TeamCard({
  team,
  caption,
  compact = false,
  highlight = [],
}: {
  team: Team;
  caption?: string;
  compact?: boolean;
  /** Players to mark (e.g. just drawn into the team). */
  highlight?: string[];
}) {
  const { view, name, rating } = useDay();
  const n = view.config.n;
  const s = TEAM_STYLE[team.label];
  const missing = n - team.members.length;
  const sum = team.members.reduce((acc, id) => acc + rating(id), 0);

  return (
    <div className={`rounded-2xl border ${s.border} ${s.bg} p-3`}>
      <div className="flex items-center gap-2 mb-2">
        <TeamBadge label={team.label} />
        <div className="flex-1 min-w-0">
          <div className={`font-semibold ${s.text}`}>Time {team.label}</div>
          {caption && <div className="text-xs text-muted">{caption}</div>}
        </div>
        <div className="text-right text-xs text-muted">
          <div>
            {team.members.length}/{n}
          </div>
          <div title="Soma das notas">★ {sum}</div>
        </div>
      </div>
      {missing > 0 && (
        <div className="text-xs rounded-md bg-bg/60 text-team-c px-2 py-1 mb-2">
          Incompleto: faltam {missing}
        </div>
      )}
      <ul className={compact ? "flex flex-wrap gap-x-3 gap-y-1 text-sm" : "grid grid-cols-2 gap-x-3 gap-y-1 text-sm"}>
        {team.members.map((id) => (
          <li key={id} className={`truncate ${highlight.includes(id) ? "text-accent font-semibold" : ""}`}>
            {highlight.includes(id) && "↪ "}
            {name(id)}
          </li>
        ))}
      </ul>
    </div>
  );
}
