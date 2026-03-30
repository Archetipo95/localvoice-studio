import { ref } from "vue";
import type { ExportMetadata, GenerationHistoryItem } from "../types";
import {
  loadPersistedGenerationHistory,
  normalizeGenerationHistory,
  persistGenerationHistory,
} from "../utils/generation-history";
import { revokeBlobUrl } from "./usePreviewCache";

const GENERATION_HISTORY_CACHE_NAME = "kokoro-generation-history-audio-v1";
export const DEFAULT_OUTPUT_SAMPLE_RATE = 24000;

export const generationHistory = ref<GenerationHistoryItem[]>([]);
export const latestExportMetadata = ref<ExportMetadata | null>(null);
export const latestOutputSamples = ref<Float32Array | null>(null);
export const latestOutputHz = ref(DEFAULT_OUTPUT_SAMPLE_RATE);

function historyCachePath(cacheKey: string): string {
  return `/${encodeURIComponent(cacheKey)}`;
}

async function deleteHistoryCacheEntries(cacheKeys: readonly string[]) {
  if (cacheKeys.length === 0) return;
  try {
    const cache = await caches.open(GENERATION_HISTORY_CACHE_NAME);
    await Promise.all(cacheKeys.map((key) => cache.delete(historyCachePath(key))));
  } catch {
    // Ignore storage cleanup failures.
  }
}

export async function appendHistoryItem(item: GenerationHistoryItem) {
  const merged = normalizeGenerationHistory([item, ...generationHistory.value]);
  const mergedIds = new Set(merged.map((entry) => entry.id));
  const evicted = generationHistory.value.filter((entry) => !mergedIds.has(entry.id));

  for (const oldItem of evicted) {
    revokeBlobUrl(oldItem.audioUrl);
  }

  generationHistory.value = merged;
  persistGenerationHistory(merged);
  await deleteHistoryCacheEntries(evicted.map((entry) => entry.cacheKey));
}

export async function persistHistoryAudioToCache(cacheKey: string, blob: Blob, mimeType: string) {
  try {
    const cache = await caches.open(GENERATION_HISTORY_CACHE_NAME);
    await cache.put(
      historyCachePath(cacheKey),
      new Response(blob, { headers: { "Content-Type": mimeType } }),
    );
  } catch {
    // Non-critical — history audio cache is best-effort.
  }
}

export async function hydrateGenerationHistoryFromCache() {
  const persisted = loadPersistedGenerationHistory();
  if (persisted.length === 0) {
    generationHistory.value = [];
    return;
  }

  const hydrated: GenerationHistoryItem[] = [];

  try {
    const cache = await caches.open(GENERATION_HISTORY_CACHE_NAME);
    for (const item of persisted) {
      const response = await cache.match(historyCachePath(item.cacheKey));
      if (!response) continue;
      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      hydrated.push({ ...item, sizeBytes: item.sizeBytes ?? blob.size, audioUrl });
    }
  } catch {
    generationHistory.value = [];
    return;
  }

  generationHistory.value = normalizeGenerationHistory(hydrated);
}

export function renameHistoryOutput(
  itemId: string,
  nextName: string,
  currentAudioUrl: string | null,
) {
  const updated = generationHistory.value.map((item) =>
    item.id === itemId ? { ...item, fileName: nextName } : item,
  );
  generationHistory.value = updated;
  persistGenerationHistory(updated);

  const renamed = updated.find((item) => item.id === itemId);
  if (renamed?.audioUrl === currentAudioUrl && latestExportMetadata.value) {
    latestExportMetadata.value = { ...latestExportMetadata.value, fileName: nextName };
  }
}

export async function removeHistoryOutput(
  itemId: string,
  currentAudioUrl: string | null,
  onCurrentItemRemoved?: () => void,
): Promise<void> {
  const currentHistory = generationHistory.value;
  const target = currentHistory.find((item) => item.id === itemId);
  if (!target) return;

  revokeBlobUrl(target.audioUrl);

  const updated = currentHistory.filter((item) => item.id !== itemId);
  generationHistory.value = updated;
  persistGenerationHistory(updated);

  await deleteHistoryCacheEntries([target.cacheKey]);

  if (currentAudioUrl === target.audioUrl) {
    latestExportMetadata.value = null;
    latestOutputSamples.value = null;
    latestOutputHz.value = DEFAULT_OUTPUT_SAMPLE_RATE;
    onCurrentItemRemoved?.();
  }
}

export async function clearGenerationHistory() {
  for (const item of generationHistory.value) {
    revokeBlobUrl(item.audioUrl);
  }
  generationHistory.value = [];
  latestExportMetadata.value = null;
  latestOutputSamples.value = null;
  latestOutputHz.value = DEFAULT_OUTPUT_SAMPLE_RATE;

  try {
    await caches.delete(GENERATION_HISTORY_CACHE_NAME);
  } catch {
    // Ignore storage cleanup failures.
  }
}

export function isHistoryAudioUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return generationHistory.value.some((item) => item.audioUrl === url);
}

export function setLatestOutput(samples: Float32Array, hz: number) {
  latestOutputSamples.value = samples;
  latestOutputHz.value = hz;
}

export function clearLatestOutput() {
  latestOutputSamples.value = null;
  latestOutputHz.value = DEFAULT_OUTPUT_SAMPLE_RATE;
}
