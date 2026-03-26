import { describe, expect, it } from "vitest";
import { normalizeDownloadName, resolveOutputFileName } from "./useFilenameTemplate";

describe("useFilenameTemplate", () => {
  const fixedLocalTimestamp = new Date(2026, 2, 26, 14, 4, 5).getTime();

  it("normalizes names and adds a wav extension", () => {
    expect(normalizeDownloadName(" My file name?.mp3 ")).toBe("My-file-name-.mp3.wav");
    expect(normalizeDownloadName("already.wav")).toBe("already.wav");
    expect(normalizeDownloadName("___")).toBe("localvoice-audio.wav");
  });

  it("limits the normalized file name length", () => {
    const longName = "voice-" + "a".repeat(100);
    expect(normalizeDownloadName(longName)).toHaveLength(84);
  });

  it("builds the default output file name with sanitized voice and timestamp tokens", () => {
    const result = resolveOutputFileName("bf emma/bright", fixedLocalTimestamp);
    expect(result).toBe("localvoice-bf-emma-bright-20260326-140405.wav");
  });

  it("falls back to a generic voice token when the voice name is empty", () => {
    const result = resolveOutputFileName("", fixedLocalTimestamp);
    expect(result).toBe("localvoice-voice-20260326-140405.wav");
  });
});
