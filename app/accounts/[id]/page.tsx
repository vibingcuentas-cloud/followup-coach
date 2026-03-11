"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAccountDetail } from "../../../hooks/useAccountDetail";
import QuickLogModal from "../../../components/QuickLogModal";
import AddContactSheet from "../../../components/AddContactSheet";
import BrandWordmark from "../../../components/BrandWordmark";
import WorkspaceRail from "../../../components/WorkspaceRail";
import FlowCycleNav from "../../../components/FlowCycleNav";
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
      <main className="opsPage opsTodayPolish opsStandard">
        <header className="opsTopbar">
          <div>
            <BrandWordmark />
            <h1 className="opsTitle">Account</h1>
          </div>
        </header>
        <FlowCycleNav active="setup" />
        <div className="opsInlineHint">No account id. Go back to Accounts.</div>
        <button className="btn btnGhost" onClick={() => router.push("/accounts")}>Back to Accounts</button>
      </main>
    );
  }

  return (
    <main className="opsPage opsTodayPolish opsStandard">
      <header className="opsTopbar">
        <div style={{ minWidth: 0 }}>
          <BrandWordmark />
          <h1 className="opsTitle opsEntityTitle">
            <span className="opsEntityHeadline">
              {account?.name ?? "Account"}
            </span>
            {score && <ScorePill total={score.total} label={score.label} tone={score.tone} />}
          </h1>
          <div className="opsSubtitle">
            {account ? (
              <>
                {account.tier} • {account.country ?? "—"} • {fmtMoney(account.value_usd)}
                {score && (
                  <>
                    {" "}• last touch: {fmtLastTouch(score.d)} • cadence: {score.cadence}d • coverage: {score.coveredAreas}/
                    {AREAS.length}
                  </>
                )}
              </>
            ) : (
              "Loading…"
            )}
          </div>
        </div>

        <div className="opsTopActions">
          <button className="btn btnGhost" onClick={loadAll} disabled={loading}>Refresh</button>
          <button className="btn btnGhost" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <FlowCycleNav active="setup" />

      {error && <div className="opsInlineError">{error}</div>}

      <div className="opsShell">
        <WorkspaceRail active="accounts" />

        <section className="opsMain">
          {score ? (
            <section className="opsBlock">
              <div className="opsSectionHeaderRow">
                <div>
                  <h2 className="opsSectionTitle">Intimacy score</h2>
                  <div className="opsSectionSubtitle">
                    Recency: {score.recency}/60 • Coverage: {score.coverage}/40
                    {score.missing.length > 0
                      ? ` • Missing: ${score.missing.join(", ")}`
                      : " • Coverage: full"}
                  </div>
                </div>
                <button className="btn btnPrimary" onClick={() => setLogOpen(true)} disabled={!account}>
                  Quick log
                </button>
              </div>
              <CoverageChips counts={score.counts} />
            </section>
          ) : (
            <div className="opsInlineHint">Loading score…</div>
          )}

          <section className="opsBlock">
            <div className="opsSectionHeaderRow">
              <div>
                <h2 className="opsSectionTitle">Contacts ({contacts.length})</h2>
                <div className="opsSectionSubtitle">Cover key areas with actionable hooks.</div>
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

            {contacts.length === 0 ? (
              <div className="opsInlineHint">No contacts yet. Add at least one per area.</div>
            ) : (
              <div className="opsStack">
                {contacts.map((c) => (
                  <article key={c.id} className="opsListRow">
                    <div>
                      <div className="opsMiniTitle">{c.name}</div>
                      <div className="opsMiniMeta">
                        {c.area} • {channelLabel(c.preferred_channel)} • {fmtLastTouch(daysSince(c.last_touch_at))}
                      </div>
                      <div className="opsMiniSub">Hook: {c.personal_hook ?? "—"}</div>
                      {c.email && <div className="opsMiniSub">{c.email}</div>}
                    </div>

                    <div className="opsListActions">
                      <button
                        className="btn btnGhost"
                        onClick={() => {
                          setEditingContact(c);
                          setSheetOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button className="btn btnDanger" onClick={() => deleteContact(c.id)}>
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="opsBlock">
            <div className="opsSectionHeaderRow">
              <div>
                <h2 className="opsSectionTitle">Recent interactions</h2>
                <div className="opsSectionSubtitle">Last 30 interactions for this account.</div>
              </div>
              <div className="opsCount">{interactions.length}</div>
            </div>

            {interactions.length === 0 ? (
              <div className="opsInlineHint">No interactions yet.</div>
            ) : (
              <div className="opsStack">
                {interactions.map((it) => {
                  const contactName = contacts.find((c) => c.id === it.contact_id)?.name ?? null;
                  return (
                    <article key={it.id} className="opsListRow">
                      <div>
                        <div className="opsMiniMeta">
                          {it.channel.toUpperCase()} • {new Date(it.created_at).toLocaleDateString("en-US")}
                        </div>
                        <div className="opsMiniSub">{contactName ?? "No contact"}</div>
                        <div className="opsMiniSub">{it.summary}</div>
                        <div className="opsMiniSub">Next: {it.next_step} ({it.next_step_date})</div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>

        <aside className="opsContext desktopOnly">
          <div className="opsPanelTitle">Context</div>

          <div className="opsPanelBlock">
            <div className="opsPanelLabel">Account</div>
            <div className="opsPanelValue">{account?.name ?? "—"}</div>
          </div>

          <div className="opsPanelBlock">
            <div className="opsPanelLabel">Coverage</div>
            <div className="opsPanelValue">
              {score ? `${score.coveredAreas}/${AREAS.length} areas` : "—"}
            </div>
          </div>

          <div className="opsPanelBlock">
            <div className="opsPanelLabel">Missing areas</div>
            <div className="opsPanelValue">
              {score && score.missing.length > 0 ? score.missing.join(", ") : "None"}
            </div>
          </div>

          <button className="btn btnPrimary" onClick={() => setLogOpen(true)} disabled={!account}>
            Log interaction
          </button>
        </aside>
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
