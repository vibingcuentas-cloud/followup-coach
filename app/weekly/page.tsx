"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useWeekly } from "../../hooks/useWeekly";
import BrandWordmark from "../../components/BrandWordmark";
import WorkspaceRail from "../../components/WorkspaceRail";

export const dynamic = "force-dynamic";

export default function WeeklyPage() {
  const router = useRouter();
  const { weeklyText, loading, error, loadAll } = useWeekly();
  const [copied, setCopied] = useState(false);

  const lineCount = useMemo(
    () => weeklyText.split("\n").filter((line) => line.trim()).length,
    [weeklyText]
  );

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
    <main className="opsPage opsTodayPolish opsStandard">
      <header className="opsTopbar">
        <div>
          <BrandWordmark />
          <h1 className="opsTitle">Weekly Pack</h1>
          <div className="opsSubtitle">Structured weekly narrative for leadership updates.</div>
        </div>

        <div className="opsTopActions">
          <button className="btn btnGhost" onClick={() => router.push("/today")}>Today</button>
          <button className="btn btnGhost" onClick={() => router.push("/accounts")}>Accounts</button>
          <button className="btn btnGhost" onClick={loadAll}>Refresh</button>
          <button className="btn btnPrimary" onClick={copyToClipboard}>
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </header>

      {error && <div className="opsInlineError">{error}</div>}

      <div className="opsShell">
        <WorkspaceRail active="week" />

        <section className="opsMain">
          <div className="opsSectionHeaderRow">
            <div>
              <h2 className="opsSectionTitle">Weekly output</h2>
              <div className="opsSectionSubtitle">Ready to paste into Slack, email, or docs.</div>
            </div>
            <div className="opsCount">{lineCount}</div>
          </div>

          {loading ? (
            <div className="opsInlineHint">Generating weekly pack…</div>
          ) : (
            <section className="opsBlock">
              <div className="opsPanelTitle">Draft</div>
              <textarea className="field opsTextarea" readOnly rows={24} value={weeklyText} />
            </section>
          )}
        </section>

        <aside className="opsContext desktopOnly">
          <div className="opsPanelTitle">Usage</div>

          <div className="opsPanelBlock">
            <div className="opsPanelLabel">How to use</div>
            <div className="opsPanelValue">
              1. Refresh data. 2. Copy weekly output. 3. Share to team channel.
            </div>
          </div>

          <div className="opsPanelBlock">
            <div className="opsPanelLabel">Line count</div>
            <div className="opsPanelValue">{lineCount} non-empty lines</div>
          </div>

          <button className="btn btnPrimary" onClick={copyToClipboard}>
            {copied ? "Copied" : "Copy weekly"}
          </button>
        </aside>
      </div>

    </main>
  );
}
