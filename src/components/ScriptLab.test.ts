// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../stores/editor";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";
import { useVoiceStore } from "../stores/voice";
import type { ModelDefinition } from "../types";

type ScriptLabVm = {
  onEditorUpdate: () => void;
  handleGenerate: () => void;
  handleClearText: () => void;
  handleResetControls: () => void;
  handleEditorModeToggle: (value: boolean) => void;
};

const generateAudio = vi.fn();
const clearEditorText = vi.fn();

vi.mock("../composables/useTtsWorker", () => ({
  generateAudio,
  resetStudioState: () => {
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    voice.resetToDefaults(generation.model);
    generation.resetControls();
  },
  generationElapsedMs: { value: 0 },
  lastGenerationDurationMs: { value: null },
}));

vi.mock("../composables/useFilenameTemplate", () => ({
  resolveOutputFileName: vi.fn(() => "localvoice-test.wav"),
}));

const ScriptEditorPanelStub = defineComponent({
  name: "ScriptEditorPanel",
  props: ["modelValue", "isMarkupMode", "handlers", "toolbarItems"],
  emits: ["update:modelValue", "toggleMode"],
  setup(_, { expose }) {
    expose({
      getEditorText: () => "Changed from editor",
      clearEditorText,
    });
    return () => h("div", { class: "script-editor-panel-stub" });
  },
});

describe("ScriptLab", () => {
  it("passes empty modelValue only when editor text is empty", async () => {
    const editor = useEditorStore();
    const generation = useGenerationStore();
    const ui = useUiStore();

    editor.text = "Hello world";
    generation.status = "ready";
    generation.device = "webgpu";
    ui.editorViewMode = "markup";

    const ScriptLab = (await import("./ScriptLab.vue")).default;
    const wrapper = mount(ScriptLab, {
      global: {
        stubs: {
          ScriptEditorPanel: ScriptEditorPanelStub,
          UAccordion: { template: "<div><slot /></div>" },
          UButton: { template: "<button type='button'></button>" },
          UAlert: { props: ["title"], template: "<div>{{ title }}</div>" },
          UIcon: { template: "<span></span>" },
          MarkupGuide: { template: "<div>guide</div>" },
        },
      },
    });

    expect(wrapper.findComponent(ScriptEditorPanelStub).props("modelValue")).toBe(
      "<p>Hello world</p>",
    );

    editor.text = "";
    await nextTick();
    expect(wrapper.findComponent(ScriptEditorPanelStub).props("modelValue")).toBe("");
  });

  it("updates text from editor and generates audio", async () => {
    generateAudio.mockClear();
    clearEditorText.mockClear();

    const editor = useEditorStore();
    const generation = useGenerationStore();
    const voice = useVoiceStore();
    const ui = useUiStore();
    const model: ModelDefinition = {
      id: "m1",
      label: "Model",
      modelId: "model-1",
      voices: [{ id: "af_heart", label: "Heart" }],
    };

    editor.text = "Initial";
    generation.status = "ready";
    generation.device = "webgpu";
    generation.model = model;
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 0;
    voice.language = "English";
    ui.editorViewMode = "markup";
    ui.markupGuideOpen = false;

    const ScriptLab = (await import("./ScriptLab.vue")).default;
    const wrapper = mount(ScriptLab, {
      global: {
        stubs: {
          ScriptEditorPanel: ScriptEditorPanelStub,
          UAccordion: { template: "<div class='markup-summary'><slot /></div>" },
          UButton: {
            template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
          },
          UAlert: { props: ["title"], template: "<div>{{ title }}</div>" },
          UIcon: { template: "<span></span>" },
          MarkupGuide: { template: "<div>guide</div>" },
        },
      },
    });
    const vm = wrapper.vm as unknown as ScriptLabVm;

    expect(wrapper.findComponent(ScriptEditorPanelStub).props("modelValue")).toBe("<p>Initial</p>");

    vm.onEditorUpdate();
    expect(editor.text).toBe("Changed from editor");
    expect(wrapper.findComponent(ScriptEditorPanelStub).props("modelValue")).toBe("<p>Initial</p>");

    vm.handleGenerate();
    expect(generateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Changed from editor",
        voice: "af_heart",
      }),
    );

    ui.editorViewMode = "plain";
    editor.text = "Keep me";
    await nextTick();
    vm.onEditorUpdate();
    expect(editor.text).toBe("Keep me");
  });

  it("handles validation, clear, and reset", async () => {
    generateAudio.mockClear();
    clearEditorText.mockClear();

    const editor = useEditorStore();
    const generation = useGenerationStore();
    const voice = useVoiceStore();
    const model: ModelDefinition = {
      id: "m1",
      label: "Model",
      modelId: "model-1",
      voices: [{ id: "af_heart", label: "Heart" }],
    };

    editor.text = "Initialize";
    generation.status = "ready";
    generation.device = "webgpu";
    generation.audioUrl = "blob:active";
    generation.error = "Generation canceled.";
    generation.model = model;
    voice.selectedVoice = "af_heart";
    voice.speed = 1.8;

    const ScriptLab = (await import("./ScriptLab.vue")).default;
    const wrapper = mount(ScriptLab, {
      global: {
        stubs: {
          ScriptEditorPanel: ScriptEditorPanelStub,
          UAccordion: { template: "<div><slot /></div>" },
          UButton: { template: "<button type='button'></button>" },
          UAlert: { props: ["title"], template: "<div>{{ title }}</div>" },
          UIcon: { template: "<span></span>" },
          MarkupGuide: { template: "<div>guide</div>" },
        },
      },
    });
    const vm = wrapper.vm as unknown as ScriptLabVm;

    expect(wrapper.findComponent(ScriptEditorPanelStub).props("modelValue")).toBe(
      "<p>Initialize</p>",
    );

    vm.handleGenerate();
    expect(generateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Initialize",
        voice: "af_heart",
      }),
    );

    generateAudio.mockClear();
    editor.text = "Hello";
    vm.handleGenerate();
    expect(generateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hello",
        voice: "af_heart",
      }),
    );

    generateAudio.mockClear();
    voice.selectedVoice = "am_michael";
    vm.handleGenerate();
    expect(generateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Hello",
        voice: "am_michael",
      }),
    );

    vm.handleClearText();
    await nextTick();
    expect(editor.text).toBe("");
    expect(clearEditorText).toHaveBeenCalledTimes(1);
    expect(wrapper.findComponent(ScriptEditorPanelStub).props("modelValue")).toBe("");

    vm.handleResetControls();
    expect(editor.text).toBe("");
    expect(voice.speed).toBe(1);
    expect(generation.audioUrl).toBe(null);
    expect(generation.error).toBe(null);

    vm.handleEditorModeToggle(false);
    expect(useUiStore().editorViewMode).toBe("plain");
  });
});
