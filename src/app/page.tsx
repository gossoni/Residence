import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { buildingsOf, ghLabel } from "@/lib/structure";
import { getT } from "@/lib/i18n-server";
import { roleLabel } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [user, { t }] = await Promise.all([getCurrentUser(), getT()]);

  if (user) {
    redirect(user.status === "actif" ? "/feed" : "/dashboard");
  }

  const stats = [
    { icon: "🏘️", label: "Groupes d’Habitation", value: "12" },
    { icon: "🏢", label: "Immeubles", value: "53" },
    { icon: "👥", label: "Rôles & hiérarchie", value: "4 niveaux" },
    { icon: "🗳️", label: "Votes pondérés", value: "Majorité absolue" },
  ];

  return (
    <main>
      <section className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute -left-32 -top-32 h-96 w-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-0 h-96 w-96 rounded-full bg-sky-500/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:py-24 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-indigo-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Plateforme de copropriété sécurisée
            </p>
            <h1 className="mt-6 text-4xl font-bold leading-tight text-white sm:text-5xl">
              Gérez votre résidence,
              <span className="block text-indigo-400">simplement & en confiance.</span>
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-300">
              Publications par portée (Résidence, Groupe, Immeuble), validation des comptes
              propriétaires, votes pondérés des responsables avec délais d’auto-validation,
              signalements et modération — le tout dans une interface moderne et mobile.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/register"
                className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500"
              >
                Créer mon compte propriétaire
              </Link>
              <Link
                href="/login"
                className="rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"
              >
                J’ai déjà un compte
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
              >
                <span className="text-2xl">{s.icon}</span>
                <p className="mt-3 text-2xl font-bold text-white">{s.value}</p>
                <p className="mt-1 text-xs text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <h2 className="text-2xl font-bold text-slate-900">Une organisation fixe et claire</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          La résidence est structurée en 12 Groupes d’Habitation, chacun composé d’immeubles
          identifiés de A à G.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {Object.entries({
            1: 5, 2: 4, 3: 6, 4: 4, 5: 4, 6: 6, 7: 2, 8: 4, 9: 3, 10: 4, 11: 4, 12: 7,
          }).map(([gh, n]) => (
            <div key={gh} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-sm font-bold text-indigo-700">GH{gh}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                Immeubles A – {String.fromCharCode(64 + n)} ({n})
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold text-slate-900">Rôles & workflow de validation</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { role: "Président", desc: "Accès total, poids de vote double (2 voix), publie automatiquement tout contenu.", color: "border-amber-300 bg-amber-50" },
              { role: "Responsable de Groupe (GH)", desc: "12 responsables — un par GH. Valide les publications de résidence à la majorité.", color: "border-indigo-300 bg-indigo-50" },
              { role: "Responsable d’Immeuble", desc: "Valide l’identité des propriétaires et gère les publications de son immeuble / groupe.", color: "border-sky-300 bg-sky-50" },
              { role: "Propriétaire", desc: "Commente, vote en séance, signale. Accès limité à son GH / immeuble et à la résidence.", color: "border-emerald-300 bg-emerald-50" },
            ].map((r) => (
              <div key={r.role} className={`rounded-xl border p-5 ${r.color}`}>
                <p className="text-sm font-bold text-slate-900">{r.role}</p>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">{r.desc}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-semibold text-slate-800">💡 Comptes de démonstration</p>
            <p className="mt-2 text-xs leading-relaxed text-slate-600">
              Mot de passe commun : <code className="rounded bg-slate-200 px-1.5 py-0.5">Residence2025!</code>
            </p>
            <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
              <p>👑 Président : <code className="font-semibold">president@residence.app</code></p>
              <p>🏢 Resp. GH1 : <code className="font-semibold">gh1@residence.app</code></p>
              <p>🏠 Resp. Immeuble GH1-A : <code className="font-semibold">gh1-a@residence.app</code></p>
              <p>👤 Propriétaire actif : <code className="font-semibold">proprietaire@residence.app</code></p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Un propriétaire en attente de validation : <code className="font-semibold">nouveau@residence.app</code>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
