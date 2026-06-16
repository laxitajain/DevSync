import { createHash } from "crypto";
import { generateToken, hashToken } from "./tokens";

describe("crypto/tokens", () => {
  describe("generateToken", () => {
    it("produces a hex string of the requested byte length", () => {
      expect(generateToken(16)).toMatch(/^[0-9a-f]{32}$/);
      expect(generateToken()).toHaveLength(96);
    });

    it("is unpredictable across calls", () => {
      const tokens = new Set(Array.from({ length: 100 }, () => generateToken()));
      expect(tokens.size).toBe(100);
    });
  });

  describe("hashToken", () => {
    it("is a deterministic SHA-256 of the input", () => {
      const token = "secret-token";
      const expected = createHash("sha256").update(token).digest("hex");

      expect(hashToken(token)).toBe(expected);
      expect(hashToken(token)).toBe(hashToken(token));
    });

    it("never returns the raw token (only the hash is persisted)", () => {
      const token = generateToken();
      expect(hashToken(token)).not.toBe(token);
    });
  });
});
