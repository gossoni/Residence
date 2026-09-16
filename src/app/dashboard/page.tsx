import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, desc, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  adminAudit,
  comments,
  dataArchives,
  publications,
  reports,
  users,
} from "@/db/schema";
import { redirectIfPasswordPending, requireUser } from "@/lib/auth";
import {
  canModeratePublication,
  canVoteOn,
  getAppSettings,
  getBranding,
  sweepExpiredPublications,
} from "@/lib/logic";
import { getFeed, listReports } from "@/lib/queries";
import { deadlineLabel, formatDate, initials } from "@/lib/format";
import { ghLabel, roleTone, ToneForScope } from "@/lib/structure";
import {
  canManageUser,
  creatableRoles,
  isImmune,
  isManagerRole,
  roleRank,
} from "@/lib/hierarchy";
import { getT } from "@/lib/i18n-server";
import { pubTypeLabel, roleLabel, scopeLabel } from "@/lib/i18n";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  ProgressBar,
  StatusPill,
} from "@/components/ui";
import { PublicationCard } from "@/components/publication-card";
import {
  AdminArchivesList,
  AdminBatchCreateForm,
  AdminCommentActions,
  AdminCreateUserForm,
  AdminLockToggle,
  AdminPublicationActions,
  AdminResetPasswordForm,
  AdminUnlockPasswordButton,
  AdminUserBatchBar,
  AdminUserRowActions,
  BrandingForm,
  OwnPasswordForm,
  PubTypesForm,
  VoteWeightsForm,
} from "@/components/admin-ui";
import {
  LogoutButton,
  RoleManager,
  SettingsForm,
  UserStatusButtons,
} from "@/components/client-forms";

export const metadata: Metadata = { title: "Tableau de bord" };

export const dynamic = "force-dynamic";

const DEMO_PASSWORD = "Residence2025!";

export default async function DashboardPage() {
  const [user, { t }] = await Promise.all([requireUser(), getT()]);
  await redirectIfPasswordPending(user);

  if (user.status === "provisoire") {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-14">
        <Card className="overflow-hidden">
          <div className="bg-amber-50 px-6 py-8 text-center">
            <span className="text-5xl">⏳</span>
            <h1 className="mt-4 text-2xl font-bold text-slate-900">
              {t.auth.waitingTitle}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {t.auth.waitingBody}
            </p>
          </div>
          <CardContent className="space-y-4 p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {[t.auth.step1, t.auth.step2, t.auth.step3].map((step, i) => (
                <div key={i} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                    {t.dashboard.badge} · {i + 1}
                  </p>
                  <p className="mt-1 text-sm text-slate-700">{step}</p>
                </div>
              ))}
              <div className="rounded-xl border border-dashed border-slate-300 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                  {t.common.account}
                </p>
                <p className="mt-1 truncate text-sm text-slate-700">{user.email}</p>
              </div>
            </div>
            <div className="flex justify-end">
              <LogoutButton />
            </div>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (user.status === "bloque") {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-14">
        <Card className="p-10 text-center">
          <span className="text-5xl">🚫</span>
          <h1 className="mt-4 text-2xl font-bold text-slate-900">{t.auth.blockedTitle}</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">
            {t.auth.blockedBody}
          </p>
          <div className="mt-6 flex justify-center">
            <LogoutButton />
          </div>
        </Card>
      </main>
    );
  }

  await sweepExpiredPublications();

  const isAdmin = user.role === "admin";
  const isPresident = user.role === "president";
  const isGhManager = user.role === "gh_manager";
  const isBuildingManager = user.role === "building_manager";
  const isManager =
    isAdmin || isPresident || isGhManager || isBuildingManager;
  const canConfigure = isAdmin || isPresident;

  const settings = await getAppSettings();
  const recentFeed = (await getFeed(user, "all")).slice(0, 3);

  /* --- Comptes à valider ------------------------------------------------ */
  let pendingAccounts: (typeof users.$inferSelect)[] = [];
  if (isManager) {
    let cond: SQL | undefined = eq(users.status, "provisoire");
    if (isGhManager) cond = and(eq(users.status, "provisoire"), eq(users.gh, user.gh));
    if (isBuildingManager)
      cond = and(
        eq(users.status, "provisoire"),
        eq(users.gh, user.gh),
        eq(users.immeuble, user.immeuble ?? ""),
      );
    pendingAccounts = await db
      .select()
      .from(users)
      .where(cond)
      .orderBy(desc(users.createdAt))
      .limit(80);
  }

  /* --- Scrutins --------------------------------------------------------- */
  const pendingPubsRows = await db
    .select({
      pub: publications,
      authorNom: users.nom,
      authorPrenom: users.prenom,
    })
    .from(publications)
    .innerJoin(users, eq(publications.authorId, users.id))
    .where(eq(publications.status, "en_validation"))
    .orderBy(asc(publications.deadline))
    .limit(100);

  const myScrutins = pendingPubsRows.filter(
    (r) => canVoteOn(r.pub, user) || canModeratePublication(user, r.pub),
  );

  /* --- Signalements ----------------------------------------------------- */
  let myReports: Awaited<ReturnType<typeof listReports>> = [];
  if (isManager) {
    const open = await listReports();
    const pubIds = open.map((r) => r.publicationId).filter((x): x is number => !!x);
    const commentIds = open.map((r) => r.commentId).filter((x): x is number => !!x);
    const [pubs, coms] = await Promise.all([
      pubIds.length
        ? db.select().from(publications).where(inArray(publications.id, pubIds))
        : Promise.resolve([]),
      commentIds.length
        ? db.select().from(comments).where(inArray(comments.id, commentIds))
        : Promise.resolve([]),
    ]);
    const pubMap = new Map(pubs.map((p) => [p.id, p]));
    const commentMap = new Map(coms.map((c) => [c.id, c]));
    myReports = open.filter((r) => {
      const targetPub = r.publicationId
        ? pubMap.get(r.publicationId)
        : r.commentId
          ? pubMap.get(commentMap.get(r.commentId)?.publicationId ?? -1)
          : undefined;
      return targetPub ? canModeratePublication(user, targetPub) : false;
    });
  }

  /* --- Statistiques / listes globales ----------------------------------- */
  let stats: { label: string; value: number; tone: string }[] = [];
  let allUsers: (typeof users.$inferSelect)[] = [];
  let auditRows: (typeof adminAudit.$inferSelect)[] = [];

  if (canConfigure) {
    const [actifs, provisoires, bloques, publiees, enValidation, signalements] =
      await Promise.all([
        db.select({ c: count() }).from(users).where(eq(users.status, "actif")),
        db.select({ c: count() }).from(users).where(eq(users.status, "provisoire")),
        db.select({ c: count() }).from(users).where(eq(users.status, "bloque")),
        db.select({ c: count() }).from(publications).where(eq(publications.status, "publiee")),
        db.select({ c: count() }).from(publications).where(eq(publications.status, "en_validation")),
        db.select({ c: count() }).from(reports).where(eq(reports.status, "ouvert")),
      ]);
    stats = [
      { label: t.dashboard.statsActive, value: actifs[0]?.c ?? 0, tone: "text-emerald-600" },
      { label: t.dashboard.statsPending, value: provisoires[0]?.c ?? 0, tone: "text-amber-600" },
      { label: t.dashboard.statsBlocked, value: bloques[0]?.c ?? 0, tone: "text-rose-600" },
      { label: t.dashboard.statsPublished, value: publiees[0]?.c ?? 0, tone: "text-indigo-600" },
      { label: t.dashboard.statsValidation, value: enValidation[0]?.c ?? 0, tone: "text-amber-600" },
      { label: t.dashboard.statsReports, value: signalements[0]?.c ?? 0, tone: "text-rose-600" },
    ];
  }

  // Liste des comptes : Admin et Président voient toute la résidence, les
  // Responsables de Groupe/Immeuble uniquement les membres de leur périmètre.
  if (isManager) {
    let scopeCond: SQL | undefined;
    if (isGhManager) scopeCond = eq(users.gh, user.gh);
    else if (isBuildingManager)
      scopeCond = and(
        eq(users.gh, user.gh),
        eq(users.immeuble, user.immeuble ?? ""),
      );
    allUsers = await db
      .select()
      .from(users)
      .where(scopeCond)
      .orderBy(desc(users.createdAt))
      .limit(300);
  }

  let branding = null;
  let archiveRows: {
    id: number;
    kind: string;
    label: string;
    fileName: string;
    sizeBytes: number | null;
    createdAt: string;
    downloadedAt: string | null;
  }[] = [];
  if (isAdmin) {
    // Journal d'administration + archives stockées en base (Supabase).
    const [logRows, brand, archRows] = await Promise.all([
      db.select().from(adminAudit).orderBy(desc(adminAudit.createdAt)).limit(40),
      getBranding("fr"),
      db
        .select({
          id: dataArchives.id,
          kind: dataArchives.kind,
          title: dataArchives.title,
          filename: dataArchives.filename,
          payload: dataArchives.payload,
          downloadedAt: dataArchives.downloadedAt,
          createdAt: dataArchives.createdAt,
        })
        .from(dataArchives)
        .orderBy(desc(dataArchives.createdAt))
        .limit(50),
    ]);
    auditRows = logRows;
    branding = brand;
    archiveRows = archRows.map((a) => ({
      id: a.id,
      kind: a.kind,
      label: a.title,
      fileName: a.filename,
      // Taille déduite du contenu base64 stocké en base.
      sizeBytes: Math.round((a.payload.length * 3) / 4),
      createdAt: formatDate(a.createdAt, true),
      downloadedAt: a.downloadedAt ? formatDate(a.downloadedAt, true) : null,
    }));
  }

  const resetTargets = allUsers
    .filter((u) => u.role !== "admin")
    .map((u) => ({
      id: u.id,
      label: `${u.prenom} ${u.nom} — ${roleLabel(t, u.role)} (${u.email})`,
    }));

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 px-6 py-6 text-white shadow-lg shadow-indigo-600/20">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-indigo-100">
            {t.dashboard.badge} · {roleLabel(t, user.role)}
          </p>
          <h1 className="mt-1 text-2xl font-bold">
            {t.dashboard.hello}, {user.prenom} 👋
          </h1>
          <p className="mt-1 text-sm text-indigo-100">
            {ghLabel(user.gh)}
            {user.immeuble
              ? ` · ${t.common.building} ${user.immeuble}${user.appartement ? ` · ${t.common.apartment} ${user.appartement}` : ""}`
              : ""}{" "}
            · {roleLabel(t, user.role)}
          </p>
        </div>
        {isManager && (
          <Link
            href="/publications/nouvelle"
            className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
          >
            {t.dashboard.newPublication}
          </Link>
        )}
      </div>

      {!isAdmin && !isPresident && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="flex items-center gap-3 p-5">
              <Avatar initials={initials(user.prenom, user.nom)} className="h-11 w-11" />
              <div>
                <p className="text-sm font-semibold text-slate-800">{user.email}</p>
                <p className="text-xs text-slate-500">
                  {t.common.status} : <StatusPill status={user.status} /> · {t.common.phone} :{" "}
                  {user.telephone || "—"}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                {t.dashboard.perimeter}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {roleLabel(t, user.role)} — {ghLabel(user.gh)}
                {user.immeuble ? ` · ${t.common.building} ${user.immeuble}` : ""}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {canConfigure && (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4">
                <p className={`text-2xl font-bold ${s.tone}`}>{s.value}</p>
                <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  {s.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ---------------- Poids de voix (Administrateur) ---------------- */}
      {isAdmin && (
        <section className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>
                {t.weights.section} — {t.weights.title}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">{t.weights.subtitle}</p>
            </CardHeader>
            <CardContent>
              <VoteWeightsForm weights={settings.voteWeights} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* ---------------- Types de publication (Administrateur) ---------------- */}
      {isAdmin && (
        <section className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>
                {t.pubTypes.section} — {t.pubTypes.title}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">{t.pubTypes.subtitle}</p>
            </CardHeader>
            <CardContent>
              <PubTypesForm
                enabled={settings.enabledPubTypes as unknown as string[]}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* ---------------- Mot de passe personnel ---------------- */}
      <section className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>{t.ownPassword.title}</CardTitle>
            <p className="mt-1 text-sm text-slate-600">{t.ownPassword.subtitle}</p>
          </CardHeader>
          <CardContent>
            // <OwnPasswordForm />
            <OwnPasswordForm telephone={user.telephone} nom={user.nom} prenom={user.prenom} />
          </CardContent>
        </Card>
      </section>

      {/* ---------------- Hiérarchie des pouvoirs ---------------- */}
      {isManager && (
        <section className="mt-8">
          <Card className="border-slate-300 bg-slate-50/70">
            <CardHeader>
              <CardTitle>{t.hierarchy.title}</CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                {t.hierarchy.subtitle}
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-slate-800 ring-1 ring-inset ring-slate-200">
                {t.hierarchy.rank}: {t.hierarchy.rankList}
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {t.hierarchy.yourScope}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {user.role === "admin" || user.role === "president"
                      ? t.hierarchy.residence
                      : user.role === "gh_manager"
                        ? `${t.hierarchy.yourGroup} (${ghLabel(user.gh)})`
                        : `${t.hierarchy.yourBuilding} (${ghLabel(user.gh)} · ${user.immeuble})`}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {t.hierarchy.canCreate}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {creatableRoles(user)
                      .map((r) => roleLabel(t, r))
                      .join(", ")}
                  </p>
                </div>
                <div className="rounded-lg bg-white p-3 ring-1 ring-inset ring-slate-200">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                    {t.hierarchy.canDelete}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-800">
                    {roleLabel(t, user.role)} &lt; (
                    {["owner", "building_manager", "gh_manager", "president"]
                      .filter(
                        (r) =>
                          roleRank(r) < roleRank(user.role) &&
                          (r === "president" ? user.role === "admin" : true),
                      )
                      .map((r) => roleLabel(t, r))
                      .join(", ") || "—"}
                    )
                  </p>
                </div>
              </div>
              <Alert tone="indigo">
                🛡️ {t.hierarchy.immune}
                {user.role === "owner" ? ` ${t.hierarchy.ownerRule}` : ""}
              </Alert>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ---------------- Administration ---------------- */}
      {isManager && (
        <section className="mt-8 space-y-6">
          {isAdmin && (
          <Card className="border-indigo-200 bg-indigo-50/40">
            <CardHeader className="border-indigo-100">
              <CardTitle>
                {t.branding.section} — {t.branding.title}
              </CardTitle>
              <p className="mt-1 text-sm text-slate-600">{t.branding.subtitle}</p>
            </CardHeader>
            <CardContent>
              {branding && (
                <BrandingForm
                  nameFr={branding.nameFr}
                  nameAr={branding.nameAr}
                  logoUrl={branding.logoUrl}
                />
              )}
            </CardContent>
          </Card>
          )}

          <Card className="border-rose-200 bg-rose-50/40">
            <CardHeader className="border-rose-100">
              <CardTitle>{t.admin.section}</CardTitle>
              <p className="mt-1 text-sm text-slate-600">
                {isAdmin
                  ? t.admin.subtitle
                  : `${t.hierarchy.yourPowers} : ${roleLabel(t, user.role)} — ${
                      user.role === "president"
                        ? t.hierarchy.residence
                        : user.role === "gh_manager"
                          ? `${t.hierarchy.yourGroup} (${ghLabel(user.gh)})`
                          : `${t.hierarchy.yourBuilding} (${ghLabel(user.gh)} · ${user.immeuble})`
                    }`}
              </p>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              {/* Colonne 1 : création unitaire puis par lot */}
              <div>
                <p className="mb-3 text-sm font-bold text-slate-800">
                  {t.admin.createAccount}
                </p>
                <p className="mb-3 text-xs text-slate-500">
                  {t.admin.createAccountSubtitle}
                </p>
                <AdminCreateUserForm
                  actorRole={user.role}
                  actorGh={user.gh}
                  actorImmeuble={user.immeuble}
                />
              </div>
              <div className="border-t border-slate-200 pt-6">
                <p className="mb-3 text-sm font-bold text-slate-800">
                  {t.batch.title}
                </p>
                <p className="mb-3 text-xs text-slate-500">{t.batch.subtitle}</p>
                <AdminBatchCreateForm
                  actorRole={user.role}
                  actorGh={user.gh}
                  actorImmeuble={user.immeuble}
                />
              </div>
              <div className="space-y-6">
                <div>
                  <p className="mb-3 text-sm font-bold text-slate-800">
                    {t.admin.resetPassword}
                  </p>
                  <p className="mb-3 text-xs text-slate-500">
                    {t.admin.resetPasswordSubtitle}
                  </p>
                  {resetTargets.length > 0 ? (
                    <AdminResetPasswordForm users={resetTargets} />
                  ) : (
                    <p className="text-sm text-slate-400">{t.admin.auditEmpty}</p>
                  )}
                </div>
                {isAdmin && (
                <div className="border-t border-slate-200 pt-5">
                  <p className="mb-1 text-sm font-bold text-slate-800">
                    {t.admin.appLock}
                  </p>
                  <p className="mb-3 text-xs text-slate-500">{t.admin.appLockHelp}</p>
                  <AdminLockToggle locked={settings.appLocked} />
                </div>
                )}
              </div>
            </CardContent>
          </Card>

          {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>{t.manage.archives}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <AdminArchivesList items={archiveRows} />
            </CardContent>
          </Card>
          )}

          {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>{t.admin.auditLog}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {auditRows.length === 0 ? (
                <p className="p-5 text-center text-sm text-slate-400">
                  {t.admin.auditEmpty}
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">{t.admin.date}</th>
                        <th className="px-4 py-3">{t.admin.actor}</th>
                        <th className="px-4 py-3">{t.admin.action}</th>
                        <th className="px-4 py-3">{t.admin.details}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditRows.map((a) => (
                        <tr
                          key={a.id}
                          className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                        >
                          <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                            {formatDate(a.createdAt, true)}
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-700">
                            #{a.actorId}
                          </td>
                          <td className="px-4 py-2.5">
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                              {a.action}
                            </code>
                          </td>
                          <td className="px-4 py-2.5 text-xs text-slate-600">
                            {a.details ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          )}
        </section>
      )}

      {/* ---------------- Comptes à valider ---------------- */}
      {isManager && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {t.dashboard.accountsToValidate}
            </h2>
            <Badge tone="amber">
              {pendingAccounts.length} {t.dashboard.pending}
            </Badge>
          </div>
          {pendingAccounts.length === 0 ? (
            <EmptyState
              icon="✅"
              title={t.dashboard.accountsToValidateEmpty}
              description={t.dashboard.accountsToValidateEmptyDesc}
            />
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">{t.common.firstName}</th>
                    <th className="px-4 py-3">{t.common.email}</th>
                    <th className="px-4 py-3">{t.common.location}</th>
                    <th className="px-4 py-3">{t.common.createdAt}</th>
                    <th className="px-4 py-3 text-end">{t.common.actions}</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingAccounts.map((u) => (
                    <tr
                      key={u.id}
                      className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            initials={initials(u.prenom, u.nom)}
                            className="h-8 w-8 text-[10px]"
                          />
                          <div>
                            <p className="font-semibold text-slate-800">
                              {u.prenom} {u.nom}
                            </p>
                            <p className="text-xs text-slate-400">
                              {t.common.apartment} {u.appartement}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        <p>{u.email}</p>
                        <p className="text-slate-400">📱 {u.telephone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone="sky">{ghLabel(u.gh)}</Badge>{" "}
                        <Badge tone="emerald">
                          {t.common.building} {u.immeuble}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {formatDate(u.createdAt, false)}
                      </td>
                      <td className="px-4 py-3 text-end">
                        <UserStatusButtons userId={u.id} status={u.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      )}

      {/* ---------------- Scrutins ---------------- */}
      {isManager && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {t.dashboard.scrutins}
            </h2>
            <Badge tone="amber">{myScrutins.length}</Badge>
          </div>
          {myScrutins.length === 0 ? (
            <EmptyState
              icon="🗳️"
              title={t.dashboard.scrutinsEmpty}
              description={t.dashboard.scrutinsEmptyDesc}
            />
          ) : (
            <div className="space-y-3">
              {myScrutins.map(({ pub, authorNom, authorPrenom }) => {
                const total = Math.max(pub.totalVoix, pub.votesPour + pub.votesContre);
                return (
                  <Card key={pub.id}>
                    <CardContent className="p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={ToneForScope(pub.scope)}>
                              {scopeLabel(t, pub.scope)}
                              {pub.gh ? ` ${ghLabel(pub.gh)}` : ""}
                            </Badge>
                            <Badge tone="slate">{pubTypeLabel(t, pub.type)}</Badge>
                            {pub.deadline && (
                              <Badge tone="amber">⏳ {deadlineLabel(pub.deadline)}</Badge>
                            )}
                          </div>
                          <Link
                            href={`/publications/${pub.id}`}
                            className="mt-2 block text-base font-semibold text-slate-900 hover:text-indigo-700"
                          >
                            {pub.titre}
                          </Link>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {t.dashboard.by} {authorPrenom} {authorNom} ·{" "}
                            {formatDate(pub.createdAt, false)}
                          </p>
                        </div>
                        <Link
                          href={`/publications/${pub.id}`}
                          className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          {t.dashboard.vote} →
                        </Link>
                      </div>
                      <div className="mt-3 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-emerald-700">
                            {t.pub.approvedLabel}
                          </span>
                          <span className="text-slate-600">
                            {pub.votesPour} / {pub.totalVoix} {t.common.votes}
                          </span>
                        </div>
                        <ProgressBar
                          percent={total ? (pub.votesPour / total) * 100 : 0}
                          tone="emerald"
                        />
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-rose-700">
                            {t.pub.rejectedLabel}
                          </span>
                          <span className="text-slate-600">
                            {pub.votesContre} / {pub.totalVoix} {t.common.votes}
                          </span>
                        </div>
                        <ProgressBar
                          percent={total ? (pub.votesContre / total) * 100 : 0}
                          tone="rose"
                        />
                        <p className="text-[11px] text-slate-400">
                          {t.common.majorityRequired} : {pub.majorite} {t.common.votes} /{" "}
                          {pub.totalVoix}. {t.common.autoValidationHint}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ---------------- Modération ---------------- */}
      {isManager && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {t.dashboard.moderation}
            </h2>
            <Badge tone="rose">{myReports.length}</Badge>
          </div>
          {myReports.length === 0 ? (
            <EmptyState
              icon="🕊️"
              title={t.dashboard.moderationEmpty}
              description={t.dashboard.moderationEmptyDesc}
            />
          ) : (
            <Card className="divide-y divide-slate-100">
              {myReports.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <span className="text-lg">🚩</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      {t.dashboard.reportedBy} <strong>{r.reporterPrenom} {r.reporterNom}</strong>
                    </p>
                    <p className="text-xs text-slate-500">
                      {t.dashboard.reason} : {r.reason} · {formatDate(r.createdAt, true)}
                    </p>
                  </div>
                  <Link
                    href={r.publicationId ? `/publications/${r.publicationId}` : "/dashboard"}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {t.dashboard.examine} →
                  </Link>
                  {(r.commentId || r.publicationId) &&
                    (r.commentId ? (
                      <AdminCommentActions commentId={r.commentId} />
                    ) : (
                      <AdminPublicationActions pubId={r.publicationId!} />
                    ))}
                </div>
              ))}
            </Card>
          )}
        </section>
      )}

      {/* ---------------- Gestion des utilisateurs ---------------- */}
      {isManager && (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              {isAdmin
                ? t.admin.allAccounts
                : isPresident
                  ? t.dashboard.userManagement
                  : t.dashboard.membersPerimeter}
            </h2>
            <Badge tone="slate">
              {allUsers.length} {t.common.totalUsers}
            </Badge>
          </div>
          <div className="mb-3">
            <AdminUserBatchBar
              users={allUsers
                .filter((u) => canManageUser(user, u))
                .map((u) => ({
                  id: u.id,
                  email: u.email,
                  role: u.role,
                  gh: u.gh,
                  immeuble: u.immeuble,
                }))}
            />
          </div>
          <Card className="overflow-x-auto">
            
<AccountsFilters
  users={allUsers.map((u) => ({
    id: u.id,
    email: u.email,
    nom: u.nom,
    prenom: u.prenom,
    role: u.role,
    gh: u.gh,
    immeuble: u.immeuble,
    appartement: u.appartement,
    status: u.status,
    mustChangePassword: u.mustChangePassword,
  }))}
  actorRole={user.role}
  canManageIds={allUsers.filter((u) => canManageUser(user, u)).map((u) => u.id)}
/>

	/* <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">{t.common.email}</th>
                  <th className="px-4 py-3">{t.common.role}</th>
                  <th className="px-4 py-3">{t.common.location}</th>
                  <th className="px-4 py-3">{t.common.status}</th>
                  <th className="px-4 py-3">{t.common.account}</th>
                  <th className="px-4 py-3 text-end">{t.dashboard.roleAssigned}</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          initials={initials(u.prenom, u.nom)}
                          className="h-8 w-8 text-[10px]"
                        />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {u.prenom} {u.nom}
                          </p>
                          <p className="text-xs text-slate-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={roleTone(u.role)}>{roleLabel(t, u.role)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">
                      {ghLabel(u.gh)}
                      {u.immeuble ? ` · ${t.common.building} ${u.immeuble}` : ""}
                      {u.appartement ? ` · ${t.common.apartment} ${u.appartement}` : ""}
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={u.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {u.role === "admin" ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          <UserStatusButtons
                            userId={u.id}
                            status={u.status}
                            mustChangePassword={u.mustChangePassword}
                            canManage={canManageUser(user, u)}
                          />
                        )}
                        {u.mustChangePassword && (
                          <span className="whitespace-nowrap rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                            🔑 {t.forcePassword.pendingBadge}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="flex flex-col items-end gap-1.5">
                        <RoleManager
                          userId={u.id}
                          currentRole={u.role}
                          gh={u.gh}
                          currentImmeuble={u.immeuble}
                          actorRole={user.role}
                          canManage={canManageUser(user, u)}
                        />
                        {u.mustChangePassword && !isImmune(u) && canManageUser(user, u) && (
                          <AdminUnlockPasswordButton userId={u.id} />
                        )}
                        {canManageUser(user, u) && (
                          <AdminUserRowActions
                            userId={u.id}
                            canManage={canManageUser(user, u)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table> */

          </Card>
        </section>
      )}

      {/* ---------------- Configuration ---------------- */}
      {canConfigure && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold text-slate-900">
            {t.dashboard.configTitle}
          </h2>
          <Card>
            <CardHeader>
              <CardTitle>{t.dashboard.configSubtitle}</CardTitle>
            </CardHeader>
            <CardContent>
              <SettingsForm
                delayHours={settings.validationDelayHours}
                reportThreshold={settings.reportThreshold}
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* ---------------- Dernières publications ---------------- */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">{t.dashboard.recentPubs}</h2>
          <Link href="/feed" className="text-sm font-semibold text-indigo-600 hover:underline">
            {t.common.seeAll} →
          </Link>
        </div>
        {recentFeed.length === 0 ? (
          <EmptyState icon="📭" title={t.dashboard.nothingToShow} />
        ) : (
          <div className="space-y-3">
            {recentFeed.map((item) => (
              <PublicationCard
                key={item.id}
                pub={item}
                href={`/publications/${item.id}`}
                t={t}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
