// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationHistoryItem, PersistedGenerationHistoryItem } from "../types";
import {
  clearPersistedGenerationHistory,
  loadPersistedGenerationHistory,
  normalizeGenerationHistory,
  persistGenerationHistory,
} from "./generation-history";

function createHistoryItem(overrides: Partial<GenerationHistoryItem> = {}): GenerationHistoryItem {
  return {
    id: "history-1",
    createdAt: 1,
    sizeBytes: 1_572_864,
    durationMs: 10,
    textLength: 3,
    textPreview: "abc",
    voice: "af_heart",
    secondaryVoice: "__none__",
    secondaryRatio: 0,
    speed: 1,
    pitchSemitones: 0,
    sentencePauseMs: 100,
    newlinePauseMs: 150,
    paragraphPauseMs: 250,
    fileName: "sample.wav",
    audioUrl: "blob:sample",
    cacheKey: "history:sample",
    ...overrides,
  };
}

describe("generation-history", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("normalizes generation history by filtering empty URLs and sorting newest-first", () => {
    const normalized = normalizeGenerationHistory([
      createHistoryItem({ id: "1", createdAt: 100, audioUrl: "blob:1", cacheKey: "history:1" }),
      createHistoryItem({ id: "2", createdAt: 200, audioUrl: "", cacheKey: "history:2" }),
      createHistoryItem({ id: "3", createdAt: 300, audioUrl: "blob:3", cacheKey: "history:3" }),
    ]);

    expect(normalized.map((item) => item.id)).toEqual(["3", "1"]);
  });

  it("loads persisted generation history and filters invalid items", () => {
    const validItem: PersistedGenerationHistoryItem = {
      id: "ok",
      createdAt: 1,
      sizeBytes: 1_024,
      durationMs: 2,
      textLength: 3,
      textPreview: "abc",
      voice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 100,
      newlinePauseMs: 150,
      paragraphPauseMs: 250,
      fileName: "ok.wav",
      cacheKey: "history:ok",
    };

    window.localStorage.setItem(
      "kokoro-generation-history:v1",
      JSON.stringify([validItem, { id: "bad", createdAt: "nope" }]),
    );

    const loaded = loadPersistedGenerationHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.id).toBe("ok");
    expect(loaded[0]?.sizeBytes).toBe(1_024);

    window.localStorage.setItem(
      "kokoro-generation-history:v1",
      JSON.stringify([{ ...validItem, id: "legacy", sizeBytes: undefined }]),
    );
    expect(loadPersistedGenerationHistory()[0]?.id).toBe("legacy");

    window.localStorage.setItem("kokoro-generation-history:v1", "{not-json");
    expect(loadPersistedGenerationHistory()).toEqual([]);
  });

  it("persists and clears generation history while tolerating storage errors", () => {
    const historyItems: GenerationHistoryItem[] = [
      createHistoryItem({
        id: "h1",
        createdAt: 5,
        fileName: "h1.wav",
        audioUrl: "blob:h1",
        cacheKey: "history:h1",
      }),
    ];

    persistGenerationHistory(historyItems);
    const persisted = window.localStorage.getItem("kokoro-generation-history:v1") || "";
    expect(persisted).toContain("history:h1");
    expect(persisted).toContain('"sizeBytes":1572864');
    expect(persisted).not.toContain("audioUrl");
    expect(persisted).not.toContain('"export"');

    const setItemSpy = vi
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementationOnce(() => {
        throw new Error("quota");
      });
    expect(() => persistGenerationHistory(historyItems)).not.toThrow();
    setItemSpy.mockRestore();

    clearPersistedGenerationHistory();
    expect(window.localStorage.getItem("kokoro-generation-history:v1")).toBeNull();

    const removeSpy = vi
      .spyOn(window.localStorage.__proto__, "removeItem")
      .mockImplementationOnce(() => {
        throw new Error("blocked");
      });
    expect(() => clearPersistedGenerationHistory()).not.toThrow();
    removeSpy.mockRestore();
  });
});
