import type { User } from "@/db/schema";

/* ------------------------------------------------------------------ */
/*                                                                     */
/*  HIÉRARCHIE DES POUVOIRS (ordre de responsabilité décroissant)      */
/*                                                                     */
/*     Administrateur > Président > Resp. de Groupe > Resp. d'Immeuble */
/*                                                                     */
/*  Règles :                                                           */
/*   • Chacun peut créer et supprimer uniquement dans son périmètre.   */
/*   • Nul ne peut agir sur un responsable de rang supérieur ou égal.  */
/*   • L'Administrateur peut tout créer/supprimer, et personne ne      */
/*     peut le supprimer ni modifier son rôle.                         */
/*   • Les simples propriétaires ne peuvent que créer leur propre      */
/*     compte, provisoirement, en attente de validation par le         */
/*     Responsable de leur immeuble.                                   */
/*                                                                     */
/* ------------------------------------------------------------------ */

export const ROLE_RANK: Record<string, number> = {
  owner: 0,
  building_manager: 1,
  gh_manager: 2,
  president: 3,
  admin: 4,
};

export function roleRank(role: string): number {
  return ROLE_RANK[role] ?? -1;
}

export const HIERARCHY_LABELS: Record<string, { fr: string; ar: string }> = {
  admin: { fr: "Administrateur", ar: "مدير النظام" },
  president: { fr: "Président", ar: "الرئيس" },
  gh_manager: { fr: "Responsable de Groupe", ar: "مسؤول المجموعة" },
  building_manager: { fr: "Responsable d’Immeuble", ar: "مسؤول العمارة" },
  owner: { fr: "Propriétaire", ar: "مالك" },
};

/** Rôles dotés d'un pouvoir de gestion (création/suppression) sur d'autres. */
export const MANAGER_ROLES = [
  "admin",
  "president",
  "gh_manager",
  "building_manager",
] as const;

export function isManagerRole(role: string): boolean {
  return roleRank(role) >= 1;
}

/**
 * L'Administrateur est immuable : personne ne peut le supprimer,
 * bloquer ou rétrograder (seul un Administrateur peut agir sur un autre
 * Administrateur, et jamais sur lui-même pour la suppression).
 */
export function isImmune(target: User): boolean {
  return target.role === "admin";
}

/** Même immeuble (et donc même groupe). */
function sameBuilding(a: User, b: User): boolean {
  return a.gh === b.gh && !!a.immeuble && a.immeuble === b.immeuble;
}

/** Le périmètre de `actor` couvre-t-il la localisation indiquée ? */
export function scopeCovers(
  actor: User,
  gh: number | null,
  immeuble: string | null,
): boolean {
  switch (actor.role) {
    case "admin":
    case "president":
      return true; // toute la résidence
    case "gh_manager":
      return actor.gh === gh;
    case "building_manager":
      return actor.gh === gh && actor.immeuble === immeuble;
    default:
      return false;
  }
}

/**
 * `actor` peut-il gérer (supprimer, archiver, bloquer, rétrograder) `target` ?
 * Règle : périmètre couvert ET rang strictement supérieur ET cible non protégée.
 */
export function canManageUser(actor: User, target: User): boolean {
  if (actor.status !== "actif") return false;
  if (actor.id === target.id) return false; // jamais soi-même
  if (isImmune(target)) return false; // l'Administrateur est intouchable
  if (roleRank(actor.role) <= roleRank(target.role)) return false; // strictement inférieur
  return scopeCovers(actor, target.gh, target.immeuble);
}

export type DenyReason =
  | "self"
  | "immune"
  | "rank"
  | "scope"
  | "inactive"
  | "allowed";

/** Explique précisément pourquoi un pouvoir de gestion est refusé. */
export function manageUserDenyReason(actor: User, target: User): DenyReason {
  if (actor.status !== "actif") return "inactive";
  if (actor.id === target.id) return "self";
  if (isImmune(target)) return "immune";
  if (roleRank(actor.role) <= roleRank(target.role)) return "rank";
  if (!scopeCovers(actor, target.gh, target.immeuble)) return "scope";
  return "allowed";
}

/** Rang de responsabilité supérieur ou égal (périmètre supérieur) ? */
export function isSuperiorOrEqualScope(actor: User, target: User): boolean {
  return roleRank(target.role) >= roleRank(actor.role);
}

/**
 * Rôles que `actor` est autorisé à créer.
 * - Administrateur : tous sauf Administrateur (créé uniquement en initialisation).
 * - Président : Responsable de Groupe, Responsable d'Immeuble, Propriétaire.
 * - Resp. de Groupe : Resp. d'Immeuble et Propriétaire, dans son groupe.
 * - Resp. d'Immeuble : Propriétaire, dans son immeuble.
 */
export function creatableRoles(actor: User): string[] {
  switch (actor.role) {
    case "admin":
      return ["president", "gh_manager", "building_manager", "owner"];
    case "president":
      return ["gh_manager", "building_manager", "owner"];
    case "gh_manager":
      return ["building_manager", "owner"];
    case "building_manager":
      return ["owner"];
    default:
      return [];
  }
}

/** `actor` peut-il créer un compte avec ce rôle à cet endroit ? */
export function canCreateUser(
  actor: User,
  role: string,
  gh: number | null,
  immeuble: string | null,
): boolean {
  if (actor.status !== "actif") return false;
  if (!creatableRoles(actor).includes(role)) return false;
  return scopeCovers(actor, gh, immeuble);
}

/**
 * Jusqu'à quel rang `actor` peut-il promouvoir quelqu'un ?
 * (utilisé pour limiter le sélecteur de rôles)
 */
export function maxPromotableRank(actor: User): number {
  return roleRank(actor.role) - 1;
}

/** Rôles que `actor` peut attribuer via le gestionnaire de rôles. */
export function assignableRoles(actor: User): string[] {
  const max = maxPromotableRank(actor);
  return ["owner", "building_manager", "gh_manager", "president"].filter(
    (r) => roleRank(r) <= max,
  );
}

/** `actor` peut-il supprimer/archiver une publication située à cette portée ? */
export function canManageContent(
  actor: User,
  scope: string,
  gh: number | null,
  immeuble: string | null,
): boolean {
  if (actor.status !== "actif") return false;
  if (actor.role === "admin") return true;
  if (actor.role === "president") return true;
  if (actor.role === "gh_manager")
    return scope !== "residence" ? actor.gh === gh : false;
  if (actor.role === "building_manager")
    return scope === "immeuble" &&
      actor.gh === gh &&
      actor.immeuble === immeuble;
  return false;
}
