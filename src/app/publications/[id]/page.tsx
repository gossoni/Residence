import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireActiveUser } from "@/lib/auth";
import {
  canModeratePublication,
  canSeePublication,
  canVoteInPoll,
  canVoteOn,
  getMyVote,
  getPollResults,
  isPollOpen,
  openReportCountFor,
  sweepExpiredPublications,
} from "@/lib/logic";
import {
  getCommentCount,
  getPublicationDetail,
  listComments,
} from "@/lib/queries";
import { fileIcon, formatBytes, formatDate, isImageMime, isZipMime } from "@/lib/format";
import { ghLabel } from "@/lib/structure";
import { getT } from "@/lib/i18n-server";
import { pubStatusLabel, pubTypeLabel, scopeLabel } from "@/lib/i18n";
import { Alert, Avatar, Badge, Card, CardContent } from "@/components/ui";
import { AuthorLine } from "@/components/publication-card";
import {
  CommentForm,
  CommentModeration,
  PollVotePanel,
  PublicationModeration,
  ReportButton,
  VoteControls,
} from "@/components/client-forms";
import { initials } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const pub = await getPublicationDetail(Number(id));
  return { title: pub ? pub.titre : "Publication" };
}

export default async function PublicationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pubId = Number(id);
  if (!Number.isInteger(pubId)) notFound();

  const [user, { t }] = await Promise.all([requireActiveUser(), getT()]);
  await sweepExpiredPublications();

  const pub = await getPublicationDetail(pubId);
  if (!pub) notFound();

  const inScope = canSeePublication(pub, user);
  const isAuthor = user.id === pub.authorId;
  const canMod = canModeratePublication(user, pub);
  const canVote = canVoteOn(pub, user);
  const visible = pub.status === "publiee" && inScope;
  const accessible = visible || isAuthor || canMod || canVote;

  const comments = visible ? await listComments(pubId) : [];
  const commentCount = await getCommentCount(pubId);
  const openReports = await openReportCountFor("publication", pubId);
  const myVote = (canVote || canMod || isAuthor) ? await getMyVote(pubId, user.id) : null;

  // Sondage : résultats et droit de participation (propriétaires inclus).
  const isPoll = pub.type === "sondage";
  const poll = isPoll
    ? await getPollResults(pubId, user.id)
    : {
        options: [] as string[],
        counts: [] as number[],
        totalVotes: 0,
        voters: 0,
        myChoice: [] as number[],
      };
  const pollOpen = isPoll ? isPollOpen(pub) : false;
  const canPoll = isPoll ? canVoteInPoll(pub, user) : false;

  if (!accessible) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-12">
        <Card className="p-10 text-center">
          <span className="text-4xl">🔒</span>
          <h1 className="mt-4 text-xl font-bold text-slate-900">
            {t.pub.contentUnavailable}
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Cette publication est hors de votre périmètre, en attente de validation ou a été
            retirée par la modération.
          </p>
        </Card>
      </main>
    );
  }

  const scopeTone = pub.scope === "residence" ? "indigo" : pub.scope === "groupe" ? "sky" : "emerald";
  const statusTone: Record<string, "amber" | "emerald" | "rose" | "slate" | "indigo" | "sky"> = {
    en_validation: "amber",
    publiee: "emerald",
    rejetee: "rose",
    masquee: "rose",
    bloquee: "rose",
  };
  const isImage = isImageMime(pub.fileMime);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Card>
        <CardContent className="p-5 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={scopeTone}>
              {pub.scope === "residence" ? "🏘️" : pub.scope === "groupe" ? "🏢" : "🏠"}{" "}
              {scopeLabel(t, pub.scope)}
              {pub.gh ? ` · ${ghLabel(pub.gh)}${pub.immeuble ? ` · Immeuble ${pub.immeuble}` : ""}` : ""}
            </Badge>
            <Badge tone="slate">{pubTypeLabel(t, pub.type)}</Badge>
            <Badge tone={statusTone[pub.status] ?? "slate"}>
              {pubStatusLabel(t, pub.status)}
            </Badge>
            {openReports > 0 && (
              <Badge tone="rose">🚩 {openReports} signalement{openReports > 1 ? "s" : ""} ouvert{openReports > 1 ? "s" : ""}</Badge>
            )}
          </div>

          <h1 className="mt-4 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
            {pub.titre}
          </h1>

          <div className="mt-5">
            <AuthorLine
              prenom={pub.authorPrenom}
              nom={pub.authorNom}
              role={pub.authorRole}
              gh={pub.authorGh}
              immeuble={pub.authorImmeuble}
              date={pub.publishedAt ?? pub.createdAt}
              t={t}
            />
          </div>

          <div className="mt-6 whitespace-pre-line rounded-xl bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-800 sm:p-5">
            {pub.contenu}
          </div>

          {isPoll && (
            <div className="mt-6">
              <PollVotePanel
                pubId={pub.id}
                options={poll.options}
                multiple={pub.pollMultiple}
                isOpen={pollOpen}
                counts={poll.counts}
                voters={poll.voters}
                totalVotes={poll.totalVotes}
                myChoice={poll.myChoice}
                canParticipate={canPoll}
              />
            </div>
          )}

          {pub.eventAt && (
            <Alert tone="amber" className="mt-4">
              📅 {pub.type === "tache_evenement" ? "Tâche / Événement" : "Date"} :{" "}
              <strong>{formatDate(pub.eventAt, true)}</strong>
            </Alert>
          )}

          {pub.fileUrl &&
            (isImage ? (
              <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pub.fileUrl}
                  alt={pub.fileName ?? "Image jointe"}
                  className="max-h-[480px] w-full object-contain bg-slate-100"
                />
              </div>
            ) : (
              <a
                href={pub.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                {fileIcon(pub.fileMime, pub.fileName)} {pub.fileName ?? "Télécharger le fichier"}
                {isZipMime(pub.fileMime, pub.fileName) && (
                  <span className="text-xs text-slate-400">(Archive ZIP)</span>
                )}
                {pub.fileSize ? <span className="text-xs text-slate-400">({formatBytes(pub.fileSize)})</span> : null}
              </a>
            ))}

          {(pub.moderationReason || pub.status === "masquee" || pub.status === "bloquee" || pub.status === "rejetee") && (
            <Alert
              tone={pub.status === "rejetee" ? "rose" : "amber"}
              className="mt-5"
            >
              <strong>Statut :</strong> {pubStatusLabel(t, pub.status)}.
              {pub.moderationReason ? ` Justification : ${pub.moderationReason}` : ""}
            </Alert>
          )}

          <div className="mt-6 border-t border-slate-100 pt-5">
            <VoteControls
              pubId={pub.id}
              canVote={canVote}
              myVote={myVote}
              votesPour={pub.votesPour}
              votesContre={pub.votesContre}
              totalVoix={pub.totalVoix}
              majorite={pub.majorite}
              status={pub.status}
              deadline={pub.deadline}
            />
          </div>

          {canMod && (
            <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                {t.pub.moderation}
              </p>
              <PublicationModeration pubId={pub.id} status={pub.status} reason={pub.moderationReason} />
            </div>
          )}

          {pub.status === "publiee" && (
            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">
                {t.common.createdAt} {formatDate(pub.createdAt, true)}
                {pub.publishedAt ? ` · ${t.common.publishedAt} ${formatDate(pub.publishedAt, true)}` : ""}
              </p>
              <ReportButton targetType="publication" targetId={pub.id} />
            </div>
          )}
        </CardContent>
      </Card>

      <section className="mt-8">
        <h2 className="mb-4 text-lg font-bold text-slate-900">
          {t.pub.comments} {commentCount > 0 && <span className="text-slate-400">({commentCount})</span>}
        </h2>

        {pub.status === "publiee" ? (
          <>
            <Card className="mb-4">
              <CardContent className="p-4">
                <CommentForm pubId={pub.id} />
              </CardContent>
            </Card>

            {comments.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">
                Aucun commentaire pour l’instant. Soyez le premier à réagir !
              </p>
            ) : (
              <div className="space-y-3">
                {comments.map((c) => {
                  const showBlocked = c.blocked && (canMod || c.authorId === user.id);
                  return (
                    <Card key={c.id} className={c.blocked ? "opacity-70" : ""}>
                      <CardContent className="flex gap-3 p-4">
                        <Avatar
                          initials={initials(c.authorPrenom, c.authorNom)}
                          className="h-8 w-8 text-[10px]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className="text-sm font-semibold text-slate-800">
                              {c.authorPrenom} {c.authorNom}
                            </span>
                            <span className="text-[10px] uppercase tracking-wide text-slate-400">
                              {formatDate(c.createdAt, true)}
                            </span>
                          </div>
                          {showBlocked ? (
                            <p className="mt-1 rounded-lg bg-slate-100 px-3 py-2 text-xs italic text-slate-500">
                              🚫 {t.pub.commentHidden}{c.blockedReason ? ` — ${c.blockedReason}` : ""}
                            </p>
                          ) : (
                            <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{c.contenu}</p>
                          )}
                          {!showBlocked && (
                            <div className="mt-2 flex items-center gap-2">
                              <ReportButton
                                targetType="comment"
                                targetId={c.id}
                                label="Signaler"
                              />
                              {canMod && (
                                <CommentModeration
                                  commentId={c.id}
                                  blocked={c.blocked}
                                  blockedReason={c.blockedReason}
                                  pubId={pub.id}
                                />
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <Alert tone="slate">
            Les commentaires seront ouverts une fois cette publication validée et diffusée.
          </Alert>
        )}
      </section>
    </main>
  );
}
