import * as XLSX from "xlsx";
import { ConferenceSchedule, Article } from "./conference";

const SPECIAL_LABELS: Record<string, string> = {
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

/** Set column widths for a worksheet based on header lengths and a few sample rows. */
function autoFitColumns(ws: XLSX.WorkSheet, headers: string[], rows: (string | number)[][]) {
  const widths = headers.map((h, i) => {
    const maxRowLen = rows.reduce((max, row) => {
      const v = row[i];
      const len = v == null ? 0 : String(v).length;
      return Math.max(max, len);
    }, 0);
    return { wch: Math.min(60, Math.max(h.length + 2, maxRowLen + 2, 10)) };
  });
  (ws as unknown as { "!cols"?: { wch: number }[] })["!cols"] = widths;
}

/**
 * Export the conference schedule to a multi-sheet Excel file:
 * - "Programme global": all sessions across all days, sorted by day/time/room
 * - "Jour N": one sheet per day with chronological listing
 * - "Intervenants": every distinct presenter, with talk count and themes
 * - "Modérateurs": list with assignment counts and rooms
 * - "Présidents de séance": list with assignment counts and rooms
 * - "Statistiques": global stats (totals, avg duration, room/theme distribution)
 */
export function exportScheduleXLSX(schedule: ConferenceSchedule, articles: Article[]) {
  const wb = XLSX.utils.book_new();
  const articleMap = new Map(articles.map((a) => [a.id, a]));

  // ---------- 1. Global program ----------
  const globalHeaders = ["Jour", "Date/Horaire", "Salle", "Thématique", "Type", "Titre", "Auteurs", "Modérateur", "Président", "Durée (min)"];
  const globalRows: (string | number)[][] = [];

  for (let day = 0; day < schedule.days; day++) {
    const slots = schedule.slots.filter((s) => s.day === day).slice();
    const specials = (schedule.specialSlots || []).filter((s) => s.day === day);

    const all: { sortKey: number; row: (string | number)[] }[] = [];
    for (const s of slots) {
      const a = articleMap.get(s.articleId);
      if (!a) continue;
      all.push({
        sortKey: timeToMin(s.startTime),
        row: [
          `Jour ${day + 1}`,
          `${s.startTime}-${s.endTime}`,
          s.room,
          a.category || "",
          a.type || "",
          a.title,
          a.authors,
          a.moderator || "",
          a.sessionChair || "",
          a.duration,
        ],
      });
    }
    for (const ss of specials) {
      all.push({
        sortKey: timeToMin(ss.startTime),
        row: [
          `Jour ${day + 1}`,
          `${ss.startTime}-${ss.endTime}`,
          ss.room === "all" ? "Toutes" : ss.room,
          "",
          SPECIAL_LABELS[ss.type] || ss.type,
          `${ss.title}${ss.speaker ? " — " + ss.speaker : ""}`,
          "",
          "",
          "",
          timeToMin(ss.endTime) - timeToMin(ss.startTime),
        ],
      });
    }
    all.sort((a, b) => a.sortKey - b.sortKey);
    all.forEach((x) => globalRows.push(x.row));
  }

  const wsGlobal = XLSX.utils.aoa_to_sheet([globalHeaders, ...globalRows]);
  autoFitColumns(wsGlobal, globalHeaders, globalRows);
  XLSX.utils.book_append_sheet(wb, wsGlobal, "Programme global");

  // ---------- 2. One sheet per day ----------
  for (let day = 0; day < schedule.days; day++) {
    const dayHeaders = ["Horaire", "Salle", "Type", "Titre", "Thématique", "Auteurs", "Modérateur", "Président", "Durée (min)"];
    const slots = schedule.slots.filter((s) => s.day === day);
    const specials = (schedule.specialSlots || []).filter((s) => s.day === day);

    const all: { sortKey: number; row: (string | number)[] }[] = [];
    for (const s of slots) {
      const a = articleMap.get(s.articleId);
      if (!a) continue;
      all.push({
        sortKey: timeToMin(s.startTime),
        row: [
          `${s.startTime}-${s.endTime}`,
          s.room,
          a.type || "",
          a.title,
          a.category || "",
          a.authors,
          a.moderator || "",
          a.sessionChair || "",
          a.duration,
        ],
      });
    }
    for (const ss of specials) {
      all.push({
        sortKey: timeToMin(ss.startTime),
        row: [
          `${ss.startTime}-${ss.endTime}`,
          ss.room === "all" ? "Toutes" : ss.room,
          SPECIAL_LABELS[ss.type] || ss.type,
          `${ss.title}${ss.speaker ? " — " + ss.speaker : ""}`,
          "",
          "",
          "",
          "",
          timeToMin(ss.endTime) - timeToMin(ss.startTime),
        ],
      });
    }
    all.sort((a, b) => a.sortKey - b.sortKey);
    const dayRows = all.map((x) => x.row);
    const wsDay = XLSX.utils.aoa_to_sheet([dayHeaders, ...dayRows]);
    autoFitColumns(wsDay, dayHeaders, dayRows);
    XLSX.utils.book_append_sheet(wb, wsDay, `Jour ${day + 1}`);
  }

  // ---------- 3. Intervenants ----------
  const speakerMap = new Map<string, { count: number; themes: Set<string> }>();
  for (const s of schedule.slots) {
    const a = articleMap.get(s.articleId);
    if (!a) continue;
    splitAuthors(a.authors).forEach((name) => {
      const e = speakerMap.get(name) || { count: 0, themes: new Set<string>() };
      e.count++;
      if (a.category) e.themes.add(a.category);
      speakerMap.set(name, e);
    });
  }
  const speakerHeaders = ["Intervenant", "Nb présentations", "Thématiques"];
  const speakerRows = [...speakerMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "fr"))
    .map(([name, info]) => [name, info.count, [...info.themes].join(", ")] as (string | number)[]);
  const wsSpeakers = XLSX.utils.aoa_to_sheet([speakerHeaders, ...speakerRows]);
  autoFitColumns(wsSpeakers, speakerHeaders, speakerRows);
  XLSX.utils.book_append_sheet(wb, wsSpeakers, "Intervenants");

  // ---------- 4. Moderators ----------
  const modMap = new Map<string, { count: number; rooms: Set<string> }>();
  for (const s of schedule.slots) {
    const a = articleMap.get(s.articleId);
    if (!a?.moderator) continue;
    const e = modMap.get(a.moderator) || { count: 0, rooms: new Set<string>() };
    e.count++;
    e.rooms.add(s.room);
    modMap.set(a.moderator, e);
  }
  const modHeaders = ["Modérateur", "Nb sessions", "Salles"];
  const modRows = [...modMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, info]) => [name, info.count, [...info.rooms].join(", ")] as (string | number)[]);
  const wsMods = XLSX.utils.aoa_to_sheet([modHeaders, ...modRows]);
  autoFitColumns(wsMods, modHeaders, modRows);
  XLSX.utils.book_append_sheet(wb, wsMods, "Modérateurs");

  // ---------- 5. Session chairs ----------
  const chairMap = new Map<string, { count: number; rooms: Set<string> }>();
  for (const s of schedule.slots) {
    const a = articleMap.get(s.articleId);
    if (!a?.sessionChair) continue;
    const e = chairMap.get(a.sessionChair) || { count: 0, rooms: new Set<string>() };
    e.count++;
    e.rooms.add(s.room);
    chairMap.set(a.sessionChair, e);
  }
  const chairHeaders = ["Président de séance", "Nb sessions", "Salles"];
  const chairRows = [...chairMap.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([name, info]) => [name, info.count, [...info.rooms].join(", ")] as (string | number)[]);
  const wsChairs = XLSX.utils.aoa_to_sheet([chairHeaders, ...chairRows]);
  autoFitColumns(wsChairs, chairHeaders, chairRows);
  XLSX.utils.book_append_sheet(wb, wsChairs, "Présidents de séance");

  // ---------- 6. Statistics ----------
  const totalSlots = schedule.slots.length;
  const totalDuration = schedule.slots.reduce((sum, s) => sum + (timeToMin(s.endTime) - timeToMin(s.startTime)), 0);
  const avgDuration = totalSlots > 0 ? Math.round(totalDuration / totalSlots) : 0;

  const themeCount: Record<string, number> = {};
  const roomCount: Record<string, number> = {};
  for (const s of schedule.slots) {
    const a = articleMap.get(s.articleId);
    if (a?.category) themeCount[a.category] = (themeCount[a.category] || 0) + 1;
    roomCount[s.room] = (roomCount[s.room] || 0) + 1;
  }

  const statsRows: (string | number)[][] = [
    ["Statistiques globales", ""],
    ["Conférence", schedule.name],
    ["Nombre de jours", schedule.days],
    ["Nombre de salles", schedule.rooms.length],
    ["Total présentations", totalSlots],
    ["Durée totale (min)", totalDuration],
    ["Durée moyenne (min)", avgDuration],
    ["Créneaux spéciaux", (schedule.specialSlots || []).length],
    [], [],
    ["Répartition par thématique", "Nb présentations"],
    ...Object.entries(themeCount).sort((a, b) => b[1] - a[1]),
    [], [],
    ["Répartition par salle", "Nb présentations"],
    ...Object.entries(roomCount).sort((a, b) => b[1] - a[1]),
  ];
  const wsStats = XLSX.utils.aoa_to_sheet(statsRows);
  (wsStats as unknown as { "!cols"?: { wch: number }[] })["!cols"] = [{ wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, wsStats, "Statistiques");

  XLSX.writeFile(wb, `${schedule.name.replace(/\s+/g, "_")}_export.xlsx`);
}
