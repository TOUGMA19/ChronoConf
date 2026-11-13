import { describe, it, expect } from "vitest";
import { swapRole } from "@/lib/people";

describe("permutation de rôles", () => {
  it("échange les deux rôles et laisse les autres intacts", () => {
    expect(swapRole("speaker", "speaker", "participant")).toBe("participant");
    expect(swapRole("participant", "speaker", "participant")).toBe("speaker");
    expect(swapRole("moderator", "speaker", "participant")).toBe("moderator");
  });
  it("est involutive (deux permutations = état initial)", () => {
    const roles = ["speaker", "participant", "chair", "organizer"] as const;
    for (const r of roles) {
      expect(swapRole(swapRole(r, "speaker", "participant"), "speaker", "participant")).toBe(r);
    }
  });
  it("ne fait rien si les deux rôles sont identiques", () => {
    expect(swapRole("speaker", "speaker", "speaker")).toBe("speaker");
  });
});
