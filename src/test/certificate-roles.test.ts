import { describe, it, expect } from "vitest";
import { buildRecipientsFromSchedule, certificateFileNames } from "@/lib/exportCertificates";
import type { Article, ConferenceSchedule } from "@/lib/conference";

const art = (id: string, over: Partial<Article> = {}): Article => ({
  id, title: `Titre ${id}`, authors: "Awa Traoré", moderator: "Issa Compaoré", sessionChair: "Pr Ilboudo", rapporteurs: "Dr Sawadogo et Dr Zongo",
  abstract: "", category: "Maths", duration: 20, type: "présentielle", status: "accepted", ...over,
});
const schedule: ConferenceSchedule = {
  id: "s", name: "Conf", days: 1, rooms: ["A"], startHour: 8, endHour: 18, breakMinutes: 10,
  slots: [
    { articleId: "1", room: "A", startTime: "08:00", endTime: "08:20", day: 0 },
    { articleId: "2", room: "A", startTime: "08:20", endTime: "08:40", day: 0 },
  ],
  specialSlots: [], createdAt: new Date(),
};
const arts = [art("1"), art("2")];

describe("attestations : rôles multiples", () => {
  const r = buildRecipientsFromSchedule(schedule, arts, { includeUnscheduled: false, organizers: [
    { name: "Awa Traoré", role: "Présidente du comité" },   // déjà auteur
    { name: "Issa Compaoré" },                              // déjà modérateur
    { name: "Marie Kaboré" },
  ] });
  it("un organisateur déjà auteur / modérateur reçoit AUSSI son attestation d'organisateur", () => {
    expect(r.filter((x) => x.role === "organizer").map((x) => x.name).sort()).toEqual(["Awa Traoré", "Issa Compaoré", "Marie Kaboré"]);
    expect(r.filter((x) => x.name === "Awa Traoré").map((x) => x.role).sort()).toEqual(["organizer", "speaker", "speaker"]);
  });
  it("rapporteurs : une attestation par personne", () => {
    expect(r.filter((x) => x.role === "rapporteur").map((x) => x.name).sort()).toEqual(["Dr Sawadogo", "Dr Zongo"]);
  });
  it("présidents et modérateurs dédoublonnés", () => {
    expect(r.filter((x) => x.role === "chair")).toHaveLength(1);
    expect(r.filter((x) => x.role === "moderator")).toHaveLength(1);
  });
  it("noms de fichiers attestation-nom-prenom-role, uniques", () => {
    const names = certificateFileNames(r);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toContain("attestation-marie-kabore-organisateur");
    expect(names).toContain("attestation-issa-compaore-moderateur");
    expect(names).toContain("attestation-pr-ilboudo-president");
    expect(names).toContain("attestation-dr-zongo-rapporteur");
    // deux communications du même auteur : le titre départage
    expect(names.filter((n) => n.startsWith("attestation-awa-traore-auteur"))).toHaveLength(2);
  });
});

describe("attestations : personnes enregistrées dans les listes", () => {
  it("présidents / rapporteurs / modérateurs des listes reçoivent une attestation sans communication", () => {
    const r = buildRecipientsFromSchedule({ ...schedule, slots: [] }, [], {
      includeUnscheduled: false,
      moderators: ["Dr Modo"],
      sessionChairs: ["Pr Un", "Pr Deux"],
      rapporteurs: ["Dr Rap"],
    });
    expect(r.map((x) => `${x.role}:${x.name}`).sort()).toEqual([
      "chair:Pr Deux", "chair:Pr Un", "moderator:Dr Modo", "rapporteur:Dr Rap",
    ]);
  });
  it("pas de doublon avec ceux déjà rattachés à une séance", () => {
    const r = buildRecipientsFromSchedule(schedule, arts, { includeUnscheduled: false, sessionChairs: ["Pr Ilboudo", "Pr Nouveau"] });
    expect(r.filter((x) => x.role === "chair").map((x) => x.name).sort()).toEqual(["Pr Ilboudo", "Pr Nouveau"]);
  });
});
