import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./index";
import { users } from "./schema";
import { verifyPassword } from "../lib/password";

/**
 * Vérifie qu'un compte existe et que son mot de passe est valide.
 * Usage : npx tsx src/db/verify-login.ts [email] [motdepasse]
 */
async function main() {
  const email = (process.argv[2] ?? "admin@residence.app").toLowerCase();
  const password = process.argv[3] ?? "Residence2025!";

  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const u = rows[0];

  if (!u) {
    console.log(`✘ ${email} : COMPTE INTROUVABLE en base → « Identifiants invalides »`);
    console.log("  → Le compte n'a jamais été créé (seed obsolète ?).");
    await pool.end();
    process.exit(1);
  }

  console.log(`✔ Compte trouvé : ${u.email} | rôle=${u.role} | statut=${u.status}`);
  if (u.status === "bloque") {
    console.log("✘ Le compte est BLOQUÉ → la connexion est refusée.");
  }
  const ok = verifyPassword(password, u.passwordHash);
  console.log(
    ok
      ? `✔ Mot de passe « ${password} » : VALIDE → la connexion fonctionnera.`
      : `✘ Mot de passe « ${password} » : INVALIDE (hash différent).`,
  );
  await pool.end();
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("Erreur :", e);
  process.exit(1);
});
