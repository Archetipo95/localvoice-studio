// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPinia, setActivePinia } from "pinia";
import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";

const fakeModel = {
  id: "m1",
  label: "Model",
  modelId: "model-1",
  voices: [],
};

describe("useUiStore", () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
    setActivePinia(createPinia());
  });

  it("setThemeMode updates state and delegates persistence/application", async () => {
    const persistThemeMode = vi.fn();
    const applyThemeMode = vi.fn();

    vi.doMock("../utils/theme", () => ({
      loadThemeMode: () => "system",
      persistThemeMode,
      applyThemeMode,
    }));

    const { useUiStore } = await import("./ui");
    const ui = useUiStore();

    ui.setThemeMode("dark");

    expect(ui.themeMode).toBe("dark");
    expect(persistThemeMode).toHaveBeenCalledWith("dark");
    expect(applyThemeMode).toHaveBeenCalledWith("dark");
  });

  it("repairs legacy presets with safe defaults and clamps invalid numeric values", async () => {
    const { useUiStore } = await import("./ui");
    const ui = useUiStore();

    window.localStorage.setItem(
      "kokoro-voice-presets:model-1",
      JSON.stringify([
        {
          id: "p1",
          name: "Warm",
          voice: "af_heart",
          secondaryVoice: "__none__",
          secondaryRatio: 140,
          pitchSemitones: 20,
          sentencePauseMs: -10,
          sentencePauseMinMs: 250,
          sentencePauseMaxMs: 50,
        },
        {
          id: "p2",
          name: "Bright   ",
          voice: "af_heart",
          secondaryVoice: "__none__",
        },
      ]),
    );

    ui.loadVoicePresets(fakeModel as any);

    expect(ui.voicePresets).toHaveLength(2);
    expect(ui.voicePresets[0]?.id).toBe("p1");
    expect(ui.voicePresets[0]?.secondaryRatio).toBe(100);
    expect(ui.voicePresets[0]?.speed).toBe(1);
    expect(ui.voicePresets[0]?.pitchSemitones).toBe(6);
    expect(ui.voicePresets[0]?.sentencePauseMs).toBe(0);
    expect(ui.voicePresets[0]?.sentencePauseMinMs).toBe(50);
    expect(ui.voicePresets[0]?.sentencePauseMaxMs).toBe(250);
    expect(ui.voicePresets[0]?.newlinePauseMs).toBe(LONG_TEXT_NEWLINE_PAUSE_MS);
    expect(ui.voicePresets[0]?.paragraphPauseMs).toBe(LONG_TEXT_PARAGRAPH_PAUSE_MS);
    expect(ui.voicePresets[1]?.id).toBe("p2");
    expect(ui.voicePresets[1]?.name).toBe("Bright");
    expect(ui.voicePresets[1]?.speed).toBe(1);
    expect(ui.voicePresets[1]?.pitchSemitones).toBe(0);
    expect(ui.voicePresets[1]?.sentencePauseMs).toBe(LONG_TEXT_PAUSE_MS);
  });

  it("resets presets for missing, invalid, or unparsable preset storage", async () => {
    const { useUiStore } = await import("./ui");
    const ui = useUiStore();

    ui.loadVoicePresets(fakeModel as any);
    expect(ui.voicePresets).toEqual([]);

    window.localStorage.setItem("kokoro-voice-presets:model-1", "{bad json");
    ui.loadVoicePresets(fakeModel as any);
    expect(ui.voicePresets).toEqual([]);

    window.localStorage.setItem("kokoro-voice-presets:model-1", JSON.stringify({ id: "p1" }));
    ui.loadVoicePresets(fakeModel as any);
    expect(ui.voicePresets).toEqual([]);
  });

  it("drops structurally invalid presets", async () => {
    const { useUiStore } = await import("./ui");
    const ui = useUiStore();

    window.localStorage.setItem(
      "kokoro-voice-presets:model-1",
      JSON.stringify([
        {
          id: 42,
          name: "Invalid",
          voice: "af_heart",
          secondaryVoice: "__none__",
        },
        {
          id: "p2",
          name: "",
          voice: "af_heart",
          secondaryVoice: "__none__",
        },
      ]),
    );

    ui.loadVoicePresets(fakeModel as any);

    expect(ui.voicePresets).toEqual([]);
  });

  it("preserves valid presets unchanged", async () => {
    const { useUiStore } = await import("./ui");
    const ui = useUiStore();

    const validPreset = {
      id: "p1",
      name: "Narration",
      voice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 35,
      speed: 1.1,
      pitchSemitones: 1.5,
      sentencePauseMs: 180,
      sentencePauseMinMs: 80,
      sentencePauseMaxMs: 280,
      newlinePauseMs: 240,
      newlinePauseMinMs: 90,
      newlinePauseMaxMs: 390,
      paragraphPauseMs: 420,
      paragraphPauseMinMs: 120,
      paragraphPauseMaxMs: 620,
    };

    window.localStorage.setItem("kokoro-voice-presets:model-1", JSON.stringify([validPreset]));

    ui.loadVoicePresets(fakeModel as any);

    expect(ui.voicePresets).toEqual([validPreset]);
  });

  it("persists presets and ignores storage failures", async () => {
    const { useUiStore } = await import("./ui");
    const ui = useUiStore();

    ui.voicePresets = [
      {
        id: "p1",
        name: "Saved",
        voice: "af_heart",
        secondaryVoice: "__none__",
        secondaryRatio: 0,
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
      },
    ];

    ui.persistVoicePresets(fakeModel as any);
    expect(window.localStorage.getItem("kokoro-voice-presets:model-1")).toContain("Saved");

    const setItemSpy = vi
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementationOnce(() => {
        throw new Error("quota");
      });
    expect(() => ui.persistVoicePresets(fakeModel as any)).not.toThrow();
    setItemSpy.mockRestore();
  });

  it("loads runtime preference from storage or environment and persists updates safely", async () => {
    vi.resetModules();
    window.localStorage.setItem("kokoro-runtime-pref", "wasm");

    const { useUiStore } = await import("./ui");
    const ui = useUiStore();
    expect(ui.runtimePreference).toBe("wasm");

    ui.setRuntimePreference("webgpu");
    expect(ui.runtimePreference).toBe("webgpu");
    expect(window.localStorage.getItem("kokoro-runtime-pref")).toBe("webgpu");

    const setItemSpy = vi
      .spyOn(window.localStorage.__proto__, "setItem")
      .mockImplementationOnce(() => {
        throw new Error("quota");
      });
    expect(() => ui.setRuntimePreference("wasm")).not.toThrow();
    setItemSpy.mockRestore();
  });

  it("falls back to environment runtime preference when local storage is unavailable", async () => {
    vi.resetModules();
    vi.doMock("../utils/runtime", () => ({
      preferredDeviceFromEnvironment: vi.fn(() => "webgpu"),
      hasWebGPU: vi.fn(() => true),
    }));

    const getItemSpy = vi
      .spyOn(window.localStorage.__proto__, "getItem")
      .mockImplementationOnce(() => {
        throw new Error("blocked");
      });

    const { useUiStore } = await import("./ui");
    const ui = useUiStore();
    expect(ui.runtimePreference).toBe("webgpu");
    getItemSpy.mockRestore();
  });

  it("updates simple UI state and manages presets end to end", async () => {
    const { useUiStore } = await import("./ui");
    const ui = useUiStore();
    const preset = {
      id: "p1",
      name: "Preset One",
      voice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 100,
      sentencePauseMinMs: 0,
      sentencePauseMaxMs: 200,
      newlinePauseMs: 120,
      newlinePauseMinMs: 0,
      newlinePauseMaxMs: 240,
      paragraphPauseMs: 300,
      paragraphPauseMinMs: 0,
      paragraphPauseMaxMs: 500,
    };

    ui.setEditorViewMode("plain");
    ui.setModelDownloadApproved(true);
    expect(ui.editorViewMode).toBe("plain");
    expect(ui.modelDownloadApproved).toBe(true);

    ui.upsertPreset(preset as any, fakeModel as any);
    expect(ui.voicePresets).toHaveLength(1);
    expect(ui.selectedPresetId).toBe("p1");

    ui.upsertPreset({ ...preset, name: "Preset Updated" } as any, fakeModel as any);
    expect(ui.voicePresets).toHaveLength(1);
    expect(ui.voicePresets[0]?.name).toBe("Preset Updated");

    ui.selectPreset("p1");
    expect(ui.selectedPresetId).toBe("p1");

    ui.deletePreset("p1", fakeModel as any);
    expect(ui.voicePresets).toEqual([]);
    expect(ui.selectedPresetId).toBe("");
  });

  it("drops null-like preset payloads and preserves selection when deleting another preset", async () => {
    const { useUiStore } = await import("./ui");
    const ui = useUiStore();

    window.localStorage.setItem("kokoro-voice-presets:model-1", JSON.stringify([null]));
    ui.loadVoicePresets(fakeModel as any);
    expect(ui.voicePresets).toEqual([]);

    ui.voicePresets = [
      {
        id: "p1",
        name: "One",
        voice: "af_heart",
        secondaryVoice: "__none__",
        secondaryRatio: 0,
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
      },
      {
        id: "p2",
        name: "Two",
        voice: "af_heart",
        secondaryVoice: "__none__",
        secondaryRatio: 0,
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
      },
    ] as any;
    ui.selectedPresetId = "p1";
    ui.deletePreset("p2", fakeModel as any);
    expect(ui.selectedPresetId).toBe("p1");
  });
});
