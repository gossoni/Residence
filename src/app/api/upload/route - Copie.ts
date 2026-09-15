import { randomBytes } from "node:crypto";
import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canPublish } from "@/lib/logic";

export const dynamic = "force-dynamic";

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo (archives ZIP incluses)
const LOGO_MAX_SIZE = 2 * 1024 * 1024; // 2 Mo pour le logo

/**
 * Détermine l'extension à partir du MIME déclaré, du nom de fichier ET des
 * octets magiques. Certains navigateurs/systèmes envoient un MIME vide ou
 * générique (application/octet-stream), ce qui faisait échouer l'envoi.
 */
function detectExt(
  mime: string,
  fileName: string,
  head: Buffer,
): string | null {
  // 1. Octets magiques (source la plus fiable)
  if (head.length >= 8) {
    if (head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47)
      return "png";
    if (head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return "jpg";
    if (head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46) return "gif";
    if (
      head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46 &&
      head[8] === 0x57 && head[9] === 0x45 && head[10] === 0x42 && head[11] === 0x50
    )
      return "webp";
    if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46)
      return "pdf";
    if (head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04)
      return "zip";
  }
  // 2. SVG : texte XML (pas de signature binaire)
  const asText = head.subarray(0, 512).toString("utf8").trim().toLowerCase();
  if (asText.startsWith("<?xml") || asText.startsWith("<svg")) return "svg";

  // 3. Nom de fichier en repli
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  const byExt: Record<string, string> = {
    png: "png",
    jpg: "jpg",
    jpeg: "jpg",
    jpe: "jpg",
    gif: "gif",
    webp: "webp",
    svg: "svg",
    pdf: "pdf",
    zip: "zip",
  };
  if (byExt[ext]) return byExt[ext];

  // 4. MIME déclaré en dernier recours
  const sub = mime.split("/")[1] ?? "";
  const byMime: Record<string, string> = {
    png: "png",
    jpeg: "jpg",
    gif: "gif",
    webp: "webp",
    "svg+xml": "svg",
    pdf: "pdf",
    zip: "zip",
  };
  return byMime[sub] ?? null;
}

/** Extensions autorisées pour le logo. */
const LOGO_EXTS = new Set(["png", "jpg", "gif", "webp", "svg"]);

/** Répertoire d'écriture, avec repli si le dossier principal n'est pas inscriptible. */
function resolveWritableDir(): string {
  const candidates = [
    path.join(process.cwd(), "public", "uploads"),
    path.join(process.cwd(), ".uploads"),
  ];
  for (const dir of candidates) {
    try {
      mkdirSync(dir, { recursive: true });
      // Vérifie que l'écriture fonctionne réellement.
      const probe = path.join(dir, ".probe");
      writeFileSync(probe, "ok");
      unlinkSync(probe);
      return dir;
    } catch {
      continue;
    }
  }
  throw new Error("Aucun répertoire inscriptible disponible pour les fichiers.");
}

export async function POST(req: Request) {
  let purpose = "publication";
  let fileName = "";
  let fileSize = 0;

  try {
    const user = await getCurrentUser();
    if (!user || !canPublish(user)) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const form = await req.formData();
    purpose = String(form.get("purpose") ?? "publication");
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fichier manquant." }, { status: 400 });
    }

    fileName = file.name;
    fileSize = file.size;

    const buffer = Buffer.from(await file.arrayBuffer());
    const limit = purpose === "logo" ? LOGO_MAX_SIZE : MAX_SIZE;

    if (file.size > limit) {
      return NextResponse.json(
        {
          error: `Fichier trop volumineux (maximum ${Math.round(limit / (1024 * 1024))} Mo).`,
        },
        { status: 400 },
      );
    }

    // Logo : réservé à l'Administrateur, images uniquement.
    if (purpose === "logo" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l’Administrateur peut modifier le logo." },
        { status: 403 },
      );
    }

    const ext = detectExt(file.type, file.name, buffer);
    if (!ext) {
      return NextResponse.json(
        {
          error:
            purpose === "logo"
              ? "Logo : format non reconnu (PNG, JPG, GIF, WEBP ou SVG)."
              : "Format non autorisé (PDF, image ou archive ZIP uniquement).",
        },
        { status: 400 },
      );
    }

    if (purpose === "logo" && !LOGO_EXTS.has(ext)) {
      return NextResponse.json(
        {
          error:
            "Logo : format non autorisé (PNG, JPG, GIF, WEBP ou SVG uniquement).",
        },
        { status: 400 },
      );
    }

    const name = `${Date.now()}-${randomBytes(6).toString("hex")}.${ext}`;
    let dir: string;
    try {
      dir = resolveWritableDir();
    } catch (e) {
      console.error("[upload] répertoire inscriptible introuvable :", e);
      return NextResponse.json(
        {
          error:
            "Le serveur ne peut pas écrire les fichiers envoyés (répertoire en lecture seule). Vérifiez les droits sur le dossier « public/uploads ».",
        },
        { status: 500 },
      );
    }

    writeFileSync(path.join(dir, name), buffer);

    return NextResponse.json({
      // URL servie par /api/uploads/[name] : fiable quel que soit l'hébergeur.
      url: `/api/uploads/${name}`,
      fileName: file.name,
      mime: ext === "svg" ? "image/svg+xml" : file.type || "application/octet-stream",
      size: file.size,
      ext,
    });
  } catch (e) {
    // Journalise la cause réelle : le message générique masquait le problème.
    console.error(
      `[upload] éch purpose=${purpose} file=${fileName} (${fileSize} o) :`,
      e,
    );
    return NextResponse.json(
      {
        error:
          e instanceof Error && e.message
            ? `Échec de l’envoi : ${e.message}`
            : "Erreur lors de l’envoi du fichier.",
      },
      { status: 500 },
    );
  }
}
