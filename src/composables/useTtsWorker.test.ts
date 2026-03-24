// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref, shallowRef } from "vue";

const NativeResponse = globalThis.Response;

class MockWorker {
  static instances: MockWorker[] = [];
  public listeners: Array<(event: MessageEvent<any>) => void> = [];
  public postMessage = vi.fn();
  public terminate = vi.fn();

  constructor() {
    MockWorker.instances.push(this);
  }

  addEventListener(type: string, callback: (event: MessageEvent<any>) => void) {
    if (type === "message") {
      this.listeners.push(callback);
    }
  }

  emit(data: any) {
    for (const listener of this.listeners) {
      listener({ data } as MessageEvent<any>);
    }
  }
}

describe("useTtsWorker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    MockWorker.instances = [];
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");

    (globalThis as any).Worker = MockWorker;
    (globalThis as any).URL.createObjectURL = vi.fn(() => `blob:${Math.random()}`);
    (globalThis as any).Response = NativeResponse;
  });

  it("builds init messages, initializes worker, and handles worker lifecycle events", async () => {
    const dispatch = vi.fn();
    const state = shallowRef({
      model: { id: "m1", label: "Model", modelId: "model-1", voices: [] },
      selectedVoice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 120,
      newlinePauseMs: 180,
      paragraphPauseMs: 260,
      status: "ready",
      device: "webgpu",
    } as any);

    const runtimePreference = ref<any>("auto");
    const cachePut = vi.fn(async () => undefined);
    const cacheMatch = vi.fn(async () => null);
    (globalThis as any).Response = class {
      private readonly payload: Blob;

      constructor(body?: Blob | ArrayBuffer | string) {
        this.payload = body instanceof Blob ? body : new Blob([body ?? ""]);
      }

      async blob() {
        return this.payload;
      }
    };
    (globalThis as any).caches = {
      open: vi.fn(async () => ({ put: cachePut, match: cacheMatch })),
    };

    vi.doMock("./useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("./useUiState", () => ({
      runtimePreference,
    }));
    vi.doMock("../utils/runtime", () => ({
      hasWebGPU: () => true,
      preferredDeviceFromEnvironment: vi.fn(() => "webgpu"),
    }));
    vi.doMock("../utils/audio", () => ({
      audioBufferToWavBlob: vi.fn(
        (buffer: ArrayBuffer, _sr: number, mime: string) => new Blob([buffer], { type: mime }),
      ),
    }));

    const mod = await import("./useTtsWorker");

    window.history.replaceState({}, "", "/?mockTts=1&mockDevice=fallback&forceDevice=webgpu");
    const init = mod.buildInitMessage();
    expect(init.preferredDevice).toBe("webgpu");
    expect(init.mock?.enabled).toBe(true);
    expect(init.mock?.deviceMode).toBe("fallback");
    expect(runtimePreference.value).toBe("webgpu");

    window.history.replaceState({}, "", "/?mockTts=1&mockDevice=invalid");
    const initInvalidMockDevice = mod.buildInitMessage();
    expect(initInvalidMockDevice.mock?.deviceMode).toBe("webgpu");

    mod.initWorker();
    expect(dispatch).toHaveBeenCalledWith({ type: "init-loading" });
    expect(MockWorker.instances).toHaveLength(1);
    const firstWorker = MockWorker.instances[0]!;
    expect(firstWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "init" }));

    firstWorker.emit({ type: "init-progress", phase: "fallback", device: "wasm" });
    firstWorker.emit({ type: "init-progress", phase: "loading", device: "webgpu" });
    firstWorker.emit({
      type: "ready",
      device: "webgpu",
      voices: [{ id: "af_heart", label: "Heart" }],
      language: "English",
    });
    firstWorker.emit({
      type: "ready",
      device: "wasm",
      voices: [{ id: "af_heart", label: "Heart" }],
    });

    const pcm = new Float32Array([0.2, -0.2]);
    firstWorker.emit({
      type: "result",
      audioBuffer: pcm.buffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });

    expect(mod.latestOutputSamples.value).toBeInstanceOf(Float32Array);
    expect(mod.latestOutputSampleRate.value).toBe(24000);
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "audio-ready", audioUrl: expect.any(String) }),
    );
    await vi.waitFor(() => {
      expect(cachePut).toHaveBeenCalled();
    });

    firstWorker.emit({
      type: "preview-result",
      previewId:
        "mix:af_heart|__none__|0|speed:1.00|pitch:0.0|sentence:120|newline:180|paragraph:260",
      audioBuffer: pcm.buffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(
      mod.previewAudioUrls.value.get(
        "mix:af_heart|__none__|0|speed:1.00|pitch:0.0|sentence:120|newline:180|paragraph:260",
      ),
    ).toContain("blob:");
    expect(
      mod.previewAudioSamples.value.get(
        "mix:af_heart|__none__|0|speed:1.00|pitch:0.0|sentence:120|newline:180|paragraph:260",
      ),
    ).toBeInstanceOf(Float32Array);

    firstWorker.emit({
      type: "preview-result",
      previewId:
        "mix:af_heart|__none__|0|speed:1.00|pitch:0.0|sentence:120|newline:180|paragraph:260",
      audioBuffer: pcm.buffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });
    firstWorker.emit({
      type: "preview-result",
      previewId: "voice:af_heart|speed:1.00|pitch:0.0|sentence:120|newline:180|paragraph:260",
      audioBuffer: pcm.buffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });

    mod.startWorker({ type: "init", preferredDevice: "auto", model: state.value.model } as any);
    const autoWorker = MockWorker.instances[1]!;
    mod.hasRetriedWithWasm.value = false;
    autoWorker.emit({ type: "error", message: "gpu failed", recoverable: true });
    expect(mod.hasRetriedWithWasm.value).toBe(true);
    expect(MockWorker.instances.length).toBeGreaterThan(2);

    const retriedWorker = MockWorker.instances[2]!;
    retriedWorker.emit({ type: "error", message: "still failed", recoverable: false });
    expect(dispatch).toHaveBeenCalledWith({ type: "error", message: "still failed" });
    expect(dispatch).toHaveBeenCalledWith({
      type: "ready",
      device: "wasm",
      voices: [{ id: "af_heart", label: "Heart" }],
      language: null,
    });
  });

  it("posts generation and cancellation requests", async () => {
    const dispatch = vi.fn();
    const state = shallowRef({
      model: { id: "m1", label: "Model", modelId: "model-1", voices: [] },
      selectedVoice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 120,
      newlinePauseMs: 180,
      paragraphPauseMs: 260,
      status: "ready",
      device: "webgpu",
    } as any);

    vi.doMock("./useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("./useUiState", () => ({ runtimePreference: ref<any>("webgpu") }));
    vi.doMock("../utils/runtime", () => ({
      hasWebGPU: () => true,
      preferredDeviceFromEnvironment: () => "webgpu",
    }));
    vi.doMock("../utils/audio", () => ({
      audioBufferToWavBlob: vi.fn(
        (buffer: ArrayBuffer, _sr: number, mime: string) => new Blob([buffer], { type: mime }),
      ),
    }));
    (globalThis as any).caches = {
      open: vi.fn(async () => ({ put: vi.fn(), match: vi.fn(async () => null) })),
    };

    const mod = await import("./useTtsWorker");
    mod.startWorker(mod.buildInitMessage());
    const active = MockWorker.instances[0]!;

    mod.generateAudio({
      type: "generate",
      text: "Hello",
      voice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 100,
      newlinePauseMs: 150,
      paragraphPauseMs: 250,
    });
    expect(dispatch).toHaveBeenCalledWith({ type: "clear-error" });
    expect(dispatch).toHaveBeenCalledWith({ type: "generate-start" });
    expect(active.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: "generate" }));

    mod.cancelGeneration();
    expect(active.postMessage).toHaveBeenCalledWith({ type: "cancel" });
    expect(dispatch).toHaveBeenCalledWith({ type: "error", message: "Generation canceled." });
  });

  it("requests previews from cache and worker only when needed", async () => {
    const dispatch = vi.fn();
    const state = shallowRef({
      model: { id: "m1", label: "Model", modelId: "model-1", voices: [] },
      selectedVoice: "af_heart",
      secondaryVoice: "am_michael",
      secondaryRatio: 35,
      speed: 1.1,
      pitchSemitones: 1,
      sentencePauseMs: 120,
      newlinePauseMs: 180,
      paragraphPauseMs: 260,
      status: "ready",
      device: "webgpu",
    } as any);

    (globalThis as any).Response = class {
      private readonly payload: Blob;

      constructor(body?: Blob | ArrayBuffer | string) {
        this.payload = body instanceof Blob ? body : new Blob([body ?? ""]);
      }

      async blob() {
        return this.payload;
      }
    };

    const cacheMatch = vi.fn(async (url: string) => {
      if (
        url.includes(
          encodeURIComponent(
            "voice:af_heart|speed:1.00|pitch:0.0|sentence:150|newline:225|paragraph:325",
          ),
        )
      ) {
        return new Response(new Blob(["cached"], { type: "audio/wav" }));
      }
      return null;
    });

    vi.doMock("./useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("./useUiState", () => ({ runtimePreference: ref<any>("webgpu") }));
    vi.doMock("../utils/runtime", () => ({
      hasWebGPU: () => true,
      preferredDeviceFromEnvironment: () => "webgpu",
    }));
    vi.doMock("../utils/audio", () => ({
      audioBufferToWavBlob: vi.fn(
        (buffer: ArrayBuffer, _sr: number, mime: string) => new Blob([buffer], { type: mime }),
      ),
    }));
    (globalThis as any).caches = {
      open: vi.fn(async () => ({ put: vi.fn(), match: cacheMatch })),
    };

    const mod = await import("./useTtsWorker");
    mod.startWorker(mod.buildInitMessage());
    const active = MockWorker.instances[0]!;

    mod.requestPreviews();
    expect(dispatch).toHaveBeenCalledWith({ type: "preview-start" });

    await Promise.resolve();
    await Promise.resolve();

    expect(cacheMatch).toHaveBeenCalled();

    const postedPreviewIds = active.postMessage.mock.calls
      .map((args) => args[0])
      .filter((msg) => msg.type === "generate-preview")
      .map((msg) => msg.previewId);

    expect(postedPreviewIds).toContain(
      "voice:am_michael|speed:1.00|pitch:0.0|sentence:150|newline:225|paragraph:325",
    );
    expect(postedPreviewIds).toContain(
      "mix:af_heart|am_michael|35|speed:1.10|pitch:1.0|sentence:120|newline:180|paragraph:260",
    );
    expect(postedPreviewIds).not.toContain(
      "voice:af_heart|speed:1.00|pitch:0.0|sentence:150|newline:225|paragraph:325",
    );

    state.value.status = "loading";
    mod.requestPreviews();
    state.value.status = "ready";
    state.value.selectedVoice = "";
    mod.requestPreviews();
  });

  it("handles preview cache short-circuit and cache open failures", async () => {
    const dispatch = vi.fn();
    const state = shallowRef({
      model: { id: "m1", label: "Model", modelId: "model-1", voices: [] },
      selectedVoice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 120,
      newlinePauseMs: 180,
      paragraphPauseMs: 260,
      status: "ready",
      device: "webgpu",
    } as any);

    vi.doMock("./useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("./useUiState", () => ({ runtimePreference: ref<any>("webgpu") }));
    vi.doMock("../utils/runtime", () => ({
      hasWebGPU: () => true,
      preferredDeviceFromEnvironment: () => "webgpu",
    }));
    vi.doMock("../utils/audio", () => ({
      audioBufferToWavBlob: vi.fn(
        (buffer: ArrayBuffer, _sr: number, mime: string) => new Blob([buffer], { type: mime }),
      ),
    }));

    (globalThis as any).caches = {
      open: vi.fn(async () => {
        throw new Error("cache unavailable");
      }),
    };

    const mod = await import("./useTtsWorker");
    mod.previewAudioUrls.value = new Map([
      ["voice:af_heart|speed:1.00|pitch:0.0|sentence:150|newline:225|paragraph:325", "blob:cached"],
    ]);
    mod.startWorker(mod.buildInitMessage());
    const active = MockWorker.instances[0]!;

    mod.requestPreviews();
    await Promise.resolve();
    await Promise.resolve();

    const postedPreviewIds = active.postMessage.mock.calls
      .map((args) => args[0])
      .filter((msg) => msg.type === "generate-preview")
      .map((msg) => msg.previewId);

    expect(postedPreviewIds).not.toContain(
      "voice:af_heart|speed:1.00|pitch:0.0|sentence:150|newline:225|paragraph:325",
    );
    expect(postedPreviewIds).toContain(
      "mix:af_heart|__none__|0|speed:1.00|pitch:0.0|sentence:120|newline:180|paragraph:260",
    );
  });

  it("generates distinct preview ids when pause settings change", async () => {
    const dispatch = vi.fn();
    const state = shallowRef({
      model: { id: "m1", label: "Model", modelId: "model-1", voices: [] },
      selectedVoice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 120,
      newlinePauseMs: 180,
      paragraphPauseMs: 260,
      status: "ready",
      device: "webgpu",
    } as any);

    vi.doMock("./useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("./useUiState", () => ({ runtimePreference: ref<any>("webgpu") }));
    vi.doMock("../utils/runtime", () => ({
      hasWebGPU: () => true,
      preferredDeviceFromEnvironment: () => "webgpu",
    }));
    vi.doMock("../utils/audio", () => ({
      audioBufferToWavBlob: vi.fn(
        (buffer: ArrayBuffer, _sr: number, mime: string) => new Blob([buffer], { type: mime }),
      ),
    }));
    (globalThis as any).caches = {
      open: vi.fn(async () => ({ put: vi.fn(), match: vi.fn(async () => null) })),
      delete: vi.fn(async () => true),
    };

    const mod = await import("./useTtsWorker");
    const firstId = mod.buildVoicePreviewId({
      voice: "af_heart",
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 120,
      newlinePauseMs: 180,
      paragraphPauseMs: 260,
    });
    const secondId = mod.buildVoicePreviewId({
      voice: "af_heart",
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 200,
      newlinePauseMs: 180,
      paragraphPauseMs: 260,
    });

    expect(firstId).not.toBe(secondId);
  });
});
