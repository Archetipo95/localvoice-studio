import { ref } from "vue";
import { loadThemeMode, persistThemeMode, applyThemeMode, type ThemeMode } from "../utils/theme";
import type { VoicePreset, ModelDefinition } from "../types";

export const themeMode = ref<ThemeMode>(loadThemeMode());
export const editorViewMode = ref<"markup" | "plain">("markup");
export const secondaryVoiceControlsOpen = ref(false);
export const advancedControlsOpen = ref(false);
export const markupGuideOpen = ref(false);

export const runtimePreference = ref<"webgpu" | "wasm">("auto" as any); // will resolve on mount
export const voicePresets = ref<VoicePreset[]>([]);
export const selectedPresetId = ref<string>("");
export const modelDownloadApproved = ref(false);

// We will export a method to update theme:
export function setThemeMode(mode: ThemeMode) {
  themeMode.value = mode;
  persistThemeMode(mode);
  applyThemeMode(mode);
}

const VOICE_PRESETS_KEY_PREFIX = "kokoro-voice-presets:";

export function loadVoicePresets(model: ModelDefinition): VoicePreset[] {
  try {
    const raw = window.localStorage.getItem(`${VOICE_PRESETS_KEY_PREFIX}${model.modelId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (preset): preset is VoicePreset =>
          preset &&
          typeof preset.id === "string" &&
          typeof preset.name === "string" &&
          typeof preset.voice === "string" &&
          typeof preset.secondaryVoice === "string",
      )
      .map((preset) => ({
        ...preset,
        pitchSemitones: Number.isFinite(preset.pitchSemitones) ? preset.pitchSemitones : 0,
      }));
  } catch {
    return [];
  }
}

export function persistVoicePresets(model: ModelDefinition) {
  try {
    window.localStorage.setItem(
      `${VOICE_PRESETS_KEY_PREFIX}${model.modelId}`,
      JSON.stringify(voicePresets.value),
    );
  } catch {}
}
