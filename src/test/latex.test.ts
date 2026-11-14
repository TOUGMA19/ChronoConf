import { describe, it, expect } from "vitest";
import { latexToUnicode as L, splitLatex, toWinAnsiSafe, needsUnicodeFont, hasLatex } from "@/lib/latex";
import { splitAuthors, cleanArticle, cleanSchedule } from "@/lib/people";
import { buildRecipientsFromSchedule } from "@/lib/exportCertificates";
import { buildBadgesFromSchedule } from "@/lib/exportBadges";
import { latexToHtml } from "@/components/LatexText";
import type { Article, ConferenceSchedule } from "@/lib/conference";

const cases: [string, string][] = [
  ["Étude de $\\alpha$-stabilité", "Étude de α-stabilité"],
  ["$u_t + \\Delta u = 0$", "uₜ + Δu = 0"],
  ["$x^2 + y^{n+1}$", "x² + yⁿ⁺¹"],
  ["$\\frac{1}{2}$ et $\\frac{a+b}{c}$", "½ et (a+b)/c"],
  ["$\\sqrt{x}$ $\\sqrt{x+1}$ $\\sqrt[3]{8}$", "√x √(x+1) ∛8"],
  ["$\\sum_{i=1}^{n} a_i$", "∑ᵢ₌₁ⁿ aᵢ"],
  ["$\\int_0^1 f(x)\\,dx$", "∫₀¹ f(x) dx"],
  ["$a \\leq b$ et $x \\in \\mathbb{R}$", "a ≤ b et x ∈ ℝ"],
  ["Ou\\'edraogo, Kabor\\'{e}, \\c{C}a, na\\\"ive, {\\'e}t\\'e", "Ouédraogo, Kaboré, Ça, naïve, été"],
  ["\\textbf{Gras} et \\emph{italique} 50\\% \\& co", "Gras et italique 50% & co"],
  ["coût de 5$ et 10$ au total", "coût de 5$ et 10$ au total"],
  ["$e^{-x^2}$", "e⁻ˣ²"],
  ["$$E = mc^2$$", "E = mc²"],
  ["\\(\\alpha + \\beta\\)", "α + β"],
  ["Les EDP -- non linéaires", "Les EDP – non linéaires"],
  ["$\\pi r^2$", "πr²"],
  ["$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$", "(a b; c d)"],
  ["$\\mathcal{L}(\\mathbb{R}^n)$", "ℒ(ℝⁿ)"],
  ["Texte sans LaTeX : é, ü, 100 %", "Texte sans LaTeX : é, ü, 100 %"],
];

describe("LaTeX → Unicode", () => {
  for (const [i, o] of cases) it(i, () => expect(L(i)).toBe(o));
  it("est idempotent", () => { for (const [, o] of cases) expect(L(o)).toBe(o); });
  it("découpe texte / formule", () => {
    expect(splitLatex("a $b$ c").map((x) => x.type)).toEqual(["text", "math", "text"]);
    expect(hasLatex("sans formule")).toBe(false);
    expect(hasLatex("avec $x$")).toBe(true);
  });
  it("repli ASCII quand la police Unicode manque", () => {
    expect(toWinAnsiSafe("α ≤ β x²")).toBe("alpha <= beta x²");
    expect(needsUnicodeFont("é à ç")).toBe(false);
    expect(needsUnicodeFont("α")).toBe(true);
  });
});

const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, title: "Stabilité $\\alpha$ de $u_t = \\Delta u$", authors: "Awa Traor\\'e et Issa Compaor\\'{e}", moderator: "", sessionChair: "",
  abstract: "On montre que $x \\leq 1$.", category: "Maths", duration: 20, type: "présentielle", status: "accepted", ...over,
});
const schedule: ConferenceSchedule = {
  id: "s", name: "Conf", days: 1, rooms: ["A"], startHour: 8, endHour: 18, breakMinutes: 10,
  slots: [{ articleId: "1", room: "A", startTime: "08:00", endTime: "08:20", day: 0 }],
  specialSlots: [{ id: "k", title: "Plénière sur $\\pi$", speaker: "Pr Ou\\'edraogo", type: "keynote", room: "all", startTime: "09:00", endTime: "10:00", day: 0 }],
  createdAt: new Date(),
};

describe("intégration dans les listes et exports", () => {
  it("splitAuthors convertit les accents LaTeX", () => {
    expect(splitAuthors("Awa Traor\\'e et Issa Compaor\\'{e}")).toEqual(["Awa Traoré", "Issa Compaoré"]);
  });
  it("cleanArticle / cleanSchedule", () => {
    expect(cleanArticle(art("1")).title).toBe("Stabilité α de uₜ = Δu");
    expect(cleanSchedule(schedule).specialSlots![0].title).toBe("Plénière sur π");
  });
  it("attestations : titre et noms propres", () => {
    const r = buildRecipientsFromSchedule(schedule, [art("1")], { includeUnscheduled: false });
    expect(r.find((x) => x.name === "Awa Traoré")?.communicationTitle).toBe("Stabilité α de uₜ = Δu");
    expect(r.find((x) => x.name === "Pr Ouédraogo")?.communicationTitle).toBe("Plénière sur π");
  });
  it("badges : noms accentués", () => {
    const b = buildBadgesFromSchedule(schedule, [art("1")], { includeUnscheduled: false });
    expect(b.map((x) => x.name)).toContain("Issa Compaoré");
  });
  it("rendu KaTeX à l'écran", () => {
    const html = latexToHtml("Stabilité $\\alpha^2$ & <b>");
    expect(html).toContain("katex");
    expect(html).toContain("&amp; &lt;b&gt;"); // le texte brut est échappé
  });
  it("formule invalide : repli sans plantage", () => {
    expect(() => latexToHtml("$\\frac{1$")).not.toThrow();
  });
});
