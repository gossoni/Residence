import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { Card, CardContent } from "@/components/ui";
import { RegisterForm } from "@/components/client-forms";

export const metadata: Metadata = { title: "Inscription" };

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [user, { t }] = await Promise.all([getCurrentUser(), getT()]);
  if (user) redirect(user.status === "actif" ? "/feed" : "/dashboard");

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="space-y-6">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-2xl shadow-lg shadow-indigo-600/30">
            🏘️
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{t.auth.registerTitle}</h1>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{t.auth.registerSubtitle}</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <RegisterForm />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-slate-600">
          {t.auth.alreadyAccount}{" "}
          <Link href="/login" className="font-semibold text-indigo-600 hover:underline">
            {t.auth.login}
          </Link>
        </p>
      </div>
    </main>
  );
}
