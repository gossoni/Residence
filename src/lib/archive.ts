import { eq, inArray } from "drizzle-orm";
import { ZipWriter } from "./zip";
import { db } from "@/db";
import {
  dataArchives,
  comments,
  notifications as notificationsTable,
  publications,
  reports,
  sessions,
  users,
  votes,
} from "@/db/schema";
import type { User } from "@/db/schema";

export type ArchiveKind = "user" | "publication" | "comment";

export type BuiltArchive = {
  /** Identifiant de l'enregistrement en base. */
  id: number;
  fileName: string;
  /** Contenu ZIP encodé en base64 (stocké dans `data_archives.payload`). */
  payload: string;
  sizeBytes: number;
  label: string;
};

function slug(input: string): string {
  return (
    input
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 40) || "sans-nom"
  );
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(
    d.getHours(),
  )}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

/**
 * Enregistre l'archive en base de données (table `data_archives`).
 *
 * Le ZIP est stocké en base64 dans la colonne `payload` plutôt que sur le
 * disque : c'est le modèle attendu par Supabase, où le système de fichiers
 * n'est pas persistant.
 */
async function persist(
  zip: ZipWriter,
  baseName: string,
  kind: ArchiveKind,
  targetId: number | null,
  label: string,
  actor: User | null,
): Promise<BuiltArchive> {
  const buffer = zip.build();
  const fileName = `${kind}-${slug(baseName)}-${stamp()}.zip`;
  const payload = buffer.toString("base64");

  const inserted = await db
    .insert(dataArchives)
    .values({
      kind,
      title: label,
      filename: fileName,
      payload,
      createdBy: actor?.id ?? null,
    })
    .returning({ id: dataArchives.id });

  return {
    id: inserted[0].id,
    fileName,
    payload,
    sizeBytes: buffer.length,
    label,
  };
}

function profileOf(u: User) {
  // Le hash du mot de passe n'est JAMAIS inclus dans une archive.
  const { passwordHash: _ignored, ...safe } = u;
  return {
    ...safe,
    createdAt: safe.createdAt?.toISOString?.() ?? null,
    validatedAt: safe.validatedAt?.toISOString?.() ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Archive complète d'un utilisateur                                   */
/* ------------------------------------------------------------------ */

export async function buildUserArchive(
  target: User,
  actor: User | null,
): Promise<BuiltArchive> {
  const zip = new ZipWriter();
  const dir = "utilisateur";

  zip.addFile(
    `${dir}/profil.json`,
    JSON.stringify(
      {
        genereLe: new Date().toISOString(),
        generePar: actor ? `${actor.prenom} ${actor.nom} (${actor.email})` : "système",
        type: "archive-utilisateur",
        profil: profileOf(target),
      },
      null,
      2,
    ),
  );

  const pubs = await db
    .select()
    .from(publications)
    .where(eq(publications.authorId, target.id));
  if (pubs.length > 0) {
    zip.addFile(
      `${dir}/publications.json`,
      JSON.stringify(
        pubs.map((p) => ({
          ...p,
          createdAt: p.createdAt?.toISOString?.() ?? null,
          publishedAt: p.publishedAt?.toISOString?.() ?? null,
          deadline: p.deadline?.toISOString?.() ?? null,
          eventAt: p.eventAt?.toISOString?.() ?? null,
        })),
        null,
        2,
      ),
    );
  }

  const coms = await db
    .select()
    .from(comments)
    .where(eq(comments.authorId, target.id));
  if (coms.length > 0) {
    zip.addFile(
      `${dir}/commentaires.json`,
      JSON.stringify(
        coms.map((c) => ({
          ...c,
          createdAt: c.createdAt?.toISOString?.() ?? null,
        })),
        null,
        2,
      ),
    );
  }

  const vs = await db.select().from(votes).where(eq(votes.userId, target.id));
  if (vs.length > 0) {
    zip.addFile(
      `${dir}/votes.json`,
      JSON.stringify(
        vs.map((v) => ({ ...v, createdAt: v.createdAt?.toISOString?.() ?? null })),
        null,
        2,
      ),
    );
  }

  const reps = await db
    .select()
    .from(reports)
    .where(eq(reports.reporterId, target.id));
  if (reps.length > 0) {
    zip.addFile(
      `${dir}/signalements-emis.json`,
      JSON.stringify(
        reps.map((r) => ({ ...r, createdAt: r.createdAt?.toISOString?.() ?? null })),
        null,
        2,
      ),
    );
  }

  // Commentaires reçus sur les publications de l'utilisateur
  if (pubs.length > 0) {
    const received = await db
      .select()
      .from(comments)
      .where(
        inArray(
          comments.publicationId,
          pubs.map((p) => p.id),
        ),
      );
    if (received.length > 0) {
      zip.addFile(
        `${dir}/commentaires-recus.json`,
        JSON.stringify(
          received.map((c) => ({
            ...c,
            createdAt: c.createdAt?.toISOString?.() ?? null,
          })),
          null,
          2,
        ),
      );
    }
  }

  zip.addFile(
    "LISEZ-MOI.txt",
    [
      "ARCHIVE DE COMPTE — MA RÉSIDENCE",
      "=================================",
      "",
      `Utilisateur : ${target.prenom} ${target.nom} <${target.email}>`,
      `Rôle        : ${target.role}`,
      `Générée le  : ${new Date().toLocaleString("fr-FR")}`,
      "",
      "Contenu :",
      "  profil.json               données de profil (mot de passe exclu)",
      "  publications.json         publications rédigées",
      "  commentaires.json         commentaires rédigés",
      "  votes.json                votes exprimés",
      "  signalements-emis.json    signalements déposés",
      "  commentaires-recus.json   commentaires reçus sur ses publications",
      "",
      "Note : le mot de passe (hash) n'est volontairement jamais exporté.",
      "Cette archive a été supprimée du serveur après téléchargement.",
    ].join("\n"),
  );

  return persist(
    zip,
    `${target.prenom}-${target.nom}`,
    "user",
    target.id,
    `${target.prenom} ${target.nom} (${target.email})`,
    actor,
  );
}

/* ------------------------------------------------------------------ */
/* Archive d'une publication                                           */
/* ------------------------------------------------------------------ */

export async function buildPublicationArchive(
  pubId: number,
  actor: User | null,
): Promise<BuiltArchive | null> {
  const pub = (
    await db.select().from(publications).where(eq(publications.id, pubId)).limit(1)
  )[0];
  if (!pub) return null;

  const author = (
    await db.select().from(users).where(eq(users.id, pub.authorId)).limit(1)
  )[0];
  const coms = await db
    .select()
    .from(comments)
    .where(eq(comments.publicationId, pubId));
  const vs = await db.select().from(votes).where(eq(votes.publicationId, pubId));
  const reps = await db
    .select()
    .from(reports)
    .where(eq(reports.publicationId, pubId));

  const zip = new ZipWriter();
  zip.addFile(
    "publication/publication.json",
    JSON.stringify(
      {
        genereLe: new Date().toISOString(),
        generePar: actor ? `${actor.prenom} ${actor.nom} (${actor.email})` : "système",
        publication: {
          ...pub,
          createdAt: pub.createdAt?.toISOString?.() ?? null,
          publishedAt: pub.publishedAt?.toISOString?.() ?? null,
          deadline: pub.deadline?.toISOString?.() ?? null,
          eventAt: pub.eventAt?.toISOString?.() ?? null,
        },
        auteur: author
          ? { id: author.id, nom: author.nom, prenom: author.prenom, email: author.email, role: author.role }
          : null,
        commentaires: coms.map((c) => ({
          ...c,
          createdAt: c.createdAt?.toISOString?.() ?? null,
        })),
        votes: vs.map((v) => ({ ...v, createdAt: v.createdAt?.toISOString?.() ?? null })),
        signalements: reps.map((r) => ({
          ...r,
          createdAt: r.createdAt?.toISOString?.() ?? null,
        })),
      },
      null,
      2,
    ),
  );

  return persist(zip, pub.titre, "publication", pubId, `Publication « ${pub.titre} »`, actor);
}

/* ------------------------------------------------------------------ */
/* Suppression complète d'un utilisateur (respect des clés étrangères) */
/* ------------------------------------------------------------------ */

export async function deleteUserCascade(ids: number[]): Promise<number> {
  if (ids.length === 0) return 0;
  await db.delete(sessions).where(inArray(sessions.userId, ids));
  await db.delete(notificationsTable).where(inArray(notificationsTable.userId, ids));
  await db.delete(votes).where(inArray(votes.userId, ids));
  await db.delete(comments).where(inArray(comments.authorId, ids));
  await db.delete(reports).where(inArray(reports.reporterId, ids));
  // Les publications partagent la suppression en cascade de leurs commentaires/votes.
  await db.delete(publications).where(inArray(publications.authorId, ids));
  const gone = await db.delete(users).where(inArray(users.id, ids)).returning({ id: users.id });
  return gone.length;
}
