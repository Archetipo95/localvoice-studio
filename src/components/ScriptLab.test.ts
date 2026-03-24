// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { toPhoneticCharKind } from "../utils/phonetic-chars";

const focusSpy = vi.fn();
const insertContentAtSpy = vi.fn();
const setTextSelectionSpy = vi.fn();

const mockEditor = {
  isEditable: true,
  state: {
    selection: { from: 1, to: 5, empty: false },
    doc: {
      textBetween: vi.fn(() => "word"),
    },
  },
  getText: vi.fn(() => "updated from editor"),
  chain: vi.fn(() => ({
    focus: focusSpy.mockReturnThis(),
    insertContentAt: insertContentAtSpy.mockReturnThis(),
    setTextSelection: setTextSelectionSpy.mockReturnValue("ok"),
  })),
};

const UButtonStub = {
  props: ["label", "disabled", "loading", "id"],
  emits: ["click"],
  template:
    '<button :id="id" type="button" :disabled="disabled" @click="$emit(\'click\')">{{ label }}<slot /><slot name="leading" /></button>',
};

const UAccordionStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template:
    '<button class="markup-summary" type="button" @click="$emit(\'update:modelValue\', [\'guide\'])"><slot /></button>',
};

const ScriptEditorPanelStub = defineComponent({
  name: "ScriptEditorPanel",
  props: ["modelValue", "isMarkupMode", "handlers", "toolbarItems"],
  emits: ["update:modelValue", "toggleMode"],
  setup(_, { expose }) {
    expose({
      getEditorText: () => "Line <one> & [two](+1)",
    });
    return () => h("div", { class: "script-editor-panel-stub" });
  },
});

describe("ScriptLab", () => {
  it("handles editor updates, markup actions, and generate/reset flows", async () => {
    vi.resetModules();
    focusSpy.mockClear();
    insertContentAtSpy.mockClear();
    setTextSelectionSpy.mockClear();

    const dispatch = vi.fn();
    const generateAudio = vi.fn();
    const cancelGeneration = vi.fn();

    const state = ref({
      text: "Line <one> & [two](+1)",
      status: "ready",
      activityPhase: "idle",
      selectedVoice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      language: "English",
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 100,
      newlinePauseMs: 150,
      paragraphPauseMs: 250,
      canCancel: false,
      device: "webgpu",
      error: null,
    } as any);

    const editorViewMode = ref<"markup" | "plain">("markup");
    const markupGuideOpen = ref(false);

    vi.doMock("../composables/useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("../composables/useTtsWorker", () => ({
      generateAudio,
      cancelGeneration,
    }));
    vi.doMock("../composables/useUiState", () => ({
      editorViewMode,
      markupGuideOpen,
    }));

    const ScriptLab = (await import("./ScriptLab.vue")).default;
    const wrapper = mount(ScriptLab, {
      global: {
        stubs: {
          UCard: { template: "<div><slot /></div>" },
          ScriptEditorPanel: ScriptEditorPanelStub,
          UAccordion: UAccordionStub,
          USwitch: {
            name: "USwitch",
            props: ["modelValue"],
            emits: ["update:modelValue"],
            template:
              '<input type="checkbox" :checked="modelValue" @change="$emit(\'update:modelValue\', ($event.target as HTMLInputElement).checked)" />',
          },
          UButton: UButtonStub,
          UAlert: { props: ["title"], template: "<div>{{ title }}</div>" },
          UIcon: { template: "<span></span>" },
        },
      },
    });

    (wrapper.vm as any).onEditorUpdate();
    expect(dispatch).toHaveBeenCalledWith({ type: "text", text: "Line <one> & [two](+1)" });

    editorViewMode.value = "plain";
    await nextTick();
    const callsBeforePlainUpdate = dispatch.mock.calls.length;
    (wrapper.vm as any).onEditorUpdate();
    expect(dispatch.mock.calls.length).toBe(callsBeforePlainUpdate);
    editorViewMode.value = "markup";
    await nextTick();
    (wrapper.vm as any).handleEditorModeToggle(false);
    expect(editorViewMode.value).toBe("plain");
    (wrapper.vm as any).handleEditorModeToggle(true);
    expect(editorViewMode.value).toBe("markup");

    const handlers = (wrapper.vm as any).customHandlers;
    expect(handlers.pronunciation.canExecute(mockEditor)).toBe(true);
    expect(handlers.break.canExecute(mockEditor)).toBe(true);
    expect(handlers.stressUp.canExecute(mockEditor)).toBe(true);
    expect(handlers.stressDown.canExecute(mockEditor)).toBe(true);

    handlers.pronunciation.execute(mockEditor);
    handlers.break.execute(mockEditor);
    handlers.stressUp.execute(mockEditor);
    handlers.stressDown.execute(mockEditor);

    expect(insertContentAtSpy).toHaveBeenNthCalledWith(
      1,
      { from: 1, to: 5 },
      { type: "text", text: "[word](/:/)" },
    );
    expect(setTextSelectionSpy).toHaveBeenNthCalledWith(1, 10); // from(1) + selected.length(4) + 5 = 10
    expect(insertContentAtSpy).toHaveBeenNthCalledWith(
      2,
      { from: 1, to: 5 },
      { type: "text", text: "[word](break:500)" },
    );
    expect(setTextSelectionSpy).toHaveBeenNthCalledWith(2, { from: 14, to: 17 });
    expect(insertContentAtSpy).toHaveBeenNthCalledWith(
      3,
      { from: 1, to: 5 },
      { type: "text", text: "[word](+1)" },
    );
    expect(setTextSelectionSpy).toHaveBeenNthCalledWith(3, { from: 9, to: 10 });
    expect(insertContentAtSpy).toHaveBeenNthCalledWith(
      4,
      { from: 1, to: 5 },
      { type: "text", text: "[word](-1)" },
    );
    expect(setTextSelectionSpy).toHaveBeenNthCalledWith(4, { from: 9, to: 10 });

    const schwaHandler = handlers[toPhoneticCharKind("ə")];
    expect(schwaHandler.canExecute(mockEditor)).toBe(true);
    schwaHandler.execute(mockEditor);
    expect(insertContentAtSpy).toHaveBeenNthCalledWith(
      5,
      { from: 1, to: 5 },
      { type: "text", text: "ə" },
    );

    mockEditor.state.selection.empty = true;
    expect(handlers.pronunciation.isDisabled(mockEditor)).toBe(true);
    mockEditor.state.selection.empty = false;

    state.value.text = "   ";
    (wrapper.vm as any).handleGenerate();
    expect(dispatch).toHaveBeenCalledWith({ type: "error", message: "Text is required." });

    state.value.text = "Hello";
    state.value.selectedVoice = "";
    (wrapper.vm as any).handleGenerate();
    expect(dispatch).toHaveBeenCalledWith({
      type: "error",
      message: "Wait for the model voices to load before generating.",
    });

    state.value.selectedVoice = "af_heart";
    state.value.device = null;
    (wrapper.vm as any).handleGenerate();
    expect(dispatch).toHaveBeenCalledWith({
      type: "error",
      message: "Download and load the model before generating.",
    });

    state.value.device = "webgpu";
    state.value.language = null;
    (wrapper.vm as any).handleGenerate();
    expect(generateAudio).toHaveBeenCalledWith(
      expect.objectContaining({ type: "generate", text: "Hello", language: undefined }),
    );

    (wrapper.vm as any).handleClearText();
    expect(dispatch).toHaveBeenCalledWith({ type: "text", text: "" });

    (wrapper.vm as any).handleResetControls();
    expect(cancelGeneration).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalledWith({ type: "reset-controls" });

    state.value.canCancel = true;
    await nextTick();
    expect(state.value.canCancel).toBe(true);

    state.value.activityPhase = "generating";
    await nextTick();
    expect(wrapper.text()).toContain("Generating...");

    state.value.error = "Boom";
    await nextTick();
    expect(wrapper.text()).toContain("Boom");
  });

  it("falls back to empty text when editor instance is unavailable", async () => {
    vi.resetModules();
    const dispatch = vi.fn();

    const state = ref({
      text: "Line one\n\nLine two",
      status: "ready",
      activityPhase: "idle",
      selectedVoice: "af_heart",
      secondaryVoice: "__none__",
      secondaryRatio: 0,
      language: "English",
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: 100,
      newlinePauseMs: 150,
      paragraphPauseMs: 250,
      canCancel: false,
      device: "webgpu",
      error: null,
    } as any);

    vi.doMock("../composables/useAppState", () => ({
      useAppState: () => ({ state, dispatch }),
    }));
    vi.doMock("../composables/useTtsWorker", () => ({
      generateAudio: vi.fn(),
      cancelGeneration: vi.fn(),
    }));
    vi.doMock("../composables/useUiState", () => ({
      editorViewMode: ref<"markup" | "plain">("markup"),
      markupGuideOpen: ref(false),
    }));

    const UEditorNoExpose = defineComponent({
      name: "ScriptEditorPanel",
      props: ["modelValue", "isMarkupMode", "handlers", "toolbarItems"],
      emits: ["update:modelValue", "toggleMode"],
      setup() {
        return () => h("div");
      },
    });

    const ScriptLab = (await import("./ScriptLab.vue")).default;
    const wrapper = mount(ScriptLab, {
      global: {
        stubs: {
          UCard: { template: "<div><slot /></div>" },
          ScriptEditorPanel: UEditorNoExpose,
          UAccordion: UAccordionStub,
          USwitch: { template: '<input type="checkbox" />' },
          UButton: UButtonStub,
          UAlert: { props: ["title"], template: "<div>{{ title }}</div>" },
          UIcon: { template: "<span></span>" },
        },
      },
    });

    (wrapper.vm as any).onEditorUpdate();
    expect(dispatch).toHaveBeenCalledWith({ type: "text", text: expect.any(String) });
  });
});
