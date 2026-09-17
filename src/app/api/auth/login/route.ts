import { NextResponse } from "next/server";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { verifyPassword, createSession, ensureProfile } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const identifier = String(body.identifier ?? "").trim();
    const password = String(body.password ?? "");
    const remember = Boolean(body.remember);
    if (!identifier || !password)
      return NextResponse.json({ error: "Enter your credentials." }, { status: 400 });

    const rows = await db
      .select()
      .from(accounts)
      .where(
        or(
          eq(accounts.email, identifier.toLowerCase()),
          eq(accounts.username, identifier),
        ),
      )
      .limit(1);
    if (!rows.length)
      return NextResponse.json({ error: "No account found with those details." }, { status: 401 });
    const acc = rows[0];
    const ok = await verifyPassword(password, acc.passwordHash);
    if (!ok) return NextResponse.json({ error: "Incorrect password." }, { status: 401 });

    await ensureProfile(acc.id, acc.username);
    await createSession(acc.id, remember);
    return NextResponse.json({
      account: {
        id: acc.id,
        email: acc.email,
        username: acc.username,
        role: acc.role,
        createdAt: acc.createdAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("login failed", err);
    return NextResponse.json({ error: "Login failed. Try again." }, { status: 500 });
  }
}
