"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { daysSince } from "../lib/intimacy";

type Channel = "call" | "whatsapp" | "email";

export type Contact = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  area: "Marketing" | "R&D" | "Procurement" | "Commercial" | "Directors";
  preferred_channel: Channel | null;
  personal_hook: string | null;
  last_touch_at: string | null;
  created_at: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  accountId: string;
  accountName: string;
  accountLastInteractionAt?: string | null;
  contacts: Contact[];
  onSaved: (meta: {
    interactionId: string;
    accountId: string;
    contactId: string;
    previousAccountLastInteractionAt: string | null;
    previousContactLastTouchAt: string | null;
  }) => Promise<void> | void;
};

function localDateInputValue(date = new Date()): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function defaultNextStepDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return localDateInputValue(d);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function QuickLogModal({
  open,
  onClose,
  accountId,
  accountName,
  accountLastInteractionAt = null,
  contacts,
  onSaved,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [contactId, setContactId] = useState<string>("");
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [summary, setSummary] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [nextStepDate, setNextStepDate] = useState(defaultNextStepDate());
  const [useDraftLoaded, setUseDraftLoaded] = useState(false);
  const draftKey = `quicklog-draft:${accountId}`;
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);

  const recommendedId = useMemo(() => {
    if (contacts.length === 0) return "";
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
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      try {
        const d = JSON.parse(raw) as {
          contactId?: string;
          channel?: Channel;
          summary?: string;
          nextStep?: string;
          nextStepDate?: string;
        };
        setContactId(d.contactId ?? recommendedId);
        setChannel(d.channel ?? "whatsapp");
        setSummary(d.summary ?? "");
        setNextStep(d.nextStep ?? "");
        setNextStepDate(d.nextStepDate ?? defaultNextStepDate());
        setUseDraftLoaded(true);
        return;
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
    setSummary("");
    setNextStep("");
    setNextStepDate(defaultNextStepDate());
    setChannel("whatsapp");
    setContactId(recommendedId);
    setUseDraftLoaded(false);
  }, [open, recommendedId, draftKey]);

  useEffect(() => {
    if (!open) return;
    const payload = {
      contactId,
      channel,
      summary,
      nextStep,
      nextStepDate,
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
  }, [open, contactId, channel, summary, nextStep, nextStepDate, draftKey]);

  useEffect(() => {
    if (!summaryRef.current) return;
    summaryRef.current.style.height = "0px";
    summaryRef.current.style.height = `${Math.min(240, summaryRef.current.scrollHeight)}px`;
  }, [summary, open]);

  if (!open) return null;

  async function save() {
    setMsg(null);

    if (contacts.length === 0) {
      setMsg("Add at least one contact before logging an interaction.");
      return;
    }
    if (!contactId) {
      setMsg("Select a contact.");
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
      const previousContactLastTouchAt =
        contacts.find((c) => c.id === contactId)?.last_touch_at ?? null;

      const { data: inserted, error: iErr } = await supabase
        .from("interactions")
        .insert({
          account_id: accountId,
          contact_id: contactId,
          channel,
          summary: summary.trim(),
          next_step: nextStep.trim(),
          next_step_date: nextStepDate,
        })
        .select("id")
        .single();
      if (iErr) throw iErr;
      if (!inserted?.id) throw new Error("Could not retrieve interaction id.");

      const { error: aErr } = await supabase
        .from("accounts")
        .update({ last_interaction_at: nowIso })
        .eq("id", accountId);
      if (aErr) throw aErr;

      const { error: cErr } = await supabase
        .from("contacts")
        .update({ last_touch_at: nowIso })
        .eq("id", contactId);
      if (cErr) throw cErr;

      await onSaved({
        interactionId: inserted.id,
        accountId,
        contactId,
        previousAccountLastInteractionAt: accountLastInteractionAt,
        previousContactLastTouchAt,
      });
      localStorage.removeItem(draftKey);
      onClose();
    } catch (error: unknown) {
      setMsg(getErrorMessage(error, "Could not save interaction."));
    } finally {
      setLoading(false);
    }
  }

  const selectedContact = contacts.find((c) => c.id === contactId) ?? null;
  const completedSteps =
    (contactId ? 1 : 0) + (summary.trim() ? 1 : 0) + (nextStep.trim() && nextStepDate ? 1 : 0);

  return (
    <div
      className="quickLogOverlay"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 80,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card quickLogModal"
        style={{ width: "100%", maxWidth: 680, padding: 16 }}
      >
        <div className="row quickLogHeader" style={{ justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Quick log</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              {accountName}
            </div>
          </div>

          <div className="row quickLogActions" style={{ gap: 10 }}>
            <button className="btn" onClick={onClose} disabled={loading}>
              Close
            </button>
            <button className="btn btnPrimary" onClick={save} disabled={loading}>
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>

        <div className="quickLogSteps">
          <span className={`stepDot ${contactId ? "done" : ""}`}>1 Contact</span>
          <span className={`stepDot ${summary.trim() ? "done" : ""}`}>2 Summary</span>
          <span className={`stepDot ${nextStep.trim() && nextStepDate ? "done" : ""}`}>3 Next step</span>
          <span className="stepProgress">{completedSteps}/3</span>
        </div>

        {useDraftLoaded && (
          <div className="subtle" style={{ marginTop: 8 }}>
            Restored draft.
          </div>
        )}

        {msg && (
          <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
          </div>
        )}

        <div style={{ height: 12 }} />

        <div className="quickLogGridTwoCols" style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Contact (required)</div>
            <select
              className="field"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">- select a contact -</option>
              {contacts.map((c) => {
                const d = daysSince(c.last_touch_at);
                const last = d == null ? "never" : d === 0 ? "today" : `${d}d`;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.area}) • last: {last}
                  </option>
                );
              })}
            </select>
            {selectedContact?.personal_hook && (
              <div className="subtle" style={{ marginTop: 4, fontSize: 12 }}>
                Hook: {selectedContact.personal_hook}
              </div>
            )}
          </label>
        </div>

        <div style={{ height: 10 }} />

        <label style={{ display: "grid", gap: 6 }}>
          <div className="label">Summary (required)</div>
          <textarea
            ref={summaryRef}
            className="field"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="What happened? What was the key result?"
            rows={4}
            style={{ resize: "none", overflowY: "auto" }}
          />
        </label>

        <div style={{ height: 10 }} />

        <div className="quickLogGridTwoCols" style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Next step (required)</div>
            <input
              className="field"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="e.g. Send sample proposal"
            />
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
          <div className="label">Next step date</div>
          <input
            className="field"
            type="date"
            value={nextStepDate}
            onChange={(e) => setNextStepDate(e.target.value)}
          />
        </label>

        <div style={{ marginTop: 10 }} className="subtle">
          Every interaction should be linked to a contact to keep intimacy tracking accurate.
        </div>
      </div>
    </div>
  );
}
