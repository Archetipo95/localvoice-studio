// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGenerationStore } from "../stores/generation";
import { useVoiceStore } from "../stores/voice";
import type { ExportMetadata } from "../types";
import { mergeStubs, OUTPUT_SECTION_STUBS } from "../test/stubs";

const clearSavedAudioCache = vi.fn(async () => {
  latestExportMetadata.value = null;
  previewAudioUrls.value = new Map();
});
const latestExportMetadata = ref<ExportMetadata | null>(null);
const generationHistory = ref([]);
const previewAudioUrls = ref<Map<string, string>>(new Map());

vi.mock("../composables/useTtsWorker", () => ({
  clearSavedAudioCache,
}));

vi.mock("../composables/useGenerationHistory", () => ({
  generationHistory,
  latestExportMetadata,
}));

vi.mock("../composables/usePreviewCache", () => ({
  previewAudioUrls,
}));

describe("OutputSection", () => {
  beforeEach(() => {
    clearSavedAudioCache.mockClear();
    latestExportMetadata.value = null;
    generationHistory.value = [];
    previewAudioUrls.value = new Map();
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
    expect(wrapper.text()).toContain(
      "Generate audio from the script editor to preview and download your final output.",
    );
  });

  it("shows clear cache control without audio rows and keeps it enabled when idle", async () => {
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
    expect(wrapper.find("#clear-audio-cache-button").attributes("disabled")).toBeUndefined();

    await wrapper.find("#clear-audio-cache-button").trigger("click");
    await wrapper.vm.$nextTick();

    expect(clearSavedAudioCache).toHaveBeenCalledTimes(1);
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

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: mergeStubs(OUTPUT_SECTION_STUBS, {
          UButton: {
            props: ["disabled"],
            emits: ["click"],
            template:
              "<button :id='$attrs.id' :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
          },
        }),
      },
    });

    expect(wrapper.find("#clear-audio-cache-button").attributes("disabled")).toBeDefined();
  });
});
