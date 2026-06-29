import jsPDF from "jspdf";
import QRCode from "qrcode";
import PizZip from "pizzip";
import JSZip from "jszip";
import { saveAs } from "file-saver";
import { ConferenceSchedule, Article } from "./conference";

// ===========================================================================
// TYPES
// ===========================================================================

export type CertificateRole = "speaker" | "moderator" | "chair" | "participant" | "organizer" | "other";

export const CERT_ROLE_LABEL: Record<CertificateRole, string> = {
  speaker: "Auteur / Présentateur",
  moderator: "Modérateur",
  chair: "Président de séance",
  participant: "Participant",
  organizer: "Organisateur",
  other: "Autre",
};

export interface CertificateRecipient {
  name: string;
  role: CertificateRole;
  affiliation?: string;
  communicationTitle?: string;
}

// ---------------------------------------------------------------------------
// LAYOUT — each predefined template ships a list of editable blocks. The user
// can move/resize/restyle every block without exception via the dialog.
// ---------------------------------------------------------------------------

export type BlockId =
  | "logo"
  | "heading"
  | "subtitle"
  | "separator"
  | "intro"
  | "name"
  | "affiliation"
  | "body1"
  | "body2"
  | "body3"
  | "commTitle"
  | "signatureImage"
  | "signatureLine"
  | "signatoryLine"
  | "signatoryName"
  | "qr"
  | "qrLabel"
  | "organizer"
  | "custom";

export type BlockShape = "none" | "rect" | "rounded" | "ellipse" | "underline";
export type BlockAlign = "left" | "center" | "right";

export interface CertificateBlock {
  /** Unique key inside the layout (allows multiple custom blocks). */
  key: string;
  /** Type of block — drives default text & rendering. */
  id: BlockId;
  /** Centered position (mm) of the block on A4 landscape (297×210). */
  x: number;
  y: number;
  /** Width (mm). For text blocks, used as wrap width; for images, render width. */
  w: number;
  /** Height (mm). For images/shapes; for text, the line slot height. */
  h: number;
  /** Visible flag — hidden blocks are not drawn. */
  visible: boolean;
  /** Optional override of the displayed text (for text blocks). */
  textOverride?: string;
  /** Font size in pt (text only). */
  fontSize?: number;
  /** Font weight (text only). */
  bold?: boolean;
  italic?: boolean;
  /** Horizontal alignment of text relative to (x,y). */
  align?: BlockAlign;
  /** Color override [r,g,b] 0-255. Defaults to template primary/text per block. */
  color?: [number, number, number];
  /** Background shape behind block. */
  shape?: BlockShape;
  /** Shape fill color [r,g,b]. */
  shapeFill?: [number, number, number];
  /** Shape stroke color [r,g,b]. */
  shapeStroke?: [number, number, number];
  /** Border radius for rounded shapes (mm). */
  shapeRadius?: number;
  /** Rotation in degrees. */
  rotate?: number;
}

export type CertificateLayout = CertificateBlock[];

export interface CertificateOptions {
  conferenceName: string;
  eventDate: string;
  eventLocation: string;
  organizer?: string;
  signatoryLine?: string;
  signatoryName?: string;
  logoDataUrl?: string;
  /** Default signature image (used by {{signature}} when no indexed map matches). */
  signatureDataUrl?: string;
  /** Multiple signatures keyed by index — used by {{signature1}}, {{signature2}}, ... */
  signatureImages?: Record<number, string>;
  showQrCode?: boolean;
  qrBaseUrl?: string;
  showCommunicationTitle?: boolean;
  showRole?: boolean;
  templateId: CertificateTemplateId;
  /** Optional layout override — if provided, used instead of the template default. */
  layout?: CertificateLayout;
}

// ===========================================================================
// TEMPLATES
// ===========================================================================

export type CertificateTemplateId =
  | "classic-blue" | "classic-burgundy" | "classic-emerald" | "classic-charcoal"
  | "elegant-gold" | "elegant-silver" | "elegant-rose"
  | "modern-indigo" | "modern-teal" | "modern-coral"
  | "minimal-mono" | "minimal-paper" | "minimal-sand"
  | "academic-navy" | "academic-forest" | "academic-maroon"
  | "festive-orange" | "festive-magenta"
  | "ribbon-bronze" | "ribbon-azure";

type RGB = [number, number, number];

export interface CertificateTemplate {
  id: CertificateTemplateId;
  label: string;
  family: "classic" | "elegant" | "modern" | "minimal" | "academic" | "festive" | "ribbon";
  primary: RGB;
  accent: RGB;
  bg: RGB;
  text: RGB;
  headingFont: "times" | "helvetica" | "courier";
  bodyFont: "times" | "helvetica" | "courier";
}

export const CERTIFICATE_TEMPLATES: CertificateTemplate[] = [
  { id: "classic-blue", label: "Classique Bleu", family: "classic", primary: [30, 64, 124], accent: [200, 215, 240], bg: [255, 255, 255], text: [25, 30, 45], headingFont: "times", bodyFont: "times" },
  { id: "classic-burgundy", label: "Classique Bordeaux", family: "classic", primary: [120, 30, 50], accent: [240, 210, 215], bg: [255, 255, 255], text: [40, 25, 25], headingFont: "times", bodyFont: "times" },
  { id: "classic-emerald", label: "Classique Émeraude", family: "classic", primary: [20, 90, 70], accent: [205, 235, 220], bg: [255, 255, 255], text: [25, 40, 30], headingFont: "times", bodyFont: "times" },
  { id: "classic-charcoal", label: "Classique Anthracite", family: "classic", primary: [55, 60, 70], accent: [220, 225, 230], bg: [255, 255, 255], text: [30, 30, 35], headingFont: "times", bodyFont: "times" },
  { id: "elegant-gold", label: "Élégant Doré", family: "elegant", primary: [165, 130, 50], accent: [245, 230, 195], bg: [255, 252, 245], text: [60, 45, 20], headingFont: "times", bodyFont: "times" },
  { id: "elegant-silver", label: "Élégant Argenté", family: "elegant", primary: [120, 130, 145], accent: [225, 230, 240], bg: [252, 253, 255], text: [40, 45, 55], headingFont: "times", bodyFont: "times" },
  { id: "elegant-rose", label: "Élégant Rose", family: "elegant", primary: [170, 75, 100], accent: [248, 220, 230], bg: [255, 250, 252], text: [60, 30, 45], headingFont: "times", bodyFont: "times" },
  { id: "modern-indigo", label: "Moderne Indigo", family: "modern", primary: [70, 60, 200], accent: [225, 220, 250], bg: [255, 255, 255], text: [25, 25, 45], headingFont: "helvetica", bodyFont: "helvetica" },
  { id: "modern-teal", label: "Moderne Teal", family: "modern", primary: [10, 130, 145], accent: [205, 235, 235], bg: [255, 255, 255], text: [20, 40, 45], headingFont: "helvetica", bodyFont: "helvetica" },
  { id: "modern-coral", label: "Moderne Corail", family: "modern", primary: [220, 90, 80], accent: [250, 220, 215], bg: [255, 255, 255], text: [60, 30, 25], headingFont: "helvetica", bodyFont: "helvetica" },
  { id: "minimal-mono", label: "Minimal Mono", family: "minimal", primary: [25, 25, 30], accent: [235, 235, 240], bg: [255, 255, 255], text: [30, 30, 35], headingFont: "helvetica", bodyFont: "helvetica" },
  { id: "minimal-paper", label: "Minimal Papier", family: "minimal", primary: [60, 70, 80], accent: [240, 238, 232], bg: [253, 251, 246], text: [40, 40, 45], headingFont: "helvetica", bodyFont: "helvetica" },
  { id: "minimal-sand", label: "Minimal Sable", family: "minimal", primary: [125, 100, 65], accent: [240, 228, 210], bg: [254, 250, 242], text: [60, 50, 35], headingFont: "helvetica", bodyFont: "helvetica" },
  { id: "academic-navy", label: "Académique Marine", family: "academic", primary: [15, 35, 75], accent: [210, 220, 240], bg: [255, 255, 255], text: [20, 25, 40], headingFont: "times", bodyFont: "times" },
  { id: "academic-forest", label: "Académique Forêt", family: "academic", primary: [25, 70, 45], accent: [210, 230, 215], bg: [253, 255, 252], text: [25, 40, 30], headingFont: "times", bodyFont: "times" },
  { id: "academic-maroon", label: "Académique Marron", family: "academic", primary: [95, 35, 30], accent: [235, 215, 210], bg: [255, 254, 252], text: [45, 30, 25], headingFont: "times", bodyFont: "times" },
  { id: "festive-orange", label: "Festif Orange", family: "festive", primary: [230, 105, 45], accent: [255, 225, 200], bg: [255, 252, 245], text: [70, 40, 20], headingFont: "helvetica", bodyFont: "helvetica" },
  { id: "festive-magenta", label: "Festif Magenta", family: "festive", primary: [185, 50, 130], accent: [250, 215, 235], bg: [255, 250, 253], text: [60, 25, 50], headingFont: "helvetica", bodyFont: "helvetica" },
  { id: "ribbon-bronze", label: "Ruban Bronze", family: "ribbon", primary: [155, 90, 50], accent: [240, 220, 200], bg: [254, 250, 245], text: [55, 40, 25], headingFont: "times", bodyFont: "times" },
  { id: "ribbon-azure", label: "Ruban Azur", family: "ribbon", primary: [40, 120, 195], accent: [215, 235, 250], bg: [253, 253, 255], text: [25, 35, 55], headingFont: "times", bodyFont: "times" },
];

export function getCertificateTemplate(id: CertificateTemplateId): CertificateTemplate {
  return CERTIFICATE_TEMPLATES.find((t) => t.id === id) ?? CERTIFICATE_TEMPLATES[0];
}

// ===========================================================================
// DEFAULT LAYOUT (A4 landscape: 297 × 210 mm)
// ===========================================================================

export const PAGE_W = 297;
export const PAGE_H = 210;

export const BLOCK_LABEL: Record<BlockId, string> = {
  logo: "Logo",
  heading: "Titre « ATTESTATION »",
  subtitle: "Sous-titre (rôle)",
  separator: "Séparateur décoratif",
  intro: "« Il est attesté que »",
  name: "Nom du destinataire",
  affiliation: "Affiliation",
  body1: "Corps · ligne 1",
  body2: "Corps · ligne 2 (conférence)",
  body3: "Corps · ligne 3 (date/lieu)",
  commTitle: "Titre de communication",
  signatureImage: "Image de signature",
  signatureLine: "Trait de signature",
  signatoryLine: "Mention du signataire",
  signatoryName: "Nom du signataire",
  qr: "QR code",
  qrLabel: "Légende du QR",
  organizer: "Pied — organisateur",
  custom: "Bloc personnalisé",
};

export function defaultLayout(): CertificateLayout {
  const b = (id: BlockId, props: Omit<CertificateBlock, "id" | "key">): CertificateBlock => ({
    key: id, id, ...props,
  });
  return [
    b("logo", { x: PAGE_W / 2, y: 28, w: 24, h: 24, visible: true, align: "center", shape: "none" }),
    b("heading", { x: PAGE_W / 2, y: 70, w: PAGE_W - 60, h: 12, visible: true, align: "center", fontSize: 34, bold: true, shape: "none", textOverride: "ATTESTATION" }),
    b("subtitle", { x: PAGE_W / 2, y: 80, w: PAGE_W - 80, h: 8, visible: true, align: "center", fontSize: 14, shape: "none" }),
    b("separator", { x: PAGE_W / 2, y: 86, w: 50, h: 0.6, visible: true, align: "center", shape: "underline" }),
    b("intro", { x: PAGE_W / 2, y: 102, w: PAGE_W - 80, h: 7, visible: true, align: "center", fontSize: 12, shape: "none", textOverride: "Il est attesté que" }),
    b("name", { x: PAGE_W / 2, y: 116, w: PAGE_W - 60, h: 12, visible: true, align: "center", fontSize: 26, bold: true, shape: "none" }),
    b("affiliation", { x: PAGE_W / 2, y: 124, w: PAGE_W - 80, h: 6, visible: true, align: "center", fontSize: 11, italic: true, shape: "none" }),
    b("body1", { x: PAGE_W / 2, y: 138, w: PAGE_W - 60, h: 7, visible: true, align: "center", fontSize: 12, shape: "none" }),
    b("body2", { x: PAGE_W / 2, y: 145, w: PAGE_W - 60, h: 7, visible: true, align: "center", fontSize: 12, bold: true, shape: "none" }),
    b("body3", { x: PAGE_W / 2, y: 152, w: PAGE_W - 60, h: 7, visible: true, align: "center", fontSize: 12, shape: "none" }),
    b("commTitle", { x: PAGE_W / 2, y: 162, w: PAGE_W - 60, h: 6, visible: true, align: "center", fontSize: 11, italic: true, shape: "none" }),
    b("signatureImage", { x: PAGE_W - 70, y: PAGE_H - 68, w: 30, h: 16, visible: true, align: "center", shape: "none" }),
    b("signatureLine", { x: PAGE_W - 70, y: PAGE_H - 50, w: 50, h: 0.3, visible: true, align: "center", shape: "underline" }),
    b("signatoryLine", { x: PAGE_W - 70, y: PAGE_H - 45, w: 60, h: 5, visible: true, align: "center", fontSize: 10, shape: "none" }),
    b("signatoryName", { x: PAGE_W - 70, y: PAGE_H - 40, w: 60, h: 5, visible: true, align: "center", fontSize: 10, bold: true, shape: "none" }),
    b("qr", { x: 36, y: PAGE_H - 50, w: 22, h: 22, visible: true, align: "center", shape: "none" }),
    b("qrLabel", { x: 36, y: PAGE_H - 25, w: 40, h: 5, visible: true, align: "center", fontSize: 8, shape: "none", textOverride: "Vérification" }),
    b("organizer", { x: PAGE_W / 2, y: PAGE_H - 14, w: PAGE_W - 60, h: 5, visible: true, align: "center", fontSize: 9, italic: true, shape: "none" }),
  ];
}

/** Create a fresh custom block at center of page. */
export function createCustomBlock(text = "Texte personnalisé"): CertificateBlock {
  return {
    key: `custom-${Math.random().toString(36).slice(2, 9)}`,
    id: "custom",
    x: PAGE_W / 2, y: PAGE_H / 2, w: 80, h: 8,
    visible: true, align: "center", fontSize: 12,
    shape: "none", textOverride: text,
  };
}

// ===========================================================================
// RECIPIENTS BUILDER
// ===========================================================================

function splitAuthors(raw: string): string[] {
  if (!raw) return [];
  return raw.split(/[,;&\n]| et | and /i).map((s) => s.trim()).filter((s) => s.length > 1);
}

export function buildRecipientsFromSchedule(
  schedule: ConferenceSchedule,
  articles: Article[],
): CertificateRecipient[] {
  const articleMap = new Map(articles.map((a) => [a.id, a]));
  const byKey = new Map<string, CertificateRecipient>();
  const priority: Record<CertificateRole, number> = { chair: 3, moderator: 2, speaker: 1, organizer: 1, other: 0, participant: 0 };

  const upsert = (rec: CertificateRecipient) => {
    const k = rec.name.trim();
    if (!k) return;
    const existing = byKey.get(k);
    if (!existing) { byKey.set(k, rec); return; }
    const merged: CertificateRecipient = { ...existing };
    if (priority[rec.role] > priority[existing.role]) merged.role = rec.role;
    if (!merged.affiliation && rec.affiliation) merged.affiliation = rec.affiliation;
    if (!merged.communicationTitle && rec.communicationTitle) merged.communicationTitle = rec.communicationTitle;
    byKey.set(k, merged);
  };

  for (const s of schedule.slots) {
    const a = articleMap.get(s.articleId);
    if (!a) continue;
    splitAuthors(a.authors).forEach((author) =>
      upsert({ name: author, role: "speaker", affiliation: a.category, communicationTitle: a.title }),
    );
    if (a.moderator) upsert({ name: a.moderator, role: "moderator", affiliation: a.category });
    if (a.sessionChair) upsert({ name: a.sessionChair, role: "chair", affiliation: a.category });
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// ===========================================================================
// PDF RENDERING
// ===========================================================================

function detectImageFormat(dataUrl: string): "PNG" | "JPEG" {
  return /^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG";
}

async function buildQrDataUrl(payload: string, primary: RGB): Promise<string> {
  const hex = "#" + primary.map((c) => c.toString(16).padStart(2, "0")).join("");
  return QRCode.toDataURL(payload, { margin: 0, errorCorrectionLevel: "M", width: 256, color: { dark: hex, light: "#ffffff" } });
}

function drawTemplateChrome(doc: jsPDF, tpl: CertificateTemplate, pageW: number, pageH: number) {
  doc.setFillColor(...tpl.bg);
  doc.rect(0, 0, pageW, pageH, "F");
  switch (tpl.family) {
    case "classic":
      doc.setDrawColor(...tpl.primary); doc.setLineWidth(1.4); doc.rect(12, 12, pageW - 24, pageH - 24);
      doc.setLineWidth(0.4); doc.rect(16, 16, pageW - 32, pageH - 32); break;
    case "elegant": {
      doc.setDrawColor(...tpl.primary); doc.setLineWidth(0.6); doc.rect(15, 15, pageW - 30, pageH - 30);
      const c = 18;
      [[15,15],[pageW-15-c,15],[15,pageH-15-c],[pageW-15-c,pageH-15-c]].forEach(([cx,cy]) => {
        doc.setFillColor(...tpl.accent); doc.rect(cx, cy, c, c, "F");
        doc.setDrawColor(...tpl.primary); doc.setLineWidth(0.3); doc.rect(cx, cy, c, c);
      });
      break;
    }
    case "modern":
      doc.setFillColor(...tpl.primary); doc.rect(0, 0, pageW, 14, "F");
      doc.setFillColor(...tpl.accent); doc.rect(0, 14, 8, pageH - 14, "F"); break;
    case "minimal":
      doc.setDrawColor(...tpl.primary); doc.setLineWidth(0.3); doc.rect(14, 14, pageW - 28, pageH - 28);
      doc.setFillColor(...tpl.primary); doc.rect(14, 14, 60, 1.5, "F"); break;
    case "academic":
      doc.setFillColor(...tpl.primary); doc.rect(0, 0, pageW, 8, "F"); doc.rect(0, pageH - 8, pageW, 8, "F");
      doc.setDrawColor(...tpl.accent); doc.setLineWidth(0.4); doc.rect(14, 16, pageW - 28, pageH - 32); break;
    case "festive":
      doc.setFillColor(...tpl.primary);
      doc.triangle(0, 0, 70, 0, 0, 70, "F");
      doc.triangle(pageW, pageH, pageW - 70, pageH, pageW, pageH - 70, "F");
      doc.setFillColor(...tpl.accent);
      doc.triangle(pageW, 0, pageW - 50, 0, pageW, 50, "F");
      doc.triangle(0, pageH, 50, pageH, 0, pageH - 50, "F"); break;
    case "ribbon":
      doc.setFillColor(...tpl.primary); doc.rect(pageW / 2 - 60, 0, 120, 18, "F");
      doc.setFillColor(...tpl.accent);
      doc.triangle(pageW / 2 - 60, 18, pageW / 2 - 70, 22, pageW / 2 - 60, 26, "F");
      doc.triangle(pageW / 2 + 60, 18, pageW / 2 + 70, 22, pageW / 2 + 60, 26, "F");
      doc.setDrawColor(...tpl.primary); doc.setLineWidth(0.5); doc.rect(15, 32, pageW - 30, pageH - 47); break;
  }
}

/** Compute per-block displayed text for a recipient. */
function blockTextFor(
  id: BlockId,
  rec: CertificateRecipient,
  opts: CertificateOptions,
): string | null {
  switch (id) {
    case "heading": return "ATTESTATION";
    case "subtitle":
      return opts.showRole && rec.role !== "participant"
        ? `de ${CERT_ROLE_LABEL[rec.role]}` : "de Participation";
    case "intro": return "Il est attesté que";
    case "name": return rec.name;
    case "affiliation": return rec.affiliation || null;
    case "body1": {
      const verb = rec.role === "speaker" ? "a présenté une communication"
        : rec.role === "moderator" ? "a assuré la modération d'une session"
        : rec.role === "chair" ? "a présidé une session scientifique"
        : rec.role === "organizer" ? "a contribué à l'organisation"
        : rec.role === "other" ? "a contribué"
        : "a participé";
      return `${verb} lors de la conférence`;
    }
    case "body2": return `« ${opts.conferenceName} »`;
    case "body3": return `tenue ${opts.eventDate} à ${opts.eventLocation}.`;
    case "commTitle":
      if (opts.showCommunicationTitle && rec.communicationTitle && rec.role === "speaker")
        return `Titre de la communication : « ${rec.communicationTitle} »`;
      return null;
    case "signatoryLine": return opts.signatoryLine || null;
    case "signatoryName": return opts.signatoryName || null;
    case "qrLabel": return opts.showQrCode ? "Vérification" : null;
    case "organizer": return opts.organizer || null;
    default: return null;
  }
}

function drawShape(doc: jsPDF, b: CertificateBlock, tpl: CertificateTemplate) {
  if (!b.shape || b.shape === "none") return;
  const fill = b.shapeFill ?? tpl.accent;
  const stroke = b.shapeStroke ?? tpl.primary;
  const x = b.x - b.w / 2;
  const y = b.y - b.h / 2;
  doc.setFillColor(...fill); doc.setDrawColor(...stroke); doc.setLineWidth(0.3);
  switch (b.shape) {
    case "rect": doc.rect(x, y, b.w, b.h, "FD"); break;
    case "rounded": doc.roundedRect(x, y, b.w, b.h, b.shapeRadius ?? 3, b.shapeRadius ?? 3, "FD"); break;
    case "ellipse": doc.ellipse(b.x, b.y, b.w / 2, b.h / 2, "FD"); break;
    case "underline":
      doc.setLineWidth(Math.max(0.3, b.h));
      doc.line(b.x - b.w / 2, b.y, b.x + b.w / 2, b.y); break;
  }
}

async function drawCertificatePage(
  doc: jsPDF,
  rec: CertificateRecipient,
  opts: CertificateOptions,
  tpl: CertificateTemplate,
  layout: CertificateLayout,
) {
  drawTemplateChrome(doc, tpl, PAGE_W, PAGE_H);

  for (const b of layout) {
    if (!b.visible) continue;

    // Skip blocks tied to disabled options
    if (b.id === "qr" && !opts.showQrCode) continue;
    if (b.id === "qrLabel" && !opts.showQrCode) continue;
    if (b.id === "logo" && !opts.logoDataUrl) continue;
    if (b.id === "signatureImage" && !opts.signatureDataUrl) continue;

    drawShape(doc, b, tpl);

    // Image blocks
    if (b.id === "logo" && opts.logoDataUrl) {
      try {
        const fmt = detectImageFormat(opts.logoDataUrl);
        doc.addImage(opts.logoDataUrl, fmt, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, undefined, "FAST");
      } catch { /* ignore */ }
      continue;
    }
    if (b.id === "signatureImage" && opts.signatureDataUrl) {
      try {
        const fmt = detectImageFormat(opts.signatureDataUrl);
        doc.addImage(opts.signatureDataUrl, fmt, b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, undefined, "FAST");
      } catch { /* ignore */ }
      continue;
    }
    if (b.id === "qr" && opts.showQrCode) {
      try {
        const payload = (opts.qrBaseUrl || "").trim()
          ? opts.qrBaseUrl!.replace(/\/+$/, "") + "/" + slugify(rec.name)
          : `${opts.conferenceName} | ${rec.name} | ${CERT_ROLE_LABEL[rec.role]}`;
        const qr = await buildQrDataUrl(payload, tpl.primary);
        doc.addImage(qr, "PNG", b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, undefined, "FAST");
      } catch { /* ignore */ }
      continue;
    }

    // Text blocks
    const text = b.textOverride ?? blockTextFor(b.id, rec, opts);
    if (text == null || text === "") continue;
    if (b.id === "separator" || b.id === "signatureLine") continue; // shape only

    const isHeading = ["heading", "subtitle", "name"].includes(b.id);
    const family = isHeading ? tpl.headingFont : tpl.bodyFont;
    const weight: "normal" | "bold" | "italic" | "bolditalic" =
      b.bold && b.italic ? "bolditalic" : b.bold ? "bold" : b.italic ? "italic" : "normal";
    doc.setFont(family, weight);
    doc.setFontSize(b.fontSize ?? 12);
    const color = b.color ?? (b.id === "heading" || b.id === "name" ? tpl.primary : tpl.text);
    doc.setTextColor(...color);

    const align = b.align ?? "center";
    const wrapped = doc.splitTextToSize(text, b.w);
    const tx = align === "left" ? b.x - b.w / 2 : align === "right" ? b.x + b.w / 2 : b.x;
    doc.text(wrapped, tx, b.y, { align });
  }
}

function slugify(name: string): string {
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export async function exportCertificatesPDF(
  recipients: CertificateRecipient[],
  opts: CertificateOptions,
): Promise<void> {
  if (recipients.length === 0) throw new Error("Aucun destinataire");
  const tpl = getCertificateTemplate(opts.templateId);
  const layout = opts.layout ?? defaultLayout();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  for (let i = 0; i < recipients.length; i++) {
    if (i > 0) doc.addPage();
    await drawCertificatePage(doc, recipients[i], opts, tpl, layout);
  }

  const safeName = slugify(opts.conferenceName) || "attestations";
  doc.save(`attestations-${safeName}.pdf`);
}

// ===========================================================================
// PPTX TEMPLATE FILLER (placeholder substitution + {{codeqr}} image)
// ===========================================================================

/**
 * Supported placeholders (case-insensitive):
 *   {{nom}} {{name}}        — recipient name
 *   {{role}}                — role label
 *   {{affiliation}}         — affiliation
 *   {{titre}} {{title}}     — communication title
 *   {{conference}}          — conference name
 *   {{date}}                — event date
 *   {{lieu}} {{location}}   — event location
 *   {{organisateur}}        — organizer
 *   {{signataire}}          — signatory name
 *   {{codeqr}} {{qrcode}}   — QR code image (replaces the text-frame containing
 *                             the placeholder with an image of the QR)
 */
export async function exportCertificatesPPTX(
  templateFile: File | ArrayBuffer,
  recipients: CertificateRecipient[],
  opts: CertificateOptions,
): Promise<void> {
  if (recipients.length === 0) throw new Error("Aucun destinataire");
  const buf = templateFile instanceof File ? await templateFile.arrayBuffer() : templateFile;

  let baseZipBytes: Uint8Array;
  try {
    const probe = new PizZip(buf);
    if (!probe.file("ppt/presentation.xml")) throw new Error("Le fichier ne semble pas être un .pptx valide");
    baseZipBytes = new Uint8Array(buf);
  } catch (e) {
    throw new Error("Impossible de lire le modèle .pptx : " + (e instanceof Error ? e.message : String(e)));
  }

  const tpl = getCertificateTemplate(opts.templateId);
  const outZip = new JSZip();

  for (const rec of recipients) {
    const zip = new PizZip(baseZipBytes);
    const replacements: Record<string, string> = {
      nom: rec.name, name: rec.name,
      role: CERT_ROLE_LABEL[rec.role],
      affiliation: rec.affiliation || "",
      titre: rec.communicationTitle || "",
      title: rec.communicationTitle || "",
      conference: opts.conferenceName,
      date: opts.eventDate,
      lieu: opts.eventLocation, location: opts.eventLocation,
      organisateur: opts.organizer || "",
      signataire: opts.signatoryName || "",
    };

    // Build QR image (PNG bytes) for this recipient — used by {{codeqr}}.
    const qrPayload = (opts.qrBaseUrl || "").trim()
      ? opts.qrBaseUrl!.replace(/\/+$/, "") + "/" + slugify(rec.name)
      : `${opts.conferenceName} | ${rec.name} | ${CERT_ROLE_LABEL[rec.role]}`;
    const qrDataUrl = await buildQrDataUrl(qrPayload, tpl.primary);
    const qrPngBytes = base64ToBytes(qrDataUrl.split(",")[1] || "");

    const slidePaths = Object.keys(zip.files).filter((p) =>
      /^ppt\/slides\/slide\d+\.xml$/.test(p),
    );

    // Build a map of signature index → bytes/ext. Index 0 == default {{signature}}.
    type SigEntry = { bytes: Uint8Array; ext: "png" | "jpg" };
    const sigMap = new Map<number, SigEntry>();
    const parseSig = (dataUrl: string | undefined): SigEntry | null => {
      if (!dataUrl) return null;
      const m = dataUrl.match(/^data:image\/(png|jpe?g|webp);base64,(.+)$/i);
      if (!m) return null;
      return { bytes: base64ToBytes(m[2]), ext: /jpe?g/i.test(m[1]) ? "jpg" : "png" };
    };
    const defSig = parseSig(opts.signatureDataUrl);
    if (defSig) sigMap.set(0, defSig);
    if (opts.signatureImages) {
      for (const [k, v] of Object.entries(opts.signatureImages)) {
        const idx = parseInt(k, 10);
        if (!Number.isFinite(idx) || idx < 1) continue;
        const e = parseSig(v);
        if (e) sigMap.set(idx, e);
      }
    }

    let qrImagePath: string | null = null;
    const sigImagePaths = new Map<number, string>();

    for (const slidePath of slidePaths) {
      const file = zip.file(slidePath);
      if (!file) continue;
      let xml = file.asText();

      // Pass 1: text replacements (skip image placeholders)
      xml = applyPlaceholders(xml, replacements);

      // Pass 2: {{codeqr}} → image
      if (/\{\{\s*(?:codeqr|qrcode|qr)\s*\}\}/i.test(xml)) {
        if (!qrImagePath) {
          qrImagePath = `ppt/media/qr_${slugify(rec.name) || "rec"}.png`;
          zip.file(qrImagePath, qrPngBytes, { binary: true });
        }
        const rid = ensureSlideImageRel(zip, slidePath, qrImagePath);
        xml = replaceImagePlaceholders(xml, rid, /\{\{\s*(?:codeqr|qrcode|qr)\s*\}\}/i, "QR Code");
        ensureImageContentType(zip, "png");
      }

      // Pass 3: {{signature}} and {{signatureN}} → signature images.
      // Find every distinct signature placeholder present in the slide (with index).
      const sigTagRegex = /\{\{\s*(?:signature|signatureimage)\s*(\d*)\s*\}\}/gi;
      const indices = new Set<number>();
      for (const m of xml.matchAll(sigTagRegex)) {
        indices.add(m[1] ? parseInt(m[1], 10) : 0);
      }
      for (const idx of indices) {
        // Resolve which uploaded signature to use. Fallback chain: idx → default (0).
        const entry = sigMap.get(idx) ?? sigMap.get(0);
        if (!entry) continue;
        let imgPath = sigImagePaths.get(idx);
        if (!imgPath) {
          imgPath = `ppt/media/sig${idx}_${slugify(rec.name) || "rec"}.${entry.ext}`;
          zip.file(imgPath, entry.bytes, { binary: true });
          sigImagePaths.set(idx, imgPath);
        }
        const rid = ensureSlideImageRel(zip, slidePath, imgPath);
        // Match exactly this index (use \\b-ish boundary by requiring no other digit).
        const idxPattern = idx === 0
          ? /\{\{\s*(?:signature|signatureimage)\s*\}\}/i
          : new RegExp(`\\{\\{\\s*(?:signature|signatureimage)\\s*${idx}\\s*\\}\\}`, "i");
        xml = replaceImagePlaceholders(xml, rid, idxPattern, `Signature ${idx || ""}`.trim());
        ensureImageContentType(zip, entry.ext === "jpg" ? "jpeg" : "png");
      }

      zip.file(slidePath, xml);
    }

    const out = zip.generate({ type: "uint8array", compression: "DEFLATE" });
    outZip.file(`attestation-${slugify(rec.name) || "destinataire"}.pptx`, out);
  }

  const blob = await outZip.generateAsync({ type: "blob" });
  saveAs(blob, `attestations-${slugify(opts.conferenceName) || "conference"}.zip`);
}

function applyPlaceholders(xml: string, vars: Record<string, string>): string {
  const tagSafe = /\{\{\s*([\s\S]*?)\s*\}\}/g;
  return xml.replace(tagSafe, (full, inner) => {
    const key = String(inner).replace(/<[^>]+>/g, "").trim().toLowerCase();
    if (["codeqr","qrcode","qr"].includes(key)) return full;
    // Skip any signature placeholder (with or without index)
    if (/^(?:signature|signatureimage)\d*$/.test(key)) return full;
    if (key in vars) return escapeXml(vars[key]);
    return full;
  });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Add image relationship to slide rels, return the rId. Idempotent per (slide, target). */
function ensureSlideQrRel(zip: PizZip, slidePath: string, imagePath: string): string {
  const slideName = slidePath.split("/").pop()!; // slide1.xml
  const relsPath = `ppt/slides/_rels/${slideName}.rels`;
  const target = "../media/" + imagePath.split("/").pop();

  let relsXml = zip.file(relsPath)?.asText();
  if (!relsXml) {
    relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  }

  // already linked?
  const existing = relsXml.match(new RegExp(`<Relationship[^/]*Target="${escapeRegExp(target)}"[^/]*Id="(rId\\d+)"`));
  const existing2 = relsXml.match(new RegExp(`<Relationship[^/]*Id="(rId\\d+)"[^/]*Target="${escapeRegExp(target)}"`));
  if (existing) return existing[1];
  if (existing2) return existing2[1];

  // pick next rId
  const ids = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map((m) => parseInt(m[1], 10));
  const next = (ids.length ? Math.max(...ids) : 0) + 1;
  const rid = `rId${next}`;
  const rel = `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`;
  relsXml = relsXml.replace(/<\/Relationships>/, rel + "</Relationships>");
  zip.file(relsPath, relsXml);
  return rid;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensurePngContentType(zip: PizZip) { ensureImageContentType(zip, "png"); }

function ensureImageContentType(zip: PizZip, ext: "png" | "jpeg") {
  const path = "[Content_Types].xml";
  let xml = zip.file(path)?.asText();
  if (!xml) return;
  const aliases = ext === "jpeg" ? ["jpeg", "jpg"] : ["png"];
  if (aliases.some((e) => new RegExp(`Extension="${e}"`, "i").test(xml!))) return;
  const mime = ext === "jpeg" ? "image/jpeg" : "image/png";
  const useExt = ext === "jpeg" ? "jpeg" : "png";
  xml = xml.replace(/<\/Types>/, `<Default Extension="${useExt}" ContentType="${mime}"/></Types>`);
  zip.file(path, xml);
}

const ensureSlideImageRel = ensureSlideQrRel;

/** Replace any <p:sp> containing matchRegex (in flattened text) with a <p:pic> at same xfrm. */
function replaceImagePlaceholders(xml: string, rid: string, matchRegex: RegExp, name: string): string {
  const spRegex = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  return xml.replace(spRegex, (sp) => {
    const flat = sp.replace(/<[^>]+>/g, "");
    if (!matchRegex.test(flat)) return sp;
    const off = sp.match(/<a:off\s+x="(-?\d+)"\s+y="(-?\d+)"\s*\/>/);
    const ext = sp.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"\s*\/>/);
    const x = off ? off[1] : "0";
    const y = off ? off[2] : "0";
    const cx = ext ? ext[1] : "1828800";
    const cy = ext ? ext[2] : "1828800";
    return `<p:pic><p:nvPicPr><p:cNvPr id="9999" name="${name}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  });
}
