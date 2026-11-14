import type { Article, ConferenceSchedule } from "./conference";
import { latexToUnicode } from "./latex";

/**
 * Utilitaires partagés par la synchronisation des intervenants, les badges
 * et les attestations — une SEULE définition du découpage des auteurs et de
 * la normalisation des noms, pour que les trois modules s'accordent.
 */

/** Découpe une chaîne d'auteurs ("A, B et C", "A; B & C", retours à la ligne…). */
export function splitAuthors(raw: string): string[] {
  if (!raw) return [];
  // « \& » (esperluette LaTeX) ne doit pas servir de séparateur ; les accents LaTeX (Ou\'edraogo) sont convertis.
  return raw
    .replace(/\\&/g, "\u0001")
    .split(/[,;&\n]| et | and /i)
    .map((s) => latexToUnicode(s.replace(/\u0001/g, "\\&")).trim())
    .filter((s) => s.length > 1);
}

/** Clé de comparaison d'un nom : minuscules, sans accents, espaces normalisés. */
export function normalizeName(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Articles non rejetés qui n'ont AUCUN créneau dans le chronogramme. */
export function getUnscheduledArticles(
  schedule: ConferenceSchedule | null,
  articles: Article[],
): Article[] {
  const placed = new Set((schedule?.slots ?? []).map((s) => s.articleId));
  return articles.filter((a) => a.status !== "rejected" && !placed.has(a.id));
}

export interface SimpleOrganizer {
  name: string;
  role?: string;
}

/**
 * Permute deux rôles : `a` devient `b` et `b` devient `a`, tout autre rôle
 * reste inchangé. Utilisé par les badges ET les attestations pour que la
 * permutation en masse (ex. Auteurs ⇄ Participants) se comporte de façon identique.
 */
export function swapRole<R extends string>(current: R, a: R, b: R): R {
  if (a === b) return current;
  if (current === a) return b;
  if (current === b) return a;
  return current;
}


// ---------------------------------------------------------------------------
// LaTeX → texte lisible (exports PDF / Word / Excel…)
// ---------------------------------------------------------------------------

/** Copie d'un article dont les champs texte sont convertis du LaTeX en Unicode. */
export function cleanArticle(a: Article): Article {
  return {
    ...a,
    title: latexToUnicode(a.title),
    authors: latexToUnicode(a.authors),
    abstract: latexToUnicode(a.abstract),
    category: latexToUnicode(a.category),
    moderator: latexToUnicode(a.moderator),
    sessionChair: latexToUnicode(a.sessionChair),
    rapporteurs: a.rapporteurs ? latexToUnicode(a.rapporteurs) : a.rapporteurs,
  };
}

export function cleanArticles(list: Article[]): Article[] {
  return list.map(cleanArticle);
}

/**
 * Copie du programme avec titres / intervenants des créneaux spéciaux et nom de la conférence
 * convertis. Les salles ne sont PAS touchées : elles servent de clés de rattachement des créneaux.
 */
export function cleanSchedule(s: ConferenceSchedule): ConferenceSchedule {
  return {
    ...s,
    name: latexToUnicode(s.name),
    specialSlots: (s.specialSlots ?? []).map((sp) => ({
      ...sp,
      title: latexToUnicode(sp.title),
      speaker: sp.speaker ? latexToUnicode(sp.speaker) : sp.speaker,
      description: sp.description ? latexToUnicode(sp.description) : sp.description,
    })),
  };
}
