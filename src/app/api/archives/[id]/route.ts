import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { dataArchives } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { logAudit } from "@/lib/logic";

export const dynamic = "force-dynamic";

/**
 * Télécharge une archive générée par l'Administrateur.
 *
 * ⚠️ Comportement voulu : l'archive est AUTOMATIQUEMENT SUPPRIMÉE de la base
 * une fois le téléchargement terminé. Elle n'est donc disponible qu'une fois.
 *
 * Le contenu ZIP est stocké en base64 dans `data_archives.payload` (table
 * Supabase), ce qui évite toute dépendance au système de fichiers.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const archiveId = Number(id);
  if (!Number.isInteger(archiveId)) {
    return NextResponse.json({ error: "Archive invalide." }, { status: 400 });
  }

  const row = (
    await db
      .select()
      .from(dataArchives)
      .where(eq(dataArchives.id, archiveId))
      .limit(1)
  )[0];

  if (!row) {
    return NextResponse.json(
      {
        error:
          "Archive introuvable ou déjà téléchargée (elle est supprimée après usage).",
      },
      { status: 404 },
    );
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(row.payload, "base64");
  } catch {
    return NextResponse.json(
      { error: "Contenu d'archive illisible." },
      { status: 500 },
    );
  }
  if (buffer.length === 0) {
    return NextResponse.json(
      { error: "Contenu d'archive vide." },
      { status: 500 },
    );
  }

  // Marque le téléchargement puis supprime l'enregistrement (et son contenu).
  await db.delete(dataArchives).where(eq(dataArchives.id, archiveId));
  await logAudit(
    user,
    "admin.download_archive",
    `archive#${archiveId}`,
    `${row.filename} — archive supprimée de la base après téléchargement`,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `attachment; filename="${row.filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
