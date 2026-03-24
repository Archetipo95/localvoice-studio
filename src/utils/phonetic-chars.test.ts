import { describe, expect, it } from "vitest";

import { getAllPhoneticChars, getPhoneticCharGroups, toPhoneticCharKind } from "./phonetic-chars";

describe("phonetic char menu data", () => {
  it("builds browser-safe kinds from unicode codepoints", () => {
    expect(toPhoneticCharKind("ə")).toBe("phoneticChar_259");
    expect(toPhoneticCharKind("t͡ʃ")).toBe("phoneticChar_74_361_283");
  });

  it("returns grouped menu items for IPA suggestions", () => {
    const groups = getPhoneticCharGroups();
    expect(groups[0]?.[0]).toEqual({ type: "label", label: "Stress and Timing" });
    expect(groups.some((group) => group.some((item) => "char" in item && item.char === "ə"))).toBe(
      true,
    );
    expect(groups.some((group) => group.some((item) => "char" in item && item.char === "ŋ"))).toBe(
      true,
    );
  });

  it("returns a flat list of selectable phonetic symbols", () => {
    const items = getAllPhoneticChars();
    expect(items.some((item) => item.char === "ˈ")).toBe(true);
    expect(items.some((item) => item.char === "ː")).toBe(true);
    expect(items.some((item) => item.char === "ʃ")).toBe(true);
    expect(items.some((item) => item.char === "̃")).toBe(true);
  });
});
