import { describe, expect, it } from "vitest";

import {
  applyStressLevel,
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
});
