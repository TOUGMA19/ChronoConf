import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, Footer, PageNumber, ImageRun,
} from "docx";
import { saveAs } from "file-saver";
import { ConferenceSchedule, Article } from "./conference";
import { PdfExportOptions, DEFAULT_PDF_OPTIONS } from "./exportPdf";

function dataUrlToBytes(dataUrl: string): { data: Uint8Array; type: "png" | "jpg" } | null {
  try {
    const m = dataUrl.match(/^data:image\/(png|jpe?g);base64,(.+)$/i);
    if (!m) return null;
    const type = m[1].toLowerCase().startsWith("p") ? "png" : "jpg";
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { data: bytes, type };
  } catch { return null; }
}

type ColumnKey = keyof PdfExportOptions["columns"];

const COLUMN_LABELS: Record<ColumnKey, string> = {
  horaire: "Horaire",
  salle: "Salle",
  thematique: "Thématique",
  titre: "Titre",
  auteurs: "Auteurs",
  moderateur: "Modérateur",
  president: "Président de séance",
  type: "Type",
};

const COLUMN_ORDER: ColumnKey[] = ["horaire", "salle", "thematique", "titre", "auteurs", "moderateur", "president", "type"];

const SPECIAL_LABELS: Record<string, string> = {
  keynote: "[Keynote]",
  opening: "[Ouverture]",
  closing: "[Clôture]",
  break: "[Pause]",
  ceremony: "[Cérémonie]",
  other: "[Autre]",
};

interface UnifiedRow {
  time: string;
  room: string;
  day: number;
  article?: Article;
  isSpecial?: boolean;
  specialLabel?: string;
  specialTitle?: string;
  specialType?: string;
}

function getValue(key: ColumnKey, r: UnifiedRow): string {
  if (r.isSpecial) {
    switch (key) {
      case "horaire": return r.time;
      case "salle": return r.room;
      case "titre": return r.specialTitle || "";
      case "type": return r.specialLabel || "";
      default: return "";
    }
  }
  const a = r.article!;
  switch (key) {
    case "horaire": return r.time;
    case "salle": return r.room;
    case "thematique": return a.category || "";
    case "titre": return a.title;
    case "auteurs": return a.authors;
    case "moderateur": return a.moderator || "";
    case "president": return a.sessionChair || "";
    case "type": return a.type || "";
  }
}

const border = { style: BorderStyle.SINGLE, size: 4, color: "BFBFBF" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

function headerCell(text: string, width: number): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: { fill: "1E3A8A", type: ShadingType.CLEAR, color: "auto" },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text, bold: true, color: "FFFFFF", size: 18 })],
    })],
  });
}

function bodyCell(text: string, width: number, opts: { bold?: boolean; bg?: string; color?: string; align?: "center" | "left" } = {}): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: cellBorders,
    shading: opts.bg ? { fill: opts.bg, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align === "center" ? AlignmentType.CENTER : AlignmentType.LEFT,
      children: [new TextRun({ text: text || " ", bold: opts.bold, color: opts.color, size: 16 })],
    })],
  });
}

const SPECIAL_BG: Record<string, string> = {
  break: "B45309", keynote: "1E3A8A", opening: "5B21B6",
  closing: "9D174D", ceremony: "15803D", other: "475569",
};

export function exportScheduleDOCX(
  schedule: ConferenceSchedule,
  articles: Article[],
  options: PdfExportOptions = DEFAULT_PDF_OPTIONS,
  customLogoDataUrl?: string,
) {
  const logo = options.showLogo && customLogoDataUrl ? dataUrlToBytes(customLogoDataUrl) : null;
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const specialSlots = schedule.specialSlots || [];
  const activeColumns = COLUMN_ORDER.filter((k) => options.columns[k]);
  const isLandscape = options.orientation === "landscape";

  // Page width in DXA: A4 portrait = 11906, landscape swaps; use content width:
  const pageW = isLandscape ? 16838 : 11906;
  const margin = 720; // 0.5"
  const contentW = pageW - margin * 2;
  const colW = Math.floor(contentW / activeColumns.length);

  const widthHints: Partial<Record<ColumnKey, number>> = {
    horaire: 1200, salle: 900, thematique: 1500, type: 800,
  };
  const totalHinted = activeColumns.reduce((s, k) => s + (widthHints[k] || 0), 0);
  const remaining = contentW - totalHinted;
  const flexCols = activeColumns.filter((k) => !widthHints[k]).length || 1;
  const flexW = Math.floor(remaining / flexCols);
  const colWidths: Record<ColumnKey, number> = {} as Record<ColumnKey, number>;
  activeColumns.forEach((k) => { colWidths[k] = widthHints[k] || flexW; });
  const totalW = activeColumns.reduce((s, k) => s + colWidths[k], 0);

  const sections: any[] = [];

  for (let day = 0; day < schedule.days; day++) {
    const daySlots = schedule.slots.filter((s) => s.day === day);
    const daySpecial = specialSlots.filter((s) => s.day === day);

    const rows: UnifiedRow[] = [];
    for (const slot of daySlots) {
      const article = articleMap.get(slot.articleId);
      if (!article) continue;
      rows.push({ time: `${slot.startTime} - ${slot.endTime}`, room: slot.room, day, article });
    }
    for (const ss of daySpecial) {
      rows.push({
        time: `${ss.startTime} - ${ss.endTime}`,
        room: ss.room === "all" ? "Toutes les salles" : ss.room,
        day,
        isSpecial: true,
        specialLabel: SPECIAL_LABELS[ss.type] || ss.type,
        specialTitle: `${ss.title}${ss.speaker ? " — " + ss.speaker : ""}`,
        specialType: ss.type,
      });
    }
    rows.sort((a, b) => a.time.localeCompare(b.time) || a.room.localeCompare(b.room));

    const children: (Paragraph | Table)[] = [];

    // Logo (optional)
    if (logo) {
      children.push(new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [new ImageRun({
          type: logo.type,
          data: logo.data,
          transformation: { width: 60, height: 60 },
          altText: { title: "Logo", description: "Conference logo", name: "logo" },
        } as any)],
      }));
    }
    // Title
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: schedule.name, bold: true, size: 36 })],
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: `Jour ${day + 1}`, size: 24, color: "475569" })],
      spacing: { after: 200 },
    }));

    if (rows.length === 0) {
      children.push(new Paragraph({
        children: [new TextRun({ text: "Aucune session programmée pour ce jour.", italics: true, color: "94A3B8" })],
      }));
    } else {
      const headerRow = new TableRow({
        tableHeader: true,
        children: activeColumns.map((k) => headerCell(COLUMN_LABELS[k], colWidths[k])),
      });

      const bodyRows = rows.map((r) => new TableRow({
        children: activeColumns.map((k) => {
          const v = getValue(k, r);
          if (r.isSpecial) {
            const bg = SPECIAL_BG[r.specialType || "other"] || SPECIAL_BG.other;
            return bodyCell(v, colWidths[k], { bg, color: "FFFFFF", bold: true, align: k === "horaire" || k === "type" || k === "salle" ? "center" : "left" });
          }
          return bodyCell(v, colWidths[k], {
            align: k === "horaire" || k === "type" || k === "salle" ? "center" : "left",
            bold: k === "horaire",
            bg: k === "horaire" ? "F1F5F9" : undefined,
          });
        }),
      }));

      children.push(new Table({
        width: { size: totalW, type: WidthType.DXA },
        columnWidths: activeColumns.map((k) => colWidths[k]),
        rows: [headerRow, ...bodyRows],
      }));
    }

    sections.push({
      properties: {
        page: {
          size: {
            width: 11906,  // pass portrait dimensions; docx swaps for landscape
            height: 16838,
            orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
          },
          margin: { top: margin, right: margin, bottom: margin, left: margin },
        },
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Généré par ChronoConf · Page ", size: 14, color: "94A3B8" }),
              new TextRun({ children: [PageNumber.CURRENT], size: 14, color: "94A3B8" }),
              new TextRun({ text: " / ", size: 14, color: "94A3B8" }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 14, color: "94A3B8" }),
            ],
          })],
        }),
      },
      children,
    });
  }

  const doc = new Document({
    styles: {
      default: { document: { run: { font: "Arial", size: 20 } } },
      paragraphStyles: [
        {
          id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
          run: { size: 36, bold: true, font: "Arial", color: "1E3A8A" },
          paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 },
        },
      ],
    },
    sections,
  });

  Packer.toBlob(doc).then((blob) => {
    saveAs(blob, `${schedule.name.replace(/\s+/g, "_")}_chronogramme.docx`);
  });
}
