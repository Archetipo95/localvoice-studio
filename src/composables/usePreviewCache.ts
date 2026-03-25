import { readonly, ref } from "vue";

const PREVIEW_AUDIO_CACHE_NAME = "kokoro-preview-audio-v1";
const MAX_PREVIEW_CACHE_SIZE = 30;

// Module-private reactive state. Consumers read via the exported readonly refs.
const _previewAudioUrls = ref<Map<string, string>>(new Map());

/** Readonly view of the preview URL map for reactive consumers. */
export const previewAudioUrls = readonly(_previewAudioUrls);

export function revokeBlobUrl(url: string | null | undefined) {
  if (!url || !url.startsWith("blob:")) return;
  try {
    URL.revokeObjectURL(url);
  } catch {
    // Ignore revocation failures in constrained environments.
  }
}

function trimPreviewMaps() {
  const urlMap = _previewAudioUrls.value;
  if (urlMap.size <= MAX_PREVIEW_CACHE_SIZE) return;

  const keysToEvict = [...urlMap.keys()].slice(0, urlMap.size - MAX_PREVIEW_CACHE_SIZE);
  const newUrlMap = new Map(urlMap);

  for (const key of keysToEvict) {
    revokeBlobUrl(newUrlMap.get(key));
    newUrlMap.delete(key);
  }

  _previewAudioUrls.value = newUrlMap;
}

export function storePreviewResult(
  previewId: string,
  mimeType: string,
  blob: Blob,
  url: string,
  outputAlias?: string,
) {
  revokeBlobUrl(_previewAudioUrls.value.get(previewId));

  const newUrlMap = new Map(_previewAudioUrls.value);
  newUrlMap.set(previewId, url);
  _previewAudioUrls.value = newUrlMap;

  trimPreviewMaps();

  void persistPreviewToCache(previewId, blob, mimeType, outputAlias);
}

// ---------------------------------------------------------------------------
// Preview ID builders — stable keys used to identify cached previews.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Cache persistence
// ---------------------------------------------------------------------------

async function persistPreviewToCache(
  previewId: string,
  blob: Blob,
  mimeType: string,
  outputAlias?: string,
) {
  try {
    const cache = await caches.open(PREVIEW_AUDIO_CACHE_NAME);
    const response = new Response(blob, { headers: { "Content-Type": mimeType } });
    await cache.put(`/${encodeURIComponent(previewId)}`, response);
    if (outputAlias) {
      await cache.put(
        `/${encodeURIComponent(outputAlias)}`,
        new Response(blob, { headers: { "Content-Type": mimeType } }),
      );
    }
  } catch {
    // Non-critical — preview cache is best-effort.
  }
}

export async function loadPreviewFromCache(previewId: string): Promise<boolean> {
  if (_previewAudioUrls.value.has(previewId)) return true;

  try {
    const cache = await caches.open(PREVIEW_AUDIO_CACHE_NAME);
    const url = `/${encodeURIComponent(previewId)}`;
    const response = await cache.match(url);
    if (!response) return false;

    const blob = await response.blob();
    revokeBlobUrl(_previewAudioUrls.value.get(previewId));
    const newMap = new Map(_previewAudioUrls.value);
    newMap.set(previewId, URL.createObjectURL(blob));
    _previewAudioUrls.value = newMap;
    trimPreviewMaps();
    return true;
  } catch {
    return false;
  }
}

export function clearPreviewCache() {
  for (const url of _previewAudioUrls.value.values()) {
    revokeBlobUrl(url);
  }
  _previewAudioUrls.value = new Map();
}

export async function deletePreviewCacheStorage() {
  try {
    await caches.delete(PREVIEW_AUDIO_CACHE_NAME);
  } catch {
    // Ignore storage cleanup failures.
  }
}
