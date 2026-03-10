"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccountDetail } from "../../../hooks/useAccountDetail";
import QuickLogModal from "../../../components/QuickLogModal";
import AddContactSheet from "../../../components/AddContactSheet";
import BrandWordmark from "../../../components/BrandWordmark";
import { ScorePill, CoverageChips } from "../../../components/IntimacyWidgets";
import {
  fmtMoney,
  fmtLastTouch,
  daysSince,
  channelLabel,
  AREAS,
} from "../../../lib/intimacy";

export const dynamic = "force-dynamic";

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const accountId = params?.id;

  const {
    account,
    contacts,
    interactions,
    score,
    loading,
    error,
    loadAll,
    deleteContact,
    signOut,
  } = useAccountDetail(accountId);

  const [logOpen, setLogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<(typeof contacts)[0] | null>(
    null
  );

  if (!accountId) {
    return (
      <main>
        <div className="topbar">
          <div className="topbarTitle">
            <h1 className="h1">Account</h1>
          </div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            No account id. Go back to Accounts.
          </div>
          <div style={{ height: 12 }} />
          <button className="btn" onClick={() => router.push("/accounts")}>
            Back to Accounts
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">
        <div className="topbarTitle" style={{ minWidth: 0 }}>
          <BrandWordmark />
          <h1
            className="h1"
            style={{
              display: "flex",
              gap: 10,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ minWidth: 0, overflowWrap: "anywhere", whiteSpace: "normal" }}>
              {account?.name ?? "Account"}
            </span>
            {score && <ScorePill total={score.total} label={score.label} tone={score.tone} />}
          </h1>
          <div className="subtle">
            {account ? (
              <>
                {account.tier} • {account.country ?? "—"} • {fmtMoney(account.value_usd)}
                {score && (
                  <>
                    {" "}
                    • last touch: {fmtLastTouch(score.d)} • cadence: {score.cadence}d • coverage: {score.coveredAreas}/
                    {AREAS.length}
                  </>
                )}
              </>
            ) : (
              "Loading…"
            )}
          </div>
        </div>

        <div className="topbarActions">
          <button className="btn" onClick={() => router.push("/today")}>
            Today
          </button>
          <button className="btn" onClick={() => router.push("/accounts")}>
            Accounts
          </button>
          <button className="btn" onClick={() => router.push("/weekly")}>
            Weekly Pack
          </button>
          <button className="btn" onClick={loadAll} disabled={loading}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{error}</div>
        </div>
      )}

      {score ? (
        <div className="card" style={{ padding: 16 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
          >
            <div>
              <div style={{ fontWeight: 950, fontSize: 16, letterSpacing: -0.2 }}>
                Intimacy score
              </div>
              <div className="subtle" style={{ marginTop: 4 }}>
                Recency: {score.recency}/60 • Coverage: {score.coverage}/40
                {score.missing.length > 0
                  ? ` • Missing: ${score.missing.join(", ")}`
                  : " • Coverage: full"}
              </div>
            </div>
            <button
              className="btn btnPrimary"
              onClick={() => setLogOpen(true)}
              disabled={!account}
            >
              Quick log
            </button>
          </div>
          <div style={{ height: 12 }} />
          <CoverageChips counts={score.counts} />
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div className="subtle">Loading score…</div>
        </div>
      )}

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Contacts ({contacts.length})</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              Cover all key areas. Keep hooks short and useful.
            </div>
          </div>
          <button
            className="btn btnPrimary"
            onClick={() => {
              setEditingContact(null);
              setSheetOpen(true);
            }}
          >
            Add contact
          </button>
        </div>

        <div style={{ height: 12 }} />

        {contacts.length === 0 ? (
          <div className="subtle" style={{ fontSize: 13 }}>
            No contacts yet. Add at least one per area.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {contacts.map((c) => (
              <div key={c.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {c.name}{" "}
                      <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
                        {c.area} • {channelLabel(c.preferred_channel)} • {fmtLastTouch(daysSince(c.last_touch_at))}
                      </span>
                    </div>
                    {c.personal_hook ? (
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                        Hook: {c.personal_hook}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.5 }}>
                        Hook: —
                      </div>
                    )}
                    {c.email && (
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.6 }}>{c.email}</div>
                    )}
                  </div>

                  <div className="row" style={{ gap: 10 }}>
                    <button
                      className="btn"
                      onClick={() => {
                        setEditingContact(c);
                        setSheetOpen(true);
                      }}
                      style={{ height: 40 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btnDanger"
                      onClick={() => deleteContact(c.id)}
                      style={{ height: 40 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 16 }}>Recent interactions</div>
        <div className="subtle" style={{ marginTop: 4 }}>
          Last 30 (per account)
        </div>
        <div style={{ height: 12 }} />

        {interactions.length === 0 ? (
          <div className="subtle" style={{ fontSize: 13 }}>
            No interactions yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {interactions.map((it) => {
              const contactName = contacts.find((c) => c.id === it.contact_id)?.name ?? null;
              return (
                <div key={it.id} className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>
                    {it.channel.toUpperCase()} • {new Date(it.created_at).toLocaleDateString("en-US")} • {contactName ?? "no contact"}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>{it.summary}</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    Next: {it.next_step} ({it.next_step_date})
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {account && (
        <QuickLogModal
          open={logOpen}
          onClose={() => setLogOpen(false)}
          accountId={account.id}
          accountName={account.name}
          accountLastInteractionAt={account.last_interaction_at}
          contacts={contacts}
          onSaved={async () => {
            await loadAll();
          }}
        />
      )}

      <AddContactSheet
        open={sheetOpen}
        mode={editingContact ? "edit" : "create"}
        accountId={accountId ?? ""}
        initial={editingContact}
        onClose={() => {
          setSheetOpen(false);
          setEditingContact(null);
        }}
        onSaved={loadAll}
      />
    </main>
  );
}
