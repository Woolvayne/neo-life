import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accounts, sessions, profiles } from "@/db/schema";

export const SESSION_COOKIE = "nc_session";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  try {
    return await bcrypt.compare(pw, hash);
  } catch {
    return false;
  }
}

export function newToken() {
  return createHash("sha256")
    .update(randomBytes(32))
    .digest("hex")
    .slice(0, 48);
}

export async function createSession(accountId: number, remember: boolean) {
  const token = newToken();
  await db.insert(sessions).values({ token, accountId });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: remember ? 60 * 60 * 24 * 60 : 60 * 60 * 12,
  });
  return token;
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
    store.delete(SESSION_COOKIE);
  }
}

export type AuthAccount = {
  id: number;
  email: string;
  username: string;
  role: string;
  createdAt: string;
};

export async function currentAccount(): Promise<AuthAccount | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select()
    .from(sessions)
    .where(eq(sessions.token, token))
    .limit(1);
  if (!rows.length) return null;
  const acc = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, rows[0].accountId))
    .limit(1);
  if (!acc.length) return null;
  return {
    id: acc[0].id,
    email: acc[0].email,
    username: acc[0].username,
    role: acc[0].role,
    createdAt: acc[0].createdAt.toISOString(),
  };
}

export async function ensureProfile(accountId: number, displayName: string) {
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .limit(1);
  if (rows.length) return rows[0];
  const inserted = await db
    .insert(profiles)
    .values({ accountId, displayName })
    .returning();
  return inserted[0];
}
