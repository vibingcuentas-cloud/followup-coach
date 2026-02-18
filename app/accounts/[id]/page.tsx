"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import QuickLogModal from "../../../components/QuickLogModal";

export const dynamic = "force-dynamic";

type Account = {
  id: string;
  name: string;
  tier: "A" | "B" | "C";
  country: string | null;
  value_usd: number | null;
  last_interaction_at: string | null;
};

type Contact = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  area: "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors" | null;
  preferred_channel: "call" | "whatsapp" | "email" | null;
  personal_hook: string | null;
  created_at: string;
};

type Interaction = {
  id: string;
  account_id: string;
  contact_id: string | null;
  channel: "call" | "whatsapp" | "email";
  summary: string;
  next_step: string;
  next_step_date: string;
  created_at: string;
};

function fmtMoney(n: number | null) {
  if (n == null || Number.isNaN(n)) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${n}`;
  }
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  const diff = Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

const AREA_OPTIONS: Contact["area"][] = [
  "Marketing",
  "R&D",
  "Procurement",
  "Commercial",
  "Directors",
];

const CHANNEL_OPTIONS: Array<Contact["preferred_channel"]> = [
  "call",
  "whatsapp",
  "email",
];

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = String(params?.id ?? "");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);

  // Quick log modal (can log by account and optionally by contact)
  const [logOpen, setLogOpen] = useState(false);

  // Contact form (add/edit)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cArea, setCArea] = useState<Contact["area"]>("R&D");
  const [cPreferred, setCPreferred] = useState<Contact["preferred_channel"]>("whatsapp");
  const [cHook, setCHook] = useState("");

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
  }

  async function loadAll() {
    setMsg(null);
    setLoading(true);
    try {
      await requireUser();

      const { data: acc, error: accErr } = await supabase
        .from("accounts")
        .select("id,name,tier,country,value_usd,last_interaction_at")
        .eq("id", accountId)
        .maybeSingle();

      if (accErr) throw accErr;
      if (!acc) throw new Error("Account not found");
      setAccount(acc as Account);

      const { data: cons, error: conErr } = await supabase
        .from("contacts")
        .select(
          "id,account_id,name,email,area,preferred_channel,personal_hook,created_at"
        )
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (conErr) throw conErr;
      setContacts((cons ?? []) as Contact[]);

      const { data: inters, error: iErr } = await supabase
        .from("interactions")
        .select(
          "id,account_id,contact_id,channel,summary,next_step,next_step_date,created_at"
        )
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(30);

      if (iErr) throw iErr;
      setInteractions((inters ?? []) as Interaction[]);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not load account");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!accountId) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  function resetContactForm() {
    setEditingId(null);
    setCName("");
    setCEmail("");
    setCArea("R&D");
    setCPreferred("whatsapp");
    setCHook("");
  }

  function startEdit(c: Contact) {
    setEditingId(c.id);
    setCName(c.name ?? "");
    setCEmail(c.email ?? "");
    setCArea((c.area ?? "R&D") as any);
    setCPreferred((c.preferred_channel ?? "whatsapp") as any);
    setCHook(c.personal_hook ?? "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveContact() {
    setMsg(null);

    const nm = cName.trim();
    if (!nm) return setMsg("Contact name is required.");

    setLoading(true);
    try {
      await requireUser();

      const payload = {
        account_id: accountId,
        name: nm,
        email: cEmail.trim() ? cEmail.trim() : null,
        area: cArea ?? null,
        preferred_channel: cPreferred ?? null,
        personal_hook: cHook.trim() ? cHook.trim() : null,
      };

      if (editingId) {
        const { error } = await supabase
          .from("contacts")
          .update(payload)
          .eq("id", editingId);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("contacts").insert(payload);
        if (error) throw error;
      }

      resetContactForm();
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ?? "Could not save contact");
    } finally {
      setLoading(false);
    }
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
      setMsg(e?.message ?? "Could not delete contact");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const headerActions = (
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
      <button className="btn" onClick={() => router.push("/today")}>
        Today
      </button>
      <button className="btn" onClick={() => router.push("/accounts")}>
        Accounts
      </button>
      <button className="btn" onClick={() => router.push("/weekly")}>
        Weekly Pack
      </button>
      <button className="btn" onClick={loadAll} disabled={loading}>
        Refresh
      </button>
      <button className="btn btnPrimary" onClick={signOut}>
        Sign out
      </button>
    </div>
  );

  const contactsById = useMemo(() => {
    const m = new Map<string, Contact>();
    for (const c of contacts) m.set(c.id, c);
    return m;
  }, [contacts]);

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">{account?.name ?? "Account"}</h1>
          <div className="subtle">
            {account
              ? `${account.tier} • ${account.country ?? "—"} • Value: ${fmtMoney(
                  account.value_usd
                )}`
              : "Loading..."}
          </div>
        </div>
        {headerActions}
      </div>

      {msg && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
        </div>
      )}

      {/* CONTACTS */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              Contacts {contacts.length ? `(${contacts.length})` : ""}
            </div>
            <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
              Hooks are per contact. Keep it short and useful.
            </div>
          </div>

          <button
            className="btn btnPrimary"
            onClick={() => setLogOpen(true)}
            style={{ height: 40, borderRadius: 14 }}
            disabled={!account}
          >
            Quick log
          </button>
        </div>

        <div style={{ height: 12 }} />

        {/* Add/Edit Contact Form */}
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "1.2fr 1.2fr 160px 180px 1.2fr auto",
            alignItems: "end",
          }}
        >
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Name</div>
            <input
              className="field"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
              placeholder="e.g., Gonzalo Brenner"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Email (optional)</div>
            <input
              className="field"
              value={cEmail}
              onChange={(e) => setCEmail(e.target.value)}
              placeholder="name@company.com"
              inputMode="email"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Area</div>
            <select
              className="field"
              value={cArea ?? ""}
              onChange={(e) => setCArea(e.target.value as any)}
            >
              {AREA_OPTIONS.map((a) => (
                <option key={a} value={a ?? ""}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Preferred</div>
            <select
              className="field"
              value={cPreferred ?? ""}
              onChange={(e) => setCPreferred(e.target.value as any)}
            >
              {CHANNEL_OPTIONS.map((ch) => (
                <option key={ch ?? ""} value={ch ?? ""}>
                  {ch}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Personal hook (optional)</div>
            <input
              className="field"
              value={cHook}
              onChange={(e) => setCHook(e.target.value)}
              placeholder="e.g., kid birthday, travel, hobby"
            />
          </label>

          <div className="row" style={{ gap: 10, justifyContent: "flex-end" }}>
            {editingId && (
              <button
                className="btn"
                onClick={resetContactForm}
                style={{ height: 44, borderRadius: 16 }}
                disabled={loading}
              >
                Cancel
              </button>
            )}
            <button
              className="btn btnPrimary"
              onClick={saveContact}
              style={{ height: 44, borderRadius: 16 }}
              disabled={loading}
            >
              {editingId ? "Update" : "Add"}
            </button>
          </div>
        </div>

        <div style={{ height: 14 }} />

        {contacts.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No contacts yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {contacts.map((c) => (
              <div
                key={c.id}
                className="card"
                style={{ background: "rgba(255,255,255,0.03)" }}
              >
                <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {c.name}{" "}
                      <span style={{ fontWeight: 700, opacity: 0.7, fontSize: 13 }}>
                        {c.area ?? "—"} • {c.preferred_channel ?? "—"}
                      </span>
                    </div>
                    <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85 }}>
                      {c.personal_hook ? (
                        <>Hook: {c.personal_hook}</>
                      ) : (
                        <span style={{ opacity: 0.7 }}>No personal hook yet.</span>
                      )}
                      {c.email ? (
                        <span style={{ opacity: 0.7 }}> • {c.email}</span>
                      ) : null}
                    </div>
                  </div>

                  <div className="row" style={{ gap: 10, alignItems: "center" }}>
                    <button
                      className="btn"
                      onClick={() => startEdit(c)}
                      style={{ height: 40, borderRadius: 14 }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn"
                      onClick={() => deleteContact(c.id)}
                      style={{ height: 40, borderRadius: 14 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 12 }} />

      {/* INTERACTIONS */}
      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 16 }}>Recent interactions</div>
        <div style={{ marginTop: 4, fontSize: 13, opacity: 0.75 }}>
          Latest 30 (per account)
        </div>

        <div style={{ height: 12 }} />

        {interactions.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.8 }}>No interactions yet.</div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {interactions.map((i) => {
              const c = i.contact_id ? contactsById.get(i.contact_id) : null;
              const d = daysSince(i.created_at);
              const when = d == null ? "—" : d === 0 ? "today" : `${d}d`;

              return (
                <div
                  key={i.id}
                  className="card"
                  style={{ background: "rgba(255,255,255,0.03)" }}
                >
                  <div
                    className="row"
                    style={{ justifyContent: "space-between", gap: 12 }}
                  >
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 15 }}>
                        {i.channel.toUpperCase()} • {when}
                        {c ? (
                          <span style={{ fontWeight: 700, opacity: 0.7, marginLeft: 8 }}>
                            {c.name} ({c.area ?? "—"})
                          </span>
                        ) : (
                          <span style={{ fontWeight: 700, opacity: 0.7, marginLeft: 8 }}>
                            (no contact selected)
                          </span>
                        )}
                      </div>

                      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
                        {i.summary}
                      </div>

                      <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                        Next: {i.next_step} ({i.next_step_date})
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <QuickLogModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        accountId={accountId}
        accountName={account?.name ?? ""}
        contacts={contacts}
        onSaved={loadAll}
      />
    </main>
  );
}
