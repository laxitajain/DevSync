import { BadRequestException } from "@nestjs/common";
import { clampLimit, decodeCursor, encodeCursor } from "./cursor";

describe("pagination/cursor", () => {
  describe("clampLimit", () => {
    it("falls back to the default when limit is missing or zero", () => {
      expect(clampLimit(undefined)).toBe(20);
      expect(clampLimit(0)).toBe(20);
      expect(clampLimit(undefined, 50)).toBe(50);
    });

    it("clamps to the [1, max] range", () => {
      expect(clampLimit(5)).toBe(5);
      expect(clampLimit(-10)).toBe(1);
      expect(clampLimit(1000)).toBe(100);
      expect(clampLimit(1000, 20, 200)).toBe(200);
    });
  });

  describe("encode/decode round trip", () => {
    it("recovers the original payload", () => {
      const payload = { value: "2026-06-11T00:00:00.000Z", id: "task_123" };
      const cursor = encodeCursor(payload);

      expect(cursor).not.toContain("|");
      expect(decodeCursor(cursor)).toEqual(payload);
    });

    it("keeps the last separator so values containing '|' survive", () => {
      const payload = { value: "a|b|c", id: "id_1" };
      expect(decodeCursor(encodeCursor(payload))).toEqual(payload);
    });
  });

  describe("decodeCursor validation", () => {
    it("rejects a cursor without a separator", () => {
      const bad = Buffer.from("nopipe", "utf8").toString("base64url");
      expect(() => decodeCursor(bad)).toThrow(BadRequestException);
    });

    it("rejects a cursor with an empty id", () => {
      const bad = Buffer.from("value|", "utf8").toString("base64url");
      expect(() => decodeCursor(bad)).toThrow(BadRequestException);
    });
  });
});
