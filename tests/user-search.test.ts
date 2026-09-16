import { describe, expect, it } from "vitest";
import { buildUserSearchPattern } from "@/app/lib/user-search";

describe("buildUserSearchPattern", () => {
  it("no consulta la base si hay menos de dos caracteres", () => {
    expect(buildUserSearchPattern("")).toBeNull();
    expect(buildUserSearchPattern(" a ")).toBeNull();
  });

  it("arma un contains ILIKE y escapa comodines", () => {
    expect(buildUserSearchPattern(" Ana ")).toBe("%Ana%");
    expect(buildUserSearchPattern("100%_off")).toBe("%100\\%\\_off%");
  });
});
