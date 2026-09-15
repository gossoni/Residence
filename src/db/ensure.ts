import "dotenv/config";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { users } from "./schema";
import { hashPassword } from "../lib/password";

/**
 * Répare le schéma PostgreSQL pour le rôle Administrateur, de façon IDEMPOTENTE.
 *
 * ⚠️ Contexte : `npx drizzle-kit push` ne modifie pas un type enum déjà existant.
 * Sur une base créée avant l'ajout du rôle `admin`, la valeur d'enum manque donc,
 * ce qui fait échouer `seed.ts` (l'INSERT de tous les comptets est atomique) juste
 * après le TRUNCATE → base vide → « Identifiants invalides » à la connexion.
 *
 * Ce module corrige cela sans détruire les données :
 *   1. ajoute la valeur d'enum `admin` si elle est absente ;
 *   2. crée la table `audit_log` si elle est absente ;
 *   3. crée ou promeut le compte Administrateur.
 */
export async function ensureAdminSchema(): Promise<void> {
  // 1. Valeur d'enum (doit être exécutée hors transaction, en autocommit).
  await db.execute(
    sql`ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'admin' BEFORE 'president'`,
  );

  // 2. Table du journal d'audit.
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS audit_log (
      id serial PRIMARY KEY,
      actor_id integer REFERENCES users(id) ON DELETE SET NULL,
      actor_label text,
      action varchar(60) NOT NULL,
      target_type varchar(40),
      target_id integer,
      details text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at)`,
  );

  // 3. Colonne du mot de passe provisoire.
  //    Indispensable : si `drizzle-kit push` a échoué (typiquement à cause de
  //    l'enum), cette colonne manque et la réinitialisation d'un mot de passe
  //    par l'Administrateur échoue silencieusement → compte inaccessible.
  await db.execute(sql`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password boolean
    NOT NULL DEFAULT false
  `);
}

export type EnsureAdminResult = {
  email: string;
  password: string;
  created: boolean;
};

/**
 * Crée le compte Administrateur, ou le promeut/promeut-à-nouveau s'il existe déjà.
 * Retourne le mot de passe final (en clair, à usage unique d'affichage).
 */
export async function ensureAdminAccount(
  email = "admin@residence.app",
  password = "Residence2025!",
): Promise<EnsureAdminResult> {
  await ensureAdminSchema();

  const normalized = email.trim().toLowerCase();
  const existing = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, normalized))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(users)
      .set({
        role: "admin",
        status: "actif",
        passwordHash: hashPassword(password),
        validatedAt: new Date(),
      })
      .where(eq(users.id, existing[0].id));
    return { email: normalized, password, created: false };
  }

  await db.insert(users).values({
    email: normalized,
    passwordHash: hashPassword(password),
    prenom: "Système",
    nom: "Administrateur",
    telephone: null,
    gh: 1,
    immeuble: null,
    appartement: null,
    role: "admin",
    status: "actif",
    validatedAt: new Date(),
  });

  return { email: normalized, password, created: true };
}
