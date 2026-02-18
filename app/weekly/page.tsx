"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWeekly } from "../../hooks/useWeekly";

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
      // fallback: el usuario puede seleccionar y copiar manualmente
    }
  }

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Weekly Pack</h1>
          <div className="subtle">Resumen listo para copiar/pegar a tu equipo o manager.</div>
        </div>
        <div className="row" style={{ justifyContent: "flex-end", gap: 10 }}>
          <button className="btn" onClick={() => router.push("/today")}>Today</button>
          <button className="btn" onClick={() => router.push("/accounts")}>Accounts</button>
          <button className="btn" onClick={loadAll}>Refresh</button>
          <button className="btn btnPrimary" onClick={copyToClipboard}>
            {copied ? "Copiado ✅" : "Copy"}
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
          <div className="label">Texto (listo para copiar)</div>
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