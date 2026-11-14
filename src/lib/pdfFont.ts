import type jsPDF from "jspdf";
import { needsUnicodeFont, toWinAnsiSafe } from "./latex";

/**
 * Police Unicode pour les PDF.
 *
 * Helvetica (police native de jsPDF) ne contient ni lettres grecques, ni indices/exposants,
 * ni opérateurs mathématiques. On embarque donc, À LA DEMANDE et seulement pour les textes qui
 * en ont besoin, un sous-ensemble de DejaVu Sans (public/fonts/*.ttf). Les autres textes
 * gardent Helvetica : l'aspect des documents sans formule ne change pas.
 *
 * Si la police n'a pas pu être chargée (hors ligne…), on se replie sur un texte ASCII lisible
 * (α → alpha, ≤ → <=, x₂ → x_2) au lieu d'afficher des caractères illisibles.
 */

export const UNICODE_FONT = "DejaVu";

type Style = "normal" | "bold" | "italic" | "bolditalic";
const FILES: Record<Style, string> = {
  normal: "DejaVuSans-sub.ttf",
  bold: "DejaVuSans-Bold-sub.ttf",
  italic: "DejaVuSans-Oblique-sub.ttf",
  bolditalic: "DejaVuSans-BoldOblique-sub.ttf",
};

let fontData: Record<Style, string> | null = null; // base64
let loading: Promise<boolean> | null = null;

/** Injecte les polices (base64) — utile pour les tests ou un chargement personnalisé. */
export function setUnicodeFontData(data: Record<Style, string> | null) {
  fontData = data;
}

export function unicodeFontsReady(): boolean {
  return fontData !== null;
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

/** Charge les polices (une seule fois). Renvoie vrai si elles sont disponibles. */
export function ensureUnicodeFonts(): Promise<boolean> {
  if (fontData) return Promise.resolve(true);
  if (loading) return loading;
  loading = (async () => {
    try {
      const base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? "/";
      const entries = await Promise.all(
        (Object.keys(FILES) as Style[]).map(async (style) => {
          const res = await fetch(`${base}fonts/${FILES[style]}`);
          if (!res.ok) throw new Error(`Police introuvable : ${FILES[style]}`);
          return [style, bufferToBase64(await res.arrayBuffer())] as const;
        }),
      );
      fontData = Object.fromEntries(entries) as Record<Style, string>;
      return true;
    } catch (e) {
      console.warn("Police Unicode indisponible, repli en ASCII pour les formules :", e);
      loading = null; // permet de réessayer plus tard
      return false;
    }
  })();
  return loading;
}

/**
 * Lance le chargement en arrière-plan (sans bloquer l'interface) afin que les exports
 * synchrones (PDF du programme, livret) trouvent la police déjà prête.
 */
export function prefetchUnicodeFonts() {
  if (typeof window === "undefined" || fontData || loading) return;
  const run = () => { void ensureUnicodeFonts(); };
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback;
  if (ric) ric(run); else setTimeout(run, 1500);
}

const registered = new WeakSet<object>();

/** Enregistre DejaVu dans le document (idempotent). Renvoie faux si la police n'est pas chargée. */
export function registerUnicodeFonts(doc: jsPDF): boolean {
  if (!fontData) return false;
  if (registered.has(doc)) return true;
  (Object.keys(FILES) as Style[]).forEach((style) => {
    doc.addFileToVFS(FILES[style], fontData![style]);
    doc.addFont(FILES[style], UNICODE_FONT, style);
  });
  registered.add(doc);
  return true;
}

/** Famille à utiliser pour ce texte : DejaVu s'il contient des symboles, sinon `fallback`. */
export function fontFamilyFor(doc: jsPDF, text: string | string[], fallback = "helvetica"): string {
  const t = Array.isArray(text) ? text.join(" ") : text;
  if (!needsUnicodeFont(t)) return fallback;
  return registerUnicodeFonts(doc) ? UNICODE_FONT : fallback;
}

/** Texte à dessiner : inchangé si affichable, sinon repli ASCII quand DejaVu est indisponible. */
export function pdfSafeText(doc: jsPDF, text: string): string {
  if (!needsUnicodeFont(text)) return text;
  return registerUnicodeFonts(doc) ? text : toWinAnsiSafe(text);
}

/**
 * À appeler au début d'un `didParseCell` d'autoTable : passe la cellule en DejaVu si elle
 * contient des symboles (ou la convertit en ASCII si la police est indisponible).
 */
export function applyCellFont(data: { doc: jsPDF; cell: { text: string[]; styles: { font?: string } } }) {
  const lines = data.cell.text;
  if (!lines || !needsUnicodeFont(lines.join(" "))) return;
  if (registerUnicodeFonts(data.doc)) data.cell.styles.font = UNICODE_FONT;
  else data.cell.text = lines.map(toWinAnsiSafe);
}

// Démarre le chargement dès que le module est utilisé dans le navigateur.
prefetchUnicodeFonts();
