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
  const styles =
    tone === "good"
      ? { borderColor: "rgba(80,220,160,0.35)", background: "rgba(80,220,160,0.08)" }
      : tone === "warn"
      ? { borderColor: "rgba(255,120,120,0.35)", background: "rgba(255,120,120,0.08)" }
      : { borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)" };

  return (
    <span className="pill" style={{ ...styles, opacity: 0.95 }}>
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
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {AREAS.map((ar) => {
        const n = counts[ar] ?? 0;
        const ok = n > 0;
        return (
          <span
            key={ar}
            className="pill"
            style={{
              opacity: 0.95,
              borderColor: ok ? "rgba(80,220,160,0.35)" : "rgba(255,120,120,0.35)",
              background: ok ? "rgba(80,220,160,0.08)" : "rgba(255,120,120,0.08)",
              color: "rgba(255,255,255,0.92)",
            }}
            title={ok ? `${ar}: ${n}` : `${ar}: falta`}
          >
            {areaShort(ar)} {n}
          </span>
        );
      })}
    </div>
  );
}