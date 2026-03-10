"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToday, type EnrichedAccount } from "../../hooks/useToday";
import QuickLogModal from "../../components/QuickLogModal";
import BrandWordmark from "../../components/BrandWordmark";
import WorkspaceRail from "../../components/WorkspaceRail";
import { cadenceDays } from "../../lib/intimacy";

export const dynamic = "force-dynamic";

type MobileTab = "fire" | "next" | "gaps";

function getAccountStatus(account: EnrichedAccount) {
  const cadence = cadenceDays(account.tier);
  const tone =
    account.dueLabel === "overdue" ? "risk" : account.isDue ? "due" : account.score.total >= 80 ? "ok" : "due";
  const label =
    account.dueLabel === "overdue"
      ? `Overdue ${Math.max(1, account.overdueDays)}d`
      : account.isDue
        ? "Due now"
        : "Healthy";
  const meta =
    account.lastTouch === "never" ? `Cadence ${cadence}d` : `Last touch ${account.lastTouch} • cadence ${cadence}d`;

  return { tone, label, meta };
}

function QueueItem({
  account,
  active,
  onSelect,
  onOpen,
  onLog,
}: {
  account: EnrichedAccount;
  active: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onLog: () => void;
}) {
  const status = getAccountStatus(account);

  return (
    <article className={`opsQueueItem ${active ? "active" : ""}`} onClick={onSelect}>
      <div className="opsQueueItemMain">
        <div className="opsQueueState">
          <span className={`opsQueueStatusBadge ${status.tone}`}>{status.label}</span>
          <span className="opsQueueStateText">{status.meta}</span>
        </div>

        <div className="opsQueueBody">
          <div className="opsQueueTitle">{account.name}</div>
          <div className="opsQueueMeta">
            {account.country ?? "—"} • Tier {account.tier} • Coverage {account.score.coveredAreas}/5
          </div>
        </div>
      </div>

      <div className="opsQueueActions" onClick={(e) => e.stopPropagation()}>
        <button className="opsQueueActionBtn" onClick={onOpen}>
          Open
        </button>
        <button className="opsQueueActionBtn strong" onClick={onLog}>
          Log
        </button>
      </div>
    </article>
  );
}

export default function TodayPage() {
  const router = useRouter();

  const {
    mustContact,
    allSorted,
    totalShowing,
    loading,
    error,
    search,
    setSearch,
    tierFilter,
    setTierFilter,
    loadAll,
    signOut,
  } = useToday();

  const [qlOpen, setQlOpen] = useState(false);
  const [qlAccount, setQlAccount] = useState<EnrichedAccount | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<MobileTab>("fire");

  const healthyCount = useMemo(
    () => allSorted.filter((a) => a.score.total >= 80).length,
    [allSorted]
  );
  const riskCount = useMemo(
    () => allSorted.filter((a) => a.score.total < 55).length,
    [allSorted]
  );

  const selectedAccount =
    mustContact.find((a) => a.id === selectedId) ?? mustContact[0] ?? allSorted[0] ?? null;

  const nextList = useMemo(
    () => allSorted.filter((a) => a.recommendedContact).slice(0, 8),
    [allSorted]
  );

  const gapsList = useMemo(
    () =>
      [...allSorted]
        .filter((a) => a.missingAreas.length > 0)
        .sort((a, b) => b.missingAreas.length - a.missingAreas.length)
        .slice(0, 8),
    [allSorted]
  );

  function openQuickLog(acc: EnrichedAccount) {
    setQlAccount(acc);
    setQlOpen(true);
  }

  async function handleQuickLogSaved() {
    await loadAll();
    setToast("Interaction logged.");
    setTimeout(() => setToast(null), 4000);
  }

  const selectedStatus = selectedAccount ? getAccountStatus(selectedAccount) : null;

  return (
    <main className="opsPage opsTodayPolish opsTodayFocus">
      <header className="opsTopbar">
        <div>
          <BrandWordmark />
          <h1 className="opsTitle">Today</h1>
          <div className="opsSubtitle">Intimacy command center • A=7d • B=14d • C=30d</div>
        </div>

        <div className="opsTopActions">
          <button className="btn btnGhost" onClick={() => router.push("/accounts")}>Accounts</button>
          <button className="btn btnGhost" onClick={() => router.push("/weekly")}>Weekly Pack</button>
          <button className="btn btnGhost" onClick={loadAll} disabled={loading}>Refresh</button>
          <button className="btn btnPrimary" onClick={signOut}>Sign out</button>
        </div>
      </header>

      {error && <div className="opsInlineError">{error}</div>}

      <section className="opsSummaryRow">
        <div className="opsSummaryCell">
          <div className="opsSummaryLabel">Must contact</div>
          <div className="opsSummaryValue">{mustContact.length}</div>
        </div>
        <div className="opsSummaryCell risk">
          <div className="opsSummaryLabel">At risk</div>
          <div className="opsSummaryValue">{riskCount}</div>
        </div>
        <div className="opsSummaryCell">
          <div className="opsSummaryLabel">Healthy</div>
          <div className="opsSummaryValue">{healthyCount}</div>
        </div>
        <div className="opsSummaryCell">
          <div className="opsSummaryLabel">Total</div>
          <div className="opsSummaryValue">{totalShowing}</div>
        </div>
      </section>

      <div className="opsShell">
        <WorkspaceRail active="fire" />

        <section className="opsMain">
          <div className="opsFilters">
            <input
              className="field opsSearch"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search account or country"
            />
            <div className="segmented opsTierSeg">
              {(["all", "A", "B", "C"] as const).map((t) => (
                <button
                  key={t}
                  className={`seg ${tierFilter === t ? "active" : ""}`}
                  onClick={() => setTierFilter(t)}
                >
                  {t === "all" ? "All" : t}
                </button>
              ))}
            </div>
            <button className="btn btnGhost" onClick={() => setSearch("")}>Reset</button>
          </div>

          <div className="opsCommandBar">
            <span className="opsCommandIcon">&gt;</span>
            <input
              className="opsCommandInput"
              placeholder="Log account outcome or ask for next best action"
              aria-label="Command"
            />
            <span className="opsCommandHint">Cmd K</span>
          </div>

          <section className="opsWorkspacePanel">
            {selectedAccount && selectedStatus ? (
              <>
                <div className="opsWorkspaceHead">
                  <div>
                    <span className={`opsQueueStatusBadge ${selectedStatus.tone}`}>
                      {selectedStatus.label}
                    </span>
                    <h2 className="opsWorkspaceName">{selectedAccount.name}</h2>
                    <div className="opsWorkspaceMeta">
                      {selectedAccount.country ?? "—"} • Tier {selectedAccount.tier} • Value{" "}
                      {selectedAccount.valueFormatted} • Coverage {selectedAccount.score.coveredAreas}/5
                    </div>
                  </div>

                  <div className="opsWorkspaceActions">
                    <button className="btn btnGhost" onClick={() => router.push(`/accounts/${selectedAccount.id}`)}>
                      Open account
                    </button>
                    <button
                      className="btn btnPrimary"
                      onClick={() => openQuickLog(selectedAccount)}
                      disabled={selectedAccount.contacts.length === 0}
                    >
                      Log interaction
                    </button>
                  </div>
                </div>

                <div className="opsWorkspaceGrid">
                  <article className="opsWorkspaceBlock">
                    <div className="opsWorkspaceLabel">Recommended next action</div>
                    <p className="opsWorkspacePrimary">
                      {selectedAccount.recommendedContact
                        ? `Reach out to ${selectedAccount.recommendedContact.name} via ${
                            selectedAccount.recommendedContact.preferred_channel ?? "preferred channel"
                          }.`
                        : "Add a contact in one missing function, then log a first touch."}
                    </p>
                  </article>

                  <article className="opsWorkspaceBlock">
                    <div className="opsWorkspaceLabel">Next best contact</div>
                    <div className="opsWorkspaceValue">
                      {selectedAccount.recommendedContact
                        ? `${selectedAccount.recommendedContact.name} • ${selectedAccount.recommendedContact.area}`
                        : "No contact yet"}
                    </div>
                    {selectedAccount.recommendedContact?.personal_hook && (
                      <div className="opsWorkspaceSubtle">
                        Hook: {selectedAccount.recommendedContact.personal_hook}
                      </div>
                    )}
                  </article>

                  <article className="opsWorkspaceBlock">
                    <div className="opsWorkspaceLabel">Cadence status</div>
                    <div className="opsWorkspaceValue">{selectedStatus.meta}</div>
                    <div className="opsWorkspaceSubtle">{selectedAccount.urgencyReason}</div>
                  </article>

                  <article className="opsWorkspaceBlock">
                    <div className="opsWorkspaceLabel">Coverage gaps</div>
                    <div className="opsWorkspaceValue">
                      {selectedAccount.missingAreas.length > 0
                        ? selectedAccount.missingAreas.join(", ")
                        : "No gaps. Coverage complete."}
                    </div>
                  </article>
                </div>
              </>
            ) : (
              <div className="opsInlineHint">Select an account to start workspace mode.</div>
            )}
          </section>

          <section className="opsQueueSection">
            <div className="opsSectionHeaderRow">
              <div>
                <h2 className="opsSectionTitle">Queue selector</h2>
                <div className="opsSectionSubtitle">Choose the next account to focus.</div>
              </div>
              <div className="opsSectionMeta">{mustContact.length} due</div>
            </div>

            <div className="opsQueueList">
              {loading && <div className="opsInlineHint">Loading queue…</div>}
              {!loading && mustContact.length === 0 && (
                <div className="opsInlineHint">No due accounts right now.</div>
              )}
              {!loading &&
                mustContact.map((a) => (
                  <QueueItem
                    key={a.id}
                    account={a}
                    active={selectedAccount?.id === a.id}
                    onSelect={() => setSelectedId(a.id)}
                    onOpen={() => router.push(`/accounts/${a.id}`)}
                    onLog={() => openQuickLog(a)}
                  />
                ))}
            </div>
          </section>
        </section>

        <aside className="opsContext opsContextIntel opsRightIntel desktopOnly">
          <div className="opsIntelEyebrow">Intelligence</div>
          {selectedAccount ? (
            <>
              <div className="opsIntelAccountName">{selectedAccount.name}</div>

              <div className="opsIntelSignalStrip">
                <span>Score {selectedAccount.score.total}</span>
                <span>{selectedAccount.score.label}</span>
                <span>{selectedAccount.score.coveredAreas}/5 covered</span>
              </div>

              <div className="opsIntelSection">
                <div className="opsIntelLabel">Next best contact</div>
                <div className="opsIntelValue">
                  {selectedAccount.recommendedContact
                    ? `${selectedAccount.recommendedContact.name} • ${selectedAccount.recommendedContact.area}`
                    : "No contact yet"}
                </div>
              </div>

              <div className="opsIntelDivider" />

              <div className="opsIntelSection">
                <div className="opsIntelLabel">Recommended next step</div>
                <p className="opsIntelRecommendation">
                  {selectedAccount.recommendedContact
                    ? `Reach out via ${selectedAccount.recommendedContact.preferred_channel ?? "preferred channel"}`
                    : "Add a contact in missing functions first."}
                </p>
              </div>

              <div className="opsIntelDivider" />

              <div className="opsIntelSection">
                <div className="opsIntelLabel">Interaction context</div>
                <div className="opsIntelValue">{selectedAccount.urgencyReason}</div>
              </div>

              <div className="opsIntelDivider" />

              <div className="opsIntelSection">
                <div className="opsIntelLabel">Coverage gaps</div>
                {selectedAccount.missingAreas.length > 0 ? (
                  <ul className="opsIntelList">
                    {selectedAccount.missingAreas.map((area) => (
                      <li key={area}>{area}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="opsIntelValue">No gaps. Coverage is complete.</div>
                )}
              </div>

              <div className="opsIntelDivider" />

              <button
                className="opsIntelPrimaryAction"
                onClick={() => openQuickLog(selectedAccount)}
                disabled={selectedAccount.contacts.length === 0}
                title={
                  selectedAccount.contacts.length === 0
                    ? "Add at least one contact in the account before logging."
                    : "Log interaction"
                }
              >
                Log interaction
              </button>
            </>
          ) : (
            <div className="opsInlineHint">Select an account to view context.</div>
          )}
        </aside>
      </div>

      <section className="opsMobileTabs mobileOnly">
        <button
          className={`opsMobileTab ${mobileTab === "fire" ? "active" : ""}`}
          onClick={() => setMobileTab("fire")}
        >
          Fire
        </button>
        <button
          className={`opsMobileTab ${mobileTab === "next" ? "active" : ""}`}
          onClick={() => setMobileTab("next")}
        >
          Next
        </button>
        <button
          className={`opsMobileTab ${mobileTab === "gaps" ? "active" : ""}`}
          onClick={() => setMobileTab("gaps")}
        >
          Gaps
        </button>
      </section>

      <section className="opsMobilePane mobileOnly">
        {mobileTab === "fire" &&
          mustContact.slice(0, 8).map((a) => (
            <QueueItem
              key={`m-fire-${a.id}`}
              account={a}
              active={false}
              onSelect={() => setSelectedId(a.id)}
              onOpen={() => router.push(`/accounts/${a.id}`)}
              onLog={() => openQuickLog(a)}
            />
          ))}

        {mobileTab === "next" &&
          nextList.map((a) => (
            <div key={`m-next-${a.id}`} className="opsMiniRow">
              <div>
                <div className="opsMiniTitle">{a.name}</div>
                <div className="opsMiniSub">
                  {a.recommendedContact
                    ? `${a.recommendedContact.name} • ${a.recommendedContact.area}`
                    : "No contact"}
                </div>
              </div>
              <button className="btn btnGhost" onClick={() => openQuickLog(a)}>
                Log
              </button>
            </div>
          ))}

        {mobileTab === "gaps" &&
          gapsList.map((a) => (
            <div key={`m-gaps-${a.id}`} className="opsMiniRow">
              <div>
                <div className="opsMiniTitle">{a.name}</div>
                <div className="opsMiniSub">Missing: {a.missingAreas.join(", ")}</div>
              </div>
              <button className="btn btnGhost" onClick={() => router.push(`/accounts/${a.id}`)}>
                Open
              </button>
            </div>
          ))}
      </section>

      {qlAccount && (
        <QuickLogModal
          open={qlOpen}
          onClose={() => setQlOpen(false)}
          accountId={qlAccount.id}
          accountName={qlAccount.name}
          accountLastInteractionAt={qlAccount.last_interaction_at}
          contacts={qlAccount.contacts}
          onSaved={handleQuickLogSaved}
        />
      )}

      {toast && <div className="toastBar">{toast}</div>}
    </main>
  );
}
