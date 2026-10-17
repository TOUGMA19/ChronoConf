import type { Article, ConferenceSchedule } from "./conference";

/**
 * Utilitaires partagés par la synchronisation des intervenants, les badges
 * et les attestations — une SEULE définition du découpage des auteurs et de
 * la normalisation des noms, pour que les trois modules s'accordent.
 */

/** Découpe une chaîne d'auteurs ("A, B et C", "A; B & C", retours à la ligne…). */
export function splitAuthors(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;&\n]| et | and /i)
    .map((s) => s.trim())
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
