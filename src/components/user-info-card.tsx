import Link from "next/link";
import type { User } from "@/db/schema";
import { ghLabel, roleTone } from "@/lib/structure";
import { roleLabel, type Dictionary } from "@/lib/i18n";
import { formatDate, initials } from "@/lib/format";
import { Avatar, Badge, Card, CardContent, StatusPill } from "@/components/ui";

/**
 * Récapitulatif du compte connecté, affiché directement dans le fil
 * d'actualité : l'utilisateur voit qui il est (rôle, statut, localisation)
 * sans avoir à ouvrir l'onglet « Tableau de bord ».
 */
export function UserInfoCard({
  user,
  t,
  locale,
}: {
  user: User;
  t: Dictionary;
  locale: "fr" | "ar";
}) {
  const d = locale === "ar";

  return (
    <Card className="border-slate-200 bg-white">
      <CardContent className="flex flex-wrap items-center gap-4 p-4 sm:p-5">
        <Avatar
          initials={initials(user.prenom, user.nom)}
          className="h-12 w-12 text-base"
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {t.userInfo.welcome}
          </p>
          <p className="truncate text-base font-bold text-slate-900">
            {user.prenom} {user.nom}
          </p>
          <p className="truncate text-xs text-slate-500">{user.email}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className={d ? "text-end" : "text-start"}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t.userInfo.role}
            </p>
            <Badge tone={roleTone(user.role)} className="mt-0.5">
              {roleLabel(t, user.role)}
            </Badge>
          </div>
          <div className={d ? "text-end" : "text-start"}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t.userInfo.status}
            </p>
            <div className="mt-0.5">
              <StatusPill status={user.status} />
            </div>
          </div>
          <div className={d ? "text-end" : "text-start"}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t.userInfo.location}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-700">
              {ghLabel(user.gh)}
              {user.immeuble ? ` · ${t.common.building} ${user.immeuble}` : ""}
              {user.appartement ? ` · ${t.common.apartment} ${user.appartement}` : ""}
            </p>
          </div>
          <div className={d ? "text-end" : "text-start"}>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
              {t.common.memberSince}
            </p>
            <p className="mt-0.5 text-xs font-medium text-slate-700">
              {formatDate(user.createdAt, false)}
            </p>
          </div>
        </div>

        <Link
          href="/profil"
          className="ms-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
        >
          {t.userInfo.viewProfile}
        </Link>
      </CardContent>
    </Card>
  );
}
