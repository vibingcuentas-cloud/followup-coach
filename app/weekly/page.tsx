"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWeekly } from "../../hooks/useWeekly";
import BrandWordmark from "../../components/BrandWordmark";

export const dynamic = "force-dynamic";

export default function WeeklyPage() {
  const router = useRouter();
  const { weeklyText, loading, error, loadAll } = useWeekly();
  const [copied, setCopied] = useState(false);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(weeklyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // fallback: user can select and copy manually
    }
  }

  return (
    <main>
      <div className="topbar">
        <div className="topbarTitle">
          <BrandWordmark />
          <h1 className="h1">Weekly Pack</h1>
          <div className="subtle">Weekly summary ready to share with your team or manager.</div>
        </div>
        <div className="topbarActions">
          <button className="btn" onClick={() => router.push("/today")}>Today</button>
          <button className="btn" onClick={() => router.push("/accounts")}>Accounts</button>
          <button className="btn" onClick={loadAll}>Refresh</button>
          <button className="btn btnPrimary" onClick={copyToClipboard}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      {error && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="card">Loading…</div>
      ) : (
        <div className="card">
          <div className="label">Text (ready to copy)</div>
          <textarea
            className="field"
            readOnly
            rows={24}
            value={weeklyText}
            style={{ resize: "vertical" }}
          />
        </div>
      )}
    </main>
  );
}
