"use client";

import { createContext, useContext, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getDictionary, localeLabel, type Dictionary, type Locale } from "@/lib/i18n";
import { setLocaleAction } from "@/app/actions";
import { cn } from "@/lib/cn";

const LocaleContext = createContext<Dictionary | null>(null);
const LocaleValueContext = createContext<Locale>("fr");

/**
 * Fournit le dictionnaire courant aux composants client.
 * Le dictionnaire provient du cookie de langue lu côté serveur, ce qui
 * garantit que serveur et client affichent toujours la même langue.
 */
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleValueContext.Provider value={locale}>
      <LocaleContext.Provider value={getDictionary(locale)}>
        {children}
      </LocaleContext.Provider>
    </LocaleValueContext.Provider>
  );
}

/** Langue active (utile pour choisir une variante de libellé). */
export function useLocale(): Locale {
  return useContext(LocaleValueContext);
}

/** Accès au dictionnaire dans un composant client. */
export function useT(): Dictionary {
  const dict = useContext(LocaleContext);
  if (!dict) {
    throw new Error("useT doit être utilisé à l'intérieur de <LocaleProvider>.");
  }
  return dict;
}

/** Sélecteur FR / العربية — bascule la langue pour toute l'interface. */
export function LocaleSwitcher({ current }: { current: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function switchTo(next: Locale) {
    if (next === current) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("locale", next);
      await setLocaleAction(fd);
      router.refresh();
    });
  }

  return (
    <div
      className="flex items-center overflow-hidden rounded-lg ring-1 ring-slate-200"
      role="group"
      aria-label="Langue / اللغة"
    >
      {(["fr", "ar"] as Locale[]).map((l) => (
        <button
          key={l}
          type="button"
          disabled={pending}
          onClick={() => switchTo(l)}
          title={localeLabel(l)}
          className={cn(
            "px-2.5 py-1.5 text-xs font-semibold transition",
            current === l
              ? "bg-indigo-600 text-white"
              : "bg-white text-slate-600 hover:bg-slate-50",
            pending && "opacity-60",
          )}
        >
          {l === "fr" ? "FR" : "ع"}
        </button>
      ))}
    </div>
  );
}
