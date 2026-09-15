/* ------------------------------------------------------------------ */
/* Structure fixe de la résidence : 12 Groupes d'Habitation (GH)       */
/* ------------------------------------------------------------------ */

export const GH_BUILDINGS: Record<number, string[]> = {
  1: ["A", "B", "C", "D", "E"],
  2: ["A", "B", "C", "D"],
  3: ["A", "B", "C", "D", "E", "F"],
  4: ["A", "B", "C", "D"],
  5: ["A", "B", "C", "D"],
  6: ["A", "B", "C", "D", "E", "F"],
  7: ["A", "B"],
  8: ["A", "B", "C", "D"],
  9: ["A", "B", "C"],
  10: ["A", "B", "C", "D"],
  11: ["A", "B", "C", "D"],
  12: ["A", "B", "C", "D", "E", "F", "G"],
};

export const GH_NUMBERS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export const ghLabel = (gh: number | null | undefined): string =>
  gh ? `GH${gh}` : "—";

export const buildingsOf = (gh: number): string[] => GH_BUILDINGS[gh] ?? [];

/* ------------------------------------------------------------------ */
/* Règles de majorité                                                  */
/* ------------------------------------------------------------------ */

// Résidence : 12 Responsables de Groupe (1 voix) + Président (2 voix)
export const RESIDENCE_TOTAL_VOIX = 14;
export const RESIDENCE_MAJORITE = 8; // majorité absolue = 14/2 + 1

// Groupe : nombre d'immeubles (1 voix chacun) + Responsable de Groupe (2 voix)
export function groupTotalVoix(gh: number): number {
  return buildingsOf(gh).length + 2;
}
export function groupMajorite(gh: number): number {
  return Math.floor(groupTotalVoix(gh) / 2) + 1;
}

/* ------------------------------------------------------------------ */
/* Libellés FR                                                         */
/* ------------------------------------------------------------------ */

export const DEFAULT_VALIDATION_DELAY_HOURS = 48;
export const DEFAULT_REPORT_THRESHOLD = 5;

/** R\u00f4les disposant des privil\u00e8ges d'administration de l'application. */
export function isAdminRole(role: string): boolean {
  return role === "admin";
}

/** Admin ou Pr\u00e9sident : acc\u00e8s \u00e9tendu (param\u00e8tres, gestion des comptes...). */
export function isPrivileged(role: string): boolean {
  return role === "admin" || role === "president";
}

/** R\u00f4les autoris\u00e9s \u00e0 publier du contenu. */
export const PUBLISHER_ROLES = [
  "admin",
  "president",
  "gh_manager",
  "building_manager",
] as const;

/**
 * Couleur de badge associ\u00e9e \u00e0 une port\u00e9e de publication.
 * Fonction pure : elle vit ici (et non dans un module "use client") afin de
 * rester appelable depuis les composants serveur.
 */
export function ToneForScope(scope: string): string {
  return scope === "residence" ? "indigo" : scope === "groupe" ? "sky" : "emerald";
}

/** Couleur de badge associ\u00e9e \u00e0 un r\u00f4le utilisateur (usage serveur). */
export function roleTone(role: string): string {
  if (role === "admin") return "rose";
  if (role === "president") return "amber";
  if (role === "gh_manager") return "indigo";
  if (role === "building_manager") return "sky";
  return "slate";
}

export type Role =
  | "admin"
  | "president"
  | "gh_manager"
  | "building_manager"
  | "owner";
export type UserStatus = "provisoire" | "actif" | "bloque";
export type Scope = "residence" | "groupe" | "immeuble";
export type PubStatus =
  | "en_validation"
  | "publiee"
  | "rejetee"
  | "masquee"
  | "bloquee";
export type PubType = "texte" | "fichier" | "tache_evenement";
