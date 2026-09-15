import "dotenv/config";
import { Pool } from "pg";

/**
 * Script de diagnostic autonome (n'utilise PAS Drizzle) pour identifier
 * précisément pourquoi les requêtes échouent en local.
 *
 * Utilisation : npx tsx src/db/check.ts
 */

const RESET = "\x1b[0m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";

function ok(msg: string) {
  console.log(`${GREEN}✔${RESET} ${msg}`);
}
function fail(msg: string) {
  console.log(`${RED}✘${RESET} ${msg}`);
}
function info(msg: string) {
  console.log(`${CYAN}ℹ${RESET} ${msg}`);
}
function warn(msg: string) {
  console.log(`${YELLOW}⚠${RESET} ${msg}`);
}

async function main() {
  console.log("\n=== Diagnostic base de données — Ma Résidence ===\n");

  const url = process.env.DATABASE_URL;
  if (!url) {
    fail("La variable DATABASE_URL est introuvable (vérifiez votre fichier .env).");
    process.exit(1);
  }
  info(`DATABASE_URL détectée : ${url.replace(/:[^:@]+@/, ":********@")}`);

  const pool = new Pool({ connectionString: url });

  // 1. Connexion réseau + authentification
  let client;
  try {
    client = await pool.connect();
    ok("Connexion à PostgreSQL réussie (réseau + authentification OK).");
  } catch (e) {
    fail("Impossible de se connecter à PostgreSQL.");
    console.error(e);
    console.log(
      `\n${YELLOW}Pistes :${RESET}\n` +
        "  - Le service PostgreSQL est-il démarré ? (pg_isready / docker ps)\n" +
        "  - L'hôte/port/utilisateur/mot de passe dans DATABASE_URL sont-ils corrects ?\n" +
        "  - Si votre mot de passe contient des caractères spéciaux (@ : / ?), encodez-les (URL-encode).\n",
    );
    await pool.end();
    process.exit(1);
  }

  // 2. La base cible existe-t-elle et est-elle accessible ?
  try {
    const { rows } = await client.query("select current_database() as db");
    ok(`Connecté à la base : ${rows[0].db}`);
  } catch (e) {
    fail("Impossible de déterminer la base courante.");
    console.error(e);
  }

  // 3. La table users existe-t-elle ?
  const tablesToCheck = [
    "users",
    "publications",
    "votes",
    "comments",
    "reports",
    "notifications",
    "settings",
    "sessions",
  ];
  const { rows: existingTables } = await client.query(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  );
  const existingNames = new Set(existingTables.map((r) => r.table_name as string));

  let allTablesPresent = true;
  for (const t of tablesToCheck) {
    if (existingNames.has(t)) {
      ok(`Table "${t}" présente.`);
    } else {
      fail(`Table "${t}" MANQUANTE.`);
      allTablesPresent = false;
    }
  }

  if (!allTablesPresent) {
    console.log(
      `\n${YELLOW}➡ Le schéma n'est pas (complètement) créé dans cette base.${RESET}\n` +
        `   Lancez : ${CYAN}npx drizzle-kit push${RESET}\n` +
        `   Si cette commande échoue avec une erreur "type ... already exists",\n` +
        `   consultez la section "Réinitialisation complète" du README.\n`,
    );
  }

  // 4. Les enums attendus existent-ils (cause fréquente de push cassé) ?
  const { rows: enumRows } = await client.query(
    `select t.typname as name, e.enumlabel as label
     from pg_type t
     join pg_enum e on t.oid = e.enumtypid
     where t.typname in ('user_role','user_status','publication_type','publication_scope','publication_status','vote_choice','report_status')
     order by t.typname, e.enumsortorder`,
  );
  if (enumRows.length === 0) {
    warn("Aucun type enum applicatif trouvé (normal si les tables n'existent pas encore).");
  } else {
    const grouped = new Map<string, string[]>();
    for (const r of enumRows) {
      const arr = grouped.get(r.name) ?? [];
      arr.push(r.label);
      grouped.set(r.name, arr);
    }
    for (const [name, labels] of grouped) {
      ok(`Enum "${name}" : [${labels.join(", ")}]`);
    }
  }

  // 5. Reproduire exactement la requête qui échoue (si la table existe)
  if (existingNames.has("users")) {
    try {
      const { rows } = await client.query(
        `select id, email, role, status from users where email = $1 limit $2`,
        ["gh1-a@residence.app", 1],
      );
      if (rows.length === 0) {
        warn(
          "La table users existe mais l'utilisateur gh1-a@residence.app est introuvable.\n" +
            `  ➡ Lancez : ${CYAN}npx tsx src/db/seed.ts${RESET} pour charger les données de démonstration.`,
        );
      } else {
        ok(`Requête de test réussie : ${JSON.stringify(rows[0])}`);
      }
    } catch (e) {
      fail("La requête de test a échoué avec l'erreur PostgreSQL suivante :");
      console.error(e);
    }
  }

  const { rows: countRows } = existingNames.has("users")
    ? await client.query("select count(*)::int as c from users")
    : { rows: [{ c: 0 }] };
  info(`Nombre total d'utilisateurs en base : ${countRows[0].c}`);

  client.release();
  await pool.end();
  console.log("\n=== Fin du diagnostic ===\n");
}

main().catch((e) => {
  console.error("Erreur inattendue pendant le diagnostic :", e);
  process.exit(1);
});
