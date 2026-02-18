// lib/intimacy.ts
// Lógica compartida de intimacy: tipos, score, helpers de UI.
// Importa desde aquí en cualquier página que lo necesite.

export type Tier = "A" | "B" | "C";
export type Channel = "call" | "whatsapp" | "email";
export type Area = "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors";

export const AREAS: Area[] = ["Marketing", "R&D", "Procurement", "Commercial", "Directors"];

// ─── Helpers de tiempo ────────────────────────────────────────────────────────

export function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

export function cadenceDays(tier: Tier): number {
  if (tier === "A") return 7;
  if (tier === "B") return 14;
  return 30;
}

// ─── Formato ──────────────────────────────────────────────────────────────────

export function fmtMoney(n: number | null): string {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n}`;
  }
}

export function fmtLastTouch(d: number | null): string {
  if (d == null) return "nunca";
  if (d === 0) return "hoy";
  return `${d}d`;
}

export function channelLabel(ch: Channel | null): string {
  return ch ?? "—";
}

export function areaShort(a: Area): string {
  const map: Record<Area, string> = {
    Marketing: "Mkt",
    "R&D": "R&D",
    Procurement: "Proc",
    Commercial: "Comm",
    Directors: "Dir",
  };
  return map[a] ?? a;
}

// ─── Score ────────────────────────────────────────────────────────────────────

export type IntimacyScore = {
  total: number;
  label: "Strong" | "Ok" | "Risk";
  tone: "good" | "neutral" | "warn";
  recency: number;   // 0–60
  coverage: number;  // 0–40
  coveredAreas: number;
  missing: Area[];
  counts: Record<Area, number>;
  cadence: number;
  d: number | null;
};

export function coverageByArea(contacts: { area: Area }[]): Record<Area, number> {
  const map: Record<Area, number> = {
    Marketing: 0, "R&D": 0, Procurement: 0, Commercial: 0, Directors: 0,
  };
  for (const c of contacts ?? []) {
    if (map[c.area] != null) map[c.area] += 1;
  }
  return map;
}

export function computeIntimacyScore(
  account: { tier: Tier; last_interaction_at: string | null },
  contacts: { area: Area }[]
): IntimacyScore {
  const cadence = cadenceDays(account.tier);
  const d = daysSince(account.last_interaction_at);

  // Recency 0–60
  let recency = 0;
  if (d != null) {
    recency = d <= cadence ? 60 : Math.max(0, 60 - (d - cadence) * 5);
  }

  // Coverage 0–40
  const counts = coverageByArea(contacts);
  const coveredAreas = AREAS.reduce((acc, ar) => acc + ((counts[ar] ?? 0) > 0 ? 1 : 0), 0);
  const coverage = Math.round((coveredAreas / AREAS.length) * 40);

  const total = Math.max(0, Math.min(100, Math.round(recency + coverage)));
  const label = total >= 80 ? "Strong" : total >= 55 ? "Ok" : "Risk";
  const tone = total >= 80 ? "good" : total >= 55 ? "neutral" : "warn";

  return {
    total,
    label,
    tone,
    recency: Math.round(recency),
    coverage,
    coveredAreas,
    missing: AREAS.filter((ar) => (counts[ar] ?? 0) === 0),
    counts,
    cadence,
    d,
  };
}

// ─── Contacto recomendado ─────────────────────────────────────────────────────

export function pickRecommendedContact<T extends { last_touch_at?: string | null }>(
  contacts: T[]
): T | null {
  if (!contacts || contacts.length === 0) return null;
  return [...contacts].sort((a, b) => {
    const da = daysSince(a.last_touch_at);
    const db = daysSince(b.last_touch_at);
    const aNever = da == null;
    const bNever = db == null;
    if (aNever && !bNever) return -1;
    if (!aNever && bNever) return 1;
    return (db ?? -1) - (da ?? -1);
  })[0];
}

export function isAccountDue(account: {
  tier: Tier;
  last_interaction_at: string | null;
}): boolean {
  const d = daysSince(account.last_interaction_at);
  if (d == null) return true;
  return d > cadenceDays(account.tier);
}