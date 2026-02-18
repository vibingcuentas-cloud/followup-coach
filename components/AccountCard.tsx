"use client";

import React from "react";

export type Tier = "A" | "B" | "C";
export type Channel = "call" | "whatsapp" | "email";
export type Area = "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors";

export type Account = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
};

export type Contact = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  area: Area;
  preferred_channel: Channel | null;
  personal_hook: string | null;
  last_touch_at: string | null;
  created_at: string;
};

function daysSince(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

function cadenceDays(tier: Tier) {
  if (tier === "A") return 7;
  if (tier === "B") return 14;
  return 30;
}

function fmtMoney(n: number | null) {
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

function channelLabel(c: Channel | null) {
  if (!c) return "—";
  if (c === "call") return "call";
  if (c === "whatsapp") return "whatsapp";
  return "email";
}

function pickRecommendedContact(contacts: Contact[]) {
  if (!contacts || contacts.length === 0) return null;

  const sorted = [...contacts].sort((a, b) => {
    const da = daysSince(a.last_touch_at);
    const db = daysSince(b.last_touch_at);

    const aNever = da == null;
    const bNever = db == null;
    if (aNever && !bNever) return -1;
    if (!aNever && bNever) return 1;

    const va = da ?? -1;
    const vb = db ?? -1;
    return vb - va;
  });

  return sorted[0];
}

function scoreForAccount(a: Account, contacts: Contact[]) {
  // Score simple pero útil:
  // - Recency (0..60) + Coverage (0..40) = 0..100
  const d = daysSince(a.last_interaction_at);
  const cadence = cadenceDays(a.tier);

  // Recency: si estás dentro de cadence => alto. si te pasas => baja.
  // cap: 60 pts
  let recency = 0;
  if (d == null) recency = 0;
  else if (d <= cadence) recency = 60;
  else {
    // cuanto más tarde, más castigo (hasta 0)
    const late = d - cadence;
    recency = Math.max(0, 60 - late * 4); // 4 pts por día tarde (ajustable)
  }

  // Coverage: 5 áreas => 8 pts cada una (40)
  const areas: Area[] = ["Marketing", "R&D", "Procurement", "Commercial", "Directors"];
  const covered = new Set(contacts.map((c) => c.area));
  const cov = areas.filter((ar) => covered.has(ar)).length;
  const coverage = cov * 8;

  const total = Math.round(Math.max(0, Math.min(100, recency + coverage)));

  const status: "healthy" | "watch" | "risk" = total >= 80 ? "healthy" : total >= 60 ? "watch" : "risk";
  return { total, status, recency: Math.round(recency), coverage };
}

function ScoreCircle({ score, status }: { score: number; status: "healthy" | "watch" | "risk" }) {
  const cls =
    status === "healthy" ? "scoreCircle healthy" : status === "watch" ? "scoreCircle watch" : "scoreCircle risk";
  const label = status === "healthy" ? "Healthy" : status === "watch" ? "Watch" : "Risk";

  return (
    <div className={cls} aria-label={`Score ${score} ${label}`}>
      <div className="scoreNum">{score}</div>
      <div className="scoreLbl">{label}</div>
    </div>
  );
}

export default function AccountCard({
  account,
  contacts,
  missingAreas,
  onOpen,
  onLog,
  variant = "default",
}: {
  account: Account;
  contacts: Contact[];
  missingAreas: string[]; // ya lo calculas arriba
  onOpen: () => void;
  onLog: () => void;
  variant?: "default" | "must";
}) {
  const d = daysSince(account.last_interaction_at);
  const cadence = cadenceDays(account.tier);
  const due = d == null ? true : d > cadence;

  const score = scoreForAccount(account, contacts);
  const rec = pickRecommendedContact(contacts);

  const lastTouch = d == null ? "never" : d === 0 ? "today" : `${d}d`;
  const recDays = rec ? daysSince(rec.last_touch_at) : null;
  const recLast = !rec ? "—" : recDays == null ? "never" : recDays === 0 ? "today" : `${recDays}d`;

  return (
    <div className={`accCard ${variant === "must" ? "accCardMust" : ""}`}>
      <div className="accCardRow">
        <ScoreCircle score={score.total} status={score.status} />

        <div className="accMain">
          <div className="accTitleRow">
            <div className="accTitle">
              {account.name}
              <span className="accMeta">
                {account.tier} • {account.country ?? "—"}
              </span>
              <span className={`accBadge ${due ? "due" : "ok"}`}>{due ? "due" : "ok"}</span>
            </div>

            <div className="accActions">
              <button className="btn" onClick={onOpen} style={{ height: 40, borderRadius: 14 }}>
                Open
              </button>
              <button
                className="btn btnPrimary"
                onClick={onLog}
                disabled={contacts.length === 0}
                title={contacts.length === 0 ? "Add a contact first" : "Quick log"}
                style={{ height: 40, borderRadius: 14 }}
              >
                Log
              </button>
            </div>
          </div>

          <div className="accSubRow">
            <div className="accSub">
              <span className="accSubItem">Recency: {score.recency}/60</span>
              <span className="dot">•</span>
              <span className="accSubItem">
                Coverage: {(score.coverage / 8) | 0}/5
              </span>
              <span className="dot">•</span>
              <span className="accSubItem">Value: {fmtMoney(account.value_usd)}</span>
              <span className="dot">•</span>
              <span className="accSubItem">Last touch: {lastTouch}</span>
            </div>

            {missingAreas.length > 0 ? (
              <div className="accMissing">Missing: {missingAreas.join(", ")}</div>
            ) : (
              <div className="accMissing ok">Coverage: ok</div>
            )}
          </div>

          <div className="accRecBox">
            <div className="accRecLabel">RECOMMENDED NEXT TOUCH</div>

            {rec ? (
              <>
                <div className="accRecName">
                  {rec.name}
                  <span className="accRecMeta">
                    {rec.area} • {recLast}
                  </span>
                </div>
                <div className="accRecLine">
                  Preferred: {channelLabel(rec.preferred_channel)}
                  {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                </div>
              </>
            ) : (
              <div className="accRecLine subtle">No contact yet — add one inside the account.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}