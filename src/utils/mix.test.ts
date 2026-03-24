import { describe, expect, it } from "vitest";

import { NO_BLEND_VOICE, blendRatioParts, buildVoiceMix } from "./mix";

describe("voice mixing helpers", () => {
  it("builds the old weighted voice string", () => {
    const mix = buildVoiceMix("af_heart", "am_michael", 25);
    expect(mix.split(",").filter((x) => x === "af_heart")).toHaveLength(15);
    expect(mix.split(",").filter((x) => x === "am_michael")).toHaveLength(5);
  });

  it("treats none as no blend", () => {
    expect(buildVoiceMix("af_heart", NO_BLEND_VOICE, 10)).toBe("af_heart");
  });

  it("returns the primary voice when the ratio is non-positive or the voices match", () => {
    expect(buildVoiceMix(" af_heart ", "am_michael", 0)).toBe("af_heart");
    expect(buildVoiceMix("af_heart", "af_heart", 50)).toBe("af_heart");
  });

  it("returns the secondary voice when the ratio is fully blended", () => {
    expect(buildVoiceMix("af_heart", "am_michael", 100)).toBe("am_michael");
  });

  it("returns an empty string when there is no primary voice", () => {
    expect(buildVoiceMix("  ", "am_michael", 50)).toBe("");
    expect(buildVoiceMix(undefined as unknown as string, undefined as unknown as string, 50)).toBe(
      "",
    );
  });

  it("clamps ratio parts", () => {
    expect(blendRatioParts(0)).toEqual({ primaryParts: 20, secondaryParts: 0 });
    expect(blendRatioParts(100)).toEqual({ primaryParts: 0, secondaryParts: 20 });
    expect(blendRatioParts(12)).toEqual({ primaryParts: 18, secondaryParts: 2 });
    expect(blendRatioParts(-4)).toEqual({ primaryParts: 20, secondaryParts: 0 });
  });
});
