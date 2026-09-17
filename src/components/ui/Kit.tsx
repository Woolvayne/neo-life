"use client";

import type { ReactNode } from "react";
import { audio } from "@/game/engine/audio";

export function Button({
  children,
  onClick,
  variant = "primary",
  className = "",
  disabled,
  type = "button",
  full,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "success" | "subtle";
  className?: string;
  disabled?: boolean;
  type?: "button" | "submit";
  full?: boolean;
}) {
  const styles: Record<string, string> = {
    primary:
      "bg-gradient-to-b from-sky-500/90 to-sky-600/90 hover:from-sky-400 hover:to-sky-600 text-white border-sky-400/40",
    ghost: "bg-white/5 hover:bg-white/10 text-slate-200 border-white/10",
    danger: "bg-gradient-to-b from-rose-500/90 to-rose-700/90 hover:from-rose-400 text-white border-rose-400/40",
    success: "bg-gradient-to-b from-emerald-500/90 to-emerald-700/90 hover:from-emerald-400 text-white border-emerald-400/40",
    subtle: "bg-transparent hover:bg-white/5 text-slate-300 border-transparent",
  };
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={() => {
        if (disabled) return;
        audio.ui();
        onClick?.();
      }}
      className={`nc-btn rounded-lg border px-4 py-2 text-sm font-semibold tracking-wide disabled:opacity-40 disabled:cursor-not-allowed ${styles[variant]} ${full ? "w-full" : ""} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 outline-none transition focus:border-sky-400/60 focus:bg-black/60 ${props.className ?? ""}`}
    />
  );
}

export function Bar({
  value,
  max = 100,
  color = "bg-sky-400",
  className = "",
  label,
}: {
  value: number;
  max?: number;
  color?: string;
  className?: string;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={`relative h-2 w-full overflow-hidden rounded-full bg-white/10 ${className}`}>
      <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      {label ? (
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/90">
          {label}
        </span>
      ) : null}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide,
  icon,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  icon?: string;
}) {
  return (
    <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={`nc-panel nc-in flex max-h-[88vh] w-full flex-col overflow-hidden rounded-2xl ${wide ? "max-w-5xl" : "max-w-2xl"}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
          <div className="flex items-center gap-3">
            {icon ? <span className="text-2xl">{icon}</span> : null}
            <div>
              <h2 className="text-base font-bold tracking-wide text-slate-50">{title}</h2>
              {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
            </div>
          </div>
          <button
            onClick={() => {
              audio.ui();
              onClose();
            }}
            className="rounded-md border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            ESC ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Tag({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-white/8 text-slate-300 border-white/10",
    blue: "bg-sky-500/15 text-sky-300 border-sky-400/30",
    green: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30",
    red: "bg-rose-500/15 text-rose-300 border-rose-400/30",
    amber: "bg-amber-500/15 text-amber-300 border-amber-400/30",
    violet: "bg-violet-500/15 text-violet-300 border-violet-400/30",
  };
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}

export function Row({
  title,
  subtitle,
  right,
  onClick,
  active,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <div
      onClick={() => {
        if (onClick) {
          audio.ui();
          onClick();
        }
      }}
      className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 transition ${
        active ? "border-sky-400/50 bg-sky-500/10" : "border-white/8 bg-white/[0.03]"
      } ${onClick ? "cursor-pointer hover:border-sky-400/40 hover:bg-white/[0.07]" : ""}`}
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-100">{title}</div>
        {subtitle ? <div className="truncate text-xs text-slate-400">{subtitle}</div> : null}
      </div>
      {right ? <div className="shrink-0 text-right text-sm">{right}</div> : null}
    </div>
  );
}
