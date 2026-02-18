// hooks/useWeekly.ts
// Fetch y generación del texto del Weekly Pack.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { daysSince, type Tier } from "../lib/intimacy";

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

export function useWeekly() {
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    setError(null);

    try {
      const since = new Date();
      since.setDate(since.getDate() - 14);

      const [{ data: acc, error: accErr }, { data: ints, error: intErr }] =
        await Promise.all([
          supabase
            .from("accounts")
            .select("id,name,tier,country,value_usd,last_interaction_at,business_hook")
            .order("created_at", { ascending: false }),
          supabase
            .from("interactions")
            .select("id,account_id,created_at,next_step,next_step_date,summary")
            .gte("created_at", since.toISOString())
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

      if (accErr) throw accErr;
      if (intErr) throw intErr;

      setAccounts((acc as Account[]) ?? []);
      setInteractions((ints as Interaction[]) ?? []);
    } catch (e: any) {
      setError(e?.message ?? "No se pudo cargar el weekly pack.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Genera el texto listo para copiar/pegar
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
        `- ${acc?.name ?? "Unknown"} | ${new Date(i.created_at).toLocaleDateString("en-US")} | ${i.summary} | Next: ${i.next_step} (${i.next_step_date})`
      );
    }

    return lines.join("\n");
  }, [accounts, interactions]);

  return {
    weeklyText,
    loading,
    error,
    loadAll,
  };
}