// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../stores/editor";
import { useGenerationStore } from "../stores/generation";
import { useVoiceStore } from "../stores/voice";
import type { ExportMetadata } from "../types";
import { mergeStubs, OUTPUT_SECTION_STUBS } from "../test/stubs";

const generateAudio = vi.fn();
const cancelGeneration = vi.fn();
const clearSavedAudioCache = vi.fn(async () => {
  latestOutputSamples.value = null;
  previewAudioUrls.value = new Map();
});
const generationElapsedMs = ref(0);
const lastGenerationDurationMs = ref<number | null>(null);
const latestExportMetadata = ref<ExportMetadata | null>(null);
const generationHistory = ref([]);
const latestOutputSamples = ref<Float32Array | null>(null);
const previewAudioUrls = ref<Map<string, string>>(new Map());

vi.mock("../composables/useTtsWorker", () => ({
  cancelGeneration,
  clearSavedAudioCache,
  generateAudio,
  generationElapsedMs,
  lastGenerationDurationMs,
}));

vi.mock("../composables/useGenerationHistory", () => ({
  generationHistory,
  latestExportMetadata,
  latestOutputSamples,
}));

vi.mock("../composables/usePreviewCache", () => ({
  previewAudioUrls,
}));

vi.mock("../composables/useFilenameTemplate", () => ({
  resolveOutputFileName: vi.fn(() => "localvoice-studio.wav"),
}));

describe("OutputSection", () => {
  beforeEach(() => {
    generateAudio.mockClear();
    cancelGeneration.mockClear();
    clearSavedAudioCache.mockClear();
    generationElapsedMs.value = 0;
    lastGenerationDurationMs.value = null;
    latestExportMetadata.value = null;
    generationHistory.value = [];
    latestOutputSamples.value = null;
    previewAudioUrls.value = new Map();
  });

  it("shows loading state while generating", async () => {
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "generating";
    generation.activityPhase = "generating";
    generation.device = "webgpu";
    generation.audioUrl = null;
    voice.selectedVoice = "af_heart";

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: mergeStubs(OUTPUT_SECTION_STUBS, {
          UProgress: { template: "<div data-progress='1'></div>" },
        }),
      },
    });

    expect(wrapper.text()).toContain("Generating speech");
  });

  it("renders output audio and download link when audio is ready", async () => {
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    generation.audioUrl = "blob:demo";
    voice.selectedVoice = "af_heart";
    latestExportMetadata.value = {
      mimeType: "audio/wav",
      extension: "wav",
      bitDepth: 16,
      sizeBytes: 1234,
      fileName: "voice.wav",
    };

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: OUTPUT_SECTION_STUBS,
      },
    });

    expect(wrapper.find("#output-audio").attributes("src")).toBe("blob:demo");
    expect(wrapper.find("#download-link").attributes("download")).toBe("voice.wav");

    generation.audioUrl = null;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Generate audio to preview and download your final output.");
  });

  it("shows cancellation alert in output section", async () => {
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "error";
    generation.activityPhase = "idle";
    generation.error = "Generation canceled.";
    generation.device = "webgpu";
    generation.audioUrl = null;
    voice.selectedVoice = "af_heart";

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: mergeStubs(OUTPUT_SECTION_STUBS, {
          UAlert: {
            props: ["title"],
            template: "<div id='generation-cancelled-alert'>{{ title }}</div>",
          },
        }),
      },
    });

    expect(wrapper.find("#generation-cancelled-alert").exists()).toBe(true);
    expect(wrapper.text()).toContain("Generation canceled.");
  });

  it("shows clear cache control without history rows and keeps generate enabled after clearing", async () => {
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    generation.audioUrl = null;
    voice.selectedVoice = "af_heart";
    latestExportMetadata.value = {
      mimeType: "audio/wav",
      extension: "wav",
      bitDepth: 16,
      sizeBytes: 1234,
      fileName: "cached.wav",
    };

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: mergeStubs(OUTPUT_SECTION_STUBS, {
          GenerateButton: {
            props: ["disabled"],
            template: "<div id='generate-button-state' :data-disabled='String(disabled)'></div>",
          },
          UButton: {
            props: ["disabled"],
            emits: ["click"],
            template:
              "<button :id='$attrs.id' :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
          },
        }),
      },
    });

    expect(wrapper.find("#clear-audio-cache-button").exists()).toBe(true);
    expect(wrapper.find("#generate-button-state").attributes("data-disabled")).toBe("false");

    await wrapper.find("#clear-audio-cache-button").trigger("click");
    await wrapper.vm.$nextTick();

    expect(clearSavedAudioCache).toHaveBeenCalledTimes(1);
    expect(wrapper.find("#generate-button-state").attributes("data-disabled")).toBe("false");
  });

  it("passes generate payload and duration labels through to the generate button", async () => {
    const generation = useGenerationStore();
    const voice = useVoiceStore();
    const editor = useEditorStore();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    generation.audioUrl = null;
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 0;
    voice.speed = 1.2;
    voice.pitchSemitones = 2;
    voice.pauses.sentence.value = 150;
    voice.pauses.newline.value = 225;
    voice.pauses.paragraph.value = 325;
    editor.text = "Read this";
    lastGenerationDurationMs.value = 75_000;

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: mergeStubs(OUTPUT_SECTION_STUBS, {
          GenerateButton: {
            props: ["disabled", "elapsedLabel", "canCancel", "loading"],
            emits: ["generate"],
            template:
              "<button id='trigger-generate' :data-disabled='String(disabled)' :data-elapsed='elapsedLabel' :data-can-cancel='String(canCancel)' :data-loading='String(loading)' @click=\"$emit('generate')\">Generate</button>",
          },
        }),
      },
    });

    const trigger = wrapper.find("#trigger-generate");
    expect(trigger.attributes("data-elapsed")).toBe("Last generation time: 1m 15.0s");
    expect(trigger.attributes("data-disabled")).toBe("false");

    await trigger.trigger("click");
    expect(generateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Read this",
        voice: "af_heart",
        secondaryVoice: "__none__",
        secondaryRatio: 0,
        speed: 1.2,
        pitchSemitones: 2,
        sentencePauseMs: 150,
        newlinePauseMs: 225,
        paragraphPauseMs: 325,
        fileName: "localvoice-studio.wav",
      }),
    );
  });

  it("disables cache clearing while busy and treats previews or history as cached audio", async () => {
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    generation.status = "generating";
    generation.activityPhase = "generating";
    generation.device = "webgpu";
    generation.audioUrl = null;
    voice.selectedVoice = "af_heart";
    previewAudioUrls.value = new Map([["preview:key", "blob:preview"]]);
    generationHistory.value = [
      {
        id: "history-1",
        createdAt: 1,
        durationMs: 10,
        textLength: 3,
        textPreview: "abc",
        voice: "af_heart",
        secondaryVoice: "__none__",
        secondaryRatio: 0,
        speed: 1,
        pitchSemitones: 0,
        sentencePauseMs: 100,
        newlinePauseMs: 150,
        paragraphPauseMs: 250,
        fileName: "sample.wav",
        audioUrl: "blob:sample",
        cacheKey: "history:sample",
      },
    ] as any;
    generationElapsedMs.value = 1_500;

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: mergeStubs(OUTPUT_SECTION_STUBS, {
          GenerateButton: {
            props: ["elapsedLabel"],
            template: "<div id='elapsed-label'>{{ elapsedLabel }}</div>",
          },
          UButton: {
            props: ["disabled"],
            template: "<button :id='$attrs.id' :disabled='disabled'><slot /></button>",
          },
          UProgress: { template: "<div data-progress='1'></div>" },
        }),
      },
    });

    expect(wrapper.find("#clear-audio-cache-button").attributes("disabled")).toBeDefined();
    expect(wrapper.find("#elapsed-label").text()).toContain("Time waiting: 1.5s");
  });
});
