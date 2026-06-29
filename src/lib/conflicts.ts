import { ConferenceSchedule, Article, getDayHours } from "./conference";

export type ConflictType =
  | "overlap"          // two slots in same room overlap in time
  | "moderator"        // same moderator in two parallel sessions
  | "chair"            // same session chair in two parallel sessions
  | "author"           // same author present in two parallel sessions
  | "moderator_load"   // a moderator is overloaded across the conference
  | "chair_load"       // a session chair is overloaded
  | "room_imbalance"   // very uneven workload across rooms
  | "empty_gap"        // long empty gap inside a working day
  | "outside_hours"    // slot scheduled outside the day's working hours
  | "missing_role";    // a slot lacks moderator or session chair

export type ConflictSeverity = "error" | "warning" | "info";

export interface Conflict {
  type: ConflictType;
  severity: ConflictSeverity;
  message: string;
  day: number;
  slotIds: string[];
}

function timeToMin(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Split an "authors" string into individual normalized names. */
function splitAuthors(raw: string): string[] {
  if (!raw) return [];
  return raw
    .split(/[,;&\n]| et | and /i)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 1);
}

const SEVERITY: Record<ConflictType, ConflictSeverity> = {
  overlap: "error",
  moderator: "error",
  chair: "error",
  author: "error",
  moderator_load: "warning",
  chair_load: "warning",
  room_imbalance: "warning",
  empty_gap: "info",
  outside_hours: "error",
  missing_role: "info",
};

export const CONFLICT_LABEL: Record<ConflictType, string> = {
  overlap: "Horaire",
  moderator: "Modérateur",
  chair: "Président",
  author: "Auteur",
  moderator_load: "Charge mod.",
  chair_load: "Charge prés.",
  room_imbalance: "Salles",
  empty_gap: "Trou",
  outside_hours: "Hors plage",
  missing_role: "Rôle manquant",
};

export function detectConflicts(schedule: ConferenceSchedule, articles: Article[]): Conflict[] {
  const conflicts: Conflict[] = [];
  const articleMap = new Map(articles.map((a) => [a.id, a]));

  // Aggregated counters across the whole conference
  const moderatorCount: Record<string, number> = {};
  const chairCount: Record<string, number> = {};
  const roomMinutes: Record<string, number> = {};

  for (let day = 0; day < schedule.days; day++) {
    const daySlots = schedule.slots.filter((s) => s.day === day);
    const dh = getDayHours(schedule, day);
    const dayStartMin = dh.startHour * 60;
    const dayEndMin = dh.endHour * 60;

    // Tally global counters
    for (const s of daySlots) {
      const a = articleMap.get(s.articleId);
      if (!a) continue;
      if (a.moderator) moderatorCount[a.moderator] = (moderatorCount[a.moderator] || 0) + 1;
      if (a.sessionChair) chairCount[a.sessionChair] = (chairCount[a.sessionChair] || 0) + 1;
      roomMinutes[s.room] = (roomMinutes[s.room] || 0) + (timeToMin(s.endTime) - timeToMin(s.startTime));

      // Outside working hours
      if (timeToMin(s.startTime) < dayStartMin || timeToMin(s.endTime) > dayEndMin) {
        conflicts.push({
          type: "outside_hours",
          severity: SEVERITY.outside_hours,
          message: `« ${a.title} » (${s.startTime}-${s.endTime}) est hors de la plage horaire du jour ${day + 1}.`,
          day,
          slotIds: [s.articleId],
        });
      }

      // Missing role
      if (!a.moderator || !a.sessionChair) {
        const missing = [!a.moderator && "modérateur", !a.sessionChair && "président"].filter(Boolean).join(" et ");
        conflicts.push({
          type: "missing_role",
          severity: SEVERITY.missing_role,
          message: `« ${a.title} » n'a pas de ${missing} assigné.`,
          day,
          slotIds: [s.articleId],
        });
      }
    }

    // ---- Same-room overlaps ----
    const byRoom = new Map<string, typeof daySlots>();
    daySlots.forEach((s) => {
      const list = byRoom.get(s.room) || [];
      list.push(s);
      byRoom.set(s.room, list);
    });

    for (const [room, slots] of byRoom) {
      const sorted = [...slots].sort((a, b) => timeToMin(a.startTime) - timeToMin(b.startTime));
      for (let i = 0; i < sorted.length - 1; i++) {
        const endA = timeToMin(sorted[i].endTime);
        const startB = timeToMin(sorted[i + 1].startTime);
        if (endA > startB) {
          const artA = articleMap.get(sorted[i].articleId);
          const artB = articleMap.get(sorted[i + 1].articleId);
          conflicts.push({
            type: "overlap",
            severity: SEVERITY.overlap,
            message: `Chevauchement dans ${room} (Jour ${day + 1}) : « ${artA?.title || "?"} » (fin ${sorted[i].endTime}) et « ${artB?.title || "?"} » (début ${sorted[i + 1].startTime})`,
            day,
            slotIds: [sorted[i].articleId, sorted[i + 1].articleId],
          });
        }
      }

      // ---- Empty gaps (>= 60min between consecutive talks) ----
      for (let i = 0; i < sorted.length - 1; i++) {
        const gap = timeToMin(sorted[i + 1].startTime) - timeToMin(sorted[i].endTime);
        if (gap >= 60) {
          conflicts.push({
            type: "empty_gap",
            severity: SEVERITY.empty_gap,
            message: `Créneau vide de ${gap} min dans ${room} (Jour ${day + 1}, ${sorted[i].endTime}–${sorted[i + 1].startTime}).`,
            day,
            slotIds: [sorted[i].articleId, sorted[i + 1].articleId],
          });
        }
      }
    }

    // ---- Parallel-session conflicts (moderator / chair / author) ----
    for (let i = 0; i < daySlots.length; i++) {
      for (let j = i + 1; j < daySlots.length; j++) {
        const a = daySlots[i], b = daySlots[j];
        if (a.room === b.room) continue;
        const overlapTime = timeToMin(a.startTime) < timeToMin(b.endTime) && timeToMin(b.startTime) < timeToMin(a.endTime);
        if (!overlapTime) continue;

        const artA = articleMap.get(a.articleId);
        const artB = articleMap.get(b.articleId);
        if (!artA || !artB) continue;

        if (artA.moderator && artA.moderator === artB.moderator) {
          conflicts.push({
            type: "moderator",
            severity: SEVERITY.moderator,
            message: `Le modérateur « ${artA.moderator} » est assigné simultanément dans ${a.room} et ${b.room} (Jour ${day + 1}, ${a.startTime}-${a.endTime})`,
            day,
            slotIds: [a.articleId, b.articleId],
          });
        }
        if (artA.sessionChair && artA.sessionChair === artB.sessionChair) {
          conflicts.push({
            type: "chair",
            severity: SEVERITY.chair,
            message: `Le président « ${artA.sessionChair} » est assigné simultanément dans ${a.room} et ${b.room} (Jour ${day + 1}, ${a.startTime}-${a.endTime})`,
            day,
            slotIds: [a.articleId, b.articleId],
          });
        }

        // Author overlap (a person presenting in two rooms at once)
        const authorsA = new Set(splitAuthors(artA.authors));
        const authorsB = splitAuthors(artB.authors);
        const shared = authorsB.filter((x) => authorsA.has(x));
        if (shared.length > 0) {
          conflicts.push({
            type: "author",
            severity: SEVERITY.author,
            message: `L'auteur « ${shared[0]} » apparaît dans deux sessions simultanées (Jour ${day + 1}, ${a.startTime}-${a.endTime}, salles ${a.room} et ${b.room}).`,
            day,
            slotIds: [a.articleId, b.articleId],
          });
        }
      }
    }
  }

  // ---- Global load conflicts ----
  const MOD_LOAD_THRESHOLD = 6;   // > 6 talks moderated by the same person across the conference
  const CHAIR_LOAD_THRESHOLD = 6;
  for (const [name, count] of Object.entries(moderatorCount)) {
    if (count > MOD_LOAD_THRESHOLD) {
      conflicts.push({
        type: "moderator_load",
        severity: SEVERITY.moderator_load,
        message: `Le modérateur « ${name} » est assigné à ${count} présentations — pensez à répartir la charge.`,
        day: 0,
        slotIds: [],
      });
    }
  }
  for (const [name, count] of Object.entries(chairCount)) {
    if (count > CHAIR_LOAD_THRESHOLD) {
      conflicts.push({
        type: "chair_load",
        severity: SEVERITY.chair_load,
        message: `Le président « ${name} » est assigné à ${count} sessions — pensez à répartir la charge.`,
        day: 0,
        slotIds: [],
      });
    }
  }

  // ---- Room imbalance: any room < 50% of the busiest room ----
  const roomEntries = Object.entries(roomMinutes);
  if (roomEntries.length > 1) {
    const max = Math.max(...roomEntries.map(([, m]) => m));
    for (const [room, mins] of roomEntries) {
      if (mins < max * 0.5) {
        conflicts.push({
          type: "room_imbalance",
          severity: SEVERITY.room_imbalance,
          message: `La salle ${room} n'est utilisée que ${mins} min vs ${max} min pour la salle la plus chargée.`,
          day: 0,
          slotIds: [],
        });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  return conflicts.filter((c) => {
    const key = [...c.slotIds].sort().join("|") + c.type + c.message;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
