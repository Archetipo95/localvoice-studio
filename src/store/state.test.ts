import { describe, expect, it } from "vitest";

import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";
import { createModelDefinition } from "../config/model-config";
import { createInitialState, reduceAppState } from "./state";

describe("app state reducer", () => {
  it("creates an initial state from the model defaults", () => {
    const initial = createInitialState();
    const custom = createInitialState(createModelDefinition("custom/demo-model"));

    expect(initial.selectedVoice).toBe("af_heart");
    expect(initial.language).toBe("English");
    expect(initial.pitchSemitones).toBe(0);
    expect(initial.sentencePauseMs).toBe(LONG_TEXT_PAUSE_MS);
    expect(initial.sentencePauseMinMs).toBe(0);
    expect(initial.sentencePauseMaxMs).toBe(400);
    expect(initial.newlinePauseMs).toBe(LONG_TEXT_NEWLINE_PAUSE_MS);
    expect(initial.newlinePauseMinMs).toBe(0);
    expect(initial.newlinePauseMaxMs).toBe(600);
    expect(initial.paragraphPauseMs).toBe(LONG_TEXT_PARAGRAPH_PAUSE_MS);
    expect(initial.paragraphPauseMinMs).toBe(0);
    expect(initial.paragraphPauseMaxMs).toBe(900);
    expect(custom.selectedVoice).toBe("");
    expect(custom.language).toBeNull();
  });

  it("moves from loading to ready", () => {
    const loading = reduceAppState(createInitialState(), { type: "init-loading" });
    const ready = reduceAppState(loading, {
      type: "ready",
      device: "webgpu",
      voices: [{ id: "default", label: "Default voice" }],
      language: "English",
    });

    expect(loading.status).toBe("loading");
    expect(loading.activityPhase).toBe("model-loading");
    expect(ready.status).toBe("ready");
    expect(ready.activityPhase).toBe("idle");
    expect(ready.device).toBe("webgpu");
    expect(ready.secondaryVoice).toBe("__none__");
    expect(ready.secondaryRatio).toBe(0);
  });

  it("tracks generated audio urls", () => {
    const generating = reduceAppState(createInitialState(), { type: "generate-start" });
    const next = reduceAppState(generating, {
      type: "audio-ready",
      audioUrl: "blob:demo",
    });

    expect(next.status).toBe("ready");
    expect(next.activityPhase).toBe("idle");
    expect(next.audioUrl).toBe("blob:demo");
  });

  it("clears generated audio urls without disturbing ready state", () => {
    const withAudio = reduceAppState(createInitialState(), {
      type: "audio-ready",
      audioUrl: "blob:demo",
    });
    const next = reduceAppState(withAudio, { type: "clear-audio" });

    expect(next.status).toBe("ready");
    expect(next.activityPhase).toBe("idle");
    expect(next.audioUrl).toBeNull();
    expect(next.canCancel).toBe(false);
  });

  it("stores validation errors", () => {
    const next = reduceAppState(createInitialState(), {
      type: "error",
      message: "Text is required.",
    });

    expect(next.status).toBe("error");
    expect(next.activityPhase).toBe("error");
    expect(next.error).toBe("Text is required.");
  });

  it("resets voice controls when switching models", () => {
    const startingState = reduceAppState(createInitialState(), {
      type: "voice",
      voice: "am_michael",
    });
    const next = reduceAppState(startingState, {
      type: "model",
      model: createModelDefinition("custom/demo-kokoro-model"),
    });

    expect(next.status).toBe("loading");
    expect(next.activityPhase).toBe("model-loading");
    expect(next.selectedVoice).toBe("");
    expect(next.secondaryVoice).toBe("__none__");
    expect(next.audioUrl).toBeNull();
  });

  it("keeps a selected voice when it still exists after sorting on ready", () => {
    const initial = {
      ...createInitialState(),
      selectedVoice: "am_michael",
      secondaryVoice: "bf_emma",
      secondaryRatio: 25,
      error: "old error",
    };
    const next = reduceAppState(initial, {
      type: "ready",
      device: "wasm",
      voices: [
        { id: "af_heart", label: "Heart", overallGrade: "B" },
        { id: "am_michael", label: "Michael", overallGrade: "A+" },
      ],
      language: null,
    });

    expect(next.selectedVoice).toBe("am_michael");
    expect(next.secondaryVoice).toBe("__none__");
    expect(next.secondaryRatio).toBe(0);
    expect(next.error).toBeNull();
  });

  it("falls back to the first ready voice when the selected voice is gone", () => {
    const next = reduceAppState(
      { ...createInitialState(), selectedVoice: "missing" },
      {
        type: "ready",
        device: "wasm",
        voices: [{ id: "voice-a", label: "Voice A" }],
        language: "English",
      },
    );

    expect(next.selectedVoice).toBe("voice-a");
  });

  it("clears the selected voice when ready arrives with no voices", () => {
    const next = reduceAppState(createInitialState(), {
      type: "ready",
      device: "wasm",
      voices: [],
      language: null,
    });

    expect(next.selectedVoice).toBe("");
  });

  it("resets controls differently depending on whether a device is ready", () => {
    const idleReset = reduceAppState(createInitialState(), { type: "reset-controls" });
    expect(idleReset.status).toBe("idle");

    const readyState = {
      ...createInitialState(),
      device: "webgpu" as const,
      status: "ready" as const,
      voices: [{ id: "am_michael", label: "Michael" }],
      selectedVoice: "af_heart",
      secondaryVoice: "bf_emma",
      secondaryRatio: 35,
      speed: 1.5,
      pitchSemitones: 3,
      sentencePauseMs: 250,
      sentencePauseMinMs: 25,
      sentencePauseMaxMs: 450,
      newlinePauseMs: 350,
      newlinePauseMinMs: 50,
      newlinePauseMaxMs: 700,
      paragraphPauseMs: 500,
      paragraphPauseMinMs: 75,
      paragraphPauseMaxMs: 1000,
      text: "Changed",
      error: "Problem",
      audioUrl: "blob:demo",
      canCancel: true,
    };
    const readyReset = reduceAppState(readyState, { type: "reset-controls" });

    expect(readyReset.status).toBe("ready");
    expect(readyReset.selectedVoice).toBe("am_michael");
    expect(readyReset.secondaryVoice).toBe("__none__");
    expect(readyReset.secondaryRatio).toBe(0);
    expect(readyReset.text).toMatch(/Leave the place/);
    expect(readyReset.speed).toBe(1);
    expect(readyReset.pitchSemitones).toBe(0);
    expect(readyReset.sentencePauseMs).toBe(LONG_TEXT_PAUSE_MS);
    expect(readyReset.sentencePauseMinMs).toBe(0);
    expect(readyReset.sentencePauseMaxMs).toBe(400);
    expect(readyReset.newlinePauseMs).toBe(LONG_TEXT_NEWLINE_PAUSE_MS);
    expect(readyReset.newlinePauseMinMs).toBe(0);
    expect(readyReset.newlinePauseMaxMs).toBe(600);
    expect(readyReset.paragraphPauseMs).toBe(LONG_TEXT_PARAGRAPH_PAUSE_MS);
    expect(readyReset.paragraphPauseMinMs).toBe(0);
    expect(readyReset.paragraphPauseMaxMs).toBe(900);
    expect(readyReset.error).toBeNull();
    expect(readyReset.audioUrl).toBeNull();
    expect(readyReset.canCancel).toBe(false);
  });

  it("handles text, voice, blend, pacing, speed, and preview actions", () => {
    let next = reduceAppState(createInitialState(), { type: "text", text: "Hello" });
    next = reduceAppState(next, { type: "secondary-voice", voice: "am_michael" });
    next = reduceAppState(next, { type: "secondary-ratio", ratio: 15 });
    next = reduceAppState(next, { type: "voice", voice: "am_michael" });
    next = reduceAppState(next, { type: "secondary-voice", voice: "am_michael" });
    next = reduceAppState(next, { type: "sentence-pause-range", minMs: 100, maxMs: 200 });
    next = reduceAppState(next, { type: "sentence-pause", pauseMs: 175 });
    next = reduceAppState(next, { type: "newline-pause-range", minMs: 150, maxMs: 300 });
    next = reduceAppState(next, { type: "newline-pause", pauseMs: 250 });
    next = reduceAppState(next, { type: "paragraph-pause-range", minMs: 225, maxMs: 450 });
    next = reduceAppState(next, { type: "paragraph-pause", pauseMs: 400 });
    next = reduceAppState(next, { type: "speed", speed: 1.25 });
    next = reduceAppState(next, { type: "pitch", semitones: 2.5 });
    next = reduceAppState(next, { type: "preview-start" });

    expect(next.text).toBe("Hello");
    expect(next.selectedVoice).toBe("am_michael");
    expect(next.secondaryVoice).toBe("__none__");
    expect(next.secondaryRatio).toBe(0);
    expect(next.sentencePauseMs).toBe(175);
    expect(next.sentencePauseMinMs).toBe(100);
    expect(next.sentencePauseMaxMs).toBe(200);
    expect(next.newlinePauseMs).toBe(250);
    expect(next.newlinePauseMinMs).toBe(150);
    expect(next.newlinePauseMaxMs).toBe(300);
    expect(next.paragraphPauseMs).toBe(400);
    expect(next.paragraphPauseMinMs).toBe(225);
    expect(next.paragraphPauseMaxMs).toBe(450);
    expect(next.speed).toBe(1.25);
    expect(next.pitchSemitones).toBe(2.5);
    expect(next.activityPhase).toBe("preview-loading");

    const clearedWhileLoading = reduceAppState(
      { ...next, status: "loading", activityPhase: "preview-loading", error: "Oops" },
      { type: "preview-ready" },
    );
    expect(clearedWhileLoading.activityPhase).toBe("model-loading");

    const clearedReady = reduceAppState(
      { ...next, status: "ready", activityPhase: "preview-loading", error: "Oops" },
      { type: "preview-ready" },
    );
    expect(clearedReady.activityPhase).toBe("idle");

    const fallback = reduceAppState(clearedReady, { type: "init-fallback" });
    expect(fallback.activityPhase).toBe("model-fallback");
    expect(fallback.status).toBe("loading");

    const cleared = reduceAppState(
      reduceAppState(fallback, { type: "error", message: "Problem" }),
      { type: "clear-error" },
    );
    expect(cleared.error).toBeNull();
  });

  it("returns the current state for unknown actions", () => {
    const state = createInitialState();

    expect(reduceAppState(state, { type: "unknown" } as never)).toBe(state);
  });

  it("resets controls to model defaults when there are no loaded voices", () => {
    const state = {
      ...createInitialState(createModelDefinition("custom/demo-model")),
      device: "webgpu" as const,
      status: "ready" as const,
      voices: [],
    };

    expect(reduceAppState(state, { type: "reset-controls" }).selectedVoice).toBe("");
  });

  it("clamps pause values when ranges change", () => {
    let next = createInitialState();
    next = reduceAppState(next, { type: "sentence-pause-range", minMs: 180, maxMs: 220 });
    next = reduceAppState(next, { type: "sentence-pause", pauseMs: 1000 });
    expect(next.sentencePauseMs).toBe(1000);

    next = reduceAppState(next, { type: "sentence-pause", pauseMs: -40 });
    expect(next.sentencePauseMs).toBe(0);

    next = reduceAppState(next, { type: "newline-pause-range", minMs: 350, maxMs: 250 });
    expect(next.newlinePauseMinMs).toBe(250);
    expect(next.newlinePauseMaxMs).toBe(350);
    expect(next.newlinePauseMs).toBe(225);
  });

  it("applies saved presets in one reducer step", () => {
    const next = reduceAppState(
      {
        ...createInitialState(),
        voices: [
          { id: "af_heart", label: "Heart" },
          { id: "bf_emma", label: "Emma" },
        ],
      },
      {
        type: "apply-preset",
        preset: {
          id: "preset-1",
          name: "Podcast",
          voice: "bf_emma",
          secondaryVoice: "af_heart",
          secondaryRatio: 30,
          speed: 1.1,
          pitchSemitones: -1.5,
          sentencePauseMs: 190,
          sentencePauseMinMs: 50,
          sentencePauseMaxMs: 250,
          newlinePauseMs: 280,
          newlinePauseMinMs: 100,
          newlinePauseMaxMs: 400,
          paragraphPauseMs: 420,
          paragraphPauseMinMs: 150,
          paragraphPauseMaxMs: 500,
        },
      },
    );

    expect(next.selectedVoice).toBe("bf_emma");
    expect(next.secondaryVoice).toBe("af_heart");
    expect(next.secondaryRatio).toBe(30);
    expect(next.speed).toBe(1.1);
    expect(next.pitchSemitones).toBe(-1.5);
    expect(next.sentencePauseMs).toBe(190);
    expect(next.newlinePauseMs).toBe(280);
    expect(next.paragraphPauseMs).toBe(420);
  });
});
