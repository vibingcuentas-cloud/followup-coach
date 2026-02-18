"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccountList } from "../../hooks/useAccountList";
import { fmtMoney, type Tier } from "../../lib/intimacy";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  const router = useRouter();
  const { accounts, loading, error, load, addAccount, deleteAccount, signOut } =
    useAccountList();

  // Estado del formulario — solo vive en la página porque es UI pura
  const [name, setName] = useState("");
  const [tier, setTier] = useState<Tier>("A");
  const [country, setCountry] = useState("");
  const [valueUsd, setValueUsd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAdd() {
    setFormError(null);
    const err = await addAccount({ name, tier, country, valueUsd });
    if (err) {
      setFormError(err);
    } else {
      setName("");
      setTier("A");
      setCountry("");
      setValueUsd("");
    }
  }

  const msg = formError ?? error;

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Accounts</h1>
          <div className="subtle">Ordenado por valor. Estado visible de un vistazo.</div>
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button className="btn" onClick={() => router.push("/today")}>Today</button>
          <button className="btn" onClick={() => router.push("/weekly")}>Weekly Pack</button>
          <button className="btn" onClick={load} disabled={loading}>Refresh</button>
          <button className="btn btnPrimary" onClick={signOut}>Sign out</button>
        </div>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
        </div>
      )}

      {/* Formulario agregar cuenta */}
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
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="ej. AJE Peru"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
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
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Country</div>
            <input
              className="field"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="ej. Peru"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Value (USD)</div>
            <input
              className="field"
              value={valueUsd}
              onChange={(e) => setValueUsd(e.target.value)}
              placeholder="ej. 250000"
              inputMode="numeric"
            />
          </label>

          <button
            className="btn btnPrimary"
            onClick={handleAdd}
            disabled={loading}
            style={{ height: 44, borderRadius: 16, padding: "0 16px" }}
          >
            Add account
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: "var(--muted)" }}>
          Intimacy cadence: A=7d • B=14d • C=30d
        </div>
      </div>

      <div style={{ height: 12 }} />

      {loading && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>Loading...</div>
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.85 }}>Sin cuentas aún.</div>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        {accounts.map((a) => (
          <div className="card" key={a.id}>
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 18 }}>
                  {a.name}{" "}
                  <span style={{ fontWeight: 700, opacity: 0.7, fontSize: 14 }}>
                    {a.tier} • {a.country ?? "—"}
                  </span>{" "}
                  <span className="pill" style={{ marginLeft: 8, opacity: 0.9 }}>
                    {a.badge}
                  </span>
                </div>
                <div style={{ marginTop: 8, opacity: 0.8, fontSize: 13 }}>
                  Value: {a.valueFormatted} • Last touch: {a.lastTouch}
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
        ))}
      </div>
    </main>
  );
}