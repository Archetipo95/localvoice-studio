import { defineStore } from "pinia";
import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";
import { NO_BLEND_VOICE } from "../utils/mix";
import { sortVoicesByGrade } from "../utils/voices";
import type { ModelDefinition, VoiceOption, VoicePreset } from "../types";

export const PAUSE_RANGES = {
  sentence: { min: 0, max: 400 },
  newline: { min: 0, max: 600 },
  paragraph: { min: 0, max: 900 },
} as const;
type PauseKey = keyof typeof PAUSE_RANGES;

function clampPitch(semitones: number): number {
  if (!Number.isFinite(semitones)) return 0;
  return Math.min(6, Math.max(-6, semitones));
}

function clampRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) return 0;
  return Math.min(100, Math.max(0, ratio));
}

function normalizeSpeed(speed: number): number {
  return Number.isFinite(speed) ? speed : 1;
}

function normalizePauseValue(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function normalizeRange(
  minMs: number,
  maxMs: number,
  fallback: { min: number; max: number },
): { min: number; max: number } {
  const safeMin = Number.isFinite(minMs) ? minMs : fallback.min;
  const safeMax = Number.isFinite(maxMs) ? maxMs : fallback.max;
  return { min: Math.min(safeMin, safeMax), max: Math.max(safeMin, safeMax) };
}

function resolveVoiceInList(voice: string, voices: VoiceOption[], fallback: string): string {
  return voices.some((v) => v.id === voice) ? voice : fallback;
}

export interface PauseSettings {
  value: number;
  min: number;
  max: number;
}

export const useVoiceStore = defineStore("voice", {
  state: () => ({
    voices: [] as VoiceOption[],
    selectedVoice: "",
    secondaryVoice: NO_BLEND_VOICE,
    secondaryRatio: 0,
    language: null as string | null,
    speed: 1,
    pitchSemitones: 0,
    pauses: {
      sentence: { value: LONG_TEXT_PAUSE_MS, ...PAUSE_RANGES.sentence } as PauseSettings,
      newline: { value: LONG_TEXT_NEWLINE_PAUSE_MS, ...PAUSE_RANGES.newline } as PauseSettings,
      paragraph: {
        value: LONG_TEXT_PARAGRAPH_PAUSE_MS,
        ...PAUSE_RANGES.paragraph,
      } as PauseSettings,
    },
  }),

  getters: {
    isDefaultTuning(state): boolean {
      return (
        state.speed === 1 &&
        state.pitchSemitones === 0 &&
        state.pauses.sentence.value === LONG_TEXT_PAUSE_MS &&
        state.pauses.newline.value === LONG_TEXT_NEWLINE_PAUSE_MS &&
        state.pauses.paragraph.value === LONG_TEXT_PARAGRAPH_PAUSE_MS
      );
    },
  },

  actions: {
    setPauseRange(kind: PauseKey, minMs: number, maxMs: number) {
      const range = normalizeRange(minMs, maxMs, PAUSE_RANGES[kind]);
      this.pauses[kind].min = range.min;
      this.pauses[kind].max = range.max;
      this.pauses[kind].value = normalizePauseValue(this.pauses[kind].value, 0);
    },

    setFromModel(model: ModelDefinition) {
      this.voices = model.voices;
      this.selectedVoice = model.voices[0]?.id ?? "";
      this.secondaryVoice = NO_BLEND_VOICE;
      this.secondaryRatio = 0;
      this.language = model.language ?? null;
    },

    setFromReady(voices: readonly VoiceOption[], language: string | null) {
      const sorted = sortVoicesByGrade([...voices]);
      const previousSecondaryVoice = this.secondaryVoice;
      const previousSecondaryRatio = this.secondaryRatio;
      this.voices = sorted;
      this.selectedVoice = sorted.some((v) => v.id === this.selectedVoice)
        ? this.selectedVoice
        : (sorted[0]?.id ?? "");

      const canKeepSecondaryVoice =
        previousSecondaryVoice !== NO_BLEND_VOICE &&
        previousSecondaryVoice !== this.selectedVoice &&
        sorted.some((voice) => voice.id === previousSecondaryVoice);

      this.secondaryVoice = canKeepSecondaryVoice ? previousSecondaryVoice : NO_BLEND_VOICE;
      this.secondaryRatio = canKeepSecondaryVoice ? previousSecondaryRatio : 0;
      this.language = language;
    },

    setVoice(voice: string) {
      if (this.secondaryVoice === voice) {
        this.secondaryVoice = NO_BLEND_VOICE;
        this.secondaryRatio = 0;
      }
      this.selectedVoice = voice;
    },

    setSecondaryVoice(voice: string) {
      if (voice === this.selectedVoice) {
        this.secondaryVoice = NO_BLEND_VOICE;
        this.secondaryRatio = 0;
        return;
      }
      this.secondaryVoice = voice;
    },

    setPitch(semitones: number) {
      this.pitchSemitones = clampPitch(semitones);
    },

    applyPreset(preset: VoicePreset) {
      const sentence = normalizeRange(
        preset.sentencePauseMinMs,
        preset.sentencePauseMaxMs,
        PAUSE_RANGES.sentence,
      );
      const newline = normalizeRange(
        preset.newlinePauseMinMs,
        preset.newlinePauseMaxMs,
        PAUSE_RANGES.newline,
      );
      const paragraph = normalizeRange(
        preset.paragraphPauseMinMs,
        preset.paragraphPauseMaxMs,
        PAUSE_RANGES.paragraph,
      );

      const requestedVoice = typeof preset.voice === "string" ? preset.voice : "";
      const requestedSecondaryVoice =
        typeof preset.secondaryVoice === "string" ? preset.secondaryVoice : NO_BLEND_VOICE;

      const selectedVoice = resolveVoiceInList(
        requestedVoice,
        this.voices,
        this.voices[0]?.id ?? this.selectedVoice,
      );
      const secondaryVoice = resolveVoiceInList(
        requestedSecondaryVoice,
        this.voices,
        NO_BLEND_VOICE,
      );
      const effectiveSecondary = secondaryVoice === selectedVoice ? NO_BLEND_VOICE : secondaryVoice;

      this.$patch({
        selectedVoice,
        secondaryVoice: effectiveSecondary,
        secondaryRatio:
          effectiveSecondary === NO_BLEND_VOICE ? 0 : clampRatio(preset.secondaryRatio),
        speed: normalizeSpeed(preset.speed),
        pitchSemitones: clampPitch(preset.pitchSemitones),
        pauses: {
          sentence: {
            value: normalizePauseValue(preset.sentencePauseMs, LONG_TEXT_PAUSE_MS),
            min: sentence.min,
            max: sentence.max,
          },
          newline: {
            value: normalizePauseValue(preset.newlinePauseMs, LONG_TEXT_NEWLINE_PAUSE_MS),
            min: newline.min,
            max: newline.max,
          },
          paragraph: {
            value: normalizePauseValue(preset.paragraphPauseMs, LONG_TEXT_PARAGRAPH_PAUSE_MS),
            min: paragraph.min,
            max: paragraph.max,
          },
        },
      });
    },

    resetToDefaults(model: ModelDefinition) {
      this.$patch({
        selectedVoice: this.voices[0]?.id ?? model.voices[0]?.id ?? "",
        secondaryVoice: NO_BLEND_VOICE,
        secondaryRatio: 0,
        speed: 1,
        pitchSemitones: 0,
        pauses: {
          sentence: { value: LONG_TEXT_PAUSE_MS, ...PAUSE_RANGES.sentence },
          newline: { value: LONG_TEXT_NEWLINE_PAUSE_MS, ...PAUSE_RANGES.newline },
          paragraph: { value: LONG_TEXT_PARAGRAPH_PAUSE_MS, ...PAUSE_RANGES.paragraph },
        },
      });
    },
  },
});
