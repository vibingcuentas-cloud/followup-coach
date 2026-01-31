"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.push("/today");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;

      router.push("/today");
    } catch (err: any) {
      setMsg(err?.message ?? "Could not sign in");
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

      <div className="card">
        <form className="grid" onSubmit={signIn}>
          <label>
            <div className="label">Email</div>
            <input
              className="field"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              type="email"
              autoComplete="email"
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
              autoComplete="current-password"
            />
          </label>

          {msg && <div style={{ fontSize: 13, color: "var(--text)" }}>{msg}</div>}

          <div className="row" style={{ justifyContent: "flex-end" }}>
            <button className="btn btnPrimary" disabled={loading} type="submit">
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>

      <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
        If you don’t have an account, create it in Supabase Auth (for MVP).
      </div>
    </main>
  );
}