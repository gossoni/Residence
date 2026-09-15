import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Endpoint sondé par la cloche de notifications (équivalent temps réel). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Non connecté." }, { status: 401 });

  const [items, unreadRows] = await Promise.all([
    db
      .select({
        id: notifications.id,
        titre: notifications.titre,
        body: notifications.body,
        link: notifications.link,
        read: notifications.read,
        createdAt: notifications.createdAt,
      })
      .from(notifications)
      .where(eq(notifications.userId, user.id))
      .orderBy(desc(notifications.createdAt))
      .limit(15),
    db
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, user.id),
          eq(notifications.read, false),
        ),
      ),
  ]);

  return NextResponse.json({
    items: items.map((n) => ({
      ...n,
      createdAt: n.createdAt ? n.createdAt.toISOString() : null,
    })),
    unread: unreadRows.length,
  });
}
