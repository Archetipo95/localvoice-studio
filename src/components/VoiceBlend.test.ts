// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import {
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
  LONG_TEXT_PAUSE_MS,
} from "../utils/long-text";

const UButtonStub = {
  props: ["label", "ariaExpanded", "ariaControls"],
  emits: ["click"],
  template:
    '<button type="button" :aria-expanded="ariaExpanded" :aria-controls="ariaControls" @click="$emit(\'click\')">{{ label }}<slot /></button>',
};

const USelectStub = {
  props: ["id", "modelValue", "items", "disabled", "ariaLabel"],
  emits: ["update:modelValue"],
  template: `
    <select
      :id="id"
      :disabled="disabled"
      :aria-label="ariaLabel"
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
    >
      <option v-for="item in items" :key="item.value" :value="item.value" :disabled="item.disabled">
        {{ item.label }}
      </option>
    </select>
  `,
};

const UAccordionStub = {
  props: ["items", "modelValue"],
  emits: ["update:modelValue"],
  methods: {
    toggle(
      this: { modelValue?: string[]; $emit: (event: string, value: string[]) => void },
      value: string,
    ) {
      const current = Array.isArray(this.modelValue) ? [...this.modelValue] : [];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      this.$emit("update:modelValue", next);
    },
  },
  template: `
    <div>
      <button
        v-for="item in items"
        :key="item.value"
        type="button"
        @click="toggle(item.value)"
      >
        {{ item.label }}
      </button>
      <template v-for="item in items" :key="item.value + '-content'">
        <slot
          v-if="Array.isArray(modelValue) && modelValue.includes(item.value)"
          name="content"
          :item="item"
        />
      </template>
    </div>
  `,
};

describe("VoiceBlend", () => {
  it("renders model download gate when model is not approved", async () => {
    vi.resetModules();

    const state = ref({
      status: "idle",
      device: null,
      voices: [],
      selectedVoice: "",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
    } as any);
    const dispatch = vi.fn();

    vi.doMock("../composables/useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("../composables/useUiState", () => ({
      secondaryVoiceControlsOpen: ref(false),
      advancedControlsOpen: ref(false),
      modelDownloadApproved: ref(false),
      voicePresets: ref([]),
      selectedPresetId: ref(""),
      loadVoicePresets: vi.fn(() => []),
      persistVoicePresets: vi.fn(),
    }));
    vi.doMock("../composables/useTtsWorker", () => ({
      previewAudioUrls: ref(new Map()),
      buildVoicePreviewId: vi.fn(() => "voice:mock"),
      buildMixPreviewId: vi.fn(() => "mix:mock"),
      cancelGeneration: vi.fn(),
    }));

    const VoiceBlend = (await import("./VoiceBlend.vue")).default;
    const wrapper = mount(VoiceBlend, {
      global: {
        stubs: {
          UButton: UButtonStub,
          UAccordion: UAccordionStub,
          USelect: USelectStub,
          UInput: { template: "<input />" },
        },
      },
    });

    expect(wrapper.find("section[aria-hidden='true']").exists()).toBe(true);
  });

  it("updates voice settings, toggles drawers, and renders preview sources", async () => {
    vi.resetModules();

    const state = ref({
      status: "ready",
      device: "webgpu",
      voices: [
        { id: "af_heart", label: "af_heart · Heart", gender: "female" },
        { id: "am_michael", label: "am_michael · Michael", gender: "male" },
      ],
      selectedVoice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: LONG_TEXT_PAUSE_MS,
      sentencePauseMinMs: 0,
      sentencePauseMaxMs: 300,
      newlinePauseMs: LONG_TEXT_NEWLINE_PAUSE_MS,
      newlinePauseMinMs: 0,
      newlinePauseMaxMs: 300,
      paragraphPauseMs: LONG_TEXT_PARAGRAPH_PAUSE_MS,
      paragraphPauseMinMs: 0,
      paragraphPauseMaxMs: 300,
    } as any);
    const dispatch = vi.fn();

    const secondaryVoiceControlsOpen = ref(false);
    const advancedControlsOpen = ref(false);
    const modelDownloadApproved = ref(true);
    const previewAudioUrls = ref(
      new Map([
        [
          `voice:af_heart|speed:1.00|pitch:0.0|sentence:${LONG_TEXT_PAUSE_MS}|newline:${LONG_TEXT_NEWLINE_PAUSE_MS}|paragraph:${LONG_TEXT_PARAGRAPH_PAUSE_MS}`,
          "blob:base",
        ],
        [
          `voice:am_michael|speed:1.00|pitch:0.0|sentence:${LONG_TEXT_PAUSE_MS}|newline:${LONG_TEXT_NEWLINE_PAUSE_MS}|paragraph:${LONG_TEXT_PARAGRAPH_PAUSE_MS}`,
          "blob:add",
        ],
        [
          `mix:af_heart|am_michael|50|speed:1.00|pitch:0.0|sentence:${LONG_TEXT_PAUSE_MS}|newline:${LONG_TEXT_NEWLINE_PAUSE_MS}|paragraph:${LONG_TEXT_PARAGRAPH_PAUSE_MS}`,
          "blob:mix",
        ],
      ]),
    );

    vi.doMock("../composables/useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("../composables/useUiState", () => ({
      secondaryVoiceControlsOpen,
      advancedControlsOpen,
      modelDownloadApproved,
      voicePresets: ref([]),
      selectedPresetId: ref(""),
      loadVoicePresets: vi.fn(() => []),
      persistVoicePresets: vi.fn(),
    }));
    vi.doMock("../composables/useTtsWorker", () => ({
      previewAudioUrls,
      buildVoicePreviewId: vi.fn(
        (options) =>
          `voice:${options.voice}|speed:${options.speed.toFixed(2)}|pitch:${options.pitchSemitones.toFixed(1)}|sentence:${options.sentencePauseMs}|newline:${options.newlinePauseMs}|paragraph:${options.paragraphPauseMs}`,
      ),
      buildMixPreviewId: vi.fn(
        (options) =>
          `mix:${options.voice}|${options.secondaryVoice}|${options.secondaryRatio}|speed:${options.speed.toFixed(2)}|pitch:${options.pitchSemitones.toFixed(1)}|sentence:${options.sentencePauseMs}|newline:${options.newlinePauseMs}|paragraph:${options.paragraphPauseMs}`,
      ),
      cancelGeneration: vi.fn(),
    }));

    const VoiceBlend = (await import("./VoiceBlend.vue")).default;
    const wrapper = mount(VoiceBlend, {
      attachTo: document.body,
      global: {
        stubs: {
          UButton: UButtonStub,
          UAccordion: UAccordionStub,
          USelect: USelectStub,
          UInput: {
            props: ["modelValue"],
            emits: ["update:modelValue"],
            template:
              '<input type="number" :value="modelValue" @input="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).value)" />',
          },
        },
      },
    });

    expect(wrapper.text()).toContain("0 st");
    expect((wrapper.vm as any).previewSrc(null)).toBeUndefined();
    expect((wrapper.vm as any).formatPitchSemitones(0)).toBe("0 st");
    expect((wrapper.vm as any).formatPitchSemitones(-1)).toBe("-1.0 st");

    (wrapper.vm as any).handleVoiceChange("am_michael");
    expect(dispatch).toHaveBeenCalledWith({ type: "voice", voice: "am_michael" });

    await (wrapper.vm as any).toggleBlend();
    await nextTick();
    expect(secondaryVoiceControlsOpen.value).toBe(true);

    (wrapper.vm as any).handleSecondaryVoiceChange("am_michael");
    expect(dispatch).toHaveBeenCalledWith({ type: "secondary-voice", voice: "am_michael" });
    expect(dispatch).toHaveBeenCalledWith({ type: "secondary-ratio", ratio: 50 });

    state.value.secondaryVoice = "am_michael";
    state.value.secondaryRatio = 50;
    await nextTick();

    await wrapper.find("#secondary-ratio-input").setValue("35");
    expect(dispatch).toHaveBeenCalledWith({ type: "secondary-ratio", ratio: 35 });

    await wrapper.find("#speed-input").setValue("1.5");
    expect(dispatch).toHaveBeenCalledWith({ type: "speed", speed: 1.5 });

    await wrapper.find("#pitch-input").setValue("2");
    expect(dispatch).toHaveBeenCalledWith({ type: "pitch", semitones: 2 });

    state.value.pitchSemitones = 2;
    await nextTick();
    expect(wrapper.text()).toContain("+2.0 st");

    await (wrapper.vm as any).toggleAdvanced();
    await nextTick();
    expect(advancedControlsOpen.value).toBe(true);

    const pauseInputs = wrapper.findAll('input[type="number"]');
    await pauseInputs[0]!.setValue("200");
    await pauseInputs[1]!.setValue("300");
    await pauseInputs[2]!.setValue("500");
    expect(dispatch).toHaveBeenCalledWith({ type: "sentence-pause", pauseMs: 200 });
    expect(dispatch).toHaveBeenCalledWith({ type: "newline-pause", pauseMs: 300 });
    expect(dispatch).toHaveBeenCalledWith({ type: "paragraph-pause", pauseMs: 500 });

    state.value.secondaryVoice = "__none__";
    await nextTick();
    (wrapper.vm as any).handleSecondaryVoiceChange("__none__");
    expect(dispatch).toHaveBeenCalledWith({ type: "secondary-voice", voice: "__none__" });
    expect(dispatch).toHaveBeenCalledWith({ type: "secondary-ratio", ratio: 0 });

    state.value.secondaryRatio = 25;
    (wrapper.vm as any).handleSecondaryVoiceChange("am_michael");
    expect(dispatch).toHaveBeenCalledWith({ type: "secondary-voice", voice: "am_michael" });

    await (wrapper.vm as any).toggleBlend();
    await (wrapper.vm as any).toggleAdvanced();
  });
});
