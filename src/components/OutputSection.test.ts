// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";

describe("OutputSection", () => {
  it("shows loading card, audio card, and empty state based on app state", async () => {
    vi.resetModules();

    const state = ref({
      activityPhase: "generating",
      audioUrl: null,
    } as any);
    const clearSavedAudioCache = vi.fn(async () => undefined);
    const previewAudioUrls = ref(new Map());
    const latestOutputSamples = ref<Float32Array | null>(null);

    vi.doMock("../composables/useAppState", () => ({
      useAppState: () => ({ state, dispatch: vi.fn() }),
    }));

    vi.doMock("../composables/useTtsWorker", () => ({
      clearSavedAudioCache,
      previewAudioUrls,
      latestOutputSamples,
    }));

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: {
          UCard: { template: "<div><slot /></div>" },
          UProgress: { template: "<div data-progress='1'></div>" },
          UButton: {
            props: ["to", "download"],
            template:
              '<button v-if="$attrs.onClick" type="button" @click="$attrs.onClick($event)"><slot /></button><a v-else :href="to" :download="download"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Generating speech");

    state.value.activityPhase = "idle";
    state.value.audioUrl = "blob:demo";
    await wrapper.vm.$nextTick();

    expect(wrapper.find("audio#output-audio").attributes("src")).toBe("blob:demo");
    expect(wrapper.find("a").attributes("download")).toBe("localvoice-studio.wav");
    expect(wrapper.text()).toContain("Clear cached audio");

    await wrapper.get("#clear-audio-cache-button").trigger("click");
    expect(clearSavedAudioCache).toHaveBeenCalledTimes(1);

    state.value.audioUrl = null;
    await wrapper.vm.$nextTick();
    expect(wrapper.text()).toContain("Generate audio to preview and download your final output.");
  });

  it("shows clear cache button when only cached previews exist", async () => {
    vi.resetModules();

    const state = ref({
      activityPhase: "idle",
      audioUrl: null,
    } as any);
    const clearSavedAudioCache = vi.fn(async () => undefined);
    const previewAudioUrls = ref(new Map([["voice:af_heart", "blob:preview"]]));
    const latestOutputSamples = ref<Float32Array | null>(null);

    vi.doMock("../composables/useAppState", () => ({
      useAppState: () => ({ state, dispatch: vi.fn() }),
    }));

    vi.doMock("../composables/useTtsWorker", () => ({
      clearSavedAudioCache,
      previewAudioUrls,
      latestOutputSamples,
    }));

    const OutputSection = (await import("./OutputSection.vue")).default;
    const wrapper = mount(OutputSection, {
      global: {
        stubs: {
          UProgress: { template: "<div data-progress='1'></div>" },
          UButton: {
            props: ["to", "download"],
            template:
              '<button v-if="$attrs.onClick" type="button" @click="$attrs.onClick($event)"><slot /></button><a v-else :href="to" :download="download"><slot /></a>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Clear cached audio");
  });
});
