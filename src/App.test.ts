// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useGenerationStore } from "./stores/generation";
import { useUiStore } from "./stores/ui";
import { useVoiceStore } from "./stores/voice";
import { createModelDefinition } from "./config/model-config";
import { APP_STUBS } from "./test/stubs";

const initWorker = vi.fn();
const requestPreviews = vi.fn();
const setupWorkerWatchers = vi.fn();

vi.mock("./composables/useTtsWorker", () => ({
  initWorker,
  requestPreviews,
  setupWorkerWatchers,
  worker: { value: null },
}));

vi.mock("./composables/useAudioPlayback", () => ({
  useAudioPlayback: vi.fn(),
}));

vi.mock("./utils/theme", () => ({
  loadThemeMode: vi.fn(() => "system"),
  persistThemeMode: vi.fn(),
  applyThemeMode: vi.fn(),
}));

describe("App", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    initWorker.mockClear();
    requestPreviews.mockClear();
    setupWorkerWatchers.mockClear();
    window.localStorage.clear();
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("resolves the initial model from the URL and keeps download gate closed until approved", async () => {
    window.history.replaceState({}, "", "/?modelRepo=custom/demo-model");

    const App = (await import("./App.vue")).default;
    mount(App, {
      global: {
        stubs: APP_STUBS,
      },
    });

    const generation = useGenerationStore();
    const ui = useUiStore();
    const voice = useVoiceStore();

    expect(generation.model.modelId).toBe("custom/demo-model");
    expect(generation.status).toBe("idle");
    expect(ui.modelDownloadApproved).toBe(false);
    expect(voice.selectedVoice).toBe("");
    expect(initWorker).not.toHaveBeenCalled();
  });

  it("starts the worker immediately when the selected model is already approved", async () => {
    window.history.replaceState({}, "", "/?modelRepo=custom/demo-model");
    window.localStorage.setItem("kokoro-model-download-approved:custom/demo-model", "1");

    const App = (await import("./App.vue")).default;
    mount(App, {
      global: {
        stubs: APP_STUBS,
      },
    });

    const generation = useGenerationStore();
    const ui = useUiStore();

    expect(generation.model.modelId).toBe("custom/demo-model");
    expect(generation.status).toBe("loading");
    expect(ui.modelDownloadApproved).toBe(true);
    expect(initWorker).toHaveBeenCalledTimes(1);
  });

  it("requests voice previews when the app becomes ready after download", async () => {
    window.history.replaceState({}, "", "/");

    const App = (await import("./App.vue")).default;
    mount(App, {
      global: {
        stubs: APP_STUBS,
      },
    });

    vi.advanceTimersByTime(300);
    expect(requestPreviews).toHaveBeenCalledTimes(1);

    const generation = useGenerationStore();
    const voice = useVoiceStore();
    voice.selectedVoice = "af_heart";
    generation.status = "ready";
    await nextTick();

    vi.advanceTimersByTime(300);
    expect(requestPreviews).toHaveBeenCalledTimes(2);
  });

  it("syncs companion stores and worker setup when the selected model changes later", async () => {
    window.history.replaceState({}, "", "/");

    const App = (await import("./App.vue")).default;
    mount(App, {
      global: {
        stubs: APP_STUBS,
      },
    });

    initWorker.mockClear();

    const generation = useGenerationStore();
    const ui = useUiStore();
    const voice = useVoiceStore();
    const customModel = createModelDefinition("custom/second-model");

    window.localStorage.setItem("kokoro-model-download-approved:custom/second-model", "1");

    generation.changeModel(customModel, true);
    await nextTick();

    expect(voice.selectedVoice).toBe("");
    expect(ui.modelDownloadApproved).toBe(true);
    expect(window.location.search).toContain("modelRepo=custom%2Fsecond-model");
    expect(initWorker).toHaveBeenCalledTimes(1);
  });
});
