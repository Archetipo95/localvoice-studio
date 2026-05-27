import { ref, shallowRef, watch, toRaw } from "vue";
import type {
  GenerateRequest,
  InitRequest,
  WorkerResponse,
  GeneratePreviewRequest,
  GeneratePronunciationPreviewRequest,
} from "../types";
import { useGenerationStore } from "../stores/generation";
import { useVoiceStore } from "../stores/voice";
import { useUiStore } from "../stores/ui";
import { audioBufferToWavBlob } from "../utils/audio";
import {
  storePreviewResult,
  loadPreviewFromCache,
  buildVoicePreviewId,
  buildMixPreviewId,
  buildPronunciationPreviewId,
  previewAudioUrls,
  clearPreviewCache,
  deletePreviewCacheStorage,
  revokeBlobUrl,
} from "./usePreviewCache";
import {
  latestExportMetadata,
  appendHistoryItem,
  persistHistoryAudioToCache,
  clearGenerationHistory,
  isHistoryAudioUrl,
  setLatestOutput,
  clearLatestOutput,
  renameHistoryOutput as renameHistoryOutputInHistory,
  removeHistoryOutput as removeHistoryOutputInHistory,
} from "./useGenerationHistory";
import { resolveOutputFileName, normalizeDownloadName } from "./useFilenameTemplate";
import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";

import { clearPersistedGenerationHistory } from "../utils/generation-history";

export const worker = shallowRef<Worker | null>(null);
export const activePreviewId = ref<string | null>(null);
export const hasRetriedWithWasm = ref(false);
export const generationElapsedMs = ref(0);
export const generationStartAt = ref<number | null>(null);
export const lastGenerationDurationMs = ref<number | null>(null);

const HISTORY_FILE_PREVIEW_LENGTH = 96;
const MIN_SPEED = 0.5;
const MAX_SPEED = 2;
const DEFAULT_PREVIEW_OPTIONS = {
  speed: 1,
  pitchSemitones: 0,
  sentencePauseMs: LONG_TEXT_PAUSE_MS,
  newlinePauseMs: LONG_TEXT_NEWLINE_PAUSE_MS,
  paragraphPauseMs: LONG_TEXT_PARAGRAPH_PAUSE_MS,
};

let elapsedTimer: number | null = null;
let pendingGenerateRequest: GenerateRequest | null = null;

interface PreviewBatch {
  previewIds: Set<string>;
}

let activeBatch: PreviewBatch | null = null;
const previewOutputAliases = new Map<string, string>();
const pendingPronunciationPreviewRequests = new Map<
  string,
  {
    resolve: (url: string) => void;
    reject: (error: Error) => void;
  }
>();
let pronunciationPreviewAudio: HTMLAudioElement | null = null;

function normalizeSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return 1;
  }
  return Math.min(MAX_SPEED, Math.max(MIN_SPEED, speed));
}

function normalizeSecondaryRatio(secondaryRatio: number): number {
  if (!Number.isFinite(secondaryRatio)) {
    return 0;
  }
  return Math.min(100, Math.max(0, secondaryRatio));
}

function normalizeGenerateRequest(request: GenerateRequest): GenerateRequest {
  return {
    ...request,
    voice: request.voice.trim(),
    secondaryVoice: request.secondaryVoice.trim(),
    secondaryRatio: normalizeSecondaryRatio(request.secondaryRatio),
    speed: normalizeSpeed(request.speed),
  };
}

function normalizePreviewRequest(request: GeneratePreviewRequest): GeneratePreviewRequest {
  return {
    ...request,
    voice: request.voice.trim(),
    secondaryVoice: request.secondaryVoice?.trim(),
    secondaryRatio: normalizeSecondaryRatio(request.secondaryRatio ?? 0),
    speed: normalizeSpeed(request.speed),
  };
}

function normalizePronunciationPreviewRequest(
  request: GeneratePronunciationPreviewRequest,
): GeneratePronunciationPreviewRequest {
  return {
    ...request,
    voice: request.voice.trim(),
    secondaryVoice: request.secondaryVoice?.trim(),
    secondaryRatio: normalizeSecondaryRatio(request.secondaryRatio ?? 0),
    speed: normalizeSpeed(request.speed),
  };
}

function startElapsedTimer() {
  generationStartAt.value = Date.now();
  generationElapsedMs.value = 0;
  if (elapsedTimer !== null) {
    window.clearInterval(elapsedTimer);
  }
  elapsedTimer = window.setInterval(() => {
    const startedAt = generationStartAt.value;
    if (startedAt) {
      generationElapsedMs.value = Date.now() - startedAt;
    }
  }, 200);
}

function stopElapsedTimer() {
  if (elapsedTimer !== null) {
    window.clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
  const startedAt = generationStartAt.value;
  if (startedAt) {
    generationElapsedMs.value = Math.max(generationElapsedMs.value, Date.now() - startedAt);
    lastGenerationDurationMs.value = generationElapsedMs.value;
  }
  generationStartAt.value = null;
}

function resetTransientOutputState() {
  const gen = useGenerationStore();

  for (const pending of pendingPronunciationPreviewRequests.values()) {
    pending.reject(new Error("Pronunciation preview canceled."));
  }
  pendingPronunciationPreviewRequests.clear();
  stopPronunciationAudio();
  gen.clearAudio();
  clearPreviewCache();
  activePreviewId.value = null;
  activeBatch = null;
  previewOutputAliases.clear();
  latestExportMetadata.value = null;
  clearLatestOutput();
  stopElapsedTimer();
  generationElapsedMs.value = 0;
  lastGenerationDurationMs.value = null;
  hasRetriedWithWasm.value = false;
}

function handleWorkerMessage(message: WorkerResponse, initMessage: InitRequest) {
  const gen = useGenerationStore();
  const voice = useVoiceStore();

  switch (message.type) {
    case "init-progress":
      if (message.phase === "fallback") {
        gen.setInitFallback();
      } else {
        gen.setInitLoading();
      }
      break;

    case "ready":
      voice.setFromReady(message.voices, message.language ?? null);
      gen.setReady(message.device);
      break;

    case "result": {
      stopElapsedTimer();

      const fileName =
        pendingGenerateRequest?.fileName || resolveOutputFileName(voice.selectedVoice);

      // Retain a typed view over the transferred buffer instead of copying PCM again.
      setLatestOutput(new Float32Array(message.audioBuffer), message.sampleRate);

      const blob = audioBufferToWavBlob(message.audioBuffer, message.sampleRate, message.mimeType);
      const audioUrl = URL.createObjectURL(blob);
      gen.setAudioReady(audioUrl);

      const exportMetadata = {
        mimeType: message.mimeType,
        extension: "wav" as const,
        bitDepth: 16 as const,
        sizeBytes: blob.size,
        fileName,
      };
      latestExportMetadata.value = exportMetadata;

      const now = Date.now();
      const historyId = `${now}-${Math.random().toString(36).slice(2, 9)}`;
      const historyCacheKey = `history:${historyId}`;
      const sourceText = pendingGenerateRequest?.text ?? "";

      void (async () => {
        await persistHistoryAudioToCache(historyCacheKey, blob, message.mimeType);
        await appendHistoryItem({
          id: historyId,
          createdAt: now,
          sizeBytes: blob.size,
          durationMs: lastGenerationDurationMs.value ?? 0,
          textLength: sourceText.length,
          textPreview: sourceText.replace(/\s+/g, " ").trim().slice(0, HISTORY_FILE_PREVIEW_LENGTH),
          voice: pendingGenerateRequest?.voice ?? voice.selectedVoice,
          secondaryVoice: pendingGenerateRequest?.secondaryVoice ?? voice.secondaryVoice,
          secondaryRatio: pendingGenerateRequest?.secondaryRatio ?? voice.secondaryRatio,
          speed: pendingGenerateRequest?.speed ?? voice.speed,
          pitchSemitones: pendingGenerateRequest?.pitchSemitones ?? voice.pitchSemitones,
          sentencePauseMs: pendingGenerateRequest?.sentencePauseMs ?? voice.pauses.sentence.value,
          newlinePauseMs: pendingGenerateRequest?.newlinePauseMs ?? voice.pauses.newline.value,
          paragraphPauseMs:
            pendingGenerateRequest?.paragraphPauseMs ?? voice.pauses.paragraph.value,
          fileName,
          audioUrl,
          cacheKey: historyCacheKey,
        });
      })();

      pendingGenerateRequest = null;
      break;
    }

    case "preview-result": {
      if (!activeBatch?.previewIds.has(message.previewId)) {
        previewOutputAliases.delete(message.previewId);
        break;
      }

      const blob = audioBufferToWavBlob(message.audioBuffer, message.sampleRate, message.mimeType);
      const url = URL.createObjectURL(blob);
      storePreviewResult(
        message.previewId,
        message.mimeType,
        blob,
        url,
        previewOutputAliases.get(message.previewId),
      );
      previewOutputAliases.delete(message.previewId);
      completePreview(message.previewId, gen);
      break;
    }

    case "pronunciation-preview-result": {
      const blob = audioBufferToWavBlob(message.audioBuffer, message.sampleRate, message.mimeType);
      const url = URL.createObjectURL(blob);
      storePreviewResult(message.previewId, message.mimeType, blob, url);
      pendingPronunciationPreviewRequests.get(message.previewId)?.resolve(url);
      pendingPronunciationPreviewRequests.delete(message.previewId);
      break;
    }

    case "pronunciation-preview-error": {
      pendingPronunciationPreviewRequests
        .get(message.previewId)
        ?.reject(new Error(message.message || "Pronunciation preview failed."));
      pendingPronunciationPreviewRequests.delete(message.previewId);
      break;
    }

    case "error":
      stopElapsedTimer();
      pendingGenerateRequest = null;

      if (
        "recoverable" in message &&
        message.recoverable &&
        initMessage.preferredDevice === "auto" &&
        !hasRetriedWithWasm.value
      ) {
        hasRetriedWithWasm.value = true;
        startWorker({ ...initMessage, preferredDevice: "wasm" });
        return;
      }

      gen.setError(message.message);
      break;
  }
}

export function startWorker(initMessage: InitRequest) {
  worker.value?.terminate();
  worker.value = new Worker(new URL("../workers/tts-worker.ts", import.meta.url), {
    type: "module",
  });

  worker.value.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
    handleWorkerMessage(event.data, initMessage);
  });

  worker.value.postMessage(initMessage);
}

function isMockTtsMode() {
  return new URL(window.location.href).searchParams.get("mockTts") === "1";
}

export function buildInitMessage(): InitRequest {
  const gen = useGenerationStore();
  const ui = useUiStore();
  const url = new URL(window.location.href);
  const mockTts = isMockTtsMode();
  const mockDevice = url.searchParams.get("mockDevice");
  const explicitDevice = url.searchParams.get("forceDevice");

  const preferredDevice =
    explicitDevice === "webgpu" || explicitDevice === "wasm"
      ? explicitDevice
      : ui.runtimePreference;

  const model = structuredClone(toRaw(gen.model));

  return {
    type: "init",
    preferredDevice,
    model,
    mock: mockTts
      ? {
          enabled: true,
          deviceMode:
            mockDevice === "fallback" || mockDevice === "wasm" || mockDevice === "webgpu"
              ? mockDevice
              : preferredDevice,
        }
      : undefined,
  };
}

export function initWorker() {
  useGenerationStore().setInitLoading();
  startWorker(buildInitMessage());
}

export function generateAudio(request: GenerateRequest): boolean {
  const gen = useGenerationStore();
  const normalizedRequest = normalizeGenerateRequest(request);

  if (!normalizedRequest.text.trim()) {
    gen.setError("Text is required.");
    return false;
  }

  if (!normalizedRequest.voice) {
    gen.setError("A voice must be selected.");
    return false;
  }

  if (!worker.value) {
    gen.setError("Model worker is not ready.");
    return false;
  }

  pendingGenerateRequest = normalizedRequest;
  startElapsedTimer();
  gen.clearError();
  gen.startGeneration();
  worker.value.postMessage(normalizedRequest);
  return true;
}

function stopGeneration(showCanceledError: boolean) {
  worker.value?.postMessage({ type: "cancel" });
  stopElapsedTimer();
  pendingGenerateRequest = null;
  if (showCanceledError) {
    useGenerationStore().setError("Generation canceled.");
  }
}

export function cancelGeneration() {
  stopGeneration(true);
}

export function resetStudioState() {
  stopGeneration(false);

  const voice = useVoiceStore();
  const gen = useGenerationStore();

  voice.resetToDefaults(gen.model);
  gen.resetControls();

  latestExportMetadata.value = null;
  clearLatestOutput();
}

export function requestPreviews() {
  const gen = useGenerationStore();
  const voice = useVoiceStore();
  if (!voice.selectedVoice || gen.status !== "ready") return;

  gen.startPreview();

  const finalOptions = {
    speed: normalizeSpeed(voice.speed),
    pitchSemitones: voice.pitchSemitones,
    sentencePauseMs: voice.pauses.sentence.value,
    newlinePauseMs: voice.pauses.newline.value,
    paragraphPauseMs: voice.pauses.paragraph.value,
  };

  const requests: GeneratePreviewRequest[] = [
    {
      type: "generate-preview",
      previewId: buildVoicePreviewId({ voice: voice.selectedVoice, ...DEFAULT_PREVIEW_OPTIONS }),
      voice: voice.selectedVoice,
      ...DEFAULT_PREVIEW_OPTIONS,
    },
  ];

  if (voice.secondaryVoice && voice.secondaryVoice !== "__none__") {
    requests.push({
      type: "generate-preview",
      previewId: buildVoicePreviewId({ voice: voice.secondaryVoice, ...DEFAULT_PREVIEW_OPTIONS }),
      voice: voice.secondaryVoice,
      ...DEFAULT_PREVIEW_OPTIONS,
    });
  }

  requests.push({
    type: "generate-preview",
    previewId: buildMixPreviewId({
      voice: voice.selectedVoice,
      secondaryVoice: voice.secondaryVoice,
      secondaryRatio: voice.secondaryRatio,
      ...finalOptions,
    }),
    voice: voice.selectedVoice,
    secondaryVoice: voice.secondaryVoice,
    secondaryRatio: voice.secondaryRatio,
    ...finalOptions,
  });

  previewOutputAliases.clear();
  activeBatch = {
    previewIds: new Set(requests.map((r) => r.previewId)),
  };

  // For a mix preview with no secondary voice, register an output-style alias
  // so the cache can be cross-referenced without re-generating.
  const mixRequest = requests[requests.length - 1]!;
  if (!mixRequest.secondaryVoice || mixRequest.secondaryVoice === "__none__") {
    const tuningKey = [
      `speed:${mixRequest.speed.toFixed(2)}`,
      `pitch:${mixRequest.pitchSemitones.toFixed(1)}`,
      `sentence:${mixRequest.sentencePauseMs}`,
      `newline:${mixRequest.newlinePauseMs}`,
      `paragraph:${mixRequest.paragraphPauseMs}`,
    ].join("|");
    previewOutputAliases.set(mixRequest.previewId, `output:${mixRequest.voice}|${tuningKey}`);
  }

  const requestPreview = async (request: GeneratePreviewRequest) => {
    const normalizedRequest = normalizePreviewRequest(request);
    const cached = await loadPreviewFromCache(normalizedRequest.previewId);
    if (cached) {
      completePreview(normalizedRequest.previewId, gen);
      return;
    }

    if (worker.value) {
      worker.value.postMessage(normalizedRequest);
      return;
    }

    // No worker available; avoid leaving preview phase stuck.
    completePreview(normalizedRequest.previewId, gen);
  };

  for (const request of requests) {
    void requestPreview(request);
  }
}

function stopPronunciationAudio() {
  if (!pronunciationPreviewAudio) return;
  pronunciationPreviewAudio.pause();
  pronunciationPreviewAudio.currentTime = 0;
}

function pauseDocumentAudio() {
  document.querySelectorAll("audio").forEach((audio) => {
    if (!audio.paused) {
      audio.pause();
      audio.currentTime = 0;
    }
  });
}

function buildPronunciationRequest(options: {
  markup: string;
  voice: string;
  secondaryVoice: string;
  secondaryRatio: number;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
}): GeneratePronunciationPreviewRequest {
  const gen = useGenerationStore();

  return normalizePronunciationPreviewRequest({
    type: "generate-pronunciation-preview",
    previewId: buildPronunciationPreviewId({
      modelId: gen.model.modelId,
      markup: options.markup,
      voice: options.voice,
      secondaryVoice: options.secondaryVoice,
      secondaryRatio: options.secondaryRatio,
      speed: options.speed,
      pitchSemitones: options.pitchSemitones,
      sentencePauseMs: options.sentencePauseMs,
      newlinePauseMs: options.newlinePauseMs,
      paragraphPauseMs: options.paragraphPauseMs,
    }),
    text: options.markup,
    voice: options.voice,
    secondaryVoice: options.secondaryVoice,
    secondaryRatio: options.secondaryRatio,
    speed: options.speed,
    pitchSemitones: options.pitchSemitones,
    sentencePauseMs: options.sentencePauseMs,
    newlinePauseMs: options.newlinePauseMs,
    paragraphPauseMs: options.paragraphPauseMs,
  });
}

export function buildCurrentPronunciationPreviewRequest(markup: string) {
  const voice = useVoiceStore();

  return buildPronunciationRequest({
    markup,
    voice: voice.selectedVoice,
    secondaryVoice: voice.secondaryVoice,
    secondaryRatio: voice.secondaryRatio,
    speed: voice.speed,
    pitchSemitones: voice.pitchSemitones,
    sentencePauseMs: voice.pauses.sentence.value,
    newlinePauseMs: voice.pauses.newline.value,
    paragraphPauseMs: voice.pauses.paragraph.value,
  });
}

export async function requestPronunciationPreview(markup: string): Promise<string> {
  const request = buildCurrentPronunciationPreviewRequest(markup);

  if (await loadPreviewFromCache(request.previewId)) {
    return previewAudioUrls.value.get(request.previewId) ?? "";
  }

  if (!worker.value) {
    throw new Error("Model worker is not ready.");
  }

  return await new Promise<string>((resolve, reject) => {
    pendingPronunciationPreviewRequests.set(request.previewId, { resolve, reject });
    worker.value?.postMessage(request);
  });
}

export async function playPronunciationPreview(markup: string): Promise<string> {
  const url = await requestPronunciationPreview(markup);
  if (!url) {
    throw new Error("Pronunciation preview is unavailable.");
  }

  pauseDocumentAudio();
  stopPronunciationAudio();

  if (!pronunciationPreviewAudio) {
    pronunciationPreviewAudio = new Audio();
  }

  pronunciationPreviewAudio.src = url;
  pronunciationPreviewAudio.currentTime = 0;
  await pronunciationPreviewAudio.play();

  return url;
}

function completePreview(previewId: string, generation: ReturnType<typeof useGenerationStore>) {
  if (!activeBatch) return;

  // Ignore stale preview responses from earlier batches.
  if (!activeBatch.previewIds.has(previewId)) return;

  activeBatch.previewIds.delete(previewId);
  if (activeBatch.previewIds.size === 0) {
    generation.setPreviewReady(generation.status);
    activeBatch = null;
  }
}

export function renameHistoryOutput(itemId: string, nextName: string) {
  renameHistoryOutputInHistory(
    itemId,
    normalizeDownloadName(nextName),
    useGenerationStore().audioUrl,
  );
}

export async function removeHistoryOutput(itemId: string) {
  await removeHistoryOutputInHistory(itemId, useGenerationStore().audioUrl, () => {
    useGenerationStore().clearAudio();
  });
}

export async function clearSavedAudioCache() {
  resetTransientOutputState();
  await clearGenerationHistory();
  clearPersistedGenerationHistory();
  await deletePreviewCacheStorage();
}

/** Activate reactive watchers to track changes and manage state transitions.
 * Should be called once during app initialization (e.g., in App.vue setup).
 */
export function setupWorkerWatchers() {
  const gen = useGenerationStore();

  watch(
    () => gen.audioUrl,
    (next, previous) => {
      if (previous && previous !== next && !isHistoryAudioUrl(previous)) {
        revokeBlobUrl(previous);
      }
    },
  );

  watch(
    () => gen.model.modelId,
    (next, previous) => {
      if (previous && previous !== next) {
        stopPronunciationAudio();
        resetTransientOutputState();
        void deletePreviewCacheStorage();
      }
    },
  );
}
