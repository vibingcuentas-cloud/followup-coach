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

export default function AccountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);

  // form
  const [name, setName] = useState("");
  const [tier, setTier] = useState<"A" | "B" | "C">("A");
  const [country, setCountry] = useState("");
  const [valueUsd, setValueUsd] = useState("");

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

      const { data, error } = await supabase
        .from("accounts")
        .select("id,name,tier,country,value_usd,last_interaction_at,created_at")
        .order("value_usd", { ascending: false, nullsFirst: false });

      if (error) throw error;
      setAccounts((data ?? []) as Account[]);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not load accounts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addAccount() {
    setMsg(null);
  
    const nm = name.trim();
    if (!nm) return setMsg("Account name is required.");
  
    const ctry = country.trim() ? country.trim() : null;
    const v = valueUsd.trim() ? Number(valueUsd.trim()) : null;
    if (valueUsd.trim() && (v == null || Number.isNaN(v))) {
      return setMsg("Value (USD) must be a number.");
    }
  
    setLoading(true);
    try {
      const user = await requireUser();
  
      const { error } = await supabase.from("accounts").insert({
        owner_user_id: user.id,   // ✅ ESTA ES LA CORRECTA
        name: nm,
        tier,
        country: ctry,
        value_usd: v,
      });
  
      if (error) throw error;
  
      setName("");
      setTier("A");
      setCountry("");
      setValueUsd("");
  
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Could not add account");
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount(id: string) {
    setMsg(null);
    setLoading(true);
    try {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setMsg(e?.message ?? "Could not delete");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const headerActions = (
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
      <button className="btn" onClick={() => router.push("/today")}>
        Today
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

  const cadenceText = "Intimacy cadence: A=7d • B=14d • C=30d";

  const list = useMemo(() => accounts, [accounts]);

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Accounts</h1>
          <div className="subtle">Sorted by value. Status visible at a glance.</div>
        </div>
        {headerActions}
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
        </div>
      )}

      <div className="card">
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "1.4fr 140px 1fr 180px auto",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Account name</div>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., AJE Peru"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Tier</div>
            <select
              className="field"
              value={tier}
              onChange={(e) => setTier(e.target.value as any)}
            >
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Country</div>
            <input
              className="field"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="e.g., Peru"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Value (USD)</div>
            <input
              className="field"
              value={valueUsd}
              onChange={(e) => setValueUsd(e.target.value)}
              placeholder="e.g., 250000"
              inputMode="numeric"
            />
          </label>

          <button
            className="btn btnPrimary"
            onClick={addAccount}
            disabled={loading}
            style={{ height: 44, borderRadius: 16, padding: "0 16px" }}
          >
            Add account
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          {cadenceText}
        </div>
      </div>

      <div style={{ height: 12 }} />

      {loading && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>Loading...</div>
        </div>
      )}

      {!loading && list.length === 0 && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>No accounts yet.</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {list.map((a) => {
          const d = daysSince(a.last_interaction_at);
          const badge = d == null ? "never" : d <= 7 ? "ok" : "due";
          const lastTouch = d == null ? "never" : d === 0 ? "today" : `${d}d`;

          return (
            <div className="card" key={a.id}>
              <div
                className="row"
                style={{ justifyContent: "space-between", gap: 12 }}
              >
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {a.name}{" "}
                    <span
                      style={{ fontWeight: 700, opacity: 0.7, fontSize: 14 }}
                    >
                      {a.tier} • {a.country ?? "—"}
                    </span>{" "}
                    <span className="pill" style={{ marginLeft: 8, opacity: 0.9 }}>
                      {badge === "never"
                        ? "never"
                        : badge === "ok"
                        ? "ok"
                        : "due"}
                    </span>
                  </div>

                  <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                    Value: {fmtMoney(a.value_usd)} • Last touch: {lastTouch}
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
                    className="btn"
                    onClick={() => deleteAccount(a.id)}
                    style={{ height: 40, borderRadius: 14 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}