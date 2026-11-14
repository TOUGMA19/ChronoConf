import { it, expect } from "vitest";
import fs from "node:fs";
import jsPDF from "jspdf";
import { exportBadgesPDF } from "@/lib/exportBadges";
import type { ConferenceSchedule } from "@/lib/conference";

const schedule = { id: "s", name: "Conférence", days: 1, rooms: ["A"], startHour: 8, endHour: 18, breakMinutes: 10, slots: [], specialSlots: [], createdAt: new Date() } as ConferenceSchedule;

it("badges vierges : lignes d'écriture, sans QR, sans plantage", async () => {
  let saved = 0;
  (jsPDF as any).API.save = function () { saved++; fs.writeFileSync("/tmp/blank.pdf", Buffer.from(this.output("arraybuffer"))); };
  await exportBadgesPDF(schedule, [
    { name: "", role: "participant", blank: true },
    { name: "", role: "participant", blank: true },
    { name: "Awa Traoré", role: "speaker" },
  ], { showQrCode: true });
  expect(saved).toBe(1);
});
