"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import QuickLogModal from "../../../components/QuickLogModal";

export const dynamic = "force-dynamic";

type Area = "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors";
type Channel = "call" | "whatsapp" | "email";
type Tier = "A" | "B" | "C";

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

const AREAS: Area[] = ["Marketing", "R&D", "Procurement", "Commercial", "Directors"];

function isUuid(v: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    v
  );
}

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
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

function cadenceDays(tier: Tier) {
  if (tier === "A") return 7;
  if (tier === "B") return 14;
  return 30;
}

function computeIntimacyScore(account: Account, contacts: Contact[]) {
  const cadence = cadenceDays(account.tier);
  const d = daysSince(account.last_interaction_at);

  // Recency 0–60
  let recency = 0;
  if (d != null) {
    if (d <= cadence) recency = 60;
    else recency = Math.max(0, 60 - (d - cadence) * 5);
  }

  // Coverage 0–40
  const counts: Record<Area, number> = {
    Marketing: 0,
    "R&D": 0,
    Procurement: 0,
    Commercial: 0,
    Directors: 0,
  };
  for (const c of contacts) counts[c.area] = (counts[c.area] ?? 0) + 1;

  const coveredAreas = AREAS.reduce((acc, ar) => acc + ((counts[ar] ?? 0) > 0 ? 1 : 0), 0);
  const coverage = Math.round((coveredAreas / AREAS.length) * 40);

  const total = Math.max(0, Math.min(100, Math.round(recency + coverage)));

  const label = total >= 80 ? "Strong" : total >= 55 ? "Ok" : "Risk";
  const tone = total >= 80 ? "good" : total >= 55 ? "neutral" : "warn";

  return {
    total,
    label,
    tone: tone as "good" | "neutral" | "warn",
    recency: Math.round(recency),
    coverage,
    counts,
    coveredAreas,
    missing: AREAS.filter((ar) => (counts[ar] ?? 0) === 0),
    cadence,
    d,
  };
}

function channelLabel(ch: Channel | null) {
  if (!ch) return "—";
  if (ch === "call") return "call";
  if (ch === "whatsapp") return "whatsapp";
  return "email";
}

function areaShort(a: Area) {
  if (a === "Marketing") return "Mkt";
  if (a === "R&D") return "R&D";
  if (a === "Procurement") return "Proc";
  if (a === "Commercial") return "Comm";
  return "Dir";
}

function ScorePill({
  total,
  label,
  tone,
}: {
  total: number;
  label: string;
  tone: "good" | "neutral" | "warn";
}) {
  const styles =
    tone === "good"
      ? { borderColor: "rgba(80,220,160,0.35)", background: "rgba(80,220,160,0.08)" }
      : tone === "warn"
      ? { borderColor: "rgba(255,120,120,0.35)", background: "rgba(255,120,120,0.08)" }
      : { borderColor: "rgba(255,255,255,0.18)", background: "rgba(255,255,255,0.06)" };

  return (
    <span className="pill" style={{ ...styles, opacity: 0.95 }}>
      {total} {label}
    </span>
  );
}

function CoverageChips({ counts }: { counts: Record<Area, number> }) {
  return (
    <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
      {AREAS.map((ar) => {
        const n = counts[ar] ?? 0;
        const ok = n > 0;
        return (
          <span
            key={ar}
            className="pill"
            style={{
              opacity: 0.95,
              borderColor: ok ? "rgba(80,220,160,0.35)" : "rgba(255,120,120,0.35)",
              background: ok ? "rgba(80,220,160,0.08)" : "rgba(255,120,120,0.08)",
              color: "rgba(255,255,255,0.92)",
            }}
            title={ok ? `${ar}: ${n}` : `${ar}: missing`}
          >
            {areaShort(ar)} {n}
          </span>
        );
      })}
    </div>
  );
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
        // pedimos last_touch_at si existe en tu tabla (si no existe, supabase ignora y lanza error; por eso lo dejamos fuera del select original)
        .select("id,account_id,name,email,area,preferred_channel,personal_hook,created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      const interQ = supabase
        .from("interactions")
        .select("id,account_id,contact_id,channel,summary,next_step,next_step_date,created_at")
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

  const score = useMemo(() => {
    if (!account) return null;
    return computeIntimacyScore(account, contacts);
  }, [account, contacts]);

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
                    {" "}
                    • last touch: {score.d == null ? "never" : `${score.d}d`} • cadence: {score.cadence}d •{" "}
                    coverage: {score.coveredAreas}/{AREAS.length}
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

      {/* Intimacy Summary */}
      {score ? (
        <div className="card" style={{ padding: 16 }}>
          <div className="row" style={{ justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontWeight: 950, fontSize: 16, letterSpacing: -0.2 }}>Intimacy score</div>
              <div className="subtle" style={{ marginTop: 4 }}>
                Recency: {score.recency}/60 • Coverage: {score.coverage}/40
                {score.missing.length > 0 ? ` • Missing: ${score.missing.join(", ")}` : " • Coverage: full"}
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
          <div className="subtle">Score loading…</div>
        </div>
      )}

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
              <select className="field" value={cArea} onChange={(e) => setCArea(e.target.value as Area)}>
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
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 900, fontSize: 16 }}>
                      {c.name}{" "}
                      <span style={{ opacity: 0.7, fontWeight: 700, fontSize: 13 }}>
                        {c.area} • {channelLabel(c.preferred_channel)}
                      </span>
                    </div>

                    {c.personal_hook ? (
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>
                        Hook: {c.personal_hook}
                      </div>
                    ) : (
                      <div style={{ marginTop: 6, fontSize: 13, opacity: 0.6 }}>Hook: —</div>
                    )}

                    {c.email ? (
                      <div style={{ marginTop: 4, fontSize: 12, opacity: 0.6 }}>{c.email}</div>
                    ) : null}
                  </div>

                  <div className="row" style={{ gap: 10 }}>
                    <button className="btn" onClick={() => setEditing(c)} style={{ height: 40 }}>
                      Edit
                    </button>
                    <button className="btn" onClick={() => deleteContact(c.id)} style={{ height: 40 }}>
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
                  {it.channel.toUpperCase()} • {new Date(it.created_at).toLocaleDateString("en-US")} •{" "}
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
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: "100%", maxWidth: 520, padding: 16 }}>
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
                <input className="field" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
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
                  <select className="field" value={editing.area} onChange={(e) => setEditing({ ...editing, area: e.target.value as Area })}>
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
                    onChange={(e) => setEditing({ ...editing, preferred_channel: e.target.value as Channel })}
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