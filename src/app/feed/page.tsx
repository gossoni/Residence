import type { Metadata } from "next";
import { requireActiveUser } from "@/lib/auth";
import { sweepExpiredPublications } from "@/lib/logic";
import { getFeed, type FeedFilter } from "@/lib/queries";
import { cn } from "@/lib/cn";
import { UserInfoCard } from "@/components/user-info-card";
import { getT } from "@/lib/i18n-server";
import { Card, EmptyState } from "@/components/ui";
import { PublicationCard } from "@/components/publication-card";

export const metadata: Metadata = { title: "Fil d’actualité" };

export const dynamic = "force-dynamic";



export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const [user, { t, locale }] = await Promise.all([requireActiveUser(), getT()]);
  await sweepExpiredPublications(); // auto-validation des délais expirés

  const FILTERS: { value: FeedFilter; label: string }[] = [
    { value: "all", label: t.feed.filterAll },
    { value: "residence", label: t.feed.filterResidence },
    { value: "groupe", label: t.feed.filterGroup },
    { value: "immeuble", label: t.feed.filterBuilding },
  ];

  const sp = await searchParams;
  const raw = sp.scope;
  const filter: FeedFilter = (["all", "residence", "groupe", "immeuble"] as string[]).includes(
    raw ?? "",
  )
    ? (raw as FeedFilter)
    : "all";

  const items = await getFeed(user, filter);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.feed.title}</h1>
          <p className="mt-1 text-sm text-slate-500">{t.feed.subtitle}</p>
        </div>
      </div>

      <div className="mt-5">
        <UserInfoCard user={user} t={t} locale={locale} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <a
            key={f.value}
            href={f.value === "all" ? "/feed" : `/feed?scope=${f.value}`}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition",
              filter === f.value
                ? "bg-indigo-600 text-white shadow-sm"
                : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50",
            )}
          >
            {f.label}
          </a>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <EmptyState icon="📭" title={t.feed.empty} description={t.feed.emptyDesc} />
        ) : (
          items.map((item) => (
            <PublicationCard key={item.id} pub={item} href={`/publications/${item.id}`} t={t} />
          ))
        )}
      </div>

      <Card className="mt-8 border-dashed bg-slate-50 p-4 text-center text-xs text-slate-500">
        Les contenus en attente de validation apparaissent dans votre{" "}
        <a href="/dashboard" className="font-semibold text-indigo-600 hover:underline">
          tableau de bord
        </a>
        .
      </Card>
    </main>
  );
}
