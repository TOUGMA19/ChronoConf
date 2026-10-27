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
}

export const DEFAULT_MODELE_OPTIONS: ModeleExportOptions = {
  acronym: "",
  eventTitle: "",
  dateRange: "",
  location: "",
  firstDayDate: "",
};

// ---- Palette / constantes issues du modèle ----
const C = {
  pink: "CF52CA",
  green: "008041",
  rule: "23965A",
  navy: "23416B",
  banner: "6AA84F",
  bannerLight: "8CCB4A",
  headFill: "FFF2CC",
  headFill2: "F8F0D2",
  line: "222222",
};
const FONT = "Times New Roman";
const PAGE_W = 15840, PAGE_H = 12240;
const M = { top: 680, right: 567, bottom: 680, left: 652 };
const CONTENT_W = PAGE_W - M.left - M.right; // 14621

const LINE = { style: BorderStyle.SINGLE, size: 5, color: C.line };
const BORDERS = { top: LINE, bottom: LINE, left: LINE, right: LINE };
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
    text, bold: o.bold, size: o.size ?? 18, color: o.color, italics: o.italics, font: FONT,
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
    borders: BORDERS,
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
  const logoW = 1134, textW = CONTENT_W - 1134;
  const table = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [logoW, textW],
    layout: TableLayoutType.FIXED,
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: logoW, type: WidthType.DXA }, borders: NO_BORDERS, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new ImageRun({
              type: logo.type, data: logo.data, transformation: { width: 59, height: 66 },
              altText: { title: "Logo", description: "Logo", name: "logo" },
            } as any)],
          })],
        }),
        new TableCell({
          width: { size: textW, type: WidthType.DXA }, borders: NO_BORDERS, verticalAlign: VerticalAlign.CENTER,
          children: [
            ...(opts.acronym ? [new Paragraph({ alignment: AlignmentType.CENTER, children: [run(opts.acronym, { size: 28, color: C.pink })] })] : []),
            new Paragraph({ alignment: AlignmentType.CENTER, children: [run(opts.eventTitle, { bold: true, size: 22, color: C.green })] }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [run(`Date : ${opts.dateRange} | Lieu : ${opts.location}`, { bold: true, size: 18, color: C.green })],
            }),
          ],
        }),
      ],
    })],
  });
  const rule = new Paragraph({
    spacing: { before: 60, after: 120 },
    border: { bottom: { style: BorderStyle.DOUBLE, size: 12, space: 1, color: C.rule } },
    children: [],
  });
  return [table, rule];
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
    children: [cell(text, { width: widths.reduce((a, b) => a + b, 0), span: widths.length, fill, color, bold: true, size: 18, align: "center" })],
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
      rows.push(banner(`${(s.title || "CONFÉRENCE").toUpperCase()}${where}, Date : ${dateText}`, SP_W, C.bannerLight, "000000"));
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
      rows.push(banner(`${TYPE_HEADING[s.type] || "ACTIVITÉS"}${where}, Date : ${dateText}`, SP_W, C.bannerLight, "000000"));
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
): Table {
  const rows: TableRow[] = [];
  rows.push(banner(heading, CW, C.navy));
  rows.push(new TableRow({
    tableHeader: true, cantSplit: true,
    children: ["Salle", "Date et heure", "Auteur(s) communicant", "Titre de communication", "Modérateur", "Rapporteurs"]
      .map((t, i) => cell(t, { width: CW[i], fill: C.navy, color: "FFFFFF", bold: true, align: "center" })),
  }));

  // regroupement consécutif (même salle + même modérateur + mêmes rapporteurs) pour fusionner verticalement
  let i = 0;
  while (i < items.length) {
    let j = i + 1;
    const key = (x: typeof items[number]) => `${x.room}|${x.article.moderator || ""}|${x.article.sessionChair || ""}`;
    while (j < items.length && key(items[j]) === key(items[i])) j++;
    const span = j - i;
    for (let k = i; k < j; k++) {
      const it = items[k];
      const a = it.article;
      const children = [
        cell(it.room, { width: CW[0], align: "center" }),
        cell(`${fmtTime(it.start)}–${fmtTime(it.end)}`, { width: CW[1], align: "center" }),
        cell(a.authors, { width: CW[2], bold: true, size: 16 }),
        cell(a.title, { width: CW[3], size: 16 }),
      ];
      if (k === i) {
        children.push(
          cell(a.moderator || "", { width: CW[4], rowSpan: span, align: "center", size: 16 }),
          cell(a.sessionChair || "", { width: CW[5], rowSpan: span, align: "center", size: 16 }),
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

const toMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return h * 60 + (m || 0); };

export function buildModeleDocument(
  schedule: ConferenceSchedule,
  articles: Article[],
  options: ModeleExportOptions,
): Document {
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

  for (let day = 0; day < schedule.days; day++) {
    const dateText = dayLabel(opts.firstDayDate, day);
    const daySpecials = specials.filter((s) => s.day === day).sort((a, b) => toMin(a.startTime) - toMin(b.startTime));
    const dayComms = schedule.slots
      .filter((s) => s.day === day && articleMap.has(s.articleId))
      .map((s) => ({ article: articleMap.get(s.articleId)!, room: s.room, start: s.startTime, end: s.endTime }));

    const children: (Paragraph | Table)[] = [];
    children.push(...headerBlock(opts, logo));

    children.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 },
      children: [run(`PROGRAMME DU ${opts.eventTitle.toUpperCase()}${opts.acronym ? ` (${opts.acronym})` : ""}`, { bold: true, size: 22, underline: true })],
    }));
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
        children.push(commsTable(b.items, heading));
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
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "7F7F7F", font: FONT }),
              run(" / ", { size: 14, color: "7F7F7F" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "7F7F7F", font: FONT }),
            ],
          })],
        }),
      },
      children,
    });
  }

  return new Document({
    styles: { default: { document: { run: { font: FONT, size: 18 } } } },
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
