"use client";

import { useEffect, useMemo, useState } from "react";
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
  contacts: Contact[];
  onSaved: () => Promise<void>;
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
    setSummary("");
    setNextStep("");
    setNextStepDate(defaultNextStepDate());
    setChannel("whatsapp");
    setContactId(recommendedId);
  }, [open, recommendedId]);

  if (!open) return null;

  async function save() {
    setMsg(null);

    if (contacts.length === 0) {
      setMsg("Agrega al menos un contacto antes de registrar una interacción.");
      return;
    }
    if (!contactId) {
      setMsg("Debes seleccionar un contacto.");
      return;
    }
    if (!summary.trim()) {
      setMsg("El resumen es obligatorio.");
      return;
    }
    if (!nextStep.trim()) {
      setMsg("El próximo paso es obligatorio.");
      return;
    }
    if (!nextStepDate) {
      setMsg("La fecha del próximo paso es obligatoria.");
      return;
    }

    setLoading(true);
    try {
      const nowIso = new Date().toISOString();

      const { error: iErr } = await supabase.from("interactions").insert({
        account_id: accountId,
        contact_id: contactId,
        channel,
        summary: summary.trim(),
        next_step: nextStep.trim(),
        next_step_date: nextStepDate,
      });
      if (iErr) throw iErr;

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

      await onSaved();
      onClose();
    } catch (error: unknown) {
      setMsg(getErrorMessage(error, "No se pudo guardar la interacción."));
    } finally {
      setLoading(false);
    }
  }

  const selectedContact = contacts.find((c) => c.id === contactId) ?? null;

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
              Cerrar
            </button>
            <button className="btn btnPrimary" onClick={save} disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        {msg && (
          <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
          </div>
        )}

        <div style={{ height: 12 }} />

        <div className="quickLogGridTwoCols" style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Contacto (requerido)</div>
            <select
              className="field"
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
            >
              <option value="">— selecciona un contacto —</option>
              {contacts.map((c) => {
                const d = daysSince(c.last_touch_at);
                const last = d == null ? "nunca" : d === 0 ? "hoy" : `${d}d`;
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.area}) • último: {last}
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
          <div className="label">Resumen (requerido)</div>
          <textarea
            className="field"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="¿Qué pasó? ¿Cuál fue el resultado clave?"
            rows={4}
            style={{ resize: "vertical" }}
          />
        </label>

        <div style={{ height: 10 }} />

        <div className="quickLogGridTwoCols" style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Próximo paso (requerido)</div>
            <input
              className="field"
              value={nextStep}
              onChange={(e) => setNextStep(e.target.value)}
              placeholder="ej. Enviar propuesta de muestra"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Canal</div>
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
          <div className="label">Fecha próximo paso</div>
          <input
            className="field"
            type="date"
            value={nextStepDate}
            onChange={(e) => setNextStepDate(e.target.value)}
          />
        </label>

        <div style={{ marginTop: 10 }} className="subtle">
          Cada interacción debe estar vinculada a un contacto para trackear la intimacy correctamente.
        </div>
      </div>
    </div>
  );
}
