// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildMixPreviewId,
  buildVoicePreviewId,
  clearPreviewCache,
  deletePreviewCacheStorage,
  loadPreviewFromCache,
  previewAudioUrls,
  revokeBlobUrl,
  storePreviewResult,
} from "./usePreviewCache";

function createCacheResponse(blob: Blob) {
  return {
    blob: vi.fn(async () => blob),
  };
}

describe("usePreviewCache", () => {
  beforeEach(() => {
    clearPreviewCache();
    vi.restoreAllMocks();
  });

  it("revokes only blob urls", () => {
    const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    revokeBlobUrl(undefined);
    revokeBlobUrl("https://example.com/audio.wav");
    revokeBlobUrl("blob:demo");

    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:demo");
  });

  it("stores previews and evicts the oldest entries beyond the cache limit", async () => {
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
    const open = vi.fn(async () => ({ put }));
    vi.stubGlobal("caches", { open, delete: vi.fn(async () => true) });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    for (let index = 0; index < 31; index += 1) {
      const buffer = new Float32Array([index, index + 0.5]).buffer;
      storePreviewResult(
        `preview-${index}`,
        "audio/wav",
        new Blob([buffer], { type: "audio/wav" }),
        `blob:${index}`,
        index === 30 ? "alias-30" : undefined,
      );
    }

    expect(previewAudioUrls.value.size).toBe(30);
    expect(previewAudioUrls.value.has("preview-0")).toBe(false);
    expect(previewAudioUrls.value.get("preview-30")).toBe("blob:30");
    await vi.waitFor(() => {
      expect(put).toHaveBeenCalledWith("/alias-30", expect.any(ResponseMock));
    });
  });

  it("builds stable preview ids", () => {
    expect(
      buildVoicePreviewId({
        voice: "af_heart",
        speed: 1,
        pitchSemitones: 0,
        sentencePauseMs: 120,
        newlinePauseMs: 180,
        paragraphPauseMs: 300,
      }),
    ).toBe("voice:af_heart|speed:1.00|pitch:0.0|sentence:120|newline:180|paragraph:300");

    expect(
      buildMixPreviewId({
        voice: "af_heart",
        secondaryVoice: "bf_emma",
        secondaryRatio: 35,
        speed: 1.25,
        pitchSemitones: 1.5,
        sentencePauseMs: 120,
        newlinePauseMs: 180,
        paragraphPauseMs: 300,
      }),
    ).toBe("mix:af_heart|bf_emma|35|speed:1.25|pitch:1.5|sentence:120|newline:180|paragraph:300");
  });

  it("loads cached previews, reuses in-memory ones, and handles misses or failures", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:restored");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);

    const blob = new Blob(["preview"], { type: "audio/wav" });
    const open = vi
      .fn()
      .mockResolvedValueOnce({
        match: vi.fn(async () => createCacheResponse(blob)),
      })
      .mockResolvedValueOnce({
        match: vi.fn(async () => undefined),
      })
      .mockRejectedValueOnce(new Error("cache down"));

    vi.stubGlobal("caches", {
      open,
      delete: vi.fn(async () => true),
    });

    expect(await loadPreviewFromCache("restored")).toBe(true);
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(previewAudioUrls.value.get("restored")).toBe("blob:restored");

    expect(await loadPreviewFromCache("restored")).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);

    expect(await loadPreviewFromCache("missing")).toBe(false);
    expect(await loadPreviewFromCache("broken")).toBe(false);
  });

  it("clears in-memory preview data and deletes storage", async () => {
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const deleteCache = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      open: vi.fn(async () => ({ put: vi.fn(), match: vi.fn() })),
      delete: deleteCache,
    });

    const buffer = new Float32Array([1, 2, 3]).buffer;
    storePreviewResult(
      "preview-clear",
      "audio/wav",
      new Blob([buffer], { type: "audio/wav" }),
      "blob:clear",
    );

    clearPreviewCache();
    expect(previewAudioUrls.value.size).toBe(0);

    await deletePreviewCacheStorage();
    expect(deleteCache).toHaveBeenCalledWith("kokoro-preview-audio-v1");
  });
});
