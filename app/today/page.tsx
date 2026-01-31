"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";
import QuickLogModal from "../../components/QuickLogModal";

type Tier = "A" | "B" | "C";

type Account = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  last_interaction_at: string | null;
};

type Contact = {
  id: string;
  account_id: string;
  name: string;
  area: string;
  preferred_channel: string | null;
};

type Interaction = {
  id: string;
  account_id: string;
  contact_id: string | null;
  created_at: string;
};

function daysSince(iso: string | null) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TodayPage() {
  const router = useRouter();
  const tierDays = useMemo(() => ({ A: 7, B: 14, C: 30 } as const), []);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  // UX filters
  const [q, setQ] = useState("");
  const [tierFilter, setTierFilter] = useState<"ALL" | Tier>("ALL");

  // Quick log modal
  const [open, setOpen] = useState(false);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedAccountName, setSelectedAccountName] = useState("");

  async function requireAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/login");
      return null;
    }
    return data.user;
  }

  async function loadAll() {
    const user = await requireAuth();
    if (!user) return;

    setLoading(true);
    setMsg(null);

    try {
      const { data: acc, error: accErr } = await supabase
        .from("accounts")
        .select("id,name,tier,country,last_interaction_at")
        .order("created_at", { ascending: false });

      if (accErr) throw accErr;

      const { data: cons, error: conErr } = await supabase
        .from("contacts")
        .select("id,account_id,name,area,preferred_channel");

      if (conErr) throw conErr;

      const since = new Date();
      since.setDate(since.getDate() - 180);

      const { data: ints, error: intErr } = await supabase
        .from("interactions")
        .select("id,account_id,contact_id,created_at")
        .gte("created_at", since.toISOString());

      if (intErr) throw intErr;

      setAccounts((acc as Account[]) ?? []);
      setContacts((cons as Contact[]) ?? []);
      setInteractions((ints as Interaction[]) ?? []);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not load data");
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

  function openQuickLog(a: Account) {
    setSelectedAccountId(a.id);
    setSelectedAccountName(a.name);
    setOpen(true);
  }

  function statusFor(a: Account) {
    const d = daysSince(a.last_interaction_at);
    const sla = tierDays[a.tier];

    if (d === null) return { code: "never", label: "Never", detail: "No touch yet", days: d, sla };
    if (d > sla) return { code: "overdue", label: "Overdue", detail: `${d - sla}d over`, days: d, sla };
    if (d >= Math.max(0, sla - 3))
      return { code: "due", label: "Due soon", detail: `within ${sla}d`, days: d, sla };
    return { code: "ok", label: "OK", detail: `within ${sla}d`, days: d, sla };
  }

  function badgeText(code: string) {
    if (code === "overdue") return "overdue";
    if (code === "due") return "due soon";
    if (code === "never") return "never";
    return "ok";
  }

  function getRecommendedContact(accountId: string, accountTier: Tier) {
    const sla = tierDays[accountTier];
    const accContacts = contacts.filter((c) => c.account_id === accountId);
    if (accContacts.length === 0) return null;

    const lastTouch = new Map<string, string>();
    for (const i of interactions) {
      if (!i.contact_id) continue;
      const prev = lastTouch.get(i.contact_id);
      if (!prev || new Date(i.created_at).getTime() > new Date(prev).getTime()) {
        lastTouch.set(i.contact_id, i.created_at);
      }
    }

    let best: { c: Contact; days: number | null } | null = null;

    for (const c of accContacts) {
      const iso = lastTouch.get(c.id) ?? null;
      const d = daysSince(iso);

      if (!best) best = { c, days: d };
      else {
        // prefer "never" (null), otherwise highest days
        if (best.days === null) {
          // keep
        } else if (d === null) {
          best = { c, days: d };
        } else if (d > best.days) {
          best = { c, days: d };
        }
      }
    }

    if (!best) return null;

    const d = best.days;
    let status = "ok";
    if (d === null) status = "never";
    else if (d > sla) status = "touch now";
    else if (d >= Math.max(0, sla - 3)) status = "touch this week";

    return { ...best, status };
  }

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (tierFilter !== "ALL" && a.tier !== tierFilter) return false;
      if (!qq) return true;
      const hay = `${a.name} ${a.country ?? ""}`.toLowerCase();
      return hay.includes(qq);
    });
  }, [accounts, q, tierFilter]);

  const must = useMemo(() => {
    return filtered.filter((a) => {
      const d = daysSince(a.last_interaction_at);
      if (d === null) return true;
      return d > tierDays[a.tier];
    });
  }, [filtered, tierDays]);

  const dueSoon = useMemo(() => {
    return filtered.filter((a) => {
      const d = daysSince(a.last_interaction_at);
      if (d === null) return false;
      const sla = tierDays[a.tier];
      return d <= sla && d >= Math.max(0, sla - 3);
    });
  }, [filtered, tierDays]);

  const SegBtn = ({
    active,
    children,
    onClick,
  }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      className={`segBtn ${active ? "segBtnActive" : ""}`}
      type="button"
    >
      {children}
    </button>
  );

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Today</h1>
          <div className="subtle">Search, filter, then execute. A=7d • B=14d • C=30d</div>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => router.push("/accounts")}>
            Accounts
          </button>
          <button className="btn" onClick={() => router.push("/weekly")}>
            Weekly Pack
          </button>
          <button className="btn" onClick={loadAll}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 10 }}>
          {msg}
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: 2, minWidth: 260 }}>
            <div className="label">Search</div>
            <div className="row" style={{ gap: 10 }}>
              <input
                className="field"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search accounts (name / country)"
              />
              <button
                className="btn"
                type="button"
                onClick={() => setQ("")}
                style={{ height: 46, borderRadius: 14 }}
                disabled={!q}
              >
                Clear
              </button>
            </div>
          </div>

          <div style={{ minWidth: 340 }}>
  <div className="label">Tier</div>
  <div className="segmented">
    <SegBtn active={tierFilter === "ALL"} onClick={() => setTierFilter("ALL")}>
      All
    </SegBtn>
    <SegBtn active={tierFilter === "A"} onClick={() => setTierFilter("A")}>
      A
    </SegBtn>
    <SegBtn active={tierFilter === "B"} onClick={() => setTierFilter("B")}>
      B
    </SegBtn>
    <SegBtn active={tierFilter === "C"} onClick={() => setTierFilter("C")}>
      C
    </SegBtn>
  </div>
</div>

          <div style={{ minWidth: 160, textAlign: "right" }}>
            <div className="label">Showing</div>
            <div style={{ fontWeight: 900 }}>{filtered.length} accounts</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card" style={{ marginTop: 10 }}>
          Loading…
        </div>
      ) : (
        <>
          {/* Must contact */}
          <section style={{ marginTop: 16 }}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Must contact</h2>
              <span className="badge">{must.length}</span>
            </div>

            {must.length === 0 ? (
              <div className="card" style={{ marginTop: 10 }}>
                None 🎉
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                {must.map((a) => {
                  const st = statusFor(a);
                  const rec = getRecommendedContact(a.id, a.tier);

                  return (
                    <div key={a.id} className="card">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                            <div style={{ fontWeight: 900, fontSize: 16 }}>{a.name}</div>
                            <div style={{ color: "var(--muted)", fontSize: 13 }}>
                              {a.tier} • {a.country ?? "—"}
                            </div>
                            <span className="badge">{badgeText(st.code)}</span>
                          </div>

                          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                            {a.last_interaction_at
                              ? `Last touch: ${fmtShort(a.last_interaction_at)} (${st.days}d) • ${st.detail}`
                              : "Last touch: never"}
                          </div>

                          <div style={{ marginTop: 12 }}>
                            {rec ? (
                              <>
                                <div className="label">Recommended contact</div>
                                <div style={{ fontWeight: 900 }}>
                                  {rec.c.name} ({rec.c.area}) — {rec.status}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                                  Preferred: {rec.c.preferred_channel ?? "—"} • Last:{" "}
                                  {rec.days === null ? "never" : `${rec.days}d`}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                                No contacts yet — add them inside the account.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <button className="btn" onClick={() => router.push(`/accounts/${a.id}`)}>
                            Open
                          </button>
                          <button className="btn btnPrimary" onClick={() => openQuickLog(a)}>
                            Quick log
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Due soon */}
          <section style={{ marginTop: 18 }}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Due soon</h2>
              <span className="badge">{dueSoon.length}</span>
            </div>

            {dueSoon.length === 0 ? (
              <div className="card" style={{ marginTop: 10 }}>
                No accounts due soon.
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                {dueSoon.map((a) => {
                  const st = statusFor(a);
                  const rec = getRecommendedContact(a.id, a.tier);

                  return (
                    <div key={a.id} className="card">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                            <div style={{ fontWeight: 900, fontSize: 16 }}>{a.name}</div>
                            <div style={{ color: "var(--muted)", fontSize: 13 }}>
                              {a.tier} • {a.country ?? "—"}
                            </div>
                            <span className="badge">{badgeText(st.code)}</span>
                          </div>

                          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                            Last touch: {a.last_interaction_at ? `${fmtShort(a.last_interaction_at)} (${st.days}d)` : "never"} •{" "}
                            {st.detail}
                          </div>

                          <div style={{ marginTop: 12 }}>
                            {rec ? (
                              <>
                                <div className="label">Recommended contact</div>
                                <div style={{ fontWeight: 900 }}>
                                  {rec.c.name} ({rec.c.area}) — {rec.status}
                                </div>
                                <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                                  Preferred: {rec.c.preferred_channel ?? "—"} • Last:{" "}
                                  {rec.days === null ? "never" : `${rec.days}d`}
                                </div>
                              </>
                            ) : (
                              <div style={{ fontSize: 12, color: "var(--muted)" }}>
                                No contacts yet — add them inside the account.
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <button className="btn" onClick={() => router.push(`/accounts/${a.id}`)}>
                            Open
                          </button>
                          <button className="btn btnPrimary" onClick={() => openQuickLog(a)}>
                            Quick log
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* All accounts */}
          <section style={{ marginTop: 18 }}>
            <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>All accounts</h2>
              <span className="badge">{filtered.length}</span>
            </div>

            {filtered.length === 0 ? (
              <div className="card" style={{ marginTop: 10 }}>
                No matches.
              </div>
            ) : (
              <div style={{ marginTop: 10 }}>
                {filtered.map((a) => {
                  const st = statusFor(a);
                  const rec = getRecommendedContact(a.id, a.tier);

                  return (
                    <div key={a.id} className="card">
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                            <div style={{ fontWeight: 900, fontSize: 16 }}>{a.name}</div>
                            <div style={{ color: "var(--muted)", fontSize: 13 }}>
                              {a.tier} • {a.country ?? "—"}
                            </div>
                            <span className="badge">{badgeText(st.code)}</span>
                          </div>

                          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                            {a.last_interaction_at
                              ? `Last touch: ${fmtShort(a.last_interaction_at)} (${st.days}d) • ${st.detail}`
                              : "Last touch: never"}
                          </div>

                          {rec ? (
                            <div style={{ marginTop: 10 }}>
                              <div className="label">Recommended contact</div>
                              <div style={{ fontWeight: 900 }}>
                                {rec.c.name} ({rec.c.area}) — {rec.status}
                              </div>
                              <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
                                Preferred: {rec.c.preferred_channel ?? "—"} • Last:{" "}
                                {rec.days === null ? "never" : `${rec.days}d`}
                              </div>
                            </div>
                          ) : (
                            <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
                              No contacts yet.
                            </div>
                          )}
                        </div>

                        <div className="row" style={{ justifyContent: "flex-end" }}>
                          <button className="btn" onClick={() => router.push(`/accounts/${a.id}`)}>
                            Open
                          </button>
                          <button className="btn btnPrimary" onClick={() => openQuickLog(a)}>
                            Quick log
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      <QuickLogModal
        open={open}
        onClose={() => setOpen(false)}
        accountId={selectedAccountId}
        accountName={selectedAccountName}
        onSaved={loadAll}
      />
    </main>
  );
}