// components/IntimacyWidgets.tsx
// Componentes de UI compartidos para mostrar el score y la cobertura.
// Importa desde aquí en cualquier página que los necesite.

"use client";

import { AREAS, areaShort, type Area } from "../lib/intimacy";

// ─── ScorePill ────────────────────────────────────────────────────────────────

type ScorePillProps = {
  total: number;
  label: string;
  tone: "good" | "neutral" | "warn";
};

export function ScorePill({ total, label, tone }: ScorePillProps) {
  const toneClass = tone === "good" ? "good" : tone === "warn" ? "warn" : "neutral";

  return (
    <span className={`scoreInlineBadge ${toneClass}`}>
      {total} {label}
    </span>
  );
}

// ─── CoverageChips ────────────────────────────────────────────────────────────

type CoverageChipsProps = {
  counts: Record<Area, number>;
};

export function CoverageChips({ counts }: CoverageChipsProps) {
  return (
    <div className="coverageList">
      {AREAS.map((ar) => {
        const n = counts[ar] ?? 0;
        const ok = n > 0;
        return (
          <span
            key={ar}
            className={`coverageTag ${ok ? "ok" : "missing"}`}
            title={ok ? `${ar}: ${n}` : `${ar}: missing`}
          >
            {areaShort(ar)} {n}
          </span>
        );
      })}
    </div>
  );
}
