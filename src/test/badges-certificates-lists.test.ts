import { describe, it, expect } from "vitest";
import { buildBadgesFromSchedule } from "@/lib/exportBadges";
import { buildRecipientsFromSchedule } from "@/lib/exportCertificates";
import { getUnscheduledArticles, normalizeName, splitAuthors } from "@/lib/people";
import { addArticle, setArticlesDuration, resetForNewProject, getArticles } from "@/lib/conference";
import type { Article, ConferenceSchedule } from "@/lib/conference";

const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, title: `T${id}`, authors: "Awa Traoré", moderator: "", sessionChair: "", abstract: "",
  category: "Maths", duration: 20, type: "présentielle", status: "accepted", ...over,
});

const schedule = (slotIds: string[], specials: ConferenceSchedule["specialSlots"] = []): ConferenceSchedule => ({
  id: "s", name: "Conf", days: 1, rooms: ["A"], startHour: 8, endHour: 18, breakMinutes: 10,
  slots: slotIds.map((id, i) => ({ articleId: id, room: "A", startTime: `0${8 + i}:00`, endTime: `0${8 + i}:20`, day: 0 })),
  specialSlots: specials, createdAt: new Date(),
});

describe("people helpers", () => {
  it("normalise accents, casse et espaces", () => {
    expect(normalizeName("  Awa  TRAORÉ ")).toBe("awa traore");
  });
  it("découpe sur virgule, et, &", () => {
    expect(splitAuthors("A Dupont et B Sawadogo, C Ouédraogo & D Kaboré")).toHaveLength(4);
  });
});

describe("liste des badges", () => {
  const arts = [art("1"), art("2", { authors: "AWA TRAORE", moderator: "Dr Zongo" }), art("3", { authors: "Issa Compaoré" }), art("4", { status: "rejected", authors: "Rejeté Un" })];
  it("dédoublonne sans tenir compte de casse/accents", () => {
    const b = buildBadgesFromSchedule(schedule(["1", "2"]), arts, { includeUnscheduled: false });
    expect(b.filter((x) => normalizeName(x.name) === "awa traore")).toHaveLength(1);
    expect(b.find((x) => x.name === "Dr Zongo")?.role).toBe("moderator");
  });
  it("inclut les non planifiés (hors rejetés) seulement si demandé", () => {
    const sch = schedule(["1"]);
    expect(getUnscheduledArticles(sch, arts).map((a) => a.id)).toEqual(["2", "3"]);
    expect(buildBadgesFromSchedule(sch, arts, { includeUnscheduled: false }).some((x) => x.name === "Issa Compaoré")).toBe(false);
    const withU = buildBadgesFromSchedule(sch, arts, { includeUnscheduled: true });
    expect(withU.some((x) => x.name === "Issa Compaoré")).toBe(true);
    expect(withU.some((x) => x.name === "Rejeté Un")).toBe(false);
  });
  it("inclut les intervenants de créneaux spéciaux et les organisateurs sans doublon", () => {
    const sch = schedule(["1"], [{ id: "k", title: "Conférence plénière", speaker: "Pr Ilboudo", type: "keynote", room: "all", startTime: "09:00", endTime: "10:00", day: 0 }]);
    const b = buildBadgesFromSchedule(sch, arts, { includeUnscheduled: false, organizers: [{ name: "pr ilboudo" }, { name: "Marie Org", role: "Logistique" }] });
    expect(b.filter((x) => normalizeName(x.name) === "pr ilboudo")).toHaveLength(1);
    expect(b.find((x) => x.name === "Marie Org")?.role).toBe("organizer");
  });
});

describe("liste des attestations", () => {
  it("une attestation par communication, même nom écrit différemment", () => {
    const arts = [art("1"), art("2", { authors: "awa traore", title: "Autre" })];
    const r = buildRecipientsFromSchedule(schedule(["1", "2"]), arts, { includeUnscheduled: false });
    expect(r).toHaveLength(2);
  });
  it("ajoute les non planifiés et le titre du créneau spécial", () => {
    const sch = schedule(["1"], [{ id: "k", title: "Plénière", speaker: "Pr Ilboudo", type: "keynote", room: "all", startTime: "09:00", endTime: "10:00", day: 0 }]);
    const r = buildRecipientsFromSchedule(sch, [art("1"), art("3", { authors: "Issa Compaoré" })]);
    expect(r.some((x) => x.name === "Issa Compaoré")).toBe(true);
    expect(r.find((x) => x.name === "Pr Ilboudo")?.communicationTitle).toBe("Plénière");
  });
});

describe("durée globale", () => {
  it("applique à tous / par type / par thématique, borné à 5–120", () => {
    resetForNewProject();
    addArticle({ ...art("x"), id: undefined } as never);
    addArticle({ ...art("y", { type: "en ligne", category: "Info" }), id: undefined } as never);
    expect(setArticlesDuration({ kind: "all" }, 15)).toBe(2);
    expect(getArticles().every((a) => a.duration === 15)).toBe(true);
    expect(setArticlesDuration({ kind: "type", value: "en ligne" }, 10)).toBe(1);
    expect(setArticlesDuration({ kind: "category", value: "Maths" }, 500)).toBe(1);
    expect(getArticles().find((a) => a.category === "Maths")?.duration).toBe(120);
    expect(setArticlesDuration({ kind: "all" }, 1)).toBeGreaterThan(0);
    expect(getArticles().every((a) => a.duration === 5)).toBe(true);
  });
  it("resetForNewProject vide tout", () => {
    resetForNewProject();
    expect(getArticles()).toHaveLength(0);
  });
});
