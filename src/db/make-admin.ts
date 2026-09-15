import "dotenv/config";
import { ensureAdminAccount, ensureAdminSchema } from "./ensure";
import { pool } from "./index";

/**
 * Initialisation de l'Administrateur — SANS effacer les données existantes.
 *
 * Utilisation :
 *   npx tsx src/db/make-admin.ts
 *   npx tsx src/db/make-admin.ts admin@mondomaine.fr
 *   npx tsx src/db/make-admin.ts admin@mondomaine.fr MonMotDePasse!
 *
 * Effet :
 *   1. répare le schéma (valeur d'enum `admin` + table `audit_log`) si nécessaire ;
 *   2. crée l'Administrateur, ou promeut un compte existant à ce rôle ;
 *   3. (ré)initialise son mot de passe.
 */

async function main() {
  const argEmail = process.argv[2];
  const argPassword = process.argv[3];

  console.log("=== Initialisation de l’Administrateur — Ma Résidence ===\n");

  console.log("1/2 Réparation du schéma (idempotent)…");
  await ensureAdminSchema();
  console.log("   ✔ Rôle `admin` disponible et journal d’audit en place.\n");

  const email = argEmail ?? "admin@residence.app";
  const password = argPassword ?? "Residence2025!";

  if (password.length < 8) {
    console.error("✘ Le mot de passe doit contenir au moins 8 caractères.");
    await pool.end();
    process.exit(1);
  }

  console.log(`2/2 Création / promotion du compte ${email}…`);
  const result = await ensureAdminAccount(email, password);

  console.log(
    result.created
      ? `   ✔ Compte Administrateur créé.`
      : `   ✔ Compte existant promu Administrateur (mot de passe réinitialisé).`,
  );
  console.log(`\n   E-mail        : ${result.email}`);
  console.log(`   Mot de passe  : ${result.password}`);
  console.log(
    `\n⚠️  Changez ce mot de passe dès la première connexion (Mon profil).\n`,
  );
  console.log(
    `Prochaine étape : connectez-vous puis créez le Président et les Responsables\n` +
      `depuis « Tableau de bord → 🛡️ Administration → ➕ Créer un compte ».\n`,
  );

  await pool.end();
}

main().catch((err) => {
  console.error("✘ Échec de l'initialisation :", err);
  process.exit(1);
});
