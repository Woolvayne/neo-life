"use client";

import type {
  AccountInfo,
  ActiveMission,
  DispatchCall,
  HudSnapshot,
  Notification,
  PhoneMessage,
  PlayerState,
  WorldMarker,
} from "./types";
import { levelFromXp } from "./defaults";

/* ------------------------------------------------------------------ */
/* tiny observable store (works with useSyncExternalStore)             */
/* ------------------------------------------------------------------ */

export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const p = typeof patch === "function" ? (patch as (s: T) => Partial<T>)(state) : patch;
      state = { ...state, ...p };
      listeners.forEach((l) => l());
    },
    replace(next: T) {
      state = next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
}

export type Phase =
  | "boot"
  | "auth"
  | "character"
  | "intro"
  | "loading"
  | "playing";

export type PanelId =
  | null
  | "phone"
  | "map"
  | "shop"
  | "bank"
  | "atm"
  | "garage"
  | "dealership"
  | "jobs"
  | "clothing"
  | "weapon"
  | "property"
  | "mdt"
  | "admin"
  | "settings"
  | "stats"
  | "travel"
  | "pause"
  | "arrest"
  | "interior";

export type UiState = {
  phase: Phase;
  account: AccountInfo | null;
  panel: PanelId;
  panelData: Record<string, unknown> | null;
  notifications: Notification[];
  dispatch: DispatchCall[];
  messages: PhoneMessage[];
  mission: ActiveMission | null;
  markers: WorldMarker[];
  tutorialStep: number;
  loadingText: string;
  loadingPct: number;
  mapTarget: { x: number; z: number } | null;
  otherPlayers: { id: number; username: string; x: number; z: number; job: string; wanted: number }[];
  saving: boolean;
  lastSaved: number;
  interiorName: string | null;
  cinematic: boolean;
};

export const uiStore = createStore<UiState>({
  phase: "boot",
  account: null,
  panel: null,
  panelData: null,
  notifications: [],
  dispatch: [],
  messages: [],
  mission: null,
  markers: [],
  tutorialStep: 0,
  loadingText: "Booting NovaCity runtime",
  loadingPct: 0,
  mapTarget: null,
  otherPlayers: [],
  saving: false,
  lastSaved: 0,
  interiorName: null,
  cinematic: false,
});

export const playerStore = createStore<PlayerState | null>(null);

export const hudStore = createStore<HudSnapshot>({
  speed: 0,
  gear: "P",
  inVehicle: false,
  vehicleName: "",
  fuel: 100,
  condition: 100,
  engineOn: false,
  lights: false,
  siren: false,
  health: 100,
  armor: 0,
  stamina: 100,
  x: 0,
  z: 0,
  heading: 0,
  clock: "08:00",
  weather: "Clear",
  nearby: null,
  nearbyKey: "",
  pursuit: false,
  arrested: false,
  jailTime: 0,
  fps: 60,
  otherPlayers: 0,
  peds: 0,
});

/* ------------------------------------------------------------------ */
/* notifications / messages                                            */
/* ------------------------------------------------------------------ */

let nid = 1;
export function notify(
  title: string,
  body = "",
  tone: Notification["tone"] = "info",
  ttl = 6000,
) {
  const n: Notification = { id: nid++, title, body, tone, t: Date.now() };
  uiStore.set((s) => ({ notifications: [...s.notifications.slice(-5), n] }));
  window.setTimeout(() => {
    uiStore.set((s) => ({ notifications: s.notifications.filter((x) => x.id !== n.id) }));
  }, ttl);
}

let mid = 1;
export function pushMessage(from: string, body: string) {
  const m: PhoneMessage = { id: mid++, from, body, t: Date.now(), unread: true };
  uiStore.set((s) => ({ messages: [m, ...s.messages].slice(0, 60) }));
}

/* ------------------------------------------------------------------ */
/* persistence (/database layer — server first, localStorage mirror)   */
/* ------------------------------------------------------------------ */

const LS_KEY = "novacity.profile.v1";
const LS_GUEST_KEY = "novacity.guest.v1";
let saveTimer: number | null = null;
let pending = false;

export function mirrorLocal(p: PlayerState) {
  try {
    const key = p.role === "guest" ? LS_GUEST_KEY : LS_KEY;
    localStorage.setItem(key, JSON.stringify(p));
  } catch {
    /* storage full / disabled */
  }
}

export function readLocal(): PlayerState | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as PlayerState) : null;
  } catch {
    return null;
  }
}

export function readGuest(): PlayerState | null {
  try {
    const raw = localStorage.getItem(LS_GUEST_KEY);
    const parsed = raw ? (JSON.parse(raw) as PlayerState) : null;
    return parsed?.role === "guest" ? parsed : null;
  } catch {
    return null;
  }
}

export async function flushSave() {
  const p = playerStore.get();
  if (!p) return;
  pending = false;
  uiStore.set({ saving: true });
  mirrorLocal(p);
  if (p.role === "guest" || p.accountId <= 0) {
    uiStore.set({ saving: false, lastSaved: Date.now() });
    return;
  }
  try {
    await fetch("/api/state", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        money: p.money,
        bank: p.bank,
        xp: p.xp,
        level: p.level,
        job: p.job,
        jobRank: p.jobRank,
        wanted: p.wanted,
        currentMap: p.currentMap,
        characterDone: p.characterDone ? 1 : 0,
        tutorialDone: p.tutorialDone ? 1 : 0,
        character: p.character,
        inventory: p.inventory,
        vehicles: p.vehicles,
        properties: p.properties,
        jobXp: p.jobXp,
        stats: p.stats,
        achievements: p.achievements,
        settings: p.settings,
        transactions: p.transactions.slice(0, 40),
        crimeHistory: p.crimeHistory.slice(0, 40),
        displayName: p.displayName,
      }),
    });
    uiStore.set({ saving: false, lastSaved: Date.now() });
  } catch {
    uiStore.set({ saving: false });
  }
}

export function scheduleSave() {
  pending = true;
  if (saveTimer !== null) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    if (pending) void flushSave();
  }, 2500);
}

/** Mutate the persistent profile and queue a save. */
export function updatePlayer(fn: (p: PlayerState) => Partial<PlayerState>) {
  const cur = playerStore.get();
  if (!cur) return;
  const patch = fn(cur);
  const next = { ...cur, ...patch };
  const lv = levelFromXp(next.xp);
  next.level = lv.level;
  playerStore.replace(next);
  scheduleSave();
}

export function addMoney(amount: number, label: string, kind: "cash" | "bank" = "cash") {
  updatePlayer((p) => {
    const tx = [{ t: Date.now(), label, amount, kind }, ...p.transactions].slice(0, 40);
    const stats = { ...p.stats };
    if (amount > 0) stats.moneyEarned += amount;
    else stats.moneySpent += -amount;
    return kind === "cash"
      ? { money: Math.max(0, p.money + amount), transactions: tx, stats }
      : { bank: Math.max(0, p.bank + amount), transactions: tx, stats };
  });
}

export function addXp(amount: number, jobId?: string) {
  updatePlayer((p) => {
    const jobXp = { ...p.jobXp };
    if (jobId) jobXp[jobId] = (jobXp[jobId] ?? 0) + amount;
    return { xp: p.xp + amount, jobXp };
  });
}

export function grantAchievement(id: string, name: string) {
  const p = playerStore.get();
  if (!p || p.achievements.includes(id)) return;
  updatePlayer((s) => ({ achievements: [...s.achievements, id] }));
  notify("Achievement unlocked", name, "success", 7000);
}
