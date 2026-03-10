"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToday, type EnrichedAccount } from "../../hooks/useToday";
import AccountCard from "../../components/AccountCard";
import QuickLogModal from "../../components/QuickLogModal";
import BrandWordmark from "../../components/BrandWordmark";
import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";
const DENSITY_KEY = "forge-density";

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
  const [compact, setCompact] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(DENSITY_KEY) === "compact";
  });
  const [toast, setToast] = useState<{
    text: string;
    undo?: () => Promise<void>;
  } | null>(null);
  const [showFilters, setShowFilters] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.innerWidth > 720;
  });

  const healthyCount = useMemo(
    () => allSorted.filter((a) => a.score.total >= 80).length,
    [allSorted]
  );
  const riskCount = useMemo(
    () => allSorted.filter((a) => a.score.total < 55).length,
    [allSorted]
  );

  function openQuickLog(acc: EnrichedAccount) {
    setQlAccount(acc);
    setQlOpen(true);
  }

  function toggleDensity() {
    setCompact((v) => {
      const next = !v;
      const density = next ? "compact" : "comfortable";
      localStorage.setItem(DENSITY_KEY, density);
      document.documentElement.setAttribute("data-density", density);
      return next;
    });
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-density", compact ? "compact" : "comfortable");
  }, [compact]);

  async function handleQuickLogSaved(meta: {
    interactionId: string;
    accountId: string;
    contactId: string;
    previousAccountLastInteractionAt: string | null;
    previousContactLastTouchAt: string | null;
  }) {
    await loadAll();
    setToast({
      text: "Interaction logged.",
      undo: async () => {
        await supabase.from("interactions").delete().eq("id", meta.interactionId);
        await supabase
          .from("accounts")
          .update({ last_interaction_at: meta.previousAccountLastInteractionAt })
          .eq("id", meta.accountId);
        await supabase
          .from("contacts")
          .update({ last_touch_at: meta.previousContactLastTouchAt })
          .eq("id", meta.contactId);
        await loadAll();
      },
    });
    setTimeout(() => setToast(null), 5000);
  }

  return (
    <main className="todayPage">
      <div className="topbar">
        <div className="topbarTitle">
          <BrandWordmark />
          <h1 className="h1">Today</h1>
          <div className="subtle">Intimacy command center • A=7d • B=14d • C=30d</div>
        </div>

        <div className="topbarActions">
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
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.95 }}>{error}</div>
        </div>
      )}

      <div className="todayKpiGrid todayCommandBar todayTopKpis">
        <div className="card todayKpiCard cardElevated">
          <div className="todayKpiLabel">Must contact</div>
          <div className="todayKpiValue">{mustContact.length}</div>
        </div>
        <div className="card todayKpiCard cardUrgent">
          <div className="todayKpiLabel">At risk</div>
          <div className="todayKpiValue">{riskCount}</div>
        </div>
        <div className="card todayKpiCard cardElevated">
          <div className="todayKpiLabel">Healthy</div>
          <div className="todayKpiValue">{healthyCount}</div>
        </div>
        <div className="card todayKpiCard cardElevated">
          <div className="todayKpiLabel">Total</div>
          <div className="todayKpiValue">{totalShowing}</div>
        </div>
      </div>

      <div className="card todayFiltersCard">
        <div className="row todayFiltersHeader">
          <div className="label" style={{ marginBottom: 0 }}>
            Filters
          </div>
          <button className="btn" onClick={() => setShowFilters((v) => !v)}>
            {showFilters ? "Hide" : "Show"}
          </button>
        </div>
        {showFilters && (
          <div className="todayFiltersGrid">
            <div className="todayFilterSearch">
              <div className="label" style={{ marginBottom: 6 }}>
                Search
              </div>
              <input
                className="field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Account name or country"
              />
            </div>

            <div className="todayFilterTier">
              <div className="label" style={{ marginBottom: 6 }}>
                Tier
              </div>
              <div className="segmented scroll">
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
            </div>

            <div className="row todayFilterActions">
              <button className="btn" onClick={() => setSearch("")}>
                Clear
              </button>
              <button className="btn" onClick={toggleDensity}>
                {compact ? "Comfort view" : "Compact view"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="row todaySectionHeader">
        <div>
          <h2 className="h2">Must contact</h2>
          <div className="subtle" style={{ marginTop: 4 }}>
            Highest risk accounts first. Keep cadence and coverage disciplined.
          </div>
        </div>
        <span className="pill todaySectionCount" style={{ opacity: 0.95 }}>
          {mustContact.length}
        </span>
      </div>

      {loading && (
        <div className="todayList">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card skeletonCard" />
          ))}
        </div>
      )}

      {!loading && mustContact.length === 0 && (
        <div className="card emptyState">
          <div className="emptyStateIcon">◎</div>
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            No accounts are due right now.
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => router.push("/accounts")}>
              Add account
            </button>
            <button className="btn" onClick={() => router.push("/weekly")}>
              Open weekly pack
            </button>
          </div>
        </div>
      )}

      <div className="todayList">
        {!loading &&
          mustContact.map((a, idx) => (
            <AccountCard
              key={`${a.id}-${compact ? "c" : "o"}`}
              account={a}
              contacts={a.contacts}
              missingAreas={a.missingAreas}
              dueLabel={a.dueLabel}
              urgencyReason={a.urgencyReason}
              compact={compact}
              variant={idx < 2 ? "must" : "default"}
              onOpen={() => router.push(`/accounts/${a.id}`)}
              onLog={() => openQuickLog(a)}
            />
          ))}
      </div>

      <div className="row todaySectionHeader">
        <h2 className="h2">All accounts</h2>
        <span className="pill todaySectionCount" style={{ opacity: 0.95 }}>
          {allSorted.length}
        </span>
      </div>

      <div className="todayList todayListTight">
        {!loading &&
          allSorted.map((a) => (
            <AccountCard
              key={`${a.id}-${compact ? "c" : "o"}`}
              account={a}
              contacts={a.contacts}
              missingAreas={a.missingAreas}
              dueLabel={a.dueLabel}
              urgencyReason={a.urgencyReason}
              compact={compact}
              variant="default"
              onOpen={() => router.push(`/accounts/${a.id}`)}
              onLog={() => openQuickLog(a)}
            />
          ))}
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

      {toast && (
        <div className="toastBar">
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              className="btn"
              style={{ height: 34 }}
              onClick={() => {
                void toast.undo?.();
                setToast(null);
              }}
            >
              Undo
            </button>
          )}
        </div>
      )}

    </main>
  );
}
