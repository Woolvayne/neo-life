import type {
  CharacterAppearance,
  GameSettings,
  PlayerStats,
  PlayerState,
} from "./types";

export const SKIN_TONES = ["#f2d3bd", "#e0b38c", "#c68a62", "#9c6340", "#6f4429", "#4a2d1c"];
export const HAIR_COLORS = ["#1b1b1f", "#4b2e1b", "#8a5a2b", "#c9a227", "#b4b4bd", "#8c2f39", "#2f5fa8"];
export const EYE_COLORS = ["#3a6ea5", "#4b7a3a", "#5a4632", "#6b6b6b", "#2f2f2f"];
export const CLOTH_COLORS = [
  "#1f2937",
  "#0f766e",
  "#7c2d12",
  "#1e3a8a",
  "#4c1d95",
  "#065f46",
  "#9a3412",
  "#b91c1c",
  "#0369a1",
  "#374151",
  "#f3f4f6",
  "#facc15",
];

export const STYLE_PRESETS: Record<
  string,
  { shirt: string; jacket: string; pants: string; shoes: string; label: string }
> = {
  casual: { label: "Casual", shirt: "#2563eb", jacket: "#1f2937", pants: "#374151", shoes: "#111827" },
  business: { label: "Business", shirt: "#f3f4f6", jacket: "#111827", pants: "#1f2937", shoes: "#0b0b0f" },
  police: { label: "Police", shirt: "#1e3a8a", jacket: "#172554", pants: "#0f172a", shoes: "#0b0b0f" },
  medical: { label: "Medical", shirt: "#dc2626", jacket: "#b91c1c", pants: "#111827", shoes: "#1f2937" },
  fire: { label: "Fire Dept.", shirt: "#f97316", jacket: "#7c2d12", pants: "#1f2937", shoes: "#111827" },
  construction: { label: "Construction", shirt: "#facc15", jacket: "#ca8a04", pants: "#4b5563", shoes: "#292524" },
  security: { label: "Security", shirt: "#111827", jacket: "#1f2937", pants: "#111827", shoes: "#0b0b0f" },
  criminal: { label: "Street", shirt: "#0f172a", jacket: "#111827", pants: "#1f2937", shoes: "#7f1d1d" },
};

export const defaultCharacter = (): CharacterAppearance => ({
  height: 0.5,
  build: 0.5,
  skin: SKIN_TONES[1],
  face: 0,
  hair: 1,
  hairColor: HAIR_COLORS[0],
  eyeColor: EYE_COLORS[0],
  shirt: STYLE_PRESETS.casual.shirt,
  jacket: STYLE_PRESETS.casual.jacket,
  pants: STYLE_PRESETS.casual.pants,
  shoes: STYLE_PRESETS.casual.shoes,
  hat: 0,
  accessory: 0,
  style: "casual",
});

export const defaultSettings = (): GameSettings => ({
  quality: "medium",
  shadows: true,
  effects: true,
  viewDistance: 420,
  master: 0.7,
  sfx: 0.8,
  ambient: 0.5,
  sensitivity: 0.5,
  invertY: false,
  hud: true,
  uiScale: 1,
  textSize: 1,
  reducedEffects: false,
  minimap: true,
});

export const defaultStats = (): PlayerStats => ({
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
});

export function xpForLevel(level: number) {
  return Math.round(220 * Math.pow(level, 1.35));
}

export function levelFromXp(xp: number) {
  let lvl = 1;
  let acc = 0;
  while (lvl < 100) {
    const need = xpForLevel(lvl);
    if (xp < acc + need) break;
    acc += need;
    lvl++;
  }
  return { level: lvl, into: xp - acc, need: xpForLevel(lvl) };
}

type ProfileRow = Record<string, unknown>;

export function createGuestState(existing?: PlayerState | null): PlayerState {
  if (existing?.role === "guest") return existing;
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const username = `Guest${suffix}`;
  const createdAt = new Date().toISOString();
  return hydrateState(
    { id: 0, username, role: "guest", createdAt },
    {
      displayName: username,
      createdAt,
      characterDone: 0,
      tutorialDone: 0,
    },
  );
}

export function hydrateState(account: {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}, row: ProfileRow): PlayerState {
  const obj = <T,>(v: unknown, fallback: T): T =>
    v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length
      ? ({ ...fallback, ...(v as object) } as T)
      : fallback;
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);
  return {
    accountId: account.id,
    username: account.username,
    role: account.role,
    createdAt: (row.createdAt as string) ?? account.createdAt,
    displayName: (row.displayName as string) ?? account.username,
    money: (row.money as number) ?? 750,
    bank: (row.bank as number) ?? 2500,
    xp: (row.xp as number) ?? 0,
    level: (row.level as number) ?? 1,
    job: (row.job as string) ?? "unemployed",
    jobRank: (row.jobRank as number) ?? 0,
    jobXp: obj<Record<string, number>>(row.jobXp, {}),
    wanted: (row.wanted as number) ?? 0,
    currentMap: (row.currentMap as string) ?? "novacity",
    characterDone: Boolean(row.characterDone),
    tutorialDone: Boolean(row.tutorialDone),
    character: obj<CharacterAppearance>(row.character, defaultCharacter()),
    inventory: arr(row.inventory),
    vehicles: arr(row.vehicles),
    properties: arr(row.properties),
    stats: obj<PlayerStats>(row.stats, defaultStats()),
    achievements: arr(row.achievements),
    settings: obj<GameSettings>(row.settings, defaultSettings()),
    transactions: arr(row.transactions),
    crimeHistory: arr(row.crimeHistory),
  };
}
