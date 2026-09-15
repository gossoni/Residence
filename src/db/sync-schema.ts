import "dotenv/config";
import { pool } from "./index";

/**
 * Synchronise le schéma de la base avec celui attendu par le code.
 *
 * ⚠️ Pourquoi ce script existe : deux versions du code ont coexisté avec des
 * nomenclatures différentes (`poll_choices` chez Gemini, `poll_options` ici),
 * ce qui provoquait `column "poll_choices" does not exist`. Ce script détecte
 * et répare automatiquement les divergences, SANS perdre de données.
 *
 * Usage : npx tsx src/db/sync-schema.ts [--fix]
 *   sans --fix : diagnostic seul (aucune modification)
 *   avec  --fix : applique les corrections
 */

type ColumnSpec = { table: string; column: string; ddl: string; aliases?: string[] };

/** Colonnes attendues par le code, avec leurs éventuels alias historiques. */
const EXPECTED: ColumnSpec[] = [
  {
    table: "publications",
    column: "poll_options",
    ddl: "ALTER TABLE public.publications ADD COLUMN poll_options jsonb",
    aliases: ["poll_choices"],
  },
  {
    table: "publications",
    column: "poll_multiple",
    ddl:
      "ALTER TABLE public.publications ADD COLUMN poll_multiple boolean NOT NULL DEFAULT false",
    aliases: ["poll_multi"],
  },
  {
    table: "publications",
    column: "poll_ends_at",
    ddl: "ALTER TABLE public.publications ADD COLUMN poll_ends_at timestamptz",
    aliases: ["poll_end_at", "poll_deadline"],
  },
];

/** Tables attendues. */
const EXPECTED_TABLES = [
  "poll_votes",
  "admin_audit",
  "data_archives",
  "archives",
  "audit_log",
  "users",
  "publications",
  "comments",
  "votes",
  "reports",
  "notifications",
  "settings",
  "sessions",
];

async function q<T = { c: string }>(sql: string): Promise<T[]> {
  const r = await pool.query(sql);
  return r.rows as T[];
}

async function main() {
  const fix = process.argv.includes("--fix");
  console.log(
    `\n=== Synchronisation du schéma — Ma Résidence (${fix ? "CORRECTION" : "DIAGNOSTIC"}) ===\n`,
  );

  let issues = 0;

  // ---- 1. Colonnes -------------------------------------------------
  for (const spec of EXPECTED) {
    const cols = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = '${spec.table}' AND column_name IN (
         '${spec.column}', ${(spec.aliases ?? []).map((a) => `'${a}'`).join(", ")}
       )`,
    );
    const names = cols.map((c) => c.column_name);
    const hasTarget = names.includes(spec.column);
    const present = (spec.aliases ?? []).filter((a) => names.includes(a));

    if (hasTarget && present.length === 0) {
      console.log(`  ✔ ${spec.table}.${spec.column}`);
      continue;
    }

    if (!hasTarget && present.length === 0) {
      issues++;
      console.log(`  ✘ ${spec.table}.${spec.column} : ABSENTE`);
      if (fix) {
        await pool.query(spec.ddl);
        console.log(`     → créée`);
      }
      continue;
    }

    if (!hasTarget && present.length > 0) {
      issues++;
      const from = present[0];
      console.log(
        `  ✘ ${spec.table}.${spec.column} : ABSENTE (mais l'alias « ${from} » existe)`,
      );
      if (fix) {
        await pool.query(
          `ALTER TABLE public.${spec.table} RENAME COLUMN ${from} TO ${spec.column}`,
        );
        console.log(`     → « ${from} » renommée en « ${spec.column} » (données conservées)`);
      }
      continue;
    }

    // hasTarget && present.length > 0 → fusionner
    issues++;
    console.log(
      `  ⚠ ${spec.table}.${spec.column} : DOUBLON avec « ${present.join(", ")} »`,
    );
    if (fix) {
      for (const from of present) {
        await pool.query(
          `UPDATE public.${spec.table} SET ${spec.column} = ${from}
           WHERE ${spec.column} IS NULL AND ${from} IS NOT NULL`,
        );
        await pool.query(
          `ALTER TABLE public.${spec.table} DROP COLUMN ${from}`,
        );
        console.log(`     → données de « ${from} » transférées puis colonne supprimée`);
      }
    }
  }

  // ---- 2. Tables ---------------------------------------------------
  const tables = new Set(
    (await q<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    )).map((t) => t.table_name),
  );
  for (const t of EXPECTED_TABLES) {
    if (tables.has(t)) console.log(`  ✔ table ${t}`);
    else {
      // `archives` / `audit_log` sont les anciens noms : informative seulement
      console.log(`  — table ${t} : absente (voir supabase/migration.sql)`);
    }
  }

  // ---- 3. Valeurs d'enum -------------------------------------------
  const enums = await q<{ enumlabel: string }>(
    `SELECT e.enumlabel FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'publication_type'`,
  );
  const labels = enums.map((e) => e.enumlabel);
  for (const need of ["sondage", "texte", "fichier", "tache_evenement"]) {
    if (labels.includes(need)) console.log(`  ✔ enum publication_type.${need}`);
    else {
      issues++;
      console.log(`  ✘ enum publication_type.${need} : ABSENT`);
      if (fix) {
        try {
          await pool.query(
            `ALTER TYPE public.publication_type ADD VALUE IF NOT EXISTS '${need}'`,
          );
          console.log(`     → valeur ajoutée`);
        } catch (e) {
          console.log(`     → ⚠ à ajouter manuellement :`, (e as Error).message);
        }
      }
    }
  }

  const roleEnums = await q<{ enumlabel: string }>(
    `SELECT e.enumlabel FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'user_role'`,
  );
  if (!roleEnums.map((e) => e.enumlabel).includes("admin")) {
    issues++;
    console.log(`  ✘ enum user_role.admin : ABSENT`);
    if (fix) {
      await pool.query(
        `ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'admin' BEFORE 'president'`,
      );
      console.log(`     → valeur ajoutée`);
    }
  } else {
    console.log(`  ✔ enum user_role.admin`);
  }

  console.log(
    `\n${issues === 0 ? "✅ Schéma conforme au code." : `❌ ${issues} divergence(s) détectée(s).`}`,
  );
  if (issues > 0 && !fix) {
    console.log(`   Pour corriger : npx tsx src/db/sync-schema.ts --fix\n`);
  } else if (issues > 0 && fix) {
    console.log(`   Corrections appliquées. Relancez pour vérifier :\n`);
    console.log(`   npx tsx src/db/sync-schema.ts\n`);
  } else {
    console.log(``);
  }

  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error("✘ Échec :", e);
  try { await pool.end(); } catch { /* ignore */ }
  process.exit(1);
});
