// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportMetadata, GenerationHistoryItem } from "../types";
import { normalizeGenerationHistory, persistGenerationHistory } from "../utils/generation-history";
import { revokeBlobUrl } from "./usePreviewCache";
import {
  appendHistoryItem,
  clearGenerationHistory,
  clearLatestOutput,
  DEFAULT_OUTPUT_SAMPLE_RATE,
  generationHistory,
  hydrateGenerationHistoryFromCache,
  isHistoryAudioUrl,
  latestExportMetadata,
  latestOutputHz,
  latestOutputSamples,
  persistHistoryAudioToCache,
  renameHistoryOutput,
  removeHistoryOutput,
  setLatestOutput,
} from "./useGenerationHistory";

function createCacheResponse(blob: Blob) {
  return {
    blob: vi.fn(async () => blob),
  };
}

vi.mock("../utils/generation-history", async () => {
  const actual = await vi.importActual("../utils/generation-history");
  return {
    ...actual,
    normalizeGenerationHistory: vi.fn((items) => items),
    persistGenerationHistory: vi.fn(),
    loadPersistedGenerationHistory: vi.fn(() => []),
  };
});

vi.mock("./usePreviewCache", () => ({
  revokeBlobUrl: vi.fn(),
}));

function createHistoryItem(overrides: Partial<GenerationHistoryItem> = {}): GenerationHistoryItem {
  return {
    id: "history-1",
    createdAt: 1,
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

function createExportMetadata(fileName: string): ExportMetadata {
  return {
    mimeType: "audio/wav",
    extension: "wav",
    bitDepth: 16,
    sizeBytes: 1234,
    fileName,
  };
}

describe("useGenerationHistory", () => {
  beforeEach(() => {
    generationHistory.value = [];
    latestExportMetadata.value = null;
    latestOutputSamples.value = null;
    latestOutputHz.value = DEFAULT_OUTPUT_SAMPLE_RATE;
    vi.restoreAllMocks();
    vi.mocked(normalizeGenerationHistory).mockImplementation((items) => [...items]);
    vi.mocked(persistGenerationHistory).mockReset();
    vi.mocked(revokeBlobUrl).mockReset();
  });

  it("does not rename the active export metadata when a different history item is renamed", () => {
    generationHistory.value = [
      createHistoryItem({ id: "current", fileName: "current.wav", audioUrl: "blob:current" }),
      createHistoryItem({ id: "other", fileName: "other.wav", audioUrl: "blob:other" }),
    ];
    latestExportMetadata.value = createExportMetadata("current.wav");

    renameHistoryOutput("other", "renamed-other.wav", "blob:current");

    expect(generationHistory.value[1]?.fileName).toBe("renamed-other.wav");
    expect(latestExportMetadata.value?.fileName).toBe("current.wav");
  });

  it("renames the active export metadata when the current history item is renamed", () => {
    generationHistory.value = [
      createHistoryItem({ id: "current", fileName: "current.wav", audioUrl: "blob:current" }),
    ];
    latestExportMetadata.value = createExportMetadata("current.wav");

    renameHistoryOutput("current", "renamed-current.wav", "blob:current");

    expect(generationHistory.value[0]?.fileName).toBe("renamed-current.wav");
    expect(latestExportMetadata.value?.fileName).toBe("renamed-current.wav");
  });

  it("appends history, persists it, and cleans up evicted cached entries", async () => {
    const cacheDelete = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ delete: cacheDelete })),
      delete: vi.fn(async () => true),
    });

    generationHistory.value = [
      createHistoryItem({ id: "old", cacheKey: "old-key", audioUrl: "blob:old" }),
    ];
    vi.mocked(normalizeGenerationHistory).mockReturnValue([
      createHistoryItem({ id: "new", cacheKey: "new-key", audioUrl: "blob:new" }),
    ]);

    await appendHistoryItem(
      createHistoryItem({ id: "new", cacheKey: "new-key", audioUrl: "blob:new" }),
    );

    expect(generationHistory.value.map((item) => item.id)).toEqual(["new"]);
    expect(persistGenerationHistory).toHaveBeenCalledWith(generationHistory.value);
    expect(revokeBlobUrl).toHaveBeenCalledWith("blob:old");
    expect(cacheDelete).toHaveBeenCalledWith("/old-key");
  });

  it("persists history audio cache and ignores cache write failures", async () => {
    class ResponseMock {
      body: Blob;
      init: ResponseInit | undefined;

      constructor(body: Blob, init?: ResponseInit) {
        this.body = body;
        this.init = init;
      }
    }
    vi.stubGlobal("Response", ResponseMock);
    const put = vi.fn(async () => undefined);
    vi.stubGlobal("caches", {
      open: vi.fn().mockResolvedValueOnce({ put }).mockRejectedValueOnce(new Error("no cache")),
      delete: vi.fn(async () => true),
    });

    await persistHistoryAudioToCache("demo key", new Blob(["demo"]), "audio/wav");
    await persistHistoryAudioToCache("demo key", new Blob(["demo"]), "audio/wav");

    expect(put).toHaveBeenCalledWith(
      "/demo%20key",
      expect.objectContaining({
        body: expect.any(Blob),
        init: { headers: { "Content-Type": "audio/wav" } },
      }),
    );
  });

  it("hydrates cached history, skips missing blobs, and handles failures", async () => {
    const { loadPersistedGenerationHistory } = await import("../utils/generation-history");
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:rehydrated");
    const persisted = [
      createHistoryItem({ id: "kept", cacheKey: "keep-key", audioUrl: "blob:stale" }),
      createHistoryItem({ id: "missing", cacheKey: "missing-key", audioUrl: "blob:missing" }),
    ];
    vi.mocked(loadPersistedGenerationHistory).mockReturnValue(persisted);

    const match = vi
      .fn()
      .mockResolvedValueOnce(createCacheResponse(new Blob(["audio"])))
      .mockResolvedValueOnce(undefined);

    vi.stubGlobal("caches", {
      open: vi
        .fn()
        .mockResolvedValueOnce({ match })
        .mockRejectedValueOnce(new Error("cache failed")),
      delete: vi.fn(async () => true),
    });

    await hydrateGenerationHistoryFromCache();
    expect(generationHistory.value).toHaveLength(1);
    expect(generationHistory.value[0]?.id).toBe("kept");
    expect(createObjectURL).toHaveBeenCalled();

    await hydrateGenerationHistoryFromCache();
    expect(generationHistory.value).toEqual([]);
  });

  it("clears latest output and removes current history items completely", async () => {
    const onRemoved = vi.fn();
    const cacheDelete = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ delete: cacheDelete })),
      delete: vi.fn(async () => true),
    });

    generationHistory.value = [
      createHistoryItem({ id: "current", cacheKey: "current-key", audioUrl: "blob:current" }),
      createHistoryItem({ id: "other", cacheKey: "other-key", audioUrl: "blob:other" }),
    ];
    latestExportMetadata.value = createExportMetadata("current.wav");
    latestOutputSamples.value = new Float32Array([1, 2]);
    latestOutputHz.value = 44100;

    await removeHistoryOutput("current", "blob:current", onRemoved);

    expect(generationHistory.value.map((item) => item.id)).toEqual(["other"]);
    expect(revokeBlobUrl).toHaveBeenCalledWith("blob:current");
    expect(cacheDelete).toHaveBeenCalledWith("/current-key");
    expect(latestExportMetadata.value).toBe(null);
    expect(latestOutputSamples.value).toBe(null);
    expect(latestOutputHz.value).toBe(DEFAULT_OUTPUT_SAMPLE_RATE);
    expect(onRemoved).toHaveBeenCalledTimes(1);
  });

  it("ignores missing removals and preserves active output for non-current items", async () => {
    const onRemoved = vi.fn();
    const cacheDelete = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ delete: cacheDelete })),
      delete: vi.fn(async () => true),
    });

    generationHistory.value = [
      createHistoryItem({ id: "other", cacheKey: "other-key", audioUrl: "blob:other" }),
    ];
    latestExportMetadata.value = createExportMetadata("active.wav");
    latestOutputSamples.value = new Float32Array([3, 4]);
    latestOutputHz.value = 32000;

    await removeHistoryOutput("missing", "blob:current", onRemoved);
    await removeHistoryOutput("other", "blob:current", onRemoved);

    expect(cacheDelete).toHaveBeenCalledTimes(1);
    expect(latestExportMetadata.value?.fileName).toBe("active.wav");
    expect(latestOutputSamples.value).toEqual(new Float32Array([3, 4]));
    expect(latestOutputHz.value).toBe(32000);
    expect(onRemoved).not.toHaveBeenCalled();
  });

  it("clears all history cache state and resets latest output helpers", async () => {
    const cacheDelete = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ delete: vi.fn() })),
      delete: cacheDelete,
    });

    generationHistory.value = [
      createHistoryItem({ id: "one", audioUrl: "blob:one" }),
      createHistoryItem({ id: "two", audioUrl: "blob:two" }),
    ];
    latestExportMetadata.value = createExportMetadata("last.wav");
    setLatestOutput(new Float32Array([0.5]), 48000);

    expect(isHistoryAudioUrl("blob:one")).toBe(true);
    expect(isHistoryAudioUrl("blob:missing")).toBe(false);
    expect(isHistoryAudioUrl(null)).toBe(false);

    clearLatestOutput();
    expect(latestOutputSamples.value).toBe(null);
    expect(latestOutputHz.value).toBe(DEFAULT_OUTPUT_SAMPLE_RATE);

    setLatestOutput(new Float32Array([0.25]), 16000);
    await clearGenerationHistory();

    expect(generationHistory.value).toEqual([]);
    expect(latestExportMetadata.value).toBe(null);
    expect(latestOutputSamples.value).toBe(null);
    expect(latestOutputHz.value).toBe(DEFAULT_OUTPUT_SAMPLE_RATE);
    expect(revokeBlobUrl).toHaveBeenCalledWith("blob:one");
    expect(revokeBlobUrl).toHaveBeenCalledWith("blob:two");
    expect(cacheDelete).toHaveBeenCalledWith("kokoro-generation-history-audio-v1");
  });

  it("skips cache deletion when there are no evicted history keys", async () => {
    const cacheDelete = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ delete: cacheDelete })),
      delete: vi.fn(async () => true),
    });
    generationHistory.value = [];

    await appendHistoryItem(createHistoryItem({ id: "only", cacheKey: "only-key" }));

    expect(cacheDelete).not.toHaveBeenCalled();
  });
});
