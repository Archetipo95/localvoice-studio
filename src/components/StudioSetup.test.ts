// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";

const UButtonStub = {
  props: ["id"],
  emits: ["click"],
  template: '<button :id="id" type="button" @click="$emit(\'click\')"><slot /></button>',
};

const UInputStub = defineComponent({
  name: "UInput",
  props: ["modelValue", "placeholder", "id"],
  emits: ["update:modelValue"],
  template:
    '<input :id="id" :value="modelValue" :placeholder="placeholder" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />',
});

const USelectStub = defineComponent({
  name: "USelect",
  props: ["modelValue", "items", "id", "disabled"],
  emits: ["update:modelValue"],
  template:
    '<select :id="id" :disabled="disabled" :value="modelValue" @change="$emit(\'update:modelValue\', ($event.target as HTMLSelectElement).value)"><option v-for="item in items" :key="item.value" :value="item.value">{{ item.label }}</option></select>',
});

describe("StudioSetup", () => {
  it("handles model download gate and runtime preference updates", async () => {
    vi.resetModules();

    const dispatch = vi.fn();
    const initWorker = vi.fn();
    const model = { id: "m1", label: "Model", modelId: "model-1", voices: [] };
    const state = ref({
      model,
      activityPhase: "idle",
      status: "idle",
      device: null,
      selectedVoice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 100,
      sentencePauseMinMs: 0,
      sentencePauseMaxMs: 300,
      newlinePauseMs: 100,
      newlinePauseMinMs: 0,
      newlinePauseMaxMs: 300,
      paragraphPauseMs: 100,
      paragraphPauseMinMs: 0,
      paragraphPauseMaxMs: 300,
    } as any);

    const runtimePreference = ref<any>("webgpu");
    const voicePresets = ref<any[]>([]);
    const selectedPresetId = ref("");
    const modelDownloadApproved = ref(false);
    const loadVoicePresets = vi.fn(() => []);
    const persistVoicePresets = vi.fn();

    vi.doMock("../composables/useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("../composables/useTtsWorker", () => ({ initWorker }));
    vi.doMock("../composables/useUiState", () => ({
      runtimePreference,
      voicePresets,
      selectedPresetId,
      modelDownloadApproved,
      loadVoicePresets,
      persistVoicePresets,
    }));
    vi.doMock("../utils/runtime", () => ({ hasWebGPU: () => true }));

    const StudioSetup = (await import("./StudioSetup.vue")).default;
    const wrapper = mount(StudioSetup, {
      global: {
        stubs: {
          UCard: { template: "<div><slot /></div>" },
          UIcon: { template: "<span></span>" },
          UButton: UButtonStub,
          USelect: USelectStub,
          UInput: UInputStub,
          UProgress: { template: "<div></div>" },
        },
      },
    });

    expect(wrapper.text()).toContain("Download required");
    await wrapper.find("button").trigger("click");
    expect(modelDownloadApproved.value).toBe(true);
    expect(initWorker).toHaveBeenCalled();
    await nextTick();
    (wrapper.vm as any).handleRuntimePreferenceUpdate("webgpu");

    runtimePreference.value = "wasm";
    await nextTick();
    expect(window.localStorage.getItem("kokoro-runtime-pref")).toBe("wasm");
    expect(initWorker).toHaveBeenCalledTimes(2);

    state.value.activityPhase = "model-loading";
    await nextTick();
    expect(wrapper.text()).toContain("Loading model");

    state.value.activityPhase = "model-fallback";
    await nextTick();
    expect(wrapper.text()).toContain("Switching runtime");
  });

  it("renders runtime controls when approved and avoids re-init when not approved", async () => {
    vi.resetModules();

    const state = ref({
      model: { id: "m1", label: "Model", modelId: "model-1", voices: [] },
      activityPhase: "idle",
      status: "ready",
      device: "webgpu",
    } as any);

    const runtimePreference = ref<any>("webgpu");
    const modelDownloadApproved = ref(false);
    const initWorker = vi.fn();

    vi.doMock("../composables/useAppState", () => ({
      useAppState: () => ({ state, dispatch: vi.fn() }),
    }));
    vi.doMock("../composables/useTtsWorker", () => ({ initWorker }));
    vi.doMock("../composables/useUiState", () => ({
      runtimePreference,
      modelDownloadApproved,
    }));
    vi.doMock("../utils/runtime", () => ({ hasWebGPU: () => false }));

    const StudioSetup = (await import("./StudioSetup.vue")).default;
    const wrapper = mount(StudioSetup, {
      global: {
        stubs: {
          UCard: { template: "<div><slot /></div>" },
          UIcon: { template: "<span></span>" },
          UButton: UButtonStub,
          USelect: USelectStub,
          UInput: UInputStub,
          UProgress: { template: "<div></div>" },
        },
      },
    });

    await nextTick();
    expect(wrapper.find("#runtime-select").exists()).toBe(true);

    runtimePreference.value = "wasm";
    await nextTick();
    expect(window.localStorage.getItem("kokoro-runtime-pref")).toBe("wasm");
    expect(initWorker).not.toHaveBeenCalled();

    (wrapper.vm as any).handleRuntimePreferenceUpdate("webgpu");
    await nextTick();
    expect(runtimePreference.value).toBe("webgpu");
  });
});
