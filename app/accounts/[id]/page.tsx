"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import QuickLogModal from "../../../components/QuickLogModal";

export const dynamic = "force-dynamic";

type Area = "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors";
type Channel = "call" | "whatsapp" | "email";

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
  area: Area;
  preferred_channel: Channel | null;
  personal_hook: string | null;
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
  // UUID v4-ish validation (suficiente para evitar "undefined" y basura)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

function cadenceDays(tier: "A" | "B" | "C") {
  if (tier === "A") return 7;
  if (tier === "B") return 14;
  return 30;
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

  // Contacts form
  const [cName, setCName] = useState("");
  const [cEmail, setCEmail] = useState("");
  const [cArea, setCArea] = useState<Area>("Marketing");
  const [cPreferred, setCPreferred] = useState<Channel>("whatsapp");
  const [cHook, setCHook] = useState("");

  // Edit contact
  const [editing, setEditing] = useState<Contact | null>(null);

  // Quick log modal
  const [logOpen, setLogOpen] = useState(false);

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
        .select("id,account_id,name,email,area,preferred_channel,personal_hook,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      const interQ = supabase
        .from("interactions")
        .select(
          "id,account_id,contact_id,channel,summary,next_step,next_step_date,created_at"
        )
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(30);

      const [{ data: acc, error: accErr }, { data: cts, error: cErr }, { data: its, error: iErr }] =
        await Promise.all([accQ, contactsQ, interQ]);

      if (accErr) throw accErr;
      if (cErr) throw cErr;
      if (iErr) throw iErr;

      setAccount(acc as Account);
      setContacts((cts ?? []) as Contact[]);
      setInteractions((its ?? []) as Interaction[]);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not load account");
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

  async function addContact() {
    setMsg(null);

    if (!accountId || !isUuid(accountId)) return setMsg("Invalid account id.");
    const nm = cName.trim();
    if (!nm) return setMsg("Contact name is required.");

    const email = cEmail.trim() ? cEmail.trim() : null;
    const hook = cHook.trim() ? cHook.trim() : null;

    setLoading(true);
    try {
      await requireUser();

      const { error } = await supabase.from("contacts").insert({
        account_id: accountId,
        name: nm,
        email,
        area: cArea,
        preferred_channel: cPreferred,
        personal_hook: hook,
      });

      if (error) throw error;

      setCName("");
      setCEmail("");
      setCArea("Marketing");
      setCPreferred("whatsapp");
      setCHook("");

      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ?? "Could not add contact");
    } finally {
      setLoading(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setMsg(null);

    const nm = editing.name.trim();
    if (!nm) return setMsg("Contact name is required.");

    setLoading(true);
    try {
      await requireUser();

      const { error } = await supabase
        .from("contacts")
        .update({
          name: nm,
          email: editing.email?.trim() ? editing.email.trim() : null,
          area: editing.area,
          preferred_channel: editing.preferred_channel,
          personal_hook: editing.personal_hook?.trim() ? editing.personal_hook.trim() : null,
        })
        .eq("id", editing.id);

      if (error) throw error;

      setEditing(null);
      await loadAll();
    } catch (e: any) {
      setMsg(e?.message ?? "Could not update contact");
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

  const headerActions = (
    <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
      <div className="segmented">
        <button className="segBtn" onClick={() => router.push("/today")}>
          Today
        </button>
        <button className="segBtn" onClick={() => router.push("/accounts")}>
          Accounts
        </button>
        <button className="segBtn" onClick={() => router.push("/weekly")}>
          Weekly Pack
        </button>
      </div>
      <button className="btn" onClick={loadAll} disabled={loading}>
        Refresh
      </button>
      <button className="btn btnPrimary" onClick={signOut}>
        Sign out
      </button>
    </div>
  );

  const coverage = useMemo(() => {
    const areas: Area[] = ["Marketing", "R&D", "Procurement", "Commercial", "Directors"];
    const counts = Object.fromEntries(areas.map((a) => [a, 0])) as Record<Area, number>;
    for (const c of contacts) counts[c.area] = (counts[c.area] ?? 0) + 1;

    const covered = areas.filter((a) => (counts[a] ?? 0) >= 1).length;
    return { counts, covered, total: areas.length, areas };
  }, [contacts]);

  const intimacy = useMemo(() => {
    if (!account) return null;
    const d = daysSince(account.last_interaction_at);
    const cadence = cadenceDays(account.tier);
    const status = d == null ? "no touch" : d <= cadence ? "ok" : "due";
    return { d, cadence, status };
  }, [account]);

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
          <div style={{ fontSize: 13, opacity: 0.9 }}>
            No account id found. Go back to Accounts.
          </div>
          <div style={{ height: 12 }} />
          <button className="btn" onClick={() => router.push("/accounts")}>
            Back to Accounts
          </button>
        </div>
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">{account?.name ?? "Account"}</h1>
          <div className="subtle">
            {account ? (
              <>
                {account.tier} • {account.country ?? "—"} •{" "}
                {account.value_usd ? `$${Number(account.value_usd).toLocaleString("en-US")}` : "—"}
                {"  "}
                {intimacy ? (
                  <>
                    • last touch: {intimacy.d == null ? "never" : `${intimacy.d}d`} •{" "}
                    {intimacy.status} • coverage: {coverage.covered}/{coverage.total}
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

      {/* Coverage */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Coverage</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              Goal: cover all areas with at least 1 contact. Strong = 2+.
            </div>
          </div>
          <button className="btn btnPrimary" onClick={() => setLogOpen(true)} disabled={!account}>
            Quick log
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          {coverage.areas.map((a) => {
            const n = coverage.counts[a] ?? 0;
            const ok = n >= 1;
            const strong = n >= 2;
            return (
              <div
                key={a}
                className="pill"
                style={{
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  borderRadius: 999,
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    background: ok ? "rgba(120,255,180,0.9)" : "rgba(255,120,120,0.9)",
                    boxShadow: "0 0 0 3px rgba(255,255,255,0.06)",
                  }}
                />
                <span style={{ fontWeight: 800 }}>{a}</span>
                <span style={{ opacity: 0.75 }}>{n}</span>
                {strong ? <span style={{ opacity: 0.7 }}>• strong</span> : null}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 12 }} />

      {/* Contacts */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Contacts ({contacts.length})</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              Hooks are per contact. Keep it short and useful.
            </div>
          </div>
          <button
            className="btn btnPrimary"
            onClick={() => {
              // scroll to add form (simple)
              const el = document.getElementById("add-contact");
              el?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
          >
            Add contact
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div id="add-contact" className="card" style={{ padding: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 10,
              gridTemplateColumns: "1.2fr 1.2fr 160px 160px 1.2fr auto",
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
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Area</div>
              <select
                className="field"
                value={cArea}
                onChange={(e) => setCArea(e.target.value as Area)}
              >
                <option value="Marketing">Marketing</option>
                <option value="R&D">R&amp;D</option>
                <option value="Procurement">Procurement</option>
                <option value="Commercial">Commercial</option>
                <option value="Directors">Directors</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Preferred</div>
              <select
                className="field"
                value={cPreferred}
                onChange={(e) => setCPreferred(e.target.value as Channel)}
              >
                <option value="call">call</option>
                <option value="whatsapp">whatsapp</option>
                <option value="email">email</option>
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Personal hook (optional)</div>
              <input
                className="field"
                value={cHook}
                onChange={(e) => setCHook(e.target.value)}
                placeholder="e.g., likes tennis"
              />
            </label>

            <button
              className="btn btnPrimary"
              onClick={addContact}
              disabled={loading}
              style={{ height: 44, borderRadius: 16, padding: "0 16px" }}
            >
              Add
            </button>
          </div>
        </div>

        <div style={{ height: 12 }} />

        {contacts.length === 0 ? (
          <div className="subtle" style={{ fontSize: 13 }}>
            No contacts yet. Add at least one per area.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {contacts.map((c) => (
              <div key={c.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
                  <div>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {c.name}{" "}
                      <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
                        {c.area} • {c.preferred_channel ?? "—"}
                      </span>
                    </div>
                    {c.personal_hook ? (
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                        Hook: {c.personal_hook}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.6 }}>
                        Hook: —
                      </div>
                    )}
                    {c.email ? (
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.6 }}>{c.email}</div>
                    ) : null}
                  </div>

                  <div className="row" style={{ gap: 10 }}>
                    <button className="btn" onClick={() => setEditing(c)} style={{ height: 40 }}>
                      Edit
                    </button>
                    <button
                      className="btn"
                      onClick={() => deleteContact(c.id)}
                      style={{ height: 40 }}
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

      {/* Recent interactions */}
      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 16 }}>Recent interactions</div>
        <div className="subtle" style={{ marginTop: 4 }}>
          Latest 30 (per account)
        </div>

        <div style={{ height: 12 }} />

        {interactions.length === 0 ? (
          <div className="subtle" style={{ fontSize: 13 }}>
            No interactions yet.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {interactions.map((it) => (
              <div key={it.id} className="card" style={{ padding: 14 }}>
                <div style={{ fontWeight: 900, fontSize: 13, letterSpacing: 0.2 }}>
                  {it.channel.toUpperCase()} •{" "}
                  {new Date(it.created_at).toLocaleDateString("en-US")} •{" "}
                  {it.contact_id ? "contact-linked" : "no contact"}
                </div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>{it.summary}</div>
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                  Next: {it.next_step} ({it.next_step_date})
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Log */}
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

      {/* Edit Contact Modal */}
      {editing ? (
        <div
          onClick={() => setEditing(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "grid",
            placeItems: "center",
            padding: 16,
            zIndex: 60,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{ width: "100%", maxWidth: 520, padding: 16 }}
          >
            <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 16 }}>Edit contact</div>
                <div className="subtle" style={{ marginTop: 4 }}>
                  Keep it clean. Keep it useful.
                </div>
              </div>
              <button className="btn" onClick={() => setEditing(null)}>
                Close
              </button>
            </div>

            <div style={{ height: 12 }} />

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <div className="label">Name</div>
                <input
                  className="field"
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                <div className="label">Email (optional)</div>
                <input
                  className="field"
                  value={editing.email ?? ""}
                  onChange={(e) => setEditing({ ...editing, email: e.target.value })}
                />
              </label>

              <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
                <label style={{ display: "grid", gap: 6 }}>
                  <div className="label">Area</div>
                  <select
                    className="field"
                    value={editing.area}
                    onChange={(e) => setEditing({ ...editing, area: e.target.value as Area })}
                  >
                    <option value="Marketing">Marketing</option>
                    <option value="R&D">R&amp;D</option>
                    <option value="Procurement">Procurement</option>
                    <option value="Commercial">Commercial</option>
                    <option value="Directors">Directors</option>
                  </select>
                </label>

                <label style={{ display: "grid", gap: 6 }}>
                  <div className="label">Preferred</div>
                  <select
                    className="field"
                    value={editing.preferred_channel ?? "whatsapp"}
                    onChange={(e) =>
                      setEditing({ ...editing, preferred_channel: e.target.value as Channel })
                    }
                  >
                    <option value="call">call</option>
                    <option value="whatsapp">whatsapp</option>
                    <option value="email">email</option>
                  </select>
                </label>
              </div>

              <label style={{ display: "grid", gap: 6 }}>
                <div className="label">Personal hook (optional)</div>
                <input
                  className="field"
                  value={editing.personal_hook ?? ""}
                  onChange={(e) => setEditing({ ...editing, personal_hook: e.target.value })}
                />
              </label>

              <button className="btn btnPrimary" onClick={saveEdit} disabled={loading}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}