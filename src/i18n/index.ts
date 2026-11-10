import en from './en.json';
import de from './de.json';
import it from './it.json';

export const languages = ['en', 'de', 'it'] as const;
export type Lang = (typeof languages)[number];
export type Dictionary = typeof en;

const dictionaries: Record<Lang, Dictionary> = { en, de, it };

export function dictionary(lang: Lang): Dictionary {
  return dictionaries[lang];
}

/** English is the main language and lives at the root; the others under /de/ and /it/. */
export function pathFor(lang: Lang): string {
  return lang === 'en' ? '/' : `/${lang}/`;
}

export { fill } from '../lib/text';
