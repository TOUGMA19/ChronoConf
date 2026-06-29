import jsPDF from "jspdf";
import QRCode from "qrcode";
import { ConferenceSchedule, Article } from "./conference";

// ===========================================================================
// PUBLIC TYPES
// ===========================================================================

export type BadgeRole = "speaker" | "moderator" | "chair" | "participant" | "organizer" | "other";

/**
 * 50 visual themes (color palettes + base style family).
 * Each theme is a string id; lookup in THEMES_DATA.
 */
export type BadgeTheme = string;

/**
 * 50 frame shapes. Each id is a `family-variant` (e.g. "rounded-md", "wave-deep").
 */
export type BadgeShape = string;

/**
 * 13 decorative content patterns. "none" = aucune décoration.
 */
export type BadgeDecoration =
  | "none"
  | "dots"
  | "circles"
  | "stripes"
  | "grid"
  | "confetti"
  | "waves"
  | "triangles"
  | "diagonals"
  | "blobs"
  | "rings"
  | "lines"
  | "corners";

export interface BadgeEntry {
  name: string;
  role: BadgeRole;
  affiliation?: string;
}

export interface BadgeExportOptions {
  customLogoDataUrl?: string;
  partnerLogos?: string[];
  eventDate?: string;
  eventLocation?: string;
  subtitle?: string;
  theme?: BadgeTheme;
  shape?: BadgeShape;
  decoration?: BadgeDecoration; // default "none"
  showQrCode?: boolean;
  qrBaseUrl?: string;
  qrMode?: "url" | "vcard";
  accentColorOverride?: [number, number, number];
  /** Length of each cut mark line in mm (default 3.5). 0 disables cut marks. */
  cutMarkLength?: number;
  /** Gap between badge edge and cut mark start in mm (default 1.2). */
  cutMarkOffset?: number;
  /** Horizontal print calibration offset in mm (default 0). Positive shifts right. */
  printOffsetX?: number;
  /** Vertical print calibration offset in mm (default 0). Positive shifts down. */
  printOffsetY?: number;
}

export const ROLE_LABEL: Record<BadgeRole, string> = {
  speaker: "Intervenant",
  moderator: "Modérateur",
  chair: "Président de séance",
  participant: "Participant",
  organizer: "Organisateur",
  other: "Autre",
};

// ===========================================================================
// THEMES — 50 palettes
// ===========================================================================

type RGB = [number, number, number];

/** Base style family controls header bg, pill style, separator. */
type ThemeFamily = "light" | "dark" | "bold" | "pastel" | "mono";

interface ThemeData {
  label: string;
  family: ThemeFamily;
  // Colors per role
  speaker: RGB;
  moderator: RGB;
  chair: RGB;
  participant: RGB;
}

/**
 * 50 themes. Each defines per-role primary color + a family controlling neutral surfaces.
 * Accent (light bg) is derived from primary (tint 80%).
 */
const THEMES_DATA: Record<string, ThemeData> = {
  // -------- LIGHT family (white card, light header) --------
  elegant:        { label: "Élégant",          family: "light", speaker: [29, 78, 216],   moderator: [21, 128, 61],  chair: [126, 34, 206], participant: [71, 85, 105] },
  modern:         { label: "Moderne",          family: "light", speaker: [14, 116, 144],  moderator: [13, 148, 136], chair: [79, 70, 229],  participant: [55, 65, 81] },
  corporate:      { label: "Corporate",        family: "light", speaker: [30, 58, 138],   moderator: [15, 76, 117],  chair: [120, 53, 15],  participant: [51, 65, 85] },
  oceanic:        { label: "Océanique",        family: "light", speaker: [12, 74, 110],   moderator: [14, 116, 144], chair: [3, 105, 161],  participant: [56, 90, 110] },
  forest:         { label: "Forêt",            family: "light", speaker: [22, 101, 52],   moderator: [4, 120, 87],   chair: [101, 163, 13], participant: [63, 98, 18] },
  sunset:         { label: "Coucher de soleil",family: "light", speaker: [194, 65, 12],   moderator: [217, 119, 6],  chair: [190, 24, 93],  participant: [136, 19, 55] },
  candy:          { label: "Bonbon",           family: "light", speaker: [219, 39, 119],  moderator: [147, 51, 234], chair: [37, 99, 235],  participant: [234, 88, 12] },
  emerald:        { label: "Émeraude",         family: "light", speaker: [5, 150, 105],   moderator: [20, 184, 166], chair: [16, 185, 129], participant: [22, 163, 74] },
  sapphire:       { label: "Saphir",           family: "light", speaker: [29, 78, 216],   moderator: [37, 99, 235],  chair: [67, 56, 202],  participant: [55, 48, 163] },
  ruby:           { label: "Rubis",            family: "light", speaker: [190, 18, 60],   moderator: [220, 38, 38],  chair: [185, 28, 28],  participant: [127, 29, 29] },
  amber:          { label: "Ambre",            family: "light", speaker: [217, 119, 6],   moderator: [202, 138, 4],  chair: [161, 98, 7],   participant: [120, 53, 15] },
  azure:          { label: "Azur",             family: "light", speaker: [3, 105, 161],   moderator: [2, 132, 199],  chair: [14, 165, 233], participant: [56, 189, 248] },
  teal:           { label: "Teal",             family: "light", speaker: [13, 148, 136],  moderator: [20, 184, 166], chair: [45, 212, 191], participant: [94, 234, 212] },
  rose:           { label: "Rose",             family: "light", speaker: [225, 29, 72],   moderator: [244, 63, 94],  chair: [251, 113, 133], participant: [253, 164, 175] },
  violet:         { label: "Violet",           family: "light", speaker: [109, 40, 217],  moderator: [124, 58, 237], chair: [139, 92, 246], participant: [167, 139, 250] },
  lime:           { label: "Citron vert",      family: "light", speaker: [101, 163, 13],  moderator: [132, 204, 22], chair: [163, 230, 53], participant: [190, 242, 100] },

  // -------- BOLD family (saturated, white pill on color) --------
  vibrant:        { label: "Vibrant",          family: "bold",  speaker: [220, 38, 38],   moderator: [5, 150, 105],  chair: [147, 51, 234], participant: [217, 119, 6] },
  electric:       { label: "Électrique",       family: "bold",  speaker: [37, 99, 235],   moderator: [16, 185, 129], chair: [236, 72, 153], participant: [251, 146, 60] },
  tropical:       { label: "Tropical",         family: "bold",  speaker: [234, 88, 12],   moderator: [22, 163, 74],  chair: [219, 39, 119], participant: [14, 165, 233] },
  neon:           { label: "Néon",             family: "bold",  speaker: [236, 72, 153],  moderator: [34, 211, 238], chair: [163, 230, 53], participant: [251, 191, 36] },
  carnival:       { label: "Carnaval",         family: "bold",  speaker: [239, 68, 68],   moderator: [251, 146, 60], chair: [250, 204, 21], participant: [34, 197, 94] },
  pop:            { label: "Pop art",          family: "bold",  speaker: [220, 38, 38],   moderator: [37, 99, 235],  chair: [250, 204, 21], participant: [16, 185, 129] },
  fiesta:         { label: "Fiesta",           family: "bold",  speaker: [217, 70, 239],  moderator: [236, 72, 153], chair: [249, 115, 22], participant: [234, 179, 8] },
  punch:          { label: "Punch",            family: "bold",  speaker: [219, 39, 119],  moderator: [234, 88, 12],  chair: [220, 38, 38],  participant: [202, 138, 4] },
  lagoon:         { label: "Lagon",            family: "bold",  speaker: [6, 182, 212],   moderator: [13, 148, 136], chair: [37, 99, 235],  participant: [99, 102, 241] },
  sunrise:        { label: "Lever du jour",    family: "bold",  speaker: [251, 113, 133], moderator: [251, 146, 60], chair: [250, 204, 21], participant: [248, 113, 113] },

  // -------- PASTEL family (soft, low saturation) --------
  colorful:       { label: "Coloré",           family: "pastel",speaker: [234, 88, 12],   moderator: [22, 163, 74],  chair: [219, 39, 119], participant: [37, 99, 235] },
  pastel:         { label: "Pastel",           family: "pastel",speaker: [165, 180, 252], moderator: [134, 239, 172], chair: [249, 168, 212], participant: [253, 186, 116] },
  blossom:        { label: "Floraison",        family: "pastel",speaker: [244, 114, 182], moderator: [196, 181, 253], chair: [147, 197, 253], participant: [253, 224, 71] },
  candyfloss:     { label: "Barbe à papa",     family: "pastel",speaker: [251, 207, 232], moderator: [196, 181, 253], chair: [186, 230, 253], participant: [254, 215, 170] },
  mint:           { label: "Menthe",           family: "pastel",speaker: [110, 231, 183], moderator: [134, 239, 172], chair: [167, 243, 208], participant: [187, 247, 208] },
  lavender:       { label: "Lavande",          family: "pastel",speaker: [196, 181, 253], moderator: [216, 180, 254], chair: [221, 214, 254], participant: [233, 213, 255] },
  peach:          { label: "Pêche",            family: "pastel",speaker: [253, 186, 116], moderator: [254, 215, 170], chair: [251, 207, 232], participant: [252, 165, 165] },
  sky:            { label: "Ciel",             family: "pastel",speaker: [125, 211, 252], moderator: [147, 197, 253], chair: [165, 180, 252], participant: [196, 181, 253] },
  sage:           { label: "Sauge",            family: "pastel",speaker: [134, 239, 172], moderator: [167, 243, 208], chair: [187, 247, 208], participant: [220, 252, 231] },

  // -------- DARK family (dark card, light text) --------
  midnight:       { label: "Minuit",           family: "dark",  speaker: [96, 165, 250],  moderator: [110, 231, 183], chair: [196, 181, 253], participant: [251, 191, 36] },
  galaxy:         { label: "Galaxie",          family: "dark",  speaker: [167, 139, 250], moderator: [129, 140, 248], chair: [236, 72, 153], participant: [99, 102, 241] },
  nocturne:       { label: "Nocturne",         family: "dark",  speaker: [56, 189, 248],  moderator: [110, 231, 183], chair: [253, 186, 116], participant: [251, 113, 133] },
  obsidian:       { label: "Obsidienne",       family: "dark",  speaker: [148, 163, 184], moderator: [203, 213, 225], chair: [226, 232, 240], participant: [241, 245, 249] },
  cosmos:         { label: "Cosmos",           family: "dark",  speaker: [192, 132, 252], moderator: [165, 180, 252], chair: [125, 211, 252], participant: [110, 231, 183] },
  abyss:          { label: "Abysse",           family: "dark",  speaker: [56, 189, 248],  moderator: [34, 211, 238], chair: [45, 212, 191], participant: [110, 231, 183] },
  noir:           { label: "Noir & or",        family: "dark",  speaker: [250, 204, 21],  moderator: [253, 186, 116], chair: [248, 113, 113], participant: [203, 213, 225] },
  charcoal:       { label: "Charbon",          family: "dark",  speaker: [248, 113, 113], moderator: [134, 239, 172], chair: [147, 197, 253], participant: [253, 224, 71] },

  // -------- MONO family (single hue, no role color variation, just role label) --------
  minimal:        { label: "Minimaliste",      family: "mono",  speaker: [23, 23, 23],    moderator: [82, 82, 82],   chair: [38, 38, 38],   participant: [115, 115, 115] },
  monochrome:     { label: "Monochrome",       family: "mono",  speaker: [10, 10, 10],    moderator: [38, 38, 38],   chair: [82, 82, 82],   participant: [163, 163, 163] },
  greyscale:      { label: "Niveaux de gris",  family: "mono",  speaker: [55, 65, 81],    moderator: [75, 85, 99],   chair: [107, 114, 128], participant: [156, 163, 175] },
  ink:            { label: "Encre",            family: "mono",  speaker: [15, 23, 42],    moderator: [30, 41, 59],   chair: [51, 65, 85],   participant: [71, 85, 105] },
  graphite:       { label: "Graphite",         family: "mono",  speaker: [30, 41, 59],    moderator: [51, 65, 85],   chair: [71, 85, 105],  participant: [100, 116, 139] },
  slate:          { label: "Ardoise",          family: "mono",  speaker: [51, 65, 85],    moderator: [71, 85, 105],  chair: [100, 116, 139], participant: [148, 163, 184] },
  paper:          { label: "Papier",           family: "mono",  speaker: [68, 64, 60],    moderator: [87, 83, 78],   chair: [120, 113, 108], participant: [168, 162, 158] },
};

// Public list (preserves insertion order)
export const THEME_KEYS: BadgeTheme[] = Object.keys(THEMES_DATA);

export const THEME_LABEL: Record<string, string> = Object.fromEntries(
  THEME_KEYS.map((k) => [k, THEMES_DATA[k].label]),
);

interface ResolvedTheme {
  primary: RGB;     // role-specific
  accent: RGB;      // tinted from primary
  cardBg: RGB;
  headerBg: RGB;
  textPrimary: RGB;
  textMuted: RGB;
  separator: RGB;
  family: ThemeFamily;
}

function tint(rgb: RGB, ratio: number): RGB {
  const [r, g, b] = rgb;
  return [
    Math.round(r + (255 - r) * ratio),
    Math.round(g + (255 - g) * ratio),
    Math.round(b + (255 - b) * ratio),
  ];
}
function shade(rgb: RGB, ratio: number): RGB {
  const [r, g, b] = rgb;
  return [
    Math.max(0, Math.round(r * (1 - ratio))),
    Math.max(0, Math.round(g * (1 - ratio))),
    Math.max(0, Math.round(b * (1 - ratio))),
  ];
}

function resolveTheme(themeId: BadgeTheme, role: BadgeRole, override?: RGB): ResolvedTheme {
  const data = THEMES_DATA[themeId] || THEMES_DATA.elegant;
  // Fallback mapping for roles not explicitly defined per theme.
  const roleColorFallback: Record<BadgeRole, keyof ThemeData> = {
    speaker: "speaker", moderator: "moderator", chair: "chair", participant: "participant",
    organizer: "chair", other: "participant",
  };
  const key = roleColorFallback[role] || "participant";
  const primary: RGB = override || (data as any)[key] || data.participant;
  const accent = tint(primary, 0.85);
  switch (data.family) {
    case "dark":
      return {
        primary, accent,
        cardBg: [17, 24, 39],
        headerBg: [31, 41, 55],
        textPrimary: [241, 245, 249],
        textMuted: [148, 163, 184],
        separator: [51, 65, 85],
        family: "dark",
      };
    case "bold":
      return {
        primary, accent,
        cardBg: [255, 255, 255],
        headerBg: tint(primary, 0.92),
        textPrimary: [17, 24, 39],
        textMuted: [107, 114, 128],
        separator: tint(primary, 0.7),
        family: "bold",
      };
    case "pastel":
      return {
        primary, accent,
        cardBg: [255, 255, 255],
        headerBg: tint(primary, 0.9),
        textPrimary: [30, 41, 59],
        textMuted: [100, 116, 139],
        separator: tint(primary, 0.6),
        family: "pastel",
      };
    case "mono":
      return {
        primary, accent: [245, 245, 245],
        cardBg: [255, 255, 255],
        headerBg: [255, 255, 255],
        textPrimary: [10, 10, 10],
        textMuted: [115, 115, 115],
        separator: [229, 229, 229],
        family: "mono",
      };
    case "light":
    default:
      return {
        primary, accent,
        cardBg: [255, 255, 255],
        headerBg: [248, 250, 252],
        textPrimary: [15, 23, 42],
        textMuted: [100, 116, 139],
        separator: [226, 232, 240],
        family: "light",
      };
  }
}

/** Sample primary used by the picker (uses speaker role). */
export function getThemeSwatch(themeId: BadgeTheme): { primary: string; header: string; bg: string } {
  const r = resolveTheme(themeId, "speaker");
  const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
  return { primary: rgb(r.primary), header: rgb(r.headerBg), bg: rgb(r.cardBg) };
}

// ===========================================================================
// SHAPES — 50 frame variants
// ===========================================================================

type ShapeFamily =
  | "rounded" | "classic" | "ribbon" | "cut-corner" | "wave"
  | "arch" | "notched" | "double-frame" | "tab-top" | "scalloped";

interface ShapeData {
  label: string;
  family: ShapeFamily;
  variant: number; // 1..5 intensity
}

const SHAPE_FAMILY_LABEL: Record<ShapeFamily, string> = {
  rounded: "Arrondi",
  classic: "Classique",
  ribbon: "Ruban",
  "cut-corner": "Coin coupé",
  wave: "Vague",
  arch: "Arche",
  notched: "Encoche",
  "double-frame": "Double cadre",
  "tab-top": "Onglet",
  scalloped: "Festonné",
};

/** Build the 50 shapes: 10 families × 5 variants. */
const SHAPES_DATA: Record<string, ShapeData> = (() => {
  const map: Record<string, ShapeData> = {};
  const families: ShapeFamily[] = [
    "rounded", "classic", "ribbon", "cut-corner", "wave",
    "arch", "notched", "double-frame", "tab-top", "scalloped",
  ];
  const variantSuffix = ["xs", "sm", "md", "lg", "xl"];
  for (const f of families) {
    for (let i = 0; i < 5; i++) {
      const id = `${f}-${variantSuffix[i]}`;
      map[id] = {
        label: `${SHAPE_FAMILY_LABEL[f]} ${i + 1}`,
        family: f,
        variant: i + 1,
      };
    }
  }
  return map;
})();

export const SHAPE_KEYS: BadgeShape[] = Object.keys(SHAPES_DATA);

export const SHAPE_LABEL: Record<string, string> = Object.fromEntries(
  SHAPE_KEYS.map((k) => [k, SHAPES_DATA[k].label]),
);

/** Get family of a shape id (for the preview component). */
export function getShapeFamily(shapeId: BadgeShape): { family: ShapeFamily; variant: number } {
  const d = SHAPES_DATA[shapeId] || SHAPES_DATA["rounded-md"];
  return { family: d.family, variant: d.variant };
}

// ===========================================================================
// DECORATIONS
// ===========================================================================

export const DECORATION_LABEL: Record<BadgeDecoration, string> = {
  none: "Aucune",
  dots: "Points",
  circles: "Cercles concentriques",
  stripes: "Bandes diagonales",
  grid: "Grille géométrique",
  confetti: "Confettis",
  waves: "Vagues",
  triangles: "Triangles",
  diagonals: "Lignes diagonales",
  blobs: "Formes organiques",
  rings: "Anneaux",
  lines: "Lignes verticales",
  corners: "Coins décorés",
};

export const DECORATION_KEYS: BadgeDecoration[] = Object.keys(DECORATION_LABEL) as BadgeDecoration[];

// ===========================================================================
// HELPERS — splits, slug, qr
// ===========================================================================

function splitAuthors(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,;&\n]| et | and /i).map((s) => s.trim()).filter((s) => s.length > 1);
}

export function buildBadgesFromSchedule(schedule: ConferenceSchedule, articles: Article[]): BadgeEntry[] {
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const byName = new Map<string, BadgeEntry>();

  const upsert = (name: string, role: BadgeRole, affiliation?: string) => {
    const key = name.trim();
    if (!key) return;
    const existing = byName.get(key);
    if (!existing) {
      byName.set(key, { name: key, role, affiliation });
      return;
    }
    const priority: Record<BadgeRole, number> = { chair: 3, moderator: 2, speaker: 1, organizer: 1, other: 0, participant: 0 };
    if (priority[role] > priority[existing.role]) byName.set(key, { ...existing, role });
    if (!existing.affiliation && affiliation) byName.set(key, { ...byName.get(key)!, affiliation });
  };

  for (const s of schedule.slots) {
    const a = articleMap.get(s.articleId);
    if (!a) continue;
    splitAuthors(a.authors).forEach((author) => upsert(author, "speaker", a.category));
    if (a.moderator) upsert(a.moderator, "moderator", a.category);
    if (a.sessionChair) upsert(a.sessionChair, "chair", a.category);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function detectFormat(dataUrl: string): "PNG" | "JPEG" {
  if (/^data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
  return "PNG";
}

function slugify(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function buildQrPayload(badge: BadgeEntry, conferenceName: string, opts: BadgeExportOptions): string {
  if (opts.qrMode === "vcard") {
    return [
      "BEGIN:VCARD", "VERSION:3.0",
      `FN:${badge.name}`,
      badge.affiliation ? `ORG:${badge.affiliation}` : "",
      `TITLE:${ROLE_LABEL[badge.role]}`,
      `NOTE:${conferenceName}`,
      "END:VCARD",
    ].filter(Boolean).join("\n");
  }
  const base = (opts.qrBaseUrl || "").trim();
  if (base) return base.replace(/\/+$/, "") + "/" + slugify(badge.name);
  return `${conferenceName} — ${badge.name} (${ROLE_LABEL[badge.role]})`;
}

async function renderQrDataUrl(payload: string, primary: RGB): Promise<string> {
  const hex = "#" + primary.map((c) => c.toString(16).padStart(2, "0")).join("");
  return QRCode.toDataURL(payload, { margin: 0, errorCorrectionLevel: "M", width: 256, color: { dark: hex, light: "#ffffff" } });
}

// ===========================================================================
// FRAME DRAWING (50 shapes via 10 families × 5 variants)
// ===========================================================================

/** Draw the outer frame of the badge. Returns the Y offset where header content can start. */
function drawShapeFrame(
  doc: jsPDF, shapeId: BadgeShape,
  x: number, y: number, w: number, h: number,
  primary: RGB, cardBg: RGB,
): number {
  const data = SHAPES_DATA[shapeId] || SHAPES_DATA["rounded-md"];
  const v = data.variant; // 1..5
  const [pr, pg, pb] = primary;
  const [bgR, bgG, bgB] = cardBg;

  doc.setFillColor(bgR, bgG, bgB);
  doc.setDrawColor(210, 215, 222);
  doc.setLineWidth(0.3);

  switch (data.family) {
    case "rounded": {
      const radius = 2 + v * 2;             // 4..12
      const accentH = 6 + v;                // 7..11
      doc.roundedRect(x, y, w, h, radius, radius, "FD");
      doc.setFillColor(pr, pg, pb);
      doc.roundedRect(x, y, w, accentH, radius, radius, "F");
      doc.rect(x, y + radius, w, accentH - radius, "F");
      return accentH;
    }
    case "classic": {
      const accentH = 5 + v;                // 6..10
      const stripeH = 0.4 + v * 0.2;        // 0.6..1.4
      doc.rect(x, y, w, h, "FD");
      doc.setFillColor(pr, pg, pb);
      doc.rect(x, y, w, accentH, "F");
      doc.setFillColor(255, 255, 255);
      doc.rect(x, y + accentH, w, 0.5, "F");
      doc.setFillColor(pr, pg, pb);
      doc.rect(x, y + accentH + 0.5, w, stripeH, "F");
      return accentH + 1 + stripeH;
    }
    case "ribbon": {
      const accentH = 5 + v;
      const ribbonW = 8 + v * 2;            // 10..18
      const ribbonH = 12 + v * 3;           // 15..27
      doc.roundedRect(x, y, w, h, 3, 3, "FD");
      doc.setFillColor(pr, pg, pb);
      doc.roundedRect(x, y, w, accentH, 3, 3, "F");
      doc.rect(x, y + 3, w, accentH - 3, "F");
      // Hanging ribbon top-right
      const dr = shade(primary, 0.18);
      doc.setFillColor(dr[0], dr[1], dr[2]);
      doc.rect(x + w - ribbonW - 4, y + accentH, ribbonW, ribbonH - 4, "F");
      doc.setFillColor(bgR, bgG, bgB);
      doc.triangle(
        x + w - ribbonW - 4, y + accentH + ribbonH - 2,
        x + w - ribbonW / 2 - 4, y + accentH + ribbonH - 6,
        x + w - 4, y + accentH + ribbonH - 2,
        "F",
      );
      return accentH;
    }
    case "cut-corner": {
      const cut = 6 + v * 3;                // 9..21
      const accentH = 6 + v;
      doc.setFillColor(bgR, bgG, bgB);
      doc.rect(x, y, w, h, "F");
      doc.setFillColor(255, 255, 255);
      doc.triangle(x + w - cut, y - 0.3, x + w + 0.3, y - 0.3, x + w + 0.3, y + cut, "F");
      doc.triangle(x - 0.3, y + h - cut, x - 0.3, y + h + 0.3, x + cut, y + h + 0.3, "F");
      doc.setDrawColor(210, 215, 222);
      doc.setLineWidth(0.4);
      doc.line(x, y, x + w - cut, y);
      doc.line(x + w - cut, y, x + w, y + cut);
      doc.line(x + w, y + cut, x + w, y + h);
      doc.line(x + w, y + h, x + cut, y + h);
      doc.line(x + cut, y + h, x, y + h - cut);
      doc.line(x, y + h - cut, x, y);
      doc.setFillColor(pr, pg, pb);
      doc.rect(x, y, w - cut, accentH, "F");
      doc.triangle(x + w - cut, y, x + w, y + cut, x + w - cut, y + cut, "F");
      doc.triangle(x, y + h - cut, x + cut, y + h, x, y + h, "F");
      return accentH;
    }
    case "wave": {
      const baseH = 7 + v * 1.5;            // 8.5..14.5
      const radius = 1.5 + v * 0.6;         // 2.1..4.5
      doc.roundedRect(x, y, w, h, 4, 4, "FD");
      doc.setFillColor(pr, pg, pb);
      doc.roundedRect(x, y, w, baseH, 4, 4, "F");
      doc.rect(x, y + 4, w, baseH - 4, "F");
      doc.setFillColor(bgR, bgG, bgB);
      const step = radius * 1.9;
      let cx = x + radius;
      while (cx <= x + w - radius + 0.2) {
        doc.circle(cx, y + baseH, radius, "F");
        cx += step;
      }
      return baseH + radius * 0.4;
    }
    case "arch": {
      const archH = 8 + v * 2;              // 10..18
      const accentH = 6 + v;
      doc.roundedRect(x, y, w, h, 4, 4, "FD");
      // Arched colored top: filled rect + half-ellipse on top via triangles
      doc.setFillColor(pr, pg, pb);
      doc.rect(x, y + archH / 2, w, accentH, "F");
      // Approx arch using ellipse via repeated triangles around a center
      const cx = x + w / 2;
      const segs = 32;
      const rx = w / 2;
      const ry = archH / 2 + accentH / 2;
      for (let i = 0; i < segs; i++) {
        const a1 = Math.PI + (i / segs) * Math.PI;
        const a2 = Math.PI + ((i + 1) / segs) * Math.PI;
        doc.triangle(
          cx, y + archH / 2 + accentH / 2,
          cx + Math.cos(a1) * rx, y + archH / 2 + accentH / 2 + Math.sin(a1) * ry,
          cx + Math.cos(a2) * rx, y + archH / 2 + accentH / 2 + Math.sin(a2) * ry,
          "F",
        );
      }
      return archH + accentH / 2;
    }
    case "notched": {
      const notchW = 8 + v * 3;             // 11..23
      const notchH = 3 + v;                 // 4..8
      const accentH = 7 + v;
      doc.rect(x, y, w, h, "FD");
      doc.setFillColor(pr, pg, pb);
      doc.rect(x, y, w, accentH, "F");
      // Carve a top-center notch
      doc.setFillColor(bgR, bgG, bgB);
      doc.triangle(
        x + (w - notchW) / 2, y - 0.3,
        x + w / 2, y + notchH,
        x + (w + notchW) / 2, y - 0.3,
        "F",
      );
      return accentH;
    }
    case "double-frame": {
      const margin = 2 + v;                 // 3..7
      const accentH = 6 + v;
      doc.roundedRect(x, y, w, h, 3, 3, "FD");
      // Inner frame
      doc.setDrawColor(pr, pg, pb);
      doc.setLineWidth(0.4 + v * 0.1);
      doc.roundedRect(x + margin, y + margin, w - margin * 2, h - margin * 2, 2, 2, "S");
      doc.setFillColor(pr, pg, pb);
      doc.rect(x + margin, y + margin, w - margin * 2, accentH, "F");
      return margin + accentH;
    }
    case "tab-top": {
      const tabW = 20 + v * 6;              // 26..50
      const tabH = 4 + v * 1.5;             // 5.5..11.5
      doc.roundedRect(x, y + tabH, w, h - tabH, 3, 3, "FD");
      // Tab on top center
      doc.setFillColor(pr, pg, pb);
      const tabX = x + (w - tabW) / 2;
      doc.roundedRect(tabX, y, tabW, tabH * 1.6, 2, 2, "F");
      // Header colored band continues
      doc.rect(x, y + tabH, w, 6, "F");
      return tabH + 6;
    }
    case "scalloped": {
      const scalR = 1.5 + v * 0.5;          // 2..4
      const accentH = 7 + v;
      // Body
      doc.roundedRect(x, y, w, h, 2, 2, "FD");
      // Scalloped edges left/right (cut into the card by drawing white circles)
      doc.setFillColor(255, 255, 255);
      const step = scalR * 2;
      let sy = y + step;
      while (sy < y + h - step / 2) {
        doc.circle(x, sy, scalR, "F");
        doc.circle(x + w, sy, scalR, "F");
        sy += step;
      }
      doc.setFillColor(pr, pg, pb);
      doc.rect(x, y, w, accentH, "F");
      return accentH;
    }
  }
}

// ===========================================================================
// CONTENT DECORATIONS (12 named patterns + none)
// ===========================================================================

function drawContentDecorations(
  doc: jsPDF,
  decoration: BadgeDecoration,
  x: number, y: number, w: number, h: number,
  primary: RGB, accent: RGB,
  contentTop: number, contentBottom: number,
) {
  if (decoration === "none") return;
  const [pr, pg, pb] = primary;
  const tinted = tint(primary, 0.7);

  switch (decoration) {
    case "dots": {
      doc.setFillColor(...tinted);
      const cols = 9, rows = 6;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          const px = x + 6 + (i / (cols - 1)) * (w - 12);
          const py = contentTop + 4 + (j / (rows - 1)) * (contentBottom - contentTop - 8);
          doc.circle(px, py, 0.6, "F");
        }
      }
      break;
    }
    case "circles": {
      doc.setDrawColor(pr, pg, pb);
      doc.setLineWidth(0.25);
      const cx = x + w - 10, cy = contentBottom - 6;
      [4, 7, 10, 13, 16].forEach((r) => doc.circle(cx, cy, r, "S"));
      break;
    }
    case "stripes": {
      doc.setFillColor(...tint(primary, 0.85));
      for (let i = 0; i < 5; i++) {
        const sy = contentTop + i * 8;
        doc.triangle(x + 1, sy, x + 8, sy, x + 1, sy + 6, "F");
      }
      break;
    }
    case "grid": {
      doc.setDrawColor(...tint(primary, 0.55));
      doc.setLineWidth(0.2);
      const gx = x + w - 22, gy = contentBottom - 14;
      for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 3; j++) {
          doc.rect(gx + i * 4, gy + j * 4, 3, 3, "S");
        }
      }
      break;
    }
    case "confetti": {
      const palette: RGB[] = [primary, accent, tint(primary, 0.4), tint(primary, 0.65)];
      const dots = [
        [0.12, 0.18, 1.4], [0.22, 0.78, 1.0], [0.35, 0.32, 1.8],
        [0.5, 0.68, 1.2], [0.62, 0.22, 1.6], [0.78, 0.55, 1.3],
        [0.88, 0.82, 1.5], [0.18, 0.55, 1.1], [0.7, 0.88, 1.0],
      ];
      const zoneH = contentBottom - contentTop;
      dots.forEach(([dx, dy, r], i) => {
        const c = palette[i % palette.length];
        doc.setFillColor(c[0], c[1], c[2]);
        doc.circle(x + dx * w, contentTop + dy * zoneH, r, "F");
      });
      break;
    }
    case "waves": {
      doc.setDrawColor(...tinted);
      doc.setLineWidth(0.4);
      const baseY = contentBottom - 10;
      for (let row = 0; row < 3; row++) {
        const yOff = baseY - row * 4;
        for (let i = 0; i < 8; i++) {
          const sx = x + 4 + i * 12;
          // Approximate sine via two short lines
          doc.line(sx, yOff, sx + 6, yOff - 2);
          doc.line(sx + 6, yOff - 2, sx + 12, yOff);
        }
      }
      break;
    }
    case "triangles": {
      doc.setFillColor(...tint(primary, 0.6));
      const positions: [number, number, number][] = [
        [x + 6, contentTop + 4, 6],
        [x + w - 14, contentTop + 8, 8],
        [x + 12, contentBottom - 12, 7],
        [x + w - 10, contentBottom - 6, 5],
      ];
      positions.forEach(([px, py, s]) => {
        doc.triangle(px, py, px + s, py, px + s / 2, py + s, "F");
      });
      break;
    }
    case "diagonals": {
      doc.setDrawColor(...tint(primary, 0.55));
      doc.setLineWidth(0.3);
      const top = contentTop, bot = contentBottom;
      for (let i = -10; i < w + 10; i += 8) {
        doc.line(x + i, top, x + i + 14, bot);
      }
      break;
    }
    case "blobs": {
      doc.setFillColor(...tint(primary, 0.78));
      doc.circle(x - 6, contentBottom + 4, 16, "F");
      doc.setFillColor(...tint(accent, 0.3));
      doc.circle(x + w + 4, contentTop + 8, 14, "F");
      doc.setFillColor(...tint(primary, 0.55));
      doc.circle(x + w / 2, contentBottom - 4, 8, "F");
      break;
    }
    case "rings": {
      doc.setDrawColor(pr, pg, pb);
      doc.setLineWidth(0.35);
      [
        [x + 12, contentTop + 8, 5],
        [x + w - 14, contentTop + 12, 7],
        [x + 18, contentBottom - 8, 6],
        [x + w - 18, contentBottom - 4, 4],
      ].forEach(([cx, cy, r]) => doc.circle(cx, cy, r, "S"));
      break;
    }
    case "lines": {
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.25);
      doc.line(x + 6, contentTop + 4, x + 6, contentBottom - 4);
      doc.line(x + w - 6, contentTop + 4, x + w - 6, contentBottom - 4);
      doc.setFillColor(pr, pg, pb);
      doc.rect(x + 5.3, contentTop + 4, 1.4, 1.4, "F");
      doc.rect(x + w - 6.7, contentBottom - 5.4, 1.4, 1.4, "F");
      break;
    }
    case "corners": {
      doc.setDrawColor(pr, pg, pb);
      doc.setLineWidth(0.6);
      const len = 8;
      // four L-shaped corner marks
      const corners: [number, number, number, number][] = [
        [x + 4, contentTop + 4, 1, 1],
        [x + w - 4, contentTop + 4, -1, 1],
        [x + 4, contentBottom - 4, 1, -1],
        [x + w - 4, contentBottom - 4, -1, -1],
      ];
      corners.forEach(([cx, cy, dx, dy]) => {
        doc.line(cx, cy, cx + dx * len, cy);
        doc.line(cx, cy, cx, cy + dy * len);
      });
      break;
    }
  }
}

// ===========================================================================
// MAIN EXPORT
// ===========================================================================

export async function exportBadgesPDF(
  schedule: ConferenceSchedule,
  badges: BadgeEntry[],
  optionsOrLogo?: BadgeExportOptions | string,
) {
  const opts: BadgeExportOptions =
    typeof optionsOrLogo === "string" ? { customLogoDataUrl: optionsOrLogo } : optionsOrLogo || {};

  const themeId: BadgeTheme = opts.theme || "elegant";
  const shapeId: BadgeShape = opts.shape || "rounded-md";
  const decoration: BadgeDecoration = opts.decoration || "none";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const COLS = 2, ROWS = 2;
  const BADGE_W = 90, BADGE_H = 125;
  // Gutter between badges (espace pour ciseaux/massicot)
  const GUTTER = 8;
  const totalW = COLS * BADGE_W + (COLS - 1) * GUTTER;
  const totalH = ROWS * BADGE_H + (ROWS - 1) * GUTTER;
  const offsetX = opts.printOffsetX ?? 0;
  const offsetY = opts.printOffsetY ?? 0;
  const MARGIN_X = (pageW - totalW) / 2 + offsetX;
  const MARGIN_Y = (pageH - totalH) / 2 + offsetY;

  const cutLen = opts.cutMarkLength ?? 3.5;
  const cutOff = opts.cutMarkOffset ?? 1.2;

  // Draw crop marks at each badge corner (helps cutting)
  const drawCutMarks = (x: number, y: number, w: number, h: number) => {
    if (cutLen <= 0) return;
    doc.setDrawColor(120, 120, 120);
    doc.setLineWidth(0.2);
    const len = cutLen;
    const off = cutOff;
    // top-left
    doc.line(x - off - len, y, x - off, y);
    doc.line(x, y - off - len, x, y - off);
    // top-right
    doc.line(x + w + off, y, x + w + off + len, y);
    doc.line(x + w, y - off - len, x + w, y - off);
    // bottom-left
    doc.line(x - off - len, y + h, x - off, y + h);
    doc.line(x, y + h + off, x, y + h + off + len);
    // bottom-right
    doc.line(x + w + off, y + h, x + w + off + len, y + h);
    doc.line(x + w, y + h + off, x + w, y + h + off + len);
  };

  // Pre-render QR codes
  const qrCache = new Map<string, string>();
  if (opts.showQrCode) {
    for (const badge of badges) {
      const payload = buildQrPayload(badge, schedule.name, opts);
      try {
        const t = resolveTheme(themeId, badge.role, opts.accentColorOverride);
        qrCache.set(badge.name, await renderQrDataUrl(payload, t.primary));
      } catch { /* skip */ }
    }
  }

  const drawBadge = (badge: BadgeEntry, x: number, y: number) => {
    const t = resolveTheme(themeId, badge.role, opts.accentColorOverride);
    const [rR, rG, rB] = t.primary;
    const [aR, aG, aB] = t.accent;

    // ---- Outer frame
    const accentH = drawShapeFrame(doc, shapeId, x, y, BADGE_W, BADGE_H, t.primary, t.cardBg);

    // ---- Header zone
    const headerH = 26;
    const headerY = y + accentH;
    doc.setFillColor(t.headerBg[0], t.headerBg[1], t.headerBg[2]);
    doc.rect(x + 0.3, headerY, BADGE_W - 0.6, headerH, "F");

    // Logo
    let textStartX = x + 6;
    if (opts.customLogoDataUrl) {
      try {
        const fmt = detectFormat(opts.customLogoDataUrl);
        doc.addImage(opts.customLogoDataUrl, fmt, x + 5, headerY + 3, 18, 18);
        textStartX = x + 27;
      } catch { /* skip */ }
    }

    // Conference name auto-shrink
    doc.setTextColor(t.textPrimary[0], t.textPrimary[1], t.textPrimary[2]);
    doc.setFont("helvetica", "bold");
    const titleMaxW = BADGE_W - (textStartX - x) - 5;
    let titleSize = 11;
    let titleLines: string[] = [];
    while (titleSize >= 6) {
      doc.setFontSize(titleSize);
      titleLines = doc.splitTextToSize(schedule.name, titleMaxW);
      const overflow = titleLines.some((l: string) => doc.getTextWidth(l) > titleMaxW);
      if (titleLines.length <= 2 && !overflow) break;
      titleSize -= 0.5;
    }
    doc.setFontSize(titleSize);
    titleLines.slice(0, 2).forEach((line: string, idx: number) => {
      doc.text(line, textStartX, headerY + 7 + idx * (titleSize * 0.4));
    });

    let metaY = headerY + 7 + Math.min(titleLines.length, 2) * (titleSize * 0.4) + 1;
    if (opts.subtitle) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(7);
      doc.setTextColor(t.textMuted[0], t.textMuted[1], t.textMuted[2]);
      const subLines = doc.splitTextToSize(opts.subtitle, titleMaxW);
      doc.text(subLines.slice(0, 1), textStartX, metaY);
      metaY += 3.5;
    }
    if (opts.eventDate || opts.eventLocation) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.setTextColor(rR, rG, rB);
      const meta = [opts.eventDate, opts.eventLocation].filter(Boolean).join("  •  ");
      const metaLines = doc.splitTextToSize(meta, titleMaxW);
      doc.text(metaLines.slice(0, 1), textStartX, metaY);
    }

    // Separator
    doc.setDrawColor(t.separator[0], t.separator[1], t.separator[2]);
    doc.setLineWidth(0.3);
    doc.line(x + 6, headerY + headerH, x + BADGE_W - 6, headerY + headerH);

    // Decorations (background)
    const contentTop = headerY + headerH + 1;
    const contentBottom = y + BADGE_H - 30;
    drawContentDecorations(doc, decoration, x, y, BADGE_W, BADGE_H, t.primary, t.accent, contentTop, contentBottom);

    // Name zone
    const qrDataUrl = qrCache.get(badge.name);
    const QR_SIZE = 24;
    const hasQr = !!qrDataUrl;
    const nameZoneTop = headerY + headerH + 4;
    const nameZoneH = 42;
    const nameLeft = x + 8;
    const nameRight = hasQr ? x + BADGE_W - QR_SIZE - 10 : x + BADGE_W - 8;
    const nameAreaW = nameRight - nameLeft;
    const nameCenterX = (nameLeft + nameRight) / 2;

    doc.setTextColor(t.textPrimary[0], t.textPrimary[1], t.textPrimary[2]);
    doc.setFont("helvetica", "bold");
    let fontSize = 22;
    doc.setFontSize(fontSize);
    let nameLines: string[] = doc.splitTextToSize(badge.name, nameAreaW);
    const fits = (size: number, lines: string[]) => {
      doc.setFontSize(size);
      if (lines.length > 2) return false;
      return lines.every((l: string) => doc.getTextWidth(l) <= nameAreaW);
    };
    while (fontSize > 8 && !fits(fontSize, nameLines)) {
      fontSize -= 1;
      doc.setFontSize(fontSize);
      nameLines = doc.splitTextToSize(badge.name, nameAreaW);
    }
    nameLines = doc.splitTextToSize(badge.name, nameAreaW);
    if (nameLines.length > 2) {
      let tail = nameLines.slice(1).join(" ");
      while (tail.length > 0 && doc.getTextWidth(tail + "…") > nameAreaW) tail = tail.slice(0, -1);
      nameLines = [nameLines[0], (tail.trim() + "…")];
    }
    doc.setFontSize(fontSize);
    const display = nameLines.slice(0, 2);
    const lineH = fontSize * 0.45;
    const blockH = display.length * lineH;
    const startY = nameZoneTop + (nameZoneH - blockH) / 2 + lineH * 0.7;
    display.forEach((line: string, idx: number) => {
      doc.text(line, nameCenterX, startY + idx * lineH, { align: "center" });
    });

    // QR
    if (hasQr) {
      try {
        const qrX = x + BADGE_W - QR_SIZE - 5;
        const qrY = nameZoneTop + (nameZoneH - QR_SIZE) / 2;
        doc.setDrawColor(t.separator[0], t.separator[1], t.separator[2]);
        doc.setLineWidth(0.2);
        doc.roundedRect(qrX - 1, qrY - 1, QR_SIZE + 2, QR_SIZE + 2, 1, 1, "S");
        doc.addImage(qrDataUrl!, "PNG", qrX, qrY, QR_SIZE, QR_SIZE);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5);
        doc.setTextColor(t.textMuted[0], t.textMuted[1], t.textMuted[2]);
        doc.text("Scannez", qrX + QR_SIZE / 2, qrY + QR_SIZE + 3, { align: "center" });
      } catch { /* skip */ }
    }

    // Affiliation
    if (badge.affiliation) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(t.textMuted[0], t.textMuted[1], t.textMuted[2]);
      const affLines = doc.splitTextToSize(badge.affiliation, BADGE_W - 16);
      doc.text(affLines.slice(0, 2), x + BADGE_W / 2, nameZoneTop + nameZoneH + 6, { align: "center" });
    }

    // Role pill
    const roleLabel = ROLE_LABEL[badge.role];
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    const roleW = doc.getTextWidth(roleLabel) + 10;
    const pillX = x + (BADGE_W - roleW) / 2;
    const pillY = y + BADGE_H - 28;

    if (t.family === "mono") {
      doc.setFillColor(rR, rG, rB);
      doc.roundedRect(pillX, pillY, roleW, 7, 1, 1, "F");
      doc.setTextColor(255, 255, 255);
    } else if (t.family === "bold" || t.family === "pastel") {
      doc.setFillColor(rR, rG, rB);
      doc.roundedRect(pillX, pillY, roleW, 7, 3.5, 3.5, "F");
      doc.setTextColor(255, 255, 255);
    } else if (t.family === "dark") {
      doc.setFillColor(rR, rG, rB);
      doc.roundedRect(pillX, pillY, roleW, 7, 3.5, 3.5, "F");
      doc.setTextColor(17, 24, 39);
    } else {
      doc.setFillColor(aR, aG, aB);
      doc.setDrawColor(rR, rG, rB);
      doc.setLineWidth(0.4);
      doc.roundedRect(pillX, pillY, roleW, 7, 3.5, 3.5, "FD");
      doc.setTextColor(rR, rG, rB);
    }
    doc.text(roleLabel, x + BADGE_W / 2, pillY + 4.8, { align: "center" });

    // Partners
    const partners = (opts.partnerLogos || []).filter(Boolean);
    if (partners.length > 0) {
      const stripY = y + BADGE_H - 16;
      const stripH = 10;
      const maxLogos = Math.min(partners.length, 6);
      const slotW = (BADGE_W - 12) / maxLogos;
      for (let k = 0; k < maxLogos; k++) {
        try {
          const fmt = detectFormat(partners[k]);
          const lx = x + 6 + k * slotW + (slotW - stripH) / 2;
          doc.addImage(partners[k], fmt, lx, stripY, stripH, stripH);
        } catch { /* skip */ }
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text("PARTENAIRES", x + BADGE_W / 2, y + BADGE_H - 3, { align: "center" });
    } else {
      doc.setDrawColor(rR, rG, rB);
      doc.setLineWidth(0.6);
      doc.line(x + BADGE_W / 2 - 10, y + BADGE_H - 8, x + BADGE_W / 2 + 10, y + BADGE_H - 8);
    }
  };

  badges.forEach((badge, i) => {
    const idx = i % (COLS * ROWS);
    if (i > 0 && idx === 0) doc.addPage();
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const x = MARGIN_X + col * (BADGE_W + GUTTER);
    const y = MARGIN_Y + row * (BADGE_H + GUTTER);
    drawBadge(badge, x, y);
    drawCutMarks(x, y, BADGE_W, BADGE_H);
  });

  if (badges.length === 0) {
    doc.setFontSize(14);
    doc.text("Aucun badge à générer.", pageW / 2, pageH / 2, { align: "center" });
  }
  doc.save(`${schedule.name.replace(/\s+/g, "_")}_badges.pdf`);
}
