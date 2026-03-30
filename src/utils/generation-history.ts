import type { GenerationHistoryItem, PersistedGenerationHistoryItem } from "../types";

export const GENERATION_HISTORY_KEY = "kokoro-generation-history:v1";
export const MAX_GENERATION_HISTORY_ITEMS = 20;

function isPersistedHistoryItem(value: unknown): value is PersistedGenerationHistoryItem {
  if (!value || typeof value !== "object") return false;
  const item = value as PersistedGenerationHistoryItem;
  return (
    typeof item.id === "string" &&
    Number.isFinite(item.createdAt) &&
    (item.sizeBytes === undefined || Number.isFinite(item.sizeBytes)) &&
    Number.isFinite(item.durationMs) &&
    Number.isFinite(item.textLength) &&
    typeof item.textPreview === "string" &&
    typeof item.voice === "string" &&
    typeof item.secondaryVoice === "string" &&
    Number.isFinite(item.secondaryRatio) &&
    Number.isFinite(item.speed) &&
    Number.isFinite(item.pitchSemitones) &&
    Number.isFinite(item.sentencePauseMs) &&
    Number.isFinite(item.newlinePauseMs) &&
    Number.isFinite(item.paragraphPauseMs) &&
    typeof item.fileName === "string" &&
    typeof item.cacheKey === "string"
  );
}

export function normalizeGenerationHistory(
  items: readonly GenerationHistoryItem[],
): GenerationHistoryItem[] {
  return items
    .slice(0, MAX_GENERATION_HISTORY_ITEMS)
    .filter((item) => item.audioUrl.length > 0)
    .sort((left, right) => right.createdAt - left.createdAt);
}

export function loadPersistedGenerationHistory(): PersistedGenerationHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(GENERATION_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPersistedHistoryItem).slice(0, MAX_GENERATION_HISTORY_ITEMS);
  } catch {
    return [];
  }
}

export function persistGenerationHistory(items: readonly GenerationHistoryItem[]) {
  try {
    const serializable: PersistedGenerationHistoryItem[] = normalizeGenerationHistory(items).map(
      (item) => ({
        id: item.id,
        createdAt: item.createdAt,
        sizeBytes: item.sizeBytes,
        durationMs: item.durationMs,
        textLength: item.textLength,
        textPreview: item.textPreview,
        voice: item.voice,
        secondaryVoice: item.secondaryVoice,
        secondaryRatio: item.secondaryRatio,
        speed: item.speed,
        pitchSemitones: item.pitchSemitones,
        sentencePauseMs: item.sentencePauseMs,
        newlinePauseMs: item.newlinePauseMs,
        paragraphPauseMs: item.paragraphPauseMs,
        fileName: item.fileName,
        cacheKey: item.cacheKey,
      }),
    );

    window.localStorage.setItem(GENERATION_HISTORY_KEY, JSON.stringify(serializable));
  } catch {
    // Ignore persistence failures (private mode / quota).
  }
}

export function clearPersistedGenerationHistory() {
  try {
    window.localStorage.removeItem(GENERATION_HISTORY_KEY);
  } catch {
    // Ignore storage failures.
  }
}
