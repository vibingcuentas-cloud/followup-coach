"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToday, type EnrichedAccount } from "../../hooks/useToday";
import AccountCard from "../../components/AccountCard";
import QuickLogModal from "../../components/QuickLogModal";

export const dynamic = "force-dynamic";

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
  const [compact, setCompact] = useState(true);
  const [toast, setToast] = useState<{
    text: string;
    undo?: () => Promise<void>;
  } | null>(null);

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
    <main>
      <div className="topbar">
        <div className="topbarTitle">
          <div className="brandTag">Forge</div>
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
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{error}</div>
        </div>
      )}

      <div className="todayKpiGrid todayCommandBar" style={{ marginBottom: 14 }}>
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

      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div
          className="row"
          style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
        >
          <div style={{ flex: 1, minWidth: 280 }}>
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

          <div style={{ minWidth: 220 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              Tier
            </div>
            <div className="segmented">
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

          <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
            <button
              className="btn"
              onClick={() => setSearch("")}
              style={{ height: 44, borderRadius: 16 }}
            >
              Clear
            </button>
            <button className="btn" onClick={() => setCompact((v) => !v)}>
              {compact ? "Comfort view" : "Compact view"}
            </button>
          </div>
        </div>
      </div>

      <div className="row todaySectionHeader" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h2 className="h2">Must contact</h2>
          <div className="subtle" style={{ marginTop: 4 }}>
            Highest risk accounts first. Keep cadence and coverage disciplined.
          </div>
        </div>
        <span className="pill" style={{ opacity: 0.95 }}>
          {mustContact.length}
        </span>
      </div>

      <div style={{ height: 10 }} />

      {loading && (
        <div style={{ display: "grid", gap: 14 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card skeletonCard" />
          ))}
        </div>
      )}

      {!loading && mustContact.length === 0 && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>No hay cuentas pendientes ahora.</div>
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

      <div style={{ display: "grid", gap: 14 }}>
        {!loading &&
          mustContact.map((a) => (
            <AccountCard
              key={a.id}
              account={a}
              contacts={a.contacts}
              missingAreas={a.missingAreas}
              dueLabel={a.dueLabel}
              urgencyReason={a.urgencyReason}
              compact={compact}
              variant="must"
              onOpen={() => router.push(`/accounts/${a.id}`)}
              onLog={() => openQuickLog(a)}
            />
          ))}
      </div>

      <div style={{ height: 18 }} />

      <div className="row todaySectionHeader" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h2">All accounts</h2>
        <span className="pill" style={{ opacity: 0.95 }}>
          {allSorted.length}
        </span>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {!loading &&
          allSorted.map((a) => (
            <AccountCard
              key={a.id}
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
