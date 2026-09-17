import type { InventoryItem } from "@/game/core/types";

/** /weapons — entirely fictional equipment, gameplay stats only. */
export type WeaponDef = {
  id: string;
  name: string;
  category: "handgun" | "shotgun" | "smg" | "rifle" | "nonlethal" | "police" | "tool";
  damage: number;
  range: number;
  fireRate: number; // shots per second
  magazine: number;
  price: number;
  restricted: "none" | "police" | "licence";
  desc: string;
};

export const WEAPONS: WeaponDef[] = [
  { id: "w_kestrel", name: "Kestrel K9 Handgun", category: "handgun", damage: 18, range: 45, fireRate: 3, magazine: 12, price: 2400, restricted: "licence", desc: "Compact sidearm, common on the street." },
  { id: "w_harrier", name: "Harrier SD Pistol", category: "handgun", damage: 22, range: 50, fireRate: 2.5, magazine: 10, price: 3600, restricted: "licence", desc: "Heavier service pistol." },
  { id: "w_brecher", name: "Brecher 12 Shotgun", category: "shotgun", damage: 52, range: 18, fireRate: 1, magazine: 6, price: 6200, restricted: "licence", desc: "Short-range breaching shotgun." },
  { id: "w_vesper", name: "Vesper SMG", category: "smg", damage: 14, range: 38, fireRate: 10, magazine: 30, price: 9800, restricted: "none", desc: "Rapid-fire compact SMG." },
  { id: "w_lynx", name: "Lynx MR Rifle", category: "rifle", damage: 30, range: 90, fireRate: 6, magazine: 30, price: 16500, restricted: "none", desc: "Marksman rifle used by tactical units." },
  { id: "w_taser", name: "Arc-7 Taser", category: "nonlethal", damage: 0, range: 12, fireRate: 0.5, magazine: 2, price: 0, restricted: "police", desc: "Non-lethal incapacitation device." },
  { id: "w_baton", name: "Service Baton", category: "police", damage: 8, range: 2, fireRate: 1.2, magazine: 0, price: 0, restricted: "police", desc: "Close quarters control tool." },
  { id: "w_cuffs", name: "Handcuffs", category: "police", damage: 0, range: 3, fireRate: 1, magazine: 0, price: 0, restricted: "police", desc: "Restrain a suspect and start an arrest." },
  { id: "w_flashlight", name: "Duty Flashlight", category: "tool", damage: 0, range: 25, fireRate: 1, magazine: 0, price: 90, restricted: "none", desc: "Illuminates dark interiors." },
  { id: "w_radio", name: "Service Radio", category: "tool", damage: 0, range: 0, fireRate: 0, magazine: 0, price: 150, restricted: "none", desc: "Encrypted department channel." },
  { id: "w_crowbar", name: "Crowbar", category: "tool", damage: 10, range: 2, fireRate: 1, magazine: 0, price: 320, restricted: "none", desc: "Forces doors and vehicle locks." },
  { id: "w_drill", name: "Vault Drill", category: "tool", damage: 0, range: 2, fireRate: 0, magazine: 0, price: 7500, restricted: "none", desc: "Required for bank vault jobs." },
  { id: "w_mask", name: "Blank Mask", category: "tool", damage: 0, range: 0, fireRate: 0, magazine: 0, price: 450, restricted: "none", desc: "Slows how fast police identify you." },
];

export const WEAPON_MAP: Record<string, WeaponDef> = Object.fromEntries(
  WEAPONS.map((w) => [w.id, w]),
);

export const SHOP_ITEMS: { id: string; name: string; price: number; kind: InventoryItem["kind"]; effect: string }[] = [
  { id: "i_sandwich", name: "Street Sandwich", price: 14, kind: "consumable", effect: "+20 health" },
  { id: "i_coffee", name: "Kronen Coffee", price: 9, kind: "consumable", effect: "+35 stamina" },
  { id: "i_medkit", name: "Field Medkit", price: 120, kind: "consumable", effect: "+70 health" },
  { id: "i_armor", name: "Light Vest", price: 900, kind: "consumable", effect: "+100 armor" },
  { id: "i_fuelcan", name: "Fuel Canister", price: 85, kind: "tool", effect: "Refuels 30L anywhere" },
  { id: "i_repairkit", name: "Repair Kit", price: 240, kind: "tool", effect: "+40% vehicle condition" },
  { id: "i_ammo", name: "Ammo Box", price: 180, kind: "ammo", effect: "+60 rounds" },
];

/** /progression — achievements */
export type Achievement = {
  id: string;
  name: string;
  desc: string;
  icon: string;
};

export const ACHIEVEMENTS: Achievement[] = [
  { id: "a_firstjob", name: "First Job", desc: "Complete your first job mission.", icon: "🧰" },
  { id: "a_firstcar", name: "First Vehicle", desc: "Buy your first vehicle.", icon: "🚗" },
  { id: "a_firstproperty", name: "Keys to the City", desc: "Buy your first property.", icon: "🏠" },
  { id: "a_responder", name: "Emergency Responder", desc: "Clear an emergency dispatch call.", icon: "🚨" },
  { id: "a_officer", name: "Master Officer", desc: "Reach Sergeant in the police service.", icon: "🎖️" },
  { id: "a_escape", name: "Escape Artist", desc: "Lose a 3-star pursuit.", icon: "🏃" },
  { id: "a_millionaire", name: "Millionaire", desc: "Hold 1,000,000 in the bank.", icon: "💰" },
  { id: "a_roadwarrior", name: "Road Warrior", desc: "Drive 50 km.", icon: "🛣️" },
  { id: "a_heist", name: "Vault Breaker", desc: "Complete a bank robbery.", icon: "🏦" },
  { id: "a_cuffed", name: "Processed", desc: "Get arrested once.", icon: "⛓️" },
  { id: "a_explorer", name: "Explorer", desc: "Visit every region.", icon: "🧭" },
  { id: "a_lifesaver", name: "Lifesaver", desc: "Treat 5 patients as a paramedic.", icon: "❤️" },
];

export const ACHIEVEMENT_MAP: Record<string, Achievement> = Object.fromEntries(
  ACHIEVEMENTS.map((a) => [a.id, a]),
);

/** /crime — crime definitions with risk/reward + wanted points */
export type CrimeDef = {
  id: string;
  name: string;
  wanted: number;
  minReward: number;
  maxReward: number;
  duration: number; // seconds to perform
  cooldown: number; // seconds
  requires?: string;
  desc: string;
};

export const CRIMES: Record<string, CrimeDef> = {
  store: { id: "store", name: "Store Robbery", wanted: 2, minReward: 450, maxReward: 1400, duration: 9, cooldown: 120, desc: "Threaten the clerk and empty the register." },
  jewelry: { id: "jewelry", name: "Jewelry Heist", wanted: 3, minReward: 2200, maxReward: 6400, duration: 16, cooldown: 300, requires: "w_crowbar", desc: "Smash the displays and grab the trays." },
  bank: { id: "bank", name: "Bank Vault", wanted: 5, minReward: 12000, maxReward: 42000, duration: 30, cooldown: 900, requires: "w_drill", desc: "Drill the vault. Expect a heavy police response." },
  burglary: { id: "burglary", name: "House Burglary", wanted: 2, minReward: 300, maxReward: 2100, duration: 12, cooldown: 180, requires: "w_crowbar", desc: "Search rooms for valuables before police arrive." },
  carjack: { id: "carjack", name: "Vehicle Theft", wanted: 2, minReward: 0, maxReward: 0, duration: 5, cooldown: 30, desc: "Hotwire a vehicle that isn't yours." },
  atm: { id: "atm", name: "ATM Tampering", wanted: 1, minReward: 180, maxReward: 700, duration: 8, cooldown: 90, requires: "w_crowbar", desc: "Force the cash cassette." },
};

export const WANTED_LABELS = [
  "Clear",
  "Suspicious",
  "Minor Offense",
  "Wanted",
  "High Priority",
  "Critical",
];

export const CHARGES: Record<string, { label: string; points: number; fine: number }> = {
  speeding: { label: "Speeding", points: 1, fine: 180 },
  reckless: { label: "Reckless Driving", points: 1, fine: 320 },
  carjack: { label: "Vehicle Theft", points: 2, fine: 1200 },
  assault: { label: "Assault", points: 2, fine: 900 },
  robbery: { label: "Robbery", points: 2, fine: 1800 },
  armed: { label: "Armed Robbery", points: 3, fine: 4200 },
  burglary: { label: "Breaking & Entering", points: 2, fine: 1500 },
  weapon: { label: "Illegal Weapon Possession", points: 1, fine: 800 },
  resisting: { label: "Resisting Arrest", points: 1, fine: 700 },
  policeveh: { label: "Police Vehicle Theft", points: 3, fine: 5000 },
  bank: { label: "Bank Robbery", points: 5, fine: 15000 },
  evading: { label: "Evading Police", points: 1, fine: 1400 },
};
