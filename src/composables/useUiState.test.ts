// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

const fakeModel = {
  id: "m1",
  label: "Model",
  modelId: "model-1",
  voices: [],
};

describe("useUiState", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("setThemeMode updates ref and delegates persistence/application", async () => {
    vi.resetModules();
    const persistThemeMode = vi.fn();
    const applyThemeMode = vi.fn();

    vi.doMock("../utils/theme", () => ({
      loadThemeMode: () => "system",
      persistThemeMode,
      applyThemeMode,
    }));

    const ui = await import("./useUiState");
    ui.setThemeMode("dark");

    expect(ui.themeMode.value).toBe("dark");
    expect(persistThemeMode).toHaveBeenCalledWith("dark");
    expect(applyThemeMode).toHaveBeenCalledWith("dark");
  });

  it("loads valid voice presets and normalizes invalid pitch", async () => {
    vi.resetModules();
    const ui = await import("./useUiState");

    window.localStorage.setItem(
      "kokoro-voice-presets:model-1",
      JSON.stringify([
        {
          id: "p1",
          name: "Warm",
          voice: "af_heart",
          secondaryVoice: "__none__",
          pitchSemitones: Number.NaN,
        },
        {
          id: "p2",
          name: "Bright",
          voice: "af_heart",
          secondaryVoice: "__none__",
          pitchSemitones: 1.5,
        },
        {
          id: 42,
          name: "Invalid",
          voice: "af_heart",
          secondaryVoice: "__none__",
        },
      ]),
    );

    const presets = ui.loadVoicePresets(fakeModel as any);
    expect(presets).toHaveLength(2);
    expect(presets[0]?.id).toBe("p1");
    expect(presets[0]?.pitchSemitones).toBe(0);
    expect(presets[1]?.id).toBe("p2");
    expect(presets[1]?.pitchSemitones).toBe(1.5);
  });

  it("returns empty list for missing, invalid, or unparsable preset storage", async () => {
    vi.resetModules();
    const ui = await import("./useUiState");

    expect(ui.loadVoicePresets(fakeModel as any)).toEqual([]);

    window.localStorage.setItem("kokoro-voice-presets:model-1", "{bad json");
    expect(ui.loadVoicePresets(fakeModel as any)).toEqual([]);

    window.localStorage.setItem("kokoro-voice-presets:model-1", JSON.stringify({ id: "p1" }));
    expect(ui.loadVoicePresets(fakeModel as any)).toEqual([]);
  });

  it("persists presets and ignores storage failures", async () => {
    vi.resetModules();
    const ui = await import("./useUiState");

    ui.voicePresets.value = [
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
});
