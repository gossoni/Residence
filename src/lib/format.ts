/* Helpers de formatage FR — purs, utilisables côté serveur et client. */

export function formatDate(
  value: Date | string | null | undefined,
  withTime = true,
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      ...(withTime ? { timeStyle: "short" } : {}),
    }).format(d);
  } catch {
    return String(value);
  }
}

export function formatShortDate(
  value: Date | string | null | undefined,
): string {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d);
  } catch {
    return String(value);
  }
}

export function formatDateTimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function deadlineLabel(deadline: Date | string | null): string {
  if (!deadline) return "";
  const d = deadline instanceof Date ? deadline : new Date(deadline);
  const diff = d.getTime() - Date.now();
  if (diff <= 0) return "Délai expiré";
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(hours / 24);
  const restHours = hours % 24;
  if (days > 0) return `Délai : ${days} j ${restHours} h restantes`;
  if (restHours > 0) return `Délai : ${restHours} h restantes`;
  const minutes = Math.max(1, Math.floor(diff / 60_000));
  return `Délai : ${minutes} min restantes`;
}

export function initials(prenom: string, nom: string): string {
  return `${(prenom || "?").charAt(0)}${(nom || "?").charAt(0)}`.toUpperCase();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

export function isImageMime(mime: string | null | undefined): boolean {
  return !!mime && mime.startsWith("image/");
}

export function isZipMime(
  mime: string | null | undefined,
  fileName?: string | null,
): boolean {
  if (mime === "application/zip" || mime === "application/x-zip-compressed") return true;
  return !!fileName && fileName.toLowerCase().endsWith(".zip");
}

export function fileIcon(
  mime: string | null | undefined,
  fileName?: string | null,
): string {
  if (isImageMime(mime)) return "🖼️";
  if (isZipMime(mime, fileName)) return "🗜️";
  return "📎";
}
