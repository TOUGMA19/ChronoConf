import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ConferenceSchedule, Article } from "./conference";

export interface PdfExportOptions {
  columns: {
    horaire: boolean;
    salle: boolean;
    thematique: boolean;
    titre: boolean;
    auteurs: boolean;
    moderateur: boolean;
    president: boolean;
    type: boolean;
  };
  groupByTheme: boolean;
  orientation: "landscape" | "portrait";
  showLogo: boolean;
}

export const DEFAULT_PDF_OPTIONS: PdfExportOptions = {
  columns: {
    horaire: true,
    salle: true,
    thematique: true,
    titre: true,
    auteurs: true,
    moderateur: true,
    president: true,
    type: true,
  },
  groupByTheme: true,
  orientation: "landscape",
  showLogo: true,
};

// Predefined color palette for dynamic category assignment
// 25 maximally distinct colors — no two should look similar in the PDF
const COLOR_PALETTE: [number, number, number][] = [
  [59, 130, 246],   // Blue
  [239, 68, 68],    // Red
  [34, 197, 94],    // Green
  [249, 115, 22],   // Orange
  [168, 85, 247],   // Purple
  [234, 179, 8],    // Yellow
  [20, 184, 166],   // Teal
  [236, 72, 153],   // Pink
  [99, 102, 241],   // Indigo
  [132, 204, 22],   // Lime
  [6, 182, 212],    // Cyan
  [244, 63, 94],    // Rose
  [245, 158, 11],   // Amber
  [107, 114, 128],  // Slate
  [217, 70, 239],   // Fuchsia
  [14, 165, 233],   // Sky
  [190, 18, 60],    // Crimson
  [5, 150, 105],    // Emerald
  [180, 83, 9],     // Brown
  [79, 70, 229],    // Violet
  [251, 146, 60],   // Light orange
  [21, 128, 61],    // Dark green
  [147, 51, 234],   // Vivid purple
  [225, 29, 72],    // Bright red
  [56, 189, 248],   // Light blue
];

function lighten(color: [number, number, number], factor = 0.82): [number, number, number] {
  return [
    Math.min(255, color[0] + Math.round((255 - color[0]) * factor)),
    Math.min(255, color[1] + Math.round((255 - color[1]) * factor)),
    Math.min(255, color[2] + Math.round((255 - color[2]) * factor)),
  ];
}

function buildCategoryColors(articles: Article[]): Record<string, [number, number, number]> {
  const uniqueCategories = [...new Set(articles.map((a) => a.category).filter(Boolean))];
  const map: Record<string, [number, number, number]> = {};
  uniqueCategories.forEach((cat, i) => {
    map[cat] = COLOR_PALETTE[i % COLOR_PALETTE.length];
  });
  return map;
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

interface UnifiedRow {
  time: string;
  room: string;
  article?: Article;
  isSpecial?: boolean;
  specialLabel?: string;
  specialTitle?: string;
  specialType?: string;
}

function getRowValue(key: ColumnKey, r: UnifiedRow): string {
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

// Emojis would render as garbage in jsPDF's default Helvetica (no Unicode font support).
// We use plain text labels with brackets to keep types easily distinguishable.
const SPECIAL_SLOT_LABELS: Record<string, string> = {
  keynote: "[Keynote]",
  opening: "[Ouverture]",
  closing: "[Cloture]",
  break: "[Pause]",
  ceremony: "[Ceremonie]",
  other: "[Autre]",
};

export function exportSchedulePDF(schedule: ConferenceSchedule, articles: Article[], options: PdfExportOptions = DEFAULT_PDF_OPTIONS, customLogoDataUrl?: string) {
  const orient = options.orientation || "landscape";
  const doc = new jsPDF({ orientation: orient, unit: "mm", format: "a4" });
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const pageW = doc.internal.pageSize.getWidth();
  const categoryColors = buildCategoryColors(articles);
  const specialSlots = schedule.specialSlots || [];

  const activeColumns = COLUMN_ORDER.filter((k) => options.columns[k]);
  const headers = activeColumns.map((k) => COLUMN_LABELS[k]);

  // Column width hints
  const widthHints: Record<ColumnKey, number | "auto"> = {
    horaire: 24, salle: 18, thematique: 28, titre: "auto",
    auteurs: 38, moderateur: 28, president: 28, type: 14,
  };

  for (let day = 0; day < schedule.days; day++) {
    if (day > 0) doc.addPage("a4", orient);

    const daySlots = schedule.slots.filter((s) => s.day === day);

    // Logo
    let titleStartX = 14;
    if (options.showLogo && customLogoDataUrl) {
      try {
        doc.addImage(customLogoDataUrl, "PNG", 14, 8, 14, 14);
        titleStartX = 32;
      } catch { /* skip logo on error */ }
    }

    // Title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(schedule.name, titleStartX, 16);
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Jour ${day + 1}`, titleStartX, 23);
    doc.setTextColor(0);

    // Build unified rows: articles + special slots merged
    const daySpecialSlots = specialSlots.filter((s) => s.day === day);
    let currentY = 28;

    const flatRows: UnifiedRow[] = [];

    // Add article slots
    for (const slot of daySlots) {
      const article = articleMap.get(slot.articleId);
      if (!article) continue;
      flatRows.push({ time: `${slot.startTime} - ${slot.endTime}`, room: slot.room, article });
    }

    // Add special slots into same array
    for (const ss of daySpecialSlots) {
      const typeLabel = SPECIAL_SLOT_LABELS[ss.type] || ss.type;
      const roomLabel = ss.room === "all" ? "Toutes les salles" : ss.room;
      flatRows.push({
        time: `${ss.startTime} - ${ss.endTime}`,
        room: roomLabel,
        isSpecial: true,
        specialLabel: typeLabel,
        specialTitle: `${ss.title}${ss.speaker ? " — " + ss.speaker : ""}`,
        specialType: ss.type,
      });
    }

    if (flatRows.length === 0) {
      doc.setFontSize(12);
      doc.text("Aucune session programmée pour ce jour.", 14, 35);
      continue;
    }

    // Special slot colors for row highlighting
    const specialBgColors: Record<string, [number, number, number]> = {
      break: [180, 83, 9], keynote: [30, 64, 175], opening: [91, 33, 182],
      closing: [157, 23, 77], ceremony: [21, 128, 61], other: [71, 85, 105],
    };

    if (options.groupByTheme) {
      // In grouped mode, special slots go into their own "Événements spéciaux" group
      const themeOrder: string[] = [];
      const themeRows = new Map<string, UnifiedRow[]>();
      const specialGroupKey = "Événements spéciaux";

      for (const r of flatRows) {
        const cat = r.isSpecial ? specialGroupKey : (r.article?.category || "Sans thématique");
        if (!themeRows.has(cat)) {
          themeOrder.push(cat);
          themeRows.set(cat, []);
        }
        themeRows.get(cat)!.push(r);
      }

      // Sort: put special events first, then themes
      themeOrder.sort((a, b) => {
        if (a === specialGroupKey) return -1;
        if (b === specialGroupKey) return 1;
        return 0;
      });

      // Sort within each theme by time then room
      for (const rows of themeRows.values()) {
        rows.sort((a, b) => a.time.localeCompare(b.time) || a.room.localeCompare(b.room));
      }

      // Detect if multiple rooms exist in the day → group by room within each theme
      const uniqueRooms = [...new Set(flatRows.filter(r => !r.isSpecial).map(r => r.room))];
      const hasMultipleRooms = uniqueRooms.length > 1;

      let startY = currentY;

      for (const theme of themeOrder) {
        const rows = themeRows.get(theme)!;
        // Sort by room first (to group same-room together), then by time
        if (hasMultipleRooms && theme !== specialGroupKey) {
          rows.sort((a, b) => a.room.localeCompare(b.room) || a.time.localeCompare(b.time));
        } else {
          rows.sort((a, b) => a.time.localeCompare(b.time) || a.room.localeCompare(b.room));
        }
        const themeColor = theme === specialGroupKey ? [100, 100, 100] as [number, number, number] : categoryColors[theme];

        if (startY > doc.internal.pageSize.getHeight() - 30) {
          doc.addPage("a4", orient);
          startY = 16;
        }

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        if (themeColor) doc.setTextColor(...themeColor);
        doc.text(`> ${theme}`, 14, startY + 4);
        doc.setTextColor(0);
        startY += 7;

        const chairsInBlock = [...new Set(rows.filter(r => r.article).map((r) => r.article!.sessionChair).filter(Boolean))];
        if (chairsInBlock.length > 0 && options.columns.president) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(80);
          doc.text(`Président(s) de séance : ${chairsInBlock.join(", ")}`, 18, startY + 3);
          doc.setTextColor(0);
          startY += 5;
        }

        const blockColumns = options.columns.president ? activeColumns.filter((k) => k !== "president") : activeColumns;
        const blockHeaders = blockColumns.map((k) => COLUMN_LABELS[k]);
        const body: string[][] = rows.map((r) => blockColumns.map((k) => getRowValue(k, r)));
        const catColIdx = blockColumns.indexOf("thematique");

        const columnStyles: Record<number, object> = {};
        blockColumns.forEach((k, i) => {
          const w = widthHints[k];
          const style: Record<string, unknown> = {};
          if (w !== "auto") style.cellWidth = w;
          if (k === "horaire") { style.halign = "center"; style.fontStyle = "bold"; style.fillColor = [241, 245, 249]; }
          if (k === "salle" || k === "type") style.halign = "center";
          if (Object.keys(style).length > 0) columnStyles[i] = style;
        });

        autoTable(doc, {
          startY,
          head: [blockHeaders],
          body,
          theme: "grid",
          styles: { fontSize: 7, cellPadding: 2, valign: "middle", overflow: "linebreak" },
          headStyles: { fillColor: themeColor ? themeColor : [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
          columnStyles,
          didParseCell(data) {
            if (data.section === "body" && data.row.index >= 0) {
              const row = rows[data.row.index];
              if (row?.isSpecial) {
                const bg = specialBgColors[row.specialType || "other"] || specialBgColors.other;
                data.cell.styles.fillColor = bg;
                data.cell.styles.textColor = [255, 255, 255];
                data.cell.styles.fontStyle = "bold";
              } else if (catColIdx >= 0) {
                const cat = body[data.row.index]?.[catColIdx];
                if (cat && categoryColors[cat]) {
                  data.cell.styles.fillColor = lighten(categoryColors[cat]);
                }
              }
            }
          },
          margin: { left: 10, right: 10 },
          tableWidth: pageW - 20,
        });

        startY = (doc as any).lastAutoTable.finalY + 6;
      }
    } else {
      // Chronological mode: all rows sorted by time (unified)
      flatRows.sort((a, b) => a.time.localeCompare(b.time) || a.room.localeCompare(b.room));

      const body: string[][] = flatRows.map((r) => activeColumns.map((k) => getRowValue(k, r)));
      const catColIdx = activeColumns.indexOf("thematique");

      const columnStyles: Record<number, object> = {};
      activeColumns.forEach((k, i) => {
        const w = widthHints[k];
        const style: Record<string, unknown> = {};
        if (w !== "auto") style.cellWidth = w;
        if (k === "horaire") { style.halign = "center"; style.fontStyle = "bold"; style.fillColor = [241, 245, 249]; }
        if (k === "salle" || k === "type") style.halign = "center";
        if (Object.keys(style).length > 0) columnStyles[i] = style;
      });

      autoTable(doc, {
        startY: currentY,
        head: [headers],
        body,
        theme: "grid",
        styles: { fontSize: 7, cellPadding: 2, valign: "middle", overflow: "linebreak" },
        headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
        columnStyles,
        didParseCell(data) {
          if (data.section === "body" && data.row.index >= 0) {
            const row = flatRows[data.row.index];
            if (row?.isSpecial) {
              const bg = specialBgColors[row.specialType || "other"] || specialBgColors.other;
              data.cell.styles.fillColor = bg;
              data.cell.styles.textColor = [255, 255, 255];
              data.cell.styles.fontStyle = "bold";
            } else if (catColIdx >= 0) {
              const cat = body[data.row.index]?.[catColIdx];
              if (cat && categoryColors[cat]) {
                data.cell.styles.fillColor = lighten(categoryColors[cat]);
              }
            }
          }
        },
        margin: { left: 10, right: 10 },
        tableWidth: pageW - 20,
      });
    }
  }

  // Legend page
  doc.addPage("a4", orient);
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text("Légende des thématiques", 14, 16);

  let yPos = 26;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  for (const [cat, color] of Object.entries(categoryColors)) {
    const light = lighten(color);
    doc.setFillColor(...light);
    doc.rect(14, yPos - 3.5, 6, 5, "F");
    doc.setDrawColor(...color);
    doc.rect(14, yPos - 3.5, 6, 5, "S");
    doc.text(cat, 23, yPos);
    yPos += 8;
  }

  // Add footer (with correct total page count) to ALL pages
  const totalPages = doc.getNumberOfPages();
  const pageH = doc.internal.pageSize.getHeight();
  const today = new Date().toLocaleDateString("fr-FR");
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    doc.text(`Généré par ChronoConf · ${today}`, 14, pageH - 6);
    doc.text(`Page ${p}/${totalPages}`, pageW - 14, pageH - 6, { align: "right" });
  }

  doc.save(`${schedule.name.replace(/\s+/g, "_")}_chronogramme.pdf`);
}

// ===========================================================================
// Export par salle : un PDF avec une page (ou plus) par salle, regroupant
// uniquement les sessions s'y déroulant.
// ===========================================================================
export function exportSchedulePDFByRoom(
  schedule: ConferenceSchedule,
  articles: Article[],
  options: PdfExportOptions = DEFAULT_PDF_OPTIONS,
  customLogoDataUrl?: string,
) {
  const orient = options.orientation || "landscape";
  const doc = new jsPDF({ orientation: orient, unit: "mm", format: "a4" });
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const categoryColors = buildCategoryColors(articles);
  const specialSlots = schedule.specialSlots || [];

  // Collect all unique rooms used in the schedule
  const rooms = [...new Set(schedule.slots.map((s) => s.room))].sort();
  if (rooms.length === 0) {
    doc.setFontSize(14);
    doc.text("Aucune salle programmée.", 14, 20);
    doc.save(`${schedule.name.replace(/\s+/g, "_")}_par_salle.pdf`);
    return;
  }

  // "salle" est implicite (groupé par salle) → on l'exclut des colonnes,
  // et on remplace par "Jour" pour permettre la lecture multi-jours.
  const activeColumns = COLUMN_ORDER.filter((k) => options.columns[k] && k !== "salle");
  const headers = ["Jour", ...activeColumns.map((k) => COLUMN_LABELS[k])];

  const widthHints: Record<ColumnKey, number | "auto"> = {
    horaire: 26, salle: 18, thematique: 30, titre: "auto",
    auteurs: 44, moderateur: 30, president: 30, type: 16,
  };

  let firstPage = true;
  for (const room of rooms) {
    if (!firstPage) doc.addPage("a4", orient);
    firstPage = false;

    // Header: logo + title
    let titleStartX = 14;
    if (options.showLogo && customLogoDataUrl) {
      try {
        doc.addImage(customLogoDataUrl, "PNG", 14, 8, 14, 14);
        titleStartX = 32;
      } catch { /* skip */ }
    }
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0);
    doc.text(schedule.name, titleStartX, 16);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 64, 175);
    doc.text(`Salle : ${room}`, titleStartX, 23);
    doc.setTextColor(0);

    // Build rows for this room across all days
    const rows: { time: string; day: number; article?: Article; isSpecial?: boolean; specialLabel?: string; specialTitle?: string; specialType?: string; room: string }[] = [];

    for (let day = 0; day < schedule.days; day++) {
      const daySlots = schedule.slots.filter((s) => s.day === day && s.room === room);
      for (const slot of daySlots) {
        const article = articleMap.get(slot.articleId);
        if (!article) continue;
        rows.push({ time: `${slot.startTime} - ${slot.endTime}`, day, article, room });
      }
      const daySpecial = specialSlots.filter((s) => s.day === day && (s.room === room || s.room === "all"));
      for (const ss of daySpecial) {
        const typeLabel = SPECIAL_SLOT_LABELS[ss.type] || ss.type;
        rows.push({
          time: `${ss.startTime} - ${ss.endTime}`,
          day,
          isSpecial: true,
          specialLabel: typeLabel,
          specialTitle: `${ss.title}${ss.speaker ? " — " + ss.speaker : ""}`,
          specialType: ss.type,
          room,
        });
      }
    }

    if (rows.length === 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(120);
      doc.text("Aucune session programmée dans cette salle.", 14, 35);
      continue;
    }

    rows.sort((a, b) => a.day - b.day || a.time.localeCompare(b.time));

    const body: string[][] = rows.map((r) => {
      const unified: UnifiedRow = {
        time: r.time, room: r.room,
        article: r.article, isSpecial: r.isSpecial,
        specialLabel: r.specialLabel, specialTitle: r.specialTitle, specialType: r.specialType,
      };
      return [`Jour ${r.day + 1}`, ...activeColumns.map((k) => getRowValue(k, unified))];
    });

    const specialBgColors: Record<string, [number, number, number]> = {
      break: [180, 83, 9], keynote: [30, 64, 175], opening: [91, 33, 182],
      closing: [157, 23, 77], ceremony: [21, 128, 61], other: [71, 85, 105],
    };

    const columnStyles: Record<number, object> = {
      0: { cellWidth: 16, halign: "center", fontStyle: "bold", fillColor: [241, 245, 249] },
    };
    activeColumns.forEach((k, i) => {
      const idx = i + 1; // shift for "Jour"
      const w = widthHints[k];
      const style: Record<string, unknown> = {};
      if (w !== "auto") style.cellWidth = w;
      if (k === "horaire") { style.halign = "center"; style.fontStyle = "bold"; style.fillColor = [241, 245, 249]; }
      if (k === "type") style.halign = "center";
      if (Object.keys(style).length > 0) columnStyles[idx] = style;
    });

    const catColIdx = activeColumns.indexOf("thematique");
    const catBodyIdx = catColIdx >= 0 ? catColIdx + 1 : -1;

    autoTable(doc, {
      startY: 28,
      head: [headers],
      body,
      theme: "grid",
      styles: { fontSize: 8, cellPadding: 2.2, valign: "middle", overflow: "linebreak" },
      headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: "bold", fontSize: 8.5, halign: "center" },
      columnStyles,
      didParseCell(data) {
        if (data.section === "body" && data.row.index >= 0) {
          const r = rows[data.row.index];
          if (r?.isSpecial) {
            const bg = specialBgColors[r.specialType || "other"] || specialBgColors.other;
            data.cell.styles.fillColor = bg;
            data.cell.styles.textColor = [255, 255, 255];
            data.cell.styles.fontStyle = "bold";
          } else if (catBodyIdx >= 0) {
            const cat = body[data.row.index]?.[catBodyIdx];
            if (cat && categoryColors[cat]) {
              data.cell.styles.fillColor = lighten(categoryColors[cat]);
            }
          }
        }
      },
      margin: { left: 10, right: 10 },
      tableWidth: pageW - 20,
    });
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  const today = new Date().toLocaleDateString("fr-FR");
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.setFont("helvetica", "normal");
    doc.text(`Généré par ChronoConf · ${today} · Vue par salle`, 14, pageH - 6);
    doc.text(`Page ${p}/${totalPages}`, pageW - 14, pageH - 6, { align: "right" });
  }

  doc.save(`${schedule.name.replace(/\s+/g, "_")}_par_salle.pdf`);
}
