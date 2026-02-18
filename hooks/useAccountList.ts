// hooks/useAccountList.ts
// Maneja todo el estado y las operaciones de la página de listado de cuentas.
// La página solo necesita llamar este hook y renderizar lo que devuelve.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { fmtMoney, daysSince, cadenceDays, type Tier } from "../lib/intimacy";

export type AccountRow = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
  created_at: string;
  // Campos calculados — listos para renderizar
  lastTouch: string;
  badge: "ok" | "due" | "never";
  valueFormatted: string;
};

type AddAccountInput = {
  name: string;
  tier: Tier;
  country: string;
  valueUsd: string;
};

export function useAccountList() {
  const router = useRouter();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Auth ────────────────────────────────────────────────────────────────────

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
  }

  // ─── Fetch ───────────────────────────────────────────────────────────────────

  async function load() {
    setError(null);
    setLoading(true);
    try {
      await requireUser();

      const { data, error } = await supabase
        .from("accounts")
        .select("id,name,tier,country,value_usd,last_interaction_at,created_at")
        .order("value_usd", { ascending: false, nullsFirst: false });

      if (error) throw error;

      const rows = (data ?? []).map((a): AccountRow => {
        const d = daysSince(a.last_interaction_at);
        const limit = cadenceDays(a.tier as Tier);
        const badge: AccountRow["badge"] =
          d == null ? "never" : d <= limit ? "ok" : "due";
        const lastTouch =
          d == null ? "nunca" : d === 0 ? "hoy" : `${d}d`;

        return {
          ...a,
          tier: a.tier as Tier,
          lastTouch,
          badge,
          valueFormatted: fmtMoney(a.value_usd),
        };
      });

      setAccounts(rows);
    } catch (e: any) {
      const m = e?.message ?? "No se pudieron cargar las cuentas.";
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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Mutaciones ───────────────────────────────────────────────────────────────

  async function addAccount(input: AddAccountInput): Promise<string | null> {
    const nm = input.name.trim();
    if (!nm) return "El nombre de la cuenta es obligatorio.";

    const ctry = input.country.trim() || null;
    const v = input.valueUsd.trim() ? Number(input.valueUsd.trim()) : null;
    if (input.valueUsd.trim() && (v == null || Number.isNaN(v))) {
      return "El valor debe ser un número.";
    }

    setLoading(true);
    try {
      await requireUser();

      const { error } = await supabase.from("accounts").insert({
        name: nm,
        tier: input.tier,
        country: ctry,
        value_usd: v,
      });

      if (error) throw error;
      await load();
      return null; // null = sin error
    } catch (e: any) {
      const m = e?.message ?? "No se pudo agregar la cuenta.";
      setError(m);
      return m;
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount(id: string): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.from("accounts").delete().eq("id", id);
      if (error) throw error;
      await load();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo eliminar la cuenta.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return {
    accounts,
    loading,
    error,
    load,
    addAccount,
    deleteAccount,
    signOut,
  };
}