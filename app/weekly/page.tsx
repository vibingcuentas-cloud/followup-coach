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
  business_hook: string | null;
};

type Interaction = {
  id: string;
  account_id: string;
  created_at: string;
  next_step: string;
  next_step_date: string;
  summary: string;
};

function daysSince(iso: string | null) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default function WeeklyPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

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
        .select("id,name,tier,country,value_usd,last_interaction_at,business_hook")
        .order("created_at", { ascending: false });

      if (accErr) throw accErr;

      const since = new Date();
      since.setDate(since.getDate() - 14);

      const { data: ints, error: intErr } = await supabase
        .from("interactions")
        .select("id,account_id,created_at,next_step,next_step_date,summary")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false })
        .limit(200);

      if (intErr) throw intErr;

      setAccounts((acc as Account[]) ?? []);
      setInteractions((ints as Interaction[]) ?? []);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not load weekly pack");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weeklyText = useMemo(() => {
    const topByValue = [...accounts]
      .sort((a, b) => (b.value_usd ?? 0) - (a.value_usd ?? 0))
      .slice(0, 10);

    const lines: string[] = [];
    lines.push("WEEKLY PACK");
    lines.push("");

    lines.push("TOP 10 (by value)");
    for (const a of topByValue) {
      const d = daysSince(a.last_interaction_at);
      lines.push(
        `- ${a.name} (${a.tier}) | Value: ${a.value_usd ?? "—"} | Last touch: ${
          d === null ? "never" : `${d}d`
        } | Hook: ${a.business_hook ?? "—"}`
      );
    }

    lines.push("");
    lines.push("RECENT INTERACTIONS (last 14 days)");
    for (const i of interactions.slice(0, 25)) {
      const acc = accounts.find((a) => a.id === i.account_id);
      lines.push(
        `- ${acc?.name ?? "Unknown"} | ${new Date(i.created_at).toLocaleDateString("en-US")} | ${i.summary} | Next: ${
          i.next_step
        } (${i.next_step_date})`
      );
    }

    return lines.join("\n");
  }, [accounts, interactions]);

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(weeklyText);
      setMsg("Copied to clipboard ✅");
      setTimeout(() => setMsg(null), 1500);
    } catch {
      setMsg("Could not copy. Select and copy manually.");
    }
  }

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Weekly Pack</h1>
          <div className="subtle">Copy-paste summary for your team or manager.</div>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => router.push("/today")}>
            Today
          </button>
          <button className="btn" onClick={() => router.push("/accounts")}>
            Accounts
          </button>
          <button className="btn" onClick={loadAll}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={copyToClipboard}>
            Copy
          </button>
        </div>
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 10 }}>
          {msg}
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
