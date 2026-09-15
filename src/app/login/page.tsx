import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { Card, CardContent } from "@/components/ui";
import { LoginForm } from "@/components/client-forms";

export const metadata: Metadata = { title: "Connexion" };

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const [user, { t }] = await Promise.all([getCurrentUser(), getT()]);
  if (user) redirect(user.status === "actif" ? "/feed" : "/dashboard");

  return (
    <main className="mx-auto grid min-h-[80vh] w-full max-w-md items-center px-4 py-10">
      <div className="space-y-6">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl shadow-lg shadow-indigo-600/30">
            🏘️
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{t.auth.loginTitle}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.auth.loginSubtitle}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <LoginForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-600">
          {t.auth.noAccount}{" "}
          <Link href="/register" className="font-semibold text-indigo-600 hover:underline">
            {t.auth.createAccount}
          </Link>
        </p>

        <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600">
          <p className="font-semibold text-slate-700">{t.auth.demoAccounts}</p>
          <p className="mt-1.5">{t.auth.demoPassword} : <code className="rounded bg-slate-100 px-1">Residence2025!</code></p>
          <ul className="mt-1.5 space-y-1">
            <li>🏢 <code>gh1@residence.app</code> — Responsable GH1</li>
            <li>🏠 <code>gh1-a@residence.app</code> — Resp. Immeuble GH1-A</li>
            <li>👤 <code>proprietaire@residence.app</code> — Propriétaire actif</li>
            <li>⏳ <code>nouveau@residence.app</code> — Propriétaire en attente</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
