import type { Metadata } from "next";
import { requirePasswordChange } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { Alert, Card, CardContent } from "@/components/ui";
import { ForcedPasswordChangeForm, LogoutButton } from "@/components/client-forms";

export const metadata: Metadata = { title: "Changement de mot de passe requis" };

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const [user, { t }] = await Promise.all([requirePasswordChange(), getT()]);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-12">
      <div className="space-y-6">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-2xl shadow-lg">
            🔑
          </span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            {t.forcePassword.title}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            {t.forcePassword.subtitle}
          </p>
        </div>

        <Alert tone="amber">{t.forcePassword.banner}</Alert>

        <Card>
          <CardContent className="p-6">
            <ForcedPasswordChangeForm email={user.email} />
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
