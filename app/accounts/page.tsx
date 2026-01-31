"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

type Tier = "A" | "B" | "C";

type Account = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
};

function daysSince(iso: string | null) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function AccountsPage() {
  const router = useRouter();

  const tiers = useMemo(() => ({ A: 7, B: 14, C: 30 } as const), []);

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // form
  const [name, setName] = useState("");
  const [tier, setTier] = useState<Tier>("A");
  const [country, setCountry] = useState("");
  const [value, setValue] = useState("");

  async function requireAuth() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/login");
      return null;
    }
    return data.user;
  }

  async function loadAccounts() {
    const user = await requireAuth();
    if (!user) return;

    setLoading(true);
    setMsg(null);

    const { data, error } = await supabase
      .from("accounts")
      .select("id,name,tier,country,value_usd,last_interaction_at")
      .order("value_usd", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (error) {
      setMsg(error.message);
      setLoading(false);
      return;
    }

    setAccounts((data as Account[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const user = await requireAuth();
    if (!user) return;

    if (!name.trim()) {
      setMsg("Account name is required.");
      return;
    }

    const parsedValue =
      value.trim() === ""
        ? null
        : Number.isFinite(Number(value))
        ? Number(value)
        : null;

    const { error } = await supabase.from("accounts").insert({
      name: name.trim(),
      tier,
      country: country.trim() ? country.trim() : null,
      value_usd: parsedValue,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setName("");
    setTier("A");
    setCountry("");
    setValue("");
    await loadAccounts();
  }

  async function removeAccount(id: string) {
    setMsg(null);
    const ok = confirm("Delete this account?");
    if (!ok) return;

    const { error } = await supabase.from("accounts").delete().eq("id", id);
    if (error) setMsg(error.message);
    await loadAccounts();
  }

  function statusFor(a: Account) {
    const d = daysSince(a.last_interaction_at);
    const sla = tiers[a.tier];

    if (d === null) return { code: "never", label: "Never", detail: "No touch yet" };

    if (d > sla) return { code: "overdue", label: "Overdue", detail: `${d - sla}d over` };

    // “Due soon”: within last 3 days of SLA window
    if (d >= Math.max(0, sla - 3)) return { code: "due", label: "Due soon", detail: `within ${sla}d` };

    return { code: "ok", label: "OK", detail: `within ${sla}d` };
  }

  function badgeText(code: string) {
    // Keep it monochrome/premium; text carries meaning (no colors yet)
    if (code === "overdue") return "overdue";
    if (code === "due") return "due soon";
    if (code === "never") return "never";
    return "ok";
  }

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Accounts</h1>
          <div className="subtle">Sorted by value. Status visible at a glance.</div>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => router.push("/today")}>
            Today
          </button>
          <button className="btn" onClick={() => router.push("/weekly")}>
            Weekly Pack
          </button>
          <button className="btn" onClick={loadAccounts}>
            Refresh
          </button>
        </div>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 10 }}>
          {msg}
        </div>
      )}

      {/* Add account */}
      <div className="card">
        <form className="grid" onSubmit={addAccount}>
          <div className="row">
            <div style={{ flex: 2, minWidth: 240 }}>
              <div className="label">Account name</div>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., AJE Peru"
              />
            </div>

            <div style={{ width: 120 }}>
              <div className="label">Tier</div>
              <select
                className="field"
                value={tier}
                onChange={(e) => setTier(e.target.value as Tier)}
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <div className="label">Country</div>
              <input
                className="field"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g., Peru"
              />
            </div>

            <div style={{ width: 160 }}>
              <div className="label">Value (USD)</div>
              <input
                className="field"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="e.g., 250000"
                inputMode="numeric"
              />
            </div>
          </div>

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btnPrimary" type="submit">
              Add account
            </button>
          </div>

          <div style={{ fontSize: 12, color: "var(--muted)" }}>
            Intimacy cadence: A=7d • B=14d • C=30d
          </div>
        </form>
      </div>

      {/* List */}
      {loading ? (
        <div className="card" style={{ marginTop: 10 }}>
          Loading…
        </div>
      ) : accounts.length === 0 ? (
        <div className="card" style={{ marginTop: 10 }}>
          No accounts yet.
        </div>
      ) : (
        <div style={{ marginTop: 10 }}>
          {accounts.map((a) => {
            const st = statusFor(a);
            const d = daysSince(a.last_interaction_at);

            return (
              <div key={a.id} className="card">
                <div
                  className="row"
                  style={{ justifyContent: "space-between", alignItems: "center" }}
                >
                  <div>
                    <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>{a.name}</div>
                      <div style={{ color: "var(--muted)", fontSize: 13 }}>
                        {a.tier} • {a.country ?? "—"}
                      </div>
                      <span className="badge">{badgeText(st.code)}</span>
                    </div>

                    <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                      Value: {a.value_usd ?? "—"} •{" "}
                      {a.last_interaction_at
                        ? `Last touch: ${fmtShort(a.last_interaction_at)} (${d}d)`
                        : "Last touch: never"}{" "}
                      • {st.detail}
                    </div>
                  </div>

                  <div className="row" style={{ justifyContent: "flex-end" }}>
                    <button
                      className="btn btnPrimary"
                      onClick={() => router.push(`/accounts/${a.id}`)}
                    >
                      Open
                    </button>
                    <button className="btn btnDanger" onClick={() => removeAccount(a.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}