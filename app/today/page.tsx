"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

type Account = {
  id: string;
  name: string;
  tier: "A" | "B" | "C";
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
  created_at: string;
};

type Contact = {
  id: string;
  account_id: string;
  name: string;
  area: "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors" | null;
  preferred_channel: "call" | "whatsapp" | "email" | null;
  personal_hook: string | null;
};

type Interaction = {
  id: string;
  account_id: string;
  contact_id: string | null;
  created_at: string;
};

function daysSince(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

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

const cadenceByTier: Record<Account["tier"], number> = { A: 7, B: 14, C: 30 };

const areaWeight: Record<string, number> = {
  Directors: 5,
  "R&D": 4,
  Procurement: 3,
  Commercial: 3,
  Marketing: 2,
};

const tierWeight: Record<Account["tier"], number> = { A: 3, B: 2, C: 1 };

export default function TodayPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | "A" | "B" | "C">("all");

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
  }

  async function load() {
    setMsg(null);
    setLoading(true);
    try {
      await requireUser();

      const { data: acc, error: accErr } = await supabase
        .from("accounts")
        .select("id,name,tier,country,value_usd,last_interaction_at,created_at")
        .order("value_usd", { ascending: false, nullsFirst: false });

      if (accErr) throw accErr;
      const accs = (acc ?? []) as Account[];
      setAccounts(accs);

      const accIds = accs.map((a) => a.id);
      if (accIds.length === 0) {
        setContacts([]);
        setInteractions([]);
        return;
      }

      const { data: cons, error: conErr } = await supabase
        .from("contacts")
        .select("id,account_id,name,area,preferred_channel,personal_hook")
        .in("account_id", accIds);

      if (conErr) throw conErr;
      setContacts((cons ?? []) as Contact[]);

      const { data: ints, error: intErr } = await supabase
        .from("interactions")
        .select("id,account_id,contact_id,created_at")
        .in("account_id", accIds)
        .order("created_at", { ascending: false })
        .limit(500);

      if (intErr) throw intErr;
      setInteractions((ints ?? []) as Interaction[]);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not load");
      if ((e?.message ?? "").toLowerCase().includes("not signed")) {
        router.push("/login");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const headerActions = (
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
      <button className="btn" onClick={() => router.push("/accounts")}>
        Accounts
      </button>
      <button className="btn" onClick={() => router.push("/weekly")}>
        Weekly Pack
      </button>
      <button className="btn" onClick={load} disabled={loading}>
        Refresh
      </button>
      <button className="btn btnPrimary" onClick={signOut}>
        Sign out
      </button>
    </div>
  );

  // Build maps
  const contactsByAccount = useMemo(() => {
    const m = new Map<string, Contact[]>();
    for (const c of contacts) {
      const arr = m.get(c.account_id) ?? [];
      arr.push(c);
      m.set(c.account_id, arr);
    }
    return m;
  }, [contacts]);

  const lastTouchByContact = useMemo(() => {
    const m = new Map<string, string>(); // contact_id -> latest created_at
    for (const i of interactions) {
      if (!i.contact_id) continue;
      if (!m.has(i.contact_id)) m.set(i.contact_id, i.created_at);
    }
    return m;
  }, [interactions]);

  function recommendedContact(a: Account): { contact: Contact | null; why: string } {
    const list = contactsByAccount.get(a.id) ?? [];
    if (list.length === 0) return { contact: null, why: "No contacts yet" };

    let best: Contact | null = null;
    let bestScore = -Infinity;

    for (const c of list) {
      const lastIso = c.id ? (lastTouchByContact.get(c.id) ?? null) : null;
      const d = daysSince(lastIso); // null means never

      const daysComponent = d == null ? 60 : Math.min(d, 60); // cap
      const areaComponent = areaWeight[c.area ?? ""] ?? 2;
      const tierComponent = tierWeight[a.tier] ?? 1;

      // Bonus si la cuenta está "due" por cadence
      const acctDays = daysSince(a.last_interaction_at);
      const cadence = cadenceByTier[a.tier];
      const dueBonus =
        acctDays == null ? 2 : acctDays >= cadence ? 2 : acctDays >= cadence - 2 ? 1 : 0;

      // Score combinado (simple y robusto)
      const score =
        daysComponent * 1.0 + areaComponent * 4.0 + tierComponent * 3.0 + dueBonus * 5.0;

      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }

    // Explain briefly
    const lastIso = best?.id ? (lastTouchByContact.get(best.id) ?? null) : null;
    const d = daysSince(lastIso);
    const lastTxt = d == null ? "never" : d === 0 ? "today" : `${d}d`;
    const why = `${best?.area ?? "—"} • preferred: ${best?.preferred_channel ?? "—"} • last: ${lastTxt}`;

    return { contact: best, why };
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (tierFilter !== "all" && a.tier !== tierFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) || (a.country ?? "").toLowerCase().includes(q)
      );
    });
  }, [accounts, search, tierFilter]);

  const dueSoon = useMemo(() => {
    return filtered.filter((a) => {
      const d = daysSince(a.last_interaction_at);
      const cadence = cadenceByTier[a.tier];
      if (d == null) return true; // never = due
      return d >= cadence;
    });
  }, [filtered]);

  const all = useMemo(() => filtered, [filtered]);

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Today</h1>
          <div className="subtle">Search, filter, then execute. A=7d • B=14d • C=30d</div>
        </div>
        {headerActions}
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
        </div>
      )}

      <div className="card">
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr auto" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Search</div>
            <input
              className="field"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search accounts (name / country)"
            />
          </label>

          <button
            className="btn"
            onClick={() => setSearch("")}
            style={{ height: 44, borderRadius: 16 }}
          >
            Clear
          </button>
        </div>

        <div style={{ height: 10 }} />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginRight: 6 }}>Tier</div>
          {(["all", "A", "B", "C"] as const).map((t) => (
            <button
              key={t}
              className="btn"
              onClick={() => setTierFilter(t)}
              style={{
                height: 38,
                borderRadius: 14,
                opacity: tierFilter === t ? 1 : 0.8,
              }}
            >
              {t === "all" ? "All" : t}
            </button>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 12, opacity: 0.7 }}>
            Showing <b>{filtered.length}</b> accounts
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {loading && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>Loading...</div>
        </div>
      )}

      {!loading && (
        <>
          <div
            className="row"
            style={{ justifyContent: "space-between", margin: "8px 0" }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>Must contact</div>
            <div className="pill">{dueSoon.length}</div>
          </div>

          {dueSoon.length === 0 ? (
            <div className="card">
              <div style={{ fontSize: 13, opacity: 0.85 }}>No accounts due soon.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {dueSoon.map((a) => {
                const acctDays = daysSince(a.last_interaction_at);
                const lastTouch =
                  acctDays == null ? "never" : acctDays === 0 ? "today" : `${acctDays}d`;

                const rec = recommendedContact(a);

                return (
                  <div key={a.id} className="card">
                    <div
                      className="row"
                      style={{ justifyContent: "space-between", gap: 12 }}
                    >
                      <div>
                        <div style={{ fontWeight: 900, fontSize: 18 }}>
                          {a.name}{" "}
                          <span style={{ fontWeight: 700, opacity: 0.7, fontSize: 14 }}>
                            {a.tier} • {a.country ?? "—"}
                          </span>{" "}
                          <span className="pill" style={{ marginLeft: 8 }}>
                            due
                          </span>
                        </div>

                        <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                          Value: {fmtMoney(a.value_usd)} • Last touch: {lastTouch}
                        </div>

                        <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                          <div style={{ opacity: 0.7, fontSize: 12 }}>
                            Recommended contact
                          </div>
                          {rec.contact ? (
                            <>
                              <div
                                style={{ fontWeight: 900, fontSize: 16, marginTop: 4 }}
                              >
                                {rec.contact.name}{" "}
                                <span
                                  style={{ fontWeight: 700, opacity: 0.7, fontSize: 13 }}
                                >
                                  ({rec.contact.area ?? "—"})
                                </span>
                              </div>
                              <div style={{ marginTop: 4, opacity: 0.8 }}>
                                {rec.why}
                                {rec.contact.personal_hook ? (
                                  <> • hook: {rec.contact.personal_hook}</>
                                ) : null}
                              </div>
                            </>
                          ) : (
                            <div style={{ marginTop: 4, opacity: 0.8 }}>
                              No contacts yet — add them inside the account.
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="row" style={{ gap: 10, alignItems: "center" }}>
                        <button
                          className="btn"
                          onClick={() => router.push(`/accounts/${a.id}`)}
                          style={{ height: 40, borderRadius: 14 }}
                        >
                          Open
                        </button>
                        <button
                          className="btn btnPrimary"
                          onClick={() => router.push(`/accounts/${a.id}`)}
                          style={{ height: 40, borderRadius: 14 }}
                        >
                          Quick log
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ height: 16 }} />

          <div
            className="row"
            style={{ justifyContent: "space-between", margin: "8px 0" }}
          >
            <div style={{ fontWeight: 900, fontSize: 16 }}>All accounts</div>
            <div className="pill">{all.length}</div>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {all.map((a) => {
              const acctDays = daysSince(a.last_interaction_at);
              const cadence = cadenceByTier[a.tier];
              const status =
                acctDays == null ? "never" : acctDays >= cadence ? "due" : "ok";

              const rec = recommendedContact(a);

              return (
                <div key={a.id} className="card">
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", gap: 12 }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18 }}>
                        {a.name}{" "}
                        <span style={{ fontWeight: 700, opacity: 0.7, fontSize: 14 }}>
                          {a.tier} • {a.country ?? "—"}
                        </span>{" "}
                        <span className="pill" style={{ marginLeft: 8 }}>
                          {status}
                        </span>
                      </div>

                      <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                        Value: {fmtMoney(a.value_usd)} • Last touch:{" "}
                        {acctDays == null ? "never" : `${acctDays}d`} • within {cadence}d
                      </div>

                      <div style={{ marginTop: 10, fontSize: 13, opacity: 0.9 }}>
                        <div style={{ opacity: 0.7, fontSize: 12 }}>
                          Recommended contact
                        </div>
                        {rec.contact ? (
                          <div style={{ marginTop: 4, fontWeight: 900 }}>
                            {rec.contact.name}{" "}
                            <span style={{ fontWeight: 700, opacity: 0.7 }}>
                              ({rec.contact.area ?? "—"}) •{" "}
                              {rec.contact.preferred_channel ?? "—"}
                            </span>
                          </div>
                        ) : (
                          <div style={{ marginTop: 4, opacity: 0.8 }}>
                            No contacts yet.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="row" style={{ gap: 10, alignItems: "center" }}>
                      <button
                        className="btn"
                        onClick={() => router.push(`/accounts/${a.id}`)}
                        style={{ height: 40, borderRadius: 14 }}
                      >
                        Open
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
