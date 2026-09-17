"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ACHIEVEMENT_MAP } from "@/game/data/catalog";
import { JOBS, JOB_MAP, rankName } from "@/game/data/jobs";
import { VEHICLE_MAP, VEHICLES } from "@/game/data/vehicles";
import { MAPS } from "@/game/world/maps";
import { levelFromXp } from "@/game/core/defaults";
import type {
  AccountInfo,
  DispatchCall,
  OwnedProperty,
  OwnedVehicle,
  PlayerStats,
  Transaction,
} from "@/game/core/types";

const euro = (value: number) => `€${Math.round(value).toLocaleString("de-DE")}`;

const defaultStats: PlayerStats = {
  distance: 0,
  jobsCompleted: 0,
  crimes: 0,
  arrests: 0,
  robberies: 0,
  moneyEarned: 0,
  moneySpent: 0,
  playTime: 0,
  timesArrested: 0,
  callsCleared: 0,
};

type WebProfile = {
  displayName: string;
  money: number;
  bank: number;
  xp: number;
  level: number;
  job: string;
  jobRank: number;
  wanted: number;
  currentMap: string;
  vehicles: OwnedVehicle[];
  properties: OwnedProperty[];
  stats: PlayerStats;
  achievements: string[];
  transactions: Transaction[];
};

type SessionData = { account: AccountInfo; profile: WebProfile } | null;

const markerColor: Record<string, string> = {
  police: "bg-blue-400",
  fire: "bg-rose-400",
  medical: "bg-emerald-400",
  public: "bg-amber-400",
};

const districtIcons = ["🏙️", "🌲", "✈️", "⚓", "🏔️"];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-cyan-300 via-sky-500 to-indigo-700 shadow-lg shadow-sky-950/40">
        <span className="absolute bottom-1 left-1 h-4 w-1.5 rounded-sm bg-white/90" />
        <span className="absolute bottom-1 left-3 h-6 w-2 rounded-sm bg-white" />
        <span className="absolute bottom-1 right-1 h-3 w-2 rounded-sm bg-white/75" />
      </span>
      {!compact ? (
        <div className="leading-none">
          <div className="text-lg font-black tracking-tight text-white">
            NOVA<span className="text-sky-400">CITY</span>
          </div>
          <div className="mt-1 text-[8px] font-bold uppercase tracking-[0.31em] text-slate-500">
            Urban Response
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ online }: { online: boolean | null }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-[11px] font-semibold text-slate-300 backdrop-blur">
      <span
        className={`h-2 w-2 rounded-full ${
          online === null ? "animate-pulse bg-amber-300" : online ? "bg-emerald-400 shadow-[0_0_12px_#34d399]" : "bg-rose-400"
        }`}
      />
      {online === null ? "Checking services" : online ? "All systems operational" : "Local mode available"}
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  body,
  center = false,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  center?: boolean;
}) {
  return (
    <div className={center ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}>
      <div className="text-[11px] font-bold uppercase tracking-[0.34em] text-sky-400">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h2>
      {body ? <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">{body}</p> : null}
    </div>
  );
}

function PrimaryLink({ children, href = "/play?guest=1" }: { children: React.ReactNode; href?: string }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-gradient-to-b from-sky-400 to-sky-600 px-5 py-3 text-sm font-black tracking-wide text-white shadow-xl shadow-sky-950/40 transition hover:-translate-y-0.5 hover:from-sky-300 hover:to-sky-500"
    >
      {children}
      <span className="transition group-hover:translate-x-1">→</span>
    </Link>
  );
}

function Dashboard({ session, calls }: { session: NonNullable<SessionData>; calls: DispatchCall[] }) {
  const p = session.profile;
  const level = levelFromXp(p.xp ?? 0);
  const job = JOB_MAP[p.job];
  const map = MAPS.find((item) => item.id === p.currentMap);
  const stats = { ...defaultStats, ...(p.stats ?? {}) };
  const vehicles = Array.isArray(p.vehicles) ? p.vehicles : [];
  const properties = Array.isArray(p.properties) ? p.properties : [];
  const achievements = Array.isArray(p.achievements) ? p.achievements : [];
  const transactions = Array.isArray(p.transactions) ? p.transactions : [];

  return (
    <section id="dashboard" className="border-y border-white/8 bg-slate-950/70 py-20">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <SectionTitle
            eyebrow="Citizen portal"
            title={`Welcome back, ${p.displayName || session.account.username}`}
            body={`Your NovaCity profile is synced with the game server. Continue exactly where you left off in ${map?.name ?? "NovaCity"}.`}
          />
          <PrimaryLink>Continue playing</PrimaryLink>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-950 p-5 shadow-2xl shadow-black/20 sm:p-7">
            <div className="flex flex-col justify-between gap-5 border-b border-white/8 pb-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-700 text-2xl font-black text-white shadow-lg shadow-sky-950/40">
                  {(p.displayName || session.account.username).slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl font-black text-white">{p.displayName || session.account.username}</h3>
                    <span className="rounded-md border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-300">
                      Level {level.level}
                    </span>
                    {session.account.role === "admin" ? (
                      <span className="rounded-md border border-violet-400/25 bg-violet-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                        Administrator
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-400">
                    {job ? `${job.icon} ${job.name} · ${rankName(job.id, p.jobRank ?? 0)}` : "Civilian · Unemployed"}
                  </p>
                </div>
              </div>
              <div className="min-w-52">
                <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <span>Level progress</span>
                  <span>
                    {level.into} / {level.need} XP
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-400 to-indigo-500"
                    style={{ width: `${Math.min(100, (level.into / level.need) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">
              {[
                ["Cash", euro(p.money ?? 0), "text-emerald-300"],
                ["Bank", euro(p.bank ?? 0), "text-sky-300"],
                ["Vehicles", vehicles.length, "text-slate-100"],
                ["Properties", properties.length, "text-slate-100"],
              ].map(([label, value, color]) => (
                <div key={String(label)} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}</div>
                  <div className={`mt-1 text-xl font-black ${color}`}>{value}</div>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["Jobs completed", stats.jobsCompleted],
                ["Calls cleared", stats.callsCleared],
                ["Distance driven", `${(stats.distance / 1000).toFixed(1)} km`],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between border-t border-white/8 pt-4 text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-bold text-slate-200">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">Your garage</h3>
                <Link href="/play" className="text-xs font-bold text-sky-400 hover:text-sky-300">
                  Manage in game
                </Link>
              </div>
              <div className="mt-4 space-y-2">
                {vehicles.length ? (
                  vehicles.slice(0, 3).map((vehicle) => {
                    const model = VEHICLE_MAP[vehicle.modelId];
                    return (
                      <div key={vehicle.uid} className="flex items-center gap-3 rounded-xl border border-white/8 bg-black/20 p-3">
                        <span className="h-8 w-8 rounded-lg border border-white/15" style={{ background: vehicle.color }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-slate-100">{model?.name ?? vehicle.modelId}</div>
                          <div className="text-[10px] text-slate-500">
                            {vehicle.plate} · {vehicle.stored ? "Stored" : "On street"}
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-300">⛽ {Math.round(vehicle.fuel)}%</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-500">
                    Buy your first vehicle at the Vantra Auto Centre.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-200">Latest activity</h3>
              <div className="mt-3 space-y-2">
                {transactions.length ? (
                  transactions.slice(0, 3).map((tx, index) => (
                    <div key={`${tx.t}-${index}`} className="flex justify-between gap-3 text-xs">
                      <span className="truncate text-slate-400">{tx.label}</span>
                      <span className={tx.amount >= 0 ? "font-bold text-emerald-300" : "font-bold text-rose-300"}>
                        {tx.amount >= 0 ? "+" : ""}
                        {euro(tx.amount)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500">No recent transactions.</p>
                )}
              </div>
              {calls[0] ? (
                <div className="mt-4 rounded-xl border border-rose-400/15 bg-rose-400/5 p-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-rose-300">Live dispatch</div>
                  <div className="mt-1 text-xs font-bold text-slate-100">{calls[0].title}</div>
                  <div className="text-[10px] text-slate-500">Priority {calls[0].priority} · {calls[0].department}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {achievements.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {achievements.slice(0, 8).map((id) => {
              const achievement = ACHIEVEMENT_MAP[id];
              if (!achievement) return null;
              return (
                <div key={id} className="flex items-center gap-2 rounded-xl border border-amber-400/15 bg-amber-400/5 px-3 py-2">
                  <span>{achievement.icon}</span>
                  <div>
                    <div className="text-[11px] font-bold text-amber-100">{achievement.name}</div>
                    <div className="text-[9px] text-slate-500">Unlocked</div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default function WebsiteHome() {
  const [menu, setMenu] = useState(false);
  const [session, setSession] = useState<SessionData>(null);
  const [accountChecked, setAccountChecked] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [calls, setCalls] = useState<DispatchCall[]>([]);
  const [department, setDepartment] = useState("all");
  const [faq, setFaq] = useState<number | null>(0);
  const [displayName, setDisplayName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let live = true;
    void Promise.allSettled([
      fetch("/api/health").then((response) => {
        if (live) setOnline(response.ok);
      }),
      fetch("/api/state").then(async (response) => {
        if (response.ok) {
          const data = (await response.json()) as SessionData;
          if (live && data) {
            setSession(data);
            setDisplayName(data.profile.displayName ?? data.account.username);
          }
        }
        if (live) setAccountChecked(true);
      }),
      fetch("/api/world/events?map=novacity").then(async (response) => {
        if (response.ok && live) {
          const data = (await response.json()) as { events: DispatchCall[] };
          setCalls(data.events ?? []);
        }
      }),
    ]);
    return () => {
      live = false;
    };
  }, []);

  const featuredJobs = useMemo(
    () => JOBS.filter((job) => department === "all" || job.dept === department).slice(0, 6),
    [department],
  );
  const featuredVehicles = VEHICLES.filter((vehicle) => vehicle.price > 0).slice(0, 4);

  async function saveDisplayName() {
    const trimmed = displayName.trim().slice(0, 24);
    if (!session || !trimmed) return;
    const response = await fetch("/api/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ displayName: trimmed }),
    });
    if (!response.ok) return;
    setSession({ ...session, profile: { ...session.profile, displayName: trimmed } });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#05080d] text-slate-100 selection:bg-sky-400/30">
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/8 bg-[#060a10]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link href="/" aria-label="NovaCity homepage">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-xs font-semibold text-slate-400 md:flex">
            <a href="#world" className="transition hover:text-white">World</a>
            <a href="#careers" className="transition hover:text-white">Careers</a>
            <a href="#vehicles" className="transition hover:text-white">Vehicles</a>
            <a href="#dispatch" className="transition hover:text-white">Live city</a>
            {session ? <a href="#dashboard" className="transition hover:text-white">My profile</a> : null}
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <StatusPill online={online} />
            <Link
              href={session ? "/play" : "/play?guest=1"}
              className="rounded-lg border border-sky-300/30 bg-sky-500 px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-sky-400"
            >
              {session ? "Continue" : "Play as guest"}
            </Link>
          </div>
          <button
            type="button"
            aria-label="Toggle navigation"
            onClick={() => setMenu((value) => !value)}
            className="rounded-lg border border-white/10 p-2 text-slate-300 sm:hidden"
          >
            {menu ? "✕" : "☰"}
          </button>
        </div>
        {menu ? (
          <nav className="border-t border-white/8 bg-slate-950 px-5 py-4 sm:hidden">
            <div className="grid gap-2 text-sm font-semibold text-slate-300">
              {["world", "careers", "vehicles", "dispatch", ...(session ? ["dashboard"] : [])].map((item) => (
                <a key={item} href={`#${item}`} onClick={() => setMenu(false)} className="rounded-lg px-3 py-2 capitalize hover:bg-white/5">
                  {item}
                </a>
              ))}
              <Link
                href={session ? "/play" : "/play?guest=1"}
                className="mt-2 rounded-lg bg-sky-500 px-3 py-2 text-center font-black text-white"
              >
                {session ? "CONTINUE NOVACITY" : "PLAY AS GUEST"}
              </Link>
            </div>
          </nav>
        ) : null}
      </header>

      <section className="relative flex min-h-[760px] items-center overflow-hidden pt-16">
        <Image
          src="/images/novacity-hero.jpg"
          alt="Original skyline of the fictional NovaCity"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#05080d] via-[#05080d]/85 to-[#05080d]/15" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#05080d] via-transparent to-[#05080d]/30" />
        <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(90,170,255,.09)_1px,transparent_1px),linear-gradient(90deg,rgba(90,170,255,.09)_1px,transparent_1px)] [background-size:56px_56px]" />

        <div className="relative mx-auto w-full max-w-7xl px-5 py-28 sm:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/20 bg-sky-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-sky-200 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-300" />
              An original browser-based open world
            </div>
            <h1 className="mt-6 text-5xl font-black leading-[0.95] tracking-[-0.045em] text-white sm:text-7xl lg:text-[92px]">
              LIVE YOUR LIFE.
              <br />
              <span className="bg-gradient-to-r from-sky-300 via-sky-400 to-indigo-400 bg-clip-text text-transparent">
                ANSWER THE CALL.
              </span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              NovaCity: Urban Response is a persistent multiplayer-ready roleplay world. Build a career, join an
              emergency service, own cars and property—or disappear into the city underground.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <PrimaryLink>
                <span>▶</span> PLAY NOVACITY IN BROWSER
              </PrimaryLink>
              <a
                href="#world"
                className="inline-flex items-center justify-center rounded-xl border border-white/15 bg-black/30 px-5 py-3 text-sm font-bold text-slate-200 backdrop-blur transition hover:border-white/30 hover:bg-white/5"
              >
                Explore the world
              </a>
            </div>
            <div className="mt-8 flex flex-wrap gap-x-7 gap-y-2 text-[11px] font-semibold text-slate-400">
              <span>✓ No installation</span>
              <span>✓ Persistent account</span>
              <span>✓ Keyboard & mouse</span>
              <span>✓ Local multiplayer simulation</span>
            </div>
          </div>
        </div>
        <div className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-[9px] font-bold uppercase tracking-[0.3em] text-slate-500 sm:flex">
          Discover NovaCity
          <span className="h-7 w-px bg-gradient-to-b from-sky-400 to-transparent" />
        </div>
      </section>

      {session ? <Dashboard session={session} calls={calls} /> : null}

      <section id="world" className="py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionTitle
            eyebrow="Five connected regions"
            title="One world. No single way to live in it."
            body="Travel by motorway, train, ferry or airport between dense urban streets, rural county roads, industrial docks and alpine passes. Every region has its own jobs, atmosphere and emergency calls."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-5">
            {MAPS.map((map, index) => (
              <article
                key={map.id}
                className={`group relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b p-5 transition hover:-translate-y-1 hover:border-sky-400/30 ${
                  index === 0
                    ? "from-sky-950/80 to-slate-950 lg:col-span-2"
                    : index === 1
                      ? "from-emerald-950/50 to-slate-950 lg:col-span-2"
                      : index === 2
                        ? "from-indigo-950/60 to-slate-950"
                        : index === 3
                          ? "from-cyan-950/50 to-slate-950 lg:col-span-2"
                          : "from-slate-800/60 to-slate-950 lg:col-span-3"
                }`}
              >
                <div className="absolute -right-8 -top-8 text-[110px] opacity-10 transition group-hover:scale-110 group-hover:opacity-15">
                  {districtIcons[index]}
                </div>
                <div className="relative flex h-full flex-col justify-between">
                  <div>
                    <span className="text-3xl">{districtIcons[index]}</span>
                    <h3 className="mt-4 text-xl font-black text-white">{map.name}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-sky-300/80">{map.tagline}</p>
                    <p className="mt-4 max-w-sm text-sm leading-6 text-slate-400">{map.desc}</p>
                  </div>
                  <div className="mt-6 flex gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    <span>{map.districts.length} zones</span>
                    <span>·</span>
                    <span>{map.landmarks.length} landmarks</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="careers" className="border-y border-white/8 bg-[#080c13] py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <SectionTitle
              eyebrow="Careers & services"
              title="A city powered by its people."
              body="Every career includes pay, missions, equipment, dedicated vehicles, job XP and rank progression. Change course whenever your story demands it."
            />
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "All"],
                ["civil", "Civilian"],
                ["public", "Public"],
                ["police", "Police"],
                ["fire", "Fire"],
                ["medical", "Medical"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDepartment(key)}
                  className={`rounded-lg border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition ${
                    department === key
                      ? "border-sky-300/30 bg-sky-500 text-white"
                      : "border-white/10 bg-white/[0.025] text-slate-400 hover:border-white/20 hover:text-slate-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {featuredJobs.map((job) => (
              <article key={job.id} className="group rounded-2xl border border-white/8 bg-slate-950/60 p-5 transition hover:border-sky-400/25 hover:bg-slate-900/70">
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/8 bg-white/[0.04] text-2xl">
                    {job.icon}
                  </span>
                  <span className={`h-2 w-2 rounded-full ${markerColor[job.dept] ?? "bg-slate-400"}`} />
                </div>
                <h3 className="mt-5 text-base font-black text-white">{job.name}</h3>
                <p className="mt-2 min-h-10 text-xs leading-5 text-slate-500">{job.desc}</p>
                <div className="mt-4 flex items-center justify-between border-t border-white/8 pt-4">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Starting reward</span>
                  <span className="text-xs font-black text-emerald-300">{euro(job.basePay)} / call</span>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-8 text-center">
            <PrimaryLink>Choose a career in game</PrimaryLink>
          </div>
        </div>
      </section>

      <section id="vehicles" className="py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SectionTitle
            eyebrow="Drive your story"
            title="Original vehicles. Real ownership."
            body="Buy, repair, fuel, store and customise a growing fleet of fictional European vehicles. Department vehicles unlock with jobs and rank permissions."
            center
          />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredVehicles.map((vehicle, index) => (
              <article key={vehicle.id} className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900 to-slate-950 p-5">
                <div
                  className="absolute inset-x-5 top-14 h-20 rounded-[50%] opacity-20 blur-2xl"
                  style={{ background: vehicle.color }}
                />
                <div className="relative flex h-36 items-center justify-center">
                  <div className="relative" style={{ transform: `scale(${0.9 + index * 0.03})` }}>
                    <div
                      className="h-11 w-40 rounded-[45%_45%_20%_20%] border-b-4 border-slate-950 shadow-2xl"
                      style={{ background: vehicle.color }}
                    />
                    <div className="absolute -top-6 left-8 h-8 w-24 rounded-t-[55%] border border-white/15 bg-slate-800" />
                    <div className="absolute -bottom-2 left-5 h-5 w-5 rounded-full border-[5px] border-slate-700 bg-black" />
                    <div className="absolute -bottom-2 right-5 h-5 w-5 rounded-full border-[5px] border-slate-700 bg-black" />
                    <div className="absolute right-1 top-3 h-2 w-3 rounded bg-amber-100" />
                  </div>
                </div>
                <div className="relative">
                  <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-slate-500">{vehicle.brand} · {vehicle.cls}</div>
                  <h3 className="mt-1 text-lg font-black text-white">{vehicle.name}</h3>
                  <p className="mt-2 min-h-12 text-xs leading-5 text-slate-500">{vehicle.desc}</p>
                  <div className="mt-4 flex items-end justify-between border-t border-white/8 pt-4">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-slate-600">Top speed</div>
                      <div className="text-xs font-bold text-slate-300">{Math.round(vehicle.topSpeed * 3.6)} km/h</div>
                    </div>
                    <div className="text-base font-black text-emerald-300">{euro(vehicle.price)}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="dispatch" className="border-y border-white/8 bg-[#080c13] py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <SectionTitle
              eyebrow="Living world"
              title="The city does not wait for you."
              body="Traffic collisions, fires, medical emergencies, alarms and industrial incidents enter the shared dispatch board in real time. Multiple departments can coordinate one response."
            />
            <div className="mt-7 grid grid-cols-2 gap-3">
              {[
                ["05", "Wanted levels"],
                ["16+", "Careers"],
                ["24h", "Day/night cycle"],
                ["05", "Weather states"],
              ].map(([number, label]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-slate-950/70 p-4">
                  <div className="text-2xl font-black text-sky-300">{number}</div>
                  <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/40">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15 text-lg">📡</span>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-slate-100">Nova Dispatch</div>
                  <div className="text-[10px] text-slate-500">Regional incident channel</div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
              </div>
            </div>
            <div className="divide-y divide-white/6">
              {(calls.length
                ? calls.slice(0, 5)
                : [
                    { id: -1, priority: 1, department: "medical", title: "Medical emergency", description: "Collapsed person at Kronen Plaza", status: "open", x: 40, z: 30 },
                    { id: -2, priority: 2, department: "police", title: "Intruder alarm", description: "Alarm activation at a commercial unit", status: "open", x: -120, z: 80 },
                    { id: -3, priority: 2, department: "fire", title: "Vehicle fire", description: "Smoke visible on the inner ring road", status: "en route", x: 240, z: -60 },
                  ]
              ).map((call) => (
                <div key={call.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 transition hover:bg-white/[0.025]">
                  <span
                    className={`flex h-10 w-10 items-center justify-center rounded-xl border text-xs font-black ${
                      call.priority === 1
                        ? "border-rose-400/25 bg-rose-400/10 text-rose-300"
                        : "border-amber-400/20 bg-amber-400/10 text-amber-300"
                    }`}
                  >
                    P{call.priority}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-black text-slate-100">{call.title}</div>
                    <div className="truncate text-[10px] text-slate-500">{call.description}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[9px] font-bold uppercase tracking-wider text-sky-300">{call.department}</div>
                    <div className="mt-1 text-[9px] text-slate-600">{call.status}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-white/8 bg-white/[0.02] px-5 py-3 text-[10px] text-slate-600">
              Calls shown here are sourced from the same database used by the live game.
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="relative overflow-hidden rounded-[32px] border border-sky-300/15 bg-gradient-to-r from-sky-950 via-indigo-950 to-slate-950 px-6 py-16 text-center sm:px-12">
            <div className="absolute -left-16 -top-24 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
            <div className="absolute -bottom-28 -right-10 h-80 w-80 rounded-full bg-indigo-400/10 blur-3xl" />
            <div className="relative">
              <SectionTitle
                eyebrow="Ready for duty?"
                title="Your life in NovaCity starts now."
                body="No download and no additional software. Create your citizen, step out of Central Station and decide what happens next."
                center
              />
              <div className="mt-8">
                <PrimaryLink>PLAY NOVACITY</PrimaryLink>
              </div>
              {!session && accountChecked ? (
                <p className="mt-4 text-[11px] text-slate-500">A free account is created before your first spawn.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-white/8 bg-[#080c13] py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-8 lg:grid-cols-2">
          <div>
            <SectionTitle eyebrow="Questions" title="Before you enter the city." />
            <div className="mt-8 space-y-2">
              {[
                ["Does NovaCity require an installation?", "No. The entire experience—including the 3D world, account system and persistent profile—runs directly in the browser Preview."],
                ["Is multiplayer available?", "The architecture synchronises live player presence through the database. When only one player is connected, simulated citizens keep the world active."],
                ["Is this based on an existing game or city?", "No. NovaCity, its map, vehicle manufacturers, departments, characters, interface and all game systems are original fictional creations."],
                ["Will my progress be saved?", "Yes. Money, XP, job rank, inventory, vehicles, properties, appearance, achievements and settings are stored server-side with a local browser fallback."],
              ].map(([question, answer], index) => (
                <div key={question} className="overflow-hidden rounded-xl border border-white/8 bg-slate-950/60">
                  <button
                    type="button"
                    onClick={() => setFaq(faq === index ? null : index)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left text-sm font-bold text-slate-200"
                  >
                    {question}
                    <span className="text-sky-400">{faq === index ? "−" : "+"}</span>
                  </button>
                  {faq === index ? <p className="border-t border-white/6 px-4 py-4 text-xs leading-6 text-slate-500">{answer}</p> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 sm:p-8">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-sky-400">Account</div>
            {session ? (
              <div className="mt-5">
                <h3 className="text-2xl font-black text-white">Citizen settings</h3>
                <p className="mt-2 text-sm text-slate-500">Update your public display name from the website. All other character settings remain available in game.</p>
                <label className="mt-6 block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Display name</span>
                  <div className="mt-2 flex gap-2">
                    <input
                      value={displayName}
                      maxLength={24}
                      onChange={(event) => setDisplayName(event.target.value)}
                      className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-sky-400/40"
                    />
                    <button
                      type="button"
                      onClick={() => void saveDisplayName()}
                      className="rounded-xl bg-sky-500 px-4 py-3 text-xs font-black text-white transition hover:bg-sky-400"
                    >
                      {saved ? "Saved ✓" : "Save"}
                    </button>
                  </div>
                </label>
                <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] p-4 text-xs text-slate-500">
                  <div className="flex justify-between gap-3 py-1"><span>Username</span><span className="font-bold text-slate-300">{session.account.username}</span></div>
                  <div className="flex justify-between gap-3 py-1"><span>Account role</span><span className="font-bold capitalize text-slate-300">{session.account.role}</span></div>
                  <div className="flex justify-between gap-3 py-1"><span>Player ID</span><span className="font-bold text-slate-300">NC-{String(session.account.id).padStart(6, "0")}</span></div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <PrimaryLink>Continue playing</PrimaryLink>
                  <button
                    type="button"
                    onClick={async () => {
                      await fetch("/api/auth/logout", { method: "POST" });
                      setSession(null);
                    }}
                    className="rounded-xl border border-white/10 px-4 py-3 text-xs font-bold text-slate-400 transition hover:border-rose-400/20 hover:text-rose-300"
                  >
                    Log out
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <h3 className="text-2xl font-black text-white">Play with or without an account.</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Guest mode saves locally in this browser. An optional account adds server-side progress and
                  live presence. Passwords are secured with bcrypt and sessions use HTTP-only cookies.
                </p>
                <div className="mt-6">
                  <PrimaryLink>Play as guest</PrimaryLink>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Link href="/play" className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5">
                    Create account (optional)
                  </Link>
                  <Link href="/play" className="inline-flex items-center justify-center rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-slate-300 transition hover:bg-white/5">
                    Log in (optional)
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="border-t border-white/8 bg-[#04070b]">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 py-10 sm:flex-row sm:px-8">
          <Logo />
          <p className="max-w-xl text-center text-[10px] leading-5 text-slate-600 sm:text-left">
            NovaCity: Urban Response is an original fictional browser game. All world names, districts, brands,
            departments, vehicles, characters and assets were created specifically for this project.
          </p>
          <div className="flex gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            <a href="#world" className="hover:text-slate-300">World</a>
            <a href="#careers" className="hover:text-slate-300">Careers</a>
            <Link href="/play?guest=1" className="text-sky-400 hover:text-sky-300">Play as guest</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
