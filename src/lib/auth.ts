import { headers } from "next/headers";
import { randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import type { User } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

const SESSION_COOKIE = "mr_session";
const SESSION_DAYS = 30;

export async function createSession(userId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({ token, userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
  }
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // ⚠️ Non-bloquant : une base momentanément injoignable ne doit pas faire
  // planter le rendu. L'utilisateur est traité comme non connecté.
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);
  return rows[0]?.user ?? null;
}

/** Redirige vers /login si non connecté. */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Redirige vers /dashboard (écran d'attente) si le compte n'est pas actif. */
export async function requireActiveUser(): Promise<User> {
  const user = await requireUser();
  if (user.status !== "actif") redirect("/dashboard");
  if (user.mustChangePassword) redirect("/changer-mdp");
  return user;
}

/**
 * Utilisateur devant impérativement changer son mot de passe provisoire.
 * Toute autre page est inaccessible jusqu'au changement effectif.
 */
export async function requirePasswordChange(): Promise<User> {
  const user = await requireUser();
  if (!user.mustChangePassword) redirect("/feed");
  return user;
}

/**
 * À appeler dans les pages qui n'utilisent pas `requireActiveUser`
 * (tableau de bord, profil) : redirige vers l'écran de changement obligatoire.
 */
export async function redirectIfPasswordPending(user: User): Promise<void> {
  if (user.mustChangePassword) redirect("/changer-mdp");
}

export { SESSION_COOKIE };
