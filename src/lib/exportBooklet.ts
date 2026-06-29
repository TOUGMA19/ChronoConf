import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { ConferenceSchedule, Article } from "./conference";

const SPECIAL_SLOT_LABELS: Record<string, string> = {
  keynote: "Keynote",
  opening: "Ouverture",
  closing: "Clôture",
  break: "Pause",
  ceremony: "Cérémonie",
  other: "Autre",
};

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function splitAuthors(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;&\n]| et | and /i)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

/**
 * Generate a full conference booklet PDF (A4 portrait):
 * - Cover page with conference name and dates
 * - Table of contents (one entry per day + appendices)
 * - Day-by-day program with full session details
 * - Abstracts section (one per oral presentation)
 * - Author index (alphabetical) with page references
 */
export function exportBookletPDF(
  schedule: ConferenceSchedule,
  articles: Article[],
  customLogoDataUrl?: string,
) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const today = new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // ---------- COVER ----------
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, pageH, "F");

  if (customLogoDataUrl) {
    try {
      doc.addImage(customLogoDataUrl, "PNG", pageW / 2 - 20, 60, 40, 40);
    } catch { /* skip */ }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(schedule.name, pageW - 40);
  doc.text(titleLines, pageW / 2, 130, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text("Livret de la conférence", pageW / 2, 160, { align: "center" });

  doc.setFontSize(11);
  doc.setTextColor(200, 210, 230);
  doc.text(`${schedule.days} jour${schedule.days > 1 ? "s" : ""} · ${schedule.rooms.length} salle${schedule.rooms.length > 1 ? "s" : ""}`, pageW / 2, 175, { align: "center" });
  doc.text(`Édité le ${today}`, pageW / 2, 185, { align: "center" });

  doc.setFontSize(8);
  doc.setTextColor(150, 165, 195);
  doc.text("Généré par ChronoConf", pageW / 2, pageH - 15, { align: "center" });
  doc.setTextColor(0, 0, 0);

  // ---------- TABLE OF CONTENTS ----------
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Sommaire", 14, 22);
  doc.setDrawColor(30, 41, 59);
  doc.line(14, 25, pageW - 14, 25);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  let tocY = 38;
  for (let d = 0; d < schedule.days; d++) {
    doc.text(`Jour ${d + 1} — Programme`, 18, tocY);
    tocY += 8;
  }
  doc.text("Résumés des présentations", 18, tocY); tocY += 8;
  doc.text("Index des auteurs", 18, tocY);

  // ---------- DAILY PROGRAM ----------
  for (let day = 0; day < schedule.days; day++) {
    doc.addPage();
    doc.setFillColor(30, 41, 59);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(`Jour ${day + 1} — Programme`, 14, 12);
    doc.setTextColor(0, 0, 0);

    const daySlots = schedule.slots.filter((s) => s.day === day);
    const daySpecials = (schedule.specialSlots || []).filter((s) => s.day === day);

    interface BookletRow {
      time: string;
      room: string;
      title: string;
      authors: string;
      moderator: string;
      chair: string;
      isSpecial: boolean;
    }

    const rows: BookletRow[] = [];
    for (const s of daySlots) {
      const a = articleMap.get(s.articleId);
      if (!a) continue;
      rows.push({
        time: `${s.startTime}-${s.endTime}`,
        room: s.room,
        title: a.title,
        authors: a.authors,
        moderator: a.moderator || "",
        chair: a.sessionChair || "",
        isSpecial: false,
      });
    }
    for (const ss of daySpecials) {
      rows.push({
        time: `${ss.startTime}-${ss.endTime}`,
        room: ss.room === "all" ? "Toutes" : ss.room,
        title: `[${SPECIAL_SLOT_LABELS[ss.type] || ss.type}] ${ss.title}${ss.speaker ? " — " + ss.speaker : ""}`,
        authors: "",
        moderator: "",
        chair: "",
        isSpecial: true,
      });
    }
    rows.sort((a, b) => timeToMin(a.time.split("-")[0]) - timeToMin(b.time.split("-")[0]) || a.room.localeCompare(b.room));

    if (rows.length === 0) {
      doc.setFontSize(11);
      doc.text("Aucune session programmée pour ce jour.", 14, 30);
      continue;
    }

    autoTable(doc, {
      startY: 24,
      head: [["Horaire", "Salle", "Présentation", "Auteurs", "Mod.", "Prés."]],
      body: rows.map((r) => [r.time, r.room, r.title, r.authors, r.moderator, r.chair]),
      theme: "grid",
      styles: { fontSize: 7, cellPadding: 1.8, valign: "top", overflow: "linebreak" },
      headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "center" },
      columnStyles: {
        0: { cellWidth: 22, halign: "center", fontStyle: "bold" },
        1: { cellWidth: 18, halign: "center" },
        2: { cellWidth: "auto" as unknown as number },
        3: { cellWidth: 40 },
        4: { cellWidth: 22 },
        5: { cellWidth: 22 },
      },
      didParseCell(data) {
        if (data.section === "body" && rows[data.row.index]?.isSpecial) {
          data.cell.styles.fillColor = [241, 245, 249];
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [30, 41, 59];
        }
      },
      margin: { left: 12, right: 12 },
      tableWidth: pageW - 24,
    });

    // Footer
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text(`${schedule.name} · Jour ${day + 1}`, 14, pageH - 6);
    doc.text(`Page ${doc.getNumberOfPages()}`, pageW - 14, pageH - 6, { align: "right" });
    doc.setTextColor(0);
  }

  // ---------- ABSTRACTS ----------
  doc.addPage();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Résumés des présentations", 14, 12);
  doc.setTextColor(0, 0, 0);

  const oralAccepted = articles
    .filter((a) => a.status === "accepted")
    .sort((a, b) => a.title.localeCompare(b.title));

  let absY = 26;
  // Track first page where each author appears (for the index)
  const authorPages: Record<string, number[]> = {};

  for (const a of oralAccepted) {
    if (absY > pageH - 30) {
      doc.addPage();
      absY = 18;
    }
    const currentPage = doc.getNumberOfPages();

    // Title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    const titleLines = doc.splitTextToSize(a.title, pageW - 28);
    doc.text(titleLines, 14, absY);
    absY += titleLines.length * 4.5 + 1;

    // Authors
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(80);
    const authorLines = doc.splitTextToSize(a.authors || "—", pageW - 28);
    doc.text(authorLines, 14, absY);
    absY += authorLines.length * 4 + 1;
    doc.setTextColor(0);

    // Meta line
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(110);
    const meta = `${a.category || "—"} · ${a.duration} min${a.moderator ? " · Mod: " + a.moderator : ""}${a.sessionChair ? " · Prés: " + a.sessionChair : ""}`;
    doc.text(meta, 14, absY);
    absY += 4;
    doc.setTextColor(0);

    // Abstract
    if (a.abstract) {
      doc.setFontSize(9);
      const absLines = doc.splitTextToSize(a.abstract, pageW - 28);
      // Page break for very long abstracts
      const needed = absLines.length * 4;
      if (absY + needed > pageH - 18) {
        doc.addPage();
        absY = 18;
      }
      doc.text(absLines, 14, absY);
      absY += absLines.length * 4 + 2;
    }

    // Separator
    doc.setDrawColor(220);
    doc.line(14, absY, pageW - 14, absY);
    absY += 6;

    // Track authors for the index
    splitAuthors(a.authors).forEach((name) => {
      if (!authorPages[name]) authorPages[name] = [];
      if (!authorPages[name].includes(currentPage)) authorPages[name].push(currentPage);
    });
  }

  // ---------- AUTHOR INDEX ----------
  doc.addPage();
  doc.setFillColor(30, 41, 59);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Index des auteurs", 14, 12);
  doc.setTextColor(0, 0, 0);

  const sortedAuthors = Object.keys(authorPages).sort((a, b) => a.localeCompare(b, "fr"));
  if (sortedAuthors.length === 0) {
    doc.setFontSize(11);
    doc.text("Aucun auteur référencé.", 14, 28);
  } else {
    autoTable(doc, {
      startY: 24,
      head: [["Auteur", "Page(s)"]],
      body: sortedAuthors.map((name) => [name, authorPages[name].join(", ")]),
      theme: "striped",
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [30, 41, 59], textColor: 255 },
      columnStyles: { 0: { cellWidth: 110 }, 1: { cellWidth: "auto" as unknown as number, halign: "center" } },
      margin: { left: 14, right: 14 },
    });
  }

  // Footer on last page
  doc.setFontSize(7);
  doc.setTextColor(120);
  doc.text(`${schedule.name} · Livret généré le ${today}`, 14, pageH - 6);
  doc.text(`Page ${doc.getNumberOfPages()}`, pageW - 14, pageH - 6, { align: "right" });

  doc.save(`${schedule.name.replace(/\s+/g, "_")}_livret.pdf`);
}
