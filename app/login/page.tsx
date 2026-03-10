"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabaseClient";

export const dynamic = "force-dynamic";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return fallback;
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) router.push("/today");
    })();
  }, [router]);

  async function handleSubmit() {
    setMsg(null);

    const e = email.trim().toLowerCase();
    if (!e) {
      setMsg("Email is required.");
      return;
    }
    if (!password) {
      setMsg("Password is required.");
      return;
    }
    if (password.length < 6) {
      setMsg("Password must be at least 6 characters.");
      return;
    }

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

      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/today`
          : undefined;

      const { error } = await supabase.auth.signUp({
        email: e,
        password,
        options: {
          emailRedirectTo: redirectTo,
        },
      });

      if (error) throw error;

      const { data: userData } = await supabase.auth.getUser();

      if (userData.user) {
        router.push("/today");
      } else {
        setMsg(
          "Account created. Check your email to confirm your account, then sign in."
        );
        setMode("signin");
      }
    } catch (error: unknown) {
      setMsg(getErrorMessage(error, "Could not authenticate."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="opsPage authPage">
      <header className="opsTopbar">
        <div>
          <div className="brandTag">Forge</div>
          <h1 className="opsTitle">{mode === "signin" ? "Sign in" : "Sign up"}</h1>
          <div className="opsSubtitle">Intimacy OS for strategic account execution.</div>
        </div>

        <div className="opsTopActions authModeSwitch">
          <button
            className={`btn btnGhost ${mode === "signin" ? "activeMode" : ""}`}
            onClick={() => {
              setMsg(null);
              setMode("signin");
            }}
          >
            Sign in
          </button>
          <button
            className={`btn btnGhost ${mode === "signup" ? "activeMode" : ""}`}
            onClick={() => {
              setMsg(null);
              setMode("signup");
            }}
          >
            Sign up
          </button>
        </div>
      </header>

      <section className="opsBlock authCard">
        {msg && <div className="opsInlineError">{msg}</div>}

        <label>
          <div className="label">Email</div>
          <input
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </label>

        <label>
          <div className="label">Password</div>
          <input
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="••••••"
          />
        </label>

        <div className="authActions">
          <button className="btn btnPrimary" onClick={handleSubmit} disabled={loading}>
            {loading ? "Working..." : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </div>

        <div className="opsInlineHint">
          If Sign Up requires email confirmation, ensure Supabase Site URL and Redirect URLs include your Vercel domain.
        </div>
      </section>
    </main>
  );
}
