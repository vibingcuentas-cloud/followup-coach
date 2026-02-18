"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import QuickLogModal from "../../../components/QuickLogModal";
import AddContactSheet from "../../../components/AddContactSheet";
import { ScorePill, CoverageChips } from "../../../components/IntimacyWidgets";
import {
  AREAS,
  daysSince,
  fmtMoney,
  fmtLastTouch,
  channelLabel,
  computeIntimacyScore,
  type Tier,
  type Area,
  type Channel,
} from "../../../lib/intimacy";

export const dynamic = "force-dynamic";

type Account = {
  id: string;
  name: string;
  tier: Tier;
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
};

type Contact = {
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

type Interaction = {
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

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const accountId = params?.id;

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  // Modals
  const [logOpen, setLogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
  }

  async function loadAll() {
    setMsg(null);

    if (!accountId || typeof accountId !== "string") {
      setMsg("Missing account id.");
      return;
    }
    if (!isUuid(accountId)) {
      setMsg(`Invalid account id: "${accountId}"`);
      return;
    }

    setLoading(true);
    try {
      await requireUser();

      const accQ = supabase
        .from("accounts")
        .select("id,name,tier,country,value_usd,last_interaction_at")
        .eq("id", accountId)
        .single();

      const contactsQ = supabase
        .from("contacts")
        .select("id,account_id,name,email,area,preferred_channel,personal_hook,last_touch_at,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      const interQ = supabase
        .from("interactions")
        .select("id,account_id,contact_id,channel,summary,next_step,next_step_date,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(30);

      const [
        { data: acc, error: accErr },
        { data: cts, error: cErr },
        { data: its, error: iErr },
      ] = await Promise.all([accQ, contactsQ, interQ]);

      if (accErr) throw accErr;
      if (cErr) throw cErr;
      if (iErr) throw iErr;

      setAccount(acc as Account);
      setContacts((cts ?? []) as Contact[]);
      setInteractions((its ?? []) as Interaction[]);
    } catch (e: any) {
      const m = e?.message ?? "Could not load account";
      if (String(m).toLowerCase().includes("not signed")) {
        router.push("/login");
        return;
      }
      setMsg(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function deleteContact(id: string) {
    setMsg(null);
    setLoading(true);
    try {
      await requireUser();
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ?? "No se pudo eliminar el contacto.");
    } finally {
      setLoading(false);
    }
  }

  function openAddContact() {
    setEditingContact(null);
    setSheetOpen(true);
  }

  function openEditContact(c: Contact) {
    setEditingContact(c);
    setSheetOpen(true);
  }

  const score = useMemo(() => {
    if (!account) return null;
    return computeIntimacyScore(account, contacts);
  }, [account, contacts]);

  const headerActions = (
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
      <div className="segmented">
        <button className="segBtn" onClick={() => router.push("/today")}>Today</button>
        <button className="segBtn" onClick={() => router.push("/accounts")}>Accounts</button>
        <button className="segBtn" onClick={() => router.push("/weekly")}>Weekly Pack</button>
      </div>
      <button className="btn" onClick={loadAll} disabled={loading}>Refresh</button>
      <button className="btn btnPrimary" onClick={signOut}>Sign out</button>
    </div>
  );

  if (!accountId) {
    return (
      <main>
        <div className="topbar">
          <div>
            <h1 className="h1">Account</h1>
            <div className="subtle">Missing route parameter.</div>
          </div>
          {headerActions}
        </div>
        <div className="card">
          <div style={{ fontSize: 13, opacity: 0.9 }}>No account id found. Go back to Accounts.</div>
          <div style={{ height: 12 }} />
          <button className="btn" onClick={() => router.push("/accounts")}>Back to Accounts</button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">
        <div style={{ minWidth: 0 }}>
          <h1 className="h1" style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {account?.name ?? "Account"}
            </span>
            {score ? <ScorePill total={score.total} label={score.label} tone={score.tone} /> : null}
          </h1>

          <div className="subtle">
            {account ? (
              <>
                {account.tier} • {account.country ?? "—"} • {fmtMoney(account.value_usd)}
                {score ? (
                  <>
                    {" "}• last touch: {fmtLastTouch(score.d)} • cadence: {score.cadence}d • coverage: {score.coveredAreas}/{AREAS.length}
                  </>
                ) : null}
              </>
            ) : (
              "Loading…"
            )}
          </div>
        </div>

        {headerActions}
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
        </div>
      )}

      {/* Intimacy Score */}
      {score ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 16, letterSpacing: -0.2 }}>Intimacy score</div>
              <div className="subtle" style={{ marginTop: 4 }}>
                Recency: {score.recency}/60 • Coverage: {score.coverage}/40
                {score.missing.length > 0
                  ? ` • Missing: ${score.missing.join(", ")}`
                  : " • Coverage: full"}
              </div>
            </div>
            <button className="btn btnPrimary" onClick={() => setLogOpen(true)} disabled={!account}>
              Quick log
            </button>
          </div>
          <div style={{ height: 12 }} />
          <CoverageChips counts={score.counts} />
        </div>
      ) : (
        <div className="card" style={{ padding: 16 }}>
          <div className="subtle">Cargando score…</div>
        </div>
      )}

      <div style={{ height: 12 }} />

      {/* Contacts */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Contacts ({contacts.length})</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              Cubre todas las áreas. Hooks cortos y útiles.
            </div>
          </div>
          <button className="btn btnPrimary" onClick={openAddContact}>
            Add contact
          </button>
        </div>

        <div style={{ height: 12 }} />

        {contacts.length === 0 ? (
          <div className="subtle" style={{ fontSize: 13 }}>
            Sin contactos aún. Agrega al menos uno por área.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {contacts.map((c) => {
              const d = daysSince(c.last_touch_at);
              const lastTouch = fmtLastTouch(d);
              return (
                <div key={c.id} className="card" style={{ padding: 14 }}>
                  <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 16 }}>
                        {c.name}{" "}
                        <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
                          {c.area} • {channelLabel(c.preferred_channel)} • {lastTouch}
                        </span>
                      </div>
                      {c.personal_hook ? (
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                          Hook: {c.personal_hook}
                        </div>
                      ) : (
                        <div style={{ marginTop: 6, fontSize: 13, opacity: 0.5 }}>Hook: —</div>
                      )}
                      {c.email ? (
                        <div style={{ marginTop: 4, fontSize: 12, opacity: 0.6 }}>{c.email}</div>
                      ) : null}
                    </div>

                    <div className="row" style={{ gap: 10 }}>
                      <button className="btn" onClick={() => openEditContact(c)} style={{ height: 40 }}>
                        Edit
                      </button>
                      <button className="btn" onClick={() => deleteContact(c.id)} style={{ height: 40 }}>
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ height: 12 }} />

      {/* Recent interactions */}
      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 16 }}>Recent interactions</div>
        <div className="subtle" style={{ marginTop: 4 }}>Últimas 30 (por cuenta)</div>

        <div style={{ height: 12 }} />

        {interactions.length === 0 ? (
          <div className="subtle" style={{ fontSize: 13 }}>Sin interacciones aún.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {interactions.map((it) => {
              const contactName = contacts.find((c) => c.id === it.contact_id)?.name ?? null;
              return (
                <div key={it.id} className="card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>
                    {it.channel.toUpperCase()} •{" "}
                    {new Date(it.created_at).toLocaleDateString("es-PE")} •{" "}
                    {contactName ?? "sin contacto"}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>{it.summary}</div>
                  <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                    Next: {it.next_step} ({it.next_step_date})
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick Log Modal */}
      {account ? (
        <QuickLogModal
          open={logOpen}
          onClose={() => setLogOpen(false)}
          accountId={account.id}
          accountName={account.name}
          contacts={contacts}
          onSaved={loadAll}
        />
      ) : null}

      {/* Add / Edit Contact Sheet */}
      <AddContactSheet
        open={sheetOpen}
        mode={editingContact ? "edit" : "create"}
        accountId={accountId ?? ""}
        initial={editingContact}
        onClose={() => {
          setSheetOpen(false);
          setEditingContact(null);
        }}
        onSaved={loadAll}
      />
    </main>
  );
}