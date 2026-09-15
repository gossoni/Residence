"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addCommentAction,
  changePasswordAction,
  createPublicationAction,
  loginAction,
  logoutAction,
  markNotificationsReadAction,
  moderateCommentAction,
  moderatePublicationAction,
  registerAction,
  reportAction,
  updateProfileAction,
  voteInPollAction,
  updateSettingsAction,
  updateUserRoleAction,
  userStatusAction,
  voteAction,
} from "@/app/actions";
import { cn } from "@/lib/cn";
import { buildingsOf, ghLabel, type Role, type Scope } from "@/lib/structure";
import { REPORT_REASONS_I18N, scopeLabel } from "@/lib/i18n";
import { assignableRoles } from "@/lib/hierarchy";

const ROLE_LABELS_LOCAL: Record<string, string> = {
  admin: "Administrateur",
  president: "Président",
  gh_manager: "Resp. de Groupe",
  building_manager: "Resp. d’Immeuble",
  owner: "Propriétaire",
};
import { useLocale, useT } from "./locale-provider";
import { deadlineLabel, formatDate } from "@/lib/format";
import type { ActionState } from "@/lib/logic";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Dialog,
  FieldError,
  Input,
  Label,
  ProgressBar,
  Select,
  Textarea,
} from "./ui";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export function LoginForm() {
  const [state, dispatch, pending] = useActionState(loginAction, {});
  const t = useT();
  return (
    <form action={dispatch} className="space-y-4">
      <div>
        <Label htmlFor="email">{t.common.email}</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" placeholder="vous@exemple.fr" />
      </div>
      <div>
        <Label htmlFor="password">{t.auth.password}</Label>
        <Input id="password" name="password" type="password" required autoComplete="current-password" placeholder="••••••••" />
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" className="w-full" loading={pending} size="lg">
        {t.auth.login}
      </Button>
    </form>
  );
}

export function LogoutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={logoutAction}>
      <Button variant="outline" size="sm" type="submit">
        {compact ? "Déconnexion" : "Se déconnecter"}
      </Button>
    </form>
  );
}

export function RegisterForm() {
  const [state, dispatch, pending] = useActionState(registerAction, {});
  const [gh, setGh] = useState(1);
  const buildings = buildingsOf(gh);
  const t = useT();
  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="nom">{t.common.lastName}</Label>
          <Input id="nom" name="nom" required placeholder="Martin" />
        </div>
        <div>
          <Label htmlFor="prenom">{t.common.firstName}</Label>
          <Input id="prenom" name="prenom" required placeholder="Jean" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="email">{t.common.email}</Label>
          <Input id="email" name="email" type="email" required placeholder="vous@exemple.fr" />
        </div>
        <div>
          <Label htmlFor="telephone">{t.common.phone}</Label>
          <Input id="telephone" name="telephone" type="tel" required placeholder="+33 6 12 34 56 78" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="gh">{t.common.gh}</Label>
          <Select
            id="gh"
            name="gh"
            value={gh}
            onChange={(e) => setGh(Number(e.target.value))}
            required
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                GH{n}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="immeuble">{t.common.building}</Label>
          <Select id="immeuble" name="immeuble" required>
            {buildings.map((b) => (
              <option key={b} value={b}>
                {t.common.building} {b}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="appartement">{t.common.apartment}</Label>
          <Input id="appartement" name="appartement" required placeholder="ex. 24" />
        </div>
      </div>
      <div>
        <Label htmlFor="password">{t.auth.password}</Label>
        <Input id="password" name="password" type="password" required minLength={8} placeholder={t.auth.passwordHint} />
      </div>
      <Alert tone="indigo">{t.auth.registerInfo}</Alert>
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" className="w-full" size="lg" loading={pending}>
        {t.auth.register}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Publication                                                         */
/* ------------------------------------------------------------------ */

export function NewPublicationForm({
  role,
  gh,
  immeuble,
  delayHours,
  enabledTypes = ["texte", "fichier", "tache_evenement", "sondage"],
}: {
  role: Role;
  gh: number;
  immeuble: string | null;
  delayHours: number;
  enabledTypes?: string[];
}) {
  const router = useRouter();
  const t = useT();
  const [state, dispatch, pending] = useActionState(createPublicationAction, {});
  // Obligatoire : onSubmit est un gestionnaire d'événement asynchrone, donc
  // l'appel de `dispatch` doit passer par une transition (sinon React signale
  // « called outside of a transition » et isPending n'est pas fiable).
  const [, startTransition] = useTransition();
  const [type, setType] = useState(enabledTypes[0] ?? "texte");
  const [scope, setScope] = useState<Scope>(
    role === "building_manager" ? "immeuble" : "residence",
  );
  const [selectedGh, setSelectedGh] = useState(gh);
  const [file, setFile] = useState<File | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const canChooseGh = role === "president";
  const isScopeGroupe = scope === "groupe";
  const isScopeImmeuble = scope === "immeuble";
  const buildings = buildingsOf(selectedGh);
  const needsVote =
    (role === "gh_manager" && scope === "residence") ||
    (role === "building_manager" && scope === "groupe");

  useEffect(() => {
    if (state.ok && state.publicationId) {
      router.push(`/publications/${state.publicationId}`);
    }
    if (state.ok && !state.publicationId) router.refresh();
  }, [state, router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    if (type === "fichier" && file) {
      if (file.size > 20 * 1024 * 1024) {
        window.alert("Fichier trop volumineux (maximum 20 Mo).");
        return;
      }
      const upload = new FormData();
      upload.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: upload });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error ?? "Échec de l’envoi du fichier.");
        return;
      }
      fd.set("fileUrl", data.url);
      fd.set("fileName", data.fileName);
      fd.set("fileMime", data.mime);
      fd.set("fileSize", String(data.size));
    }
    startTransition(() => {
      dispatch(fd);
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-5">
      <div>
        <Label htmlFor="type">Type de publication</Label>
        <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value)}>
          {enabledTypes.includes("texte") && (
            <option value="texte">{t.pub.typeText}</option>
          )}
          {enabledTypes.includes("fichier") && (
            <option value="fichier">{t.pub.typeFile}</option>
          )}
          {enabledTypes.includes("tache_evenement") && (
            <option value="tache_evenement">{t.pub.typeTask}</option>
          )}
          {enabledTypes.includes("sondage") && (
            <option value="sondage">{t.poll.type}</option>
          )}
        </Select>
        {["texte", "fichier", "tache_evenement", "sondage"].filter(
          (x) => !enabledTypes.includes(x),
        ).length > 0 && (
          <p className="mt-1 text-xs text-slate-400">{t.pubTypes.disabledNotice}</p>
        )}
      </div>

      <div>
        <Label htmlFor="titre">{t.pub.title}</Label>
        <Input id="titre" name="titre" required placeholder={t.pub.titlePlaceholder} />
      </div>

      <div>
        <Label htmlFor="contenu">{t.pub.content}</Label>
        <Textarea id="contenu" name="contenu" rows={6} required placeholder={t.pub.contentPlaceholder} />
      </div>

      {type === "fichier" && (
        <div>
          <Label htmlFor="file">{t.pub.fileLabel}</Label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".pdf,.zip,image/*,application/zip,application/x-zip-compressed"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          {file && (
            <p className="mt-1 text-xs text-slate-500">
              {file.name.toLowerCase().endsWith(".zip") ? "🗜️" : "📎"} {file.name}
            </p>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            {t.pub.fileHint}
          </p>
        </div>
      )}

      {type === "tache_evenement" && (
        <div>
          <Label htmlFor="eventAt">{t.pub.eventDate}</Label>
          <Input id="eventAt" name="eventAt" type="datetime-local" required />
        </div>
      )}

      {type === "sondage" && <PollOptionsEditor />}

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="scope">{t.pub.scope}</Label>
          <Select
            id="scope"
            name="scope"
            value={scope}
            onChange={(e) => setScope(e.target.value as Scope)}
          >
            {role === "president" || role === "gh_manager" ? (
              <option value="residence">{t.scopes.residence}</option>
            ) : null}
            <option value="groupe">{t.scopes.groupe} ({ghLabel(gh)})</option>
            <option value="immeuble">{t.scopes.immeuble}</option>
          </Select>
        </div>

        {(isScopeGroupe || isScopeImmeuble) && (
          <div>
            <Label htmlFor="pubGh">{t.pub.targetGh}</Label>
            {canChooseGh ? (
              <Select id="pubGh" name="pubGh" value={selectedGh} onChange={(e) => setSelectedGh(Number(e.target.value))}>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {ghLabel(n)} ({buildingsOf(n).length} immeubles)
                  </option>
                ))}
              </Select>
            ) : (
              <Input value={ghLabel(gh)} disabled />
            )}
            {!canChooseGh && <input type="hidden" name="pubGh" value={selectedGh} />}
          </div>
        )}

        {isScopeImmeuble && (
          <div>
            <Label htmlFor="pubImmeuble">{t.pub.targetBuilding}</Label>
            {canChooseGh || role === "gh_manager" ? (
              <Select
                id="pubImmeuble"
                name="pubImmeuble"
                defaultValue={immeuble ?? buildings[0]}
                required
              >
                {buildings.map((b) => (
                  <option key={b} value={b}>
                    Immeuble {b}
                  </option>
                ))}
              </Select>
            ) : (
              <>
                <Input value={immeuble ? `Immeuble ${immeuble}` : ""} disabled />
                <input type="hidden" name="pubImmeuble" value={immeuble ?? ""} />
              </>
            )}
          </div>
        )}
      </div>

      <Alert tone={needsVote ? "amber" : "emerald"}>
        {needsVote ? (
          <>
            {t.pub.voteRequired}{" "}
            <strong>
              {scope === "residence" ? t.pub.voteRequiredResidence : t.pub.voteRequiredGroup}
            </strong>
            . {t.pub.autoValidateSuffix}
          </>
        ) : (
          <>
            {role === "admin" || role === "president"
              ? t.pub.presidentialPublish
              : t.pub.immediatePublish}
          </>
        )}
      </Alert>

      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" size="lg" loading={pending}>
        {t.pub.publish}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Votes                                                               */
/* ------------------------------------------------------------------ */

export function VoteControls({
  pubId,
  canVote,
  myVote,
  votesPour,
  votesContre,
  totalVoix,
  majorite,
  status,
  deadline,
}: {
  pubId: number;
  canVote: boolean;
  myVote: "oui" | "non" | null;
  votesPour: number;
  votesContre: number;
  totalVoix: number;
  majorite: number;
  status: string;
  deadline: Date | string | null;
}) {
  const router = useRouter();
  const t = useT();
  const [state, dispatch, pending] = useActionState(voteAction, {});
  const total = Math.max(totalVoix, votesPour + votesContre);
  const pourPct = total ? (votesPour / total) * 100 : 0;
  const contrePct = total ? (votesContre / total) * 100 : 0;

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  if (status !== "en_validation") return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">{t.pub.votePanel}</p>
        <Badge tone="amber">{deadline ? deadlineLabel(deadline) : t.pub.noDeadline}</Badge>
      </div>

      <div className="space-y-2 rounded-lg bg-slate-50 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-emerald-700">{t.pub.approvedLabel}</span>
          <span className="font-semibold text-slate-700">
            {votesPour} / {totalVoix} {t.common.votes}
          </span>
        </div>
        <ProgressBar percent={pourPct} tone="emerald" />
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-rose-700">{t.pub.rejectedLabel}</span>
          <span className="font-semibold text-slate-700">
            {votesContre} / {totalVoix} {t.common.votes}
          </span>
        </div>
        <ProgressBar percent={contrePct} tone="rose" />
        <p className="pt-1 text-[11px] text-slate-500">
          {t.common.majorityRequired} : <strong>{majorite} {t.common.votes}</strong> / {totalVoix}. {t.common.autoValidationHint}
        </p>
      </div>

      {canVote ? (
        <form action={dispatch} className="flex gap-3">
          <input type="hidden" name="pubId" value={pubId} />
          {myVote ? (
            <Alert tone="indigo" className="w-full">
              {t.pub.voteRecorded} : <strong>{myVote === "oui" ? t.pub.approve : t.pub.reject}</strong>. {t.pub.voteChangeAllowed}
            </Alert>
          ) : (
            <>
              <button
                type="submit"
                name="choix"
                value="oui"
                disabled={pending}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition",
                  "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-60",
                )}
              >
                {t.pub.approve}
              </button>
              <button
                type="submit"
                name="choix"
                value="non"
                disabled={pending}
                className={cn(
                  "flex-1 rounded-lg border px-4 py-2.5 text-sm font-semibold transition",
                  "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-60",
                )}
              >
                {t.pub.reject}
              </button>
            </>
          )}
        </form>
      ) : (
        <p className="text-xs text-slate-500">{t.pub.onlyManagersVote}</p>
      )}
      {state.error && <Alert>{state.error}</Alert>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Commentaires                                                        */
/* ------------------------------------------------------------------ */

export function CommentForm({ pubId }: { pubId: number }) {
  const router = useRouter();
  const t = useT();
  const [state, dispatch, pending] = useActionState(addCommentAction, {});
  const [text, setText] = useState("");

  useEffect(() => {
    if (state.ok) {
      setText("");
      router.refresh();
    }
  }, [state, router]);

  return (
    <form action={dispatch} className="space-y-3">
      <input type="hidden" name="pubId" value={pubId} />
      <Textarea
        name="contenu"
        rows={3}
        required
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.pub.writeComment}
      />
      {state.error && <FieldError>{state.error}</FieldError>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" loading={pending}>
          {t.pub.comment}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Signalement                                                         */
/* ------------------------------------------------------------------ */

export function ReportButton({
  targetType,
  targetId,
  label,
}: {
  targetType: "publication" | "comment";
  targetId: number;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useActionState(reportAction, {});
  const router = useRouter();
  const t = useT();
  const locale = useLocale();
  const btnLabel = label ?? t.pub.report;

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
        🚩 {btnLabel}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t.pub.reportTitle}>
        <form action={dispatch} className="space-y-4">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <div>
            <Label htmlFor="reason">{t.pub.reportReason}</Label>
            <Select id="reason" name="reason" required>
              {REPORT_REASONS_I18N.map((r) => (
                <option key={r.value} value={r.value}>
                  {locale === "ar" ? r.ar : r.fr}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="details">{t.pub.reportDetails}</Label>
            <Textarea id="details" name="details" rows={3} placeholder={t.pub.reportDetailsPlaceholder} />
          </div>
          {state.error && <Alert>{state.error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              {t.pub.sendReport}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Modération                                                          */
/* ------------------------------------------------------------------ */

export function PublicationModeration({
  pubId,
  status,
  reason,
}: {
  pubId: number;
  status: string;
  reason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, dispatch, pending] = useActionState(moderatePublicationAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status === "publiee" && (
          <Button type="button" size="sm" variant="danger" onClick={() => setOpen(true)}>
            🚫 Bloquer cette publication
          </Button>
        )}
        {status === "masquee" && (
          <form action={dispatch}>
            <input type="hidden" name="pubId" value={pubId} />
            <input type="hidden" name="decision" value="restaurer" />
            <Button type="submit" size="sm" variant="success">
              ✅ Restaurer la publication
            </Button>
          </form>
        )}
        {(status === "masquee" || status === "bloquee") && (
          <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
            Bloquer définitivement
          </Button>
        )}
        {status === "en_validation" && (
          <>
            <form action={dispatch}>
              <input type="hidden" name="pubId" value={pubId} />
              <input type="hidden" name="decision" value="forcer_approbation" />
              <Button type="submit" size="sm" variant="success">
                ✅ Valider manuellement
              </Button>
            </form>
            <form action={dispatch}>
              <input type="hidden" name="pubId" value={pubId} />
              <input type="hidden" name="decision" value="forcer_rejet" />
              <Button type="submit" size="sm" variant="danger">
                ⛔ Rejeter manuellement
              </Button>
            </form>
          </>
        )}
      </div>
      {reason && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          <strong>Justification :</strong> {reason}
        </p>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Bloquer la publication">
        <form action={dispatch} className="space-y-4">
          <input type="hidden" name="pubId" value={pubId} />
          <input type="hidden" name="decision" value="bloquer" />
          <div>
            <Label htmlFor="reason">Justification (visible par l’auteur)</Label>
            <Textarea id="reason" name="reason" rows={3} required placeholder="Motif du blocage…" />
          </div>
          {state.error && <Alert>{state.error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Bloquer
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export function CommentModeration({
  commentId,
  blocked,
  blockedReason,
  pubId,
}: {
  commentId: number;
  blocked: boolean;
  blockedReason: string | null;
  pubId: number;
}) {
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(moderateCommentAction, {});
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  return (
    <>
      {blocked ? (
        <form action={dispatch}>
          <input type="hidden" name="commentId" value={commentId} />
          <input type="hidden" name="decision" value="restaurer" />
          <Button type="submit" size="sm" variant="outline" loading={pending}>
            Restaurer
          </Button>
        </form>
      ) : (
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(true)}>
          Bloquer
        </Button>
      )}
      {blocked && blockedReason && (
        <p className="text-[11px] text-slate-500">({blockedReason})</p>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title="Bloquer le commentaire">
        <form action={dispatch} className="space-y-4">
          <input type="hidden" name="commentId" value={commentId} />
          <input type="hidden" name="decision" value="bloquer" />
          <div>
            <Label htmlFor="reason">Justification</Label>
            <Textarea id="reason" name="reason" rows={3} required placeholder="Motif du blocage…" />
          </div>
          {state.error && <Alert>{state.error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" variant="danger" loading={pending}>
              Bloquer
            </Button>
          </div>
        </form>
      </Dialog>
      <input type="hidden" value={pubId} readOnly />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Gestion des comptes (dashboard)                                     */
/* ------------------------------------------------------------------ */

export function UserStatusButtons({
  userId,
  status,
  mustChangePassword = false,
  canManage = true,
}: {
  userId: number;
  status: string;
  mustChangePassword?: boolean;
  canManage?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [state, dispatch, pending] = useActionState(userStatusAction, {});
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  if (!canManage) return null;

  return (
    <form action={dispatch} className="flex gap-2">
      <input type="hidden" name="userId" value={userId} />
      {status === "provisoire" && (
        <button
          type="submit"
          name="decision"
          value="valider"
          disabled={pending}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          ✓ Valider
        </button>
      )}
      {status === "actif" && (
        <button
          type="submit"
          name="decision"
          value="bloquer"
          disabled={pending}
          className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-60"
        >
          Bloquer
        </button>
      )}
      {status === "bloque" && (
        <button
          type="submit"
          name="decision"
          value="activer"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          Réactiver
        </button>
      )}
      {mustChangePassword && (
        <span className="text-[10px] font-semibold text-amber-600">🔑</span>
      )}
      {state.error && <span className="text-xs text-rose-600">{state.error}</span>}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Paramètres                                                          */
/* ------------------------------------------------------------------ */

export function SettingsForm({
  delayHours,
  reportThreshold,
}: {
  delayHours: number;
  reportThreshold: number;
}) {
  const t = useT();
  const [state, dispatch, pending] = useActionState(updateSettingsAction, {});
  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="delayHours">{t.settings.delayLabel}</Label>
          <Input
            id="delayHours"
            name="delayHours"
            type="number"
            min={1}
            max={720}
            defaultValue={delayHours}
            required
          />
          <p className="mt-1 text-xs text-slate-500">
            {t.settings.delayHelp}
          </p>
        </div>
        <div>
          <Label htmlFor="reportThreshold">{t.settings.thresholdLabel}</Label>
          <Input
            id="reportThreshold"
            name="reportThreshold"
            type="number"
            min={1}
            max={100}
            defaultValue={reportThreshold}
            required
          />
        </div>
      </div>
      {state.ok && <Alert tone="emerald">{t.settings.saved}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending}>
        {t.settings.save}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Notifications (cloche)                                              */
/* ------------------------------------------------------------------ */

type BellItem = {
  id: number;
  titre: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BellItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [live, setLive] = useState(false);
  const router = useRouter();

  async function refresh() {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items ?? []);
        setUnread(data.unread ?? 0);
      }
    } catch {
      /* silencieux */
    }
  }

  useEffect(() => {
    refresh();
    // Diffusion temps réel via Server-Sent Events, avec repli sur un
    // rafraîchissement périodique si le flux est indisponible.
    let source: EventSource | null = null;
    let fallback: ReturnType<typeof setInterval> | null = null;

    const startFallback = () => {
      if (fallback) return;
      fallback = setInterval(refresh, 20000);
    };

    try {
      source = new EventSource("/api/notifications/stream");
      source.addEventListener("ready", () => setLive(true));
      source.addEventListener("notification", () => refresh());
      source.onerror = () => {
        setLive(false);
        source?.close();
        startFallback();
      };
    } catch {
      startFallback();
    }

    return () => {
      source?.close();
      if (fallback) clearInterval(fallback);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          refresh();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-slate-100"
        aria-label="Notifications"
        title={`Connecté : ${userName}`}
      >
        🔔
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
        {live && (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white"
            title="Notifications en temps réel actives"
          />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-800">Notifications</p>
              {unread > 0 && (
                <form
                  action={markNotificationsReadAction}
                  onSubmit={() => {
                    setTimeout(() => {
                      router.refresh();
                      refresh();
                    }, 500);
                  }}
                >
                  <button type="submit" className="text-xs font-medium text-indigo-600 hover:underline">
                    Tout marquer comme lu
                  </button>
                </form>
              )}
            </div>
            <div className="max-h-96 overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-500">Aucune notification.</p>
              )}
              {items.map((n) => (
                <a
                  key={n.id}
                  href={n.link ?? "/dashboard"}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "block border-b border-slate-50 px-4 py-3 transition hover:bg-slate-50",
                    !n.read && "bg-indigo-50/60",
                  )}
                >
                  <p className="text-[13px] font-semibold text-slate-800">{n.titre}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">{n.body}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                    {formatDate(n.createdAt, true)}
                  </p>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lien de vote rapide (dashboard)                                     */
/* ------------------------------------------------------------------ */

export function VoteNowLink({ pubId }: { pubId: number }) {
  return <a href={`/publications/${pubId}`}>Voter maintenant →</a>;
}

/* ------------------------------------------------------------------ */
/* Gestion des rôles (Président)                                       */
/* ------------------------------------------------------------------ */

export function RoleManager({
  userId,
  currentRole,
  gh,
  currentImmeuble,
  actorRole = "president",
  canManage = true,
}: {
  userId: number;
  currentRole: string;
  gh: number;
  currentImmeuble: string | null;
  actorRole?: string;
  canManage?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const [state, dispatch, pending] = useActionState(updateUserRoleAction, {});
  const allowed = assignableRoles({
    role: actorRole,
    gh,
    immeuble: currentImmeuble,
    status: "actif",
  } as never);
  const [role, setRole] = useState(
    allowed.includes(currentRole) ? currentRole : (allowed[allowed.length - 1] ?? "owner"),
  );
  const buildings = buildingsOf(gh);
  const isTopLevel = actorRole === "admin" || actorRole === "president";

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  if (currentRole === "admin")
    return <Badge tone="rose">Administrateur</Badge>;
  if (currentRole === "president" && actorRole !== "admin")
    return <Badge tone="amber">Président</Badge>;
  if (!canManage || allowed.length === 0)
    return <Badge tone="slate">{ROLE_LABELS_LOCAL[currentRole] ?? currentRole}</Badge>;

  return (
    <form action={dispatch} className="flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="userId" value={userId} />
      <Select
        name="role"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        className="h-8 w-auto min-w-36 text-xs"
      >
        {allowed.includes("owner") && (
          <option value="owner">{t.roleManager.owner}</option>
        )}
        {allowed.includes("building_manager") && (
          <option value="building_manager">
            {t.roleManager.building_manager}
          </option>
        )}
        {allowed.includes("gh_manager") && (
          <option value="gh_manager">{t.roleManager.gh_manager}</option>
        )}
      </Select>
      {role === "building_manager" && (
        <Select name="immeuble" defaultValue={currentImmeuble ?? buildings[0]} className="h-8 w-auto text-xs">
          {buildings.map((b) => (
            <option key={b} value={b}>
              Imm. {b}
            </option>
          ))}
        </Select>
      )}
      <Button
        type="submit"
        size="sm"
        variant="outline"
        loading={pending}
        disabled={!isTopLevel}
      >
        {t.common.apply}
      </Button>
      {state.error && <span className="w-full text-[11px] text-rose-600">{state.error}</span>}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Profil                                                              */
/* ------------------------------------------------------------------ */

export function ProfileForm({ telephone }: { telephone: string | null }) {
  const t = useT();
  const [state, dispatch, pending] = useActionState(updateProfileAction, {});
  return (
    <form action={dispatch} className="space-y-4">
      <div>
        <Label htmlFor="telephone">{t.common.phone}</Label>
        <Input id="telephone" name="telephone" type="tel" defaultValue={telephone ?? ""} required />
      </div>
      <div className="border-t border-slate-100 pt-4">
        <p className="mb-3 text-sm font-semibold text-slate-700">{t.profile.changePassword}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="currentPassword">{t.profile.currentPassword}</Label>
            <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" />
          </div>
          <div>
            <Label htmlFor="newPassword">{t.profile.newPassword}</Label>
            <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} />
          </div>
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          {t.profile.passwordOptional}
        </p>
      </div>
      {state.ok && <Alert tone="emerald">{t.profile.updated}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending}>
        Enregistrer
      </Button>
    </form>
  );
}

export function ForcedPasswordChangeForm({ email }: { email: string }) {
  const t = useT();
  const [state, dispatch, pending] = useActionState(changePasswordAction, {});
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const router = useRouter();

  const mismatch = confirm.length > 0 && next !== confirm;

  useEffect(() => {
    if (state.ok) {
      const id = setTimeout(() => {
        router.push("/feed");
        router.refresh();
      }, 1500);
      return () => clearTimeout(id);
    }
  }, [state, router]);

  return (
    <form action={dispatch} className="space-y-4">
      <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        <strong>{t.common.email}</strong> : {email}
      </p>
      <div>
        <Label htmlFor="fp-current">{t.forcePassword.current}</Label>
        <Input
          id="fp-current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div>
        <Label htmlFor="fp-new">{t.forcePassword.newLabel}</Label>
        <Input
          id="fp-new"
          name="newPassword"
          type="password"
          required
          minLength={8}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          autoComplete="new-password"
        />
        <p className="mt-1 text-xs text-slate-400">{t.auth.passwordHint}</p>
      </div>
      <div>
        <Label htmlFor="fp-confirm">{t.forcePassword.confirm}</Label>
        <Input
          id="fp-confirm"
          name="confirm"
          type="password"
          required
          minLength={8}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="new-password"
        />
        {mismatch && <FieldError>{t.forcePassword.mismatch}</FieldError>}
      </div>
      {state.ok && <Alert tone="emerald">{t.forcePassword.success}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <Button
        type="submit"
        className="w-full"
        size="lg"
        loading={pending}
        disabled={mismatch}
      >
        {t.forcePassword.submit}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Sondages                                                            */
/* ------------------------------------------------------------------ */

/** Éditeur d'options de sondage dans le formulaire de création. */
export function PollOptionsEditor() {
  const t = useT();
  const [options, setOptions] = useState<string[]>(["", ""]);

  function update(i: number, value: string) {
    setOptions((prev) => prev.map((o, idx) => (idx === i ? value : o)));
  }
  function remove(i: number) {
    setOptions((prev) => (prev.filter((_, idx) => idx !== i)));
  }
  function add() {
    setOptions((prev) => [...prev, ""]);
  }

  return (
    <div className="space-y-3 rounded-xl bg-slate-50 p-4 ring-1 ring-inset ring-slate-200">
      <p className="text-sm font-semibold text-slate-800">{t.poll.options}</p>
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            name="pollOption"
            value={opt}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`${t.poll.optionPlaceholder} ${i + 1}`}
            className="bg-white"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => remove(i)}
            disabled={options.length <= 2}
            title={t.poll.removeOption}
          >
            ✕
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-4">
        <Button type="button" variant="outline" size="sm" onClick={add}>
          {t.poll.addOption}
        </Button>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <input
            type="checkbox"
            name="pollMultiple"
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          {t.poll.multiple}
        </label>
      </div>
      <p className="text-xs text-slate-500">{t.poll.multipleHint}</p>
      <div>
        <Label htmlFor="pollEndsAt">{t.poll.endsAt}</Label>
        <Input id="pollEndsAt" name="pollEndsAt" type="datetime-local" />
      </div>
      <Alert tone="indigo">👥 {t.poll.allMembers}</Alert>
      {options.filter((o) => o.trim().length > 0).length < 2 && (
        <FieldError>{t.poll.needTwo}</FieldError>
      )}
    </div>
  );
}

/** Participation à un sondage + résultats en direct. */
export function PollVotePanel({
  pubId,
  options,
  multiple,
  isOpen,
  counts,
  voters,
  totalVotes,
  myChoice,
  canParticipate,
}: {
  pubId: number;
  options: string[];
  multiple: boolean;
  isOpen: boolean;
  counts: number[];
  voters: number;
  totalVotes: number;
  myChoice: number[];
  canParticipate: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(voteInPollAction, {} as {
    ok?: boolean;
    error?: string;
  });
  const [selected, setSelected] = useState<number[]>(myChoice);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  function toggle(i: number) {
    setSelected((prev) =>
      multiple
        ? prev.includes(i)
          ? prev.filter((x) => x !== i)
          : [...prev, i]
        : [i],
    );
  }

  const hasVoted = myChoice.length > 0;

  return (
    <div className="space-y-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-slate-900">
          📊 {t.poll.type} — {t.poll.results}
        </p>
        <Badge tone={isOpen ? "emerald" : "rose"}>
          {isOpen ? t.poll.open : t.poll.closed}
        </Badge>
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-slate-500">{t.poll.noOptions}</p>
      ) : (
        <div className="space-y-2.5">
          {options.map((opt, i) => {
            const pct = totalVotes > 0 ? Math.round((counts[i] / totalVotes) * 100) : 0;
            const mine = myChoice.includes(i);
            const picked = selected.includes(i);
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 font-medium text-slate-800">
                    {canParticipate && isOpen ? (
                      <input
                        type={multiple ? "checkbox" : "radio"}
                        name="pollOptionPick"
                        checked={picked}
                        onChange={() => toggle(i)}
                        className="h-4 w-4 rounded-full border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    ) : (
                      <span className="w-4" />
                    )}
                    {opt}
                    {mine && <span title={t.poll.yourChoice}>👤</span>}
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-slate-600">
                    {counts[i]} {t.poll.votes} · {pct}%
                  </span>
                </div>
                <ProgressBar percent={pct} tone={mine ? "indigo" : "emerald"} />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-indigo-100 pt-3 text-xs text-slate-600">
        <span>
          👥 {voters} {t.poll.participants} · {totalVotes} {t.poll.votes}
        </span>
        {hasVoted && (
          <Badge tone="indigo">
            {t.poll.myVote}: {myChoice.map((i) => options[i]).join(", ")}
          </Badge>
        )}
      </div>

      {canParticipate && isOpen && (
        <form action={dispatch} className="space-y-2">
          <input type="hidden" name="pubId" value={pubId} />
          {selected.map((i) => (
            <input key={i} type="hidden" name="optionIndex" value={i} />
          ))}
          <Button type="submit" loading={pending} disabled={selected.length === 0}>
            {hasVoted ? t.poll.changeVote : t.poll.submitVote}
          </Button>
          {state.ok && <Alert tone="emerald">{t.poll.voted}</Alert>}
          {state.error && <Alert>{state.error}</Alert>}
        </form>
      )}
    </div>
  );
}
