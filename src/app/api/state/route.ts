import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { profiles } from "@/db/schema";
import { currentAccount, ensureProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

const NUM_FIELDS = [
  "money",
  "bank",
  "xp",
  "level",
  "jobRank",
  "wanted",
  "characterDone",
  "tutorialDone",
] as const;

const JSON_FIELDS = [
  "character",
  "inventory",
  "vehicles",
  "properties",
  "jobXp",
  "stats",
  "achievements",
  "settings",
  "transactions",
  "crimeHistory",
] as const;

export async function GET() {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const profile = await ensureProfile(account.id, account.username);
  return NextResponse.json({ account, profile });
}

export async function POST(req: Request) {
  const account = await currentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = { updatedAt: new Date() };

  for (const key of NUM_FIELDS) {
    if (typeof body[key] === "number" && Number.isFinite(body[key])) {
      patch[key] = Math.round(body[key]);
    }
  }
  for (const key of JSON_FIELDS) {
    if (body[key] !== undefined) patch[key] = body[key];
  }
  if (typeof body.job === "string") patch.job = body.job;
  if (typeof body.currentMap === "string") patch.currentMap = body.currentMap;
  if (typeof body.displayName === "string" && body.displayName.trim())
    patch.displayName = body.displayName.trim().slice(0, 24);

  await ensureProfile(account.id, account.username);
  await db.update(profiles).set(patch).where(eq(profiles.accountId, account.id));
  return NextResponse.json({ ok: true, savedAt: Date.now() });
}
