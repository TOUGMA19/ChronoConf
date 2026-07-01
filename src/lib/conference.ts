// Free-form, user-configurable presentation type (e.g. "présentielle", "en ligne", ...)
export type ArticleType = string;
export type ArticleStatus = "submitted" | "accepted" | "rejected";

export const DEFAULT_PRESENTATION_TYPES: string[] = ["présentielle", "en ligne"];

export interface Article {
  id: string;
  code?: string; // Code externe (ex. numéro d'article dans le CSV) utilisé pour la synchro intervenants
  title: string;
  authors: string;
  moderator: string;
  sessionChair: string;
  abstract: string;
  category: string;
  duration: number; // minutes
  type: ArticleType;
  status: ArticleStatus;
}

export interface Organizer {
  name: string;
  role: string;
}


export interface ScheduleSlot {
  articleId: string;
  room: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  day: number;       // day index (0-based)
}

export type SpecialSlotType = "keynote" | "opening" | "closing" | "break" | "ceremony" | "other";

export interface SpecialSlot {
  id: string;
  title: string;
  speaker?: string;
  description?: string;
  type: SpecialSlotType;
  room: string;        // "all" = spans all rooms
  startTime: string;
  endTime: string;
  day: number;
}

export interface DayHours {
  startHour: number; // fractional, e.g. 8.5 = 08:30
  endHour: number;
}

export interface ConferenceSchedule {
  id: string;
  name: string;
  days: number;
  rooms: string[];
  startHour: number; // default / fallback
  endHour: number;
  dayHours?: DayHours[]; // per-day overrides (index = day)
  breakMinutes: number;
  slots: ScheduleSlot[];
  specialSlots: SpecialSlot[];
  createdAt: Date;
}

/** Get start/end hours for a specific day, with fallback to global values */
export function getDayHours(schedule: ConferenceSchedule, day: number): DayHours {
  if (schedule.dayHours && schedule.dayHours[day]) {
    return schedule.dayHours[day];
  }
  return { startHour: schedule.startHour, endHour: schedule.endHour };
}

// ===== Persistence with 7-day TTL =====
const STORAGE_KEY = "chronoconf_data";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface PersistedData {
  articles: Article[];
  schedule: ConferenceSchedule | null;
  categories: string[];
  moderators: string[];
  sessionChairs: string[];
  organizers?: Organizer[];
  presentationTypes?: string[];
  savedAt: number;
}

function saveToStorage(): void {
  try {
    const data: PersistedData = {
      articles, schedule, categories, moderators, sessionChairs, organizers, presentationTypes,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch { /* quota exceeded — silent fail */ }
}

function loadFromStorage(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    // Guard against excessively large payloads (max 10MB)
    if (raw.length > 10 * 1024 * 1024) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const data: PersistedData = JSON.parse(raw);
    if (typeof data.savedAt !== "number" || Date.now() - data.savedAt > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    // Validate structure
    if (!Array.isArray(data.articles) || (!data.schedule && data.schedule !== null)) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    articles = data.articles || [];
    schedule = data.schedule || null;
    categories = Array.isArray(data.categories) ? data.categories : [];
    moderators = Array.isArray(data.moderators) ? data.moderators : [];
    sessionChairs = Array.isArray(data.sessionChairs) ? data.sessionChairs : [];
    organizers = Array.isArray(data.organizers)
      ? data.organizers.filter((o: any) => o && typeof o.name === "string").map((o: any) => ({ name: String(o.name), role: String(o.role || "") }))
      : [];
    presentationTypes = Array.isArray(data.presentationTypes) && data.presentationTypes.length > 0
      ? data.presentationTypes
      : [...DEFAULT_PRESENTATION_TYPES];

    // Migrate legacy "oral" / "poster" values to the new defaults
    const TYPE_MIGRATION: Record<string, string> = {
      oral: "présentielle",
      poster: "en ligne",
    };
    let migrated = false;
    articles = articles.map((a) => {
      const mapped = TYPE_MIGRATION[a.type];
      if (mapped) { migrated = true; return { ...a, type: mapped }; }
      return a;
    });
    // Ensure every article's type exists in the configurable list
    const knownTypes = new Set(presentationTypes);
    articles.forEach((a) => {
      if (a.type && !knownTypes.has(a.type)) {
        presentationTypes = [...presentationTypes, a.type];
        knownTypes.add(a.type);
        migrated = true;
      }
    });
    if (migrated) saveToStorage();
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Dynamic categories managed by the user
let categories: string[] = [];
let articles: Article[] = [];
let schedule: ConferenceSchedule | null = null;
let moderators: string[] = [];
let sessionChairs: string[] = [];
let organizers: Organizer[] = [];
let presentationTypes: string[] = [...DEFAULT_PRESENTATION_TYPES];

// ===== Presentation types CRUD =====
export function getPresentationTypes(): string[] {
  return [...presentationTypes];
}

export function setPresentationTypes(types: string[]): void {
  const cleaned = Array.from(new Set(types.map((t) => t.trim()).filter(Boolean)));
  presentationTypes = cleaned.length > 0 ? cleaned : [...DEFAULT_PRESENTATION_TYPES];
  saveToStorage();
}

export function addPresentationType(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed && !presentationTypes.includes(trimmed)) {
    presentationTypes = [...presentationTypes, trimmed];
    saveToStorage();
    return true;
  }
  return false;
}

export function removePresentationType(name: string): void {
  // Don't allow removing if it would leave the list empty
  const next = presentationTypes.filter((t) => t !== name);
  if (next.length === 0) return;
  presentationTypes = next;
  saveToStorage();
}

export function renamePresentationType(oldName: string, newName: string): boolean {
  const trimmed = newName.trim();
  if (!trimmed || oldName === trimmed) return false;
  if (presentationTypes.includes(trimmed)) return false;
  presentationTypes = presentationTypes.map((t) => (t === oldName ? trimmed : t));
  // Cascade rename on articles
  articles = articles.map((a) => (a.type === oldName ? { ...a, type: trimmed } : a));
  saveToStorage();
  return true;
}

export interface ThemeOverflow {
  theme: string;
  preferredRoom: string;
  overflowRooms: string[];
  overflowCount: number;
}
let lastOverflowReport: ThemeOverflow[] = [];
export function getLastOverflowReport(): ThemeOverflow[] {
  return [...lastOverflowReport];
}

// Load persisted data on module init
loadFromStorage();

export function getCategories(): string[] {
  return [...categories];
}

export function addCategory(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed && !categories.includes(trimmed)) {
    categories = [...categories, trimmed];
    saveToStorage();
    return true;
  }
  return false;
}

export function addCategories(names: string[]): number {
  let count = 0;
  names.forEach((n) => {
    const trimmed = n.trim();
    if (trimmed && !categories.includes(trimmed)) {
      categories = [...categories, trimmed];
      count++;
    }
  });
  if (count > 0) saveToStorage();
  return count;
}

export function removeCategory(name: string): void {
  categories = categories.filter((c) => c !== name);
  saveToStorage();
}

export function clearCategories(): void {
  categories = [];
  saveToStorage();
}

export function getModerators(): string[] {
  return [...moderators];
}

export function addModerator(name: string): void {
  const trimmed = name.trim();
  if (trimmed && !moderators.includes(trimmed)) {
    moderators = [...moderators, trimmed];
    saveToStorage();
  }
}

export function addModerators(names: string[]): number {
  let count = 0;
  names.forEach((n) => {
    const trimmed = n.trim();
    if (trimmed && !moderators.includes(trimmed)) {
      moderators = [...moderators, trimmed];
      count++;
    }
  });
  if (count > 0) saveToStorage();
  return count;
}

export function removeModerator(name: string): void {
  moderators = moderators.filter((m) => m !== name);
  saveToStorage();
}

export function clearModerators(): void {
  moderators = [];
  saveToStorage();
}

// Session Chairs management
export function getSessionChairs(): string[] {
  return [...sessionChairs];
}

export function addSessionChair(name: string): void {
  const trimmed = name.trim();
  if (trimmed && !sessionChairs.includes(trimmed)) {
    sessionChairs = [...sessionChairs, trimmed];
    saveToStorage();
  }
}

export function addSessionChairs(names: string[]): number {
  let count = 0;
  names.forEach((n) => {
    const trimmed = n.trim();
    if (trimmed && !sessionChairs.includes(trimmed)) {
      sessionChairs = [...sessionChairs, trimmed];
      count++;
    }
  });
  if (count > 0) saveToStorage();
  return count;
}

export function removeSessionChair(name: string): void {
  sessionChairs = sessionChairs.filter((c) => c !== name);
  saveToStorage();
}

export function clearSessionChairs(): void {
  sessionChairs = [];
  saveToStorage();
}

// ===== Organizers (with roles) =====
export function getOrganizers(): Organizer[] {
  return organizers.map((o) => ({ ...o }));
}

export function addOrganizer(name: string, role: string): boolean {
  const n = name.trim();
  const r = role.trim();
  if (!n) return false;
  if (organizers.some((o) => o.name.toLowerCase() === n.toLowerCase())) return false;
  organizers = [...organizers, { name: n, role: r }];
  saveToStorage();
  return true;
}

export function addOrganizers(entries: Organizer[]): number {
  let count = 0;
  entries.forEach((e) => {
    const n = (e.name || "").trim();
    const r = (e.role || "").trim();
    if (!n) return;
    if (organizers.some((o) => o.name.toLowerCase() === n.toLowerCase())) return;
    organizers = [...organizers, { name: n, role: r }];
    count++;
  });
  if (count > 0) saveToStorage();
  return count;
}

export function removeOrganizer(name: string): void {
  organizers = organizers.filter((o) => o.name !== name);
  saveToStorage();
}

export function clearOrganizers(): void {
  organizers = [];
  saveToStorage();
}


export function getArticles(): Article[] {
  return [...articles];
}

export function addArticle(a: Omit<Article, "id">): Article {
  if (a.category && !categories.includes(a.category)) {
    categories = [...categories, a.category];
  }
  if (a.type && !presentationTypes.includes(a.type)) {
    presentationTypes = [...presentationTypes, a.type];
  }
  const newA: Article = { ...a, id: Date.now().toString() + Math.random().toString(36).slice(2, 6) };
  articles = [newA, ...articles];
  saveToStorage();
  return newA;
}

export function deleteArticle(id: string): void {
  articles = articles.filter((a) => a.id !== id);
  saveToStorage();
}

export function updateArticle(id: string, data: Partial<Article>): void {
  if (data.type && !presentationTypes.includes(data.type)) {
    presentationTypes = [...presentationTypes, data.type];
  }
  articles = articles.map((a) => (a.id === id ? { ...a, ...data } : a));
  saveToStorage();
}

export function getSchedule(): ConferenceSchedule | null {
  return schedule;
}

export function setSchedule(s: ConferenceSchedule): void {
  schedule = s;
  saveToStorage();
}

export function clearSchedule(): void {
  schedule = null;
  saveToStorage();
}

export function clearAllData(): void {
  articles = [];
  schedule = null;
  categories = [];
  moderators = [];
  sessionChairs = [];
  presentationTypes = [...DEFAULT_PRESENTATION_TYPES];
  localStorage.removeItem(STORAGE_KEY);
}

// ===== Special Slots =====
export function addSpecialSlot(slot: Omit<SpecialSlot, "id">): SpecialSlot {
  if (!schedule) return { ...slot, id: "" };
  const newSlot: SpecialSlot = { ...slot, id: "sp_" + Date.now().toString() + Math.random().toString(36).slice(2, 5) };
  schedule = { ...schedule, specialSlots: [...(schedule.specialSlots || []), newSlot] };
  saveToStorage();
  return newSlot;
}

export function removeSpecialSlot(id: string): void {
  if (!schedule) return;
  schedule = { ...schedule, specialSlots: (schedule.specialSlots || []).filter((s) => s.id !== id) };
  saveToStorage();
}

export function updateSpecialSlot(id: string, data: Partial<Omit<SpecialSlot, "id">>): void {
  if (!schedule) return;
  schedule = {
    ...schedule,
    specialSlots: (schedule.specialSlots || []).map((s) =>
      s.id === id ? { ...s, ...data } : s
    ),
  };
  saveToStorage();
}

export function getSpecialSlots(): SpecialSlot[] {
  return schedule?.specialSlots || [];
}

function parseMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export interface MoveResult {
  success: boolean;
  message: string;
  adjustedTime?: string;
}

/**
 * Move a slot to a new room/time, respecting break time and avoiding overlaps.
 * Returns a result indicating success or failure with a message.
 */
export function moveSlot(articleId: string, newRoom: string, newStartTime: string, day?: number): MoveResult {
  if (!schedule) return { success: false, message: "Aucun chronogramme" };

  const slot = schedule.slots.find((s) => s.articleId === articleId);
  if (!slot) return { success: false, message: "Créneau introuvable" };

  const duration = parseMinutes(slot.endTime) - parseMinutes(slot.startTime);
  const breakMin = schedule.breakMinutes || 0;
  const targetDay = day ?? slot.day;
  let startMin = parseMinutes(newStartTime);
  let endMin = startMin + duration;

  // Clamp to schedule bounds (per-day)
  const dh = getDayHours(schedule, targetDay);
  const dayStartMin = dh.startHour * 60;
  const dayEndMin = dh.endHour * 60;
  if (startMin < dayStartMin) startMin = dayStartMin;
  if (endMin > dayEndMin) {
    startMin = dayEndMin - duration;
    if (startMin < dayStartMin) return { success: false, message: "Pas assez de place dans cette journée" };
  }
  endMin = startMin + duration;

  // Get other slots in the same room & day
  const otherSlots = schedule.slots
    .filter((s) => s.articleId !== articleId && s.room === newRoom && s.day === targetDay)
    .map((s) => ({ start: parseMinutes(s.startTime), end: parseMinutes(s.endTime), id: s.articleId }))
    .sort((a, b) => a.start - b.start);

  // Check for overlap (including break time)
  const hasConflict = otherSlots.some((o) => {
    const oStartWithBreak = o.start - breakMin;
    const oEndWithBreak = o.end + breakMin;
    return startMin < oEndWithBreak && endMin > oStartWithBreak;
  });

  if (hasConflict) {
    // Try to find nearest valid position (snap to closest gap)
    let bestStart = -1;
    let bestDist = Infinity;

    // Try before each slot
    for (const o of otherSlots) {
      const candidateEnd = o.start - breakMin;
      const candidateStart = candidateEnd - duration;
      if (candidateStart >= dayStartMin) {
        const conflictsOther = otherSlots.some((ox) => ox !== o && candidateStart < ox.end + breakMin && candidateEnd > ox.start - breakMin);
        if (!conflictsOther) {
          const dist = Math.abs(candidateStart - parseMinutes(newStartTime));
          if (dist < bestDist) { bestDist = dist; bestStart = candidateStart; }
        }
      }
    }

    // Try after each slot
    for (const o of otherSlots) {
      const candidateStart = o.end + breakMin;
      const candidateEnd = candidateStart + duration;
      if (candidateEnd <= dayEndMin) {
        const conflictsOther = otherSlots.some((ox) => ox !== o && candidateStart < ox.end + breakMin && candidateEnd > ox.start - breakMin);
        if (!conflictsOther) {
          const dist = Math.abs(candidateStart - parseMinutes(newStartTime));
          if (dist < bestDist) { bestDist = dist; bestStart = candidateStart; }
        }
      }
    }

    if (bestStart >= 0) {
      startMin = bestStart;
      endMin = startMin + duration;
    } else {
      return { success: false, message: `Pas de place disponible dans ${newRoom} en respectant l'écart de ${breakMin} min` };
    }
  }

  const finalStart = fmt(startMin);
  const finalEnd = fmt(endMin);

  schedule = {
    ...schedule,
    slots: schedule.slots.map((s) => {
      if (s.articleId !== articleId) return s;
      return { ...s, room: newRoom, startTime: finalStart, endTime: finalEnd, day: targetDay };
    }),
  };
  saveToStorage();

  const adjusted = fmt(startMin) !== newStartTime;
  return {
    success: true,
    message: adjusted
      ? `Déplacé à ${finalStart} (ajusté pour respecter l'écart de ${breakMin} min)`
      : `Déplacé à ${finalStart} dans ${newRoom}`,
    adjustedTime: finalStart,
  };
}

/** Swap two slots: exchange their room, startTime and endTime */
export function swapSlots(articleIdA: string, articleIdB: string): void {
  if (!schedule) return;
  const slotA = schedule.slots.find((s) => s.articleId === articleIdA);
  const slotB = schedule.slots.find((s) => s.articleId === articleIdB);
  if (!slotA || !slotB) return;

  schedule = {
    ...schedule,
    slots: schedule.slots.map((s) => {
      if (s.articleId === articleIdA) {
        return { ...s, room: slotB.room, startTime: slotB.startTime, endTime: slotB.endTime, day: slotB.day };
      }
      if (s.articleId === articleIdB) {
        return { ...s, room: slotA.room, startTime: slotA.startTime, endTime: slotA.endTime, day: slotA.day };
      }
      return s;
    }),
  };
  saveToStorage();
}

/** Get a snapshot of current slots for undo */
export function getSlotSnapshot(): ScheduleSlot[] {
  return schedule ? [...schedule.slots.map((s) => ({ ...s }))] : [];
}

/** Restore slots from a snapshot */
export function restoreSlotSnapshot(snapshot: ScheduleSlot[]): void {
  if (!schedule) return;
  schedule = { ...schedule, slots: snapshot };
  saveToStorage();
}

// Helper: format minutes to "HH:mm"
function fmt(minutes: number): string {
  return `${Math.floor(minutes / 60).toString().padStart(2, "0")}:${(minutes % 60).toString().padStart(2, "0")}`;
}

// Improved schedule generation handling 100+ articles
export function generateScheduleLocally(
  conferenceArticles: Article[],
  config: { name: string; days: number; rooms: string[]; startHour: number; endHour: number; dayHours?: DayHours[]; breakMinutes?: number; lunchStart?: string; lunchEnd?: string; moderatorsList?: string[]; moderatorThemeMap?: Record<string, string[]>; resetModerators?: boolean; chairsList?: string[]; chairThemeMap?: Record<string, string[]>; chairRoomMap?: Record<string, string[]>; resetChairs?: boolean; themeRoomMap?: Record<string, string> }
): ConferenceSchedule {
  const accepted = conferenceArticles.filter((a) => a.status === "accepted");
  const slots: ScheduleSlot[] = [];
  const BREAK = config.breakMinutes ?? 10;
  const parseMins = (t: string, fallback: number) => { const [h, m] = t.split(":").map(Number); return isNaN(h) ? fallback : h * 60 + (m || 0); };
  const LUNCH_START = parseMins(config.lunchStart || "", 12 * 60);
  const LUNCH_END = parseMins(config.lunchEnd || "", 13 * 60 + 30);

  // Per-day start/end helpers
  const getDayStart = (d: number) => {
    const dh = config.dayHours?.[d];
    return dh ? dh.startHour * 60 : config.startHour * 60;
  };
  const getDayEnd = (d: number) => {
    const dh = config.dayHours?.[d];
    return dh ? dh.endHour * 60 : config.endHour * 60;
  };

  // Group by category, sort categories by size (largest first for better packing)
  const byCategory = new Map<string, Article[]>();
  accepted.forEach((a) => {
    const list = byCategory.get(a.category) || [];
    list.push(a);
    byCategory.set(a.category, list);
  });
  const sortedCategories = Array.from(byCategory.entries())
    .sort((a, b) => b[1].length - a[1].length);

  // Build a per-room/per-day blocked intervals tracker
  const idx = (day: number, room: number) => day * config.rooms.length + room;

  // Collect blocked intervals from existing special slots
  const blockedIntervals: { start: number; end: number }[][] = [];
  for (let d = 0; d < config.days; d++) {
    for (let r = 0; r < config.rooms.length; r++) {
      blockedIntervals.push([]);
    }
  }

  const existingSpecials = schedule?.specialSlots || [];
  for (const sp of existingSpecials) {
    const spStart = parseMins(sp.startTime, 0);
    const spEnd = parseMins(sp.endTime, 0);
    if (sp.room === "all") {
      // Block all rooms for this day
      for (let r = 0; r < config.rooms.length; r++) {
        if (sp.day < config.days) {
          blockedIntervals[idx(sp.day, r)].push({ start: spStart, end: spEnd });
        }
      }
    } else {
      const rIdx = config.rooms.indexOf(sp.room);
      if (rIdx >= 0 && sp.day < config.days) {
        blockedIntervals[idx(sp.day, rIdx)].push({ start: spStart, end: spEnd });
      }
    }
  }

  // Sort blocked intervals by start time
  for (const intervals of blockedIntervals) {
    intervals.sort((a, b) => a.start - b.start);
  }

  // Per-room/per-day current time pointer
  const roomTimelines: number[] = [];
  for (let d = 0; d < config.days; d++) {
    for (let r = 0; r < config.rooms.length; r++) {
      roomTimelines.push(getDayStart(d));
    }
  }

  // Check if a time range conflicts with blocked intervals
  function conflictsWithBlocked(key: number, start: number, end: number): boolean {
    return blockedIntervals[key].some((b) => start < b.end && end > b.start);
  }

  // Find the next valid start time that doesn't overlap blocked intervals
  function nextFreeStart(key: number, start: number, duration: number): number {
    let candidate = start;
    for (const b of blockedIntervals[key]) {
      if (candidate < b.end && candidate + duration > b.start) {
        candidate = b.end; // skip past this blocked interval
      }
    }
    return candidate;
  }

  // Try to place an article in a specific (day, room). Returns true if placed.
  function tryPlaceAt(article: Article, day: number, r: number): string | null {
    const dayEndMin = getDayEnd(day);
    const key = idx(day, r);
    let start = roomTimelines[key];
    if (start < LUNCH_END && start + article.duration > LUNCH_START && dayEndMin > LUNCH_END) {
      start = Math.max(start, LUNCH_END);
    }
    start = nextFreeStart(key, start, article.duration);
    if (start < LUNCH_END && start + article.duration > LUNCH_START && dayEndMin > LUNCH_END) {
      start = Math.max(start, LUNCH_END);
      start = nextFreeStart(key, start, article.duration);
    }
    const end = start + article.duration;
    if (end > dayEndMin) return null;

    slots.push({
      articleId: article.id,
      room: config.rooms[r],
      startTime: fmt(start),
      endTime: fmt(end),
      day,
    });
    roomTimelines[key] = end + BREAK;
    return config.rooms[r];
  }

  // Try to place an article in the best available slot.
  // Returns the room name used, or null if no placement possible.
  function placeArticle(article: Article, preferDay?: number, preferRoomIdx?: number): string | null {
    const allDays = Array.from({ length: config.days }, (_, i) => i);
    const dayOrder = preferDay !== undefined
      ? [preferDay, ...allDays.filter(d => d !== preferDay)]
      : allDays;

    // PRIORITY 1: try the preferred room on ALL days before considering any other room.
    // This prevents articles from being moved to other rooms when their preferred room
    // still has capacity on another day.
    if (preferRoomIdx !== undefined && preferRoomIdx >= 0) {
      for (const day of dayOrder) {
        const placed = tryPlaceAt(article, day, preferRoomIdx);
        if (placed) return placed;
      }
    }

    // PRIORITY 2: overflow to other rooms (preferred room is full everywhere)
    for (const day of dayOrder) {
      const others = Array.from({ length: config.rooms.length }, (_, r) => r)
        .filter((r) => r !== preferRoomIdx)
        .sort((a, b) => roomTimelines[idx(day, a)] - roomTimelines[idx(day, b)]);
      for (const r of others) {
        const placed = tryPlaceAt(article, day, r);
        if (placed) return placed;
      }
    }
    return null;
  }

  // Track theme overflow stats for user feedback
  const overflowByTheme: Record<string, { preferredRoom: string; overflowRooms: Set<string>; overflowCount: number }> = {};

  // Place articles category by category
  const themeRoomMap = config.themeRoomMap || {};
  for (const [category, articles] of sortedCategories) {
    articles.sort((a, b) => b.duration - a.duration);

    const preferredRoomName = themeRoomMap[category];
    const preferredRoomIdx = preferredRoomName ? config.rooms.indexOf(preferredRoomName) : -1;
    const preferRoomIdx = preferredRoomIdx >= 0 ? preferredRoomIdx : undefined;

    // Choose best day: when a preferred room exists, prioritize the day with most
    // remaining capacity in that room (so we maximize what fits in the dedicated room
    // before having to overflow to other rooms).
    let bestDay = 0;
    let bestCapacity = -1;
    for (let d = 0; d < config.days; d++) {
      let cap = 0;
      if (preferRoomIdx !== undefined) {
        cap = getDayEnd(d) - roomTimelines[idx(d, preferRoomIdx)];
      } else {
        for (let r = 0; r < config.rooms.length; r++) {
          cap += getDayEnd(d) - roomTimelines[idx(d, r)];
        }
      }
      if (cap > bestCapacity) { bestCapacity = cap; bestDay = d; }
    }

    for (const article of articles) {
      const placedRoom = placeArticle(article, bestDay, preferRoomIdx);
      // Track overflow: article placed but not in the preferred room
      if (placedRoom && preferredRoomName && placedRoom !== preferredRoomName) {
        if (!overflowByTheme[category]) {
          overflowByTheme[category] = {
            preferredRoom: preferredRoomName,
            overflowRooms: new Set(),
            overflowCount: 0,
          };
        }
        overflowByTheme[category].overflowRooms.add(placedRoom);
        overflowByTheme[category].overflowCount++;
      }
    }
  }

  // Expose overflow info on the schedule for the UI to surface
  const overflowReport: ThemeOverflow[] = Object.entries(overflowByTheme).map(([theme, info]) => ({
    theme,
    preferredRoom: info.preferredRoom,
    overflowRooms: Array.from(info.overflowRooms),
    overflowCount: info.overflowCount,
  }));
  lastOverflowReport = overflowReport;

  // Collect all article mutations in a map, then apply once at the end
  const mutations: Record<string, Partial<Article>> = {};
  const articleById = new Map(conferenceArticles.map((a) => [a.id, { ...a }]));

  // Reset moderators if requested
  if (config.resetModerators) {
    for (const slot of slots) {
      const art = articleById.get(slot.articleId);
      if (art) {
        art.moderator = "";
        mutations[art.id] = { ...mutations[art.id], moderator: "" };
      }
    }
  }

  // Reset session chairs if requested
  if (config.resetChairs) {
    for (const slot of slots) {
      const art = articleById.get(slot.articleId);
      if (art) {
        art.sessionChair = "";
        mutations[art.id] = { ...mutations[art.id], sessionChair: "" };
      }
    }
  }

  // Group slots by (day, room) and sort chronologically so a single
  // moderator/chair handles consecutive presentations of the same theme
  // before being replaced (avoids "pell-mell" assignments).
  const groupKey = (s: typeof slots[number]) => `${s.day}::${s.room}`;
  const groups = new Map<string, typeof slots>();
  for (const slot of slots) {
    const k = groupKey(slot);
    if (!groups.has(k)) groups.set(k, [] as any);
    (groups.get(k) as any).push(slot);
  }
  for (const arr of groups.values()) {
    (arr as any).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
  }

  // Auto-assign moderators (continuous per session theme within a room/day)
  const modList = config.moderatorsList ?? moderators;
  const themeMapping = config.moderatorThemeMap ?? {};
  const hasThemeMapping = Object.keys(themeMapping).some((k) => (themeMapping[k] || []).length > 0);

  if (hasThemeMapping || modList.length > 0) {
    const themeModIdx: Record<string, number> = {};
    let globalModIdx = 0;

    for (const arr of groups.values()) {
      let currentMod = "";
      let currentCat: string | null = null;
      for (const slot of arr) {
        const art = articleById.get(slot.articleId);
        if (!art) continue;
        if (art.moderator) {
          // Respect existing assignment, but use it as the running moderator
          currentMod = art.moderator;
          currentCat = art.category;
          continue;
        }
        // Rotate only when the theme changes within the room/day
        if (currentCat !== art.category || !currentMod) {
          const themeMods = themeMapping[art.category];
          if (themeMods && themeMods.length > 0) {
            const i = themeModIdx[art.category] ?? 0;
            currentMod = themeMods[i % themeMods.length];
            themeModIdx[art.category] = i + 1;
          } else if (modList.length > 0) {
            currentMod = modList[globalModIdx % modList.length];
            globalModIdx++;
          } else {
            currentMod = "";
          }
          currentCat = art.category;
        }
        if (currentMod) {
          art.moderator = currentMod;
          mutations[art.id] = { ...mutations[art.id], moderator: currentMod };
        }
      }
    }
  }

  // Auto-assign session chairs (same continuity logic, with theme + room mapping)
  const chairList = config.chairsList ?? sessionChairs;
  const chairMapping = config.chairThemeMap ?? {};
  const chairRoomMap = config.chairRoomMap ?? {};
  const hasChairMapping = Object.keys(chairMapping).some((k) => (chairMapping[k] || []).length > 0);
  const hasChairRoomMap = Object.keys(chairRoomMap).some((k) => (chairRoomMap[k] || []).length > 0);

  if (hasChairMapping || hasChairRoomMap || chairList.length > 0) {
    const themeChairIdx: Record<string, number> = {};
    const roomChairIdx: Record<string, number> = {};
    let globalChairIdx = 0;

    for (const arr of groups.values()) {
      let currentChair = "";
      let currentCat: string | null = null;
      for (const slot of arr) {
        const art = articleById.get(slot.articleId);
        if (!art) continue;
        if (art.sessionChair) {
          currentChair = art.sessionChair;
          currentCat = art.category;
          continue;
        }
        if (currentCat !== art.category || !currentChair) {
          const themeChairs = chairMapping[art.category];
          const roomChairs = chairRoomMap[slot.room];
          if (themeChairs && themeChairs.length > 0) {
            const i = themeChairIdx[art.category] ?? 0;
            currentChair = themeChairs[i % themeChairs.length];
            themeChairIdx[art.category] = i + 1;
          } else if (roomChairs && roomChairs.length > 0) {
            const i = roomChairIdx[slot.room] ?? 0;
            currentChair = roomChairs[i % roomChairs.length];
            roomChairIdx[slot.room] = i + 1;
          } else if (chairList.length > 0) {
            currentChair = chairList[globalChairIdx % chairList.length];
            globalChairIdx++;
          } else {
            currentChair = "";
          }
          currentCat = art.category;
        }
        if (currentChair) {
          art.sessionChair = currentChair;
          mutations[art.id] = { ...mutations[art.id], sessionChair: currentChair };
        }
      }
    }
  }

  // Apply all mutations in a single pass
  if (Object.keys(mutations).length > 0) {
    articles = articles.map((a) => mutations[a.id] ? { ...a, ...mutations[a.id] } : a);
  }

  slots.sort((a, b) => a.day - b.day || a.room.localeCompare(b.room) || a.startTime.localeCompare(b.startTime));

  const newSchedule: ConferenceSchedule = {
    id: Date.now().toString(),
    ...config,
    breakMinutes: BREAK,
    slots,
    specialSlots: schedule?.specialSlots || [],
    createdAt: new Date(),
  };

  schedule = newSchedule;
  saveToStorage();
  return newSchedule;
}

// ─────────────────────────────────────────────────────────────
// Cloud sync helpers — called by Conference.tsx
// ─────────────────────────────────────────────────────────────

/** Export current in-memory state as a plain object (for cloud save) */
export function exportBlob(): Record<string, unknown> {
  return {
    articles,
    schedule,
    categories,
    moderators,
    sessionChairs,
    organizers,
    presentationTypes,
    savedAt: Date.now(),
  };
}

/** Load state from a cloud blob into memory (called on project open) */
export function loadFromBlob(blob: Record<string, unknown>): void {
  if (Array.isArray(blob.articles)) articles = blob.articles as Article[];
  if (blob.schedule !== undefined) schedule = blob.schedule as ConferenceSchedule | null;
  if (Array.isArray(blob.categories)) categories = blob.categories as string[];
  if (Array.isArray(blob.moderators)) moderators = blob.moderators as string[];
  if (Array.isArray(blob.sessionChairs)) sessionChairs = blob.sessionChairs as string[];
  if (Array.isArray(blob.organizers)) organizers = blob.organizers as Organizer[];
  if (Array.isArray(blob.presentationTypes) && (blob.presentationTypes as string[]).length > 0)
    presentationTypes = blob.presentationTypes as string[];
  saveToStorage(); // also keep localStorage in sync
}
