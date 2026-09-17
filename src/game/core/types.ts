/** Shared domain types for every NovaCity system. */

export type AccountInfo = {
  id: number;
  email: string;
  username: string;
  role: string;
  createdAt: string;
};

export type CharacterAppearance = {
  height: number; // 0..1
  build: number; // 0..1
  skin: string;
  face: number;
  hair: number;
  hairColor: string;
  eyeColor: string;
  shirt: string;
  jacket: string;
  pants: string;
  shoes: string;
  hat: number;
  accessory: number;
  style: string;
};

export type InventoryItem = {
  id: string;
  name: string;
  kind: "weapon" | "tool" | "consumable" | "valuable" | "ammo";
  qty: number;
  ammo?: number;
};

export type OwnedVehicle = {
  uid: string;
  modelId: string;
  plate: string;
  color: string;
  wheels: number;
  performance: number;
  fuel: number;
  condition: number;
  stored: boolean;
  garage: string;
  siren: boolean;
};

export type OwnedProperty = {
  id: string;
  name: string;
  kind: string;
  map: string;
  x: number;
  z: number;
  price: number;
  storage: InventoryItem[];
  isSpawn: boolean;
};

export type Transaction = {
  t: number;
  label: string;
  amount: number;
  kind: "cash" | "bank";
};

export type CrimeRecord = { t: number; crime: string; points: number };

export type PlayerStats = {
  distance: number;
  jobsCompleted: number;
  crimes: number;
  arrests: number;
  robberies: number;
  moneyEarned: number;
  moneySpent: number;
  playTime: number;
  timesArrested: number;
  callsCleared: number;
};

export type GameSettings = {
  quality: "low" | "medium" | "high";
  shadows: boolean;
  effects: boolean;
  viewDistance: number;
  master: number;
  sfx: number;
  ambient: number;
  sensitivity: number;
  invertY: boolean;
  hud: boolean;
  uiScale: number;
  textSize: number;
  reducedEffects: boolean;
  minimap: boolean;
};

export type PlayerState = {
  accountId: number;
  username: string;
  displayName: string;
  role: string;
  createdAt: string;
  money: number;
  bank: number;
  xp: number;
  level: number;
  job: string;
  jobRank: number;
  jobXp: Record<string, number>;
  wanted: number;
  currentMap: string;
  characterDone: boolean;
  tutorialDone: boolean;
  character: CharacterAppearance;
  inventory: InventoryItem[];
  vehicles: OwnedVehicle[];
  properties: OwnedProperty[];
  stats: PlayerStats;
  achievements: string[];
  settings: GameSettings;
  transactions: Transaction[];
  crimeHistory: CrimeRecord[];
};

export type DispatchCall = {
  id: number;
  map: string;
  type: string;
  title: string;
  description: string;
  priority: number;
  department: string;
  x: number;
  z: number;
  status: string;
  assigned: string[];
  createdAt: number;
};

export type Notification = {
  id: number;
  title: string;
  body: string;
  tone: "info" | "success" | "warn" | "danger" | "dispatch";
  t: number;
};

export type PhoneMessage = {
  id: number;
  from: string;
  body: string;
  t: number;
  unread: boolean;
};

export type MissionStep = {
  label: string;
  x: number;
  z: number;
  hold: number; // seconds of interaction required, 0 = just arrive
};

export type ActiveMission = {
  id: string;
  title: string;
  job: string;
  steps: MissionStep[];
  index: number;
  progress: number;
  pay: number;
  xp: number;
};

export type WorldMarker = {
  id: string;
  kind:
    | "shop"
    | "atm"
    | "bank"
    | "job"
    | "garage"
    | "property"
    | "dealership"
    | "police"
    | "hospital"
    | "fire"
    | "fuel"
    | "clothing"
    | "weapon"
    | "jewelry"
    | "travel";
  label: string;
  x: number;
  z: number;
  data?: Record<string, unknown>;
};

export type HudSnapshot = {
  speed: number;
  gear: string;
  inVehicle: boolean;
  vehicleName: string;
  fuel: number;
  condition: number;
  engineOn: boolean;
  lights: boolean;
  siren: boolean;
  health: number;
  armor: number;
  stamina: number;
  x: number;
  z: number;
  heading: number;
  clock: string;
  weather: string;
  nearby: string | null;
  nearbyKey: string;
  pursuit: boolean;
  arrested: boolean;
  jailTime: number;
  fps: number;
  otherPlayers: number;
  peds: number;
};
