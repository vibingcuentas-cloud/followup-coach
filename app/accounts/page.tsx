"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccountList } from "../../hooks/useAccountList";
import BrandWordmark from "../../components/BrandWordmark";
import WorkspaceRail from "../../components/WorkspaceRail";
import { type Tier } from "../../lib/intimacy";

export const dynamic = "force-dynamic";

export default function AccountsPage() {
  const router = useRouter();
  const { accounts, loading, error, load, addAccount, deleteAccount, signOut } =
    useAccountList();

  const [name, setName] = useState("");
  const [tier, setTier] = useState<Tier>("A");
  const [country, setCountry] = useState("");
  const [valueUsd, setValueUsd] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const dueCount = useMemo(
    () => accounts.filter((a) => a.badge === "due").length,
    [accounts]
  );
  const neverCount = useMemo(
    () => accounts.filter((a) => a.badge === "never").length,
    [accounts]
  );

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
    <main className="opsPage">
      <header className="opsTopbar">
        <div>
          <BrandWordmark />
          <h1 className="opsTitle">Accounts</h1>
          <div className="opsSubtitle">Create, prioritize, and inspect strategic accounts.</div>
        </div>

        <div className="opsTopActions">
          <button className="btn btnGhost" onClick={() => router.push("/today")}>Today</button>
          <button className="btn btnGhost" onClick={() => router.push("/weekly")}>Weekly Pack</button>
          <button className="btn btnGhost" onClick={load} disabled={loading}>Refresh</button>
          <button className="btn btnPrimary" onClick={signOut}>Sign out</button>
        </div>
      </header>

      <div className="opsShell">
        <WorkspaceRail active="accounts" />

        <section className="opsMain">
          {msg && <div className="opsInlineError">{msg}</div>}

          <section className="opsBlock">
            <div className="opsPanelTitle">Create account</div>
            <div className="opsFormGrid">
              <label>
                <div className="label">Account name</div>
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="e.g. AJE Peru"
                />
              </label>

              <label>
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

              <label>
                <div className="label">Country</div>
                <input
                  className="field"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Peru"
                />
              </label>

              <label>
                <div className="label">Value (USD)</div>
                <input
                  className="field"
                  value={valueUsd}
                  onChange={(e) => setValueUsd(e.target.value)}
                  placeholder="e.g. 250000"
                  inputMode="numeric"
                />
              </label>

              <button className="btn btnPrimary" onClick={handleAdd} disabled={loading}>
                Add account
              </button>
            </div>
          </section>

          <div className="opsSectionHeaderRow">
            <div>
              <h2 className="opsSectionTitle">Account list</h2>
              <div className="opsSectionSubtitle">Sorted by value. Operational view first.</div>
            </div>
            <div className="opsCount">{accounts.length}</div>
          </div>

          {loading && <div className="opsInlineHint">Loading accounts…</div>}
          {!loading && accounts.length === 0 && (
            <div className="opsInlineHint">No accounts yet.</div>
          )}

          <div className="opsStack">
            {!loading &&
              accounts.map((a) => (
                <article key={a.id} className="opsListRow">
                  <div>
                    <div className="opsMiniTitle">
                      {a.name}
                      <span className="opsQueueMeta">
                        {a.tier} • {a.country ?? "—"}
                      </span>
                    </div>
                    <div className="opsMiniSub">
                      Value: {a.valueFormatted} • Last touch: {a.lastTouch} • Status: {a.badge}
                    </div>
                  </div>

                  <div className="opsListActions">
                    <button className="btn btnGhost" onClick={() => router.push(`/accounts/${a.id}`)}>
                      Open
                    </button>
                    <button className="btn btnDanger" onClick={() => deleteAccount(a.id)}>
                      Delete
                    </button>
                  </div>
                </article>
              ))}
          </div>
        </section>

        <aside className="opsContext desktopOnly">
          <div className="opsPanelTitle">Overview</div>

          <div className="opsPanelBlock">
            <div className="opsPanelLabel">Total</div>
            <div className="opsPanelValue">{accounts.length} strategic accounts</div>
          </div>

          <div className="opsPanelBlock">
            <div className="opsPanelLabel">Due</div>
            <div className="opsPanelValue">{dueCount} need follow-up</div>
          </div>

          <div className="opsPanelBlock">
            <div className="opsPanelLabel">Never touched</div>
            <div className="opsPanelValue">{neverCount} need first contact</div>
          </div>

          <div className="opsInlineHint">Cadence: Tier A 7d • Tier B 14d • Tier C 30d.</div>
        </aside>
      </div>

      <div className="opsCommandBar">
        <span className="opsCommandIcon">&gt;</span>
        <input
          className="opsCommandInput"
          placeholder="Add account ajeper tier A peru value 10000"
          aria-label="Command"
        />
        <span className="opsCommandHint">Cmd K</span>
      </div>
    </main>
  );
}
