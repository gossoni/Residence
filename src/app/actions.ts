"use server";

import { randomBytes } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import {
  adminAudit,
  comments,
  notifications,
  publications,
  reports,
  settings,
  users,
  votes,
} from "@/db/schema";
import {
  createSession,
  destroySession,
  getCurrentUser,
  hashPassword,
  requireActiveUser,
  requireUser,
  verifyPassword,
} from "@/lib/auth";
import {
  assertNotLocked,
  canModeratePublication,
  castPollVote,
  computeMajority,
  getBranding,
  setSetting,
  canPublish,
  canVoteOn,
  castVote,
  checkAutoMaskComment,
  checkAutoMaskPublication,
  getAppSettings,
  logAudit,
  majorityFor,
  notify,
  resolveOpenReports,
  sweepExpiredPublications,
} from "@/lib/logic";
import { buildingsOf, ghLabel, type Scope } from "@/lib/structure";
import {
  canCreateUser,
  canManageContent,
  canManageUser,
  creatableRoles,
  isImmune,
  isManagerRole,
  manageUserDenyReason,
} from "@/lib/hierarchy";
import {
  buildPublicationArchive,
  buildUserArchive,
  deleteUserCascade,
} from "@/lib/archive";
import { isLocale, LOCALE_COOKIE, type Locale } from "@/lib/i18n";
import { getDictionary, scopeLabel } from "@/lib/i18n";
import type { ActionState } from "@/lib/logic";

export type AdminActionState = ActionState & { password?: string; email?: string };

export type PublicationResult = ActionState & { publicationId?: number };

const revalidateAll = (id?: number) => {
  revalidatePath("/feed");
  revalidatePath("/dashboard");
  if (id) revalidatePath(`/publications/${id}`);
};

/* ------------------------------------------------------------------ */
/* Authentification                                                    */
/* ------------------------------------------------------------------ */

export async function loginAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password)
    return { error: "Veuillez renseigner votre e-mail et votre mot de passe." };
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const user = rows[0];
  if (!user || !verifyPassword(password, user.passwordHash))
    return { error: "Identifiants invalides." };
  if (user.status === "bloque")
    return {
      error:
        "Votre compte est bloqué. Contactez le Président de la résidence pour plus d’informations.",
    };
  await createSession(user.id);
  redirect(
    user.status === "provisoire"
      ? "/dashboard"
      : user.mustChangePassword
        ? "/changer-mdp"
        : "/feed",
  );
}

export async function registerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telephone = String(formData.get("telephone") ?? "").trim();
  const gh = Number(formData.get("gh"));
  const immeuble = String(formData.get("immeuble") ?? "").trim().toUpperCase();
  const appartement = String(formData.get("appartement") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!prenom || !nom || !email || !telephone)
    return { error: "Tous les champs sont obligatoires." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { error: "Adresse e-mail invalide." };
  if (!Number.isInteger(gh) || gh < 1 || gh > 12)
    return { error: "Groupe d’Habitation invalide." };
  if (!buildingsOf(gh).includes(immeuble))
    return { error: `L’immeuble ${immeuble} n’existe pas dans le GH${gh}.` };
  if (!appartement) return { error: "Le numéro d’appartement est requis." };
  if (password.length < 8)
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0)
    return { error: "Un compte existe déjà avec cette adresse e-mail." };

  // Règle de hiérarchie : un propriétaire ne peut créer que son propre compte,
  // provisoire, en attente de validation par le Responsable de son immeuble.
  const inserted = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashPassword(password),
      nom,
      prenom,
      telephone,
      gh,
      immeuble,
      appartement,
      role: "owner",
      status: "provisoire",
      mustChangePassword: false,
    })
    .returning({ id: users.id });

  // Notifie les responsables d'immeuble compétents pour valider cette demande.
  const validators = await db
    .select({ id: users.id, role: users.role, gh: users.gh, immeuble: users.immeuble })
    .from(users)
    .where(eq(users.status, "actif"));
  const placeholder = {
    id: -1,
    role: "owner",
    gh,
    immeuble,
    status: "actif",
  } as never;
  const notified = validators
    .filter((v) => canManageUser(v as never, placeholder))
    .map((v) => v.id);
  if (notified.length > 0) {
    await notify(
      notified,
      "compte_a_valider",
      "🪪 Nouvelle demande d’inscription",
      `${prenom} ${nom} (${ghLabel(gh)} · Immeuble ${immeuble} · Apt ${appartement}) attend votre validation.`,
      "/dashboard",
    );
  }
  await createSession(inserted[0].id);
  redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/* ------------------------------------------------------------------ */
/* Publications                                                        */
/* ------------------------------------------------------------------ */

export async function createPublicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<PublicationResult> {
  const user = await requireActiveUser();
//  if (!canPublish(user))
//  try {
//    await assertNotLocked(user, "Application verrouillée par l’Administrateur.");
//  } catch (e) {
//    return { error: e instanceof Error ? e.message : "Action refusée." };
//  }

//    return {
//      error:
//        "Seuls l’Administrateur, le Président, les Responsables de Groupe et les Responsables d’Immeuble peuvent publier.",
//    };

if (!canPublish(user))
    return {
      error: `DÉBOGAGE — email: ${user.email} | rôle: ${user.role} | statut: ${user.status}`,
    };

  const type = String(formData.get("type") ?? "texte");
  const titre = String(formData.get("titre") ?? "").trim();
  const contenu = String(formData.get("contenu") ?? "").trim();
  const scope = String(formData.get("scope") ?? "") as Scope;
  const pubGh = Number(formData.get("pubGh") ?? user.gh);
  const pubImmeuble = String(formData.get("pubImmeuble") ?? "").trim().toUpperCase();
  const eventAtRaw = String(formData.get("eventAt") ?? "").trim();
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();
  const isUploadUrl = (u: string) =>
    u.startsWith("/api/uploads/") || 
    u.startsWith("/uploads/") ||
    u.startsWith("https://") ||
    u.startsWith("http://");

  const fileName = String(formData.get("fileName") ?? "").trim();
  const fileMime = String(formData.get("fileMime") ?? "").trim();
  const fileSize = Number(formData.get("fileSize") ?? 0);

  if (!titre || !contenu) return { error: "Le titre et le contenu sont requis." };
  if (!["texte", "fichier", "tache_evenement", "sondage"].includes(type))
    return { error: "Type de publication inconnu." };

  // ⚠️ L'Administrateur peut désactiver certains types de publication.
  const { enabledPubTypes } = await getAppSettings();
  if (!enabledPubTypes.includes(type as never))
    return {
      error:
        "Ce type de publication a été désactivé par l’Administrateur de la résidence.",
    };
  if (!["residence", "groupe", "immeuble"].includes(scope))
    return { error: "Portée de publication inconnue." };
  if (type === "fichier") {
    if (!fileUrl) return { error: "Veuillez joindre un fichier (PDF ou image)." };
    if (!isUploadUrl(fileUrl)) return { error: "Fichier invalide." };
  }

  // Sondage : au moins deux options distinctes.
  const pollOptionsList = formData
    .getAll("pollOption")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const pollMultiple = String(formData.get("pollMultiple") ?? "") === "on";
  const pollEndsRaw = String(formData.get("pollEndsAt") ?? "").trim();
  let pollEndsAt: Date | null = null;
  if (pollEndsRaw) {
    const parsed: Date = new Date(pollEndsRaw);
    if (Number.isNaN(parsed.getTime()))
      return { error: "Date de clôture du sondage invalide." };
    pollEndsAt = parsed;
  }

  if (type === "sondage") {
    const unique = [...new Set(pollOptionsList)];
    if (unique.length < 2)
      return { error: "Un sondage nécessite au moins deux options différentes." };
    if (pollOptionsList.length !== unique.length)
      return { error: "Les options du sondage doivent être différentes." };
  }

  // Périmètre autorisé
  const freeChoice = user.role === "admin" || user.role === "president";
  let gh: number | null = null;
  let immeuble: string | null = null;
  if (scope === "residence") {
    if (user.role === "building_manager")
      return { error: "Un Responsable d’Immeuble ne peut pas publier à l’échelle de la Résidence." };
  } else if (scope === "groupe") {
    gh = freeChoice ? pubGh : user.gh;
    if (!freeChoice && gh !== user.gh)
      return { error: "Vous ne pouvez publier que dans votre propre Groupe." };
  } else {
    gh = freeChoice ? pubGh : user.gh;
    // L'Administrateur, le Président et le Responsable de Groupe choisissent
    // l'immeuble cible ; le Responsable d'Immeuble est limité au sien.
    immeuble =
      user.role === "building_manager" ? user.immeuble : pubImmeuble || null;
    const targetGh: number = gh ?? -1;
    const targetBuilding: string = immeuble ?? "";
    if (!targetBuilding || !buildingsOf(targetGh).includes(targetBuilding))
      return { error: "Immeuble invalide pour ce Groupe d’Habitation." };
    gh = targetGh;
    immeuble = targetBuilding;
  }

  const needsVote =
    (user.role === "gh_manager" && scope === "residence") ||
    (user.role === "building_manager" && scope === "groupe");
  // Majorité calculée à partir des poids de voix configurés par l'Administrateur.
  const { voteWeights } = await getAppSettings();
  const { totalVoix, majorite } = needsVote
    ? await computeMajority(scope, gh, voteWeights)
    : { totalVoix: 0, majorite: 0 };

  const { validationDelayHours } = await getAppSettings();
  const rawLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const dict = getDictionary(rawLocale === "ar" ? "ar" : "fr");
  const deadline = needsVote
    ? new Date(Date.now() + validationDelayHours * 3600 * 1000)
    : null;

  const eventAt =
    type === "tache_evenement" && eventAtRaw
      ? new Date(eventAtRaw)
      : null;

  const inserted = await db
    .insert(publications)
    .values({
      authorId: user.id,
      type: type as never,
      titre,
      contenu,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileMime: fileMime || null,
      fileSize: fileSize || null,
      scope: scope as never,
      gh,
      immeuble,
      eventAt,
      pollOptions: type === "sondage" ? pollOptionsList : null,
      pollMultiple: type === "sondage" ? pollMultiple : false,
      pollEndsAt: type === "sondage" ? pollEndsAt : null,
      status: needsVote ? "en_validation" : "publiee",
      votesPour: 0,
      votesContre: 0,
      totalVoix,
      majorite,
      deadline,
      publishedAt: needsVote ? null : new Date(),
    })
    .returning({ id: publications.id });
  const pubId = inserted[0].id;

  if (needsVote) {
    const voters = await eligibleVoterIdsFor(scope, gh);
    await notify(
      voters.filter((v) => v !== user.id),
      "vote_requis",
      "🗳️ Votre vote est requis",
      `La publication « ${titre} » (portée ${scopeLabel(dict, scope)}) attend votre validation.`,
      `/publications/${pubId}`,
    );
  } else {
    const ids = await visibleUserIdsFor(scope, gh, immeuble);
    await notify(
      ids.filter((v) => v !== user.id),
      "publication",
      "📢 Nouvelle publication",
      `${user.prenom} ${user.nom} a publié « ${titre} » (${scopeLabel(dict, scope)}).`,
      `/publications/${pubId}`,
    );
  }

  revalidateAll(pubId);
  return { ok: true, publicationId: pubId };
}

/* ------------------------------------------------------------------ */
/* Votes                                                               */
/* ------------------------------------------------------------------ */

export async function voteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireActiveUser();
  const pubId = Number(formData.get("pubId"));
  const choix = String(formData.get("choix"));
  try {
    await assertNotLocked(user, "Application verrouillée par l’Administrateur.");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action refusée." };
  }

  if (!Number.isInteger(pubId) || (choix !== "oui" && choix !== "non"))
    return { error: "Vote invalide." };
  try {
    await castVote(user, pubId, choix);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Vote impossible." };
  }
  revalidateAll(pubId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Commentaires                                                        */
/* ------------------------------------------------------------------ */

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireActiveUser();
  const pubId = Number(formData.get("pubId"));
  const contenu = String(formData.get("contenu") ?? "").trim();
  try {
    await assertNotLocked(user, "Application verrouillée par l’Administrateur.");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action refusée." };
  }

  if (!Number.isInteger(pubId)) return { error: "Publication invalide." };
  if (!contenu) return { error: "Le commentaire est vide." };
  if (contenu.length > 2000) return { error: "Commentaire trop long (2000 caractères max)." };

  const pub = (
    await db
      .select()
      .from(publications)
      .where(eq(publications.id, pubId))
      .limit(1)
  )[0];
  if (!pub || pub.status !== "publiee")
    return { error: "Cette publication n’est pas ouverte aux commentaires." };

  await db
    .insert(comments)
    .values({ publicationId: pubId, authorId: user.id, contenu });

  const recipients = await moderatorIdsForPub(pub);
  if (!recipients.includes(pub.authorId)) recipients.push(pub.authorId);
  await notify(
    recipients.filter((r) => r !== user.id),
    "commentaire",
    "💬 Nouveau commentaire",
    `${user.prenom} ${user.nom} a commenté « ${pub.titre} ».`,
    `/publications/${pubId}`,
  );

  revalidateAll(pubId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Signalements                                                        */
/* ------------------------------------------------------------------ */

export async function reportAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireActiveUser();
  const targetType = String(formData.get("targetType"));
  try {
    await assertNotLocked(user, "Application verrouillée par l’Administrateur.");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action refusée." };
  }

  const targetId = Number(formData.get("targetId"));
  const reason = String(formData.get("reason") ?? "");
  const details = String(formData.get("details") ?? "").trim();
  if (!["publication", "comment"].includes(targetType))
    return { error: "Cible inconnue." };
  if (!Number.isInteger(targetId)) return { error: "Cible invalide." };
  if (!reason) return { error: "Veuillez choisir un motif." };

  let pubForScope: (typeof publications.$inferSelect) | null = null;

  if (targetType === "publication") {
    const pub = (
      await db
        .select()
        .from(publications)
        .where(eq(publications.id, targetId))
        .limit(1)
    )[0];
    if (!pub) return { error: "Publication introuvable." };
    if (pub.status !== "publiee")
      return { error: "Ce contenu n’est plus signalable." };
    pubForScope = pub;
  } else {
    const comment = (
      await db
        .select()
        .from(comments)
        .where(eq(comments.id, targetId))
        .limit(1)
    )[0];
    if (!comment) return { error: "Commentaire introuvable." };
    const pub = (
      await db
        .select()
        .from(publications)
        .where(eq(publications.id, comment.publicationId))
        .limit(1)
    )[0];
    if (!pub || pub.status !== "publiee")
      return { error: "Ce contenu n’est plus signalable." };
    pubForScope = pub;
  }

  const dup = await db
    .select({ id: reports.id })
    .from(reports)
    .where(
      and(
        eq(reports.reporterId, user.id),
        targetType === "publication"
          ? eq(reports.publicationId, targetId)
          : eq(reports.commentId, targetId),
        eq(reports.status, "ouvert"),
      ),
    )
    .limit(1);
  if (dup.length > 0) return { error: "Vous avez déjà signalé ce contenu." };

  await db.insert(reports).values({
    publicationId: targetType === "publication" ? targetId : null,
    commentId: targetType === "comment" ? targetId : null,
    reporterId: user.id,
    reason: details ? `${reason} — ${details}` : reason,
  });

  if (targetType === "publication" && pubForScope) {
    await checkAutoMaskPublication(pubForScope);
    const mods = await moderatorIdsForPub(pubForScope);
    await notify(
      mods.filter((m) => m !== user.id),
      "signalement",
      "🚩 Nouveau signalement",
      `La publication « ${pubForScope.titre} » a été signalée.`,
      `/publications/${pubForScope.id}`,
    );
  } else if (targetType === "comment") {
    await checkAutoMaskComment(targetId);
    const pub = (
      await db
        .select()
        .from(publications)
        .where(eq(publications.id, pubForScope!.id))
        .limit(1)
    )[0];
    if (pub) {
      const mods = await moderatorIdsForPub(pub);
      await notify(
        mods.filter((m) => m !== user.id),
        "signalement",
        "🚩 Nouveau signalement",
        `Un commentaire de la publication « ${pub.titre} » a été signalé.`,
        `/publications/${pub.id}`,
      );
    }
  }

  revalidateAll(targetType === "publication" ? targetId : undefined);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Gestion des comptes                                                 */
/* ------------------------------------------------------------------ */

export async function userStatusAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  const userId = Number(formData.get("userId"));
  const decision = String(formData.get("decision"));
  try {
    await assertNotLocked(actor, "Application verrouillée par l’Administrateur.");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action refusée." };
  }

  if (!Number.isInteger(userId) || !["valider", "activer", "bloquer"].includes(decision))
    return { error: "Requête invalide." };

  const target = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (!target) return { error: "Utilisateur introuvable." };

  if (!isManagerRole(actor.role))
    return { error: "Action réservée aux responsables." };

  // ⚠️ Règle absolue : personne n'agit sur soi-même ni sur un périmètre supérieur.
  const deny = manageUserDenyReason(actor, target);
  if (deny === "self")
    return { error: "Vous ne pouvez pas effectuer cette action sur votre propre compte." };
  if (deny === "immune")
    return { error: "Impossible de modifier le compte d’un Administrateur." };
  if (deny === "rank")
    return {
      error:
        "Vous ne pouvez pas agir sur un compte de rang supérieur ou égal au vôtre.",
    };
  if (deny === "scope")
    return { error: "Ce compte est hors de votre périmètre." };

  if (decision === "valider") {
    await db
      .update(users)
      .set({ status: "actif", validatedBy: actor.id, validatedAt: new Date() })
      .where(eq(users.id, userId));
    await notify(
      [userId],
      "compte_valide",
      "✅ Compte validé",
      "Votre compte propriétaire est désormais actif. Bienvenue dans la résidence !",
      "/feed",
    );
  } else if (decision === "activer") {
    await db
      .update(users)
      .set({ status: "actif", validatedBy: actor.id, validatedAt: new Date() })
      .where(eq(users.id, userId));
    await notify([userId], "compte_valide", "✅ Compte réactivé", "Votre compte a été réactivé.", "/feed");
  } else {
    await db
      .update(users)
      .set({ status: "bloque" })
      .where(eq(users.id, userId));
    await notify([userId], "compte_bloque", "🚫 Compte bloqué", "Votre compte a été bloqué par la modération.", "/login");
  }

  await logAudit(actor, `user.${decision}`, `user#${userId}`, `${target.prenom} ${target.nom} (${target.email})`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Modération publications & commentaires                              */
/* ------------------------------------------------------------------ */

export async function moderatePublicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  const pubId = Number(formData.get("pubId"));
  const decision = String(formData.get("decision"));
  try {
    await assertNotLocked(actor, "Application verrouillée par l’Administrateur.");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action refusée." };
  }

  const reason = String(formData.get("reason") ?? "").trim();

  const pub = (
    await db
      .select()
      .from(publications)
      .where(eq(publications.id, pubId))
      .limit(1)
  )[0];
  if (!pub) return { error: "Publication introuvable." };
  if (!canModeratePublication(actor, pub))
    return { error: "Cette publication est hors de votre périmètre de modération." };

  if (decision === "bloquer") {
    if (!reason) return { error: "Une justification est requise." };
    await db
      .update(publications)
      .set({ status: "bloquee", moderationReason: reason })
      .where(eq(publications.id, pubId));
    await resolveOpenReports("publication", pubId, actor.id);
    await notify(
      [pub.authorId],
      "blocage",
      "🚫 Publication bloquée",
      `Votre publication « ${pub.titre} » a été bloquée. Justification : ${reason}`,
      `/publications/${pubId}`,
    );
  } else if (decision === "restaurer") {
    await db
      .update(publications)
      .set({
        status: "publiee",
        moderationReason: null,
        publishedAt: pub.publishedAt ?? new Date(),
      })
      .where(eq(publications.id, pubId));
    await resolveOpenReports("publication", pubId, actor.id);
  } else if (decision === "forcer_approbation") {
    await db
      .update(publications)
      .set({ status: "publiee", publishedAt: pub.publishedAt ?? new Date() })
      .where(eq(publications.id, pubId));
    await notify(
      [pub.authorId],
      "approbation",
      "✅ Publication approuvée",
      `Votre publication « ${pub.titre} » a été approuvée manuellement.`,
      `/publications/${pubId}`,
    );
  } else if (decision === "forcer_rejet") {
    await db
      .update(publications)
      .set({ status: "rejetee" })
      .where(eq(publications.id, pubId));
    await notify(
      [pub.authorId],
      "rejet",
      "⛔ Publication rejetée",
      `Votre publication « ${pub.titre} » a été rejetée manuellement.`,
      `/publications/${pubId}`,
    );
  } else {
    return { error: "Décision inconnue." };
  }

  revalidateAll(pubId);
  return { ok: true };
}

export async function moderateCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  const commentId = Number(formData.get("commentId"));
  try {
    await assertNotLocked(actor, "Application verrouillée par l’Administrateur.");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action refusée." };
  }

  const decision = String(formData.get("decision"));
  const reason = String(formData.get("reason") ?? "").trim();

  const comment = (
    await db
      .select()
      .from(comments)
      .where(eq(comments.id, commentId))
      .limit(1)
  )[0];
  if (!comment) return { error: "Commentaire introuvable." };
  const pub = (
    await db
      .select()
      .from(publications)
      .where(eq(publications.id, comment.publicationId))
      .limit(1)
  )[0];
  if (!pub || !canModeratePublication(actor, pub))
    return { error: "Commentaire hors de votre périmètre de modération." };

  if (decision === "bloquer") {
    if (!reason) return { error: "Une justification est requise." };
    await db
      .update(comments)
      .set({ blocked: true, blockedBy: actor.id, blockedReason: reason })
      .where(eq(comments.id, commentId));
    await notify(
      [comment.authorId],
      "blocage",
      "🚫 Commentaire bloqué",
      `Votre commentaire sur « ${pub.titre} » a été bloqué. Justification : ${reason}`,
      `/publications/${pub.id}`,
    );
  } else if (decision === "restaurer") {
    await db
      .update(comments)
      .set({ blocked: false, blockedBy: null, blockedReason: null })
      .where(eq(comments.id, commentId));
  } else {
    return { error: "Décision inconnue." };
  }
  await resolveOpenReports("comment", commentId, actor.id);
  revalidatePath(`/publications/${pub.id}`);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Gestion des rôles (Président uniquement)                             */
/* ------------------------------------------------------------------ */

export async function updateUserRoleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  try {
    await assertNotLocked(actor, "Application verrouillée par l’Administrateur.");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action refusée." };
  }
  if (actor.role !== "admin" && actor.role !== "president")
    return { error: "Seuls l’Administrateur et le Président peuvent modifier les rôles." };

  const userId = Number(formData.get("userId"));
  const role = String(formData.get("role"));
  const immeubleInput = String(formData.get("immeuble") ?? "").trim().toUpperCase();

  if (!Number.isInteger(userId)) return { error: "Utilisateur invalide." };
  if (!["owner", "gh_manager", "building_manager"].includes(role))
    return { error: "Rôle invalide." };

  const target = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (!target) return { error: "Utilisateur introuvable." };
  if (target.role === "admin")
    return { error: "Le rôle Administrateur ne peut pas être modifié ici." };
  if (target.role === "president" && actor.role !== "admin")
    return { error: "Seul l’Administrateur peut modifier le rôle du Président." };
  if (target.id === actor.id) return { error: "Vous ne pouvez pas modifier votre propre rôle." };

  if (role === "gh_manager") {
    // Un seul Responsable de Groupe par GH : rétrograde l'ancien titulaire.
    const previous = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.gh, target.gh),
          eq(users.role, "gh_manager"),
          eq(users.status, "actif"),
        ),
      );
    for (const p of previous) {
      if (p.id === target.id) continue;
      await db.update(users).set({ role: "owner" }).where(eq(users.id, p.id));
      await notify(
        [p.id],
        "role",
        "Changement de rôle",
        `Vous n’êtes plus Responsable du ${p.gh ? `GH${p.gh}` : "Groupe"} : un nouveau responsable a été désigné par le Président.`,
        "/dashboard",
      );
    }
    await db
      .update(users)
      .set({ role: "gh_manager", immeuble: null })
      .where(eq(users.id, userId));
  } else if (role === "building_manager") {
    const immeuble = immeubleInput || target.immeuble;
    if (!immeuble || !buildingsOf(target.gh).includes(immeuble))
      return { error: "Immeuble invalide pour ce Groupe d’Habitation." };
    // Un seul Responsable par immeuble : rétrograde l'ancien titulaire.
    const previous = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.gh, target.gh),
          eq(users.immeuble, immeuble),
          eq(users.role, "building_manager"),
          eq(users.status, "actif"),
        ),
      );
    for (const p of previous) {
      if (p.id === target.id) continue;
      await db.update(users).set({ role: "owner" }).where(eq(users.id, p.id));
      await notify(
        [p.id],
        "role",
        "Changement de rôle",
        `Vous n’êtes plus Responsable de l’Immeuble ${immeuble} : un nouveau responsable a été désigné par le Président.`,
        "/dashboard",
      );
    }
    await db
      .update(users)
      .set({ role: "building_manager", immeuble })
      .where(eq(users.id, userId));
  } else {
    // Rétrogradé en Propriétaire simple.
    const immeuble = immeubleInput || target.immeuble || buildingsOf(target.gh)[0];
    await db
      .update(users)
      .set({ role: "owner", immeuble })
      .where(eq(users.id, userId));
  }

  await logAudit(actor, "user.role_change", `user#${userId}`, `${target.prenom} ${target.nom} → ${role}`);
  await notify(
    [userId],
    "role",
    "🎖️ Votre rôle a changé",
    `Le Président vous a attribué le rôle « ${
      role === "gh_manager" ? "Responsable de Groupe" : role === "building_manager" ? "Responsable d’Immeuble" : "Propriétaire"
    } ».`,
    "/dashboard",
  );

  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Profil utilisateur                                                  */
/* ------------------------------------------------------------------ */

export async function updateProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const nom = String(formData.get("nom") ?? "").trim();
  const prenom = String(formData.get("prenom") ?? "").trim();
  const telephone = String(formData.get("telephone") ?? "").trim();

  if (!nom) return { error: "Le nom est requis." };
  if (!prenom) return { error: "Le prénom est requis." };
  if (!telephone) return { error: "Le numéro de téléphone est requis." };

  await db
    .update(users)
    .set({ nom, prenom, telephone })
    .where(eq(users.id, user.id));

  await logAudit(user, "user.profile_update", `user#${user.id}`);
  revalidatePath("/dashboard");
  revalidatePath("/profil");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Paramètres                                                          */
/* ------------------------------------------------------------------ */

export async function updateSettingsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  try {
    await assertNotLocked(actor, "Application verrouillée par l’Administrateur.");
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Action refusée." };
  }
  if (actor.role !== "admin" && actor.role !== "president")
    return { error: "Seuls l’Administrateur et le Président peuvent modifier les paramètres." };
  const delay = Number(formData.get("delayHours"));
  const threshold = Number(formData.get("reportThreshold"));
  if (!Number.isInteger(delay) || delay < 1 || delay > 720)
    return { error: "Délai invalide (1 à 720 h)." };
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 100)
    return { error: "Seuil invalide (1 à 100)." };

  await db
    .insert(settings)
    .values({ key: "validation_delay_hours", value: String(delay) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(delay) },
    });
  await db
    .insert(settings)
    .values({ key: "report_threshold", value: String(threshold) })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: String(threshold) },
    });
  await logAudit(actor, "settings.update", "settings", `délai=${delay}h, seuil signalements=${threshold}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export async function markNotificationsReadAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.userId, user.id), eq(notifications.read, false)));
  revalidatePath("/dashboard");
}

/* ------------------------------------------------------------------ */
/* Helpers internes                                                    */
/* ------------------------------------------------------------------ */

type PubShape = {
  scope: Scope;
  gh: number | null;
  immeuble: string | null;
};

async function eligibleVoterIdsFor(scope: Scope, gh: number | null): Promise<number[]> {
  if (scope === "residence") {
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
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        eq(users.status, "actif"),
        eq(users.gh, gh ?? -1),
        inArray(users.role, ["building_manager", "gh_manager"]),
      ),
    );
  return rows.map((r) => r.id);
}

async function visibleUserIdsFor(
  scope: Scope,
  gh: number | null,
  immeuble: string | null,
): Promise<number[]> {
  let cond;
  if (scope === "residence") cond = eq(users.status, "actif");
  else if (scope === "groupe")
    cond = and(eq(users.status, "actif"), eq(users.gh, gh ?? -1));
  else
    cond = and(
      eq(users.status, "actif"),
      eq(users.gh, gh ?? -1),
      eq(users.immeuble, immeuble ?? ""),
    );
  const rows = await db.select({ id: users.id }).from(users).where(cond!);
  return rows.map((r) => r.id);
}

/** Modérateurs concernés par une publication (selon portée). */
async function moderatorIdsForPub(pub: PubShape & { id: number }): Promise<number[]> {
  const allMods = await db
    .select({ id: users.id, role: users.role, gh: users.gh })
    .from(users)
    .where(
      and(
        eq(users.status, "actif"),
        inArray(users.role, ["president", "gh_manager", "building_manager"]),
      ),
    );
  return allMods
    .filter((m) => canModeratePublication(m as never, pub))
    .map((m) => m.id);
}

/* ------------------------------------------------------------------ */
/* Langue de l'interface                                               */
/* ------------------------------------------------------------------ */

export async function setLocaleAction(formData: FormData): Promise<void> {
  const raw = String(formData.get("locale") ?? "");
  if (!isLocale(raw)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, raw as Locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Administration                                                      */
/* ------------------------------------------------------------------ */

const ADMIN_ROLE_VALUES = [
  "president",
  "gh_manager",
  "building_manager",
  "owner",
] as const;

function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  const bytes = randomBytes(12);
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return `Res-${out}!`;
}

/**
 * Création d'un compte selon la hiérarchie des pouvoirs.
 * Admin → tous les rôles (toute la résidence) ; Président → Resp. de Groupe,
 * Resp. d'Immeuble, Propriétaire ; Resp. de Groupe → Resp. d'Immeuble et
 * Propriétaire (dans son groupe) ; Resp. d'Immeuble → Propriétaire (son immeuble).
 */
export async function adminCreateUserAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireActiveUser();

  const prenom = String(formData.get("prenom") ?? "").trim();
  const nom = String(formData.get("nom") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const telephone = String(formData.get("telephone") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const gh = Number(formData.get("gh"));
  const immeuble = String(formData.get("immeuble") ?? "").trim().toUpperCase();
  const appartement = String(formData.get("appartement") ?? "").trim();
  const password = String(formData.get("password") ?? "").trim();

  if (!prenom || !nom || !email) return { error: "Nom, prénom et e-mail sont requis." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Adresse e-mail invalide." };
  if (!ADMIN_ROLE_VALUES.includes(role as (typeof ADMIN_ROLE_VALUES)[number]))
    return { error: "Rôle invalide." };
  if (!Number.isInteger(gh) || gh < 1 || gh > 12)
    return { error: "Groupe d’Habitation invalide." };

  const needsBuilding = role === "building_manager" || role === "owner";
  if (needsBuilding && !buildingsOf(gh).includes(immeuble))
    return { error: `L’immeuble ${immeuble || "?"} n’existe pas dans le GH${gh}.` };

  // ⚠️ Contrôle de hiérarchie : rôle autorisé + périmètre couvert.
  if (!canCreateUser(actor, role, gh, needsBuilding ? immeuble : null))
    return {
      error:
        "Votre niveau de responsabilité ne permet pas de créer ce rôle à cet emplacement.",
    };

  const finalPassword = password.length >= 8 ? password : generatePassword();

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) return { error: "Un compte existe déjà avec cet e-mail." };

  // Un seul Responsable de Groupe / d'Immeuble par poste.
  if (role === "gh_manager") {
    await db
      .update(users)
      .set({ role: "owner" })
      .where(and(eq(users.gh, gh), eq(users.role, "gh_manager")));
  }
  if (role === "building_manager") {
    await db
      .update(users)
      .set({ role: "owner" })
      .where(and(eq(users.gh, gh), eq(users.immeuble, immeuble), eq(users.role, "building_manager")));
  }

  const inserted = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashPassword(finalPassword),
      prenom,
      nom,
      telephone: telephone || null,
      gh,
      immeuble: needsBuilding ? immeuble : role === "gh_manager" ? null : immeuble || null,
      appartement: appartement || null,
      role: role as never,
      status: "actif",
      mustChangePassword: true,
      validatedBy: actor.id,
      validatedAt: new Date(),
    })
    .returning({ id: users.id });

  await logAudit(actor, "admin.create_user", `user#${inserted[0].id}`, `${prenom} ${nom} (${email}) → ${role}${needsBuilding ? ` GH${gh}/${immeuble}` : role === "gh_manager" ? ` GH${gh}` : ""}`,
  );
  await notify(
    [inserted[0].id],
    "role",
    "🎖️ Votre compte a été créé",
    `L’Administrateur a créé votre compte. Mot de passe initial : ${finalPassword}`,
    "/profil",
  );

  revalidatePath("/dashboard");
  return { ok: true, password: finalPassword, email };
}

/** Réinitialisation du mot de passe d'un utilisateur, à sa demande. */
export async function adminResetPasswordAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin")
    return { error: "Réservé à l’Administrateur." };

  const userId = Number(formData.get("userId"));
  const password = String(formData.get("password") ?? "").trim();
  if (!Number.isInteger(userId)) return { error: "Utilisateur invalide." };

  const target = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!target) return { error: "Utilisateur introuvable." };
  if (isImmune(target))
    return { error: "Impossible de modifier le mot de passe d’un Administrateur." };
  if (!canManageUser(actor, target))
    return {
      error:
        "Ce compte est hors de votre périmètre ou d’un rang supérieur ou égal au vôtre.",
    };

  const finalPassword = password.length >= 8 ? password : generatePassword();
  // Par défaut le mot de passe est provisoire ; l'Admin peut le rendre définitif.
  const provisional = String(formData.get("provisional") ?? "") !== "false";
  await db
    .update(users)
    .set({
      passwordHash: hashPassword(finalPassword),
      mustChangePassword: provisional,
    })
    .where(eq(users.id, userId));

  await logAudit(actor, "admin.reset_password", `user#${userId}`, `${target.prenom} ${target.nom} (${target.email})`,
  );
  await notify(
    [userId],
    "password_reset",
    "🔑 Mot de passe réinitialisé",
    `L’Administrateur a défini un nouveau mot de passe pour votre compte.`,
    "/profil",
  );

  revalidatePath("/dashboard");
  return { ok: true, password: finalPassword, email: target.email };
}

/** Verrouillage / déverrouillage global des modifications. */
export async function adminToggleLockAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin")
    return { error: "Réservé à l’Administrateur." };

  const next = String(formData.get("locked")) === "true";
  await db
    .insert(settings)
    .values({ key: "app_locked", value: String(next) })
    .onConflictDoUpdate({ target: settings.key, set: { value: String(next) } });

  await logAudit(actor, next ? "admin.lock_app" : "admin.unlock_app", "settings", next ? "Verrouillage global activé" : "Verrouillage global désactivé",);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Mot de passe provisoire : changement obligatoire à la 1re connexion */
/* ------------------------------------------------------------------ */

export async function changePasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();
  if (!user.mustChangePassword)
    return { error: "Aucun changement de mot de passe n’est requis." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!verifyPassword(current, user.passwordHash))
    return { error: "Mot de passe provisoire incorrect." };
  if (next.length < 8)
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  if (next !== confirm)
    return { error: "Les deux mots de passe ne correspondent pas." };
  if (next === current)
    return { error: "Le nouveau mot de passe doit être différent du provisoire." };

  await db
    .update(users)
    .set({ passwordHash: hashPassword(next), mustChangePassword: false })
    .where(eq(users.id, user.id));

  await logAudit(user, "user.password_changed", `user#${user.id}`, "Changement du mot de passe provisoire à la première connexion",);
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Identité de la résidence (nom + logo) — Administrateur             */
/* ------------------------------------------------------------------ */

export async function updateBrandingAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin")
    return { error: "Réservé à l’Administrateur." };

  const nameFr = String(formData.get("nameFr") ?? "").trim();
  const nameAr = String(formData.get("nameAr") ?? "").trim();
  const logoUrl = String(formData.get("logoUrl") ?? "").trim();
  const removeLogo = String(formData.get("removeLogo") ?? "") === "true";

  if (!nameFr) return { error: "Le nom en français est requis." };
  if (nameFr.length > 120 || (nameAr && nameAr.length > 120))
    return { error: "Le nom ne peut pas dépasser 120 caractères." };

  const isUploadUrl = (u: string) =>
    u.startsWith("/api/uploads/") || 
    u.startsWith("/uploads/") ||
    u.startsWith("https://") ||
    u.startsWith("http://");
  if (logoUrl && !isUploadUrl(logoUrl))
    return { error: "Logo invalide (fichier non reconnu)." };

  await setSetting("residence_name_fr", nameFr);
  await setSetting("residence_name_ar", nameAr || nameFr);
  if (removeLogo) await setSetting("logo_url", null);
  else if (logoUrl) await setSetting("logo_url", logoUrl);

  await logAudit(actor, "admin.update_branding", "settings", `nom FR="${nameFr}" / AR="${nameAr || nameFr}"${removeLogo ? " · logo supprimé" : logoUrl ? ` · logo=${logoUrl}` : ""}`,);

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Lève l'obligation de changement de mot de passe (dépannage Admin). */
export async function adminUnlockPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin")
    return { error: "Réservé à l’Administrateur." };

  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId)) return { error: "Utilisateur invalide." };

  const target = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (!target) return { error: "Utilisateur introuvable." };

  await db
    .update(users)
    .set({ mustChangePassword: false })
    .where(eq(users.id, userId));

  await logAudit(actor, "admin.unlock_password", `user#${userId}`, `${target.prenom} ${target.nom} (${target.email}) — obligation de changement levée`,
  );
  await notify(
    [userId],
    "password_reset",
    "🔑 Accès rétabli",
    "L’Administrateur a rétabli l’accès à votre compte. Vous pouvez vous connecter normalement.",
    "/profil",
  );

  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Administration : archivage et suppression                           */
/* ------------------------------------------------------------------ */

function parseIntList(raw: FormDataEntryValue | null): number[] {
  if (raw === null) return [];
  const value = typeof raw === "string" ? raw : "";
  return value
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

export type ArchiveResultState = ActionState & { archiveId?: number };

/** Archive un utilisateur (ZIP de toutes ses données), sans le supprimer. */
export async function adminArchiveUserAction(
  _prev: ArchiveResultState,
  formData: FormData,
): Promise<ArchiveResultState> {
  const actor = await requireActiveUser();

  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId)) return { error: "Utilisateur invalide." };
  const target = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!target) return { error: "Utilisateur introuvable." };
  if (!canManageUser(actor, target))
    return { error: "Ce compte est hors de votre périmètre de gestion." };

  const built = await buildUserArchive(target, actor);
  await logAudit(actor, "admin.archive_user", `user#${userId}`, built.label);
  revalidatePath("/dashboard");
  return { ok: true, archiveId: undefined };
}

/** Archive puis supprime un utilisateur (ou plusieurs). */
export async function adminDeleteUsersAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();

  const single = Number(formData.get("userId"));
  const ids = Number.isInteger(single) && single > 0 ? [single] : parseIntList(formData.get("userIds"));
  if (ids.length === 0) return { error: "Aucun compte sélectionné." };

  const targets = await db.select().from(users).where(inArray(users.id, ids));
  if (targets.length === 0) return { error: "Compte(s) introuvable(s)." };

  if (targets.some((t) => t.id === actor.id))
    return { error: "Vous ne pouvez pas supprimer votre propre compte." };

  // ⚠️ Contrôle de hiérarchie : chaque cible doit être dans le périmètre de
  // l'acteur et d'un rang strictement inférieur. L'Administrateur est immuable.
  const forbidden = targets.filter((t) => !canManageUser(actor, t));
  if (forbidden.length > 0) {
    return {
      error:
        forbidden.length === 1
          ? `Vous n’avez pas le droit de supprimer le compte de ${forbidden[0].prenom} ${forbidden[0].nom} (rang supérieur ou égal, hors de votre périmètre, ou compte Administrateur protégé).`
          : `${forbidden.length} compte(s) hors de votre périmètre de suppression.`,
    };
  }

  const wantsArchive = String(formData.get("archive") ?? "") !== "false";

  if (wantsArchive) {
    for (const target of targets) {
      await buildUserArchive(target, actor);
    }
  }

  const count = await deleteUserCascade(targets.map((t) => t.id));
  await logAudit(actor, "admin.delete_users", "user", `${count} compte(s) supprimé(s) : ${targets
      .map((t) => `${t.prenom} ${t.nom} (${t.email})`)
      .join(", ")}${wantsArchive ? " — archive créée avant suppression" : ""}`,
  );
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { ok: true };
}

/** Supprime une publication (avec ses commentaires, votes et signalements). */
export async function adminDeletePublicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin") return { error: "Réservé à l’Administrateur." };

  const pubId = Number(formData.get("pubId"));
  if (!Number.isInteger(pubId)) return { error: "Publication invalide." };
  const pub = (await db.select().from(publications).where(eq(publications.id, pubId)).limit(1))[0];
  if (!pub) return { error: "Publication introuvable." };

  const wantsArchive = String(formData.get("archive") ?? "") !== "false";
  if (wantsArchive) await buildPublicationArchive(pubId, actor);

  await db.delete(publications).where(eq(publications.id, pubId));
  await logAudit(actor, "admin.delete_publication", `publication#${pubId}`, `« ${pub.titre} »${wantsArchive ? " — archivée avant suppression" : ""}`,);
  revalidatePath("/dashboard");
  revalidatePath("/feed");
  return { ok: true };
}

/** Archive une publication signalée/bloquée sans la supprimer. */
export async function adminArchivePublicationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin") return { error: "Réservé à l’Administrateur." };
  const pubId = Number(formData.get("pubId"));
  if (!Number.isInteger(pubId)) return { error: "Publication invalide." };
  const built = await buildPublicationArchive(pubId, actor);
  if (!built) return { error: "Publication introuvable." };
  await logAudit(actor, "admin.archive_publication", `publication#${pubId}`, built.label);
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Supprime un commentaire signalé/bloqué. */
export async function adminDeleteCommentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin") return { error: "Réservé à l’Administrateur." };

  const commentId = Number(formData.get("commentId"));
  if (!Number.isInteger(commentId)) return { error: "Commentaire invalide." };
  const comment = (
    await db.select().from(comments).where(eq(comments.id, commentId)).limit(1)
  )[0];
  if (!comment) return { error: "Commentaire introuvable." };

  const pubId = comment.publicationId;
  await db.delete(comments).where(eq(comments.id, commentId));
  await logAudit(actor, "admin.delete_comment", `comment#${commentId}`, `Commentaire de la publication #${pubId} : « ${comment.contenu.slice(0, 80)} »`,
  );
  revalidatePath(`/publications/${pubId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Création de comptes PAR LOT                                        */
/*                                                                    */
/* ⚠️ Règle : après TOUTE création (unitaire ou par lot), le changement */
/* de mot de passe est OBLIGATOIRE à la première connexion.            */
/* ------------------------------------------------------------------ */

export type BatchCreateState = ActionState & {
  created?: { email: string; password: string; label: string }[];
  failed?: { line: string; reason: string }[];
};

type ParsedLine = { prenom: string; nom: string; email: string; telephone: string | null };

/** Analyse une ligne au format « prenom ; nom ; email [; telephone] ». */
function parseLine(raw: string): ParsedLine | null {
  const parts = raw
    .split(/[;,\t|]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  if (parts.length < 3) return null;
  const [prenom, nom, email, telephone] = parts;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
  return { prenom, nom, email: email.toLowerCase(), telephone: telephone ?? null };
}

export async function adminBatchCreateUsersAction(
  _prev: BatchCreateState,
  formData: FormData,
): Promise<BatchCreateState> {
  const actor = await requireActiveUser();

  const role = String(formData.get("role") ?? "");
  const gh = Number(formData.get("gh"));
  const immeuble = String(formData.get("immeuble") ?? "").trim().toUpperCase();
  const raw = String(formData.get("lines") ?? "");
  const explicitPassword = String(formData.get("password") ?? "").trim();

  if (!["president", "gh_manager", "building_manager", "owner"].includes(role))
    return { error: "Rôle invalide." };
  if (!Number.isInteger(gh) || gh < 1 || gh > 12)
    return { error: "Groupe d’Habitation invalide." };

  const needsBuilding = role === "building_manager" || role === "owner";
  if (needsBuilding && !buildingsOf(gh).includes(immeuble))
    return { error: `L’immeuble ${immeuble || "?"} n’existe pas dans le GH${gh}.` };

  // ⚠️ Contrôle de hiérarchie identique à la création unitaire.
  if (!canCreateUser(actor, role, gh, needsBuilding ? immeuble : null))
    return {
      error:
        "Votre niveau de responsabilité ne permet pas de créer ce rôle à cet emplacement.",
    };

  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0)
    return { error: "Veuillez saisir au moins une ligne (prenom ; nom ; email)." };
  if (lines.length > 100)
    return { error: "Maximum 100 comptes par lot." };

  const created: { email: string; password: string; label: string }[] = [];
  const failed: { line: string; reason: string }[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);
    if (!parsed) {
      failed.push({
        line,
        reason: "Format invalide (attendu : prenom ; nom ; email [; téléphone])",
      });
      continue;
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, parsed.email))
      .limit(1);
    if (existing.length > 0) {
      failed.push({ line, reason: "Un compte existe déjà avec cet e-mail" });
      continue;
    }

    // Mot de passe : fourni (identique pour le lot) ou généré individuellement.
    const password = explicitPassword.length >= 8 ? explicitPassword : generatePassword();

    try {
      // Un seul titulaire par poste : rétrograde l'ancien responsable.
      if (role === "gh_manager") {
        await db
          .update(users)
          .set({ role: "owner" })
          .where(and(eq(users.gh, gh), eq(users.role, "gh_manager")));
      }
      if (role === "building_manager") {
        await db
          .update(users)
          .set({ role: "owner" })
          .where(
            and(
              eq(users.gh, gh),
              eq(users.immeuble, immeuble),
              eq(users.role, "building_manager"),
            ),
          );
      }

      const inserted = await db
        .insert(users)
        .values({
          email: parsed.email,
          passwordHash: hashPassword(password),
          prenom: parsed.prenom,
          nom: parsed.nom,
          telephone: parsed.telephone,
          gh,
          immeuble: needsBuilding ? immeuble : role === "gh_manager" ? null : immeuble || null,
          appartement: null,
          role: role as never,
          status: "actif",
          // ⚠️ RÈGLE : changement de mot de passe OBLIGATOIRE à la première connexion.
          mustChangePassword: true,
          validatedBy: actor.id,
          validatedAt: new Date(),
        })
        .returning({ id: users.id });

      await notify(
        [inserted[0].id],
        "role",
        "🎖️ Votre compte a été créé",
        `Un responsable a créé votre compte. Mot de passe initial : ${password} — vous devrez le changer à votre première connexion.`,
        "/profil",
      );

      created.push({
        email: parsed.email,
        password,
        label: `${parsed.prenom} ${parsed.nom}`,
      });
    } catch (e) {
      failed.push({
        line,
        reason: e instanceof Error ? e.message : "Erreur inattendue",
      });
    }
  }

  if (created.length > 0) {
    await logAudit(actor, "admin.batch_create_users", "user", `${created.length} compte(s) créé(s) en lot — rôle=${role}, GH${gh}${needsBuilding ? `/${immeuble}` : ""} — mot de passe provisoire imposé. Échecs : ${failed.length}`,
    );
  }

  revalidatePath("/dashboard");
  return {
    ok: created.length > 0,
    error: created.length === 0 ? "Aucun compte n’a pu être créé." : undefined,
    created,
    failed,
  };
}

/* ------------------------------------------------------------------ */
/* Réglages : poids de voix + types de publication (Administrateur)    */
/* ------------------------------------------------------------------ */

export async function updateVoteWeightsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin")
    return { error: "Réservé à l’Administrateur." };

  const read = (name: string): number | null => {
    const raw = String(formData.get(name) ?? "").trim();
    if (raw === "") return null;
    const v = Number(raw);
    if (!Number.isInteger(v) || v < 0 || v > 100) return null;
    return v;
  };

  const entries: { key: string; value: number }[] = [];
  const roles: { field: string; key: string }[] = [
    { field: "w_president", key: "president" },
    { field: "w_gh_manager", key: "gh_manager" },
    { field: "w_building_manager", key: "building_manager" },
    { field: "w_owner", key: "owner" },
    { field: "w_admin", key: "admin" },
  ];

  for (const r of roles) {
    const v = read(r.field);
    if (v === null)
      return {
        error: `Poids invalide pour « ${r.key} » : saisissez un entier entre 0 et 100.`,
      };
    entries.push({ key: `vote_weight_${r.key}`, value: v });
  }

  // Garde-fou : au moins un votant doit avoir du poids pour valider les scrutins.
  const scrutinTotal =
    entries.find((e) => e.key === "vote_weight_president")!.value +
    entries.find((e) => e.key === "vote_weight_gh_manager")!.value;
  if (scrutinTotal <= 0)
    return {
      error:
        "Le Président et le Responsable de Groupe ne peuvent pas avoir tous deux un poids de 0 : aucun scrutin de résidence ne pourrait être validé.",
    };

  for (const e of entries) await setSetting(e.key, String(e.value));

  await logAudit(actor, "admin.update_vote_weights", "settings", entries.map((e) => `${e.key}=${e.value}`).join(", "),
  );
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function updatePubTypesAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireActiveUser();
  if (actor.role !== "admin")
    return { error: "Réservé à l’Administrateur." };

  const types: { field: string; key: string }[] = [
    { field: "t_texte", key: "texte" },
    { field: "t_fichier", key: "fichier" },
    { field: "t_tache_evenement", key: "tache_evenement" },
    { field: "t_sondage", key: "sondage" },
  ];

  for (const t of types) {
    const enabled = String(formData.get(t.field) ?? "") === "on";
    await setSetting(`pub_type_${t.key}`, enabled ? "true" : "false");
  }

  await logAudit(actor, "admin.update_pub_types", "settings", types
      .map((t) => `${t.key}=${String(formData.get(t.field) ?? "") === "on"}`)
      .join(", "),
  );
  revalidatePath("/dashboard");
  revalidatePath("/publications/nouvelle");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Mot de passe de l'Administrateur (changement immédiat)              */
/* ------------------------------------------------------------------ */

export async function adminChangeOwnPasswordAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const actor = await requireUser();

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("newPassword") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!verifyPassword(current, actor.passwordHash))
    return { error: "Mot de passe actuel incorrect." };
  if (next.length < 8)
    return { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  if (next !== confirm)
    return { error: "Les deux mots de passe ne correspondent pas." };
  if (next === current)
    return { error: "Le nouveau mot de passe doit être différent de l’actuel." };

  await db
    .update(users)
    .set({ passwordHash: hashPassword(next), mustChangePassword: false })
    .where(eq(users.id, actor.id));

  await logAudit(actor, "user.password_changed", `user#${actor.id}`, "Changement du mot de passe depuis le tableau de bord",);
  revalidatePath("/dashboard");
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Participation aux sondages (propriétaires inclus)                   */
/* ------------------------------------------------------------------ */

export async function voteInPollAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireActiveUser();
  const pubId = Number(formData.get("pubId"));
  if (!Number.isInteger(pubId)) return { error: "Sondage invalide." };

  // Une seule option (choix unique) ou plusieurs (choix multiple).
  const raw = formData.getAll("optionIndex").map((v) => Number(v));
  if (raw.length === 0 || raw.some((v) => !Number.isInteger(v)))
    return { error: "Sélectionnez au moins une option." };

  try {
    await castPollVote(user, pubId, raw);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Vote impossible." };
  }

  revalidatePath(`/publications/${pubId}`);
  revalidatePath("/feed");
  return { ok: true };
}

/** Ajoute / retire une option de sondage dans le formulaire de création. */
export async function parsePollOptions(formData: FormData): Promise<{
  options: string[];
  multiple: boolean;
  endsAt: Date | null;
}> {
  const options = formData
    .getAll("pollOption")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);
  const multiple = String(formData.get("pollMultiple") ?? "") === "on";
  const endsRaw = String(formData.get("pollEndsAt") ?? "").trim();
  const endsAt = endsRaw ? new Date(endsRaw) : null;
  return { options, multiple, endsAt };
}
