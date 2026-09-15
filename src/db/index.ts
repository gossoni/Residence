import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

/**
 * Détermine si la cible est une base distante (Supabase, Neon, Railway…).
 * Ces hébergeurs exigent TLS et se comportent mal avec des connexions
 * longuement inactives.
 */
function isRemote(url: string): boolean {
  return (
    /supabase\.(co|com)/i.test(url) ||
    /neon\.tech/i.test(url) ||
    /railway\.app/i.test(url) ||
    /render\.com/i.test(url) ||
    /amazonaws\.com/i.test(url) ||
    /sslmode=require/i.test(url)
  );
}

const remote = isRemote(databaseUrl);

/**
 * Configuration du pool, adaptée à la cible :
 *  - LOCAL : pool confortable, connexions longue durée.
 *  - DISTANT (Supabase…) : SSL, connexions courtes et surveillées, car le
 *    « pooler » partagé coupe les connexions inactives (d'où les erreurs
 *    « Connection terminated unexpectedly » / « ENOTFOUND » observées).
 */
const poolConfig: PoolConfig = {
  connectionString: databaseUrl,

  // TLS requis par Supabase et la plupart des hébergeurs managés.
  ...(remote
    ? { ssl: { rejectUnauthorized: false } }
    : {}),

  // Taille du pool : Supabase limite les connexions concurrentes.
  max: remote ? 5 : 10,

  // Une connexion inutilisée est fermée côté serveur après ce délai.
  idleTimeoutMillis: remote ? 20_000 : 60_000,

  // Durée maximale d'une tentative de connexion avant échec explicite.
  connectionTimeoutMillis: remote ? 15_000 : 10_000,

  // Ne pas maintenir de TCP keep-alive agressif chez les poolers partagés.
  keepAlive: !remote,
  keepAliveInitialDelayMillis: remote ? 0 : 10_000,
};

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

export const pool = globalForDb.__arenaNextJsPostgresqlPool ?? new Pool(poolConfig);

// Journalise la cause réelle des pertes de connexion (au lieu d'un crash
// silencieux du process Node), avec le nom d'hôte pour aider au diagnostic.
pool.on("error", (err: Error & { code?: string; hostname?: string }) => {
  const target = remote ? "base distante (Supabase)" : "base locale";
  if (err.code === "ENOTFOUND" || err.hostname) {
    console.error(
      `[db] Hôte injoignable (${err.hostname ?? "?"}) — vérifiez votre connexion réseau, ` +
        `le VPN ou l'URL ${target}.`,
    );
  } else {
    console.error(
      `[db] Connexion perdue avec la ${target} :`,
      err.code ? `${err.code} —` : "",
      err.message,
    );
  }
});

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool);

/** Indique si la base cible est distante (utile pour les messages d'erreur). */
export const isRemoteDatabase = remote;
