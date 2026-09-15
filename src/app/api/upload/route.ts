import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCurrentUser } from "@/lib/auth";
import { canPublish } from "@/lib/logic";

let supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (!supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error("Variables Supabase manquantes.");
    supabase = createClient(url, key);
  }
  return supabase;
}

const MAX_SIZE = 20 * 1024 * 1024; // 20 Mo
const LOGO_MAX_SIZE = 2 * 1024 * 1024; // 2 Mo
const LOGO_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const ALLOWED_EXTS = new Set([
  "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "zip",
]);

export async function POST(request: Request) {
  let purpose = "publication";
  let fileName = "";
  let fileSize = 0;

  try {
    // ── Authentification ──
    const user = await getCurrentUser();
    if (!user || !canPublish(user)) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    const formData = await request.formData();
    purpose = String(formData.get("purpose") ?? "publication");
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Aucun fichier fourni." }, { status: 400 });
    }

    fileName = file.name;
    fileSize = file.size;

    // ── Logo : réservé à l'Administrateur ──
    if (purpose === "logo" && user.role !== "admin") {
      return NextResponse.json(
        { error: "Seul l'Administrateur peut modifier le logo." },
        { status: 403 },
      );
    }

    // ── Validation de la taille ──
    const limit = purpose === "logo" ? LOGO_MAX_SIZE : MAX_SIZE;
    if (file.size > limit) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${Math.round(limit / (1024 * 1024))} Mo).` },
        { status: 400 },
      );
    }

    // ── Validation de l'extension ──
    const ext = (fileName.split(".").pop() ?? "").toLowerCase();
    if (!ext || !ALLOWED_EXTS.has(ext)) {
      return NextResponse.json(
        { error: "Format non autorisé (PDF, image ou ZIP)." },
        { status: 400 },
      );
    }
    if (purpose === "logo" && !LOGO_EXTS.has(ext)) {
      return NextResponse.json(
        { error: "Logo : PNG, JPG, GIF, WEBP ou SVG uniquement." },
        { status: 400 },
      );
    }

    // ── Nom unique ──
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = `uploads/${uniqueName}`;

    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Upload vers Supabase Storage ──
    const { error: upErr } = await getSupabase()
      .storage.from("uploads")
      .upload(filePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: true,
      });

    if (upErr) {
      console.error("[upload] Supabase :", upErr.message);
      return NextResponse.json(
        { error: `Échec de l'envoi : ${upErr.message}` },
        { status: 500 },
      );
    }

    // ── URL publique ──
    const { data: urlData } = getSupabase()
      .storage.from("uploads")
      .getPublicUrl(filePath);

    return NextResponse.json({
      url: urlData.publicUrl,
      fileName,
      mime: file.type,
      size: fileSize,
      ext,
    });
  } catch (err) {
    console.error(`[upload] échec purpose=${purpose} file=${fileName} (${fileSize} o) :`, err);
    return NextResponse.json(
      { error: err instanceof Error ? `Échec : ${err.message}` : "Erreur interne." },
      { status: 500 },
    );
  }
}