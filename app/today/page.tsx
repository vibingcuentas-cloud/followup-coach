"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import QuickLogModal from "../../components/QuickLogModal";
import { ScorePill, CoverageChips } from "../../components/IntimacyWidgets";
import {
  AREAS,
  daysSince,
  fmtMoney,
  fmtLastTouch,
  channelLabel,
  coverageByArea,
  computeIntimacyScore,
  pickRecommendedContact,
  isAccountDue,
  type Tier,
  type Area,
  type Channel,
} from "../../lib/intimacy";

export const dynamic = "force-dynamic";

type Account = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
  created_at: string;
};

type Contact = {
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

export default function TodayPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // Filtros
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");

  // Quick log modal
  const [qlOpen, setQlOpen] = useState(false);
  const [qlAccount, setQlAccount] = useState<Account | null>(null);

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
  }

  async function loadAll() {
    setMsg(null);
    setLoading(true);
    try {
      await requireUser();

      const { data: acc, error: accErr } = await supabase
        .from("accounts")
        .select("id,name,tier,country,value_usd,last_interaction_at,created_at")
        .order("value_usd", { ascending: false, nullsFirst: false });

      if (accErr) throw accErr;

      const accList = (acc ?? []) as Account[];
      setAccounts(accList);

      if (accList.length === 0) {
        setContacts([]);
        return;
      }

      const ids = accList.map((a) => a.id);

      const { data: cts, error: cErr } = await supabase
        .from("contacts")
        .select("id,account_id,name,email,area,preferred_channel,personal_hook,last_touch_at,created_at")
        .in("account_id", ids);

      if (cErr) throw cErr;

      setContacts((cts ?? []) as Contact[]);
    } catch (e: any) {
      const m = e?.message ?? "Could not load";
      if (String(m).toLowerCase().includes("not signed")) {
        router.push("/login");
        return;
      }
      setMsg(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const contactsByAccount = useMemo(() => {
    const map = new Map<string, Contact[]>();
    for (const c of contacts) {
      if (!map.has(c.account_id)) map.set(c.account_id, []);
      map.get(c.account_id)!.push(c);
    }
    return map;
  }, [contacts]);

  const enriched = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return accounts
      .filter((a) => {
        if (tierFilter !== "all" && a.tier !== tierFilter) return false;
        if (!qq) return true;
        return (
          a.name.toLowerCase().includes(qq) ||
          (a.country ?? "").toLowerCase().includes(qq)
        );
      })
      .map((a) => {
        const accContacts = contactsByAccount.get(a.id) ?? [];
        const rec = pickRecommendedContact(accContacts);
        const cov = coverageByArea(accContacts);
        const missing = AREAS.filter((ar) => (cov[ar] ?? 0) === 0);
        const s = computeIntimacyScore(a, accContacts);
        const lastTouch = fmtLastTouch(daysSince(a.last_interaction_at));
        const recLast = rec ? fmtLastTouch(daysSince(rec.last_touch_at)) : "—";

        return { a, accContacts, rec, cov, missing, s, lastTouch, recLast };
      });
  }, [accounts, contactsByAccount, q, tierFilter]);

  const mustContact = useMemo(() => {
    return enriched
      .filter(({ a }) => isAccountDue(a))
      .sort((x, y) => {
        if (x.s.total !== y.s.total) return x.s.total - y.s.total;
        return x.s.coverage - y.s.coverage;
      });
  }, [enriched]);

  const allSorted = useMemo(() => {
    return [...enriched].sort((x, y) => x.s.total - y.s.total);
  }, [enriched]);

  function openQuickLog(acc: Account) {
    setQlAccount(acc);
    setQlOpen(true);
  }

  const qlContacts = useMemo(() => {
    if (!qlAccount) return [];
    return contactsByAccount.get(qlAccount.id) ?? [];
  }, [qlAccount, contactsByAccount]);

  const cadenceText = "A=7d • B=14d • C=30d";

  const headerActions = (
    <div className="row" style={{ gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
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
  );

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Today</h1>
          <div className="subtle">Intimacy cockpit • {cadenceText}</div>
        </div>
        {headerActions}
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
        </div>
      )}

      {/* Filtros */}
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="label" style={{ marginBottom: 6 }}>Search</div>
            <input
              className="field"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Account name or country"
            />
          </div>

          <div style={{ minWidth: 220 }}>
            <div className="label" style={{ marginBottom: 6 }}>Tier</div>
            <div className="segmented">
              <button className={`seg ${tierFilter === "all" ? "active" : ""}`} onClick={() => setTierFilter("all")}>All</button>
              <button className={`seg ${tierFilter === "A" ? "active" : ""}`} onClick={() => setTierFilter("A")}>A</button>
              <button className={`seg ${tierFilter === "B" ? "active" : ""}`} onClick={() => setTierFilter("B")}>B</button>
              <button className={`seg ${tierFilter === "C" ? "active" : ""}`} onClick={() => setTierFilter("C")}>C</button>
            </div>
          </div>

          <div className="row" style={{ gap: 10, alignItems: "flex-end" }}>
            <button className="btn" onClick={() => setQ("")} style={{ height: 44, borderRadius: 16 }}>
              Clear
            </button>
            <div className="subtle" style={{ textAlign: "right", minWidth: 120 }}>
              <div style={{ fontSize: 12 }}>Showing</div>
              <div style={{ fontWeight: 950, fontSize: 20, opacity: 0.95 }}>{enriched.length}</div>
            </div>
          </div>
        </div>
      </div>

      {/* MUST CONTACT */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h2">Must contact</h2>
        <span className="pill" style={{ opacity: 0.95 }}>{mustContact.length}</span>
      </div>

      <div style={{ height: 10 }} />

      {loading && (
        <div className="card">
          <div className="subtle">Loading...</div>
        </div>
      )}

      {!loading && mustContact.length === 0 && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>No accounts due right now.</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 14 }}>
        {!loading &&
          mustContact.map(({ a, accContacts, rec, cov, missing, s, lastTouch, recLast }) => {
            const missingText = missing.length === 0 ? null : `Missing: ${missing.join(", ")}`;

            return (
              <div className="card" key={a.id} style={{ padding: 16 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <div style={{ fontWeight: 950, fontSize: 18, letterSpacing: -0.2 }}>{a.name}</div>
                      <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
                        {a.tier} • {a.country ?? "—"} • {lastTouch}
                      </span>
                      <ScorePill total={s.total} label={s.label} tone={s.tone} />
                    </div>

                    <div className="subtle" style={{ marginTop: 8 }}>
                      Recency: {s.recency}/60 • Coverage: {s.coverage}/40 • Value: {fmtMoney(a.value_usd)}
                      {missingText ? ` • ${missingText}` : ""}
                    </div>

                    <div style={{ height: 10 }} />
                    <CoverageChips counts={cov} />
                    <div style={{ height: 12 }} />

                    {accContacts.length === 0 ? (
                      <div className="subtle">Sin contactos — agrégalos dentro de la cuenta.</div>
                    ) : rec ? (
                      <div
                        className="card"
                        style={{
                          padding: 12,
                          background: "rgba(255,255,255,0.04)",
                          borderColor: "rgba(255,255,255,0.10)",
                        }}
                      >
                        <div className="subtle" style={{ fontSize: 12, letterSpacing: 0.2 }}>
                          RECOMMENDED NEXT TOUCH
                        </div>
                        <div style={{ marginTop: 6, fontWeight: 950, fontSize: 18, letterSpacing: -0.2 }}>
                          {rec.name}{" "}
                          <span style={{ fontWeight: 800, opacity: 0.7, fontSize: 13 }}>
                            • {rec.area} • {recLast}
                          </span>
                        </div>
                        <div className="subtle" style={{ marginTop: 4 }}>
                          Preferred: {channelLabel(rec.preferred_channel)}
                          {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="subtle">Sin contacto recomendado.</div>
                    )}
                  </div>

                  <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button
                      className="btn"
                      onClick={() => router.push(`/accounts/${a.id}`)}
                      style={{ height: 40, borderRadius: 14 }}
                    >
                      Open
                    </button>
                    <button
                      className="btn btnPrimary"
                      onClick={() => openQuickLog(a)}
                      style={{ height: 40, borderRadius: 14 }}
                      disabled={accContacts.length === 0}
                      title={accContacts.length === 0 ? "Add a contact first" : "Log interaction"}
                    >
                      Log
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      <div style={{ height: 18 }} />

      {/* ALL ACCOUNTS */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h2">All accounts</h2>
        <span className="pill" style={{ opacity: 0.95 }}>{allSorted.length}</span>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {!loading &&
          allSorted.map(({ a, accContacts, rec, s, lastTouch, recLast }) => (
            <div className="card" key={a.id} style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ fontWeight: 950, fontSize: 16, letterSpacing: -0.2 }}>{a.name}</div>
                    <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
                      {a.tier} • {a.country ?? "—"} • {lastTouch}
                    </span>
                    <ScorePill total={s.total} label={s.label} tone={s.tone} />
                  </div>

                  <div className="subtle" style={{ marginTop: 6 }}>
                    Contacts: {accContacts.length} • Value: {fmtMoney(a.value_usd)} • Recency {s.recency}/60 • Coverage {s.coverage}/40
                  </div>

                  <div className="subtle" style={{ marginTop: 6 }}>
                    Recommended:{" "}
                    {rec ? (
                      <>
                        <span style={{ opacity: 0.95, fontWeight: 800 }}>{rec.name}</span>{" "}
                        ({rec.area}) • {recLast} • {channelLabel(rec.preferred_channel)}
                        {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                      </>
                    ) : (
                      "— (add contacts)"
                    )}
                  </div>
                </div>

                <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    className="btn"
                    onClick={() => router.push(`/accounts/${a.id}`)}
                    style={{ height: 40, borderRadius: 14 }}
                  >
                    Open
                  </button>
                  <button
                    className="btn btnPrimary"
                    onClick={() => openQuickLog(a)}
                    style={{ height: 40, borderRadius: 14 }}
                    disabled={accContacts.length === 0}
                    title={accContacts.length === 0 ? "Add a contact first" : "Log interaction"}
                  >
                    Log
                  </button>
                </div>
              </div>
            </div>
          ))}
      </div>

      {/* Quick Log Modal */}
      {qlAccount && (
        <QuickLogModal
          open={qlOpen}
          onClose={() => setQlOpen(false)}
          accountId={qlAccount.id}
          accountName={qlAccount.name}
          contacts={qlContacts}
          onSaved={loadAll}
        />
      )}
    </main>
  );
}