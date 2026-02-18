"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToday, type EnrichedAccount } from "../../hooks/useToday";
import QuickLogModal from "../../components/QuickLogModal";
import { ScorePill, CoverageChips } from "../../components/IntimacyWidgets";
import { fmtMoney, channelLabel } from "../../lib/intimacy";

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
        <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => router.push("/accounts")}>Accounts</button>
          <button className="btn" onClick={() => router.push("/weekly")}>Weekly Pack</button>
          <button className="btn" onClick={loadAll} disabled={loading}>Refresh</button>
          <button className="btn btnPrimary" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{error}</div>
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="label" style={{ marginBottom: 6 }}>Search</div>
            <input
              className="field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Account name or country"
            />
          </div>

          <div style={{ minWidth: 220 }}>
            <div className="label" style={{ marginBottom: 6 }}>Tier</div>
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
            <button className="btn" onClick={() => setSearch("")} style={{ height: 44, borderRadius: 16 }}>
              Clear
            </button>
            <div className="subtle" style={{ textAlign: "right", minWidth: 120 }}>
              <div style={{ fontSize: 12 }}>Showing</div>
              <div style={{ fontWeight: 950, fontSize: 20, opacity: 0.95 }}>{totalShowing}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Must contact */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h2">Must contact</h2>
        <span className="pill" style={{ opacity: 0.95 }}>{mustContact.length}</span>
      </div>

      <div style={{ height: 10 }} />

      {loading && <div className="card"><div className="subtle">Loading...</div></div>}

      {!loading && mustContact.length === 0 && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>No hay cuentas pendientes ahora.</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {!loading && mustContact.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            showMissingAreas
            onOpen={() => router.push(`/accounts/${a.id}`)}
            onLog={() => openQuickLog(a)}
          />
        ))}
      </div>

      <div style={{ height: 18 }} />

      {/* All accounts */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h2">All accounts</h2>
        <span className="pill" style={{ opacity: 0.95 }}>{allSorted.length}</span>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {!loading && allSorted.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            showMissingAreas={false}
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
          contacts={qlAccount.contacts}
          onSaved={loadAll}
        />
      )}
    </main>
  );
}

// ─── Sub-componente: tarjeta de cuenta ────────────────────────────────────────
// Extraído para que TodayPage sea más legible.

function AccountCard({
  account: a,
  showMissingAreas,
  onOpen,
  onLog,
}: {
  account: EnrichedAccount;
  showMissingAreas: boolean;
  onOpen: () => void;
  onLog: () => void;
}) {
  const rec = a.recommendedContact;
  const missingText =
    showMissingAreas && a.missingAreas.length > 0
      ? `Missing: ${a.missingAreas.join(", ")}`
      : null;

  return (
    <div className="card" style={{ padding: showMissingAreas ? 16 : 14 }}>
      <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          {/* Nombre + score */}
          <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: 950, fontSize: showMissingAreas ? 18 : 16, letterSpacing: -0.2 }}>
              {a.name}
            </div>
            <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
              {a.tier} • {a.country ?? "—"} • {a.lastTouch}
            </span>
            <ScorePill total={a.score.total} label={a.score.label} tone={a.score.tone} />
          </div>

          {/* Stats */}
          <div className="subtle" style={{ marginTop: showMissingAreas ? 8 : 6 }}>
            {showMissingAreas
              ? `Recency: ${a.score.recency}/60 • Coverage: ${a.score.coverage}/40 • Value: ${a.valueFormatted}${missingText ? ` • ${missingText}` : ""}`
              : `Contacts: ${a.contacts.length} • Value: ${a.valueFormatted} • Recency ${a.score.recency}/60 • Coverage ${a.score.coverage}/40`
            }
          </div>

          {/* Coverage chips — solo en "must contact" */}
          {showMissingAreas && (
            <>
              <div style={{ height: 10 }} />
              <CoverageChips counts={a.coverageCounts} />
              <div style={{ height: 12 }} />
            </>
          )}

          {/* Contacto recomendado */}
          {showMissingAreas && (
            a.contacts.length === 0 ? (
              <div className="subtle">Sin contactos — agrégalos dentro de la cuenta.</div>
            ) : rec ? (
              <div
                className="card"
                style={{ padding: 12, background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)" }}
              >
                <div className="subtle" style={{ fontSize: 12, letterSpacing: 0.2 }}>
                  RECOMMENDED NEXT TOUCH
                </div>
                <div style={{ marginTop: 6, fontWeight: 950, fontSize: 18, letterSpacing: -0.2 }}>
                  {rec.name}{" "}
                  <span style={{ fontWeight: 800, opacity: 0.7, fontSize: 13 }}>
                    • {rec.area} • {a.recommendedLastTouch}
                  </span>
                </div>
                <div className="subtle" style={{ marginTop: 4 }}>
                  Preferred: {channelLabel(rec.preferred_channel)}
                  {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                </div>
              </div>
            ) : (
              <div className="subtle">Sin contacto recomendado.</div>
            )
          )}

          {/* Recomendado en modo compacto (all accounts) */}
          {!showMissingAreas && (
            <div className="subtle" style={{ marginTop: 6 }}>
              Recommended:{" "}
              {rec ? (
                <>
                  <span style={{ opacity: 0.95, fontWeight: 800 }}>{rec.name}</span>{" "}
                  ({rec.area}) • {a.recommendedLastTouch} • {channelLabel(rec.preferred_channel)}
                  {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                </>
              ) : (
                "— (add contacts)"
              )}
            </div>
          )}
        </div>

        {/* Acciones */}
        <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn" onClick={onOpen} style={{ height: 40, borderRadius: 14 }}>
            Open
          </button>
          <button
            className="btn btnPrimary"
            onClick={onLog}
            style={{ height: 40, borderRadius: 14 }}
            disabled={a.contacts.length === 0}
            title={a.contacts.length === 0 ? "Add a contact first" : "Log interaction"}
          >
            Log
          </button>
        </div>
      </div>
    </div>
  );
}