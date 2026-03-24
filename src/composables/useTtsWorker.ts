import { shallowRef, ref, watch } from "vue";
import type { InitRequest, GenerateRequest, WorkerResponse } from "../types";
import { useAppState } from "./useAppState";
import { audioBufferToWavBlob } from "../utils/audio";
import { runtimePreference } from "./useUiState";
import { preferredDeviceFromEnvironment, hasWebGPU } from "../utils/runtime";
import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";

export const worker = shallowRef<Worker | null>(null);
export const activePreviewId = ref<string | null>(null);
export const previewAudioUrls = ref<Map<string, string>>(new Map());
export const previewAudioSamples = shallowRef<Map<string, Float32Array>>(new Map());
export const latestOutputSamples = shallowRef<Float32Array | null>(null);
export const latestOutputSampleRate = ref(24000);
export const hasRetriedWithWasm = ref(false);

const { state, dispatch } = useAppState();
const PREVIEW_AUDIO_CACHE_NAME = "kokoro-preview-audio-v1";
const DEFAULT_PREVIEW_OPTIONS = {
  speed: 1,
  pitchSemitones: 0,
  sentencePauseMs: LONG_TEXT_PAUSE_MS,
  newlinePauseMs: LONG_TEXT_NEWLINE_PAUSE_MS,
  paragraphPauseMs: LONG_TEXT_PARAGRAPH_PAUSE_MS,
};

function formatPreviewTuningKey(options: {
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
}) {
  return [
    `speed:${options.speed.toFixed(2)}`,
    `pitch:${options.pitchSemitones.toFixed(1)}`,
    `sentence:${options.sentencePauseMs}`,
    `newline:${options.newlinePauseMs}`,
    `paragraph:${options.paragraphPauseMs}`,
  ].join("|");
}

export function buildVoicePreviewId(options: {
  voice: string;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
}) {
  return `voice:${options.voice}|${formatPreviewTuningKey(options)}`;
}

export function buildMixPreviewId(options: {
  voice: string;
  secondaryVoice: string;
  secondaryRatio: number;
  speed: number;
  pitchSemitones: number;
  sentencePauseMs: number;
  newlinePauseMs: number;
  paragraphPauseMs: number;
}) {
  return `mix:${options.voice}|${options.secondaryVoice}|${options.secondaryRatio}|${formatPreviewTuningKey(options)}`;
}

function revokeBlobUrl(url: string | null | undefined) {
  if (!url || !url.startsWith("blob:")) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore revocation failures in constrained environments.
  }
}

export async function clearSavedAudioCache() {
  dispatch({ type: "clear-audio" });

  for (const url of previewAudioUrls.value.values()) {
    revokeBlobUrl(url);
  }

  previewAudioUrls.value = new Map();
  previewAudioSamples.value = new Map();
  activePreviewId.value = null;
  latestOutputSamples.value = null;
  latestOutputSampleRate.value = 24000;

  try {
    await caches.delete(PREVIEW_AUDIO_CACHE_NAME);
  } catch {
    // Ignore storage cleanup failures.
  }
}

watch(
  () => state.value.audioUrl,
  (next, previous) => {
    if (previous && previous !== next) {
      revokeBlobUrl(previous);
    }
  },
);

watch(
  () => state.value.model.modelId,
  (next, previous) => {
    if (previous && previous !== next) {
      void clearSavedAudioCache();
    }
  },
);

function isMockTtsMode() {
  const url = new URL(window.location.href);
  return url.searchParams.get("mockTts") === "1";
}

export function buildInitMessage() {
  const model = state.value.model;
  const url = new URL(window.location.href);
  const mockTts = isMockTtsMode();
  const mockDevice = url.searchParams.get("mockDevice");
  const explicitDevice = url.searchParams.get("forceDevice");
  const gpuAvailable = hasWebGPU();

  if (runtimePreference.value === ("auto" as any)) {
    runtimePreference.value = preferredDeviceFromEnvironment("auto", gpuAvailable) as any;
  }

  const preferredDevice =
    explicitDevice === "webgpu" || explicitDevice === "wasm"
      ? explicitDevice
      : runtimePreference.value;

  return {
    type: "init" as const,
    preferredDevice: preferredDevice as any,
    model,
    mock: mockTts
      ? {
          enabled: true,
          deviceMode: (mockDevice === "fallback" || mockDevice === "wasm" || mockDevice === "webgpu"
            ? mockDevice
            : preferredDevice) as any,
        }
      : undefined,
  };
}

export function initWorker() {
  dispatch({ type: "init-loading" });
  startWorker(buildInitMessage());
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

function handleWorkerMessage(message: WorkerResponse, initMessage: InitRequest) {
  switch (message.type) {
    case "init-progress":
      dispatch({ type: message.phase === "fallback" ? "init-fallback" : "init-loading" });
      break;
    case "ready":
      dispatch({
        type: "ready",
        device: message.device,
        voices: message.voices,
        language: message.language ?? null,
      });
      break;
    case "result": {
      latestOutputSamples.value = new Float32Array(message.audioBuffer.slice(0));
      latestOutputSampleRate.value = message.sampleRate;
      const blob = audioBufferToWavBlob(message.audioBuffer, message.sampleRate, message.mimeType);
      const audioUrl = URL.createObjectURL(blob);
      dispatch({ type: "audio-ready", audioUrl });

      void (async () => {
        try {
          const cache = await caches.open(PREVIEW_AUDIO_CACHE_NAME);
          const outputKey = `output:${state.value.selectedVoice}|speed:${state.value.speed.toFixed(2)}|pitch:${state.value.pitchSemitones.toFixed(1)}`;
          const reqUrl = `/${encodeURIComponent(outputKey)}`;
          await cache.put(
            reqUrl,
            new Response(blob, { headers: { "Content-Type": message.mimeType } }),
          );
        } catch {
          // Ignore cache write failures for non-critical preview persistence.
        }
      })();

      break;
    }
    case "preview-result": {
      const blob = audioBufferToWavBlob(message.audioBuffer, message.sampleRate, message.mimeType);
      const url = URL.createObjectURL(blob);
      revokeBlobUrl(previewAudioUrls.value.get(message.previewId));
      const newMap = new Map(previewAudioUrls.value);
      newMap.set(message.previewId, url);
      previewAudioUrls.value = newMap;

      const newSamplesMap = new Map(previewAudioSamples.value);
      newSamplesMap.set(message.previewId, new Float32Array(message.audioBuffer.slice(0)));
      previewAudioSamples.value = newSamplesMap;

      void (async () => {
        try {
          const cache = await caches.open(PREVIEW_AUDIO_CACHE_NAME);
          const reqUrl = `/${encodeURIComponent(message.previewId)}`;
          const res = new Response(blob, { headers: { "Content-Type": message.mimeType } });
          await cache.put(reqUrl, res);

          if (message.previewId.startsWith("mix:") && message.previewId.includes("__none__|0|")) {
            const parts = message.previewId.split("|");
            const primaryVoice = parts[0]!.split(":")[1]!;
            const tuningParts = parts.slice(3);
            const outputKey = `output:${primaryVoice}|${tuningParts.join("|")}`;
            await cache.put(
              `/${encodeURIComponent(outputKey)}`,
              new Response(blob, { headers: { "Content-Type": message.mimeType } }),
            );
          }
        } catch {
          // Ignore cache write failures for non-critical preview persistence.
        }
      })();

      break;
    }
    case "error":
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
      dispatch({ type: "error", message: message.message });
      break;
  }
}

export function generateAudio(request: GenerateRequest) {
  dispatch({ type: "clear-error" });
  dispatch({ type: "generate-start" });
  worker.value?.postMessage(request);
}

export function cancelGeneration() {
  worker.value?.postMessage({ type: "cancel" });
  dispatch({ type: "error", message: "Generation canceled." });
}

async function checkCacheAndRequest(req: any) {
  if (previewAudioUrls.value.has(req.previewId)) return;

  try {
    const cache = await caches.open(PREVIEW_AUDIO_CACHE_NAME);
    const url = `/${encodeURIComponent(req.previewId)}`;
    const response = await cache.match(url);
    if (response) {
      const blob = await response.blob();
      revokeBlobUrl(previewAudioUrls.value.get(req.previewId));
      const newMap = new Map(previewAudioUrls.value);
      newMap.set(req.previewId, URL.createObjectURL(blob));
      previewAudioUrls.value = newMap;
      return;
    }
  } catch {}

  worker.value?.postMessage(req);
}

export function requestPreviews() {
  if (!state.value.selectedVoice || state.value.status !== "ready") return;
  dispatch({ type: "preview-start" });

  const finalPreviewOptions = {
    speed: state.value.speed,
    pitchSemitones: state.value.pitchSemitones,
    sentencePauseMs: state.value.sentencePauseMs,
    newlinePauseMs: state.value.newlinePauseMs,
    paragraphPauseMs: state.value.paragraphPauseMs,
  };

  checkCacheAndRequest({
    type: "generate-preview",
    previewId: buildVoicePreviewId({
      voice: state.value.selectedVoice,
      ...DEFAULT_PREVIEW_OPTIONS,
    }),
    voice: state.value.selectedVoice,
    ...DEFAULT_PREVIEW_OPTIONS,
  });

  if (state.value.secondaryVoice && state.value.secondaryVoice !== "__none__") {
    checkCacheAndRequest({
      type: "generate-preview",
      previewId: buildVoicePreviewId({
        voice: state.value.secondaryVoice,
        ...DEFAULT_PREVIEW_OPTIONS,
      }),
      voice: state.value.secondaryVoice,
      ...DEFAULT_PREVIEW_OPTIONS,
    });
  }

  checkCacheAndRequest({
    type: "generate-preview",
    previewId: buildMixPreviewId({
      voice: state.value.selectedVoice,
      secondaryVoice: state.value.secondaryVoice,
      secondaryRatio: state.value.secondaryRatio,
      ...finalPreviewOptions,
    }),
    voice: state.value.selectedVoice,
    secondaryVoice: state.value.secondaryVoice,
    secondaryRatio: state.value.secondaryRatio,
    ...finalPreviewOptions,
  });
}
