import { describe, expect, it } from "vitest";
import { newClaimToken } from "./service";

describe("newClaimToken", () => {
  it("is URL-safe (base64url — no +, /, or =)", () => {
    for (let i = 0; i < 50; i++) {
      const t = newClaimToken();
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("is long enough to be unguessable and unique across draws", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i++) {
      const t = newClaimToken();
      expect(t.length).toBeGreaterThanOrEqual(24);
      expect(seen.has(t)).toBe(false);
      seen.add(t);
    }
  });
});
