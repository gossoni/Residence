import { and, count, eq, inArray, lte } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAudit,
  comments,
  pollVotes,
  notifications,
  publications,
  reports,
  settings,
  users,
  votes,
} from "@/db/schema";
import type { Publication, User } from "@/db/schema";
import {
  buildingsOf,
  DEFAULT_REPORT_THRESHOLD,
  DEFAULT_VALIDATION_DELAY_HOURS,
  groupMajorite,
  groupTotalVoix,
  RESIDENCE_MAJORITE,
  RESIDENCE_TOTAL_VOIX,
  type PubStatus,
  type Scope,
} from "./structure";
import { emitNotification } from "./events";

export type ActionState = { error?: string; ok?: boolean };

/* ------------------------------------------------------------------ */
/* Paramètres globaux                                                  */
/* ------------------------------------------------------------------ */

export type Branding = {
  /** Nom affiché de la résidence dans la langue demandée. */
  name: string;
  /** Nom en français (valeur de référence). */
  nameFr: string;
  /** Nom en arabe. */
  nameAr: string;
  /** Chemin du logo (ex. /uploads/xxx.png) ou null pour l'icône par défaut. */
  logoUrl: string | null;
};

export const DEFAULT_BRANDING: Branding = {
  name: "Résidence Les Horizons",
  nameFr: "Résidence Les Horizons",
  nameAr: "إقامة الأفق",
  logoUrl: null,
};

/**
 * Identité visuelle de la résidence, configurable par l'Administrateur.
 * Les valeurs sont stockées dans la table `settings` et servies selon la langue.
 */
export async function getBranding(locale: "fr" | "ar" = "fr"): Promise<Branding> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(
      inArray(settings.key, ["residence_name_fr", "residence_name_ar", "logo_url"]),
    );
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const nameFr = map.get("residence_name_fr") || DEFAULT_BRANDING.nameFr;
  const nameAr = map.get("residence_name_ar") || DEFAULT_BRANDING.nameAr;
  const logoUrl = map.get("logo_url") || null;
  return {
    name: locale === "ar" ? nameAr : nameFr,
    nameFr,
    nameAr,
    logoUrl,
  };
}

/** Enregistre une clé de réglage (upsert). */
export async function setSetting(key: string, value: string | null): Promise<void> {
  if (value === null) {
    await db.delete(settings).where(eq(settings.key, key));
    return;
  }
  await db
    .insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } });
}

export async function getAppSettings(): Promise<{
  validationDelayHours: number;
  reportThreshold: number;
  appLocked: boolean;
  voteWeights: VoteWeights;
  enabledPubTypes: PubTypeKey[];
}> {
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings);
  const map = new Map(rows.map((r) => [r.key, r.value]));

  return {
    validationDelayHours:
      parseInt(map.get("validation_delay_hours") ?? "", 10) ||
      DEFAULT_VALIDATION_DELAY_HOURS,
    reportThreshold:
      parseInt(map.get("report_threshold") ?? "", 10) ||
      DEFAULT_REPORT_THRESHOLD,
    appLocked: map.get("app_locked") === "true",
    voteWeights: getVoteWeights(map),
    enabledPubTypes: getEnabledPubTypes(map),
  };
}

/* ------------------------------------------------------------------ */
/* Poids de voix configurables par l'Administrateur                    */
/* ------------------------------------------------------------------ */

export type VoteWeights = {
  president: number;
  gh_manager: number;
  building_manager: number;
  owner: number;
  admin: number;
};

export const DEFAULT_VOTE_WEIGHTS: VoteWeights = {
  president: 2,
  gh_manager: 1,
  building_manager: 1,
  owner: 0,
  admin: 2,
};

const WEIGHT_KEYS: (keyof VoteWeights)[] = [
  "president",
  "gh_manager",
  "building_manager",
  "owner",
  "admin",
];

export function getVoteWeights(
  map?: Map<string, string>,
): VoteWeights {
  const out = { ...DEFAULT_VOTE_WEIGHTS };
  if (map) {
    for (const k of WEIGHT_KEYS) {
      const raw = parseInt(map.get(`vote_weight_${k}`) ?? "", 10);
      if (Number.isFinite(raw) && raw >= 0 && raw <= 100) out[k] = raw;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Types de publication activables par l'Administrateur               */
/* ------------------------------------------------------------------ */

export type PubTypeKey = "texte" | "fichier" | "tache_evenement" | "sondage";

export const ALL_PUB_TYPES: PubTypeKey[] = [
  "texte",
  "fichier",
  "tache_evenement",
  "sondage",
];

export const DEFAULT_ENABLED_PUB_TYPES: PubTypeKey[] = [
  "texte",
  "fichier",
  "tache_evenement",
  "sondage",
];

/** Types activés : une clé absente vaut « activé » (comportement par défaut). */
export function getEnabledPubTypes(map?: Map<string, string>): PubTypeKey[] {
  if (!map) return [...DEFAULT_ENABLED_PUB_TYPES];
  return ALL_PUB_TYPES.filter((t) => map.get(`pub_type_${t}`) !== "false");
}

export function isPubTypeEnabled(
  type: string,
  enabled: PubTypeKey[],
): boolean {
  return enabled.includes(type as PubTypeKey);
}

/**
 * Verrou global de l'application : lorsqu'il est actif, toutes les mutations
 * (publications, votes, commentaires, signalements, modération, rôles) sont
 * refusées — sauf pour l'Administrateur.
 */
export async function assertNotLocked(
  actor: User,
  errorMessage: string,
): Promise<void> {
  const { appLocked } = await getAppSettings();
  if (appLocked && actor.role !== "admin") {
    throw new Error(errorMessage);
  }
}

/**
 * Écrit une entrée dans le journal d'administration (table `admin_audit`).
 * La structure correspond à la base Supabase : `target` est un libellé texte.
 */
/* ------------------------------------------------------------------ */
/* Majorités & droits                                                  */
/* ------------------------------------------------------------------ */

export function majorityFor(
  scope: Scope,
  gh: number | null,
): { totalVoix: number; majorite: number } {
  if (scope === "residence")
    return { totalVoix: RESIDENCE_TOTAL_VOIX, majorite: RESIDENCE_MAJORITE };
  if (scope === "groupe" && gh)
    return { totalVoix: groupTotalVoix(gh), majorite: groupMajorite(gh) };
  return { totalVoix: 0, majorite: 0 };
}

/**
 * Majorité calculée dynamiquement à partir des poids de voix configurés par
 * l'Administrateur et du nombre réel de votants actifs.
 */
export async function computeMajority(
  scope: Scope,
  gh: number | null,
  weights: VoteWeights,
): Promise<{ totalVoix: number; majorite: number }> {
  if (scope === "residence") {
    const rows = await db
      .select({ role: users.role, c: count() })
      .from(users)
      .where(
        and(
          eq(users.status, "actif"),
          inArray(users.role, ["president", "gh_manager"]),
        ),
      )
      .groupBy(users.role);
    let total = 0;
    for (const r of rows) {
      const w = r.role === "president" ? weights.president : weights.gh_manager;
      total += w * Number(r.c);
    }
    if (total <= 0) return { totalVoix: 0, majorite: 0 };
    return { totalVoix: total, majorite: Math.floor(total / 2) + 1 };
  }
  if (scope === "groupe" && gh) {
    const rows = await db
      .select({ role: users.role, c: count() })
      .from(users)
      .where(
        and(
          eq(users.status, "actif"),
          eq(users.gh, gh),
          inArray(users.role, ["gh_manager", "building_manager"]),
        ),
      )
      .groupBy(users.role);
    let total = 0;
    for (const r of rows) {
      const w =
        r.role === "gh_manager" ? weights.gh_manager : weights.building_manager;
      total += w * Number(r.c);
    }
    if (total <= 0) return { totalVoix: 0, majorite: 0 };
    return { totalVoix: total, majorite: Math.floor(total / 2) + 1 };
  }
  return { totalVoix: 0, majorite: 0 };
}

export function canPublish(user: Pick<User, "status" | "role">): boolean {
  return (
    user.status === "actif" &&
    ["admin", "president", "gh_manager", "building_manager"].includes(user.role)
  );
}

/** Droit de voter sur une publication en attente. */
export function canVoteOn(
  pub: Pick<Publication, "scope" | "gh" | "status" | "authorId">,
  user: User,
): boolean {
  if (pub.status !== "en_validation") return false;
  if (user.status !== "actif") return false;
  if (user.id === pub.authorId) return false;
  if (user.role === "admin") return true;
  if (pub.scope === "residence")
    return user.role === "president" || user.role === "gh_manager";
  if (pub.scope === "groupe")
    return (
      user.gh === pub.gh &&
      (user.role === "gh_manager" || user.role === "building_manager")
    );
  return false;
}

/**
 * Poids de vote selon le contexte, à partir des poids configurés par
 * l'Administrateur. Le Responsable de Groupe agit comme « double voix »
 * dans le contexte de validation de son propre groupe.
 */
export function voteWeightFor(
  user: User,
  pub: Pick<Publication, "scope">,
  weights?: VoteWeights,
): number {
  const w = weights ?? DEFAULT_VOTE_WEIGHTS;
  if (user.role === "admin") return w.admin ?? 2;
  if (user.role === "president") return w.president ?? 2;
  if (user.role === "gh_manager")
    return pub.scope === "residence"
      ? (w.gh_manager ?? 1)
      : Math.max(w.gh_manager ?? 1, w.president ?? 2);
  if (user.role === "building_manager") return w.building_manager ?? 1;
  return w.owner ?? 0;
}

/** Droit de modération (bloquer/restaurer) d'une publication. */
export function canModeratePublication(
  user: User,
  pub: Pick<Publication, "scope" | "gh">,
): boolean {
  if (user.status !== "actif") return false;
  if (user.role === "admin") return true;
  if (user.role === "president") return true;
  if (user.role === "gh_manager")
    return pub.scope === "residence" || pub.gh === user.gh;
  if (user.role === "building_manager")
    return pub.scope !== "residence" && pub.gh === user.gh;
  return false;
}

export function canValidateUser(actor: User, target: User): boolean {
  if (actor.status !== "actif") return false;
  if (actor.role === "admin") return true;
  if (actor.role === "president") return true;
  if (actor.role === "gh_manager") return target.gh === actor.gh;
  if (actor.role === "building_manager")
    return (
      target.gh === actor.gh &&
      (target.immeuble === actor.immeuble || actor.immeuble === null)
    );
  return false;
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export async function notify(
  userIds: number[],
  type: string,
  titre: string,
  body: string,
  link: string,
): Promise<void> {
  const ids = [...new Set(userIds.filter((id): id is number => !!id))];
  if (ids.length === 0) return;
  const rows = await db
    .insert(notifications)
    .values(ids.map((userId) => ({ userId, type, titre, body, link })))
    .returning();
  for (const row of rows) {
    emitNotification(row.userId, {
      id: row.id,
      type: row.type,
      titre: row.titre,
      body: row.body,
      link: row.link,
      read: row.read,
      createdAt: row.createdAt.toISOString(),
    });
  }
}

export async function logAudit(
  actor: User | null,
  action: string,
  target?: string,
  details?: string,
): Promise<void> {
  try {
    await db.insert(adminAudit).values({
      actorId: actor?.id ?? -1,
      action: action.slice(0, 120),
      target: target ?? null,
      details: details ?? null,
    });
  } catch (e) {
    console.error("[audit] échec d'écriture :", e);
  }
}

/** Tous les comptes actifs pouvant voir une publication de cette portée. */
export async function activeUserIdsInScope(
  scope: Scope,
  gh: number | null,
  immeuble: string | null,
): Promise<number[]> {
  const cond =
    scope === "residence"
      ? undefined
      : scope === "groupe"
        ? eq(users.gh, gh ?? -1)
        : and(eq(users.gh, gh ?? -1), eq(users.immeuble, immeuble ?? ""));
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.status, "actif"), cond ?? undefined));
  return rows.map((r) => r.id);
}

/** Votants autorisés pour une publication en attente. */
export async function eligibleVoterIds(
  pub: Pick<Publication, "scope" | "gh">,
): Promise<number[]> {
  if (pub.scope === "residence") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.status, "actif"),
          inArray(users.role, ["gh_manager", "president"]),
        ),
      );
    return rows.map((r) => r.id);
  }
  if (pub.scope === "groupe") {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.status, "actif"),
          eq(users.gh, pub.gh ?? -1),
          inArray(users.role, ["building_manager", "gh_manager"]),
        ),
      );
    return rows.map((r) => r.id);
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Recalcul des voix & décisions                                       */
/* ------------------------------------------------------------------ */

async function loadPublication(pubId: number): Promise<Publication | null> {
  const rows = await db
    .select()
    .from(publications)
    .where(eq(publications.id, pubId))
    .limit(1);
  return rows[0] ?? null;
}

export async function computeVoteCounts(pubId: number): Promise<{
  votesPour: number;
  votesContre: number;
}> {
  const rows = await db
    .select({ choix: votes.choix, poids: votes.poids })
    .from(votes)
    .where(eq(votes.publicationId, pubId));
  let pour = 0;
  let contre = 0;
  for (const v of rows) {
    if (v.choix === "oui") pour += v.poids;
    else contre += v.poids;
  }
  return { votesPour: pour, votesContre: contre };
}

async function notifyTransition(pub: Publication, status: PubStatus): Promise<void> {
  if (status === "publiee" && pub.status !== "publiee") {
    const ids = await activeUserIdsInScope(pub.scope, pub.gh, pub.immeuble);
    await notify(
      ids,
      "approbation",
      "Publication approuvée ✅",
      `La publication « ${pub.titre} » est désormais visible par la communauté.`,
      `/publications/${pub.id}`,
    );
  } else if (status === "rejetee" && pub.status !== "rejetee") {
    await notify(
      [pub.authorId],
      "rejet",
      "Publication rejetée",
      `Votre publication « ${pub.titre} » a été rejetée par la majorité des votants.`,
      `/publications/${pub.id}`,
    );
  }
}

/** Recalcule les scores et tranche si une majorité est atteinte. */
export async function recomputePublication(pubId: number): Promise<{
  status: PubStatus;
  votesPour: number;
  votesContre: number;
}> {
  const pub = await loadPublication(pubId);
  if (!pub) return { status: "en_validation", votesPour: 0, votesContre: 0 };
  const { votesPour, votesContre } = await computeVoteCounts(pubId);
  let status: PubStatus = pub.status;
  if (pub.majorite > 0 && votesPour >= pub.majorite) status = "publiee";
  else if (pub.majorite > 0 && votesContre >= pub.majorite) status = "rejetee";

  if (status !== pub.status || votesPour !== pub.votesPour || votesContre !== pub.votesContre) {
    await db
      .update(publications)
      .set({
        votesPour,
        votesContre,
        status,
        ...(status === "publiee"
          ? { publishedAt: pub.publishedAt ?? new Date() }
          : {}),
      })
      .where(eq(publications.id, pubId));
    await notifyTransition(pub, status);
  }
  return { status, votesPour, votesContre };
}

/**
 * Auto-validation / rejet après expiration du délai.
 *
 * ⚠️ Volontairement non-bloquante : cette fonction est appelée au chargement
 * du fil et du tableau de bord. Si la requête échoue (base momentanément
 * injoignable, colonne manquante), l'affichage de la page ne doit pas être
 * compromis — l'erreur est journalisée et la fonction renvoie 0.
 */
export async function sweepExpiredPublications(): Promise<number> {
  try {
    const expired = await db
      .select()
      .from(publications)
      .where(
        and(
          eq(publications.status, "en_validation"),
          lte(publications.deadline, new Date()),
        ),
      );

    let changed = 0;
    for (const pub of expired) {
      const { votesPour, votesContre } = await computeVoteCounts(pub.id);
      let status: PubStatus = pub.status;
      if (pub.majorite > 0 && votesContre >= pub.majorite) status = "rejetee";
      else if (pub.majorite > 0 && votesPour >= pub.majorite) status = "publiee";
      else status = "publiee"; // délai dépassé sans rejet majoritaire → validation auto

      if (status !== pub.status) {
        await db
          .update(publications)
          .set({
            votesPour,
            votesContre,
            status,
            ...(status === "publiee"
              ? { publishedAt: pub.publishedAt ?? new Date() }
              : {}),
          })
          .where(eq(publications.id, pub.id));
        await notifyTransition(pub, status);
        changed++;
      }
    }
    return changed;
  } catch (e) {
    // Une colonne manquante (schéma non synchronisé) est un cas fréquent :
    // on l'identifie précisément pour guider la correction.
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist|42703/i.test(msg)) {
      console.error(
        "[sweep] Schéma désynchronisé (colonne manquante).\n" +
          "  → Exécutez : npx tsx src/db/sync-schema.ts --fix\n" +
          "  Détail :",
        msg,
      );
    } else {
      console.error("[sweep] Ignoré (base injoignable ?) :", msg);
    }
    return 0;
  }
}

/** Ajoute/change un vote puis re-tranche. */
export async function castVote(
  user: User,
  pubId: number,
  choix: "oui" | "non",
): Promise<void> {
  const pub = await loadPublication(pubId);
  if (!pub) throw new Error("Publication introuvable.");
  if (!canVoteOn(pub, user))
    throw new Error("Vous n'êtes pas autorisé à voter sur cette publication.");
  const poids = voteWeightFor(user, pub);
  await db
    .insert(votes)
    .values({ publicationId: pubId, userId: user.id, choix, poids })
    .onConflictDoUpdate({
      target: [votes.publicationId, votes.userId],
      set: { choix, poids, createdAt: new Date() },
    });
  await recomputePublication(pubId);
  await sweepExpiredPublications();
}

export async function getMyVote(
  pubId: number,
  userId: number,
): Promise<"oui" | "non" | null> {
  const rows = await db
    .select({ choix: votes.choix })
    .from(votes)
    .where(and(eq(votes.publicationId, pubId), eq(votes.userId, userId)))
    .limit(1);
  return rows[0]?.choix ?? null;
}

/* ------------------------------------------------------------------ */
/* Signalements & modération                                           */
/* ------------------------------------------------------------------ */

export async function openReportCountFor(
  type: "publication" | "comment",
  id: number,
): Promise<number> {
  const cond =
    type === "publication"
      ? eq(reports.publicationId, id)
      : eq(reports.commentId, id);
  const rows = await db
    .select({ id: reports.id })
    .from(reports)
    .where(and(cond, eq(reports.status, "ouvert")));
  return rows.length;
}

/** Masquage automatique au-delà du seuil de signalements. */
export async function checkAutoMaskPublication(
  pub: Publication,
): Promise<boolean> {
  const { reportThreshold } = await getAppSettings();
  const count = await openReportCountFor("publication", pub.id);
  if (pub.status === "publiee" && count >= reportThreshold) {
    await db
      .update(publications)
      .set({ status: "masquee", moderationReason: `Masquée automatiquement (${count} signalements)` })
      .where(eq(publications.id, pub.id));
    const mods = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.status, "actif"),
          inArray(users.role, ["president", "gh_manager"]),
        ),
      );
    await notify(
      mods.map((m) => m.id),
      "signalement",
      "Contenu masqué automatiquement",
      `La publication « ${pub.titre} » a dépassé le seuil de ${reportThreshold} signalements.`,
      `/publications/${pub.id}`,
    );
    return true;
  }
  return false;
}

export async function checkAutoMaskComment(commentId: number): Promise<boolean> {
  const { reportThreshold } = await getAppSettings();
  const count = await openReportCountFor("comment", commentId);
  if (count >= reportThreshold) {
    await db
      .update(comments)
      .set({
        blocked: true,
        blockedReason: `Commentaire masqué automatiquement (${count} signalements)`,
      })
      .where(eq(comments.id, commentId));
    return true;
  }
  return false;
}

export async function resolveOpenReports(
  type: "publication" | "comment",
  id: number,
  resolvedBy: number,
): Promise<void> {
  const cond =
    type === "publication"
      ? eq(reports.publicationId, id)
      : eq(reports.commentId, id);
  await db
    .update(reports)
    .set({ status: "traite", resolvedBy, resolvedAt: new Date() })
    .where(and(cond, eq(reports.status, "ouvert")));
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

export function canSeePublication(
  pub: Pick<Publication, "scope" | "gh" | "immeuble">,
  user: User,
): boolean {
  if (user.role === "admin" || user.role === "president") return true;
  if (pub.scope === "residence") return true;
  if (pub.scope === "groupe") return pub.gh === user.gh;
  return pub.gh === user.gh && pub.immeuble === user.immeuble;
}

export function buildingsOfGh(gh: number): string[] {
  return buildingsOf(gh);
}

/* ------------------------------------------------------------------ */
/* Sondages                                                            */
/* ------------------------------------------------------------------ */

/** Le sondage est-il encore ouvert ? (null = sans date de clôture) */
export function isPollOpen(
  pub: Pick<Publication, "type" | "pollEndsAt" | "status">,
): boolean {
  if (pub.type !== "sondage") return false;
  if (pub.status !== "publiee") return false;
  if (!pub.pollEndsAt) return true;
  return new Date(pub.pollEndsAt).getTime() > Date.now();
}

/**
 * Peut-on participer à un sondage ?
 * Contrairement aux scrutins de validation, les SONDAGES sont ouverts à
 * TOUS les membres actifs — y compris les simples propriétaires.
 */
export function canVoteInPoll(
  pub: Pick<Publication, "type" | "pollEndsAt" | "status" | "authorId">,
  user: User,
): boolean {
  if (!isPollOpen(pub)) return false;
  if (user.status !== "actif") return false;
  return true; // propriétaires inclus
}

export type PollResults = {
  options: string[];
  counts: number[];
  totalVotes: number;
  voters: number;
  myChoice: number[];
};

/** Résultats d'un sondage (comptage par option). */
export async function getPollResults(
  pubId: number,
  userId: number,
): Promise<PollResults> {
  const pub = (
    await db
      .select()
      .from(publications)
      .where(eq(publications.id, pubId))
      .limit(1)
  )[0];
  const options = (pub?.pollOptions as string[] | null) ?? [];
  const counts = new Array(options.length).fill(0);

  const rows = await db
    .select({
      optionIndex: pollVotes.optionIndex,
      userId: pollVotes.userId,
    })
    .from(pollVotes)
    .where(eq(pollVotes.publicationId, pubId));

  const voters = new Set<number>();
  const myChoice: number[] = [];
  for (const r of rows) {
    if (r.optionIndex >= 0 && r.optionIndex < options.length) {
      counts[r.optionIndex]++;
      voters.add(r.userId);
      if (r.userId === userId) myChoice.push(r.optionIndex);
    }
  }
  return {
    options,
    counts,
    totalVotes: rows.length,
    voters: voters.size,
    myChoice,
  };
}

/** Enregistre (ou remplace) la participation à un sondage. */
export async function castPollVote(
  user: User,
  pubId: number,
  optionIndexes: number[],
): Promise<void> {
  const pub = (
    await db.select().from(publications).where(eq(publications.id, pubId)).limit(1)
  )[0];
  if (!pub) throw new Error("Publication introuvable.");
  if (!canVoteInPoll(pub, user))
    throw new Error(
      "Ce sondage est fermé ou vous ne pouvez pas y participer.",
    );

  const options = (pub.pollOptions as string[] | null) ?? [];
  const clean = [...new Set(optionIndexes)].filter(
    (i) => Number.isInteger(i) && i >= 0 && i < options.length,
  );
  if (clean.length === 0) throw new Error("Aucune option valide sélectionnée.");
  if (!pub.pollMultiple && clean.length > 1)
    throw new Error("Ce sondage n'accepte qu'une seule option.");

  // À choix unique, on remplace le vote précédent.
  await db
    .delete(pollVotes)
    .where(
      and(eq(pollVotes.publicationId, pubId), eq(pollVotes.userId, user.id)),
    );

  await db.insert(pollVotes).values(
    clean.map((optionIndex) => ({
      publicationId: pubId,
      userId: user.id,
      optionIndex,
    })),
  );
}
