"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  adminArchivePublicationAction,
  adminArchiveUserAction,
  adminBatchCreateUsersAction,
  adminChangeOwnPasswordAction,
  adminCreateUserAction,
  adminDeleteCommentAction,
  adminDeletePublicationAction,
  adminDeleteUsersAction,
  adminResetPasswordAction,
  adminToggleLockAction,
  adminUnlockPasswordAction,
  updateBrandingAction,
  updatePubTypesAction,
  updateVoteWeightsAction,
  type AdminActionState,
} from "@/app/actions";
import { buildingsOf, ghLabel } from "@/lib/structure";
import { creatableRoles } from "@/lib/hierarchy";
import { useT } from "./locale-provider";
import { cn } from "@/lib/cn";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
} from "./ui";

/* ------------------------------------------------------------------ */
/*                                                                     */
/*  ⚠️  RÈGLE useActionState / startTransition                          */
/*                                                                     */
/*  La fonction renvoyée par useActionState est une Action React :      */
/*  elle doit être appelée dans une transition, sinon React affiche     */
/*  « An async function with useActionState was called outside of a     */
/*  transition » et `isPending` n'est pas fiable.                       */
/*                                                                     */
/*  ✅ Correct :                                                        */
/*     - <form action={dispatch}>            (React gère la transition) */
/*     - startTransition(() => dispatch(fd))  (appel programmatique)    */
/*                                                                     */
/*  C'est pourquoi tous les appels déclenchés depuis un gestionnaire    */
/*  d'événement (onChange, onClick…) ci-dessous passent par             */
/*  startTransition.                                                    */
/*                                                                     */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/* Création d'un compte par l'Administrateur                           */
/* ------------------------------------------------------------------ */

export function AdminCreateUserForm({
  actorRole,
  actorGh,
  actorImmeuble,
}: {
  actorRole: string;
  actorGh: number;
  actorImmeuble: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState<
    AdminActionState,
    FormData
  >(adminCreateUserAction, {});

  // Rôles créables selon la hiérarchie (Admin > Président > Resp. GH > Resp. Immeuble).
  const allowed = creatableRoles({
    role: actorRole,
    gh: actorGh,
    immeuble: actorImmeuble,
    status: "actif",
  } as never);
  const isTopLevel = actorRole === "admin" || actorRole === "president";

  const [role, setRole] = useState(allowed[allowed.length - 1] ?? "owner");
  const [gh, setGh] = useState(actorGh);
  const buildings = buildingsOf(gh);
  const needsBuilding = role === "building_manager" || role === "owner";

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="a-prenom">{t.common.firstName}</Label>
          <Input id="a-prenom" name="prenom" required />
        </div>
        <div>
          <Label htmlFor="a-nom">{t.common.lastName}</Label>
          <Input id="a-nom" name="nom" required />
        </div>
      </div>
      <div>
        <Label htmlFor="a-email">{t.common.email}</Label>
        <Input id="a-email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="a-telephone">{t.common.phone}</Label>
        <Input id="a-telephone" name="telephone" type="tel" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="a-role">{t.admin.role}</Label>
          <Select
            id="a-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            {allowed.includes("president") && (
              <option value="president">{t.roleManager.president}</option>
            )}
            {allowed.includes("gh_manager") && (
              <option value="gh_manager">{t.roleManager.gh_manager}</option>
            )}
            {allowed.includes("building_manager") && (
              <option value="building_manager">
                {t.roleManager.building_manager}
              </option>
            )}
            {allowed.includes("owner") && (
              <option value="owner">{t.roleManager.owner}</option>
            )}
          </Select>
        </div>
        <div>
          <Label htmlFor="a-gh">{t.common.gh}</Label>
          <Select
            id="a-gh"
            name="gh"
            value={gh}
            onChange={(e) => setGh(Number(e.target.value))}
            required
            disabled={!isTopLevel}
          >
            {(isTopLevel
              ? Array.from({ length: 12 }, (_, i) => i + 1)
              : [actorGh]
            ).map((n) => (
              <option key={n} value={n}>
                {ghLabel(n)}
              </option>
            ))}
          </Select>
        </div>
        {needsBuilding && (
          <div>
            <Label htmlFor="a-immeuble">{t.common.building}</Label>
            <Select
              id="a-immeuble"
              name="immeuble"
              required
              disabled={actorRole === "building_manager"}
              defaultValue={actorImmeuble ?? buildings[0]}
            >
              {(actorRole === "building_manager" && actorImmeuble
                ? [actorImmeuble]
                : buildings
              ).map((b) => (
                <option key={b} value={b}>
                  {t.common.building} {b}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div>
        <Label htmlFor="a-appartement">{t.common.apartment}</Label>
        <Input id="a-appartement" name="appartement" placeholder="ex. 12" />
      </div>
      <div>
        <Label htmlFor="a-password">{t.profile.newPassword}</Label>
        <Input
          id="a-password"
          name="password"
          type="text"
          placeholder={t.admin.generatePassword}
        />
        <p className="mt-1 text-xs text-slate-400">{t.admin.generatePassword}</p>
        <Alert tone="amber" className="mt-2">
          🔑 {t.forcePassword.provisional} — {t.forcePassword.provisionalHint}
        </Alert>
      </div>

      {state.ok && state.password && (
        <Alert tone="emerald">
          <p className="font-semibold">
            ✅ {t.admin.accountCreated} : {state.email}
          </p>
          <p className="mt-1">
            {t.admin.passwordGenerated} :{" "}
            <code className="rounded bg-white px-2 py-0.5 font-mono text-sm select-all">
              {state.password}
            </code>
          </p>
          <p className="mt-1 text-xs">{t.admin.copyWarning}</p>
        </Alert>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending}>
        {t.admin.createAccount}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Réinitialisation d'un mot de passe                                  */
/* ------------------------------------------------------------------ */

export function AdminResetPasswordForm({
  users,
}: {
  users: { id: number; label: string }[];
}) {
  const t = useT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState<
    AdminActionState,
    FormData
  >(adminResetPasswordAction, {});
  const [provisional, setProvisional] = useState(true);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={dispatch} className="space-y-4">
      <div>
        <Label htmlFor="r-user">{t.admin.target}</Label>
        <Select id="r-user" name="userId" required>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="r-password">{t.admin.newPassword}</Label>
        <Input
          id="r-password"
          name="password"
          type="text"
          placeholder={t.admin.generatePassword}
        />
        <p className="mt-1 text-xs text-slate-400">{t.admin.generatePassword}</p>
      </div>

      <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3">
        <input
          type="checkbox"
          name="provisional"
          checked={provisional}
          onChange={(e) => setProvisional(e.target.checked)}
          value="true"
          className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-600">
          {t.forcePassword.provisionalToggle}
        </span>
        <input type="hidden" name="provisional" value={String(provisional)} />
      </label>

      {state.ok && state.password && (
        <Alert tone="emerald">
          <p className="font-semibold">
            🔑 {state.email} — {t.admin.passwordGenerated} :
          </p>
          <code className="mt-1 inline-block rounded bg-white px-2 py-0.5 font-mono text-sm select-all">
            {state.password}
          </code>
          <p className="mt-1 text-xs">{t.admin.copyWarning}</p>
        </Alert>
      )}
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending}>
        {t.admin.resetPassword}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Débloquer un compte resté sur l'écran de changement de mot de passe */
/* ------------------------------------------------------------------ */

export function AdminUnlockPasswordButton({ userId }: { userId: number }) {
  const t = useT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(
    adminUnlockPasswordAction,
    {} as { ok?: boolean; error?: string },
  );

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={dispatch} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="userId" value={userId} />
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        🔓 {t.forcePassword.unlock}
      </Button>
      {state.ok && (
        <span className="text-[11px] font-semibold text-emerald-600">
          {t.forcePassword.unlockDone}
        </span>
      )}
      {state.error && <FieldError>{state.error}</FieldError>}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Verrouillage global de l'application                                */
/* ------------------------------------------------------------------ */

export function AdminLockToggle({ locked }: { locked: boolean }) {
  const t = useT();
  const [state, dispatch, pending] = useActionState(adminToggleLockAction, {} as {
    ok?: boolean;
    error?: string;
  });
  return (
    <form action={dispatch} className="space-y-3">
      <input type="hidden" name="locked" value={locked ? "false" : "true"} />
      {locked && <Alert tone="rose">🔒 {t.admin.lockActive}</Alert>}
      <Button
        type="submit"
        variant={locked ? "success" : "danger"}
        loading={pending}
      >
        {locked ? `🔓 ${t.admin.lockOff}` : `🔒 ${t.admin.lockOn}`}
      </Button>
      {state.error && <Alert>{state.error}</Alert>}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Identité de la résidence : nom + logo                               */
/* ------------------------------------------------------------------ */

export function BrandingForm({
  nameFr,
  nameAr,
  logoUrl,
}: {
  nameFr: string;
  nameAr: string;
  logoUrl: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(updateBrandingAction, {} as {
    ok?: boolean;
    error?: string;
  });
  const [logo, setLogo] = useState(logoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Transition obligatoire pour tout appel programmatique de `dispatch`.
  const [, startTransition] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Logo trop volumineux (maximum 2 Mo).");
      return;
    }
    if (!/^image\/(png|jpe?g|webp|svg\+xml)$/.test(file.type)) {
      setUploadError("Format non autorisé (PNG, JPG, WEBP ou SVG).");
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("purpose", "logo");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Échec de l’envoi.");
        return;
      }
      const url = data.url as string;
      setLogo(url);
      setRemoveLogo(false);
      // ✅ Enregistre immédiatement le logo choisi, dans une transition.
      const save = new FormData();
      save.set("nameFr", nameFr);
      save.set("nameAr", nameAr);
      save.set("logoUrl", url);
      save.set("removeLogo", "false");
      startTransition(() => {
        dispatch(save);
      });
    } catch {
      setUploadError("Échec de l’envoi du logo.");
    } finally {
      setUploading(false);
    }
  }

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const effectiveLogo = removeLogo ? null : logo;

  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="b-namefr">{t.branding.nameFr}</Label>
          <Input
            id="b-namefr"
            name="nameFr"
            defaultValue={nameFr}
            required
            maxLength={120}
          />
        </div>
        <div dir="rtl">
          <Label htmlFor="b-namear">{t.branding.nameAr}</Label>
          <Input id="b-namear" name="nameAr" defaultValue={nameAr} maxLength={120} />
        </div>
      </div>

      <div>
        <Label htmlFor="b-logo">{t.branding.logo}</Label>
        <input
          id="b-logo"
          name="logoFile"
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={onFile}
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
        />
        <p className="mt-1 text-xs text-slate-400">{t.branding.logoHint}</p>

        {effectiveLogo && (
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={effectiveLogo}
              alt="Logo"
              className="h-16 w-16 rounded-xl bg-white object-contain p-1 ring-1 ring-slate-200"
            />
            <div>
              <Badge tone="indigo">{t.branding.preview}</Badge>
              <p className="mt-1 text-xs text-slate-500">{brandingPreviewNote(t)}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ms-auto"
              onClick={() => {
                setRemoveLogo(true);
                setLogo(null);
              }}
            >
              🗑️ {t.branding.removeLogo}
            </Button>
          </div>
        )}

        <input type="hidden" name="logoUrl" value={effectiveLogo ?? ""} />
        <input
          type="hidden"
          name="removeLogo"
          value={removeLogo ? "true" : "false"}
        />
        {uploading && (
          <p className="mt-2 text-xs text-indigo-600">⏳ Envoi du logo…</p>
        )}
        {uploadError && <FieldError>{uploadError}</FieldError>}
      </div>

      {state.ok && <Alert tone="emerald">{t.branding.saved}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending || uploading}>
        {t.common.save}
      </Button>
    </form>
  );
}

function brandingPreviewNote(t: ReturnType<typeof useT>): string {
  return t.branding.logo;
}

/* ------------------------------------------------------------------ */
/* Gestion des comptes : sélection multiple + archivage + suppression  */
/* ------------------------------------------------------------------ */

export function AdminUserRowActions({
  userId,
  canManage,
}: {
  userId: number;
  canManage: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [archState, archDispatch, archPending] = useActionState(
    adminArchiveUserAction,
    {} as { ok?: boolean; error?: string },
  );
  const [delState, delDispatch, delPending] = useActionState(
    adminDeleteUsersAction,
    {} as { ok?: boolean; error?: string },
  );

  useEffect(() => {
    if (archState.ok || delState.ok) router.refresh();
  }, [archState, delState, router]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <form action={archDispatch}>
          <input type="hidden" name="userId" value={userId} />
          <Button type="submit" size="sm" variant="outline" loading={archPending}>
            {t.manage.archiveUser}
          </Button>
        </form>
        {canManage && (
          <form action={delDispatch}>
            <input type="hidden" name="userId" value={userId} />
            <input type="hidden" name="archive" value="true" />
            <Button
              type="submit"
              size="sm"
              variant="danger"
              loading={delPending}
              onClick={(e) => {
                if (!window.confirm(t.manage.confirmDeleteUser)) e.preventDefault();
              }}
            >
              {t.manage.deleteUser}
            </Button>
          </form>
        )}
      </div>
      {archState.ok && (
        <span className="text-[11px] font-semibold text-emerald-600">
          {t.manage.archiveCreated}
        </span>
      )}
      {delState.ok && (
        <span className="text-[11px] font-semibold text-emerald-600">
          {t.manage.deleted}
        </span>
      )}
      {(archState.error || delState.error) && (
        <FieldError>{archState.error ?? delState.error}</FieldError>
      )}
    </div>
  );
}

export function AdminUserBatchBar({
  users,
}: {
  users: {
    id: number;
    email: string;
    role: string;
    gh: number | null;
    immeuble: string | null;
  }[];
}) {
  const t = useT();
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [state, dispatch, pending] = useActionState(adminDeleteUsersAction, {} as {
    ok?: boolean;
    error?: string;
  });
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.ok) {
      setSelected([]);
      router.refresh();
    }
  }, [state, router]);

  const ids = users.map((u) => u.id);
  const allSelected = selected.length === ids.length && ids.length > 0;

  function toggle(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function submit(archive: boolean) {
    const message = archive
      ? t.manage.confirmArchiveAndDelete
      : t.manage.confirmDeleteUsers;
    if (!window.confirm(message)) return;
    const fd = new FormData();
    fd.set("userIds", selected.join(","));
    fd.set("archive", String(archive));
    startTransition(() => {
      dispatch(fd);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => setSelected(e.target.checked ? ids : [])}
            className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          {t.manage.selectAll}
        </label>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-inset ring-slate-200">
          {selected.length} {t.manage.selected}
        </span>
        <div className="ms-auto flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={selected.length === 0}
            onClick={() => submit(true)}
          >
            {t.manage.archiveAndDelete}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={selected.length === 0}
            onClick={() => submit(false)}
          >
            {t.manage.deleteSelected}
          </Button>
        </div>
      </div>
      {state.error && <Alert>{state.error}</Alert>}
      {state.ok && <Alert tone="emerald">{t.manage.deleted}</Alert>}
      <div className="hidden">
        {users.map((u) => (
          <label key={u.id} className="ms-4 flex items-center gap-1.5 text-xs">
            <input
              type="checkbox"
              checked={selected.includes(u.id)}
              onChange={() => toggle(u.id)}
            />
            {u.email}
          </label>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Modération : archiver / supprimer publications et commentaires      */
/* ------------------------------------------------------------------ */

export function AdminPublicationActions({ pubId }: { pubId: number }) {
  const t = useT();
  const router = useRouter();
  const [delState, delDispatch, delPending] = useActionState(
    adminDeletePublicationAction,
    {} as { ok?: boolean; error?: string },
  );
  const [archState, archDispatch, archPending] = useActionState(
    adminArchivePublicationAction,
    {} as { ok?: boolean; error?: string },
  );

  useEffect(() => {
    if (delState.ok || archState.ok) router.refresh();
  }, [delState, archState, router]);

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <form action={archDispatch}>
          <input type="hidden" name="pubId" value={pubId} />
          <Button type="submit" size="sm" variant="outline" loading={archPending}>
            {t.manage.archivePublication}
          </Button>
        </form>
        <form action={delDispatch}>
          <input type="hidden" name="pubId" value={pubId} />
          <input type="hidden" name="archive" value="true" />
          <Button
            type="submit"
            size="sm"
            variant="danger"
            loading={delPending}
            onClick={(e) => {
              if (!window.confirm(t.manage.confirmDeletePublication)) e.preventDefault();
            }}
          >
            {t.manage.deletePublication}
          </Button>
        </form>
      </div>
      {archState.ok && (
        <span className="text-[11px] font-semibold text-emerald-600">
          {t.manage.archiveCreated}
        </span>
      )}
      {delState.ok && (
        <span className="text-[11px] font-semibold text-emerald-600">
          {t.manage.deleted}
        </span>
      )}
      {(delState.error || archState.error) && (
        <FieldError>{delState.error ?? archState.error}</FieldError>
      )}
    </div>
  );
}

export function AdminCommentActions({ commentId }: { commentId: number }) {
  const t = useT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(adminDeleteCommentAction, {} as {
    ok?: boolean;
    error?: string;
  });
  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);
  return (
    <form action={dispatch} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="commentId" value={commentId} />
      <Button type="submit" size="sm" variant="danger" loading={pending}>
        {t.manage.deleteComment}
      </Button>
      {state.error && <FieldError>{state.error}</FieldError>}
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Liste des archives générées (téléchargement unique)                 */
/* ------------------------------------------------------------------ */

export function AdminArchivesList({
  items,
}: {
  items: {
    id: number;
    kind: string;
    label: string;
    fileName: string;
    sizeBytes: number | null;
    createdAt: string;
    downloadedAt: string | null;
  }[];
}) {
  const t = useT();
  const router = useRouter();

  if (items.length === 0) {
    return <p className="p-5 text-center text-sm text-slate-400">{t.manage.archivesEmpty}</p>;
  }

  return (
    <div>
      <Alert tone="indigo" className="m-4">
        ℹ️ {t.manage.archivesHint}
      </Alert>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{t.admin.date}</th>
              <th className="px-4 py-3">{t.admin.target}</th>
              <th className="px-4 py-3">{t.manage.size}</th>
              <th className="px-4 py-3 text-end">{t.manage.download}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((a) => (
              <tr
                key={a.id}
                className="border-b border-slate-100 last:border-0 hover:bg-slate-50/60"
              >
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-500">
                  {a.createdAt}
                </td>
                <td className="px-4 py-2.5">
                  <p className="font-medium text-slate-800">{a.label}</p>
                  <code className="text-[11px] text-slate-400">{a.fileName}</code>
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs text-slate-600">
                  {a.sizeBytes ? `${(a.sizeBytes / 1024).toFixed(1)} Ko` : "—"}
                </td>
                <td className="px-4 py-2.5 text-end">
                  <a
                    href={`/api/archives/${a.id}`}
                    onClick={() => setTimeout(() => router.refresh(), 2500)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                  >
                    {t.manage.download}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Création de comptes par lot                                        */
/* ------------------------------------------------------------------ */

export function AdminBatchCreateForm({
  actorRole,
  actorGh,
  actorImmeuble,
}: {
  actorRole: string;
  actorGh: number;
  actorImmeuble: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [state, dispatch, pending] = useActionState(adminBatchCreateUsersAction, {} as {
    ok?: boolean;
    error?: string;
    created?: { email: string; password: string; label: string }[];
    failed?: { line: string; reason: string }[];
  });

  const allowed = creatableRoles({
    role: actorRole,
    gh: actorGh,
    immeuble: actorImmeuble,
    status: "actif",
  } as never);
  const isTopLevel = actorRole === "admin" || actorRole === "president";

  const [role, setRole] = useState(allowed[allowed.length - 1] ?? "owner");
  const [gh, setGh] = useState(actorGh);
  const buildings = buildingsOf(gh);
  const needsBuilding = role === "building_manager" || role === "owner";

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="bl-role">{t.admin.role}</Label>
          <Select
            id="bl-role"
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            required
          >
            {allowed.includes("president") && (
              <option value="president">{t.roleManager.president}</option>
            )}
            {allowed.includes("gh_manager") && (
              <option value="gh_manager">{t.roleManager.gh_manager}</option>
            )}
            {allowed.includes("building_manager") && (
              <option value="building_manager">
                {t.roleManager.building_manager}
              </option>
            )}
            {allowed.includes("owner") && (
              <option value="owner">{t.roleManager.owner}</option>
            )}
          </Select>
        </div>
        <div>
          <Label htmlFor="bl-gh">{t.common.gh}</Label>
          <Select
            id="bl-gh"
            name="gh"
            value={gh}
            onChange={(e) => setGh(Number(e.target.value))}
            required
            disabled={!isTopLevel}
          >
            {(isTopLevel ? Array.from({ length: 12 }, (_, i) => i + 1) : [actorGh]).map(
              (n) => (
                <option key={n} value={n}>
                  {ghLabel(n)}
                </option>
              ),
            )}
          </Select>
        </div>
        {needsBuilding && (
          <div>
            <Label htmlFor="bl-immeuble">{t.common.building}</Label>
            <Select
              id="bl-immeuble"
              name="immeuble"
              required
              disabled={actorRole === "building_manager"}
              defaultValue={actorImmeuble ?? buildings[0]}
            >
              {(actorRole === "building_manager" && actorImmeuble
                ? [actorImmeuble]
                : buildings
              ).map((b) => (
                <option key={b} value={b}>
                  {t.common.building} {b}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="bl-lines">{t.batch.lines}</Label>
        <Textarea
          id="bl-lines"
          name="lines"
          rows={6}
          required
          placeholder={t.batch.linesPlaceholder}
          className="font-mono text-xs"
        />
        <p className="mt-1 text-xs text-slate-400">{t.batch.linesHelp}</p>
      </div>

      <div>
        <Label htmlFor="bl-password">{t.batch.passwordShared}</Label>
        <Input id="bl-password" name="password" type="text" placeholder="********" />
        <p className="mt-1 text-xs text-slate-400">{t.batch.passwordSharedHelp}</p>
      </div>

      <Alert tone="amber">⚠️ {t.batch.mandatoryNotice}</Alert>

      {state.created && state.created.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold text-emerald-700">
            ✅ {t.batch.created} — {state.created.length} {t.batch.count}
          </p>
          <div className="max-h-64 overflow-y-auto rounded-lg ring-1 ring-inset ring-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2">{t.common.email}</th>
                  <th className="px-3 py-2">{t.admin.passwordGenerated}</th>
                </tr>
              </thead>
              <tbody>
                {state.created.map((c) => (
                  <tr key={c.email} className="border-t border-slate-100">
                    <td className="px-3 py-1.5">
                      <p className="font-semibold text-slate-800">{c.label}</p>
                      <p className="text-slate-500">{c.email}</p>
                    </td>
                    <td className="px-3 py-1.5">
                      <code className="rounded bg-white px-1.5 py-0.5 font-mono select-all ring-1 ring-inset ring-slate-200">
                        {c.password}
                      </code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-rose-600">{t.admin.copyWarning}</p>
        </div>
      )}

      {state.failed && state.failed.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-bold text-amber-700">
            ⚠️ {t.batch.failed} — {state.failed.length}
          </p>
          <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 ring-1 ring-inset ring-amber-200">
            {state.failed.map((f, i) => (
              <li key={i}>
                <code className="font-mono">{f.line}</code> → {f.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending}>
        {t.batch.submit}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Poids de voix configurables                                         */
/* ------------------------------------------------------------------ */

export function VoteWeightsForm({
  weights,
}: {
  weights: {
    president: number;
    gh_manager: number;
    building_manager: number;
    owner: number;
    admin: number;
  };
}) {
  const t = useT();
  const [state, dispatch, pending] = useActionState(updateVoteWeightsAction, {} as {
    ok?: boolean;
    error?: string;
  });

  const rows: { field: string; label: string; value: number }[] = [
    { field: "w_president", label: t.weights.president, value: weights.president },
    { field: "w_gh_manager", label: t.weights.gh_manager, value: weights.gh_manager },
    {
      field: "w_building_manager",
      label: t.weights.building_manager,
      value: weights.building_manager,
    },
    { field: "w_owner", label: t.weights.owner, value: weights.owner },
    { field: "w_admin", label: t.weights.admin, value: weights.admin },
  ];

  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <div key={r.field}>
            <Label htmlFor={r.field}>{r.label}</Label>
            <Input
              id={r.field}
              name={r.field}
              type="number"
              min={0}
              max={100}
              defaultValue={r.value}
              required
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">{t.weights.hint}</p>
      <Alert tone="indigo">{t.weights.groupContext}</Alert>
      {state.ok && <Alert tone="emerald">{t.weights.saved}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending}>
        {t.common.save}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Types de publication activables                                     */
/* ------------------------------------------------------------------ */

export function PubTypesForm({
  enabled,
}: {
  enabled: string[];
}) {
  const t = useT();
  const [state, dispatch, pending] = useActionState(updatePubTypesAction, {} as {
    ok?: boolean;
    error?: string;
  });

  const items: { field: string; key: string; label: string }[] = [
    { field: "t_texte", key: "texte", label: t.pubTypes.texte },
    { field: "t_fichier", key: "fichier", label: t.pubTypes.fichier },
    { field: "t_tache_evenement", key: "tache_evenement", label: t.pubTypes.tache_evenement },
    { field: "t_sondage", key: "sondage", label: t.pubTypes.sondage },
  ];

  return (
    <form action={dispatch} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((it) => (
          <label
            key={it.field}
            className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 ring-1 ring-inset ring-slate-200"
          >
            <input
              type="checkbox"
              name={it.field}
              defaultChecked={enabled.includes(it.key)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm font-medium text-slate-700">{it.label}</span>
          </label>
        ))}
      </div>
      <p className="text-xs text-slate-500">{t.pubTypes.subtitle}</p>
      {state.ok && <Alert tone="emerald">{t.pubTypes.saved}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending}>
        {t.common.save}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Mot de passe de l'Administrateur (changement immédiat)              */
/* ------------------------------------------------------------------ */

export function OwnPasswordForm() {
  const t = useT();
  const [state, dispatch, pending] = useActionState(adminChangeOwnPasswordAction, {} as {
    ok?: boolean;
    error?: string;
  });
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const mismatch = confirm.length > 0 && next !== confirm;

  return (
    <form action={dispatch} className="space-y-4">
      <div>
        <Label htmlFor="op-current">{t.ownPassword.current}</Label>
        <Input
          id="op-current"
          name="current"
          type="password"
          required
          autoComplete="current-password"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="op-new">{t.ownPassword.newPassword}</Label>
          <Input
            id="op-new"
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
          <Label htmlFor="op-confirm">{t.ownPassword.confirm}</Label>
          <Input
            id="op-confirm"
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
      </div>
      {state.ok && <Alert tone="emerald">{t.ownPassword.saved}</Alert>}
      {state.error && <Alert>{state.error}</Alert>}
      <Button type="submit" loading={pending} disabled={mismatch}>
        {t.ownPassword.submit}
      </Button>
      <p className="text-xs text-slate-400">{t.ownPassword.hint}</p>
    </form>
  );
}
