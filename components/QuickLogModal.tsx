"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Channel = "call" | "whatsapp" | "email";
type Area = "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors";

type Contact = {
  id: string;
  name: string;
  area: Area;
  preferred_channel: Channel | null;
  personal_hook: string | null;
  last_touch_at: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  contacts: Contact[];
  onSaved: () => void | Promise<void>;
};

function daysSince(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  return diff < 0 ? 0 : diff;
}

export default function QuickLogModal({
  open,
  onClose,
  accountId,
  accountName,
  contacts,
  onSaved,
}: Props) {
  const [contactId, setContactId] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("call");

  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDate, setNextStepDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });

  const [objectionTag, setObjectionTag] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  const [riskT, setRiskT] = useState(false);
  const [riskR, setRiskR] = useState(false);
  const [riskC, setRiskC] = useState(false);

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const sortedContacts = useMemo(() => {
    // Prioriza contactos "menos tocados" primero (null = nunca = prioridad),
    // y luego por días desde último toque (más viejo = prioridad)
    return [...(contacts ?? [])].sort((a, b) => {
      const da = daysSince(a.last_touch_at);
      const db = daysSince(b.last_touch_at);
      const va = da == null ? 999999 : da;
      const vb = db == null ? 999999 : db;
      return vb - va; // más días = más prioridad
    });
  }, [contacts]);

  const selected = useMemo(
    () => (contacts ?? []).find((c) => c.id === contactId) ?? null,
    [contacts, contactId]
  );

  useEffect(() => {
    if (!open) return;

    // default contact: el de mayor prioridad (más “due”)
    const first = sortedContacts[0];
    if (first) {
      setContactId(first.id);
      setChannel((first.preferred_channel ?? "call") as Channel);
    } else {
      setContactId("");
      setChannel("call");
    }
    // no reset de summary para no perder si cierras/abres accidentalmente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function save() {
    setMsg(null);

    if (!contacts || contacts.length === 0) {
      setMsg("You need at least 1 contact to log an interaction.");
      return;
    }
    if (!contactId) {
      setMsg("Contact is required.");
      return;
    }
    if (!summary.trim()) {
      setMsg("Summary is required.");
      return;
    }
    if (!nextStep.trim()) {
      setMsg("Next step is required.");
      return;
    }
    if (!nextStepDate) {
      setMsg("Next step date is required.");
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();

      // 1) create interaction (now requires contact_id)
      const { error: interr } = await supabase.from("interactions").insert({
        account_id: accountId,
        contact_id: contactId,
        channel,
        summary: summary.trim(),
        objection_tag: objectionTag.trim() ? objectionTag.trim() : null,
        target_price: targetPrice.trim() ? targetPrice.trim() : null,
        risk_technical: riskT,
        risk_regulatory: riskR,
        risk_commercial: riskC,
        next_step: nextStep.trim(),
        next_step_date: nextStepDate,
      });

      if (interr) throw interr;

      // 2) update account last_interaction_at
      const { error: accErr } = await supabase
        .from("accounts")
        .update({ last_interaction_at: nowIso })
        .eq("id", accountId);

      if (accErr) throw accErr;

      // 3) update contact last_touch_at (THIS IS INTIMACY)
      const { error: cErr } = await supabase
        .from("contacts")
        .update({ last_touch_at: nowIso })
        .eq("id", contactId);

      if (cErr) throw cErr;

      await onSaved();
      onClose();

      // reset fields
      setSummary("");
      setNextStep("");
      setObjectionTag("");
      setTargetPrice("");
      setRiskT(false);
      setRiskR(false);
      setRiskC(false);
    } catch (e: any) {
      setMsg(e?.message ?? "Could not save");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "grid",
        placeItems: "center",
        padding: 16,
        zIndex: 70,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{
          width: "100%",
          maxWidth: 560,
          padding: 16,
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Quick Log</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              {accountName}
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ height: 40 }}>
            Close
          </button>
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Contact (required)</div>
            <select
              className="field"
              value={contactId}
              onChange={(e) => {
                const id = e.target.value;
                setContactId(id);
                const c = contacts.find((x) => x.id === id);
                if (c?.preferred_channel) setChannel(c.preferred_channel as Channel);
              }}
            >
              {(sortedContacts ?? []).map((c) => {
                const d = daysSince(c.last_touch_at);
                const last = d == null ? "never" : d === 0 ? "today" : `${d}d`;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.area}) • pref: {c.preferred_channel ?? "—"} • last: {last}
                  </option>
                );
              })}
            </select>
            {selected?.personal_hook ? (
              <div className="subtle" style={{ marginTop: 4 }}>
                Hook: {selected.personal_hook}
              </div>
            ) : null}
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Channel</div>
            <select
              className="field"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
            >
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Summary (required)</div>
            <textarea
              className="field"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="What happened? Key outcome?"
              style={{ resize: "vertical" }}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Next step (required)</div>
              <input
                className="field"
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="Next step action"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Next step date</div>
              <input
                className="field"
                value={nextStepDate}
                onChange={(e) => setNextStepDate(e.target.value)}
                type="date"
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Objection tag (optional)</div>
              <input
                className="field"
                value={objectionTag}
                onChange={(e) => setObjectionTag(e.target.value)}
                placeholder="e.g., price, timing"
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Target price (optional)</div>
              <input
                className="field"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g., 12.5 USD/kg"
              />
            </label>
          </div>

          <div className="row" style={{ gap: 14, flexWrap: "wrap" }}>
            <label className="row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={riskT} onChange={(e) => setRiskT(e.target.checked)} />
              <span style={{ fontSize: 13, opacity: 0.9 }}>Risk: Technical</span>
            </label>
            <label className="row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={riskR} onChange={(e) => setRiskR(e.target.checked)} />
              <span style={{ fontSize: 13, opacity: 0.9 }}>Risk: Regulatory</span>
            </label>
            <label className="row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" checked={riskC} onChange={(e) => setRiskC(e.target.checked)} />
              <span style={{ fontSize: 13, opacity: 0.9 }}>Risk: Commercial</span>
            </label>
          </div>

          {msg && <div style={{ fontSize: 13, opacity: 0.9 }}>{msg}</div>}

          <button className="btn btnPrimary" disabled={loading} onClick={save} style={{ height: 44 }}>
            {loading ? "Saving..." : "Save log"}
          </button>

          <div className="subtle" style={{ fontSize: 12 }}>
            Rule: every interaction must be linked to a contact.
          </div>
        </div>
      </div>
    </div>
  );
}