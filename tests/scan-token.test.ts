import { describe, expect, it } from "vitest";
import { extractScanToken } from "@/app/lib/scan-token";

describe("extractScanToken", () => {
  it("devuelve el token crudo y el que viene en una URL de /scan", () => {
    expect(extractScanToken("  abc.def  ")).toBe("abc.def");
    expect(extractScanToken("/scan?t=from-path")).toBe("from-path");
    expect(extractScanToken("https://lyfter.example/scan?t=from-url")).toBe("from-url");
  });

  it("deja el texto intacto cuando no es un link de /scan", () => {
    expect(extractScanToken("https://example.com/other?t=nope")).toBe("https://example.com/other?t=nope");
  });
});
