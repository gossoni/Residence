"use client";

import { useEffect } from "react";

/**
 * Écran d'erreur global : affiche une aide actionnable plutôt qu'une page
 * blanche ou un message technique incompréhensible.
 *
 * Cas le plus fréquent : le schéma de la base diverge du code (colonne
 * manquante, ex. `poll_choices` vs `poll_options`), ce qui survient lorsque
 * plusieurs versions du projet ont été déployées sur la même base.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] Erreur non gérée :", error);
  }, [error]);

  const raw = error?.message ?? "";
  const isMissingColumn = /does not exist|42703/i.test(raw);
  const isDbDown =
    /ENOTFOUND|ECONNREFUSED|connection terminated|ETIMEDOUT|too many connections/i.test(
      raw,
    );
  const missing = raw.match(/column "([^"]+)" does not exist/i)?.[1];

  return (
    <html lang="fr">
      <body className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">
    <main className="mx-auto w-full max-w-2xl px-4 py-14">
      <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <span className="text-5xl">⚠️</span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            Une erreur est survenue
          </h1>
        </div>

        {isMissingColumn && (
          <div className="mt-6 space-y-3 rounded-xl bg-amber-50 p-4 ring-1 ring-inset ring-amber-200">
            <p className="text-sm font-bold text-amber-900">
              🗄️ Schéma de base de données désynchronisé
            </p>
            <p className="text-sm text-amber-800">
              {missing ? (
                <>
                  La colonne <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs">{missing}</code>{" "}
                  est absente de la base.
                </>
              ) : (
                "Une colonne attendue par le code est absente de la base."
              )}{" "}
              Deux versions du projet ont utilisé des noms différents pour les
              mêmes données.
            </p>
            <div className="rounded-lg bg-white p-3 font-mono text-xs text-slate-800 ring-1 ring-inset ring-slate-200">
              <p className="font-sans text-xs font-semibold text-slate-600">
                Dans le terminal, à la racine du projet :
              </p>
              <p className="mt-2"># 1. Diagnostiquer (sans rien modifier)</p>
              <p>npx tsx src/db/sync-schema.ts</p>
              <p className="mt-2"># 2. Corriger automatiquement</p>
              <p>npx tsx src/db/sync-schema.ts --fix</p>
              <p className="mt-2"># 3. Ou appliquer la migration complète</p>
              <p># (Supabase → SQL Editor → supabase/migration.sql)</p>
            </div>
          </div>
        )}

        {isDbDown && (
          <div className="mt-6 space-y-2 rounded-xl bg-rose-50 p-4 ring-1 ring-inset ring-rose-200">
            <p className="text-sm font-bold text-rose-900">
              🌐 Base de données injoignable
            </p>
            <p className="text-sm text-rose-800">
              La connexion à la base a échoué. Vérifiez :
            </p>
            <ul className="ml-4 list-disc space-y-1 text-sm text-rose-800">
              <li>votre connexion réseau (ou VPN) ;</li>
              <li>l&apos;URL <code className="font-mono text-xs">DATABASE_URL</code> dans <code className="font-mono text-xs">.env</code> ;</li>
              <li>que le service Supabase est disponible (status.supabase.com) ;</li>
              <li>que le quota de connexions n&apos;est pas atteint.</li>
            </ul>
          </div>
        )}

        {!isMissingColumn && !isDbDown && (
          <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 ring-1 ring-inset ring-slate-200">
            {raw || "Erreur inconnue."}
          </p>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            🔄 Réessayer
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            📊 Tableau de bord
          </a>
        </div>

        {error?.digest && (
          <p className="mt-6 text-center text-[11px] text-slate-400">
            Référence : {error.digest}
          </p>
        )}
      </div>
    </main>
      </body>
    </html>
  );
}
