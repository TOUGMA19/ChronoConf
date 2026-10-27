// Export DOCX "modèle programme" : reproduit la mise en page du modèle CI2026ENS
//  - en-tête (logo + sigle + titre + date/lieu) et double filet vert
//  - titre « PROGRAMME DU … » + date/lieu du jour
//  - blocs d'activités (Activités | Responsables | Horaire) pour les créneaux spéciaux
//  - blocs « COMMUNICATIONS — THÉMATIQUE n : … » (Salle | Date et heure | Auteur(s) | Titre | Modérateur | Rapporteurs)
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType,
  WidthType, BorderStyle, ShadingType, PageOrientation, ImageRun, VerticalAlign,
  Footer, PageNumber, TableLayoutType,
} from "docx";
import { saveAs } from "file-saver";
import { ConferenceSchedule, Article, SpecialSlot } from "./conference";
import { MODELE_DEFAULT_LOGO } from "./modeleLogo";

export interface ModeleExportOptions {
  /** Sigle affiché en rose en tête (ex. « CI2026ENS ») */
  acronym: string;
  /** Titre de la manifestation (ex. « 2ᵉ Colloque international de l'École Normale Supérieure (ENS) ») */
  eventTitle: string;
  /** Intitulé de la date globale (ex. « du 28 au 30 octobre 2026 ») */
  dateRange: string;
  /** Lieu (ex. « Ouagadougou, Burkina Faso ») */
  location: string;
  /** Date du premier jour au format AAAA-MM-JJ (sert à écrire « mercredi 28 octobre 2026 » pour chaque jour) */
  firstDayDate?: string;
  /** Logo (data URL PNG/JPG). À défaut, le logo du modèle est utilisé. */
  logoDataUrl?: string;
  /** Identifiant du design (voir MODELE_THEMES) ou "custom" */
  theme?: string;
  /** Couleurs du design « personnalisé » (#RRGGBB) */
  customPrimary?: string;
  customAccent?: string;
  /** Décoration du design « personnalisé » : id d'un des designs (ex. "luxe") */
  customDeco?: string;
  /** Rapporteurs chargés depuis un fichier CSV/TXT (voir parseRapporteursFile) */
  rapporteurs?: RapporteursData;
}

export interface RapporteursData {
  /** moderateur normalisé -> rapporteurs */
  byModerator: Record<string, string>;
  /** liste simple, attribuée dans l'ordre aux séances */
  list: string[];
}

export const DEFAULT_MODELE_OPTIONS: ModeleExportOptions = {
  acronym: "",
  eventTitle: "",
  dateRange: "",
  location: "",
  firstDayDate: "",
  theme: "modele",
};

// ---- Designs (palettes) ----
export type GridStyle = "single" | "thin" | "thick" | "double" | "dotted" | "dashed" | "horizontal";
/** Décorations propres à chaque design (indépendantes des couleurs) */
export interface ModeleDeco {
  font: string;
  rule: "double" | "single" | "thick" | "dashed" | "dotted" | "wave" | "thickthin" | "triple" | "none";
  header: "plain" | "band" | "boxed" | "leftbar" | "soft";   // style du bloc logo + titre
  title: "underline" | "boxed" | "band" | "plain" | "ornate"; // style de « PROGRAMME DU … »
  grid: GridStyle;                                              // style des bordures de tableaux
  zebra: boolean;                                               // lignes alternées dans les communications
  pre: string; post: string;                                    // ornements autour des bandeaux
  align: "center" | "left";                                     // alignement des bandeaux
}
export interface ModeleTheme {
  id: string; label: string; deco?: ModeleDeco;
  acronym: string;   // sigle
  title: string;     // titre / date d'en-tête
  rule: string;      // double filet
  primary: string;   // bandeau + en-têtes du tableau des communications
  banner: string;    // pauses
  section: string;   // bandeaux de section (cérémonie, panel…)
  sectionText: string;
  headFill: string;  // en-têtes de colonnes d'activités
  headFill2: string;
  line: string;      // bordures
}
const BASE_THEMES: ModeleTheme[] = [
  { id: "modele", label: "Modèle (vert & bleu marine)", acronym: "CF52CA", title: "008041", rule: "23965A", primary: "23416B", banner: "6AA84F", section: "8CCB4A", sectionText: "000000", headFill: "FFF2CC", headFill2: "F8F0D2", line: "222222" },
  { id: "bleu", label: "Bleu institutionnel", acronym: "1D4ED8", title: "1E3A8A", rule: "3B82F6", primary: "1E3A8A", banner: "2563EB", section: "BFDBFE", sectionText: "1E3A8A", headFill: "DBEAFE", headFill2: "EFF6FF", line: "334155" },
  { id: "bordeaux", label: "Bordeaux & or", acronym: "B45309", title: "7F1D1D", rule: "B8860B", primary: "7F1D1D", banner: "B8860B", section: "F3E2B3", sectionText: "5B1414", headFill: "FBF1D5", headFill2: "FDF8E8", line: "4B1D1D" },
  { id: "ardoise", label: "Ardoise sobre", acronym: "475569", title: "1E293B", rule: "64748B", primary: "334155", banner: "64748B", section: "CBD5E1", sectionText: "0F172A", headFill: "E2E8F0", headFill2: "F1F5F9", line: "475569" },
  { id: "violet", label: "Violet moderne", acronym: "7C3AED", title: "5B21B6", rule: "8B5CF6", primary: "4C1D95", banner: "7C3AED", section: "DDD6FE", sectionText: "3B0764", headFill: "EDE9FE", headFill2: "F5F3FF", line: "4C1D95" },
  { id: "terre", label: "Terre & orange", acronym: "C2410C", title: "7C2D12", rule: "EA580C", primary: "7C2D12", banner: "EA580C", section: "FED7AA", sectionText: "431407", headFill: "FFEDD5", headFill2: "FFF7ED", line: "431407" },
  { id: "nb", label: "Noir & blanc (impression économique)", acronym: "000000", title: "000000", rule: "000000", primary: "262626", banner: "595959", section: "D9D9D9", sectionText: "000000", headFill: "F2F2F2", headFill2: "FAFAFA", line: "000000" },
  { id: "emeraude", label: "Émeraude classique", acronym: "047857", title: "064E3B", rule: "10B981", primary: "065F46", banner: "059669", section: "A7F3D0", sectionText: "064E3B", headFill: "D1FAE5", headFill2: "ECFDF5", line: "065F46" },
  { id: "ocean", label: "Océan turquoise", acronym: "0E7490", title: "155E75", rule: "06B6D4", primary: "164E63", banner: "0891B2", section: "A5F3FC", sectionText: "164E63", headFill: "CFFAFE", headFill2: "ECFEFF", line: "155E75" },
  { id: "luxe", label: "Luxe noir & or", acronym: "B8860B", title: "111111", rule: "B8860B", primary: "111111", banner: "B8860B", section: "F1E3B0", sectionText: "111111", headFill: "F7EFD2", headFill2: "FCF8EA", line: "3A3A3A" },
  { id: "rose", label: "Rose poudré", acronym: "BE185D", title: "831843", rule: "EC4899", primary: "9D174D", banner: "DB2777", section: "FBCFE8", sectionText: "831843", headFill: "FCE7F3", headFill2: "FDF2F8", line: "9D174D" },
  { id: "minimal", label: "Minimal épuré", acronym: "374151", title: "111827", rule: "9CA3AF", primary: "374151", banner: "6B7280", section: "E5E7EB", sectionText: "111827", headFill: "F3F4F6", headFill2: "F9FAFB", line: "9CA3AF" },
];

const D = (o: Partial<ModeleDeco> & { font: string }): ModeleDeco => ({ rule: "double", header: "plain", title: "underline", grid: "single", zebra: false, pre: "", post: "", align: "center", ...o });
const DECOS: Record<string, ModeleDeco> = {
  modele:   D({ font: "Times New Roman", rule: "double", header: "plain", title: "underline", grid: "single" }),
  bleu:     D({ font: "Arial", rule: "thick", header: "band", title: "band", grid: "thin", zebra: true }),
  bordeaux: D({ font: "Georgia", rule: "thickthin", header: "boxed", title: "boxed", grid: "thick", pre: "◆  ", post: "  ◆" }),
  ardoise:  D({ font: "Calibri", rule: "none", header: "plain", title: "plain", grid: "horizontal", zebra: true }),
  violet:   D({ font: "Verdana", rule: "wave", header: "leftbar", title: "band", grid: "thin", zebra: true, pre: "● ", post: " ●" }),
  terre:    D({ font: "Cambria", rule: "dashed", header: "boxed", title: "underline", grid: "dashed", pre: "▸ ", post: "" , align: "left" }),
  nb:       D({ font: "Arial", rule: "single", header: "plain", title: "underline", grid: "single" }),
  emeraude: D({ font: "Palatino Linotype", rule: "triple", header: "soft", title: "boxed", grid: "horizontal", pre: "❖ ", post: " ❖" }),
  ocean:    D({ font: "Trebuchet MS", rule: "thick", header: "leftbar", title: "ornate", grid: "dotted", zebra: true, pre: "≈ ", post: " ≈" }),
  luxe:     D({ font: "Garamond", rule: "double", header: "band", title: "ornate", grid: "thin", pre: "★ ", post: " ★" }),
  rose:     D({ font: "Segoe UI", rule: "dotted", header: "soft", title: "plain", grid: "double", zebra: true, pre: "✿ ", post: " ✿" }),
  minimal:  D({ font: "Calibri Light", rule: "single", header: "plain", title: "plain", grid: "horizontal", align: "left" }),
};
export const MODELE_THEMES: ModeleTheme[] = BASE_THEMES.map((t) => ({ ...t, deco: DECOS[t.id] || DECOS.modele }));


function mix(hex: string, withHex: string, t: number): string {
  const a = hex.replace("#", ""), b = withHex.replace("#", "");
  const ch = (i: number) => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t).toString(16).padStart(2, "0");
  return (ch(0) + ch(2) + ch(4)).toUpperCase();
}
function resolveTheme(o: ModeleExportOptions): ModeleTheme {
  if (o.theme === "custom") {
    const p = (o.customPrimary || "#1E3A8A").replace("#", ""), a = (o.customAccent || "#2563EB").replace("#", "");
    return {
      id: "custom", label: "Personnalisé", acronym: a, title: p, rule: a, primary: p, banner: a,
      section: mix(a, "FFFFFF", 0.7), sectionText: mix(p, "000000", 0.4),
      headFill: mix(a, "FFFFFF", 0.85), headFill2: mix(a, "FFFFFF", 0.93), line: mix(p, "000000", 0.3),
      deco: DECOS[o.customDeco || "bleu"] || DECOS.bleu,
    };
  }
  return MODELE_THEMES.find((t) => t.id === o.theme) || MODELE_THEMES[0];
}

// Palette courante (positionnée au début de chaque génération)
let T: ModeleTheme = MODELE_THEMES[0];
const C = {
  get pink() { return T.acronym; }, get green() { return T.title; }, get rule() { return T.rule; },
  get navy() { return T.primary; }, get banner() { return T.banner; }, get bannerLight() { return T.section; },
  get bannerText() { return T.sectionText; }, get headFill() { return T.headFill; }, get headFill2() { return T.headFill2; },
  get line() { return T.line; },
};

const deco = () => T.deco || DECOS.modele;
const PAGE_W = 15840, PAGE_H = 12240;
const M = { top: 680, right: 567, bottom: 680, left: 652 };
const CONTENT_W = PAGE_W - M.left - M.right; // 14621

const borders = () => {
  const g = deco().grid;
  const mk = (style: any, size: number) => ({ style, size, color: C.line });
  const none = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  switch (g) {
    case "thin": { const l = mk(BorderStyle.SINGLE, 2); return { top: l, bottom: l, left: l, right: l }; }
    case "thick": { const l = mk(BorderStyle.SINGLE, 10); return { top: l, bottom: l, left: l, right: l }; }
    case "double": { const l = mk(BorderStyle.DOUBLE, 4); return { top: l, bottom: l, left: l, right: l }; }
    case "dotted": { const l = mk(BorderStyle.DOTTED, 6); return { top: l, bottom: l, left: l, right: l }; }
    case "dashed": { const l = mk(BorderStyle.DASHED, 6); return { top: l, bottom: l, left: l, right: l }; }
    case "horizontal": { const l = mk(BorderStyle.SINGLE, 4); return { top: l, bottom: l, left: none, right: none }; }
    default: { const l = mk(BorderStyle.SINGLE, 5); return { top: l, bottom: l, left: l, right: l }; }
  }
};
const RULE_STYLE: Record<ModeleDeco["rule"], any> = {
  double: BorderStyle.DOUBLE, single: BorderStyle.SINGLE, thick: BorderStyle.SINGLE, dashed: BorderStyle.DASHED,
  dotted: BorderStyle.DOTTED, wave: BorderStyle.WAVE, thickthin: BorderStyle.THICK_THIN_SMALL_GAP,
  triple: BorderStyle.TRIPLE, none: BorderStyle.NONE,
};
const NO_B = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const NO_BORDERS = { top: NO_B, bottom: NO_B, left: NO_B, right: NO_B };

function dataUrlToBytes(dataUrl: string): { data: Uint8Array; type: "png" | "jpg" } | null {
  try {
    const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (!m) return null;
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { data: bytes, type: m[1].toLowerCase().startsWith("p") ? "png" : "jpg" };
  } catch { return null; }
}

function run(text: string, o: { bold?: boolean; size?: number; color?: string; italics?: boolean; underline?: boolean; break?: number } = {}) {
  return new TextRun({
    text, bold: o.bold, size: o.size ?? 18, color: o.color, italics: o.italics, font: deco().font,
    underline: o.underline ? {} : undefined, break: o.break,
  });
}

/** Un paragraphe par ligne du texte (les \n deviennent de vrais paragraphes). */
function lines(text: string, o: { bold?: boolean; size?: number; color?: string; align?: "center" | "left" } = {}) {
  const parts = (text || " ").split(/\r?\n/);
  return parts.map((t) => new Paragraph({
    alignment: o.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
    spacing: { before: 0, after: 0 },
    children: [run(t || " ", o)],
  }));
}

interface CellOpts {
  width: number; span?: number; rowSpan?: number; fill?: string; color?: string; bold?: boolean;
  size?: number; align?: "center" | "left"; valign?: "center" | "top";
}
function cell(text: string, o: CellOpts) {
  return new TableCell({
    width: { size: o.width, type: WidthType.DXA },
    columnSpan: o.span, rowSpan: o.rowSpan,
    borders: borders(),
    verticalAlign: o.valign === "top" ? VerticalAlign.TOP : VerticalAlign.CENTER,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 30, bottom: 30, left: 80, right: 80 },
    children: lines(text, { bold: o.bold, size: o.size, color: o.color, align: o.align }),
  });
}

// ---- Dates ----
function capitalizeFirstWord(s: string) { return s; }
function dayLabel(firstDayDate: string | undefined, day: number): string {
  if (!firstDayDate) return `Jour ${day + 1}`;
  const m = firstDayDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return `Jour ${day + 1}`;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + day, 12));
  return capitalizeFirstWord(new Intl.DateTimeFormat("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(d));
}
const fmtTime = (t: string) => (t || "").replace(":", "h");
const range = (a: string, b: string) => `${fmtTime(a)}–${fmtTime(b)}`;

// ---- En-tête ----
function headerBlock(opts: ModeleExportOptions, logo: { data: Uint8Array; type: "png" | "jpg" }) {
  const d = deco();
  const logoW = 1134, textW = CONTENT_W - 1134;
  const filled = d.header === "band";
  const soft = d.header === "soft";
  const fill = filled ? C.navy : soft ? C.headFill : undefined;
  const txt = (def: string) => (filled ? "FFFFFF" : def);
  const edge = { style: BorderStyle.SINGLE, size: 12, color: C.navy };
  const bar = { style: BorderStyle.SINGLE, size: 36, color: C.banner };
  const logoB = d.header === "boxed" ? { ...NO_BORDERS, top: edge, bottom: edge, left: edge } : NO_BORDERS;
  const textB = d.header === "boxed" ? { ...NO_BORDERS, top: edge, bottom: edge, right: edge }
    : d.header === "leftbar" ? { ...NO_BORDERS, left: bar } : NO_BORDERS;
  const shade = fill ? { fill, type: ShadingType.CLEAR, color: "auto" } : undefined;
  const al = d.header === "leftbar" ? AlignmentType.LEFT : AlignmentType.CENTER;
  const table = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [logoW, textW],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: logoW, type: WidthType.DXA }, borders: logoB, shading: shade, verticalAlign: VerticalAlign.CENTER,
          margins: { top: 40, bottom: 40, left: 60, right: 60 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({
              type: logo.type, data: logo.data, transformation: { width: 59, height: 66 },
              altText: { title: "Logo", description: "Logo", name: "logo" },
            } as any)],
          })],
        }),
        new TableCell({
          width: { size: textW, type: WidthType.DXA }, borders: textB, shading: shade, verticalAlign: VerticalAlign.CENTER,
          margins: { top: 40, bottom: 40, left: 160, right: 160 },
          children: [
            ...(opts.acronym ? [new Paragraph({ alignment: al, children: [run(opts.acronym, { size: 28, color: txt(C.pink), bold: d.header !== "plain" })] })] : []),
            new Paragraph({ alignment: al, children: [run(opts.eventTitle, { bold: true, size: 22, color: txt(C.green) })] }),
            new Paragraph({
              alignment: al,
              children: [run(`Date : ${opts.dateRange} | Lieu : ${opts.location}`, { bold: true, size: 18, color: txt(C.green) })],
            }),
          ],
        }),
      ],
    })],
  });
  const rule = new Paragraph({
    spacing: { before: 60, after: 120 },
    border: d.rule === "none" ? undefined : {
      bottom: { style: RULE_STYLE[d.rule], size: d.rule === "thick" ? 24 : d.rule === "single" ? 8 : d.rule === "wave" ? 6 : 12, space: 1, color: C.rule },
    },
    children: [],
  });
  return [table, rule];
}

function titleParagraph(text: string) {
  const d = deco();
  const edge = { style: BorderStyle.SINGLE, size: 10, space: 4, color: C.navy };
  switch (d.title) {
    case "band":
      return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 },
        shading: { fill: C.navy, type: ShadingType.CLEAR, color: "auto" },
        children: [run(` ${text} `, { bold: true, size: 22, color: "FFFFFF" })] });
    case "boxed":
      return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100, after: 140 },
        border: { top: edge, bottom: edge, left: edge, right: edge },
        children: [run(text, { bold: true, size: 22, color: C.navy })] });
    case "ornate":
      return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 },
        border: { top: { style: BorderStyle.SINGLE, size: 6, space: 3, color: C.rule }, bottom: { style: BorderStyle.SINGLE, size: 6, space: 3, color: C.rule } },
        children: [run(`—  ${text}  —`, { bold: true, size: 22, color: C.navy })] });
    case "plain":
      return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 }, children: [run(text, { bold: true, size: 22, color: C.navy })] });
    default:
      return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 }, children: [run(text, { bold: true, size: 22, underline: true })] });
  }
}

// ---- Bloc d'activités (créneaux spéciaux) ----
const TYPE_HEADING: Record<string, string> = {
  opening: "CÉRÉMONIE D'OUVERTURE",
  ceremony: "CÉRÉMONIE",
  closing: "CÉRÉMONIE DE CLÔTURE",
  other: "ACTIVITÉS",
};
const SP_W = [4800, 6300, CONTENT_W - 4800 - 6300];

function banner(text: string, widths: number[], fill: string, color = "FFFFFF") {
  return new TableRow({
    cantSplit: true,
    children: [cell(`${deco().pre}${text}${deco().post}`, { width: widths.reduce((a, b) => a + b, 0), span: widths.length, fill, color, bold: true, size: 18, align: deco().align })],
  });
}

function specialsTable(group: SpecialSlot[], dateText: string): Table {
  const rows: TableRow[] = [];
  const roomOf = (s: SpecialSlot) => (s.room === "all" ? "" : s.room);
  let headerDone = false;
  let lastHeadingKey = "";

  const colHeader = () => new TableRow({
    cantSplit: true,
    children: [
      cell("Activités", { width: SP_W[0], fill: C.headFill, bold: true, align: "center" }),
      cell("Responsables", { width: SP_W[1], fill: C.headFill, bold: true, align: "center" }),
      cell("Horaire", { width: SP_W[2], fill: C.headFill, bold: true, align: "center" }),
    ],
  });

  for (const s of group) {
    if (s.type === "break") {
      rows.push(new TableRow({
        cantSplit: true,
        children: [
          cell(s.title || "Pause", { width: SP_W[0] + SP_W[1], span: 2, fill: C.banner, color: "FFFFFF", bold: true }),
          cell(range(s.startTime, s.endTime), { width: SP_W[2], fill: C.banner, color: "FFFFFF", bold: true, align: "center" }),
        ],
      }));
      headerDone = false; lastHeadingKey = "";
      continue;
    }

    if (s.type === "keynote") {
      // Bandeau « panel / conférence » : titre en bandeau, description (liste des intervenants) en dessous
      const where = roomOf(s) ? ` (Lieu : ${roomOf(s)})` : "";
      rows.push(banner(`${(s.title || "CONFÉRENCE").toUpperCase()}${where}, Date : ${dateText}`, SP_W, C.bannerLight, C.bannerText));
      rows.push(new TableRow({
        cantSplit: true,
        children: [
          cell(s.speaker || s.title, { width: SP_W[0] + SP_W[1], span: 2, bold: true, fill: C.headFill2 }),
          cell(range(s.startTime, s.endTime), { width: SP_W[2], bold: true, fill: C.headFill2, align: "center" }),
        ],
      }));
      if (s.description?.trim()) {
        rows.push(new TableRow({
          children: [
            cell(s.description, { width: SP_W[0] + SP_W[1] + SP_W[2], span: 3, valign: "top" }),
          ],
        }));
      }
      headerDone = false; lastHeadingKey = "";
      continue;
    }

    const headingKey = `${s.type}|${roomOf(s)}`;
    if (headingKey !== lastHeadingKey) {
      const where = roomOf(s) ? ` (Lieu : ${roomOf(s)})` : "";
      rows.push(banner(`${TYPE_HEADING[s.type] || "ACTIVITÉS"}${where}, Date : ${dateText}`, SP_W, C.bannerLight, C.bannerText));
      lastHeadingKey = headingKey; headerDone = false;
    }
    if (!headerDone) { rows.push(colHeader()); headerDone = true; }

    rows.push(new TableRow({
      cantSplit: true,
      children: [
        cell(s.title, { width: SP_W[0] }),
        cell([s.speaker, s.description].filter(Boolean).join("\n"), { width: SP_W[1] }),
        cell(range(s.startTime, s.endTime), { width: SP_W[2], align: "center" }),
      ],
    }));
  }

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: SP_W,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

// ---- Bloc de communications ----
const CW = [1000, 1700, 2500, 5000, 2100, CONTENT_W - 1000 - 1700 - 2500 - 5000 - 2100];

function commsTable(
  items: { article: Article; room: string; start: string; end: string }[],
  heading: string,
  rapMap?: Map<string, string>,
): Table {
  const rows: TableRow[] = [];
  rows.push(banner(heading, CW, C.navy));
  rows.push(new TableRow({
    tableHeader: true, cantSplit: true,
    children: ["Salle", "Date et heure", "Auteur(s) communicant", "Titre de communication", "Modérateur", "Rapporteurs"]
      .map((t, i) => cell(t, { width: CW[i], fill: C.navy, color: "FFFFFF", bold: true, align: "center" })),
  }));

  // regroupement consécutif (même salle + même modérateur + mêmes rapporteurs) pour fusionner verticalement
  const key = (x: typeof items[number]) => `${x.room}|${x.article.moderator || ""}|${x.article.sessionChair || ""}`;
  let i = 0;
  while (i < items.length) {
    let j = i + 1;
    while (j < items.length && key(items[j]) === key(items[i])) j++;
    const span = j - i;
    for (let k = i; k < j; k++) {
      const it = items[k];
      const a = it.article;
      const zf = deco().zebra && (k % 2 === 1) ? C.headFill2 : undefined;
      const children = [
        cell(it.room, { width: CW[0], align: "center", fill: zf }),
        cell(`${fmtTime(it.start)}–${fmtTime(it.end)}`, { width: CW[1], align: "center", fill: zf }),
        cell(a.authors, { width: CW[2], bold: true, size: 16, fill: zf }),
        cell(a.title, { width: CW[3], size: 16, fill: zf }),
      ];
      if (k === i) {
        children.push(
          cell(a.moderator || "", { width: CW[4], rowSpan: span, align: "center", size: 16 }),
          cell(rapMap?.get(key(it)) ?? (a.sessionChair || ""), { width: CW[5], rowSpan: span, align: "center", size: 16 }),
        );
      }
      rows.push(new TableRow({ cantSplit: true, children }));
    }
    i = j;
  }

  return new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: CW,
    layout: TableLayoutType.FIXED,
    rows,
  });
}

// ---- Rapporteurs (CSV / TXT) ----
const norm = (x: string) => (x || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Lit un fichier CSV/TXT de rapporteurs. Deux formats acceptés :
 *  - une colonne : un nom (ou « nom1 et nom2 ») par ligne → attribués dans l'ordre aux séances ;
 *  - deux colonnes (séparateur ; , ou tabulation) : « moderateur ; rapporteurs » → associés par nom du modérateur.
 * Une ligne d'en-tête (contenant « moder » ou « rapport ») est ignorée. Plusieurs lignes pour un même modérateur sont réunies par « et ».
 */
export function parseRapporteursFile(text: string): RapporteursData {
  const out: RapporteursData = { byModerator: {}, list: [] };
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  rows.forEach((line, i) => {
    const sep = line.includes(";") ? ";" : line.includes("\t") ? "\t" : line.includes(",") && line.split(",").length === 2 ? "," : "";
    const cols = (sep ? line.split(sep) : [line]).map((c) => c.trim().replace(/^"|"$/g, "").trim());
    if (i === 0 && /moder|rapport/i.test(line)) return;
    if (cols.length >= 2 && cols[0] && cols[1]) {
      const k = norm(cols[0]);
      out.byModerator[k] = out.byModerator[k] ? `${out.byModerator[k]} et ${cols[1]}` : cols[1];
    } else if (cols[0]) out.list.push(cols[0]);
  });
  return out;
}

/** Applique les rapporteurs chargés : pour chaque séance (salle + modérateur + président), détermine le texte à afficher. */
function applyRapporteurs(
  items: { article: Article; room: string; start: string; end: string }[],
  data: RapporteursData | undefined,
  state: { next: number },
): Map<string, string> {
  const res = new Map<string, string>();
  const keyOf = (x: typeof items[number]) => `${x.room}|${x.article.moderator || ""}|${x.article.sessionChair || ""}`;
  for (const it of items) {
    const k = keyOf(it);
    if (res.has(k)) continue;
    let val = it.article.sessionChair || "";
    if (data) {
      const byMod = data.byModerator[norm(it.article.moderator || "")];
      if (byMod) val = byMod;
      else if (data.list.length && state.next < data.list.length) val = data.list[state.next++];
    }
    res.set(k, val);
  }
  return res;
}

const toMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };

export function buildModeleDocument(
  schedule: ConferenceSchedule,
  articles: Article[],
  options: ModeleExportOptions,
): Document {
  T = resolveTheme(options);
  const opts: ModeleExportOptions = {
    ...DEFAULT_MODELE_OPTIONS, ...options,
    eventTitle: options.eventTitle || schedule.name,
  };
  const logo = (opts.logoDataUrl && dataUrlToBytes(opts.logoDataUrl)) || dataUrlToBytes(MODELE_DEFAULT_LOGO)!;
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const specials = schedule.specialSlots || [];

  // Numéro de thématique stable : ordre d'apparition dans le programme complet
  const themeNumber = new Map<string, number>();
  [...schedule.slots]
    .sort((a, b) => a.day - b.day || toMin(a.startTime) - toMin(b.startTime))
    .forEach((s) => {
      const cat = articleMap.get(s.articleId)?.category || "";
      if (cat && !themeNumber.has(cat)) themeNumber.set(cat, themeNumber.size + 1);
    });

  const sections: any[] = [];
  const rapState = { next: 0 };

  for (let day = 0; day < schedule.days; day++) {
    const dateText = dayLabel(opts.firstDayDate, day);
    const daySpecials = specials.filter((s) => s.day === day).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    const dayComms = schedule.slots
      .filter((s) => s.day === day && articleMap.has(s.articleId))
      .map((s) => ({ article: articleMap.get(s.articleId)!, room: s.room, start: s.startTime, end: s.endTime }));

    const children: (Paragraph | Table)[] = [];
    children.push(...headerBlock(opts, logo));

    children.push(titleParagraph(`PROGRAMME DU ${opts.eventTitle.toUpperCase()}${opts.acronym ? ` (${opts.acronym})` : ""}`));

    children.push(new Paragraph({ spacing: { after: 0 }, children: [run(`Date : ${dateText}`, { bold: true })] }));
    if (opts.location) children.push(new Paragraph({ spacing: { after: 60 }, children: [run(`Lieu : ${opts.location}`, { bold: true })] }));

    // Chronologie : on découpe la journée aux débuts des créneaux spéciaux
    type Block = { start: number; kind: "sp"; slots: SpecialSlot[] } | { start: number; kind: "co"; items: typeof dayComms };
    const blocks: Block[] = [];

    // 1) créneaux spéciaux consécutifs (sans communication entre eux) → un même tableau d'activités
    const spTimes = daySpecials.map((s) => toMin(s.startTime));
    const commStarts = dayComms.map((c) => toMin(c.start));
    let cur: SpecialSlot[] = [];
    daySpecials.forEach((s, idx) => {
      if (cur.length) {
        const prevEnd = toMin(cur[cur.length - 1].endTime);
        const hasCommBetween = commStarts.some((t) => t >= prevEnd && t < toMin(s.startTime));
        if (hasCommBetween) { blocks.push({ start: toMin(cur[0].startTime), kind: "sp", slots: cur }); cur = []; }
      }
      cur.push(s);
      if (idx === daySpecials.length - 1) blocks.push({ start: toMin(cur[0].startTime), kind: "sp", slots: cur });
    });

    // 2) communications : découpage par bloc spécial, puis par thématique
    const cuts = [...new Set(spTimes)].sort((a, b) => a - b);
    const segmentOf = (t: number) => cuts.filter((c) => c <= t).length; // index de segment
    const bySeg = new Map<number, typeof dayComms>();
    dayComms.forEach((c) => {
      const k = segmentOf(toMin(c.start));
      if (!bySeg.has(k)) bySeg.set(k, []);
      bySeg.get(k)!.push(c);
    });
    for (const [, list] of bySeg) {
      const byCat = new Map<string, typeof dayComms>();
      list.forEach((c) => {
        const k = c.article.category || "";
        if (!byCat.has(k)) byCat.set(k, []);
        byCat.get(k)!.push(c);
      });
      for (const [, items] of byCat) {
        items.sort((a, b) => a.room.localeCompare(b.room, "fr", { numeric: true }) || toMin(a.start) - toMin(b.start));
        blocks.push({ start: Math.min(...items.map((i) => toMin(i.start))), kind: "co", items });
      }
    }
    blocks.sort((a, b) => a.start - b.start);

    if (blocks.length === 0) {
      children.push(new Paragraph({ children: [run("Aucune session programmée pour ce jour.", { italics: true, color: "94A3B8" })] }));
    }
    blocks.forEach((b, idx) => {
      if (idx > 0) children.push(new Paragraph({ spacing: { before: 0, after: 0 }, children: [run(" ", { size: 6 })] }));
      if (b.kind === "sp") children.push(specialsTable(b.slots, dateText));
      else {
        const cat = b.items[0].article.category;
        const n = cat ? themeNumber.get(cat) : undefined;
        const heading = cat ? `COMMUNICATIONS — THÉMATIQUE ${n} : ${cat}` : "COMMUNICATIONS";
        children.push(commsTable(b.items, heading, applyRapporteurs(b.items, opts.rapporteurs, rapState)));
      }
    });

    sections.push({
      properties: {
        page: {
          size: { width: PAGE_H, height: PAGE_W, orientation: PageOrientation.LANDSCAPE },
          margin: { top: M.top, right: M.right, bottom: M.bottom, left: M.left },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              run(`${opts.acronym || opts.eventTitle} — Page `, { size: 14, color: "7F7F7F", italics: true }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "7F7F7F", font: deco().font }),
              run(" / ", { size: 14, color: "7F7F7F" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "7F7F7F", font: deco().font }),
            ],
          })],
        }),
      },
      children,
    });
  }

  return new Document({
    styles: { default: { document: { run: { font: deco().font, size: 18 } } } },
    sections,
  });
}

export async function exportScheduleDOCXModele(
  schedule: ConferenceSchedule,
  articles: Article[],
  options: ModeleExportOptions,
) {
  const doc = buildModeleDocument(schedule, articles, options);
  const blob = await Packer.toBlob(doc);
  const base = (options.acronym || schedule.name).replace(/\s+/g, "_");
  saveAs(blob, `${base}_programme_modele.docx`);
}
