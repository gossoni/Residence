import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/auth";
import { canPublish, getAppSettings, getBranding } from "@/lib/logic";
import { ghLabel, roleTone } from "@/lib/structure";
import { getT } from "@/lib/i18n-server";
import { roleLabel } from "@/lib/i18n";
import { Badge, Alert } from "@/components/ui";
import { NotificationBell, LogoutButton } from "@/components/client-forms";
import { LocaleProvider, LocaleSwitcher } from "@/components/locale-provider";
import { MobileNav, type NavLink } from "@/components/mobile-nav";

export async function generateMetadata(): Promise<Metadata> {
  const { t, locale } = await getT();
  const branding = await getBranding(locale);
  return {
    title: {
      default: `${branding.name} — ${t.meta.appName}`,
      template: `%s · ${branding.name}`,
    },
    description: t.meta.description,
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const [{ locale, dir, t }, user] = await Promise.all([getT(), getCurrentUser()]);
  const [{ appLocked }, branding] = await Promise.all([
    getAppSettings(),
    getBranding(locale),
  ]);

  const navLinks: NavLink[] = user
    ? [
        {
          href: user.status === "actif" ? "/feed" : "/dashboard",
          label: t.nav.feed,
          icon: "📰",
        },
        ...(canPublish(user)
          ? [{ href: "/publications/nouvelle", label: t.nav.publish, icon: "📝" }]
          : []),
        { href: "/dashboard", label: t.nav.dashboard, icon: "📊" },
        { href: "/profil", label: t.nav.profile, icon: "👤" },
      ]
    : [
        { href: "/login", label: t.nav.login, icon: "🔑" },
        { href: "/register", label: t.nav.register, icon: "🆕" },
      ];

  return (
    <html lang={locale} dir={dir}>
      <body className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">
        <LocaleProvider locale={locale}>
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4">
              <MobileNav links={navLinks} />
              <Link
                href={user ? (user.status === "actif" ? "/feed" : "/dashboard") : "/"}
                className="flex items-center gap-2"
                title={branding.name}
              >
                {branding.logoUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={branding.logoUrl}
                    alt={branding.name}
                    className="h-12 w-12 rounded-xl bg-white object-contain p-0.5 ring-1 ring-slate-200 sm:h-14 sm:w-14"
                  />
                ) : (
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-2xl text-white shadow-sm sm:h-12 sm:w-12">
                    🏘️
                  </span>
                )}
                <span className="hidden text-sm font-bold leading-tight text-slate-900 sm:block">
                  {branding.name}
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-slate-400">
                    {t.meta.tagline}
                  </span>
                </span>
              </Link>

              {user && (
                <nav className="ml-2 hidden items-center gap-1 text-sm font-medium md:flex">
                  <Link
                    href={user.status === "actif" ? "/feed" : "/dashboard"}
                    className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {t.nav.feed}
                  </Link>
                  {canPublish(user) && (
                    <Link
                      href="/publications/nouvelle"
                      className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    >
                      {t.nav.publish}
                    </Link>
                  )}
                  <Link
                    href="/dashboard"
                    className="rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  >
                    {t.nav.dashboard}
                  </Link>
                </nav>
              )}

              <div className="ms-auto flex items-center gap-2">
                <LocaleSwitcher current={locale} />
                {user ? (
                  <>
                    <NotificationBell userName={`${user.prenom} ${user.nom}`} />
                    <Link
                      href="/profil"
                      className="hidden items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100 md:flex"
                    >
                      <span className="text-end">
                        <span className="block max-w-40 truncate text-xs font-semibold text-slate-800">
                          {user.prenom} {user.nom}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                          {roleLabel(t, user.role)} · {ghLabel(user.gh)}
                        </span>
                      </span>
                      <Badge tone={roleTone(user.role)}>
                        {user.role === "admin"
                          ? "A"
                          : user.role === "owner"
                            ? "P"
                            : "R"}
                      </Badge>
                    </Link>
                    <LogoutButton compact />
                  </>
                ) : (
                  <div className="flex items-center gap-2">
                    <Link
                      href="/login"
                      className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
                    >
                      {t.nav.login}
                    </Link>
                    <Link
                      href="/register"
                      className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"
                    >
                      {t.nav.register}
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </header>

          {appLocked && user?.role !== "admin" && (
            <div className="mx-auto max-w-6xl px-4 pt-4">
              <Alert tone="rose">🔒 {t.errors.appLocked}</Alert>
            </div>
          )}

          {user?.mustChangePassword && (
            <div className="mx-auto max-w-6xl px-4 pt-4">
              <Alert tone="amber">🔑 {t.forcePassword.banner}</Alert>
            </div>
          )}

          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
