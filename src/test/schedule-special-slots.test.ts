import { describe, it, expect, beforeEach } from "vitest";
import {
  addArticle,
  addCategory,
  generateScheduleLocally,
  setSchedule,
  getArticles,
  clearAllData,
  Article,
  ConferenceSchedule,
} from "../lib/conference";

describe("generateScheduleLocally respects special slots", () => {
  beforeEach(() => {
    clearAllData();
  });

  it("should not place articles during a special slot time", () => {
    addCategory("IA");

    // Add 3 articles of 20 min each
    const a1 = addArticle({ title: "A1", authors: "X", moderator: "", sessionChair: "", abstract: "", category: "IA", duration: 20, type: "oral", status: "accepted" });
    const a2 = addArticle({ title: "A2", authors: "Y", moderator: "", sessionChair: "", abstract: "", category: "IA", duration: 20, type: "oral", status: "accepted" });
    const a3 = addArticle({ title: "A3", authors: "Z", moderator: "", sessionChair: "", abstract: "", category: "IA", duration: 20, type: "oral", status: "accepted" });

    // Set a schedule with a special slot (keynote) from 08:00-09:00 in all rooms on day 0
    const baseSchedule: ConferenceSchedule = {
      id: "test",
      name: "Test",
      days: 1,
      rooms: ["Salle A"],
      startHour: 8,
      endHour: 18,
      breakMinutes: 5,
      slots: [],
      specialSlots: [
        {
          id: "sp_1",
          title: "Keynote d'ouverture",
          type: "keynote",
          room: "all",
          startTime: "08:00",
          endTime: "09:00",
          day: 0,
        },
      ],
      createdAt: new Date(),
    };
    setSchedule(baseSchedule);

    const result = generateScheduleLocally(getArticles(), {
      name: "Test",
      days: 1,
      rooms: ["Salle A"],
      startHour: 8,
      endHour: 18,
      breakMinutes: 5,
    });

    // All articles should start at or after 09:00 (540 min)
    for (const slot of result.slots) {
      const [h, m] = slot.startTime.split(":").map(Number);
      const startMin = h * 60 + m;
      expect(startMin).toBeGreaterThanOrEqual(540); // 09:00
    }

    // First article should start exactly at 09:00
    const sorted = [...result.slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    expect(sorted[0].startTime).toBe("09:00");
  });

  it("should skip a room-specific special slot", () => {
    addCategory("IA");

    const a1 = addArticle({ title: "A1", authors: "X", moderator: "", sessionChair: "", abstract: "", category: "IA", duration: 30, type: "oral", status: "accepted" });

    const baseSchedule: ConferenceSchedule = {
      id: "test",
      name: "Test",
      days: 1,
      rooms: ["Salle A", "Salle B"],
      startHour: 8,
      endHour: 18,
      breakMinutes: 5,
      slots: [],
      specialSlots: [
        {
          id: "sp_2",
          title: "Pause café",
          type: "break",
          room: "Salle A",
          startTime: "08:00",
          endTime: "08:30",
          day: 0,
        },
      ],
      createdAt: new Date(),
    };
    setSchedule(baseSchedule);

    const result = generateScheduleLocally(getArticles(), {
      name: "Test",
      days: 1,
      rooms: ["Salle A", "Salle B"],
      startHour: 8,
      endHour: 18,
      breakMinutes: 5,
    });

    // Article should be placed in Salle B at 08:00 (since only Salle A is blocked)
    // OR in Salle A at 08:30
    const slot = result.slots[0];
    if (slot.room === "Salle A") {
      const [h, m] = slot.startTime.split(":").map(Number);
      expect(h * 60 + m).toBeGreaterThanOrEqual(510); // 08:30
    } else {
      expect(slot.room).toBe("Salle B");
      expect(slot.startTime).toBe("08:00");
    }
  });
});
