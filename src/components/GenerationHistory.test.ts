// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GenerationHistoryItem } from "../types";

const renameHistoryOutput = vi.fn();
const removeHistoryOutput = vi.fn(async () => undefined);
const generationHistory = ref<GenerationHistoryItem[]>([]);

vi.mock("../composables/useTtsWorker", () => ({
  removeHistoryOutput,
  renameHistoryOutput,
}));

vi.mock("../composables/useGenerationHistory", () => ({
  generationHistory,
}));

function createItem(overrides: Partial<GenerationHistoryItem> = {}): GenerationHistoryItem {
  return {
    id: "item-1",
    createdAt: new Date("2026-03-26T10:00:00Z").getTime(),
    sizeBytes: 1_572_864,
    durationMs: 850,
    textLength: 20,
    textPreview: "A short preview line",
    voice: "af_heart",
    secondaryVoice: "__none__",
    secondaryRatio: 0,
    speed: 1,
    pitchSemitones: 0,
    sentencePauseMs: 120,
    newlinePauseMs: 160,
    paragraphPauseMs: 240,
    fileName: "first.wav",
    audioUrl: "blob:first",
    cacheKey: "history:first",
    ...overrides,
  };
}

describe("GenerationHistory", () => {
  beforeEach(() => {
    renameHistoryOutput.mockClear();
    removeHistoryOutput.mockClear();
    generationHistory.value = [];
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-26T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stays hidden when there is no history", async () => {
    const GenerationHistory = (await import("./GenerationHistory.vue")).default;
    const wrapper = mount(GenerationHistory, {
      global: {
        stubs: {
          UInput: true,
          USelectMenu: true,
          UButton: true,
        },
      },
    });

    expect(wrapper.html()).toBe("<!--v-if-->");
  });

  it("filters, renames, downloads, and removes history items", async () => {
    generationHistory.value = [
      createItem(),
      createItem({
        id: "item-2",
        createdAt: new Date("2026-03-26T10:01:00Z").getTime(),
        sizeBytes: 2_621_440,
        durationMs: 75_000,
        textPreview: "Second preview",
        voice: "bf_emma",
        fileName: "second.wav",
        audioUrl: "blob:second",
        cacheKey: "history:second",
      }),
    ];

    const GenerationHistory = (await import("./GenerationHistory.vue")).default;
    const wrapper = mount(GenerationHistory, {
      global: {
        stubs: {
          UButton: {
            props: ["to", "download", "target"],
            emits: ["click"],
            template:
              "<button :data-to='to' :data-download='download' :data-target='target' @click=\"$emit('click')\"><slot /></button>",
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Showing 2 of 2");
    expect(wrapper.text()).toContain("Stored 1.50 MB");
    expect(wrapper.text()).toContain("850 ms");
    expect(wrapper.text()).toContain("1m 15.0s");
    const historyAudio = wrapper.find("#history-audio-item-1");
    expect(historyAudio.exists()).toBe(true);
    expect(historyAudio.attributes("src")).toBe("blob:first");
    expect(historyAudio.attributes("preload")).toBe("metadata");
    expect(historyAudio.attributes()).toHaveProperty("controls");

    const inputs = wrapper.findAll("input");
    await inputs[0]!.setValue("second");
    expect(wrapper.text()).toContain("Showing 1 of 2");
    expect(wrapper.text()).toContain("second.wav");
    expect(wrapper.text()).toContain("Stored 2.50 MB");
    expect(wrapper.text()).not.toContain("first.wav");
    expect(wrapper.find("#history-audio-item-2").attributes("src")).toBe("blob:second");

    await inputs[0]!.setValue("missing");
    expect(wrapper.text()).toContain("No recent files match the current search and filters.");

    await inputs[0]!.setValue("");
    (wrapper.vm as any).historyVoiceFilter = "bf_emma";
    await nextTick();
    expect(wrapper.text()).toContain("Showing 1 of 2");
    expect(wrapper.text()).toContain("second.wav");
    expect(wrapper.find("#history-audio-item-2").exists()).toBe(true);

    (wrapper.vm as any).historyVoiceFilter = "all";
    await nextTick();
    (wrapper.vm as any).historyRenameDrafts["item-1"] = "renamed.wav";
    await nextTick();
    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "Rename")
      ?.trigger("click");
    expect(renameHistoryOutput).toHaveBeenCalledWith("item-1", "renamed.wav");

    (wrapper.vm as any).historyRenameDrafts["item-1"] = "   ";
    await nextTick();
    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "Rename")
      ?.trigger("click");
    expect(renameHistoryOutput).toHaveBeenCalledTimes(1);

    const downloadTargets = Array.from<Element>(
      wrapper.element.querySelectorAll("[download='first.wav'], [data-download='first.wav']"),
    ).map((element) => ({
      href: element.getAttribute("href") ?? element.getAttribute("data-to"),
      download: element.getAttribute("download") ?? element.getAttribute("data-download"),
      target: element.getAttribute("target") ?? element.getAttribute("data-target"),
    }));
    expect(downloadTargets).toContainEqual(
      expect.objectContaining({
        href: "blob:first",
        download: "first.wav",
      }),
    );

    await wrapper
      .findAll("button")
      .find((button) => button.text().trim() === "Remove")
      ?.trigger("click");
    expect(removeHistoryOutput).toHaveBeenCalledWith("item-1");
  });
});
