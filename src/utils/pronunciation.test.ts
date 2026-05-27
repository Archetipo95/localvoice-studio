import { describe, expect, it } from "vitest";

import {
  applyStressLevel,
  assertPhonemizableSegments,
  findPronunciationMarkupTokens,
  hasSpeechMarkup,
  parseSpeechMarkup,
  stripSpeechMarkup,
} from "./pronunciation";

describe("speech markup helpers", () => {
  it("parses plain text, stress annotations, and phoneme overrides", () => {
    expect(
      parseSpeechMarkup(
        "Leave it [better](+1) with [stewardship](/stjuːɚdʃɪp/) [pause here](break:500).",
      ),
    ).toEqual([
      { type: "text", value: "Leave it " },
      { type: "stress", label: "better", value: "better", level: 1 },
      { type: "text", value: " with " },
      { type: "phoneme", label: "stewardship", value: "stjuːɚdʃɪp" },
      { type: "text", value: " " },
      { type: "break", label: "pause here", value: "pause here", pauseMs: 500 },
      { type: "text", value: "." },
    ]);
  });

  it("detects whether a string contains speech markup", () => {
    expect(hasSpeechMarkup("No annotations here.")).toBe(false);
    expect(hasSpeechMarkup("Use [better](+1) here.")).toBe(true);
    expect(hasSpeechMarkup("Then [again](+1) here.")).toBe(true);
  });

  it("strips speech markup back to readable plain text", () => {
    expect(
      stripSpeechMarkup(
        "Leave it [better](+1) with [stewardship](/stjuːɚdʃɪp/) [pause here](break:500).",
      ),
    ).toBe("Leave it better with stewardship pause here.");
  });

  it("raises or lowers stress markers conservatively", () => {
    expect(applyStressLevel("bɛtɚ", 1)).toBe("bˈɛtɚ");
    expect(applyStressLevel("bˌɛtɚ", 1)).toBe("bˈɛtɚ");
    expect(applyStressLevel("stˈjuːɚdʃɪp", -1)).toBe("stˌjuːɚdʃɪp");
    expect(applyStressLevel("stˈjuːɚdʃɪp", -2)).toBe("stjuːɚdʃɪp");
  });

  it("returns plain text when no markup exists", () => {
    expect(parseSpeechMarkup("Nothing special here.")).toEqual([
      { type: "text", value: "Nothing special here." },
    ]);
  });

  it("parses markup without surrounding text segments", () => {
    expect(parseSpeechMarkup("[better](+1)")).toEqual([
      { type: "stress", label: "better", value: "better", level: 1 },
    ]);
  });

  it("keeps lowering from secondary stress and leaves unstressed phonemes untouched", () => {
    expect(applyStressLevel("stˌjuːɚdʃɪp", -1)).toBe("stjuːɚdʃɪp");
    expect(applyStressLevel("aˌbˈc", -1)).toBe("abˈc");
    expect(applyStressLevel("plain", -1)).toBe("plain");
  });

  it("preserves primary stress and inserts it before the first vowel when needed", () => {
    expect(applyStressLevel("ˈbɛtɚ", 2)).toBe("ˈbɛtɚ");
    expect(applyStressLevel("stewardship", 2)).toBe("stˈewardship");
    expect(applyStressLevel("rhythm", 1)).toBe("rhˈythm");
    expect(applyStressLevel("tsk", 1)).toBe("ˈtsk");
    expect(applyStressLevel("", 1)).toBe("");
  });

  it("finds only pronunciation markup tokens with source positions", () => {
    expect(
      findPronunciationMarkupTokens(
        "Use [stewardship](/stjuːɚdʃɪp/) but not [pause here](break:500) or [better](+1).",
      ),
    ).toEqual([
      {
        label: "stewardship",
        phonemes: "stjuːɚdʃɪp",
        markup: "[stewardship](/stjuːɚdʃɪp/)",
        from: 4,
        to: 31,
      },
    ]);
  });

  it("supports empty labels in speech markup tokens", () => {
    expect(parseSpeechMarkup("Before [](break:500)[](+1)[](/aɪ/).")).toEqual([
      { type: "text", value: "Before " },
      { type: "break", label: "", value: "", pauseMs: 500 },
      { type: "stress", label: "", value: "", level: 1 },
      { type: "phoneme", label: "", value: "aɪ" },
      { type: "text", value: "." },
    ]);

    expect(hasSpeechMarkup("[](break:500)")).toBe(true);
    expect(findPronunciationMarkupTokens("[](/aɪ/)")).toEqual([
      {
        label: "",
        phonemes: "aɪ",
        markup: "[](/aɪ/)",
        from: 0,
        to: 8,
      },
    ]);
  });

  it("accepts segment lists without break markup as phonemizable", () => {
    const segments = parseSpeechMarkup("Use [stewardship](/stjuːɚdʃɪp/) wisely.");
    expect(() => assertPhonemizableSegments(segments)).not.toThrow();
  });

  it("throws when break segments reach phonemization", () => {
    const segments = parseSpeechMarkup("Hold [pause](break:500) then go.");
    expect(() => assertPhonemizableSegments(segments)).toThrow(/break segment/);
  });
});
