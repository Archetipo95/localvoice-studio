// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick, ref, shallowRef } from "vue";

describe("useTtsWorker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage?.clear();
    window.history.replaceState({}, "", "/");
  });

  it("builds init message from URL flags and runtime preference", async () => {
    vi.doMock("../utils/runtime", () => ({
      hasWebGPU: () => true,
      preferredDeviceFromEnvironment: vi.fn(() => "wasm"),
    }));

    const mod = await import("./useTtsWorker");
    const { useUiStore } = await import("../stores/ui");
    const ui = useUiStore();

    expect(ui.runtimePreference).toMatch(/^(webgpu|wasm)$/);

    window.history.replaceState({}, "", "/?mockTts=1&mockDevice=fallback&forceDevice=webgpu");
    const init = mod.buildInitMessage();

    expect(init.preferredDevice).toBe("webgpu");
    expect(init.mock).toEqual({ enabled: true, deviceMode: "fallback" });
    expect(ui.runtimePreference).toMatch(/^(webgpu|wasm)$/);
  });

  it("posts generate/cancel messages and starts preview requests", async () => {
    const posted: Array<any> = [];

    class MockWorker {
      postMessage(message: any) {
        posted.push(message);
      }

      addEventListener() {}
      terminate() {}
    }

    Object.defineProperty(globalThis, "Worker", {
      value: MockWorker,
      configurable: true,
      writable: true,
    });

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(new Map()),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult: vi.fn(async () => undefined),
      loadPreviewFromCache: vi.fn(async () => null),
      clearPreviewCache: vi.fn(),
      deletePreviewCacheStorage: vi.fn(async () => true),
      revokeBlobUrl: vi.fn(),
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: ref([]),
      latestExportMetadata: ref(null),
      latestOutputSamples: ref(null),
      latestOutputHz: ref(null),
      appendHistoryItem: vi.fn(() => null),
      persistHistoryAudioToCache: vi.fn(async () => undefined),
      clearGenerationHistory: vi.fn(async () => undefined),
      isHistoryAudioUrl: vi.fn(() => false),
      renameHistoryOutput: vi.fn(),
      removeHistoryOutput: vi.fn(async () => undefined),
      setLatestOutput: vi.fn(),
      clearLatestOutput: vi.fn(),
    }));

    const mod = await import("./useTtsWorker");
    const { useGenerationStore } = await import("../stores/generation");
    const { useVoiceStore } = await import("../stores/voice");

    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "am_michael";

    mod.startWorker(mod.buildInitMessage());

    mod.generateAudio({
      type: "generate",
      text: "Hello",
      voice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 150,
      newlinePauseMs: 225,
      paragraphPauseMs: 325,
      fileName: "out.wav",
    });

    expect(generation.status).toBe("generating");
    expect(posted.some((message) => message.text === "Hello")).toBe(true);

    mod.cancelGeneration();
    expect(generation.error).toBe("Generation canceled.");
    expect(posted).toContainEqual({ type: "cancel" });

    generation.status = "ready";
    generation.activityPhase = "idle";
    mod.requestPreviews();

    await Promise.resolve();
    await Promise.resolve();

    expect(generation.activityPhase).toBe("preview-loading");
    expect(posted.some((message) => message.type === "generate-preview")).toBe(true);
  });

  it("normalizes invalid speed values before dispatching worker requests", async () => {
    const posted: Array<any> = [];

    class MockWorker {
      postMessage(message: any) {
        posted.push(message);
      }

      addEventListener() {}
      terminate() {}
    }

    Object.defineProperty(globalThis, "Worker", {
      value: MockWorker,
      configurable: true,
      writable: true,
    });

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(new Map()),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult: vi.fn(async () => undefined),
      loadPreviewFromCache: vi.fn(async () => null),
      clearPreviewCache: vi.fn(),
      deletePreviewCacheStorage: vi.fn(async () => true),
      revokeBlobUrl: vi.fn(),
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: ref([]),
      latestExportMetadata: ref(null),
      latestOutputSamples: ref(null),
      latestOutputHz: ref(null),
      appendHistoryItem: vi.fn(() => null),
      persistHistoryAudioToCache: vi.fn(async () => undefined),
      clearGenerationHistory: vi.fn(async () => undefined),
      isHistoryAudioUrl: vi.fn(() => false),
      renameHistoryOutput: vi.fn(),
      removeHistoryOutput: vi.fn(async () => undefined),
      setLatestOutput: vi.fn(),
      clearLatestOutput: vi.fn(),
    }));

    const mod = await import("./useTtsWorker");
    const { useGenerationStore } = await import("../stores/generation");
    const { useVoiceStore } = await import("../stores/voice");

    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "am_michael";
    voice.secondaryRatio = 35;
    voice.speed = 99;

    mod.startWorker(mod.buildInitMessage());

    mod.generateAudio({
      type: "generate",
      text: "Hello",
      voice: " af_heart ",
      secondaryVoice: " __none__ ",
      secondaryRatio: 0,
      speed: Number.NaN,
      pitchSemitones: 0,
      sentencePauseMs: 150,
      newlinePauseMs: 225,
      paragraphPauseMs: 325,
      fileName: "out.wav",
    });

    generation.status = "ready";
    generation.activityPhase = "idle";
    mod.requestPreviews();
    await Promise.resolve();
    await Promise.resolve();

    const generateMessage = posted.find((message) => message.type === "generate");
    expect(generateMessage?.speed).toBe(1);
    expect(generateMessage?.voice).toBe("af_heart");
    expect(generateMessage?.secondaryVoice).toBe("__none__");

    const previewMessages = posted.filter((message) => message.type === "generate-preview");
    expect(previewMessages.length).toBeGreaterThan(0);
    expect(previewMessages.every((message) => message.speed <= 2 && message.speed >= 0.5)).toBe(
      true,
    );
  });

  it("rejects generation when text is empty or whitespace", async () => {
    const posted: Array<any> = [];

    class MockWorker {
      postMessage(message: any) {
        posted.push(message);
      }

      addEventListener() {}
      terminate() {}
    }

    Object.defineProperty(globalThis, "Worker", {
      value: MockWorker,
      configurable: true,
      writable: true,
    });

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(new Map()),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult: vi.fn(async () => undefined),
      loadPreviewFromCache: vi.fn(async () => null),
      clearPreviewCache: vi.fn(),
      deletePreviewCacheStorage: vi.fn(async () => true),
      revokeBlobUrl: vi.fn(),
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: ref([]),
      latestExportMetadata: ref(null),
      latestOutputSamples: ref(null),
      latestOutputHz: ref(null),
      appendHistoryItem: vi.fn(() => null),
      persistHistoryAudioToCache: vi.fn(async () => undefined),
      clearGenerationHistory: vi.fn(async () => undefined),
      isHistoryAudioUrl: vi.fn(() => false),
      renameHistoryOutput: vi.fn(),
      removeHistoryOutput: vi.fn(async () => undefined),
      setLatestOutput: vi.fn(),
      clearLatestOutput: vi.fn(),
    }));

    const mod = await import("./useTtsWorker");
    const { useGenerationStore } = await import("../stores/generation");

    const generation = useGenerationStore();
    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";

    mod.startWorker(mod.buildInitMessage());

    mod.generateAudio({
      type: "generate",
      text: "   ",
      voice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 150,
      newlinePauseMs: 225,
      paragraphPauseMs: 325,
      fileName: "out.wav",
    });

    expect(generation.error).toBe("Text is required.");
    // Initial init message is posted, but no generate message.
    expect(posted.length).toBe(1);
    expect(generation.status).toBe("error");
  });

  it("renames history output and clears audio/cache state", async () => {
    const renameHistoryOutput = vi.fn();
    const removeHistoryOutput = vi.fn(
      async (_itemId: string, _currentUrl: string | null, onCurrentItemRemoved?: () => void) => {
        onCurrentItemRemoved?.();
      },
    );
    const clearGenerationHistory = vi.fn(async () => undefined);
    const clearPreviewCache = vi.fn();
    const deletePreviewCacheStorage = vi.fn(async () => true);
    const clearPersistedGenerationHistory = vi.fn();
    const latestExportMetadata = ref({
      mimeType: "audio/wav" as const,
      extension: "wav" as const,
      bitDepth: 16 as const,
      sizeBytes: 10,
      fileName: "demo.wav",
    });
    const latestOutputSamples = ref<Float32Array | null>(new Float32Array([0.1]));
    const clearLatestOutput = vi.fn(() => {
      latestOutputSamples.value = null;
    });

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(new Map()),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult: vi.fn(async () => undefined),
      loadPreviewFromCache: vi.fn(async () => null),
      clearPreviewCache,
      deletePreviewCacheStorage,
      revokeBlobUrl: vi.fn(),
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: ref([]),
      latestExportMetadata,
      latestOutputSamples,
      latestOutputHz: ref(null),
      appendHistoryItem: vi.fn(() => null),
      persistHistoryAudioToCache: vi.fn(async () => undefined),
      clearGenerationHistory,
      isHistoryAudioUrl: vi.fn(() => false),
      renameHistoryOutput,
      removeHistoryOutput,
      setLatestOutput: vi.fn(),
      clearLatestOutput,
    }));

    vi.doMock("../utils/generation-history", () => ({
      clearPersistedGenerationHistory,
    }));

    const mod = await import("./useTtsWorker");
    const { useGenerationStore } = await import("../stores/generation");

    const generation = useGenerationStore();
    generation.audioUrl = "blob:active";

    mod.renameHistoryOutput("h1", "history renamed");
    expect(renameHistoryOutput).toHaveBeenCalledWith("h1", "history-renamed.wav", "blob:active");

    await mod.removeHistoryOutput("h1");
    expect(generation.audioUrl).toBe(null);

    await mod.clearSavedAudioCache();
    expect(clearPreviewCache).toHaveBeenCalled();
    expect(clearGenerationHistory).toHaveBeenCalled();
    expect(clearPersistedGenerationHistory).toHaveBeenCalled();
    expect(deletePreviewCacheStorage).toHaveBeenCalled();
    expect(generation.error).toBe(null);
    expect(latestExportMetadata.value).toBe(null);
    expect(latestOutputSamples.value).toBe(null);
  });

  it("preserves generation history when the model changes and clears only transient output state", async () => {
    const clearPreviewCache = vi.fn();
    const deletePreviewCacheStorage = vi.fn(async () => true);
    const clearGenerationHistory = vi.fn(async () => undefined);
    const clearPersistedGenerationHistory = vi.fn();
    const historyItems = ref([
      {
        id: "h1",
        createdAt: 1,
        sizeBytes: 1_572_864,
        durationMs: 10,
        textLength: 4,
        textPreview: "demo",
        voice: "af_heart",
        secondaryVoice: "__none__",
        secondaryRatio: 0,
        speed: 1,
        pitchSemitones: 0,
        sentencePauseMs: 100,
        newlinePauseMs: 150,
        paragraphPauseMs: 250,
        fileName: "history.wav",
        audioUrl: "blob:history",
        cacheKey: "history:h1",
      },
    ]);
    const latestExportMetadata = ref({
      mimeType: "audio/wav" as const,
      extension: "wav" as const,
      bitDepth: 16 as const,
      sizeBytes: 10,
      fileName: "history.wav",
    });
    const latestOutputSamples = ref<Float32Array | null>(new Float32Array([0.1]));
    const clearLatestOutput = vi.fn(() => {
      latestOutputSamples.value = null;
    });

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(new Map([["voice:af_heart", "blob:preview"]])),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult: vi.fn(async () => undefined),
      loadPreviewFromCache: vi.fn(async () => null),
      clearPreviewCache,
      deletePreviewCacheStorage,
      revokeBlobUrl: vi.fn(),
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: historyItems,
      latestExportMetadata,
      latestOutputSamples,
      latestOutputHz: ref(null),
      appendHistoryItem: vi.fn(() => null),
      persistHistoryAudioToCache: vi.fn(async () => undefined),
      clearGenerationHistory,
      isHistoryAudioUrl: vi.fn((url: string | null | undefined) => url === "blob:history"),
      renameHistoryOutput: vi.fn(),
      removeHistoryOutput: vi.fn(async () => undefined),
      setLatestOutput: vi.fn(),
      clearLatestOutput,
    }));

    vi.doMock("../utils/generation-history", () => ({
      clearPersistedGenerationHistory,
    }));

    const mod = await import("./useTtsWorker");
    const { createModelDefinition } = await import("../config/model-config");
    const { useGenerationStore } = await import("../stores/generation");

    const generation = useGenerationStore();
    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    generation.audioUrl = "blob:history";

    mod.setupWorkerWatchers();
    generation.changeModel(createModelDefinition("custom/next-model"), false);
    await nextTick();
    await Promise.resolve();

    expect(historyItems.value).toHaveLength(1);
    expect(clearPreviewCache).toHaveBeenCalledTimes(1);
    expect(deletePreviewCacheStorage).toHaveBeenCalledTimes(1);
    expect(clearGenerationHistory).not.toHaveBeenCalled();
    expect(clearPersistedGenerationHistory).not.toHaveBeenCalled();
    expect(latestExportMetadata.value).toBe(null);
    expect(latestOutputSamples.value).toBe(null);
  });

  it("ignores stale preview batches and completes only the latest batch", async () => {
    const storePreviewResult = vi.fn();
    const workerInstances: MockWorker[] = [];

    class MockWorker {
      private readonly listeners: Array<(event: MessageEvent<any>) => void> = [];

      postMessage = vi.fn();

      addEventListener(type: string, listener: (event: MessageEvent<any>) => void) {
        if (type === "message") {
          this.listeners.push(listener);
        }
      }

      terminate() {}

      emit(data: any) {
        for (const listener of this.listeners) {
          listener({ data } as MessageEvent<any>);
        }
      }
    }

    Object.defineProperty(globalThis, "Worker", {
      value: class extends MockWorker {
        constructor() {
          super();
          workerInstances.push(this);
        }
      },
      configurable: true,
      writable: true,
    });

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(new Map()),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult,
      loadPreviewFromCache: vi.fn(async (previewId: string) => previewId === "voice:am_michael"),
      clearPreviewCache: vi.fn(),
      deletePreviewCacheStorage: vi.fn(async () => true),
      revokeBlobUrl: vi.fn(),
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: ref([]),
      latestExportMetadata: ref(null),
      latestOutputSamples: ref(null),
      latestOutputHz: ref(null),
      appendHistoryItem: vi.fn(() => null),
      persistHistoryAudioToCache: vi.fn(async () => undefined),
      clearGenerationHistory: vi.fn(async () => undefined),
      isHistoryAudioUrl: vi.fn(() => false),
      renameHistoryOutput: vi.fn(),
      removeHistoryOutput: vi.fn(async () => undefined),
      setLatestOutput: vi.fn(),
      clearLatestOutput: vi.fn(),
    }));

    const mod = await import("./useTtsWorker");
    const { useGenerationStore } = await import("../stores/generation");
    const { useVoiceStore } = await import("../stores/voice");

    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 0;

    mod.startWorker(mod.buildInitMessage());
    const activeWorker = workerInstances[0]!;

    mod.requestPreviews();
    await Promise.resolve();

    voice.secondaryVoice = "am_michael";
    voice.secondaryRatio = 40;
    mod.requestPreviews();
    await Promise.resolve();

    expect(generation.activityPhase).toBe("preview-loading");

    const sampleBuffer = new Float32Array([0.2, -0.2]).buffer;
    activeWorker.emit({
      type: "preview-result",
      previewId: "mix:af_heart|__none__",
      audioBuffer: sampleBuffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });

    expect(generation.activityPhase).toBe("preview-loading");

    activeWorker.emit({
      type: "preview-result",
      previewId: "voice:af_heart",
      audioBuffer: sampleBuffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });
    expect(generation.activityPhase).toBe("preview-loading");

    activeWorker.emit({
      type: "preview-result",
      previewId: "mix:af_heart|am_michael",
      audioBuffer: sampleBuffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });

    expect(generation.activityPhase).toBe("idle");
    expect(storePreviewResult).toHaveBeenCalledTimes(2);
  });

  it("resets studio state, completes previews without a worker, and revokes replaced blob urls", async () => {
    const clearLatestOutput = vi.fn();
    const revokeBlobUrl = vi.fn();
    const loadPreviewFromCache = vi.fn(async () => false);

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(new Map()),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult: vi.fn(),
      loadPreviewFromCache,
      clearPreviewCache: vi.fn(),
      deletePreviewCacheStorage: vi.fn(async () => true),
      revokeBlobUrl,
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: ref([]),
      latestExportMetadata: ref({
        mimeType: "audio/wav" as const,
        extension: "wav" as const,
        bitDepth: 16 as const,
        sizeBytes: 10,
        fileName: "demo.wav",
      }),
      latestOutputSamples: ref<Float32Array | null>(new Float32Array([0.1])),
      latestOutputHz: ref(null),
      appendHistoryItem: vi.fn(() => null),
      persistHistoryAudioToCache: vi.fn(async () => undefined),
      clearGenerationHistory: vi.fn(async () => undefined),
      isHistoryAudioUrl: vi.fn(() => false),
      renameHistoryOutput: vi.fn(),
      removeHistoryOutput: vi.fn(async () => undefined),
      setLatestOutput: vi.fn(),
      clearLatestOutput,
    }));

    const mod = await import("./useTtsWorker");
    const { useGenerationStore } = await import("../stores/generation");
    const { useVoiceStore } = await import("../stores/voice");
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    generation.audioUrl = "blob:old";
    generation.error = "oops";
    voice.voices = [{ id: "af_heart", label: "Heart" }];
    voice.selectedVoice = "af_heart";
    voice.speed = 1.7;

    mod.resetStudioState();
    expect(generation.audioUrl).toBe(null);
    expect(generation.error).toBe(null);
    expect(voice.speed).toBe(1);
    expect(clearLatestOutput).toHaveBeenCalled();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 0;

    mod.requestPreviews();
    await Promise.resolve();
    await Promise.resolve();
    expect(loadPreviewFromCache).toHaveBeenCalled();
    expect(generation.activityPhase).toBe("idle");

    mod.setupWorkerWatchers();
    generation.audioUrl = "blob:old";
    await nextTick();
    generation.audioUrl = "blob:new";
    await nextTick();
    expect(revokeBlobUrl).toHaveBeenCalledWith("blob:old");
  });

  it("requests, caches, and plays pronunciation previews without mutating main output", async () => {
    const workerInstances: MockWorker[] = [];
    const audioInstances: AudioMock[] = [];
    const storePreviewResult = vi.fn();
    const loadPreviewFromCache = vi
      .fn(async (_previewId: string) => false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const audioBufferToWavBlob = vi.fn(
      (buffer: ArrayBuffer, _sampleRate: number, mimeType: string) =>
        new Blob([buffer], { type: mimeType }),
    );
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:pronunciation");

    class MockWorker {
      private readonly listeners: Array<(event: MessageEvent<any>) => void> = [];
      postMessage = vi.fn();
      terminate = vi.fn();

      addEventListener(type: string, listener: (event: MessageEvent<any>) => void) {
        if (type === "message") {
          this.listeners.push(listener);
        }
      }

      emit(data: any) {
        for (const listener of this.listeners) {
          listener({ data } as MessageEvent<any>);
        }
      }
    }

    class AudioMock {
      src = "";
      currentTime = 0;
      paused = true;
      constructor() {
        audioInstances.push(this);
      }
      play = vi.fn(async () => {
        this.paused = false;
      });
      pause = vi.fn(() => {
        this.paused = true;
      });
    }

    Object.defineProperty(globalThis, "Audio", {
      value: AudioMock,
      configurable: true,
      writable: true,
    });

    Object.defineProperty(globalThis, "Worker", {
      value: class extends MockWorker {
        constructor() {
          super();
          workerInstances.push(this);
        }
      },
      configurable: true,
      writable: true,
    });

    vi.doMock("../utils/audio", () => ({
      audioBufferToWavBlob,
    }));

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(
        new Map([["pronunciation:[stewardship](/stjuːɚdʃɪp/)", "blob:cached"]]),
      ),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult,
      loadPreviewFromCache,
      clearPreviewCache: vi.fn(),
      deletePreviewCacheStorage: vi.fn(async () => true),
      revokeBlobUrl: vi.fn(),
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: ref([]),
      latestExportMetadata: ref(null),
      latestOutputSamples: ref(null),
      latestOutputHz: ref(null),
      appendHistoryItem: vi.fn(() => null),
      persistHistoryAudioToCache: vi.fn(async () => undefined),
      clearGenerationHistory: vi.fn(async () => undefined),
      isHistoryAudioUrl: vi.fn(() => false),
      renameHistoryOutput: vi.fn(),
      removeHistoryOutput: vi.fn(async () => undefined),
      setLatestOutput: vi.fn(),
      clearLatestOutput: vi.fn(),
    }));

    const mod = await import("./useTtsWorker");
    const { useGenerationStore } = await import("../stores/generation");
    const { useVoiceStore } = await import("../stores/voice");

    const generation = useGenerationStore();
    const voice = useVoiceStore();
    generation.status = "ready";
    generation.device = "webgpu";
    generation.audioUrl = "blob:main-output";
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 0;

    mod.startWorker(mod.buildInitMessage());
    const worker = workerInstances[0]!;

    const previewPromise = mod.playPronunciationPreview("[stewardship](/stjuːɚdʃɪp/)");
    await Promise.resolve();
    expect(worker.postMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "generate-pronunciation-preview",
        text: "[stewardship](/stjuːɚdʃɪp/)",
      }),
    );

    worker.emit({
      type: "pronunciation-preview-result",
      previewId: "pronunciation:[stewardship](/stjuːɚdʃɪp/)",
      audioBuffer: new Float32Array([0.2, -0.2]).buffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });

    await expect(previewPromise).resolves.toBe("blob:pronunciation");
    expect(storePreviewResult).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(generation.audioUrl).toBe("blob:main-output");
    expect(audioInstances).toHaveLength(1);
    expect(audioInstances[0]?.src).toBe("blob:pronunciation");
    expect(audioInstances[0]?.currentTime).toBe(0);
    expect(audioInstances[0]?.play).toHaveBeenCalledTimes(1);

    await expect(mod.requestPronunciationPreview("[stewardship](/stjuːɚdʃɪp/)")).resolves.toBe(
      "blob:cached",
    );
  });

  it("handles worker init progress, ready, synthesis result, recoverable fallback, and terminal errors", async () => {
    vi.useFakeTimers();

    const workerInstances: MockWorker[] = [];
    const setLatestOutput = vi.fn();
    const persistHistoryAudioToCache = vi.fn(async () => undefined);
    const appendHistoryItem = vi.fn(async () => undefined);
    const clearLatestOutput = vi.fn();
    const loadPreviewFromCache = vi.fn(async () => false);
    const audioBufferToWavBlob = vi.fn(
      (buffer: ArrayBuffer, _sampleRate: number, mimeType: string) =>
        new Blob([buffer], { type: mimeType }),
    );
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:rendered");

    class MockWorker {
      private readonly listeners: Array<(event: MessageEvent<any>) => void> = [];
      postMessage = vi.fn();
      terminate = vi.fn();

      addEventListener(type: string, listener: (event: MessageEvent<any>) => void) {
        if (type === "message") {
          this.listeners.push(listener);
        }
      }

      emit(data: any) {
        for (const listener of this.listeners) {
          listener({ data } as MessageEvent<any>);
        }
      }
    }

    Object.defineProperty(globalThis, "Worker", {
      value: class extends MockWorker {
        constructor() {
          super();
          workerInstances.push(this);
        }
      },
      configurable: true,
      writable: true,
    });

    vi.doMock("../utils/audio", () => ({
      audioBufferToWavBlob,
    }));

    vi.doMock("./usePreviewCache", () => ({
      previewAudioUrls: ref(new Map()),
      previewAudioSamples: shallowRef(new Map()),
      buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
      buildMixPreviewId: ({ voice, secondaryVoice }: { voice: string; secondaryVoice: string }) =>
        `mix:${voice}|${secondaryVoice}`,
      buildPronunciationPreviewId: ({ markup }: { markup: string }) => `pronunciation:${markup}`,
      storePreviewResult: vi.fn(),
      loadPreviewFromCache,
      clearPreviewCache: vi.fn(),
      deletePreviewCacheStorage: vi.fn(async () => true),
      revokeBlobUrl: vi.fn(),
    }));

    vi.doMock("./useGenerationHistory", () => ({
      generationHistory: ref([]),
      latestExportMetadata: ref(null),
      latestOutputSamples: ref(null),
      latestOutputHz: ref(null),
      appendHistoryItem,
      persistHistoryAudioToCache,
      clearGenerationHistory: vi.fn(async () => undefined),
      isHistoryAudioUrl: vi.fn(() => false),
      renameHistoryOutput: vi.fn(),
      removeHistoryOutput: vi.fn(async () => undefined),
      setLatestOutput,
      clearLatestOutput,
    }));

    const mod = await import("./useTtsWorker");
    const { useGenerationStore } = await import("../stores/generation");
    const { useVoiceStore } = await import("../stores/voice");

    const generation = useGenerationStore();
    const voice = useVoiceStore();
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 0;
    voice.speed = 1;
    voice.pitchSemitones = 0;
    voice.pauses.sentence.value = 150;
    voice.pauses.newline.value = 225;
    voice.pauses.paragraph.value = 325;

    mod.initWorker();
    const initialWorker = workerInstances[0]!;
    initialWorker.emit({ type: "init-progress", phase: "download" });
    expect(generation.activityPhase).toBe("model-loading");

    initialWorker.emit({ type: "init-progress", phase: "fallback" });
    expect(generation.activityPhase).toBe("model-fallback");

    initialWorker.emit({
      type: "ready",
      voices: [{ id: "af_heart", label: "Heart" }],
      language: "en-US",
      device: "webgpu",
    });
    expect(generation.status).toBe("ready");
    expect(generation.device).toBe("webgpu");
    expect(voice.language).toBe("en-US");

    const started = mod.generateAudio({
      type: "generate",
      text: "Hello there\nwith spacing",
      voice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 150,
      newlinePauseMs: 225,
      paragraphPauseMs: 325,
      fileName: "custom-name.wav",
    });
    expect(started).toBe(true);

    vi.advanceTimersByTime(400);
    expect(mod.generationElapsedMs.value).toBeGreaterThan(0);

    const synthBuffer = new Float32Array([0.1, -0.1]).buffer;
    initialWorker.emit({
      type: "result",
      audioBuffer: synthBuffer,
      sampleRate: 24000,
      mimeType: "audio/wav",
    });
    await Promise.resolve();
    await Promise.resolve();

    expect(setLatestOutput).toHaveBeenCalled();
    expect(audioBufferToWavBlob).toHaveBeenCalled();
    expect(createObjectURL).toHaveBeenCalled();
    expect(generation.audioUrl).toBe("blob:rendered");
    expect(persistHistoryAudioToCache).toHaveBeenCalled();
    expect(appendHistoryItem).toHaveBeenCalledWith(
      expect.objectContaining({
        fileName: "custom-name.wav",
        textLength: 24,
        textPreview: "Hello there with spacing",
        audioUrl: "blob:rendered",
      }),
    );

    mod.startWorker({ ...mod.buildInitMessage(), preferredDevice: "auto" });
    const retryWorker = workerInstances[1]!;
    retryWorker.emit({
      type: "error",
      message: "recoverable",
      recoverable: true,
    });
    expect(workerInstances.length).toBe(3);

    const finalWorker = workerInstances[2]!;
    finalWorker.emit({
      type: "error",
      message: "fatal failure",
      recoverable: false,
    });
    expect(generation.error).toBe("fatal failure");

    const noWorkerResult = mod.generateAudio({
      type: "generate",
      text: "Hello",
      voice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 150,
      newlinePauseMs: 225,
      paragraphPauseMs: 325,
      fileName: "out.wav",
    });
    expect(noWorkerResult).toBe(true);

    workerInstances.at(-1)?.terminate();
    mod.worker.value = null;
    expect(
      mod.generateAudio({
        type: "generate",
        text: "Hello",
        voice: "af_heart",
        secondaryVoice: "__none__",
        secondaryRatio: 0,
        speed: 1,
        pitchSemitones: 0,
        sentencePauseMs: 150,
        newlinePauseMs: 225,
        paragraphPauseMs: 325,
        fileName: "out.wav",
      }),
    ).toBe(false);
    expect(generation.error).toBe("Model worker is not ready.");

    vi.useRealTimers();
  });
});
