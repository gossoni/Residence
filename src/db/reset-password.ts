import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { users } from "./schema";
import { hashPassword, verifyPassword } from "../lib/password";
import { ensureAdminSchema } from "./ensure";

/**
 * Réinitialisation d'urgence d'un mot de passe — SANS effacer les données.
 *
 * À utiliser quand un compte est devenu inaccessible (par exemple après une
 * réinitialisation dont le mot de passe généré a été perdu, ou parce que le
 * schéma était incomplet au moment de l'opération).
 *
 * Usage :
 *   npx tsx src/db/reset-password.ts gh1@residence.app
 *   npx tsx src/db/reset-password.ts gh1@residence.app NouveauMotDePasse!
 *   npx tsx src/db/reset-password.ts gh1@residence.app NouveauMotDePasse! --final
 *
 * Options :
 *   --final   le mot de passe n'est PAS provisoire (pas de changement obligatoire)
 *   --proviso (défaut) l'utilisateur devra le changer à sa première connexion
 */

async function main() {
  const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const makeFinal = process.argv.includes("--final");

  const email = args[0];
  if (!email) {
    console.error(
      "Usage : npx tsx src/db/reset-password.ts <email> [motDePasse] [--final]",
    );
    await pool.end();
    process.exit(1);
  }

  console.log("=== Réinitialisation de mot de passe — Ma Résidence ===\n");

  // Répare d'abord le schéma : c'est la cause la plus fréquente d'un compte
  // devenu inaccessible (colonne manquante → échec silencieux de l'action).
  console.log("1/3 Réparation du schéma (idempotent)…");
  await ensureAdminSchema();
  console.log("   ✔ Schéma complet (colonne must_change_password incluse).\n");

  const normalized = email.trim().toLowerCase();
  const target = (
    await db.select().from(users).where(eq(users.email, normalized)).limit(1)
  )[0];

  if (!target) {
    console.error(`✘ Aucun compte ne correspond à « ${normalized} ».\n`);
    const suggestions = await db
      .select({ email: users.email, role: users.role })
      .from(users)
      .limit(200);
    const similar = suggestions.filter(
      (u) =>
        u.email.includes(normalized.split("@")[0] ?? "") ||
        u.email.split("@")[0] === normalized.split("@")[0],
    );
    if (similar.length > 0) {
      console.error("Comptes ressemblants :");
      for (const u of similar) console.error(`   - ${u.email} (${u.role})`);
    }
    await pool.end();
    process.exit(1);
  }

  const password = args[1] ?? "Residence2025!";
  if (password.length < 8) {
    console.error("✘ Le mot de passe doit contenir au moins 8 caractères.");
    await pool.end();
    process.exit(1);
  }

  console.log(`2/3 Compte ciblé : ${target.prenom} ${target.nom}`);
  console.log(`   rôle=${target.role} · statut=${target.status}`);
  if (target.status === "bloque") {
    console.log("   → le compte est bloqué ; il sera aussi réactivé.\n");
  }

  const wasSame = verifyPassword(password, target.passwordHash);

  await db
    .update(users)
    .set({
      passwordHash: hashPassword(password),
      mustChangePassword: !makeFinal,
      status: target.status === "bloque" ? "actif" : target.status,
    })
    .where(eq(users.id, target.id));

  console.log("3/3 Mot de passe réinitialisé ✔\n");
  console.log(`   E-mail        : ${normalized}`);
  console.log(`   Mot de passe  : ${password}`);
  console.log(
    makeFinal
      ? `   Mode          : définitif (pas de changement obligatoire)`
      : `   Mode          : provisoire (changement obligatoire à la 1re connexion)`,
  );
  if (wasSame) {
    console.log(
      `\n⚠️  Ce mot de passe était déjà celui du compte : si la connexion échouait,\n` +
        `   la cause était donc le schéma de base (colonne manquante), désormais corrigée.`,
    );
  }
  console.log(
    `\nVérification : npx tsx src/db/verify-login.ts ${normalized} "${password}"\n`,
  );

  await pool.end();
}

main().catch((err) => {
  console.error("✘ Échec :", err);
  process.exit(1);
});
