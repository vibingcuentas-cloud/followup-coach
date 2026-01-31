"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";

const AREA_OPTIONS = ["Marketing", "R&D", "Procurement", "Commercial", "Directors"] as const;
type Area = (typeof AREA_OPTIONS)[number];

type Account = {
  id: string;
  name: string;
  tier: "A" | "B" | "C";
  country: string | null;
  business_hook: string | null;
  last_interaction_at: string | null;
};

type Contact = {
  id: string;
  account_id: string;
  area: Area | string;
  name: string;
  role: string | null;
  preferred_channel: string | null;
  personal_hook: string | null;
};

type Interaction = {
  id: string;
  account_id: string;
  contact_id: string | null;
  channel: string;
  summary: string;
  next_step: string;
  next_step_date: string;
  created_at: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

export default function AccountDetailPage() {
  const router = useRouter();
  const params = useParams();
  const accountId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<Account | null>(null);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // add contact form
  const [area, setArea] = useState<Area>("R&D");
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pref, setPref] = useState("whatsapp");
  const [personalHook, setPersonalHook] = useState("");

  // edit contact state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editArea, setEditArea] = useState<Area>("R&D");
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editPref, setEditPref] = useState("whatsapp");
  const [editPersonalHook, setEditPersonalHook] = useState("");

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

    const { data: acc, error: accErr } = await supabase
      .from("accounts")
      .select("id,name,tier,country,business_hook,last_interaction_at")
      .eq("id", accountId)
      .maybeSingle();

    if (accErr) {
      setMsg(accErr.message);
      setLoading(false);
      return;
    }

    const { data: cons, error: conErr } = await supabase
      .from("contacts")
      .select("id,account_id,area,name,role,preferred_channel,personal_hook")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });

    if (conErr) {
      setMsg(conErr.message);
      setLoading(false);
      return;
    }

    const { data: ints, error: intErr } = await supabase
      .from("interactions")
      .select("id,account_id,contact_id,channel,summary,next_step,next_step_date,created_at")
      .eq("account_id", accountId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (intErr) {
      setMsg(intErr.message);
      setLoading(false);
      return;
    }

    setAccount((acc as Account) ?? null);
    setContacts((cons as Contact[]) ?? []);
    setInteractions((ints as Interaction[]) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    const user = await requireAuth();
    if (!user) return;

    if (!name.trim()) {
      setMsg("Contact name is required.");
      return;
    }

    const { error } = await supabase.from("contacts").insert({
      account_id: accountId,
      area,
      name: name.trim(),
      role: role.trim() ? role.trim() : null,
      preferred_channel: pref.trim() ? pref.trim() : null,
      personal_hook: personalHook.trim() ? personalHook.trim() : null,
    });

    if (error) {
      setMsg(error.message);
      return;
    }

    setArea("R&D");
    setName("");
    setRole("");
    setPref("whatsapp");
    setPersonalHook("");
    await loadAll();
  }

  function startEdit(c: Contact) {
    setEditingId(c.id);
    setEditArea(AREA_OPTIONS.includes(c.area as any) ? (c.area as Area) : "R&D");
    setEditName(c.name ?? "");
    setEditRole(c.role ?? "");
    setEditPref(c.preferred_channel ?? "whatsapp");
    setEditPersonalHook(c.personal_hook ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditArea("R&D");
    setEditName("");
    setEditRole("");
    setEditPref("whatsapp");
    setEditPersonalHook("");
  }

  async function saveEdit(id: string) {
    setMsg(null);

    if (!editName.trim()) {
      setMsg("Contact name is required.");
      return;
    }

    const { error } = await supabase
      .from("contacts")
      .update({
        area: editArea,
        name: editName.trim(),
        role: editRole.trim() ? editRole.trim() : null,
        preferred_channel: editPref.trim() ? editPref.trim() : null,
        personal_hook: editPersonalHook.trim() ? editPersonalHook.trim() : null,
      })
      .eq("id", id);

    if (error) {
      setMsg(error.message);
      return;
    }

    cancelEdit();
    await loadAll();
  }

  async function deleteContact(id: string) {
    setMsg(null);
    const { error } = await supabase.from("contacts").delete().eq("id", id);
    if (error) setMsg(error.message);
    await loadAll();
  }

  const lastTouchByContact = (() => {
    const m = new Map<string, string>();
    for (const i of interactions) {
      if (!i.contact_id) continue;
      if (!m.has(i.contact_id)) m.set(i.contact_id, i.created_at);
    }
    return m;
  })();

  if (loading) return <main><div className="card">Loading…</div></main>;

  if (!account) {
    return (
      <main>
        <div className="topbar">
          <div>
            <h1 className="h1">Account</h1>
            <div className="subtle">Not found.</div>
          </div>
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn" onClick={() => router.push("/accounts")}>Back</button>
          </div>
        </div>
        {msg && <div className="card">{msg}</div>}
      </main>
    );
  }

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">
            {account.name} <span style={{ color: "var(--muted)", fontWeight: 700 }}>({account.tier})</span>
          </h1>
          <div className="subtle">
            {account.country ?? "—"} • Last account touch:{" "}
            {account.last_interaction_at ? fmtDate(account.last_interaction_at) : "never"}
          </div>
        </div>

        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button className="btn" onClick={() => router.push("/today")}>Today</button>
          <button className="btn" onClick={() => router.push("/accounts")}>Accounts</button>
        </div>
      </div>

      {msg && <div className="card" style={{ marginBottom: 10 }}>{msg}</div>}

      <section>
        <div className="card">
          <div className="label">Business hook (account)</div>
          <div style={{ fontWeight: 900 }}>{account.business_hook ?? "—"}</div>
        </div>
      </section>

      <section style={{ marginTop: 14 }}>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Contacts</h2>
          <span className="badge">{contacts.length} total</span>
        </div>

        <div className="card" style={{ marginTop: 10 }}>
          <form className="grid" onSubmit={addContact}>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <div style={{ width: 200, minWidth: 180 }}>
                <div className="label">Area</div>
                <select className="field" value={area} onChange={(e) => setArea(e.target.value as Area)}>
                  {AREA_OPTIONS.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 2, minWidth: 220 }}>
                <div className="label">Name</div>
                <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>

              <div style={{ flex: 2, minWidth: 220 }}>
                <div className="label">Role (optional)</div>
                <input className="field" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g., Brand Manager" />
              </div>

              <div style={{ width: 200, minWidth: 180 }}>
                <div className="label">Preferred</div>
                <select className="field" value={pref} onChange={(e) => setPref(e.target.value)}>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="call">Call</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>

            <div>
              <div className="label">Personal hook (contact)</div>
              <input
                className="field"
                value={personalHook}
                onChange={(e) => setPersonalHook(e.target.value)}
                placeholder="e.g., kid birthday, travel, hobbies"
              />
            </div>

            <div className="row" style={{ justifyContent: "flex-end" }}>
              <button className="btn btnPrimary" type="submit">Add contact</button>
            </div>
          </form>
        </div>

        {contacts.length === 0 ? (
          <div className="card" style={{ marginTop: 10 }}>No contacts yet.</div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {contacts.map((c) => {
              const lastIso = lastTouchByContact.get(c.id) ?? null;
              const d = daysSince(lastIso);

              let status = "ok";
              if (d === null) status = "never";
              else if (d >= 14) status = "touch now";
              else if (d >= 7) status = "touch this week";

              const isEditing = editingId === c.id;

              return (
                <div key={c.id} className="card">
                  {!isEditing ? (
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div className="row" style={{ gap: 8, alignItems: "baseline" }}>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{c.name}</div>
                          <div style={{ color: "var(--muted)", fontSize: 13 }}>
                            {c.area}
                          </div>
                        </div>

                        <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                          {c.role ?? "—"} • Preferred: {c.preferred_channel ?? "—"} • Last:{" "}
                          {d === null ? "never" : `${d}d`} • <span className="badge">{status}</span>
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <div className="label">Personal hook</div>
                          <div style={{ fontWeight: 900 }}>{c.personal_hook ?? "—"}</div>
                        </div>
                      </div>

                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <button className="btn btnPrimary" onClick={() => startEdit(c)}>Edit</button>
                        <button className="btn btnDanger" onClick={() => deleteContact(c.id)}>Delete</button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid">
                      <div className="row" style={{ flexWrap: "wrap" }}>
                        <div style={{ width: 200, minWidth: 180 }}>
                          <div className="label">Area</div>
                          <select className="field" value={editArea} onChange={(e) => setEditArea(e.target.value as Area)}>
                            {AREA_OPTIONS.map((a) => (
                              <option key={a} value={a}>{a}</option>
                            ))}
                          </select>
                        </div>

                        <div style={{ flex: 2, minWidth: 220 }}>
                          <div className="label">Name</div>
                          <input className="field" value={editName} onChange={(e) => setEditName(e.target.value)} />
                        </div>

                        <div style={{ flex: 2, minWidth: 220 }}>
                          <div className="label">Role</div>
                          <input className="field" value={editRole} onChange={(e) => setEditRole(e.target.value)} />
                        </div>

                        <div style={{ width: 200, minWidth: 180 }}>
                          <div className="label">Preferred</div>
                          <select className="field" value={editPref} onChange={(e) => setEditPref(e.target.value)}>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="call">Call</option>
                            <option value="email">Email</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <div className="label">Personal hook</div>
                        <input
                          className="field"
                          value={editPersonalHook}
                          onChange={(e) => setEditPersonalHook(e.target.value)}
                        />
                      </div>

                      <div className="row" style={{ justifyContent: "flex-end" }}>
                        <button className="btn btnPrimary" onClick={() => saveEdit(c.id)}>Save</button>
                        <button className="btn" onClick={cancelEdit}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section style={{ marginTop: 14 }}>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 900 }}>Recent interactions</h2>
          <span className="badge">latest 15</span>
        </div>

        {interactions.length === 0 ? (
          <div className="card" style={{ marginTop: 10 }}>No interactions yet.</div>
        ) : (
          <div style={{ marginTop: 10 }}>
            {interactions.slice(0, 15).map((i) => (
              <div key={i.id} className="card">
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {fmtDate(i.created_at)} • {i.channel} {i.contact_id ? "• contact" : ""}
                </div>
                <div style={{ marginTop: 8, fontWeight: 900 }}>{i.summary}</div>
                <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
                  Next: {i.next_step} — {i.next_step_date}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}