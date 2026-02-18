// hooks/useToday.ts
// Fetch, filtros y cálculos del "Today" cockpit.
// La página solo renderiza lo que este hook devuelve.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import {
  AREAS,
  daysSince,
  fmtMoney,
  fmtLastTouch,
  coverageByArea,
  computeIntimacyScore,
  pickRecommendedContact,
  isAccountDue,
  type Tier,
  type Area,
  type Channel,
  type IntimacyScore,
} from "../lib/intimacy";

// ─── Tipos ────────────────────────────────────────────────────────────────────

type RawAccount = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
  created_at: string;
};

type RawContact = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  area: Area;
  preferred_channel: Channel | null;
  personal_hook: string | null;
  last_touch_at: string | null;
  created_at: string;
};

// Fila enriquecida que la página puede renderizar directamente
export type EnrichedAccount = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
  // Calculados
  score: IntimacyScore;
  lastTouch: string;
  valueFormatted: string;
  isDue: boolean;
  contacts: RawContact[];
  recommendedContact: RawContact | null;
  recommendedLastTouch: string;
  coverageCounts: Record<Area, number>;
  missingAreas: Area[];
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useToday() {
  const router = useRouter();

  const [rawAccounts, setRawAccounts] = useState<RawAccount[]>([]);
  const [rawContacts, setRawContacts] = useState<RawContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros de UI
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<"all" | Tier>("all");

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
  }

  async function loadAll() {
    setError(null);
    setLoading(true);
    try {
      await requireUser();

      const { data: acc, error: accErr } = await supabase
        .from("accounts")
        .select("id,name,tier,country,value_usd,last_interaction_at,created_at")
        .order("value_usd", { ascending: false, nullsFirst: false });

      if (accErr) throw accErr;

      const accList = (acc ?? []) as RawAccount[];
      setRawAccounts(accList);

      if (accList.length === 0) {
        setRawContacts([]);
        return;
      }

      const { data: cts, error: cErr } = await supabase
        .from("contacts")
        .select("id,account_id,name,email,area,preferred_channel,personal_hook,last_touch_at,created_at")
        .in("account_id", accList.map((a) => a.id));

      if (cErr) throw cErr;
      setRawContacts((cts ?? []) as RawContact[]);
    } catch (e: any) {
      const m = e?.message ?? "No se pudo cargar.";
      if (String(m).toLowerCase().includes("not signed")) {
        router.push("/login");
        return;
      }
      setError(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Enriquecer cuentas ───────────────────────────────────────────────────────
  // Este useMemo es el núcleo del "Today" cockpit.
  // Aplica filtros y calcula todo lo que la página necesita mostrar.

  const contactsByAccount = useMemo(() => {
    const map = new Map<string, RawContact[]>();
    for (const c of rawContacts) {
      if (!map.has(c.account_id)) map.set(c.account_id, []);
      map.get(c.account_id)!.push(c);
    }
    return map;
  }, [rawContacts]);

  const allEnriched = useMemo((): EnrichedAccount[] => {
    const q = search.trim().toLowerCase();

    return rawAccounts
      .filter((a) => {
        if (tierFilter !== "all" && a.tier !== tierFilter) return false;
        if (!q) return true;
        return (
          a.name.toLowerCase().includes(q) ||
          (a.country ?? "").toLowerCase().includes(q)
        );
      })
      .map((a) => {
        const contacts = contactsByAccount.get(a.id) ?? [];
        const coverageCounts = coverageByArea(contacts);
        const missingAreas = AREAS.filter((ar) => (coverageCounts[ar] ?? 0) === 0);
        const score = computeIntimacyScore(a, contacts);
        const rec = pickRecommendedContact(contacts);
        const recDays = rec ? daysSince(rec.last_touch_at) : null;

        return {
          id: a.id,
          name: a.name,
          tier: a.tier,
          country: a.country,
          value_usd: a.value_usd,
          last_interaction_at: a.last_interaction_at,
          score,
          lastTouch: fmtLastTouch(daysSince(a.last_interaction_at)),
          valueFormatted: fmtMoney(a.value_usd),
          isDue: isAccountDue(a),
          contacts,
          recommendedContact: rec,
          recommendedLastTouch: fmtLastTouch(recDays),
          coverageCounts,
          missingAreas,
        };
      });
  }, [rawAccounts, contactsByAccount, search, tierFilter]);

  // Cuentas que requieren contacto — ordenadas por score ASC (más crítico primero)
  const mustContact = useMemo(
    () =>
      allEnriched
        .filter((a) => a.isDue)
        .sort((x, y) => {
          if (x.score.total !== y.score.total) return x.score.total - y.score.total;
          return x.score.coverage - y.score.coverage;
        }),
    [allEnriched]
  );

  // Todas las cuentas ordenadas por score ASC (las más en riesgo arriba)
  const allSorted = useMemo(
    () => [...allEnriched].sort((x, y) => x.score.total - y.score.total),
    [allEnriched]
  );

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return {
    // Data
    mustContact,
    allSorted,
    totalShowing: allEnriched.length,
    // Estado
    loading,
    error,
    // Filtros
    search,
    setSearch,
    tierFilter,
    setTierFilter,
    // Acciones
    loadAll,
    signOut,
  };
}