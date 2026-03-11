"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToday, type EnrichedAccount } from "../../hooks/useToday";
import QuickLogModal from "../../components/QuickLogModal";
import BrandWordmark from "../../components/BrandWordmark";
import WorkspaceRail from "../../components/WorkspaceRail";
import { cadenceDays, channelLabel, daysSince } from "../../lib/intimacy";

export const dynamic = "force-dynamic";

type MobileTab = "fire" | "next" | "gaps";

function initialsFromName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function touchLabel(iso: string | null | undefined): string {
  const d = daysSince(iso ?? null);
  if (d == null) return "never touched";
  if (d === 0) return "touched today";
  return `${d}d ago`;
}

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const healthyCount = useMemo(
    () => allSorted.filter((a) => a.score.total >= 80).length,
    [allSorted]
  );
  const riskCount = useMemo(
    () => allSorted.filter((a) => a.score.total < 55).length,
    [allSorted]
  );

  const selectedAccount =
    allSorted.find((a) => a.id === selectedId) ?? mustContact[0] ?? allSorted[0] ?? null;

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
  const queueItems = useMemo(
    () => (mobileTab === "fire" ? mustContact : mobileTab === "next" ? nextList : gapsList),
    [gapsList, mobileTab, mustContact, nextList]
  );
  const queueMetaText =
    mobileTab === "fire" ? `${mustContact.length} due` : `${queueItems.length} queued`;
  const queueEmptyText =
    mobileTab === "fire"
      ? "No due accounts right now."
      : mobileTab === "next"
        ? "No recommended contacts yet."
        : "No coverage gaps right now.";

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
  const copilotContact = selectedAccount?.recommendedContact ?? null;
  const copilotAvatar = initialsFromName(copilotContact?.name ?? selectedAccount?.name ?? "F");
  const relationshipHistory = useMemo(() => {
    if (!selectedAccount) return [];
    return [...selectedAccount.contacts]
      .sort((a, b) => {
        const da = daysSince(a.last_touch_at);
        const db = daysSince(b.last_touch_at);
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      })
      .slice(0, 5);
  }, [selectedAccount]);

  return (
    <main className="opsPage opsTodayPolish opsTodayFocus">
      <header className="opsTopbar">
        <div>
          <BrandWordmark />
          <h1 className="opsTitle">Today</h1>
          <div className="opsSubtitle">Intimacy command center • A=7d • B=14d • C=30d</div>
        </div>

        <div className="opsTopActions desktopOnly">
          <button className="btn btnGhost" onClick={() => router.push("/accounts")}>Accounts</button>
          <button className="btn btnGhost" onClick={() => router.push("/weekly")}>Weekly Pack</button>
          <button className="btn btnGhost" onClick={loadAll} disabled={loading}>Refresh</button>
          <button className="btn btnPrimary" onClick={signOut}>Sign out</button>
        </div>

        <div className="opsTodayMobileActions mobileOnly">
          <button className="btn btnGhost" onClick={loadAll} disabled={loading}>Refresh</button>
          <button className="btn btnPrimary" onClick={() => setMobileMenuOpen((v) => !v)}>
            {mobileMenuOpen ? "Close" : "Menu"}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="opsTodayMobileMenu mobileOnly">
          <button className="btn btnGhost" onClick={() => router.push("/accounts")}>Accounts</button>
          <button className="btn btnGhost" onClick={() => router.push("/weekly")}>Weekly Pack</button>
          <button className="btn btnPrimary" onClick={signOut}>Sign out</button>
        </div>
      )}

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
          <div className={`opsFilters ${filtersOpen ? "expanded" : "collapsed"}`}>
            <div className="opsFiltersTop">
              <input
                className="field opsSearch"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search account or country"
              />
              <button
                className="btn btnGhost opsFiltersToggle mobileOnly"
                onClick={() => setFiltersOpen((v) => !v)}
              >
                {filtersOpen ? "Hide" : "Filters"}
              </button>
            </div>
            <div className={`opsFiltersAdvanced ${filtersOpen ? "show" : ""}`}>
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
          </div>

          <section className="opsWorkspacePanel">
            {selectedAccount && selectedStatus ? (
              <>
                <div className="opsWorkspaceHero">
                  <span className={`opsQueueStatusBadge ${selectedStatus.tone}`}>
                    {selectedStatus.label}
                  </span>
                  <h2 className="opsWorkspaceName">{selectedAccount.name}</h2>
                  <div className="opsWorkspaceMeta">
                    {selectedAccount.country ?? "—"} • Tier {selectedAccount.tier} • Value{" "}
                    {selectedAccount.valueFormatted}
                  </div>
                </div>

                <div className="opsWorkspaceStack">
                  <article className="opsWorkspaceSection">
                    <div className="opsWorkspaceLabel">Relationship notes</div>
                    <p className="opsWorkspacePrimary">
                      {selectedAccount.recommendedContact?.personal_hook
                        ? `${selectedAccount.recommendedContact.name}: ${selectedAccount.recommendedContact.personal_hook}`
                        : "No personal hook saved yet. Capture one in the next interaction."}
                    </p>
                    <div className="opsWorkspaceSubtle">{selectedAccount.urgencyReason}</div>
                  </article>

                  <article className="opsWorkspaceSection">
                    <div className="opsWorkspaceLabel">Coverage information</div>
                    <div className="opsWorkspaceValue">
                      {selectedAccount.score.coveredAreas}/5 functions covered
                    </div>
                    <div className="opsWorkspaceSubtle">
                      {Object.entries(selectedAccount.coverageCounts)
                        .filter(([, count]) => count > 0)
                        .map(([area]) => area)
                        .join(", ") || "No covered roles yet"}
                    </div>
                  </article>

                  <article className="opsWorkspaceSection">
                    <div className="opsWorkspaceLabel">Missing roles</div>
                    <div className="opsWorkspaceValue">
                      {selectedAccount.missingAreas.length > 0
                        ? selectedAccount.missingAreas.join(", ")
                        : "None. Coverage complete."}
                    </div>
                    <div className="opsWorkspaceSubtle">{selectedStatus.meta}</div>
                  </article>
                </div>

                <button
                  className="btn btnPrimary opsWorkspacePrimaryCta"
                  onClick={() => openQuickLog(selectedAccount)}
                  disabled={selectedAccount.contacts.length === 0}
                >
                  Log interaction
                </button>
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
              <div className="opsSectionMeta">{queueMetaText}</div>
            </div>

            <div className="segmented opsTierSeg opsQueueModeSeg" role="tablist" aria-label="Queue mode">
              <button
                className={`seg ${mobileTab === "fire" ? "active" : ""}`}
                onClick={() => setMobileTab("fire")}
                role="tab"
                aria-selected={mobileTab === "fire"}
              >
                Fire
              </button>
              <button
                className={`seg ${mobileTab === "next" ? "active" : ""}`}
                onClick={() => setMobileTab("next")}
                role="tab"
                aria-selected={mobileTab === "next"}
              >
                Next
              </button>
              <button
                className={`seg ${mobileTab === "gaps" ? "active" : ""}`}
                onClick={() => setMobileTab("gaps")}
                role="tab"
                aria-selected={mobileTab === "gaps"}
              >
                Gaps
              </button>
            </div>

            <div className="opsQueueList">
              {loading && <div className="opsInlineHint">Loading queue…</div>}
              {!loading && queueItems.length === 0 && (
                <div className="opsInlineHint">{queueEmptyText}</div>
              )}
              {!loading &&
                queueItems.map((a) => (
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

        <aside className="opsContext opsContextIntel opsRightIntel opsCopilotPanel desktopOnly">
          <div className="opsIntelEyebrow">Relationship context</div>
          {selectedAccount ? (
            <>
              <section className="opsCopilotCard opsCopilotContactCard">
                <div className="opsCopilotAvatar" aria-hidden="true">{copilotAvatar}</div>
                <div className="opsCopilotContactMeta">
                  <div className="opsCopilotContactName">
                    {copilotContact?.name ?? "No primary contact selected"}
                  </div>
                  <div className="opsCopilotContactRole">
                    {copilotContact
                      ? `${copilotContact.area} • ${channelLabel(copilotContact.preferred_channel)}`
                      : "Assign a contact for this account"}
                  </div>
                </div>
              </section>

              <section className="opsCopilotCard">
                <div className="opsCopilotLabel">Recent interaction</div>
                <div className="opsCopilotText">
                  {selectedAccount.lastTouch === "never"
                    ? "No recent interaction recorded."
                    : `Last interaction ${selectedAccount.lastTouch}.`}
                </div>
                <div className="opsCopilotSubtle">{selectedAccount.urgencyReason}</div>
              </section>

              <section className="opsCopilotCard">
                <div className="opsCopilotLabel">Relationship history</div>
                {relationshipHistory.length > 0 ? (
                  <div className="opsCopilotHistoryList">
                    {relationshipHistory.map((contact) => (
                      <div key={contact.id} className="opsCopilotHistoryRow">
                        <span className="opsCopilotHistoryAvatar" aria-hidden="true">
                          {initialsFromName(contact.name)}
                        </span>
                        <div>
                          <div className="opsCopilotHistoryName">{contact.name}</div>
                          <div className="opsCopilotHistoryMeta">
                            {contact.area} • {touchLabel(contact.last_touch_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="opsCopilotSubtle">No contact history yet.</div>
                )}
              </section>

              <section className="opsCopilotCard">
                <div className="opsCopilotLabel">Missing contacts</div>
                {selectedAccount.missingAreas.length > 0 ? (
                  <ul className="opsCopilotMissingList">
                    {selectedAccount.missingAreas.map((area) => (
                      <li key={area}>{area}</li>
                    ))}
                  </ul>
                ) : (
                  <div className="opsCopilotSubtle">Coverage complete. No missing roles.</div>
                )}
              </section>

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
            <div className="opsInlineHint">Select an account to view copilot guidance.</div>
          )}
        </aside>
      </div>

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
