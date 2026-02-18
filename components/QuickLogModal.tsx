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

function defaultNextStepDate() {
  const d = new Date();
  d.setDate(d.getDate() + 3);
  return d.toISOString().slice(0, 10);
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

  // Selecciona por defecto el contacto menos tocado (never primero, luego más días)
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
    setNextStepDate(defaultNextStepDate());
    setChannel("whatsapp");
    setContactId(recommendedId);
  }, [open, recommendedId]);

  if (!open) return null;

  async function save() {
    setMsg(null);

    // Validaciones
    if (contacts.length === 0) {
      return setMsg("Agrega al menos un contacto antes de registrar una interacción.");
    }
    if (!contactId) {
      return setMsg("Debes seleccionar un contacto.");
    }
    if (!summary.trim()) return setMsg("El resumen es obligatorio.");
    if (!nextStep.trim()) return setMsg("El próximo paso es obligatorio.");
    if (!nextStepDate) return setMsg("La fecha del próximo paso es obligatoria.");

    setLoading(true);
    try {
      // 1) Insertar interacción
      const { error: iErr } = await supabase.from("interactions").insert({
        account_id: accountId,
        contact_id: contactId,
        channel,
        summary: summary.trim(),
        next_step: nextStep.trim(),
        next_step_date: nextStepDate,
      });
      if (iErr) throw iErr;

      // 2) Actualizar last_interaction_at en la cuenta
      const { error: aErr } = await supabase
        .from("accounts")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("id", accountId);
      if (aErr) throw aErr;

      // 3) Actualizar last_touch_at en el contacto (para tracking de intimacy)
      await supabase
        .from("contacts")
        // @ts-ignore — columna last_touch_at puede no estar en los tipos generados
        .update({ last_touch_at: new Date().toISOString() })
        .eq("id", contactId);

      await onSaved();
      onClose();
    } catch (e: any) {
      setMsg(e?.message ?? "No se pudo guardar la interacción.");
    } finally {
      setLoading(false);
    }
  }

  const selectedContact = contacts.find((c) => c.id === contactId) ?? null;

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
        {/* Header */}
        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Quick log</div>
            <div className="subtle" style={{ marginTop: 4 }}>
              {accountName}
            </div>
          </div>

          <div className="row" style={{ gap: 10 }}>
            <button className="btn" onClick={onClose} disabled={loading}>
              Cerrar
            </button>
            <button className="btn btnPrimary" onClick={save} disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>

        {/* Error */}
        {msg && (
          <div className="card" style={{ marginTop: 12, padding: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.95 }}>{msg}</div>
          </div>
        )}

        <div style={{ height: 12 }} />

        {/* Fila 1: Contacto + Canal */}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1.4fr 160px" }}>
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
            {/* Muestra el hook del contacto seleccionado como recordatorio */}
            {selectedContact?.personal_hook && (
              <div className="subtle" style={{ marginTop: 4, fontSize: 12 }}>
                Hook: {selectedContact.personal_hook}
              </div>
            )}
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

        {/* Resumen */}
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

        {/* Próximo paso + fecha */}
        <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 200px" }}>
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
            <div className="label">Fecha próximo paso</div>
            {/* type="date" muestra el date picker nativo del browser */}
            <input
              className="field"
              type="date"
              value={nextStepDate}
              onChange={(e) => setNextStepDate(e.target.value)}
            />
          </label>
        </div>

        <div style={{ marginTop: 10 }} className="subtle">
          Cada interacción debe estar vinculada a un contacto para trackear la intimacy correctamente.
        </div>
      </div>
    </div>
  );
}
