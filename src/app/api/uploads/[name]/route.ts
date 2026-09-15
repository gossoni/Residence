import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
};

/**
 * Sert les fichiers envoyés par les utilisateurs.
 *
 * On passe par une route API plutôt que par le dossier statique `public/` car
 * certains environnements d'hébergement prennent un instantané de `public/` au
 * moment du build : les fichiers écrits ensuite (uploads) n'étaient alors plus
 * servis. Lire sur le disque à la demande garantit le fonctionnement partout.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;

  // Sécurité : aucun parcours de répertoire, nom de fichier simple uniquement.
  if (!/^[A-Za-z0-9._-]+$/.test(name) || name.includes("..")) {
    return NextResponse.json({ error: "Nom de fichier invalide." }, { status: 400 });
  }

  const filePath = path.join(UPLOAD_DIR, name);
  if (!filePath.startsWith(UPLOAD_DIR) || !existsSync(filePath)) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  const stat = statSync(filePath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: "Fichier invalide." }, { status: 400 });
  }

  const ext = path.extname(name).toLowerCase();
  const type = MIME[ext] ?? "application/octet-stream";

  const stream = createReadStream(filePath);
  return new NextResponse(
    new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        stream.on("end", () => controller.close());
        stream.on("error", () => controller.close());
      },
      cancel() {
        stream.destroy();
      },
    }),
    {
      headers: {
        "Content-Type": type,
        "Content-Length": String(stat.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${name}"`,
      },
    },
  );
}
