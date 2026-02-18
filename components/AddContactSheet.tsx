"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export type ContactArea =
  | "Marketing"
  | "R&D"
  | "Procurement"
  | "Commercial"
  | "Directors";

export type PreferredChannel = "call" | "whatsapp" | "email";

export type Contact = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  area: ContactArea | null;
  preferred_channel: PreferredChannel | null;
  personal_hook: string | null;
  created_at: string;
};

type Mode = "create" | "edit";

type Props = {
  open: boolean;
  mode: Mode;
  accountId: string;
  initial?: Partial<Contact> | null;
  onClose: () => void;
  onSaved: () => void; // reload parent
};

const AREAS: ContactArea[] = ["Marketing", "R&D", "Procurement", "Commercial", "Directors"];

function clean(v: string) {
  const t = v.trim();
  return t ? t : "";
}

export default function AddContactSheet({
  open,
  mode,
  accountId,
  initial,
  onClose,
  onSaved,
}: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [area, setArea] = useState<ContactArea>("R&D");
  const [preferred, setPreferred] = useState<PreferredChannel>("whatsapp");
  const [hook, setHook] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const title = mode === "edit" ? "Edit contact" : "Add contact";
  const primaryLabel = mode === "edit" ? "Save changes" : "Add contact";

  useEffect(() => {
    if (!open) return;
    setMsg(null);

    const nm = clean(initial?.name ?? "");
    const em = clean(initial?.email ?? "");
    const ar = (initial?.area as ContactArea) ?? "R&D";
    const pr = (initial?.preferred_channel as PreferredChannel) ?? "whatsapp";
    const hk = clean(initial?.personal_hook ?? "");

    setName(nm);
    setEmail(em);
    setArea(AREAS.includes(ar) ? ar : "R&D");
    setPreferred(pr ?? "whatsapp");
    setHook(hk);
  }, [open, initial]);

  const isValid = useMemo(() => !!clean(name), [name]);

  if (!open) return null;

  async function requireUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error("Not signed in");
    return data.user;
  }

  async function save() {
    setMsg(null);

    const nm = clean(name);
    if (!nm) return setMsg("Name is required.");

    const em = clean(email);
    const hk = clean(hook);

    setLoading(true);
    try {
      await requireUser();

      if (mode === "create") {
        const { error } = await supabase.from("contacts").insert({
          account_id: accountId,
          name: nm,
          email: em ? em : null,
          area,
          preferred_channel: preferred,
          personal_hook: hk ? hk : null,
        });
        if (error) throw error;
      } else {
        if (!initial?.id) throw new Error("Missing contact id");
        const { error } = await supabase
          .from("contacts")
          .update({
            name: nm,
            email: em ? em : null,
            area,
            preferred_channel: preferred,
            personal_hook: hk ? hk : null,
          })
          .eq("id", initial.id);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (e: any) {
      setMsg(e?.message ?? "Could not save contact");
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
        zIndex: 60,
        display: "grid",
        alignItems: "end",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 760,
          margin: "0 auto",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(18,18,20,0.98)",
          padding: 16,
          boxShadow: "0 -20px 60px rgba(0,0,0,0.45)",
        }}
      >
        {/* drag handle */}
        <div
          style={{
            width: 44,
            height: 5,
            borderRadius: 999,
            background: "rgba(255,255,255,0.18)",
            margin: "0 auto 10px auto",
          }}
        />

        <div className="row" style={{ justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{title}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
              Minimal. Fast. Useful.
            </div>
          </div>
          <button className="btn" onClick={onClose} style={{ height: 36 }}>
            Close
          </button>
        </div>

        <div style={{ height: 12 }} />

        {/* iOS-like form: vertical, roomy */}
        <div style={{ display: "grid", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Name (required)</div>
            <input
              className="field"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Hugo Chang"
              autoFocus
            />
          </label>

          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Area</div>
              <select
                className="field"
                value={area}
                onChange={(e) => setArea(e.target.value as ContactArea)}
              >
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <div className="label">Preferred</div>
              <select
                className="field"
                value={preferred}
                onChange={(e) => setPreferred(e.target.value as PreferredChannel)}
              >
                <option value="call">call</option>
                <option value="whatsapp">whatsapp</option>
                <option value="email">email</option>
              </select>
            </label>
          </div>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Email (optional)</div>
            <input
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              inputMode="email"
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            <div className="label">Personal hook (optional)</div>
            <input
              className="field"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder="e.g., likes tennis, kid birthday, travel"
            />
          </label>

          {msg && (
            <div style={{ fontSize: 13, opacity: 0.9, paddingTop: 4 }}>{msg}</div>
          )}

          <button
            className="btn btnPrimary"
            onClick={save}
            disabled={!isValid || loading}
            style={{
              height: 44,
              borderRadius: 16,
              marginTop: 2,
            }}
          >
            {loading ? "Saving..." : primaryLabel}
          </button>

          <div style={{ fontSize: 12, opacity: 0.6 }}>
            Hooks are per contact. Keep it short and actionable.
          </div>
        </div>
      </div>
    </div>
  );
}