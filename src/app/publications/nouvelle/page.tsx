import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireActiveUser } from "@/lib/auth";
import { canPublish, getAppSettings } from "@/lib/logic";
import { ghLabel } from "@/lib/structure";
import { getT } from "@/lib/i18n-server";
import { roleLabel } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, Badge } from "@/components/ui";
import { NewPublicationForm } from "@/components/client-forms";

export const metadata: Metadata = { title: "Nouvelle publication" };

export const dynamic = "force-dynamic";

export default async function NewPublicationPage() {
  const [user, { t }] = await Promise.all([requireActiveUser(), getT()]);
  if (!canPublish(user)) redirect("/feed");

  const { validationDelayHours, enabledPubTypes } = await getAppSettings();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{t.pub.newTitle}</CardTitle>
            <Badge tone="indigo">{roleLabel(t, user.role)}</Badge>
          </div>
          <p className="text-sm text-slate-500">
            {user.role === "president"
              ? "Le Président publie avec validation immédiate sur toute la résidence."
              : user.role === "gh_manager"
                ? `Responsable du ${ghLabel(user.gh)} — vos publications de groupe ou d’immeuble sont automatiques ; les publications Résidence passent par un vote des responsables.`
                : `Responsable d’Immeuble (${ghLabel(user.gh)} · Immeuble ${user.immeuble}) — vos publications d’immeuble sont immédiates ; celles du groupe sont soumises au vote des responsables du ${ghLabel(user.gh)}.`}
          </p>
        </CardHeader>
        <CardContent>
          <NewPublicationForm
            role={user.role}
            gh={user.gh}
            immeuble={user.immeuble}
            delayHours={validationDelayHours}
            enabledTypes={enabledPubTypes as unknown as string[]}
          />
        </CardContent>
      </Card>
    </main>
  );
}
