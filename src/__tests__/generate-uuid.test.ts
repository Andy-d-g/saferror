import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { generateUUID } from "../generate-uuid";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("generateUUID", () => {
  it("should return a valid UUID v4", () => {
    expect(generateUUID()).toMatch(UUID_REGEX);
  });

  it("should return unique values", () => {
    const a = generateUUID();
    const b = generateUUID();
    expect(a).not.toBe(b);
  });

  describe("fallback when crypto.randomUUID is unavailable", () => {
    let savedRandomUUID: typeof crypto.randomUUID;

    beforeEach(() => {
      savedRandomUUID = crypto.randomUUID;
      (crypto as unknown as Record<string, unknown>).randomUUID = undefined;
    });

    afterEach(() => {
      crypto.randomUUID = savedRandomUUID;
    });

    it("should return a valid UUID v4", () => {
      expect(generateUUID()).toMatch(UUID_REGEX);
    });

    it("should return unique values", () => {
      const a = generateUUID();
      const b = generateUUID();
      expect(a).not.toBe(b);
    });

    it("should set version bits to 4", () => {
      const uuid = generateUUID();
      expect(uuid[14]).toBe("4");
    });

    it("should set variant bits correctly", () => {
      const uuid = generateUUID();
      expect(["8", "9", "a", "b"]).toContain(uuid[19]);
    });
  });
});
