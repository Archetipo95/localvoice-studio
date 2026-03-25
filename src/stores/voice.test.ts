import { beforeEach, describe, expect, it } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import { createModelDefinition } from "../config/model-config";
import type { VoiceOption } from "../types";
import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";
import { NO_BLEND_VOICE } from "../utils/mix";
import { useVoiceStore } from "./voice";

describe("useVoiceStore", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("resets blend state when selecting the same voice as secondary", () => {
    const voice = useVoiceStore();

    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "am_michael";
    voice.secondaryRatio = 35;

    voice.setVoice("am_michael");

    expect(voice.selectedVoice).toBe("am_michael");
    expect(voice.secondaryVoice).toBe(NO_BLEND_VOICE);
    expect(voice.secondaryRatio).toBe(0);
  });

  it("normalizes pause ranges and preserves non-negative pause values", () => {
    const voice = useVoiceStore();

    voice.pauses.sentence.value = 225;
    voice.pauses.newline.value = 300;
    voice.pauses.paragraph.value = 450;

    voice.setPauseRange("sentence", 220, 180);
    voice.setPauseRange("newline", 350, 250);
    voice.setPauseRange("paragraph", 500, 400);

    expect(voice.pauses.sentence.min).toBe(180);
    expect(voice.pauses.sentence.max).toBe(220);
    expect(voice.pauses.sentence.value).toBe(225);
    expect(voice.pauses.newline.min).toBe(250);
    expect(voice.pauses.newline.max).toBe(350);
    expect(voice.pauses.newline.value).toBe(300);
    expect(voice.pauses.paragraph.min).toBe(400);
    expect(voice.pauses.paragraph.max).toBe(500);
    expect(voice.pauses.paragraph.value).toBe(450);
  });

  it("clamps pitch and allows direct pause assignment via Pinia state", () => {
    const voice = useVoiceStore();

    voice.setPitch(10);
    expect(voice.pitchSemitones).toBe(6);

    voice.setPitch(-10);
    expect(voice.pitchSemitones).toBe(-6);

    voice.pauses.sentence.value = Math.max(-40, 0);
    voice.pauses.newline.value = Math.max(-15, 0);
    voice.pauses.paragraph.value = Math.max(-5, 0);

    expect(voice.pauses.sentence.value).toBe(0);
    expect(voice.pauses.newline.value).toBe(0);
    expect(voice.pauses.paragraph.value).toBe(0);
  });

  it("defensively sanitizes invalid preset numbers from direct callers", () => {
    const voice = useVoiceStore();
    voice.voices = [
      { id: "af_heart", label: "Heart" },
      { id: "bf_emma", label: "Emma" },
    ];
    voice.selectedVoice = "af_heart";

    voice.applyPreset({
      id: "broken",
      name: "Broken",
      voice: "af_heart",
      secondaryVoice: "bf_emma",
      secondaryRatio: 150,
      speed: Number.NaN,
      pitchSemitones: Number.NaN,
      sentencePauseMs: Number.NaN,
      sentencePauseMinMs: Number.NaN,
      sentencePauseMaxMs: Number.NaN,
      newlinePauseMs: -50,
      newlinePauseMinMs: Number.NaN,
      newlinePauseMaxMs: Number.NaN,
      paragraphPauseMs: Number.NaN,
      paragraphPauseMinMs: Number.NaN,
      paragraphPauseMaxMs: Number.NaN,
    } as any);

    expect(voice.secondaryVoice).toBe("bf_emma");
    expect(voice.secondaryRatio).toBe(100);
    expect(voice.speed).toBe(1);
    expect(voice.pitchSemitones).toBe(0);
    expect(voice.pauses.sentence.value).toBe(LONG_TEXT_PAUSE_MS);
    expect(voice.pauses.newline.value).toBe(0);
    expect(voice.pauses.paragraph.value).toBe(LONG_TEXT_PARAGRAPH_PAUSE_MS);
  });

  it("applies presets with normalized ranges and resolved voices", () => {
    const voice = useVoiceStore();
    const availableVoices: VoiceOption[] = [
      { id: "af_heart", label: "Heart" },
      { id: "bf_emma", label: "Emma" },
    ];
    voice.voices = availableVoices;
    voice.selectedVoice = "af_heart";

    voice.applyPreset({
      id: "preset-1",
      name: "Podcast",
      voice: "missing",
      secondaryVoice: "af_heart",
      secondaryRatio: 30,
      speed: 1.1,
      pitchSemitones: Number.NaN,
      sentencePauseMs: -10,
      sentencePauseMinMs: 250,
      sentencePauseMaxMs: 50,
      newlinePauseMs: 280,
      newlinePauseMinMs: 400,
      newlinePauseMaxMs: 100,
      paragraphPauseMs: 420,
      paragraphPauseMinMs: 500,
      paragraphPauseMaxMs: 150,
    });

    expect(voice.selectedVoice).toBe("af_heart");
    expect(voice.secondaryVoice).toBe(NO_BLEND_VOICE);
    expect(voice.secondaryRatio).toBe(0);
    expect(voice.speed).toBe(1.1);
    expect(voice.pitchSemitones).toBe(0);
    expect(voice.pauses.sentence.value).toBe(0);
    expect(voice.pauses.sentence.min).toBe(50);
    expect(voice.pauses.sentence.max).toBe(250);
    expect(voice.pauses.newline.min).toBe(100);
    expect(voice.pauses.newline.max).toBe(400);
    expect(voice.pauses.paragraph.min).toBe(150);
    expect(voice.pauses.paragraph.max).toBe(500);
  });

  it("resets to model defaults", () => {
    const voice = useVoiceStore();
    const model = createModelDefinition("custom/demo-model");

    voice.voices = [{ id: "am_michael", label: "Michael" }];
    voice.selectedVoice = "bf_emma";
    voice.secondaryVoice = "af_heart";
    voice.secondaryRatio = 30;
    voice.speed = 1.5;
    voice.pitchSemitones = 2;
    voice.pauses.sentence.value = 250;
    voice.pauses.sentence.min = 25;
    voice.pauses.sentence.max = 450;
    voice.pauses.newline.value = 350;
    voice.pauses.newline.min = 50;
    voice.pauses.newline.max = 700;
    voice.pauses.paragraph.value = 500;
    voice.pauses.paragraph.min = 75;
    voice.pauses.paragraph.max = 1000;

    voice.resetToDefaults(model);

    expect(voice.selectedVoice).toBe("am_michael");
    expect(voice.secondaryVoice).toBe(NO_BLEND_VOICE);
    expect(voice.secondaryRatio).toBe(0);
    expect(voice.speed).toBe(1);
    expect(voice.pitchSemitones).toBe(0);
    expect(voice.pauses.sentence.value).toBe(LONG_TEXT_PAUSE_MS);
    expect(voice.pauses.sentence.min).toBe(0);
    expect(voice.pauses.sentence.max).toBe(400);
    expect(voice.pauses.newline.value).toBe(LONG_TEXT_NEWLINE_PAUSE_MS);
    expect(voice.pauses.newline.min).toBe(0);
    expect(voice.pauses.newline.max).toBe(600);
    expect(voice.pauses.paragraph.value).toBe(LONG_TEXT_PARAGRAPH_PAUSE_MS);
    expect(voice.pauses.paragraph.min).toBe(0);
    expect(voice.pauses.paragraph.max).toBe(900);
  });

  it("loads voice state from a model and from ready voices", () => {
    const voice = useVoiceStore();
    const model = createModelDefinition("custom/demo-model");
    model.voices = [
      { id: "bf_emma", label: "Emma", overallGrade: "A" },
      { id: "af_heart", label: "Heart", overallGrade: "A+" },
    ];
    model.language = "en-US";

    voice.setFromModel(model);
    expect(voice.voices).toEqual(model.voices);
    expect(voice.selectedVoice).toBe("bf_emma");
    expect(voice.secondaryVoice).toBe(NO_BLEND_VOICE);
    expect(voice.secondaryRatio).toBe(0);
    expect(voice.language).toBe("en-US");

    voice.selectedVoice = "bf_emma";
    voice.secondaryVoice = "af_heart";
    voice.secondaryRatio = 45;
    voice.setFromReady(model.voices, "en-GB");
    expect(voice.voices.map((item) => item.id)).toEqual(["af_heart", "bf_emma"]);
    expect(voice.selectedVoice).toBe("bf_emma");
    expect(voice.secondaryVoice).toBe("af_heart");
    expect(voice.secondaryRatio).toBe(45);
    expect(voice.language).toBe("en-GB");

    voice.selectedVoice = "missing";
    voice.secondaryVoice = "missing-too";
    voice.secondaryRatio = 60;
    voice.setFromReady([{ id: "am_michael", label: "Michael", overallGrade: "B" }], null);
    expect(voice.selectedVoice).toBe("am_michael");
    expect(voice.secondaryVoice).toBe(NO_BLEND_VOICE);
    expect(voice.secondaryRatio).toBe(0);
    expect(voice.language).toBe(null);
  });

  it("resets secondary voice when selecting the same voice explicitly", () => {
    const voice = useVoiceStore();
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "bf_emma";
    voice.secondaryRatio = 35;

    voice.setSecondaryVoice("af_heart");
    expect(voice.secondaryVoice).toBe(NO_BLEND_VOICE);
    expect(voice.secondaryRatio).toBe(0);

    voice.setSecondaryVoice("bf_emma");
    expect(voice.secondaryVoice).toBe("bf_emma");
  });

  it("reports whether tuning is still at the defaults", () => {
    const voice = useVoiceStore();
    expect(voice.isDefaultTuning).toBe(true);
    voice.speed = 1.2;
    expect(voice.isDefaultTuning).toBe(false);
  });

  it("falls back when preset voice fields are not strings and reset defaults can use the model voice list", () => {
    const voice = useVoiceStore();
    const model = createModelDefinition("custom/demo-model");
    model.voices = [{ id: "bf_emma", label: "Emma" }];

    voice.voices = [];
    voice.selectedVoice = "";

    voice.applyPreset({
      id: "preset-2",
      name: "Broken",
      voice: 123 as any,
      secondaryVoice: 456 as any,
      secondaryRatio: 40,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 100,
      sentencePauseMinMs: 0,
      sentencePauseMaxMs: 200,
      newlinePauseMs: 100,
      newlinePauseMinMs: 0,
      newlinePauseMaxMs: 200,
      paragraphPauseMs: 100,
      paragraphPauseMinMs: 0,
      paragraphPauseMaxMs: 200,
    });

    expect(voice.selectedVoice).toBe("");
    expect(voice.secondaryVoice).toBe(NO_BLEND_VOICE);

    voice.resetToDefaults(model);
    expect(voice.selectedVoice).toBe("bf_emma");
  });
});
