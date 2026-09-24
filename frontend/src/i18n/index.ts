// Game languages. French is the reference dictionary: English must define exactly the same keys
// (checked by TypeScript). The language follows the phone and can be changed in Settings.
//   const t = useT();  t("menu.play")  t("level.n", { n: 3 })
import { useSyncExternalStore } from "react";
import { getLocales } from "expo-localization";
import { storage } from "@/src/utils/storage";
import { fr, type Key } from "./fr";
import { en } from "./en";

export type Lang = "fr" | "en";
export type { Key };
export const LANGS: Lang[] = ["fr", "en"];
export const LANG_NAMES: Record<Lang, string> = { fr: "Français", en: "English" };

const KEY = "np_lang";
const dictionaries: Record<Lang, Record<Key, string>> = { fr, en };
const listeners = new Set<() => void>();

function deviceLocale() {
  try {
    return getLocales()[0] ?? null;
  } catch {
    return null;
  }
}

// French for French-speaking phones, English everywhere else.
function deviceLang(): Lang {
  return deviceLocale()?.languageCode === "fr" ? "fr" : "en";
}

// Region of the phone ("FR", "TN"…), sent to the server for statistics.
export function deviceRegion(): string | null {
  const r = deviceLocale()?.regionCode;
  return r && /^[A-Za-z]{2}$/.test(r) ? r.toUpperCase() : null;
}

let current: Lang = deviceLang();

export function getLang(): Lang {
  return current;
}

// Loads the language chosen in Settings, if any (call once at startup).
export async function initLang() {
  const saved = await storage.getItem(KEY, null as string | null);
  if (saved === "fr" || saved === "en") setCurrent(saved);
}

function setCurrent(lang: Lang) {
  if (lang === current) return;
  current = lang;
  listeners.forEach((fn) => fn());
}

export function setLang(lang: Lang) {
  setCurrent(lang);
  storage.setItem(KEY, lang);
}

export function t(key: Key, params?: Record<string, string | number>): string {
  let s = dictionaries[current][key] ?? fr[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

// Re-renders the component when the language changes.
export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang, getLang);
}

export function useT() {
  useLang();
  return t;
}

// Numbers in the player's language (1 234 in French, 1,234 in English).
export function formatNumber(n: number) {
  return n.toLocaleString(current === "fr" ? "fr-FR" : "en-US");
}
