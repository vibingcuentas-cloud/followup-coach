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
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: e,
          password,
        });
        if (error) throw error;

        // If email confirmations are ON, user must confirm email before sign-in.
        // Supabase returns a user even if not confirmed.
        if (data.user && data.user.email_confirmed_at) {
          router.push("/today");
        } else {
          setMsg(
            "Account created. Check your email to confirm your account, then Sign in."
          );
          setMode("signin");
        }
      }
    } catch (err: any) {
      setMsg(err?.message ?? "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <div className="topbar">
        <div>
          <h1 className="h1">Sign in</h1>
          <div className="subtle">Minimal. Fast. Built for follow-up discipline.</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 760, margin: "0 auto" }}>
        {/* Mode toggle */}
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 16 }}>
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </div>
            <div style={{ marginTop: 4, fontSize: 12, color: "var(--muted)" }}>
              {mode === "signin"
                ? "Use your email + password."
                : "Create a new user in Supabase Auth."}
            </div>
          </div>

          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className={`btn ${mode === "signin" ? "btnPrimary" : ""}`}
              onClick={() => setMode("signin")}
              style={{ height: 40, borderRadius: 14 }}
            >
              Sign in
            </button>
            <button
              type="button"
              className={`btn ${mode === "signup" ? "btnPrimary" : ""}`}
              onClick={() => setMode("signup")}
              style={{ height: 40, borderRadius: 14 }}
            >
              Sign up
            </button>
          </div>
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <label>
            <div className="label">Email</div>
            <input
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              autoComplete="email"
              inputMode="email"
            />
          </label>

          <label>
            <div className="label">Password</div>
            <input
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
          </label>

          {msg && (
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              {msg}
            </div>
          )}

          <div className="row" style={{ justifyContent: "flex-end", marginTop: 6 }}>
            <button
              disabled={loading}
              onClick={handleSubmit}
              className="btn btnPrimary"
              style={{
                height: 44,
                borderRadius: 14,
                fontWeight: 900,
                padding: "0 16px",
              }}
            >
              {loading
                ? (mode === "signin" ? "Signing in..." : "Creating...")
                : (mode === "signin" ? "Sign in" : "Create account")}
            </button>
          </div>

          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
            If you don’t see “Create account” working, check Supabase Auth settings:
            Email provider enabled + confirmation rules.
          </div>
        </div>
      </div>
    </main>
  );
}