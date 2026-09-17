import { NextResponse } from "next/server";
import { desc, eq, ilike, gt } from "drizzle-orm";
import { db } from "@/db";
import { accounts, profiles, serverLog, presence } from "@/db/schema";
import { currentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const account = await currentAccount();
  if (!account || account.role !== "admin") return null;
  return account;
}

export async function GET(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const rows = await db
    .select({
      id: accounts.id,
      username: accounts.username,
      email: accounts.email,
      role: accounts.role,
      money: profiles.money,
      bank: profiles.bank,
      level: profiles.level,
      job: profiles.job,
      wanted: profiles.wanted,
    })
    .from(accounts)
    .leftJoin(profiles, eq(profiles.accountId, accounts.id))
    .where(q ? ilike(accounts.username, `%${q}%`) : undefined)
    .orderBy(desc(accounts.id))
    .limit(25);
  const online = await db
    .select()
    .from(presence)
    .where(gt(presence.updatedAt, new Date(Date.now() - 15000)))
    .limit(40);
  const logs = await db
    .select()
    .from(serverLog)
    .orderBy(desc(serverLog.id))
    .limit(20);
  return NextResponse.json({
    players: rows,
    online: online.map((o) => ({ id: o.accountId, username: o.username, map: o.map, job: o.job })),
    logs: logs.map((l) => ({
      id: l.id,
      kind: l.kind,
      actor: l.actor,
      message: l.message,
      createdAt: l.createdAt.getTime(),
    })),
  });
}

export async function POST(req: Request) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const action = String(b.action ?? "");
  const targetId = Number(b.targetId) || 0;

  switch (action) {
    case "giveMoney":
      if (targetId) {
        const rows = await db.select().from(profiles).where(eq(profiles.accountId, targetId)).limit(1);
        if (rows.length)
          await db
            .update(profiles)
            .set({ bank: rows[0].bank + (Number(b.amount) || 0) })
            .where(eq(profiles.accountId, targetId));
      }
      break;
    case "giveXp":
      if (targetId) {
        const rows = await db.select().from(profiles).where(eq(profiles.accountId, targetId)).limit(1);
        if (rows.length)
          await db
            .update(profiles)
            .set({ xp: rows[0].xp + (Number(b.amount) || 0) })
            .where(eq(profiles.accountId, targetId));
      }
      break;
    case "setJob":
      if (targetId)
        await db
          .update(profiles)
          .set({ job: String(b.job ?? "unemployed"), jobRank: Number(b.rank) || 0 })
          .where(eq(profiles.accountId, targetId));
      break;
    case "setRole":
      if (targetId)
        await db
          .update(accounts)
          .set({ role: String(b.role ?? "player") })
          .where(eq(accounts.id, targetId));
      break;
    case "clearWanted":
      if (targetId)
        await db.update(profiles).set({ wanted: 0 }).where(eq(profiles.accountId, targetId));
      break;
    default:
      break;
  }

  await db.insert(serverLog).values({
    kind: action || "announce",
    actor: admin.username,
    message: String(b.message ?? `${action} on #${targetId}`).slice(0, 200),
    payload: b,
  });
  return NextResponse.json({ ok: true });
}
