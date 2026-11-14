import { it, expect } from "vitest";
import fs from "node:fs";
import jsPDF from "jspdf";
import { exportBadgesPDF, buildQrPayload } from "@/lib/exportBadges";
import type { ConferenceSchedule } from "@/lib/conference";

const schedule = { id: "s", name: "Conférence", days: 1, rooms: ["A"], startHour: 8, endHour: 18, breakMinutes: 10, slots: [], specialSlots: [], createdAt: new Date() } as ConferenceSchedule;

it("badges vierges : QR (lien de base ou conférence), lignes sans légende", async () => {
  expect(buildQrPayload({ name: "", role: "participant", blank: true }, "Conf", { qrBaseUrl: "https://x.org/p/" })).toBe("https://x.org/p/");
  expect(buildQrPayload({ name: "", role: "participant", blank: true }, "Conf", {})).toBe("Conf (Participant)");
  expect(buildQrPayload({ name: "Awa Traoré", role: "speaker" }, "Conf", { qrBaseUrl: "https://x.org/p/" })).toBe("https://x.org/p/awa-traore");
  let saved = 0;
  (jsPDF as any).API.save = function () { saved++; fs.writeFileSync("/tmp/blank.pdf", Buffer.from(this.output("arraybuffer"))); };
  await exportBadgesPDF(schedule, [
    { name: "", role: "participant", blank: true },
    { name: "", role: "organizer", blank: true },
    { name: "Dr Kaboré", role: "moderator", affiliation: "Analyse numérique" },
    { name: "Pr Ilboudo", role: "speaker", affiliation: "Analyse numérique" },
  ], { showQrCode: true, hideThemeRoles: ["moderator"] });
  expect(saved).toBe(1);
});
