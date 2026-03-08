"use client";

import {
  channelLabel,
  computeIntimacyScore,
  daysSince,
  fmtLastTouch,
  fmtMoney,
  isAccountDue,
  pickRecommendedContact,
  type Area,
  type Channel,
  type Tier,
} from "../lib/intimacy";

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

function scoreToneToStatus(
  tone: "good" | "neutral" | "warn"
): "healthy" | "watch" | "risk" {
  if (tone === "good") return "healthy";
  if (tone === "neutral") return "watch";
  return "risk";
}

function ScoreCircle({
  score,
  status,
}: {
  score: number;
  status: "healthy" | "watch" | "risk";
}) {
  const cls =
    status === "healthy"
      ? "scoreCircle healthy"
      : status === "watch"
        ? "scoreCircle watch"
        : "scoreCircle risk";

  const label =
    status === "healthy" ? "Strong" : status === "watch" ? "Ok" : "Risk";

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
  missingAreas: string[];
  onOpen: () => void;
  onLog: () => void;
  variant?: "default" | "must";
}) {
  const due = isAccountDue(account);
  const score = computeIntimacyScore(account, contacts);
  const rec = pickRecommendedContact(contacts);

  const lastTouch = fmtLastTouch(score.d);
  const recLastTouch = rec ? fmtLastTouch(daysSince(rec.last_touch_at)) : "—";

  return (
    <div className={`accCard ${variant === "must" ? "accCardMust cardUrgent" : "cardElevated"}`}>
      <div className="accCardRow">
        <ScoreCircle score={score.total} status={scoreToneToStatus(score.tone)} />

        <div className="accMain">
          <div className="accTitleRow">
            <div className="accTitle">
              {account.name}
              <span className="accMeta">
                {account.tier} • {account.country ?? "—"}
              </span>
              <span className={`accBadge ${due ? "due" : "ok"}`}>
                {due ? "due" : "ok"}
              </span>
            </div>

            <div className="accActions">
              <button
                className="btn"
                onClick={onOpen}
                style={{ height: 40, borderRadius: 14 }}
              >
                Open
              </button>
              <button
                className="btn btnPrimary"
                onClick={onLog}
                disabled={contacts.length === 0}
                title={contacts.length === 0 ? "Add a contact first" : "Quick log"}
                style={{ height: 40, borderRadius: 14 }}
              >
                {variant === "must" ? "Log now" : "Log"}
              </button>
            </div>
          </div>

          <div className="accSubRow">
            <div className="accSub">
              <span className="accSubItem">Recency: {score.recency}/60</span>
              <span className="dot">•</span>
              <span className="accSubItem">Coverage: {score.coveredAreas}/5</span>
              <span className="dot">•</span>
              <span className="accSubItem">Value: {fmtMoney(account.value_usd)}</span>
              <span className="dot">•</span>
              <span className="accSubItem">Last touch: {lastTouch}</span>
            </div>

            {missingAreas.length > 0 ? (
              <div className="accMissing">Missing: {missingAreas.join(", ")}</div>
            ) : (
              <div className="accMissing ok">Coverage: full</div>
            )}
          </div>

          <div className="accRecBox">
            <div className="accRecLabel">
              {variant === "must" ? "NEXT BEST CONTACT (PRIORITY)" : "RECOMMENDED NEXT TOUCH"}
            </div>

            {rec ? (
              <>
                <div className="accRecName">
                  {rec.name}
                  <span className="accRecMeta">
                    {rec.area} • {recLastTouch}
                  </span>
                </div>
                <div className="accRecLine">
                  Preferred: {channelLabel(rec.preferred_channel)}
                  {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                </div>
              </>
            ) : (
              <div className="accRecLine subtle">
                No contact yet — add one inside the account.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
