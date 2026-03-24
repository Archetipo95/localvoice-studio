import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";
import { NO_BLEND_VOICE } from "../utils/mix";
import { DEFAULT_MODEL } from "../config/model-config";
import type { AppState, ModelDefinition, RuntimeDevice, VoiceOption, VoicePreset } from "../types";
import { sortVoicesByGrade } from "../utils/voices";

export type StateAction =
  | { type: "model"; model: ModelDefinition }
  | { type: "init-loading" }
  | { type: "init-fallback" }
  | { type: "ready"; device: RuntimeDevice; voices: VoiceOption[]; language: string | null }
  | { type: "reset-controls" }
  | { type: "text"; text: string }
  | { type: "voice"; voice: string }
  | { type: "secondary-voice"; voice: string }
  | { type: "secondary-ratio"; ratio: number }
  | { type: "apply-preset"; preset: VoicePreset }
  | { type: "speed"; speed: number }
  | { type: "pitch"; semitones: number }
  | { type: "sentence-pause"; pauseMs: number }
  | { type: "sentence-pause-range"; minMs: number; maxMs: number }
  | { type: "newline-pause"; pauseMs: number }
  | { type: "newline-pause-range"; minMs: number; maxMs: number }
  | { type: "paragraph-pause"; pauseMs: number }
  | { type: "paragraph-pause-range"; minMs: number; maxMs: number }
  | { type: "generate-start" }
  | { type: "preview-start" }
  | { type: "audio-ready"; audioUrl: string }
  | { type: "clear-audio" }
  | { type: "preview-ready" }
  | { type: "error"; message: string }
  | { type: "clear-error" };

export function createInitialState(model: ModelDefinition = DEFAULT_MODEL): AppState {
  return {
    status: "idle",
    activityPhase: "idle",
    model,
    device: null,
    voices: model.voices,
    selectedVoice: model.voices[0]?.id ?? "",
    secondaryVoice: NO_BLEND_VOICE,
    secondaryRatio: 0,
    language: model.language ?? null,
    text: "“Leave the place [better](+1) than you found it” is a philosophy of [stewardship](/stjuːɚdʃɪp/), encouraging individuals to leave physical spaces, relationships, and workplaces in a better state than when they arrived. It emphasizes taking personal responsibility for improvement, such as cleaning up, adding value, or contributing positively for the benefit of the next person.",
    speed: 1,
    pitchSemitones: 0,
    sentencePauseMs: LONG_TEXT_PAUSE_MS,
    sentencePauseMinMs: 0,
    sentencePauseMaxMs: 400,
    newlinePauseMs: LONG_TEXT_NEWLINE_PAUSE_MS,
    newlinePauseMinMs: 0,
    newlinePauseMaxMs: 600,
    paragraphPauseMs: LONG_TEXT_PARAGRAPH_PAUSE_MS,
    paragraphPauseMinMs: 0,
    paragraphPauseMaxMs: 900,
    error: null,
    audioUrl: null,
    canCancel: false,
  };
}

function clampMin(value: number, min: number): number {
  return Math.max(value, min);
}

function normalizedRange(minMs: number, maxMs: number): { minMs: number; maxMs: number } {
  return {
    minMs: Math.min(minMs, maxMs),
    maxMs: Math.max(minMs, maxMs),
  };
}

function resolvePresetVoice(voice: string, voices: VoiceOption[], fallback: string): string {
  return voices.some((option) => option.id === voice) ? voice : fallback;
}

export function reduceAppState(state: AppState, action: StateAction): AppState {
  switch (action.type) {
    case "model":
      return {
        ...state,
        model: action.model,
        status: "loading",
        activityPhase: "model-loading",
        device: null,
        voices: action.model.voices,
        selectedVoice: action.model.voices[0]?.id ?? "",
        secondaryVoice: NO_BLEND_VOICE,
        secondaryRatio: 0,
        language: action.model.language ?? null,
        error: null,
        audioUrl: null,
        canCancel: false,
      };
    case "init-loading":
      if (
        state.status === "loading" &&
        state.activityPhase === "model-loading" &&
        state.canCancel === false &&
        state.error === null
      ) {
        return state;
      }

      return {
        ...state,
        status: "loading",
        activityPhase: "model-loading",
        canCancel: false,
        error: null,
      };
    case "init-fallback":
      if (
        state.status === "loading" &&
        state.activityPhase === "model-fallback" &&
        state.error === null
      ) {
        return state;
      }

      return {
        ...state,
        status: "loading",
        activityPhase: "model-fallback",
        error: null,
      };
    case "ready":
      const sortedVoices = sortVoicesByGrade(action.voices);
      const selectedVoice = sortedVoices.some((voice) => voice.id === state.selectedVoice)
        ? state.selectedVoice
        : (sortedVoices[0]?.id ?? "");
      return {
        ...state,
        status: "ready",
        activityPhase: "idle",
        device: action.device,
        voices: sortedVoices,
        selectedVoice,
        secondaryVoice: NO_BLEND_VOICE,
        secondaryRatio: 0,
        language: action.language,
        error: null,
      };
    case "text":
      return {
        ...state,
        text: action.text,
      };
    case "reset-controls": {
      const defaults = createInitialState(state.model);
      return {
        ...state,
        status: state.device ? "ready" : "idle",
        activityPhase: "idle",
        selectedVoice: state.voices[0]?.id ?? defaults.selectedVoice,
        secondaryVoice: defaults.secondaryVoice,
        secondaryRatio: defaults.secondaryRatio,
        text: defaults.text,
        speed: defaults.speed,
        pitchSemitones: defaults.pitchSemitones,
        sentencePauseMs: defaults.sentencePauseMs,
        sentencePauseMinMs: defaults.sentencePauseMinMs,
        sentencePauseMaxMs: defaults.sentencePauseMaxMs,
        newlinePauseMs: defaults.newlinePauseMs,
        newlinePauseMinMs: defaults.newlinePauseMinMs,
        newlinePauseMaxMs: defaults.newlinePauseMaxMs,
        paragraphPauseMs: defaults.paragraphPauseMs,
        paragraphPauseMinMs: defaults.paragraphPauseMinMs,
        paragraphPauseMaxMs: defaults.paragraphPauseMaxMs,
        error: null,
        audioUrl: null,
        canCancel: false,
      };
    }
    case "voice":
      if (state.secondaryVoice === action.voice) {
        return {
          ...state,
          selectedVoice: action.voice,
          secondaryVoice: NO_BLEND_VOICE,
          secondaryRatio: 0,
        };
      }
      return {
        ...state,
        selectedVoice: action.voice,
      };
    case "secondary-voice":
      if (action.voice === state.selectedVoice) {
        return {
          ...state,
          secondaryVoice: NO_BLEND_VOICE,
          secondaryRatio: 0,
        };
      }
      return {
        ...state,
        secondaryVoice: action.voice,
      };
    case "secondary-ratio":
      return {
        ...state,
        secondaryRatio: action.ratio,
      };
    case "apply-preset": {
      const sentenceRange = normalizedRange(
        action.preset.sentencePauseMinMs,
        action.preset.sentencePauseMaxMs,
      );
      const newlineRange = normalizedRange(
        action.preset.newlinePauseMinMs,
        action.preset.newlinePauseMaxMs,
      );
      const paragraphRange = normalizedRange(
        action.preset.paragraphPauseMinMs,
        action.preset.paragraphPauseMaxMs,
      );
      const selectedVoice = resolvePresetVoice(
        action.preset.voice,
        state.voices,
        state.voices[0]?.id ?? state.selectedVoice,
      );
      const secondaryVoice = resolvePresetVoice(
        action.preset.secondaryVoice,
        state.voices,
        NO_BLEND_VOICE,
      );

      return {
        ...state,
        selectedVoice,
        secondaryVoice: secondaryVoice === selectedVoice ? NO_BLEND_VOICE : secondaryVoice,
        secondaryRatio:
          secondaryVoice === selectedVoice || secondaryVoice === NO_BLEND_VOICE
            ? 0
            : action.preset.secondaryRatio,
        speed: action.preset.speed,
        pitchSemitones: Number.isFinite(action.preset.pitchSemitones)
          ? action.preset.pitchSemitones
          : 0,
        sentencePauseMinMs: sentenceRange.minMs,
        sentencePauseMaxMs: sentenceRange.maxMs,
        sentencePauseMs: clampMin(action.preset.sentencePauseMs, 0),
        newlinePauseMinMs: newlineRange.minMs,
        newlinePauseMaxMs: newlineRange.maxMs,
        newlinePauseMs: clampMin(action.preset.newlinePauseMs, 0),
        paragraphPauseMinMs: paragraphRange.minMs,
        paragraphPauseMaxMs: paragraphRange.maxMs,
        paragraphPauseMs: clampMin(action.preset.paragraphPauseMs, 0),
      };
    }
    case "speed":
      return {
        ...state,
        speed: action.speed,
      };
    case "pitch":
      return {
        ...state,
        pitchSemitones: Math.min(6, Math.max(-6, action.semitones)),
      };
    case "sentence-pause":
      return {
        ...state,
        sentencePauseMs: clampMin(action.pauseMs, 0),
      };
    case "sentence-pause-range": {
      const minMs = Math.min(action.minMs, action.maxMs);
      const maxMs = Math.max(action.minMs, action.maxMs);
      return {
        ...state,
        sentencePauseMinMs: minMs,
        sentencePauseMaxMs: maxMs,
        sentencePauseMs: clampMin(state.sentencePauseMs, 0),
      };
    }
    case "newline-pause":
      return {
        ...state,
        newlinePauseMs: clampMin(action.pauseMs, 0),
      };
    case "newline-pause-range": {
      const minMs = Math.min(action.minMs, action.maxMs);
      const maxMs = Math.max(action.minMs, action.maxMs);
      return {
        ...state,
        newlinePauseMinMs: minMs,
        newlinePauseMaxMs: maxMs,
        newlinePauseMs: clampMin(state.newlinePauseMs, 0),
      };
    }
    case "paragraph-pause":
      return {
        ...state,
        paragraphPauseMs: clampMin(action.pauseMs, 0),
      };
    case "paragraph-pause-range": {
      const minMs = Math.min(action.minMs, action.maxMs);
      const maxMs = Math.max(action.minMs, action.maxMs);
      return {
        ...state,
        paragraphPauseMinMs: minMs,
        paragraphPauseMaxMs: maxMs,
        paragraphPauseMs: clampMin(state.paragraphPauseMs, 0),
      };
    }
    case "generate-start":
      return {
        ...state,
        status: "generating",
        activityPhase: "generating",
        canCancel: true,
        error: null,
      };
    case "preview-start":
      if (state.activityPhase === "preview-loading") {
        return state;
      }

      return {
        ...state,
        activityPhase: "preview-loading",
      };
    case "audio-ready":
      return {
        ...state,
        status: "ready",
        activityPhase: "idle",
        audioUrl: action.audioUrl,
        canCancel: false,
      };
    case "clear-audio":
      if (state.audioUrl === null) {
        return state;
      }

      return {
        ...state,
        audioUrl: null,
        canCancel: false,
      };
    case "preview-ready": {
      const nextActivityPhase = state.status === "loading" ? "model-loading" : "idle";
      if (state.activityPhase === nextActivityPhase) {
        return state;
      }

      return {
        ...state,
        activityPhase: nextActivityPhase,
      };
    }
    case "error":
      if (
        state.status === "error" &&
        state.activityPhase === "error" &&
        state.error === action.message &&
        state.canCancel === false
      ) {
        return state;
      }

      return {
        ...state,
        status: "error",
        activityPhase: "error",
        error: action.message,
        canCancel: false,
      };
    case "clear-error":
      if (state.error === null) {
        return state;
      }

      return {
        ...state,
        error: null,
      };
    default:
      return state;
  }
}
