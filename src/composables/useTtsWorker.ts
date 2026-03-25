import { ref, shallowRef, watch, toRaw } from "vue";
import type {
  GenerateRequest,
  InitRequest,
  WorkerResponse,
  GeneratePreviewRequest,
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
  if (!request.text.trim()) {
    gen.setError("Text is required.");
    return false;
  }

  if (!worker.value) {
    gen.setError("Model worker is not ready.");
    return false;
  }

  pendingGenerateRequest = request;
  startElapsedTimer();
  gen.clearError();
  gen.startGeneration();
  worker.value.postMessage(request);
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
    speed: voice.speed,
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
    const cached = await loadPreviewFromCache(request.previewId);
    if (cached) {
      completePreview(request.previewId, gen);
      return;
    }

    if (worker.value) {
      worker.value.postMessage(request);
      return;
    }

    // No worker available; avoid leaving preview phase stuck.
    completePreview(request.previewId, gen);
  };

  for (const request of requests) {
    void requestPreview(request);
  }
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
        resetTransientOutputState();
        void deletePreviewCacheStorage();
      }
    },
  );
}
