"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import QuickLogModal from "../../components/QuickLogModal";

export const dynamic = "force-dynamic";

type Tier = "A" | "B" | "C";
type Channel = "call" | "whatsapp" | "email";
type Area = "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors";

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

const AREAS: Area[] = ["Marketing", "R&D", "Procurement", "Commercial", "Directors"];

function fmtMoney(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n}`;
  }
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

function cadenceDays(tier: Tier) {
  if (tier === "A") return 7;
  if (tier === "B") return 14;
  return 30;
}

function isAccountDue(a: Account) {
  const d = daysSince(a.last_interaction_at);
  const limit = cadenceDays(a.tier);
  if (d == null) return true;
  return d > limit;
}

function pickRecommendedContact(contacts: Contact[]) {
  if (!contacts || contacts.length === 0) return null;

  const sorted = [...contacts].sort((a, b) => {
    const da = daysSince(a.last_touch_at);
    const db = daysSince(b.last_touch_at);

    const aNever = da == null;
    const bNever = db == null;
    if (aNever && !bNever) return -1;
    if (!aNever && bNever) return 1;

    const va = da ?? -1;
    const vb = db ?? -1;
    return vb - va;
  });

  return sorted[0];
}

function coverageByArea(contacts: Contact[]) {
  const map: Record<Area, number> = {
    Marketing: 0,
    "R&D": 0,
    Procurement: 0,
    Commercial: 0,
    Directors: 0,
  };
  for (const c of contacts ?? []) {
    if (map[c.area] != null) map[c.area] += 1;
  }
  return map;
}

function scoreLabel(score: number) {
  if (score >= 80) return "Strong";
  if (score >= 55) return "Ok";
  return "Risk";
}

function scoreTone(score: number) {
  if (score >= 80) return "good";
  if (score >= 55) return "neutral";
  return "warn";
}

function computeIntimacyScore(a: Account, cov: Record<Area, number>) {
  const limit = cadenceDays(a.tier);
  const d = daysSince(a.last_interaction_at);

  // Recency 0–60
  let recency = 0;
  if (d != null) {
    if (d <= limit) recency = 60;
    else recency = Math.max(0, 60 - (d - limit) * 5);
  }

  // Coverage 0–40
  const covered = AREAS.reduce((acc, ar) => acc + ((cov[ar] ?? 0) > 0 ? 1 : 0), 0);
  const coverage = Math.round((covered / AREAS.length) * 40);

  const total = Math.max(0, Math.min(100, Math.round(recency + coverage)));

  return {
    total,
    recency: Math.round(recency),
    coverage,
    coveredAreas: covered,
    label: scoreLabel(total),
    tone: scoreTone(total) as "good" | "neutral" | "warn",
  };
}

function channelLabel(ch: Channel | null) {
  if (!ch) return "—";
  if (ch === "call") return "call";
  if (ch === "whatsapp") return "whatsapp";
  return "email";
}

function areaShort(a: Area) {
  if (a === "Marketing") return "Mkt";
  if (a === "R&D") return "R&D";
  if (a === "Procurement") return "Proc";
  if (a === "Commercial") return "Comm";
  return "Dir";
}

export default function TodayPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");

  // quick log modal
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
        .select(
          "id,account_id,name,email,area,preferred_channel,personal_hook,last_touch_at,created_at"
        )
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

        const s = computeIntimacyScore(a, cov);

        const d = daysSince(a.last_interaction_at);
        const lastTouch = d == null ? "never" : d === 0 ? "today" : `${d}d`;

        const recDays = rec ? daysSince(rec.last_touch_at) : null;
        const recLast =
          !rec ? "—" : recDays == null ? "never" : recDays === 0 ? "today" : `${recDays}d`;

        return { a, accContacts, rec, cov, missing, s, lastTouch, recLast };
      });
  }, [accounts, contactsByAccount, q, tierFilter]);

  const mustContact = useMemo(() => {
    // Ordenamos por score ASC (más crítico primero). Tie-break: menos coverage.
    return enriched
      .filter(({ a }) => isAccountDue(a))
      .sort((x, y) => {
        if (x.s.total !== y.s.total) return x.s.total - y.s.total;
        return x.s.coverage - y.s.coverage;
      });
  }, [enriched]);

  const allSorted = useMemo(() => {
    // En all accounts: score ASC (para priorizar) o puedes cambiar a DESC si prefieres “mejor arriba”.
    return [...enriched].sort((x, y) => x.s.total - y.s.total);
  }, [enriched]);

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

  function openQuickLog(acc: Account) {
    setQlAccount(acc);
    setQlOpen(true);
  }

  const qlContacts = useMemo(() => {
    if (!qlAccount) return [];
    return contactsByAccount.get(qlAccount.id) ?? [];
  }, [qlAccount, contactsByAccount]);

  function ScorePill({ total, label, tone }: { total: number; label: string; tone: "good" | "neutral" | "warn" }) {
    const styles =
      tone === "good"
        ? { borderColor: "rgba(80,220,160,0.35)", background: "rgba(80,220,160,0.08)" }
        : tone === "warn"
        ? { borderColor: "rgba(255,120,120,0.35)", background: "rgba(255,120,120,0.08)" }
        : { borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)" };

    return (
      <span className="pill" style={{ ...styles, opacity: 0.95 }}>
        {total} {label}
      </span>
    );
  }

  function CoverageChips({ cov }: { cov: Record<Area, number> }) {
    return (
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        {AREAS.map((ar) => {
          const n = cov[ar] ?? 0;
          const ok = n > 0;
          return (
            <span
              key={ar}
              className="pill"
              style={{
                opacity: 0.95,
                borderColor: ok ? "rgba(80,220,160,0.35)" : "rgba(255,120,120,0.35)",
                background: ok ? "rgba(80,220,160,0.08)" : "rgba(255,120,120,0.08)",
                color: "rgba(255,255,255,0.92)",
              }}
              title={ok ? `${ar}: ${n}` : `${ar}: missing`}
            >
              {areaShort(ar)} {n}
            </span>
          );
        })}
      </div>
    );
  }

  const cadenceText = "A=7d • B=14d • C=30d";

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

      {/* Filters */}
      <div className="card" style={{ marginBottom: 14, padding: 14 }}>
        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              Search
            </div>
            <input
              className="field"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Account name or country"
            />
          </div>

          <div style={{ minWidth: 220 }}>
            <div className="label" style={{ marginBottom: 6 }}>
              Tier
            </div>
            <div className="segmented">
              <button className={`seg ${tierFilter === "all" ? "active" : ""}`} onClick={() => setTierFilter("all")}>
                All
              </button>
              <button className={`seg ${tierFilter === "A" ? "active" : ""}`} onClick={() => setTierFilter("A")}>
                A
              </button>
              <button className={`seg ${tierFilter === "B" ? "active" : ""}`} onClick={() => setTierFilter("B")}>
                B
              </button>
              <button className={`seg ${tierFilter === "C" ? "active" : ""}`} onClick={() => setTierFilter("C")}>
                C
              </button>
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
                    <CoverageChips cov={cov} />
                    <div style={{ height: 12 }} />

                    {accContacts.length === 0 ? (
                      <div className="subtle">No contacts yet — add them inside the account.</div>
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
                      <div className="subtle">No recommended contact.</div>
                    )}
                  </div>

                  <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => router.push(`/accounts/${a.id}`)} style={{ height: 40, borderRadius: 14 }}>
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
        <span className="pill" style={{ opacity: 0.95 }}>
          {allSorted.length}
        </span>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {!loading &&
          allSorted.map(({ a, accContacts, rec, s, lastTouch, recLast }) => {
            return (
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
                          <span style={{ opacity: 0.95, fontWeight: 800 }}>{rec.name}</span> ({rec.area}) • {recLast} •{" "}
                          {channelLabel(rec.preferred_channel)}
                          {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                        </>
                      ) : (
                        "— (add contacts)"
                      )}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn" onClick={() => router.push(`/accounts/${a.id}`)} style={{ height: 40, borderRadius: 14 }}>
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