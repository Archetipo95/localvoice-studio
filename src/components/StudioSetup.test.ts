// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";

const initWorker = vi.fn();

vi.mock("../composables/useTtsWorker", () => ({
  initWorker,
}));

describe("StudioSetup", () => {
  it("shows model gate and starts worker after approval", async () => {
    vi.resetModules();
    initWorker.mockClear();

    const generation = useGenerationStore();
    const ui = useUiStore();

    generation.status = "idle";
    generation.activityPhase = "idle";
    generation.device = null;
    ui.modelDownloadApproved = false;
    ui.runtimePreference = "webgpu";

    const StudioSetup = (await import("./StudioSetup.vue")).default;
    const wrapper = mount(StudioSetup, {
      global: {
        stubs: {
          ModelDownloadGate: {
            emits: ["download"],
            template:
              '<div><span>Download required</span><button id="download-model-button" type="button" @click="$emit(\'download\')">Download</button></div>',
          },
          RuntimeSelector: {
            template: '<div id="runtime-stub"></div>',
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Download required");
    await wrapper.get("#download-model-button").trigger("click");

    expect(ui.modelDownloadApproved).toBe(true);
    expect(initWorker).toHaveBeenCalledTimes(1);
  });

  it("renders runtime selector and updates runtime preference", async () => {
    vi.resetModules();
    initWorker.mockClear();

    const generation = useGenerationStore();
    const ui = useUiStore();

    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    ui.modelDownloadApproved = true;
    ui.runtimePreference = "webgpu";

    const StudioSetup = (await import("./StudioSetup.vue")).default;
    const wrapper = mount(StudioSetup, {
      global: {
        stubs: {
          ModelDownloadGate: {
            template: "<div></div>",
          },
          RuntimeSelector: {
            props: ["runtimePreference"],
            emits: ["updateRuntime"],
            template:
              '<select id="runtime-select" :value="runtimePreference" @change="$emit(\'updateRuntime\', $event.target.value)"><option value="webgpu">GPU</option><option value="wasm">CPU</option></select>',
          },
        },
      },
    });

    expect(wrapper.find("#runtime-select").exists()).toBe(true);
    await wrapper.get("#runtime-select").setValue("wasm");
    await nextTick();

    expect(ui.runtimePreference).toBe("wasm");
    expect(window.localStorage.getItem("kokoro-runtime-pref")).toBe("wasm");
    expect(initWorker).toHaveBeenCalled();
  });

  it("shows fallback loading copy and avoids restarting when the runtime choice is unchanged", async () => {
    vi.resetModules();
    initWorker.mockClear();

    const generation = useGenerationStore();
    const ui = useUiStore();

    generation.status = "loading";
    generation.activityPhase = "model-fallback";
    generation.device = null;
    ui.modelDownloadApproved = true;
    ui.runtimePreference = "wasm";

    const StudioSetup = (await import("./StudioSetup.vue")).default;
    const wrapper = mount(StudioSetup, {
      global: {
        stubs: {
          ModelDownloadGate: { template: "<div></div>" },
          RuntimeSelector: {
            props: ["modelLoading", "runtimePreference"],
            template:
              "<div id='runtime-state'>{{ modelLoading?.title }}|{{ modelLoading?.detail }}|{{ runtimePreference }}</div>",
          },
        },
      },
    });

    expect(wrapper.text()).toContain("Switching runtime");
    expect(wrapper.text()).toContain("retrying on CPU/WASM");

    (wrapper.vm as any).handleRuntimePreferenceUpdate("wasm");
    expect(initWorker).not.toHaveBeenCalled();
  });
});
