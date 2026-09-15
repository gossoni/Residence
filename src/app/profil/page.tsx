import type { Metadata } from "next";
import { redirectIfPasswordPending, requireUser } from "@/lib/auth";
import { ghLabel } from "@/lib/structure";
import { getT } from "@/lib/i18n-server";
import { roleLabel, userStatusLabel } from "@/lib/i18n";
import { formatDate, initials } from "@/lib/format";
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusPill,
} from "@/components/ui";
import { ProfileForm } from "@/components/client-forms";

export const metadata: Metadata = { title: "Mon profil" };

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [user, { t }] = await Promise.all([requireUser(), getT()]);
  await redirectIfPasswordPending(user);

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <div className="flex items-center gap-4">
        <Avatar initials={initials(user.prenom, user.nom)} className="h-14 w-14 text-lg" />
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {user.prenom} {user.nom}
          </h1>
          <p className="text-sm text-slate-500">{user.email}</p>
        </div>
      </div>

      <Card className="mt-6">
        <CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t.common.role}</p>
            <Badge tone="indigo" className="mt-1">{roleLabel(t, user.role)}</Badge>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t.common.status}</p>
            <div className="mt-1"><StatusPill status={user.status} /></div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t.common.location}</p>
            <p className="mt-1 text-sm text-slate-700">
              {ghLabel(user.gh)}
              {user.immeuble ? ` · Immeuble ${user.immeuble}` : ""}
              {user.appartement ? ` · Apt ${user.appartement}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{t.common.memberSince}</p>
            <p className="mt-1 text-sm text-slate-700">{formatDate(user.createdAt, false)}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{t.profile.editTitle}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfileForm telephone={user.telephone} />
        </CardContent>
      </Card>
    </main>
  );
}
