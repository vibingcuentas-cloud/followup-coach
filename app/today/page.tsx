"use client";

import { useState } from "react";
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

  function openQuickLog(acc: EnrichedAccount) {
    setQlAccount(acc);
    setQlOpen(true);
  }

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Today</h1>
          <div className="subtle">Intimacy cockpit • A=7d • B=14d • C=30d</div>
        </div>

        <div
          className="row"
          style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}
        >
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

      {/* Filters */}
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

            <div className="subtle" style={{ textAlign: "right", minWidth: 120 }}>
              <div style={{ fontSize: 12 }}>Showing</div>
              <div style={{ fontWeight: 950, fontSize: 20, opacity: 0.95 }}>
                {totalShowing}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* MUST CONTACT */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h2">Must contact</h2>
        <span className="pill" style={{ opacity: 0.95 }}>
          {mustContact.length}
        </span>
      </div>

      <div style={{ height: 10 }} />

      {loading && (
        <div className="card">
          <div className="subtle">Loading...</div>
        </div>
      )}

      {!loading && mustContact.length === 0 && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>
            No hay cuentas pendientes ahora.
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
              variant="must"
              onOpen={() => router.push(`/accounts/${a.id}`)}
              onLog={() => openQuickLog(a)}
            />
          ))}
      </div>

      <div style={{ height: 18 }} />

      {/* ALL ACCOUNTS */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
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
              variant="default"
              onOpen={() => router.push(`/accounts/${a.id}`)}
              onLog={() => openQuickLog(a)}
            />
          ))}
      </div>

      {/* Quick Log Modal */}
      {qlAccount && (
        <QuickLogModal
          open={qlOpen}
          onClose={() => setQlOpen(false)}
          accountId={qlAccount.id}
          accountName={qlAccount.name}
          contacts={qlAccount.contacts}
          onSaved={loadAll}
        />
      )}
    </main>
  );
}