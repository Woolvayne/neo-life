"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Field, Input } from "./ui/Kit";
import type { AccountInfo } from "@/game/core/types";
import { audio } from "@/game/engine/audio";

type Mode = "welcome" | "login" | "register" | "forgot";

export default function AuthScreen({
  onAuthed,
  onGuest,
}: {
  onAuthed: (a: AccountInfo) => void;
  onGuest: () => void;
}) {
  const [mode, setMode] = useState<Mode>("welcome");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [dob, setDob] = useState("");
  const [accepted, setAccepted] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [remember, setRemember] = useState(true);

  async function submitRegister() {
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (dob) {
      const age = (Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000);
      if (age < 10) {
        setError("You must be at least 10 years old to play.");
        return;
      }
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, username, password, dob, accepted }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Registration failed.");
        audio.error();
      } else {
        audio.success();
        onAuthed(data.account as AccountInfo);
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function submitLogin() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ identifier, password: loginPw, remember }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Login failed.");
        audio.error();
      } else {
        audio.success();
        onAuthed(data.account as AccountInfo);
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="nc-grid-bg relative flex h-full w-full items-center justify-center overflow-hidden p-6">
      <Link
        href="/"
        className="absolute left-5 top-5 z-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs font-bold text-slate-300 backdrop-blur transition hover:border-sky-400/30 hover:text-white"
      >
        ← NovaCity website
      </Link>
      <div className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-sky-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-[420px] w-[420px] rounded-full bg-indigo-500/10 blur-[120px]" />

      <div className="relative grid w-full max-w-6xl gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="nc-in hidden flex-col justify-center lg:flex">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-indigo-600 text-2xl shadow-lg shadow-sky-900/40">
              🏙️
            </div>
            <div>
              <div className="text-[11px] font-bold uppercase tracking-[0.4em] text-sky-300/80">Welcome to</div>
              <h1 className="text-4xl font-black tracking-tight text-white">
                NOVA<span className="text-sky-400">CITY</span>
              </h1>
            </div>
          </div>
          <p className="max-w-lg text-lg font-medium text-slate-300">
            Urban Response — a living European-inspired metropolis where you can work, drive, respond to
            emergencies, or take the other side of the law.
          </p>
          <div className="mt-8 grid max-w-lg grid-cols-2 gap-3 text-sm">
            {[
              ["🚓", "Police service with pursuits, MDT & arrests"],
              ["🚑", "Medical & fire departments with live dispatch"],
              ["🚕", "16 civilian jobs and a full economy"],
              ["🌆", "5 explorable regions, day/night & weather"],
              ["🏠", "Properties, garages, vehicle customisation"],
              ["👥", "Shared world with other online players"],
            ].map(([icon, text]) => (
              <div key={text} className="nc-glass flex items-start gap-2 rounded-xl px-3 py-2.5">
                <span className="text-lg">{icon}</span>
                <span className="text-xs leading-snug text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="nc-panel nc-in rounded-2xl p-6">
          {mode === "welcome" && (
            <div className="space-y-5">
              <div className="lg:hidden">
                <h1 className="text-3xl font-black tracking-tight text-white">
                  NOVA<span className="text-sky-400">CITY</span>
                </h1>
                <p className="text-sm text-slate-400">Urban Response</p>
              </div>
              <h2 className="text-xl font-bold text-white">Welcome to NovaCity</h2>
              <p className="text-sm text-slate-400">
                No account is required. Start instantly as a guest, or optionally create an account for
                server-side progress and live player synchronisation.
              </p>
              <Button full className="py-3 text-base" onClick={onGuest}>
                ▶ PLAY AS GUEST
              </Button>
              <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-[11px] leading-relaxed text-emerald-100/70">
                Guest progress is saved locally in this browser and survives a refresh. Registration remains
                optional.
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button full variant="ghost" onClick={() => setMode("register")}>
                  Create Account
                </Button>
                <Button full variant="ghost" onClick={() => setMode("login")}>
                  Log In
                </Button>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] leading-relaxed text-slate-400">
                NovaCity is a wholly original fictional setting. All districts, brands, vehicles, departments
                and equipment names are invented for this game.
              </div>
            </div>
          )}

          {mode === "register" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submitRegister();
              }}
            >
              <h2 className="text-xl font-bold text-white">Create your account</h2>
              <Field label="Email">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
              </Field>
              <Field label="Username" hint="3-16 characters, letters/numbers/underscore">
                <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="NovaRookie" required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Password">
                  <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </Field>
                <Field label="Confirm password">
                  <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
                </Field>
              </div>
              <Field label="Date of birth">
                <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} required />
              </Field>
              <label className="flex items-start gap-2 text-xs text-slate-400">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-sky-500"
                />
                <span>
                  I accept the NovaCity Terms of Service and understand this is a fictional roleplay game.
                </span>
              </label>
              {error ? <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-300">{error}</div> : null}
              <Button full type="submit" disabled={busy}>
                {busy ? "Creating account…" : "Create Account & Play"}
              </Button>
              <Button full variant="subtle" onClick={() => setMode("welcome")}>
                Back
              </Button>
            </form>
          )}

          {mode === "login" && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void submitLogin();
              }}
            >
              <h2 className="text-xl font-bold text-white">Log in</h2>
              <Field label="Email or username">
                <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              </Field>
              <Field label="Password">
                <Input type="password" value={loginPw} onChange={(e) => setLoginPw(e.target.value)} required />
              </Field>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 accent-sky-500"
                  />
                  Remember me
                </label>
                <button type="button" className="text-sky-400 hover:underline" onClick={() => setMode("forgot")}>
                  Forgot password?
                </button>
              </div>
              {error ? <div className="rounded-lg bg-rose-500/15 px-3 py-2 text-xs text-rose-300">{error}</div> : null}
              <Button full type="submit" disabled={busy}>
                {busy ? "Signing in…" : "PLAY NOVACITY"}
              </Button>
              <Button full variant="subtle" onClick={() => setMode("welcome")}>
                Back
              </Button>
            </form>
          )}

          {mode === "forgot" && (
            <div className="space-y-3">
              <h2 className="text-xl font-bold text-white">Password recovery</h2>
              <p className="text-sm text-slate-400">
                Outgoing email is not available in this environment. Enter the email on your account and we will
                show a one-time recovery code you can use to set a new password from the account settings.
              </p>
              <Field label="Account email">
                <Input value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              {info ? <div className="rounded-lg bg-sky-500/15 px-3 py-2 text-xs text-sky-200">{info}</div> : null}
              <Button
                full
                onClick={() => {
                  const code = Math.random().toString(36).slice(2, 8).toUpperCase();
                  setInfo(`Recovery code for ${email || "your account"}: ${code} (simulated delivery)`);
                }}
              >
                Generate recovery code
              </Button>
              <Button full variant="subtle" onClick={() => setMode("login")}>
                Back to login
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
