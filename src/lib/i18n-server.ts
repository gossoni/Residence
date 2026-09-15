import { cookies } from "next/headers";
import {
  DEFAULT_LOCALE,
  dirFor,
  getDictionary,
  isLocale,
  LOCALE_COOKIE,
  type Dictionary,
  type Locale,
} from "./i18n";

export type Dict = Dictionary;

/** Lit la préférence de langue depuis le cookie. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  const value = store.get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Dictionnaire + métadonnées de direction pour les composants serveur. */
export async function getT(): Promise<{
  locale: Locale;
  dir: "ltr" | "rtl";
  rtl: boolean;
  t: Dictionary;
}> {
  const locale = await getLocale();
  return {
    locale,
    dir: dirFor(locale),
    rtl: locale === "ar",
    t: getDictionary(locale),
  };
}
