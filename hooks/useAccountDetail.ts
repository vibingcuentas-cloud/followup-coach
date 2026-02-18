// hooks/useAccountDetail.ts
// Maneja fetch, contactos e interacciones de una cuenta específica.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { computeIntimacyScore, type Tier, type Area, type Channel, type IntimacyScore } from "../lib/intimacy";

export type AccountDetail = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
};

export type Contact = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  area: Area;
  preferred_channel: Channel | null;
  personal_hook: string | null;
  last_touch_at?: string | null;
  created_at: string;
};

export type Interaction = {
  id: string;
  account_id: string;
  contact_id: string | null;
  channel: Channel;
  summary: string;
  next_step: string;
  next_step_date: string;
  created_at: string;
};

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
}

export function useAccountDetail(accountId: string | undefined) {
  const router = useRouter();

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [score, setScore] = useState<IntimacyScore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
  }

  async function loadAll() {
    setError(null);

    if (!accountId || typeof accountId !== "string") {
      setError("Missing account id.");
      return;
    }
    if (!isUuid(accountId)) {
      setError(`ID inválido: "${accountId}"`);
      return;
    }

    setLoading(true);
    try {
      await requireUser();

      const [
        { data: acc, error: accErr },
        { data: cts, error: cErr },
        { data: its, error: iErr },
      ] = await Promise.all([
        supabase
          .from("accounts")
          .select("id,name,tier,country,value_usd,last_interaction_at")
          .eq("id", accountId)
          .single(),
        supabase
          .from("contacts")
          .select("id,account_id,name,email,area,preferred_channel,personal_hook,last_touch_at,created_at")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false }),
        supabase
          .from("interactions")
          .select("id,account_id,contact_id,channel,summary,next_step,next_step_date,created_at")
          .eq("account_id", accountId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (accErr) throw accErr;
      if (cErr) throw cErr;
      if (iErr) throw iErr;

      const accData = acc as AccountDetail;
      const ctsData = (cts ?? []) as Contact[];

      setAccount(accData);
      setContacts(ctsData);
      setInteractions((its ?? []) as Interaction[]);
      setScore(computeIntimacyScore(accData, ctsData));
    } catch (e: any) {
      const m = e?.message ?? "No se pudo cargar la cuenta.";
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
  }, [accountId]);

  async function deleteContact(id: string): Promise<void> {
    setError(null);
    setLoading(true);
    try {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setError(e?.message ?? "No se pudo eliminar el contacto.");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return {
    account,
    contacts,
    interactions,
    score,
    loading,
    error,
    loadAll,
    deleteContact,
    signOut,
  };
}