import { it, expect, vi } from "vitest";
import JSZip from "jszip";

const saved: { blob?: Blob; name?: string }[] = [];
vi.mock("file-saver", () => ({ saveAs: (blob: Blob, name: string) => { saved.push({ blob, name }); } }));

import { exportCertificatesPDFZip } from "@/lib/exportCertificates";

it("PDF individuels : un fichier par personne, nommé attestation-nom-prenom-role.pdf", async () => {
  await exportCertificatesPDFZip(
    [
      { name: "Marie Kaboré", role: "organizer" },
      { name: "Marie Kaboré", role: "speaker", communicationTitle: "Un titre" },
      { name: "Dr Zongo", role: "rapporteur" },
    ],
    { conferenceName: "Conf", eventDate: "1 mai", eventLocation: "Ouaga", templateId: "classic-blue", showRole: true } as never,
  );
  expect(saved[0].name).toBe("attestations-conf.zip");
  const zip = await JSZip.loadAsync(saved[0].blob as Blob);
  expect(Object.keys(zip.files).sort()).toEqual([
    "attestation-dr-zongo-rapporteur.pdf",
    "attestation-marie-kabore-auteur.pdf",
    "attestation-marie-kabore-organisateur.pdf",
  ]);
});
