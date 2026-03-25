import { defineStore } from "pinia";
import { loadThemeMode, persistThemeMode, applyThemeMode, type ThemeMode } from "../utils/theme";
import { preferredDeviceFromEnvironment, hasWebGPU } from "../utils/runtime";
import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";
import type { ModelDefinition, VoicePreset } from "../types";
import { PAUSE_RANGES } from "./voice";

const VOICE_PRESETS_KEY_PREFIX = "kokoro-voice-presets:";
const RUNTIME_PREF_KEY = "kokoro-runtime-pref";

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRequiredString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function clampPresetRatio(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function clampPresetPitch(value: unknown): number {
  if (!isFiniteNumber(value)) return 0;
  return Math.min(6, Math.max(-6, value));
}

function normalizePresetPauseValue(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? Math.max(0, value) : fallback;
}

function normalizePresetPauseRange(
  minValue: unknown,
  maxValue: unknown,
  fallback: { min: number; max: number },
): { min: number; max: number } {
  const min = isFiniteNumber(minValue) ? minValue : fallback.min;
  const max = isFiniteNumber(maxValue) ? maxValue : fallback.max;
  return { min: Math.min(min, max), max: Math.max(min, max) };
}

function repairVoicePreset(value: unknown): VoicePreset | null {
  if (!value || typeof value !== "object") return null;

  const preset = value as Record<string, unknown>;
  if (
    !isRequiredString(preset.id) ||
    !isRequiredString(preset.name) ||
    !isRequiredString(preset.voice) ||
    !isRequiredString(preset.secondaryVoice)
  ) {
    return null;
  }

  const sentence = normalizePresetPauseRange(
    preset.sentencePauseMinMs,
    preset.sentencePauseMaxMs,
    PAUSE_RANGES.sentence,
  );
  const newline = normalizePresetPauseRange(
    preset.newlinePauseMinMs,
    preset.newlinePauseMaxMs,
    PAUSE_RANGES.newline,
  );
  const paragraph = normalizePresetPauseRange(
    preset.paragraphPauseMinMs,
    preset.paragraphPauseMaxMs,
    PAUSE_RANGES.paragraph,
  );

  return {
    id: preset.id,
    name: preset.name.trim(),
    voice: preset.voice,
    secondaryVoice: preset.secondaryVoice,
    secondaryRatio: clampPresetRatio(preset.secondaryRatio),
    speed: isFiniteNumber(preset.speed) ? preset.speed : 1,
    pitchSemitones: clampPresetPitch(preset.pitchSemitones),
    sentencePauseMs: normalizePresetPauseValue(preset.sentencePauseMs, LONG_TEXT_PAUSE_MS),
    sentencePauseMinMs: sentence.min,
    sentencePauseMaxMs: sentence.max,
    newlinePauseMs: normalizePresetPauseValue(preset.newlinePauseMs, LONG_TEXT_NEWLINE_PAUSE_MS),
    newlinePauseMinMs: newline.min,
    newlinePauseMaxMs: newline.max,
    paragraphPauseMs: normalizePresetPauseValue(
      preset.paragraphPauseMs,
      LONG_TEXT_PARAGRAPH_PAUSE_MS,
    ),
    paragraphPauseMinMs: paragraph.min,
    paragraphPauseMaxMs: paragraph.max,
  };
}

function isVoicePreset(value: VoicePreset | null): value is VoicePreset {
  return value !== null;
}

function loadRuntimePreference(): "webgpu" | "wasm" {
  try {
    const stored = window.localStorage.getItem(RUNTIME_PREF_KEY);
    if (stored === "webgpu" || stored === "wasm") return stored;
  } catch {}
  return preferredDeviceFromEnvironment("auto", hasWebGPU()) as "webgpu" | "wasm";
}

export const useUiStore = defineStore("ui", {
  state: () => ({
    themeMode: loadThemeMode() as ThemeMode,
    editorViewMode: "markup" as "markup" | "plain",
    secondaryVoiceControlsOpen: false,
    advancedControlsOpen: false,
    markupGuideOpen: false,
    runtimePreference: loadRuntimePreference() as "webgpu" | "wasm",
    voicePresets: [] as VoicePreset[],
    selectedPresetId: "",
    modelDownloadApproved: false,
  }),

  actions: {
    setThemeMode(mode: ThemeMode) {
      this.themeMode = mode;
      persistThemeMode(mode);
      applyThemeMode(mode);
    },

    setEditorViewMode(mode: "markup" | "plain") {
      this.editorViewMode = mode;
    },

    setRuntimePreference(pref: "webgpu" | "wasm") {
      this.runtimePreference = pref;
      try {
        window.localStorage.setItem(RUNTIME_PREF_KEY, pref);
      } catch {
        // Ignore persistence failures (private mode / quota).
      }
    },

    setModelDownloadApproved(approved: boolean) {
      this.modelDownloadApproved = approved;
    },

    loadVoicePresets(model: ModelDefinition) {
      try {
        const raw = window.localStorage.getItem(`${VOICE_PRESETS_KEY_PREFIX}${model.modelId}`);
        const parsed = raw ? JSON.parse(raw) : null;
        this.voicePresets = Array.isArray(parsed)
          ? parsed.map(repairVoicePreset).filter(isVoicePreset)
          : [];
      } catch {
        this.voicePresets = [];
      }
    },

    persistVoicePresets(model: ModelDefinition) {
      try {
        window.localStorage.setItem(
          `${VOICE_PRESETS_KEY_PREFIX}${model.modelId}`,
          JSON.stringify(this.voicePresets),
        );
      } catch {
        // Ignore persistence failures.
      }
    },

    upsertPreset(preset: VoicePreset, model: ModelDefinition) {
      const existing = this.voicePresets.find((p) => p.id === preset.id);
      if (existing) {
        this.voicePresets = this.voicePresets.map((p) => (p.id === preset.id ? preset : p));
      } else {
        this.voicePresets = [preset, ...this.voicePresets];
      }
      this.selectedPresetId = preset.id;
      this.persistVoicePresets(model);
    },

    deletePreset(id: string, model: ModelDefinition) {
      this.voicePresets = this.voicePresets.filter((p) => p.id !== id);
      if (this.selectedPresetId === id) {
        this.selectedPresetId = "";
      }
      this.persistVoicePresets(model);
    },

    selectPreset(id: string) {
      this.selectedPresetId = id;
    },
  },
});
