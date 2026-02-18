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
  // si nunca hubo interacción -> due
  if (d == null) return true;
  return d > limit;
}

function pickRecommendedContact(contacts: Contact[]) {
  // prioridad: last_touch_at null (never) primero,
  // si no, el que tenga más días desde el último toque.
  if (!contacts || contacts.length === 0) return null;

  const sorted = [...contacts].sort((a, b) => {
    const da = daysSince(a.last_touch_at);
    const db = daysSince(b.last_touch_at);

    // never primero
    const aNever = da == null;
    const bNever = db == null;
    if (aNever && !bNever) return -1;
    if (!aNever && bNever) return 1;

    // más viejo (más días) primero
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
      // si no hay sesión => login
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

  const filteredAccounts = useMemo(() => {
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
        return { a, accContacts, rec, cov, missing };
      });
  }, [accounts, contactsByAccount, q, tierFilter]);

  const mustContact = useMemo(() => {
    return filteredAccounts.filter(({ a }) => isAccountDue(a));
  }, [filteredAccounts]);

  const headerActions = (
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
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

  const cadenceText = "A=7d • B=14d • C=30d";

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Today</h1>
          <div className="subtle">Search, filter, then execute. {cadenceText}</div>
        </div>
        {headerActions}
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Search</div>
            <input
              className="field"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search accounts (name / country)"
            />
          </label>

          <button
            className="btn"
            onClick={() => setQ("")}
            style={{ height: 44, borderRadius: 16, alignSelf: "end" }}
          >
            Clear
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <div className="label" style={{ marginBottom: 6 }}>
              Tier
            </div>
            <div className="segmented">
              <button
                className={`seg ${tierFilter === "all" ? "active" : ""}`}
                onClick={() => setTierFilter("all")}
              >
                All
              </button>
              <button
                className={`seg ${tierFilter === "A" ? "active" : ""}`}
                onClick={() => setTierFilter("A")}
              >
                A
              </button>
              <button
                className={`seg ${tierFilter === "B" ? "active" : ""}`}
                onClick={() => setTierFilter("B")}
              >
                B
              </button>
              <button
                className={`seg ${tierFilter === "C" ? "active" : ""}`}
                onClick={() => setTierFilter("C")}
              >
                C
              </button>
            </div>
          </div>

          <div className="subtle" style={{ textAlign: "right" }}>
            <div>Showing</div>
            <div style={{ fontWeight: 900, fontSize: 20, opacity: 0.95 }}>
              {filteredAccounts.length} accounts
            </div>
          </div>
        </div>
      </div>

      {/* MUST CONTACT */}
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="h2">Must contact</h2>
        <div className="pill" style={{ opacity: 0.9 }}>
          {mustContact.length}
        </div>
      </div>

      <div style={{ height: 10 }} />

      {loading && (
        <div className="card">
          <div className="subtle">Loading...</div>
        </div>
      )}

      {!loading && mustContact.length === 0 && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>No accounts due soon.</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {!loading &&
          mustContact.map(({ a, accContacts, rec, missing }) => {
            const d = daysSince(a.last_interaction_at);
            const lastTouch = d == null ? "never" : d === 0 ? "today" : `${d}d`;
            const missingText =
              missing.length === 0 ? null : `Coverage gap: ${missing.join(", ")}`;

            const recDays = rec ? daysSince(rec.last_touch_at) : null;
            const recLast = !rec ? "—" : recDays == null ? "never" : recDays === 0 ? "today" : `${recDays}d`;

            return (
              <div className="card" key={a.id}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      {a.name}{" "}
                      <span style={{ fontWeight: 700, opacity: 0.7, fontSize: 14 }}>
                        {a.tier} • {a.country ?? "—"}
                      </span>{" "}
                      <span className="pill" style={{ marginLeft: 8 }}>
                        due
                      </span>
                    </div>

                    <div className="subtle" style={{ marginTop: 6 }}>
                      Value: {fmtMoney(a.value_usd)} • Last touch: {lastTouch}
                    </div>

                    <div style={{ height: 8 }} />

                    {missingText ? (
                      <div className="subtle" style={{ opacity: 0.9 }}>
                        {missingText}
                      </div>
                    ) : (
                      <div className="subtle">Coverage: ok</div>
                    )}

                    <div style={{ height: 10 }} />

                    {/* Recommended contact (Intimacy) */}
                    {accContacts.length === 0 ? (
                      <div style={{ fontSize: 13, opacity: 0.9 }}>
                        No contacts yet — add them inside the account.
                      </div>
                    ) : rec ? (
                      <div style={{ fontSize: 13, opacity: 0.95 }}>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>
                          {rec.name}{" "}
                          <span style={{ fontWeight: 700, opacity: 0.7, fontSize: 14 }}>
                            ({rec.area}) — {recLast}
                          </span>
                        </div>
                        <div className="subtle" style={{ marginTop: 4 }}>
                          Preferred: {rec.preferred_channel ?? "—"}
                          {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                        </div>
                      </div>
                    ) : (
                      <div className="subtle">No recommended contact.</div>
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
                      title={accContacts.length === 0 ? "Add a contact first" : "Quick log"}
                    >
                      Quick log
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
        <div className="pill" style={{ opacity: 0.9 }}>
          {filteredAccounts.length}
        </div>
      </div>

      <div style={{ height: 10 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {!loading &&
          filteredAccounts.map(({ a, accContacts, rec }) => {
            const d = daysSince(a.last_interaction_at);
            const lastTouch = d == null ? "never" : d === 0 ? "today" : `${d}d`;

            const due = isAccountDue(a);
            const badge = d == null ? "never" : due ? "due" : "ok";

            const recDays = rec ? daysSince(rec.last_touch_at) : null;
            const recLast = !rec ? "—" : recDays == null ? "never" : recDays === 0 ? "today" : `${recDays}d`;

            return (
              <div className="card" key={a.id}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 18 }}>
                      {a.name}{" "}
                      <span style={{ fontWeight: 700, opacity: 0.7, fontSize: 14 }}>
                        {a.tier} • {a.country ?? "—"}
                      </span>{" "}
                      <span className="pill" style={{ marginLeft: 8 }}>
                        {badge}
                      </span>
                    </div>

                    <div className="subtle" style={{ marginTop: 6 }}>
                      Last touch: {lastTouch}
                      {" • "}
                      Contacts: {accContacts.length}
                      {" • "}
                      Value: {fmtMoney(a.value_usd)}
                    </div>

                    {rec ? (
                      <div className="subtle" style={{ marginTop: 6 }}>
                        Recommended: <span style={{ opacity: 0.95 }}>{rec.name}</span> ({rec.area}) —{" "}
                        {recLast} • {rec.preferred_channel ?? "—"}
                        {rec.personal_hook ? ` • Hook: ${rec.personal_hook}` : ""}
                      </div>
                    ) : (
                      <div className="subtle" style={{ marginTop: 6 }}>
                        Recommended: — (add contacts)
                      </div>
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
                      title={accContacts.length === 0 ? "Add a contact first" : "Quick log"}
                    >
                      Quick log
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