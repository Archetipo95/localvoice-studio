// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../stores/editor";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";
import { useVoiceStore } from "../stores/voice";
import type { ModelDefinition } from "../types";
import { NO_BLEND_VOICE } from "../utils/mix";
import { mergeStubs, VOICE_BLEND_STUBS } from "../test/stubs";
import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
} from "../utils/long-text";

const previewAudioUrls = ref(new Map<string, string>());

vi.mock("../composables/useTtsWorker", () => ({
  resetStudioState: () => {
    const editor = useEditorStore();
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    editor.resetToDefault();
    voice.resetToDefaults(generation.model);
    generation.resetControls();
  },
}));

vi.mock("../composables/usePreviewCache", () => ({
  previewAudioUrls,
  buildMixPreviewId: (options: {
    voice: string;
    secondaryVoice: string;
    secondaryRatio: number;
    speed: number;
    pitchSemitones: number;
    sentencePauseMs: number;
    newlinePauseMs: number;
    paragraphPauseMs: number;
  }) =>
    `mix:${options.voice}|${options.secondaryVoice}|${options.secondaryRatio}|speed:${options.speed.toFixed(
      2,
    )}|pitch:${options.pitchSemitones.toFixed(1)}|sentence:${options.sentencePauseMs}|newline:${options.newlinePauseMs}|paragraph:${options.paragraphPauseMs}`,
  buildVoicePreviewId: (options: {
    voice: string;
    speed: number;
    pitchSemitones: number;
    sentencePauseMs: number;
    newlinePauseMs: number;
    paragraphPauseMs: number;
  }) =>
    `preview:${options.voice}|speed:${options.speed.toFixed(2)}|pitch:${options.pitchSemitones.toFixed(
      1,
    )}|sentence:${options.sentencePauseMs}|newline:${options.newlinePauseMs}|paragraph:${options.paragraphPauseMs}`,
}));

describe("VoiceBlend", () => {
  it("renders the placeholder gate when model download is not approved", async () => {
    const generation = useGenerationStore();
    const ui = useUiStore();

    generation.status = "idle";
    generation.device = null;
    ui.modelDownloadApproved = false;

    const VoiceBlend = (await import("./VoiceBlend.vue")).default;
    const wrapper = mount(VoiceBlend, {
      global: {
        stubs: mergeStubs(VOICE_BLEND_STUBS, {
          UButton: { template: "<button type='button'><slot /></button>" },
        }),
      },
    });

    expect(wrapper.text()).toContain("Available after the model is downloaded.");
  });

  it("shows tuned preview and resets controls", async () => {
    previewAudioUrls.value = new Map();

    const generation = useGenerationStore();
    const ui = useUiStore();
    const voice = useVoiceStore();
    const model: ModelDefinition = {
      id: "m1",
      label: "Model",
      modelId: "model-1",
      voices: [
        { id: "af_heart", label: "Heart" },
        { id: "am_michael", label: "Michael" },
      ],
    };

    generation.status = "ready";
    generation.device = "webgpu";
    generation.model = model;

    ui.modelDownloadApproved = true;
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = NO_BLEND_VOICE;
    voice.secondaryRatio = 0;
    voice.speed = 1;
    voice.pitchSemitones = 0;
    voice.pauses.sentence.value = LONG_TEXT_PAUSE_MS;
    voice.pauses.newline.value = LONG_TEXT_NEWLINE_PAUSE_MS;
    voice.pauses.paragraph.value = LONG_TEXT_PARAGRAPH_PAUSE_MS;

    const VoiceBlend = (await import("./VoiceBlend.vue")).default;
    const wrapper = mount(VoiceBlend, {
      global: {
        stubs: mergeStubs(VOICE_BLEND_STUBS, {
          UButton: {
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
          },
        }),
      },
    });

    expect(wrapper.text()).toContain("Tuned preview appears when you blend");

    voice.secondaryVoice = "am_michael";
    voice.secondaryRatio = 50;
    previewAudioUrls.value.set(
      "mix:af_heart|am_michael|50|speed:1.00|pitch:0.0|sentence:150|newline:225|paragraph:325",
      "blob:mix",
    );
    await nextTick();

    expect(wrapper.find("#mix-output-audio").attributes("src")).toBe("blob:mix");

    voice.speed = 1.7;
    generation.audioUrl = "blob:active";
    generation.error = "Generation canceled.";
    const resetButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Reset all controls"));
    expect(resetButton).toBeDefined();
    await resetButton!.trigger("click");
    expect(voice.speed).toBe(1);
    expect(generation.audioUrl).toBe(null);
    expect(generation.error).toBe(null);
  });

  it("updates blend controls and accordion state through component handlers", async () => {
    previewAudioUrls.value = new Map();

    const generation = useGenerationStore();
    const ui = useUiStore();
    const voice = useVoiceStore();

    generation.status = "ready";
    generation.device = "webgpu";
    ui.modelDownloadApproved = true;
    voice.voices = [
      { id: "af_heart", label: "Heart" },
      { id: "am_michael", label: "Michael" },
    ];
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 0;

    const VoiceBlend = (await import("./VoiceBlend.vue")).default;
    const wrapper = mount(VoiceBlend, {
      global: {
        stubs: mergeStubs(VOICE_BLEND_STUBS, {
          UButton: { template: "<button type='button'><slot /></button>" },
        }),
      },
    });

    (wrapper.vm as any).handleSecondaryVoiceChange("am_michael");
    await nextTick();
    expect(voice.secondaryVoice).toBe("am_michael");
    expect(voice.secondaryRatio).toBe(50);
    expect(ui.secondaryVoiceControlsOpen).toBe(true);

    (wrapper.vm as any).accordionOpen = "advanced";
    await nextTick();
    expect(ui.advancedControlsOpen).toBe(true);
    expect(ui.secondaryVoiceControlsOpen).toBe(false);

    (wrapper.vm as any).handleSecondaryVoiceChange("__none__");
    await nextTick();
    expect(voice.secondaryVoice).toBe("__none__");
    expect(voice.secondaryRatio).toBe(0);
  });
});
