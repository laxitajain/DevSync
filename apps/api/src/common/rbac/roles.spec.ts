import { ROLE_RANK, hasAtLeast, outranks } from "./roles";

describe("rbac/roles", () => {
  it("ranks roles from OWNER (highest) to VIEWER (lowest)", () => {
    expect(ROLE_RANK.OWNER).toBeGreaterThan(ROLE_RANK.ADMIN);
    expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.MEMBER);
    expect(ROLE_RANK.MEMBER).toBeGreaterThan(ROLE_RANK.VIEWER);
  });

  describe("hasAtLeast", () => {
    it("is true when the role meets or exceeds the minimum", () => {
      expect(hasAtLeast("ADMIN", "MEMBER")).toBe(true);
      expect(hasAtLeast("MEMBER", "MEMBER")).toBe(true);
      expect(hasAtLeast("OWNER", "VIEWER")).toBe(true);
    });

    it("is false when the role is below the minimum", () => {
      expect(hasAtLeast("VIEWER", "MEMBER")).toBe(false);
      expect(hasAtLeast("MEMBER", "ADMIN")).toBe(false);
    });
  });

  describe("outranks", () => {
    it("requires strictly higher privilege", () => {
      expect(outranks("OWNER", "ADMIN")).toBe(true);
      expect(outranks("ADMIN", "MEMBER")).toBe(true);
    });

    it("is false for equal or lower roles (you cannot manage a peer)", () => {
      expect(outranks("ADMIN", "ADMIN")).toBe(false);
      expect(outranks("MEMBER", "ADMIN")).toBe(false);
    });
  });
});
