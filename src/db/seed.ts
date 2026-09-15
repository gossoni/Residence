import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  adminAudit,
  comments,
  notifications,
  publications,
  reports,
  settings,
  users,
  votes,
} from "./schema";
import { hashPassword } from "../lib/password";
import { GH_BUILDINGS, GH_NUMBERS } from "../lib/structure";
import { ensureAdminSchema } from "./ensure";

const PASSWORD = "Residence2025!";

async function main() {
  // IMPORTANT : répare d'abord le schéma (valeur d'enum `admin` + table
  // `audit_log`). Sans cela, l'INSERT ci-dessous échoue sur une base créée
  // avant l'ajout du rôle Administrateur, et le TRUNCATE aurait déjà vidé
  // les tables → base vide → « Identifiants invalides » à la connexion.
  console.log("🔧 Vérification du schéma (rôle admin + journal d'audit)…");
  await ensureAdminSchema();
  console.log("   ✔ Schéma à jour.");

  console.log("🗑️  Nettoyage de la base…");
  await db.execute(
    sql`TRUNCATE TABLE users, publications, comments, votes, reports, notifications, settings, sessions RESTART IDENTITY CASCADE`,
  );

  const hash = hashPassword(PASSWORD);
  const now = new Date();
  const insertUser = (
    email: string,
    prenom: string,
    nom: string,
    gh: number,
    immeuble: string | null,
    appartement: string | null,
    role: "admin" | "president" | "gh_manager" | "building_manager" | "owner",
    status: "provisoire" | "actif" | "bloque",
    telephone?: string,
  ) => ({
    email,
    passwordHash: hash,
    prenom,
    nom,
    telephone:
      telephone ?? `+33 6 ${String(10 + gh).padStart(2, "0")} ${String(
        10 + (immeuble ? immeuble.charCodeAt(0) - 64 : 1),
      ).padStart(2, "0")} 00 00`,
    gh,
    immeuble,
    appartement,
    role,
    status,
    validatedAt: status === "actif" ? now : null,
  });

  /* ---------- 1. Comptes de gestion ------------------------------------ */
  const usersToInsert = [
    // Administrateur (contrôle total de l'application et initialisation des comptes)
    insertUser(
      "admin@residence.app",
      "Système",
      "Administrateur",
      1,
      null,
      null,
      "admin",
      "actif",
    ),
    // Président
    insertUser("president@residence.app", "Jean", "Martin", 1, "A", "P1", "president", "actif"),
    // Responsables de Groupe (12)
    ...GH_NUMBERS.map((gh) =>
      insertUser(`gh${gh}@residence.app`, `Resp`, `GH${gh}`, gh, null, null, "gh_manager", "actif"),
    ),
    // Responsables d'Immeuble (tous les immeubles)
    ...GH_NUMBERS.flatMap((gh) =>
      GH_BUILDINGS[gh].map((b) =>
        insertUser(
          `gh${gh}-${b.toLowerCase()}@residence.app`,
          `Gestion`,
          `GH${gh}${b}`,
          gh,
          b,
          null,
          "building_manager",
          "actif",
        ),
      ),
    ),
    // Propriétaires de démonstration
    insertUser("proprietaire@residence.app", "Claire", "Dubois", 1, "A", "12", "owner", "actif"),
    insertUser("secondaire@residence.app", "Paul", "Nguyen", 3, "C", "8", "owner", "actif"),
    insertUser("nouveau@residence.app", "Sarah", "Benali", 2, "B", "5", "owner", "provisoire", "+33 7 00 11 22 33"),
    insertUser("recent@residence.app", "Marc", "Lefèvre", 12, "G", "3", "owner", "provisoire", "+33 6 99 88 77 66"),
    insertUser("bloque@residence.app", "Éric", "Morel", 1, "C", "21", "owner", "bloque"),
  ];
  const inserted = await db
    .insert(users)
    .values(usersToInsert)
    .returning({ id: users.id, email: users.email, role: users.role, gh: users.gh, immeuble: users.immeuble });
  console.log(`👥 ${inserted.length} comptes insérés`);

  const byEmail = new Map(inserted.map((u) => [u.email, u]));
  const id = (email: string) => byEmail.get(email)!.id;
  const presidentId = id("president@residence.app");
  const adminId = id("admin@residence.app");

  /* ---------- 2. Publications ------------------------------------------- */
  const threeDaysAgo = new Date(now.getTime() - 3 * 86400_000);
  const yesterday = new Date(now.getTime() - 86400_000);
  const deadline48 = new Date(now.getTime() + 48 * 3600_000);
  const futureEvent = new Date(now.getTime() + 21 * 86400_000);

  const pubs = [
    {
      authorId: presidentId,
      type: "texte" as const,
      titre: "Compte-rendu de l’assemblée générale annuelle",
      contenu:
        "L’assemblée générale du 12 janvier s’est tenue avec 61 % de quorum.\n\nDécisions adoptées :\n✅ Budget prévisionnel 2026 voté\n✅ Réfection de l’éclairage des parties communes\n✅ Nouveau prestataire d’entretien des espaces verts\n\nLe procès-verbal complet est consultable en mairie de quartier et sur demande auprès du conseil syndical.",
      scope: "residence" as const,
      gh: null,
      immeuble: null,
      status: "publiee" as const,
      createdAt: threeDaysAgo,
      publishedAt: threeDaysAgo,
      commentCount: 2,
    },
    {
      authorId: presidentId,
      type: "tache_evenement" as const,
      titre: "Réunion du conseil syndical — ordre du jour",
      contenu:
        "Prochaine réunion du conseil syndical.\n\nOrdre du jour :\n• Devis ascenseurs GH3 & GH6\n• Résultats du vote « travaux toitures »\n• Questions diverses\n\nVotre présence est attendue. Merci de confirmer.",
      scope: "residence" as const,
      gh: null,
      immeuble: null,
      eventAt: futureEvent,
      status: "publiee" as const,
      createdAt: yesterday,
      publishedAt: yesterday,
    },
    {
      authorId: id("gh2@residence.app"),
      type: "texte" as const,
      titre: "Travaux de réfection des toitures — demande de validation",
      contenu:
        "Le devis de réfection des toitures des immeubles du GH2 s’élève à 48 500 € (entreprise BatiRénov, garantie décennale).\n\nCette publication est soumise au vote des Responsables de Groupe et du Président (majorité absolue de 8 voix sur 14). Sans rejet majoritaire sous 48 h, elle sera validée automatiquement.",
      scope: "residence" as const,
      gh: null,
      immeuble: null,
      status: "en_validation" as const,
      totalVoix: 14,
      majorite: 8,
      deadline: deadline48,
      createdAt: yesterday,
    },
    {
      authorId: id("gh1@residence.app"),
      type: "fichier" as const,
      titre: "Rappel du règlement intérieur du GH1",
      contenu:
        "Merci de respecter les horaires de silence (22 h – 7 h) et le tri sélectif. Le règlement intérieur actualisé est joint à cette publication (diffusion automatique pour le GH1).",
      scope: "groupe" as const,
      gh: 1,
      immeuble: null,
      status: "publiee" as const,
      createdAt: yesterday,
      publishedAt: yesterday,
    },
    {
      authorId: id("gh1-b@residence.app"),
      type: "tache_evenement" as const,
      titre: "Nettoyage des caves — Immeubles du GH1",
      contenu:
        "Opération de désencombrement des caves organisée par les responsables d’immeuble du GH1.\n\n🗓️ Samedi prochain à 9 h\n📍 Hall des immeubles A à E\n\nCette opération est soumise au vote des responsables du GH1 (majorité de 4 voix sur 7).",
      scope: "groupe" as const,
      gh: 1,
      immeuble: null,
      eventAt: new Date(now.getTime() + 6 * 86400_000),
      status: "en_validation" as const,
      totalVoix: 7,
      majorite: 4,
      deadline: deadline48,
      createdAt: yesterday,
    },
    {
      authorId: id("gh1-a@residence.app"),
      type: "texte" as const,
      titre: "Coupure d’eau — Immeuble A",
      contenu:
        "Une intervention urgente sur le réseau d’eau de l’Immeuble A est prévue mercredi de 9 h à 12 h.\n\nMerci de prévoir des réserves d’eau. La coupure sera levée dès la fin des travaux.",
      scope: "immeuble" as const,
      gh: 1,
      immeuble: "A",
      status: "publiee" as const,
      createdAt: threeDaysAgo,
      publishedAt: threeDaysAgo,
    },
  ];

  const pubRows = await db
    .insert(publications)
    .values(pubs)
    .returning({ id: publications.id, titre: publications.titre });
  console.log(`📄 ${pubRows.length} publications insérées`);

  const pubByTitle = new Map(pubRows.map((p) => [p.titre, p.id]));
  const p1 = pubByTitle.get("Compte-rendu de l’assemblée générale annuelle")!;
  const p2 = pubByTitle.get("Travaux de réfection des toitures — demande de validation")!;
  const p3 = pubByTitle.get("Coupure d’eau — Immeuble A")!;
  const p4 = pubByTitle.get("Nettoyage des caves — Immeubles du GH1")!;

  /* ---------- 3. Votes de démonstration -------------------------------- */
  // P2 (résidence, 14 voix, majorité 8) : 4 GH managers "oui" (1 voix) + Président "oui" (2 voix) + 1 GH "non"
  const voteSeeds = [
    { pubId: p2, email: "gh3@residence.app", choix: "oui" as const, poids: 1 },
    { pubId: p2, email: "gh4@residence.app", choix: "oui" as const, poids: 1 },
    { pubId: p2, email: "gh5@residence.app", choix: "oui" as const, poids: 1 },
    { pubId: p2, email: "gh6@residence.app", choix: "oui" as const, poids: 1 },
    { pubId: p2, email: "president@residence.app", choix: "oui" as const, poids: 2 },
    { pubId: p2, email: "gh7@residence.app", choix: "non" as const, poids: 1 },
    // P4 (groupe GH1, 7 voix, majorité 4) : GH1-A oui + Resp GH1 oui (2 voix) → 3/4 en attente
    { pubId: p4, email: "gh1-a@residence.app", choix: "oui" as const, poids: 1 },
    { pubId: p4, email: "gh1@residence.app", choix: "oui" as const, poids: 2 },
  ];
  await db.insert(votes).values(
    voteSeeds.map((v) => ({
      publicationId: v.pubId,
      userId: id(v.email),
      choix: v.choix,
      poids: v.poids,
    })),
  );
  await db
    .update(publications)
    .set({ votesPour: 6, votesContre: 1 })
    .where(sql`id = ${p2}`);
  await db
    .update(publications)
    .set({ votesPour: 3, votesContre: 0 })
    .where(sql`id = ${p4}`);
  console.log(`🗳️ ${voteSeeds.length} votes insérés`);

  /* ---------- 4. Commentaires ------------------------------------------- */
  const commentsSeed = [
    { pubId: p1, email: "proprietaire@residence.app", contenu: "Merci pour ce compte-rendu très clair ! 👍" },
    { pubId: p1, email: "gh1@residence.app", contenu: "Le point sur les ascenseurs sera ajouté au prochain PV." },
    { pubId: p3, email: "proprietaire@residence.app", contenu: "Merci pour l’information, c’est noté." },
  ];
  await db.insert(comments).values(
    commentsSeed.map((c) => ({
      publicationId: c.pubId,
      authorId: id(c.email),
      contenu: c.contenu,
    })),
  );
  console.log(`💬 ${commentsSeed.length} commentaires insérés`);

  /* ---------- 5. Signalements ------------------------------------------- */
  const reportsSeed = [
    { pubId: p3, email: "secondaire@residence.app", reason: "hors_sujet — information déjà publiée en séance", status: "ouvert" as const },
    { pubId: p1, email: "secondaire@residence.app", reason: "autre — demande de précision sur le budget", status: "ouvert" as const },
    { pubId: p1, email: "proprietaire@residence.app", reason: "spam — contenu traité", status: "traite" as const },
  ];
  await db.insert(reports).values(
    reportsSeed.map((r) => ({
      publicationId: r.pubId,
      commentId: null,
      reporterId: id(r.email),
      reason: r.reason,
      status: r.status,
      resolvedAt: r.status === "traite" ? now : null,
    })),
  );
  console.log(`🚩 ${reportsSeed.length} signalements insérés`);

  /* ---------- 6. Notifications ------------------------------------------ */
  const notifSeed = [
    { email: "president@residence.app", type: "vote_requis", titre: "🗳️ Votre vote est requis", body: "La publication « Travaux de réfection des toitures — demande de validation » attend votre vote.", link: `/publications/${p2}` },
    { email: "gh3@residence.app", type: "vote_requis", titre: "🗳️ Votre vote est requis", body: "La publication « Travaux de réfection des toitures — demande de validation » attend votre vote.", link: `/publications/${p2}` },
    { email: "gh1-a@residence.app", type: "vote_requis", titre: "🗳️ Votre vote est requis", body: "La publication « Nettoyage des caves — Immeubles du GH1 » attend votre validation.", link: `/publications/${p4}` },
    { email: "president@residence.app", type: "signalement", titre: "🚩 Nouveau signalement", body: "La publication « Coupure d’eau — Immeuble A » a été signalée.", link: `/publications/${p3}` },
    { email: "proprietaire@residence.app", type: "compte_valide", titre: "✅ Compte validé", body: "Votre compte propriétaire est actif. Bienvenue dans la résidence !", link: "/feed" },
  ];
  await db.insert(notifications).values(
    notifSeed.map((n) => ({
      userId: id(n.email),
      type: n.type,
      titre: n.titre,
      body: n.body,
      link: n.link,
    })),
  );
  console.log(`🔔 ${notifSeed.length} notifications insérées`);

  /* ---------- 7. Paramètres --------------------------------------------- */
  await db.insert(settings).values([
    { key: "validation_delay_hours", value: "48" },
    { key: "report_threshold", value: "5" },
  ]);

  // Mise à jour des comptes validés (cohérence)
  await db
    .update(users)
    .set({ validatedBy: presidentId, validatedAt: now })
    .where(sql`status = 'actif' and role <> 'admin'`);
  await db
    .update(users)
    .set({ validatedBy: adminId, validatedAt: now })
    .where(sql`role = 'admin'`);

  // Trace d'audit initiale (table admin_audit)
  await db.insert(adminAudit).values({
    actorId: adminId,
    action: "admin.init_demo",
    target: "settings",
    details: "Initialisation du jeu de démonstration",
  });

  console.log("✅ Base de démonstration prête !");
  console.log(`   Mot de passe commun : ${PASSWORD}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
