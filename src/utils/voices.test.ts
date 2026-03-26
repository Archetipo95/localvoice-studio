import { describe, expect, it } from "vitest";

import {
  formatVoiceLabel,
  sortVoicesByGrade,
  splitVoicesByGender,
  voiceDisplayGender,
  voiceDisplayName,
  voiceLocaleFlag,
} from "./voices";

describe("sortVoicesByGrade", () => {
  it("orders higher grades first", () => {
    const sorted = sortVoicesByGrade([
      { id: "b", label: "Voice B", overallGrade: "B" },
      { id: "a-plus", label: "Voice A+", overallGrade: " A+ " },
      { id: "a", label: "Voice A", overallGrade: "A" },
      { id: "unknown", label: "Voice Unknown" },
    ]);

    expect(sorted.map((voice) => voice.id)).toEqual(["a-plus", "a", "b", "unknown"]);
  });

  it("breaks ties alphabetically when grades match", () => {
    const sorted = sortVoicesByGrade([
      { id: "second", label: "Zulu", overallGrade: "C" },
      { id: "first", label: "Alpha", overallGrade: "c" },
      { id: "unknown-grade", label: "Omega", overallGrade: "??" },
    ]);

    expect(sorted.map((voice) => voice.id)).toEqual(["first", "second", "unknown-grade"]);
  });

  it("splits voices by explicit gender, id prefixes, and unknown values", () => {
    const grouped = splitVoicesByGender([
      { id: "custom-f", label: "Custom F", gender: " Female " },
      { id: "custom-m", label: "Custom M", gender: "male" },
      { id: "af_heart", label: "Heart" },
      { id: "bm_lewis", label: "Lewis" },
      { id: "zz_misc", label: "Misc" },
    ]);

    expect(grouped.female.map((voice) => voice.id)).toEqual(["custom-f", "af_heart"]);
    expect(grouped.male.map((voice) => voice.id)).toEqual(["custom-m", "bm_lewis"]);
    expect(grouped.other.map((voice) => voice.id)).toEqual(["zz_misc"]);
  });

  it("maps American and British Kokoro voices to flags", () => {
    expect(voiceLocaleFlag({ id: "af_heart", label: "Heart" })).toBe("🇺🇸");
    expect(voiceLocaleFlag({ id: "bm_lewis", label: "Lewis" })).toBe("🇬🇧");
    expect(voiceLocaleFlag({ id: "zz_misc", label: "Misc" })).toBe("");
  });

  it("prefixes formatted labels with locale flags when available", () => {
    expect(formatVoiceLabel({ id: "af_heart", label: "af_heart · Heart" })).toBe(
      "🇺🇸 Heart · Female",
    );
    expect(
      formatVoiceLabel({ id: "bf_emma", label: "Emma", gender: "female", overallGrade: "A" }),
    ).toBe("🇬🇧 Emma · Female · A");
    expect(formatVoiceLabel({ id: "zz_misc", label: "Misc" })).toBe("Misc");
  });

  it("derives a clean display name and gender without exposing raw ids", () => {
    expect(voiceDisplayName({ id: "af_heart", label: "af_heart · Heart" })).toBe("Heart");
    expect(voiceDisplayName({ id: "bf_emma", label: "Emma" })).toBe("Emma");
    expect(voiceDisplayName({ id: "voice_only", label: "" })).toBe("voice_only");
    expect(voiceDisplayName({ id: "id_label", label: "id_label ·" })).toBe("id_label");
    expect(voiceDisplayGender({ id: "af_heart", label: "Heart" })).toBe("Female");
    expect(voiceDisplayGender({ id: "bm_lewis", label: "Lewis" })).toBe("Male");
    expect(voiceDisplayGender({ id: "xx_misc", label: "Misc", gender: " non-binary " })).toBe(
      "non-binary",
    );
    expect(voiceDisplayGender({ id: "if_custom", label: "Custom" })).toBe("Female");
    expect(voiceDisplayGender({ id: "im_custom", label: "Custom" })).toBe("Male");
  });
});
