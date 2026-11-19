import { describe, it, expect } from "vitest";
import { buildBadgesFromSchedule } from "@/lib/exportBadges";
import { addScientificMember, getScientificCommittee, removeScientificMember, resetForNewProject } from "@/lib/conference";
import type { ConferenceSchedule } from "@/lib/conference";

const schedule = { id: "s", name: "C", days: 1, rooms: ["A"], startHour: 8, endHour: 18, breakMinutes: 10, slots: [], specialSlots: [], createdAt: new Date() } as ConferenceSchedule;

describe("comité scientifique (badges et stockage)", () => {
  it("badge « Comité scientifique » pour un membre inconnu du programme", () => {
    const b = buildBadgesFromSchedule(schedule, [], { includeUnscheduled: false, scientificCommittee: [{ name: "Pr Zida", role: "Membre" }] });
    expect(b).toEqual([{ name: "Pr Zida", role: "scientific", affiliation: "Membre" }]);
  });
  it("ajout / doublon / suppression", () => {
    resetForNewProject();
    expect(addScientificMember("Pr Zida", "Président")).toBe(true);
    expect(addScientificMember("pr zida", "")).toBe(false);
    expect(getScientificCommittee()).toEqual([{ name: "Pr Zida", role: "Président" }]);
    removeScientificMember("Pr Zida");
    expect(getScientificCommittee()).toEqual([]);
  });
});
