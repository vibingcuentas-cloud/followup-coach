"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  onSaved: () => void;
};

type Contact = {
  id: string;
  name: string;
  area: string;
};

export default function QuickLogModal({
  open,
  onClose,
  accountId,
  accountName,
  onSaved,
}: Props) {
  const [channel, setChannel] = useState<"call" | "whatsapp" | "email">("call");

  // NEW: contacts dropdown
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactId, setContactId] = useState<string>("");

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

  const [personalHook, setPersonalHook] = useState("");
  const [businessHook, setBusinessHook] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // NEW: load contacts for this account when modal opens / account changes
  useEffect(() => {
    (async () => {
      if (!open || !accountId) return;

      const { data, error } = await supabase
        .from("contacts")
        .select("id,name,area")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) {
        // don't block the modal — just show no contacts
        setContacts([]);
        return;
      }

      setContacts((data as Contact[]) ?? []);
      setContactId(""); // reset selection when switching account
    })();
  }, [accountId, open]);

  if (!open) return null;

  async function save() {
    setMsg(null);

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
      // 1) create interaction (requires next step + date)
      const { error: interr } = await supabase.from("interactions").insert({
        account_id: accountId,
        contact_id: contactId ? contactId : null, // NEW
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

      // 2) update account last_interaction_at and optionally hooks
      const updatePayload: any = {
        last_interaction_at: new Date().toISOString(),
      };
      if (personalHook.trim()) updatePayload.personal_hook = personalHook.trim();
      if (businessHook.trim()) updatePayload.business_hook = businessHook.trim();

      const { error: accErr } = await supabase
        .from("accounts")
        .update(updatePayload)
        .eq("id", accountId);

      if (accErr) throw accErr;

      // done
      onSaved();
      onClose();

      // reset minimal fields
      setContactId("");
      setSummary("");
      setNextStep("");
      setObjectionTag("");
      setTargetPrice("");
      setRiskT(false);
      setRiskR(false);
      setRiskC(false);
      setPersonalHook("");
      setBusinessHook("");
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
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(20,20,24,0.98)",
          padding: 16,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>Quick Log</div>
            <div style={{ marginTop: 4, opacity: 0.75, fontSize: 13 }}>
              {accountName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: "8px 10px",
              borderRadius: 12,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "transparent",
              color: "white",
              cursor: "pointer",
              height: 36,
            }}
          >
            Close
          </button>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Channel</div>
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as any)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none",
              }}
            >
              <option value="call">Call</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
          </label>

          {/* NEW: contact dropdown */}
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Contact (optional)</div>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none",
              }}
            >
              <option value="">— No specific person —</option>
              {contacts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.area})
                </option>
              ))}
            </select>
          </label>

          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Summary (required)</div>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={3}
              placeholder="What happened? Key outcome?"
              style={{
                width: "100%",
                padding: 12,
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.15)",
                background: "rgba(255,255,255,0.06)",
                color: "white",
                outline: "none",
                resize: "vertical",
              }}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px",
              gap: 10,
            }}
          >
            <label>
              <div style={{ fontSize: 12, opacity: 0.7 }}>
                Next step (required)
              </div>
              <input
                value={nextStep}
                onChange={(e) => setNextStep(e.target.value)}
                placeholder="Next step action"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "none",
                }}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Next step date</div>
              <input
                value={nextStepDate}
                onChange={(e) => setNextStepDate(e.target.value)}
                type="date"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "none",
                }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Objection tag (optional)</div>
              <input
                value={objectionTag}
                onChange={(e) => setObjectionTag(e.target.value)}
                placeholder="e.g., price, timing"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "none",
                }}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Target price (optional)</div>
              <input
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g., 12.5 USD/kg"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "none",
                }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={riskT}
                onChange={(e) => setRiskT(e.target.checked)}
              />
              <span style={{ fontSize: 13, opacity: 0.9 }}>Risk: Technical</span>
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={riskR}
                onChange={(e) => setRiskR(e.target.checked)}
              />
              <span style={{ fontSize: 13, opacity: 0.9 }}>Risk: Regulatory</span>
            </label>

            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={riskC}
                onChange={(e) => setRiskC(e.target.checked)}
              />
              <span style={{ fontSize: 13, opacity: 0.9 }}>Risk: Commercial</span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Personal hook (optional)</div>
              <input
                value={personalHook}
                onChange={(e) => setPersonalHook(e.target.value)}
                placeholder="e.g., kid birthday, travel"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "none",
                }}
              />
            </label>

            <label>
              <div style={{ fontSize: 12, opacity: 0.7 }}>Business hook (optional)</div>
              <input
                value={businessHook}
                onChange={(e) => setBusinessHook(e.target.value)}
                placeholder="e.g., new launch, tender"
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  outline: "none",
                }}
              />
            </label>
          </div>

          {msg && <div style={{ fontSize: 13, opacity: 0.9 }}>{msg}</div>}

          <button
            disabled={loading}
            onClick={save}
            style={{
              padding: 12,
              borderRadius: 12,
              border: "none",
              background: "white",
              color: "black",
              fontWeight: 900,
              cursor: "pointer",
              marginTop: 4,
            }}
          >
            {loading ? "Saving..." : "Save log"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.65 }}>
            Rule: no interaction can be saved without next step + date.
          </div>
        </div>
      </div>
    </div>
  );
}