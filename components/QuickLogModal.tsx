
"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Channel = "call" | "whatsapp" | "email";

export type Contact = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  area: "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors";
  preferred_channel: Channel | null;
  personal_hook: string | null;
  // ✅ importante: permitir undefined porque TS te está diciendo que llega así en algún lado
  last_touch_at?: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  contacts: Contact[];
  onSaved: () => Promise<void>;
};

function daysSince(iso?: string | null) {
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
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [contactId, setContactId] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDate, setNextStepDate] = useState("");

  // default selection: primero el recomendado (never / más viejo)
  const recommendedId = useMemo(() => {
    if (!contacts || contacts.length === 0) return "";
    const sorted = [...contacts].sort((a, b) => {
      const da = daysSince(a.last_touch_at);
      const db = daysSince(b.last_touch_at);
      const aNever = da == null;
      const bNever = db == null;
      if (aNever && !bNever) return -1;
      if (!aNever && bNever) return 1;
      return (db ?? -1) - (da ?? -1);
    });
    return sorted[0]?.id ?? "";
  }, [contacts]);

  useEffect(() => {
    if (!open) return;
    setMsg(null);
    setSummary("");
    setNextStep("");
    setNextStepDate("");
    setChannel("whatsapp");
    setContactId(recommendedId);
  }, [open, recommendedId]);

  if (!open) return null;

  async function save() {
    setMsg(null);
    if (!summary.trim()) return setMsg("Summary is required.");
    if (!nextStep.trim()) return setMsg("Next step is required.");
    if (!nextStepDate.trim()) return setMsg("Next step date is required.");

    setLoading(true);
    try {
      // insert interaction
      const { error: iErr } = await supabase.from("interactions").insert({
        account_id: accountId,
        contact_id: contactId || null,
        channel,
        summary: summary.trim(),
        next_step: nextStep.trim(),
        next_step_date: nextStepDate.trim(),
      });
      if (iErr) throw iErr;

      // update last_interaction_at en account
      const { error: aErr } = await supabase
        .from("accounts")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("id", accountId);
      if (aErr) throw aErr;

      // si hay contact, actualiza last_touch_at (si tu tabla lo tiene)
      if (contactId) {
        // esto fallará silenciosamente si la columna no existe; si existe, perfecto
        await supabase
          .from("contacts")
          // @ts-ignore (por si el schema TS no la conoce)
          .update({ last_touch_at: new Date().toISOString() })
          .eq("id", contactId);
      }

      await onSaved();
      onClose();
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
        zIndex: 80,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card"
        style={{ width: "100%", maxWidth: 680, padding: 16 }}
      >
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Quick log</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              {accountName}
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <button className="btn" onClick={onClose} disabled={loading}>
              Close
            </button>
            <button className="btn btnPrimary" onClick={save} disabled={loading}>
              Save
            </button>
          </div>
        </div>

        {msg && (
          <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
          </div>
        )}

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1.4fr 160px" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Contact (optional)</div>
            <select
              className="field"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">— none —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.area})
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Channel</div>
            <select
              className="field"
              value={channel}
              onChange={(e) => setChannel(e.target.value as Channel)}
            >
              <option value="whatsapp">whatsapp</option>
              <option value="call">call</option>
              <option value="email">email</option>
            </select>
          </label>
        </div>

        <div style={{ height: 10 }} />

        <label style={{ display: "grid", gap: 6 }}>
          <div className="label">Summary</div>
          <textarea
            className="field"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What happened? Keep it short and actionable."
            rows={4}
            style={{ resize: "vertical" }}
          />
        </label>

        <div style={{ height: 10 }} />

        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 200px" }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Next step</div>
            <input
              className="field"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="e.g., Send sample proposal"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Next step date</div>
            <input
              className="field"
              value={nextStepDate}
              onChange={(e) => setNextStepDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </label>
        </div>

        <div style={{ marginTop: 10 }} className="subtle">
          Tip: if you always pick a contact, the app can learn “who’s getting ignored”.
        </div>
      </div>
    </div>
  );
}
