import { Avatar, Badge, Card, StatusPill } from "@/components/ui";
import { fileIcon, formatBytes, formatDate, initials } from "@/lib/format";
import { ghLabel, roleTone, ToneForScope } from "@/lib/structure";
import { pubTypeLabel, roleLabel, scopeLabel, type Dictionary } from "@/lib/i18n";

export function AuthorLine({
  prenom,
  nom,
  role,
  gh,
  immeuble,
  date,
  compact = false,
  t,
}: {
  prenom: string;
  nom: string;
  role: string;
  gh: number | null;
  immeuble: string | null;
  date?: Date | string | null;
  compact?: boolean;
  t: Dictionary;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar
        initials={initials(prenom, nom)}
        tone={(roleTone(role) as "indigo" | "emerald" | "amber" | "sky" | "rose") ?? "indigo"}
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-800">
          {prenom} {nom}
        </p>
        <p className="truncate text-xs text-slate-500">
          {roleLabel(t, role)}
          {gh ? ` · ${ghLabel(gh)}${immeuble ? ` · Immeuble ${immeuble}` : ""}` : ""}
        </p>
      </div>
      {date && (
        <p className="ml-auto shrink-0 text-right text-[11px] text-slate-400">
          {formatDate(date, compact ? false : true)}
        </p>
      )}
    </div>
  );
}

export function PublicationCard({
  pub,
  href,
  t,
}: {
  pub: {
    id: number;
    type: string;
    titre: string;
    contenu: string;
    scope: string;
    gh: number | null;
    immeuble: string | null;
    status: string;
    fileUrl: string | null;
    fileName: string | null;
    fileMime: string | null;
    fileSize: number | null;
    eventAt: Date | string | null;
    createdAt: Date | string | null;
    publishedAt: Date | string | null;
    commentCount?: number;
    reportCount?: number;
    authorNom: string;
    authorPrenom: string;
    authorRole: string;
    authorGh: number | null;
    authorImmeuble: string | null;
  };
  href: string;
  t: Dictionary;
}) {
  const scopeName = scopeLabel(t, pub.scope);

  return (
    <Card className="overflow-hidden transition hover:shadow-md">
      <a href={href} className="block p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Badge tone={ToneForScope(pub.scope)}>
            {pub.scope === "residence" ? "🏘️" : pub.scope === "groupe" ? "🏢" : "🏠"}{" "}
            {scopeName}
            {pub.gh ? ` ${ghLabel(pub.gh)}${pub.immeuble ? ` ${pub.immeuble}` : ""}` : ""}
          </Badge>
          <Badge tone="slate">{pubTypeLabel(t, pub.type)}</Badge>
          {pub.status !== "publiee" && <StatusPill status={pub.status} />}
        </div>

        <h3 className="text-base font-semibold leading-snug text-slate-900 hover:text-indigo-700 sm:text-lg">
          {pub.titre}
        </h3>

        <p className="mt-1.5 line-clamp-3 whitespace-pre-line text-sm text-slate-600">
          {pub.contenu}
        </p>

        {pub.fileUrl && (
          <span className="mt-2 inline-flex max-w-full items-center gap-1.5 truncate rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700">
            {fileIcon(pub.fileMime, pub.fileName)} {pub.fileName ?? "Fichier joint"}
            {pub.fileSize ? ` · ${formatBytes(pub.fileSize)}` : ""}
          </span>
        )}

        {pub.eventAt && (
          <p className="mt-2 text-xs font-medium text-amber-700">
            📅 {pub.type === "tache_evenement" ? "Événement / échéance" : ""} :{" "}
            {formatDate(pub.eventAt, true)}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
          <AuthorLine
            prenom={pub.authorPrenom}
            nom={pub.authorNom}
            role={pub.authorRole}
            gh={pub.authorGh}
            immeuble={pub.authorImmeuble}
            date={pub.publishedAt ?? pub.createdAt}
            compact
            t={t}
          />
          <div className="flex shrink-0 items-center gap-3 text-xs font-medium text-slate-500">
            <span>💬 {pub.commentCount ?? 0}</span>
            {(pub.reportCount ?? 0) > 0 && <span className="text-rose-600">🚩 {pub.reportCount}</span>}
          </div>
        </div>
      </a>
    </Card>
  );
}
