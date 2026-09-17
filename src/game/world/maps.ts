/** /maps — data-driven region definitions. Add a new entry to ship a new map. */

export type DistrictKind =
  | "downtown"
  | "commercial"
  | "residential"
  | "industrial"
  | "suburb"
  | "port"
  | "airport"
  | "country"
  | "mountain"
  | "park";

export type District = {
  id: string;
  name: string;
  kind: DistrictKind;
  cx: number;
  cz: number;
  rx: number;
  rz: number;
};

export type LandmarkKind =
  | "police"
  | "hospital"
  | "fire"
  | "bank"
  | "shop"
  | "jewelry"
  | "clothing"
  | "weapon"
  | "dealership"
  | "garage"
  | "job"
  | "fuel"
  | "atm"
  | "travel"
  | "tower"
  | "terminal"
  | "warehouse";

export type Landmark = {
  id: string;
  kind: LandmarkKind;
  label: string;
  x: number;
  z: number;
  rot?: number;
  interior?: string;
  data?: Record<string, unknown>;
};

export type MapConfig = {
  id: string;
  name: string;
  tagline: string;
  desc: string;
  half: number; // half-extent in meters
  block: number; // road grid spacing
  ground: string;
  sky: string;
  fog: number;
  spawn: { x: number; z: number };
  districts: District[];
  landmarks: Landmark[];
  water?: { x: number; z: number; w: number; h: number }[];
  hills?: { x: number; z: number; r: number; h: number }[];
  travel: { to: string; label: string; x: number; z: number; mode: string; price: number }[];
  trafficDensity: number;
  pedDensity: number;
};

const L = (
  id: string,
  kind: LandmarkKind,
  label: string,
  x: number,
  z: number,
  interior?: string,
  data?: Record<string, unknown>,
): Landmark => ({ id, kind, label, x, z, interior, data });

export const MAPS: MapConfig[] = [
  {
    id: "novacity",
    name: "NovaCity",
    tagline: "The beating heart of the region",
    desc: "Dense European core: high-rises, shopping streets, apartment blocks, parks and the inner ring road.",
    half: 760,
    block: 76,
    ground: "#2f3338",
    sky: "#8fb2d6",
    fog: 620,
    spawn: { x: 0, z: 40 },
    trafficDensity: 46,
    pedDensity: 60,
    districts: [
      { id: "core", name: "Kronen Core", kind: "downtown", cx: 0, cz: 0, rx: 240, rz: 240 },
      { id: "market", name: "Marktviertel", kind: "commercial", cx: -330, cz: -150, rx: 200, rz: 200 },
      { id: "altbau", name: "Altbau Quarter", kind: "residential", cx: 330, cz: -180, rx: 220, rz: 200 },
      { id: "sud", name: "Südhafen Works", kind: "industrial", cx: -320, cz: 360, rx: 240, rz: 230 },
      { id: "gartn", name: "Gartenfeld", kind: "suburb", cx: 340, cz: 330, rx: 240, rz: 230 },
      { id: "park", name: "Volkspark", kind: "park", cx: -40, cz: -400, rx: 190, rz: 150 },
    ],
    water: [{ x: 620, z: 620, w: 260, h: 220 }],
    landmarks: [
      L("nc_police", "police", "Nova Police HQ — Precinct 1", -120, 120, "police"),
      L("nc_hospital", "hospital", "Kronen General Hospital", 150, 130, "hospital"),
      L("nc_fire", "fire", "Fire Station 3", -150, -110, "fire"),
      L("nc_bank", "bank", "NovaBank Central", 80, -80, "bank"),
      L("nc_shop1", "shop", "Eck-Markt Convenience", -228, 48, "shop"),
      L("nc_shop2", "shop", "Tagwerk Mini Market", 300, 200, "shop"),
      L("nc_shop3", "shop", "Nordstern Kiosk", -380, -260, "shop"),
      L("nc_jewel", "jewelry", "Brillant & Sohn Jewelers", 200, -240, "shop"),
      L("nc_cloth", "clothing", "Fadenwerk Clothing", -60, -190, "shop"),
      L("nc_weapon", "weapon", "Falkner Sport & Defence", -300, 290, "shop"),
      L("nc_deal", "dealership", "Vantra Auto Centre", 250, 60, undefined),
      L("nc_garage1", "garage", "Kronen Parking Garage", -70, 250, undefined),
      L("nc_garage2", "garage", "Gartenfeld Garage", 330, 340, undefined),
      L("nc_job", "job", "NovaCity Job Centre", 20, 180, undefined),
      L("nc_fuel1", "fuel", "Ringstraße Fuel", -250, -40, undefined),
      L("nc_fuel2", "fuel", "Gartenfeld Fuel", 380, 260, undefined),
      L("nc_atm1", "atm", "ATM — Kronen Plaza", 40, 30, undefined),
      L("nc_atm2", "atm", "ATM — Marktviertel", -300, -150, undefined),
      L("nc_atm3", "atm", "ATM — Altbau", 320, -180, undefined),
      L("nc_tower1", "tower", "Nova Tower", -20, -30, undefined),
      L("nc_station", "travel", "Central Station", 0, 60, undefined, {
        to: "airport",
        mode: "Express Rail",
        price: 45,
      }),
    ],
    travel: [
      { to: "novacounty", label: "County Highway A1", x: -740, z: 0, mode: "Highway", price: 0 },
      { to: "airport", label: "Airport Express Rail", x: 0, z: 60, mode: "Train", price: 45 },
      { to: "port", label: "Harbour Ferry", x: 600, z: 600, mode: "Ferry", price: 30 },
      { to: "mountain", label: "Mountain Road B7", x: 0, z: -740, mode: "Highway", price: 0 },
    ],
  },
  {
    id: "novacounty",
    name: "NovaCounty",
    tagline: "Farmland, forests and quiet villages",
    desc: "Rolling countryside with farms, dirt roads, a lake, forests and two small villages.",
    half: 860,
    block: 215,
    ground: "#3f5a32",
    sky: "#a9c6e4",
    fog: 900,
    spawn: { x: 0, z: 0 },
    trafficDensity: 16,
    pedDensity: 14,
    districts: [
      { id: "village", name: "Birkendorf", kind: "suburb", cx: -200, cz: -180, rx: 180, rz: 160 },
      { id: "village2", name: "Hollerbach", kind: "suburb", cx: 340, cz: 300, rx: 160, rz: 150 },
      { id: "farm", name: "Farmland", kind: "country", cx: 200, cz: -300, rx: 380, rz: 300 },
      { id: "forest", name: "Tannwald Forest", kind: "country", cx: -400, cz: 380, rx: 340, rz: 330 },
    ],
    water: [{ x: 430, z: -30, w: 300, h: 240 }],
    hills: [
      { x: -600, z: -520, r: 200, h: 60 },
      { x: 620, z: 560, r: 180, h: 44 },
    ],
    landmarks: [
      L("cy_police", "police", "County Sheriff Post", -190, -150, "police"),
      L("cy_fire", "fire", "Volunteer Fire Station", 330, 280, "fire"),
      L("cy_hospital", "hospital", "County Clinic", -160, -230, "hospital"),
      L("cy_shop", "shop", "Birkendorf Village Store", -240, -120, "shop"),
      L("cy_shop2", "shop", "Hollerbach Farm Shop", 360, 340, "shop"),
      L("cy_fuel", "fuel", "Landstraße Fuel Stop", 40, 120, undefined),
      L("cy_job", "job", "County Work Exchange", -200, -60, undefined),
      L("cy_garage", "garage", "Barn Garage", -120, -200, undefined),
      L("cy_atm", "atm", "ATM — Birkendorf", -220, -170, undefined),
      L("cy_warehouse", "warehouse", "Grain Silo Depot", 250, -380, undefined),
    ],
    travel: [
      { to: "novacity", label: "City Highway A1", x: 830, z: 0, mode: "Highway", price: 0 },
      { to: "mountain", label: "Alpine Pass", x: -820, z: -600, mode: "Highway", price: 0 },
    ],
  },
  {
    id: "airport",
    name: "Airport District",
    tagline: "NovaCity International",
    desc: "Terminal, runways, cargo apron, airport police and long-stay parking.",
    half: 620,
    block: 155,
    ground: "#3a3f45",
    sky: "#9dbbd8",
    fog: 760,
    spawn: { x: -180, z: 260 },
    trafficDensity: 22,
    pedDensity: 34,
    districts: [
      { id: "terminal", name: "Terminal Zone", kind: "airport", cx: -150, cz: 200, rx: 260, rz: 200 },
      { id: "apron", name: "Cargo Apron", kind: "airport", cx: 250, cz: -160, rx: 300, rz: 260 },
      { id: "svc", name: "Service Park", kind: "industrial", cx: -300, cz: -280, rx: 200, rz: 180 },
    ],
    landmarks: [
      L("ap_terminal", "terminal", "Terminal A", -150, 150, "shop"),
      L("ap_police", "police", "Airport Police Unit", -320, 210, "police"),
      L("ap_fire", "fire", "Airfield Rescue Station", 120, 120, "fire"),
      L("ap_shop", "shop", "Terminal Convenience", -110, 205, "shop"),
      L("ap_job", "job", "Ground Crew Office", -60, 250, undefined),
      L("ap_garage", "garage", "Long Stay Parking", -380, 320, undefined),
      L("ap_fuel", "fuel", "Service Fuel Point", -300, -180, undefined),
      L("ap_atm", "atm", "ATM — Terminal A", -170, 210, undefined),
      L("ap_ware", "warehouse", "Cargo Hall 2", 300, -220, undefined),
    ],
    travel: [
      { to: "novacity", label: "City Express Rail", x: -150, z: 300, mode: "Train", price: 45 },
      { to: "port", label: "Cargo Link Road", x: 580, z: 300, mode: "Highway", price: 0 },
    ],
  },
  {
    id: "port",
    name: "Port District",
    tagline: "Container terminal & heavy industry",
    desc: "Cranes, container stacks, ships, rail sidings and warehouses.",
    half: 600,
    block: 120,
    ground: "#35383d",
    sky: "#8aa7c2",
    fog: 700,
    spawn: { x: -200, z: 300 },
    trafficDensity: 24,
    pedDensity: 26,
    districts: [
      { id: "terminal", name: "Container Terminal", kind: "port", cx: 180, cz: -120, rx: 330, rz: 300 },
      { id: "ware", name: "Warehouse Row", kind: "industrial", cx: -240, cz: 120, rx: 260, rz: 300 },
      { id: "rail", name: "Rail Yard", kind: "industrial", cx: -60, cz: 380, rx: 400, rz: 140 },
    ],
    water: [{ x: 420, z: -420, w: 420, h: 340 }],
    landmarks: [
      L("pt_police", "police", "Harbour Police Post", -300, 300, "police"),
      L("pt_fire", "fire", "Port Fire Brigade", -120, 60, "fire"),
      L("pt_hospital", "hospital", "Dock Medical Point", -340, 60, "hospital"),
      L("pt_shop", "shop", "Dockside Kiosk", -260, 220, "shop"),
      L("pt_job", "job", "Port Labour Office", -200, 250, undefined),
      L("pt_garage", "garage", "Port Vehicle Depot", -420, 240, undefined),
      L("pt_fuel", "fuel", "Terminal Diesel", 40, 260, undefined),
      L("pt_ware1", "warehouse", "Warehouse A", -230, -60, undefined),
      L("pt_ware2", "warehouse", "Warehouse B", -230, 180, undefined),
      L("pt_atm", "atm", "ATM — Dock Gate", -270, 260, undefined),
    ],
    travel: [
      { to: "novacity", label: "Harbour Ferry", x: -480, z: 420, mode: "Ferry", price: 30 },
      { to: "airport", label: "Cargo Link Road", x: 560, z: 400, mode: "Highway", price: 0 },
    ],
  },
  {
    id: "mountain",
    name: "Mountain Region",
    tagline: "Hairpins, tunnels and alpine air",
    desc: "Steep terrain, a ski village, serpentine roads and a reservoir.",
    half: 700,
    block: 175,
    ground: "#4a5348",
    sky: "#b6cfe8",
    fog: 820,
    spawn: { x: 0, z: 300 },
    trafficDensity: 14,
    pedDensity: 18,
    districts: [
      { id: "village", name: "Hochstein Village", kind: "suburb", cx: 0, cz: 280, rx: 220, rz: 180 },
      { id: "slopes", name: "Alpine Slopes", kind: "mountain", cx: -200, cz: -260, rx: 380, rz: 330 },
      { id: "reservoir", name: "Reservoir", kind: "country", cx: 330, cz: -180, rx: 260, rz: 230 },
    ],
    water: [{ x: 340, z: -200, w: 260, h: 210 }],
    hills: [
      { x: -300, z: -300, r: 260, h: 130 },
      { x: 120, z: -420, r: 200, h: 96 },
      { x: -540, z: 120, r: 180, h: 78 },
    ],
    landmarks: [
      L("mt_police", "police", "Alpine Police Post", -60, 320, "police"),
      L("mt_fire", "fire", "Mountain Rescue Base", 90, 300, "fire"),
      L("mt_hospital", "hospital", "Hochstein Clinic", 150, 340, "hospital"),
      L("mt_shop", "shop", "Gipfel Store", -140, 300, "shop"),
      L("mt_job", "job", "Mountain Works Office", 20, 350, undefined),
      L("mt_garage", "garage", "Village Garage", -200, 360, undefined),
      L("mt_fuel", "fuel", "Pass Fuel Station", 260, 160, undefined),
      L("mt_atm", "atm", "ATM — Hochstein", -100, 330, undefined),
    ],
    travel: [
      { to: "novacity", label: "Mountain Road B7", x: 0, z: 660, mode: "Highway", price: 0 },
      { to: "novacounty", label: "Alpine Pass", x: -660, z: 400, mode: "Highway", price: 0 },
    ],
  },
];

export const MAP_BY_ID: Record<string, MapConfig> = Object.fromEntries(
  MAPS.map((m) => [m.id, m]),
);

export function districtAt(map: MapConfig, x: number, z: number): District | null {
  for (const d of map.districts) {
    if (Math.abs(x - d.cx) <= d.rx && Math.abs(z - d.cz) <= d.rz) return d;
  }
  return null;
}

/** deterministic PRNG so every player streams the identical world */
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
