import { and, count, desc, eq, inArray, or } from "drizzle-orm";
import { db } from "@/db";
import { comments, publications, reports, users } from "@/db/schema";
import type { Publication, User } from "@/db/schema";
import { type Scope } from "./structure";

export type FeedFilter = "all" | Scope;

export type FeedItem = Publication & {
  authorNom: string;
  authorPrenom: string;
  authorRole: string;
  authorGh: number | null;
  authorImmeuble: string | null;
  commentCount: number;
  reportCount: number;
};

function visibleWhere(user: User) {
  return or(
    eq(publications.scope, "residence"),
    and(eq(publications.scope, "groupe"), eq(publications.gh, user.gh)),
    and(
      eq(publications.scope, "immeuble"),
      eq(publications.gh, user.gh),
      eq(publications.immeuble, user.immeuble ?? ""),
    ),
  );
}

/** Fil d'actualité : uniquement le contenu publié visible par l'utilisateur. */
export async function getFeed(
  user: User,
  filter: FeedFilter = "all",
): Promise<FeedItem[]> {
  let where;
  if (filter === "all") {
    where = and(eq(publications.status, "publiee"), visibleWhere(user));
  } else if (filter === "residence") {
    where = and(
      eq(publications.status, "publiee"),
      eq(publications.scope, "residence"),
    );
  } else if (filter === "groupe") {
    where = and(
      eq(publications.status, "publiee"),
      eq(publications.scope, "groupe"),
      eq(publications.gh, user.gh),
    );
  } else {
    where = and(
      eq(publications.status, "publiee"),
      eq(publications.scope, "immeuble"),
      eq(publications.gh, user.gh),
      eq(publications.immeuble, user.immeuble ?? ""),
    );
  }

  const rows = await db
    .select({
      pub: publications,
      authorNom: users.nom,
      authorPrenom: users.prenom,
      authorRole: users.role,
      authorGh: users.gh,
      authorImmeuble: users.immeuble,
    })
    .from(publications)
    .innerJoin(users, eq(publications.authorId, users.id))
    .where(where)
    .orderBy(desc(publications.publishedAt), desc(publications.createdAt))
    .limit(60);

  const pubIds = rows.map((r) => r.pub.id);

  const commentRows =
    pubIds.length === 0
      ? []
      : await db
          .select({
            publicationId: comments.publicationId,
            c: count(),
          })
          .from(comments)
          .where(
            and(
              eq(comments.blocked, false),
              inArray(comments.publicationId, pubIds),
            ),
          )
          .groupBy(comments.publicationId);

  const reportRows =
    pubIds.length === 0
      ? []
      : await db
          .select({
            publicationId: reports.publicationId,
            c: count(),
          })
          .from(reports)
          .where(
            and(
              eq(reports.status, "ouvert"),
              inArray(reports.publicationId, pubIds),
            ),
          )
          .groupBy(reports.publicationId);

  const commentMap = new Map(commentRows.map((r) => [r.publicationId, r.c]));
  const reportMap = new Map(reportRows.map((r) => [r.publicationId, r.c]));

  return rows.map((r) => ({
    ...r.pub,
    authorNom: r.authorNom,
    authorPrenom: r.authorPrenom,
    authorRole: r.authorRole,
    authorGh: r.authorGh,
    authorImmeuble: r.authorImmeuble,
    commentCount: commentMap.get(r.pub.id) ?? 0,
    reportCount: reportMap.get(r.pub.id) ?? 0,
  }));
}

export type PubDetail = Publication & {
  authorNom: string;
  authorPrenom: string;
  authorRole: string;
  authorGh: number;
  authorImmeuble: string | null;
};

export async function getPublicationDetail(pubId: number): Promise<PubDetail | null> {
  const rows = await db
    .select({
      pub: publications,
      authorNom: users.nom,
      authorPrenom: users.prenom,
      authorRole: users.role,
      authorGh: users.gh,
      authorImmeuble: users.immeuble,
    })
    .from(publications)
    .innerJoin(users, eq(publications.authorId, users.id))
    .where(eq(publications.id, pubId))
    .limit(1);
  const r = rows[0];
  if (!r) return null;
  return {
    ...r.pub,
    authorNom: r.authorNom,
    authorPrenom: r.authorPrenom,
    authorRole: r.authorRole,
    authorGh: r.authorGh,
    authorImmeuble: r.authorImmeuble,
  };
}

export async function getCommentCount(pubId: number): Promise<number> {
  const rows = await db
    .select({ c: count() })
    .from(comments)
    .where(
      and(eq(comments.publicationId, pubId), eq(comments.blocked, false)),
    );
  return rows[0]?.c ?? 0;
}

export async function getOpenReportCount(pubId: number): Promise<number> {
  const rows = await db
    .select({ c: count() })
    .from(reports)
    .where(
      and(
        eq(reports.publicationId, pubId),
        eq(reports.status, "ouvert"),
      ),
    );
  return rows[0]?.c ?? 0;
}

export async function listComments(pubId: number) {
  return db
    .select({
      id: comments.id,
      contenu: comments.contenu,
      blocked: comments.blocked,
      blockedReason: comments.blockedReason,
      createdAt: comments.createdAt,
      authorId: comments.authorId,
      authorNom: users.nom,
      authorPrenom: users.prenom,
      authorRole: users.role,
    })
    .from(comments)
    .innerJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.publicationId, pubId))
    .orderBy(desc(comments.createdAt));
}

export async function listReports() {
  return db
    .select({
      id: reports.id,
      reason: reports.reason,
      status: reports.status,
      createdAt: reports.createdAt,
      publicationId: reports.publicationId,
      commentId: reports.commentId,
      reporterNom: users.nom,
      reporterPrenom: users.prenom,
    })
    .from(reports)
    .innerJoin(users, eq(reports.reporterId, users.id))
    .where(eq(reports.status, "ouvert"))
    .orderBy(desc(reports.createdAt))
    .limit(100);
}
