"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  // If already logged in, go to Today
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.push("/today");
    })();
  }, [router]);

  async function handleSubmit() {
    setMsg(null);

    const e = email.trim().toLowerCase();
    if (!e) return setMsg("Email is required.");
    if (!password) return setMsg("Password is required.");
    if (password.length < 6) return setMsg("Password must be at least 6 characters.");

    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: e,
          password,
        });
        if (error) throw error;

        router.push("/today");
        return;
      }

      // SIGN UP
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/today` : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          // Used only if email confirmation is enabled
          emailRedirectTo: redirectTo,
        },
      });

      if (error) throw error;

      // If email confirmation is ON, user may not exist as a session yet.
      // Supabase returns identities/session depending on your settings.
      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        // Confirmation OFF (or instant session) -> go in
        router.push("/today");
      } else {
        // Confirmation ON -> tell user to check email
        setMsg(
          "Account created. Check your email to confirm your account, then sign in."
        );
        setMode("signin");
      }
    } catch (e: any) {
      // Common: "Email rate limit exceeded", "User already registered", etc.
      setMsg(e?.message ?? "Could not authenticate.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: 24, maxWidth: 980, margin: "0 auto" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 900, letterSpacing: -0.5 }}>
            {mode === "signin" ? "Sign in" : "Sign up"}
          </h1>
          <div style={{ marginTop: 6, opacity: 0.7 }}>
            Minimal. Fast. Built for follow-up discipline.
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => {
              setMsg(null);
              setMode("signin");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: mode === "signin" ? "rgba(255,255,255,0.10)" : "transparent",
              color: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Sign in
          </button>
          <button
            onClick={() => {
              setMsg(null);
              setMode("signup");
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: mode === "signup" ? "rgba(255,255,255,0.10)" : "transparent",
              color: "white",
              cursor: "pointer",
              fontWeight: 800,
            }}
          >
            Sign up
          </button>
        </div>
      </div>

      <section
        style={{
          marginTop: 18,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(255,255,255,0.06)",
          padding: 18,
        }}
      >
        {msg && (
          <div
            style={{
              marginBottom: 12,
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(0,0,0,0.25)",
              fontSize: 13,
              opacity: 0.95,
            }}
          >
            {msg}
          </div>
        )}

        <label style={{ display: "block" }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Email</div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            style={{
              width: "100%",
              marginTop: 6,
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              outline: "none",
            }}
          />
        </label>

        <label style={{ display: "block", marginTop: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Password</div>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••"
            style={{
              width: "100%",
              marginTop: 6,
              padding: 14,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              outline: "none",
            }}
          />
        </label>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: 14,
              border: "none",
              background: "white",
              color: "black",
              fontWeight: 900,
              cursor: "pointer",
              minWidth: 120,
            }}
          >
            {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
          If Sign Up requires email confirmation, ensure Supabase “Site URL” and “Redirect
          URLs” include your Vercel domain.
        </div>
      </section>
    </main>
  );
}
