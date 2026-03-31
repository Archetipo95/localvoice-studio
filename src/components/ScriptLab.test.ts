// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { defineComponent, h, nextTick, ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useEditorStore } from "../stores/editor";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";
import { useVoiceStore } from "../stores/voice";
import type { ModelDefinition } from "../types";

type ScriptLabVm = {
  handleGenerate: () => void;
  handleClearText: () => void;
  handleResetControls: () => void;
  openHelpPanel: () => void;
  applySourceChanges: () => void;
  closeSourcePanel: () => void;
  setSourceDraft: (value: string) => void;
};

const generateAudio = vi.fn();
const cancelGeneration = vi.fn();
const generationElapsedMs = ref(0);
const lastGenerationDurationMs = ref<number | null>(null);

vi.mock("../composables/useTtsWorker", () => ({
  generateAudio,
  cancelGeneration,
  generationElapsedMs,
  lastGenerationDurationMs,
  resetStudioState: () => {
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    voice.resetToDefaults(generation.model);
    generation.resetControls();
  },
}));

vi.mock("../composables/useFilenameTemplate", () => ({
  resolveOutputFileName: vi.fn(() => "localvoice-test.wav"),
}));

const ScriptEditorPanelStub = defineComponent({
  name: "ScriptEditorPanel",
  props: ["modelValue"],
  emits: ["update:modelValue", "openHelp"],
  setup(props, { emit }) {
    return () =>
      h("div", { class: "script-editor-panel-stub" }, [
        h("p", props.modelValue),
        h("button", {
          id: "emit-editor-update",
          onClick: () => emit("update:modelValue", "Changed from editor"),
        }),
        h("button", { id: "open-help", onClick: () => emit("openHelp") }),
      ]);
  },
});

describe("ScriptLab", () => {
  it("updates text from the editor panel and generates from the script card", async () => {
    generateAudio.mockClear();
    cancelGeneration.mockClear();
    generationElapsedMs.value = 0;
    lastGenerationDurationMs.value = 75_000;

    const editor = useEditorStore();
    const generation = useGenerationStore();
    const voice = useVoiceStore();
    const model: ModelDefinition = {
      id: "m1",
      label: "Model",
      modelId: "model-1",
      voices: [{ id: "af_heart", label: "Heart" }],
    };

    editor.text = "Initial";
    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    generation.model = model;
    generation.canCancel = true;
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 0;
    voice.language = "English";

    const ScriptLab = (await import("./ScriptLab.vue")).default;
    const wrapper = mount(ScriptLab, {
      global: {
        stubs: {
          ScriptEditorPanel: ScriptEditorPanelStub,
          GenerateButton: {
            props: ["elapsedLabel", "canCancel", "loading", "disabled"],
            emits: ["generate", "cancel"],
            template:
              "<div><button id='trigger-generate' :data-elapsed='elapsedLabel' :data-can-cancel='String(canCancel)' :data-loading='String(loading)' :data-disabled='String(disabled)' @click=\"$emit('generate')\">Generate</button><button id='trigger-cancel' @click=\"$emit('cancel')\">Cancel</button></div>",
          },
          USlideover: {
            props: ["open"],
            emits: ["update:open"],
            template:
              "<div v-if='open' class='slideover'><slot name='body' /><slot name='footer' /></div>",
          },
          UTextarea: {
            props: ["modelValue"],
            emits: ["update:modelValue"],
            template:
              "<textarea id='source-draft' :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\"></textarea>",
          },
          UAccordion: { template: "<div class='markup-guide'><slot /></div>" },
          UButton: {
            props: ["disabled"],
            emits: ["click"],
            template:
              "<button :id='$attrs.id' :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
          },
          UAlert: { props: ["title"], template: "<div id='error-text'>{{ title }}</div>" },
          MarkupGuide: { template: "<div>guide</div>" },
        },
      },
    });
    const vm = wrapper.vm as unknown as ScriptLabVm;

    expect(wrapper.findComponent(ScriptEditorPanelStub).props("modelValue")).toBe("Initial");
    expect(wrapper.find("#trigger-generate").attributes("data-elapsed")).toBe(
      "Last generation time: 1m 15.0s",
    );
    expect(wrapper.find("#trigger-generate").attributes("data-can-cancel")).toBe("true");
    await wrapper.find("#emit-editor-update").trigger("click");
    expect(editor.text).toBe("Changed from editor");

    vm.handleGenerate();
    expect(generateAudio).toHaveBeenCalledWith(
      expect.objectContaining({
        text: "Changed from editor",
        voice: "af_heart",
        fileName: "localvoice-test.wav",
      }),
    );
    await wrapper.find("#trigger-cancel").trigger("click");
    expect(cancelGeneration).toHaveBeenCalledTimes(1);

    vm.handleClearText();
    await nextTick();
    expect(editor.text).toBe("");
    expect(wrapper.findComponent(ScriptEditorPanelStub).props("modelValue")).toBe("");
  });

  it("opens help, applies source edits, and resets controls", async () => {
    generateAudio.mockClear();
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

    editor.text = "Original";
    generation.status = "ready";
    generation.activityPhase = "idle";
    generation.device = "webgpu";
    generation.audioUrl = "blob:active";
    generation.error = "Generation failed.";
    generation.model = model;
    voice.selectedVoice = "af_heart";
    voice.speed = 1.8;

    const ScriptLab = (await import("./ScriptLab.vue")).default;
    const wrapper = mount(ScriptLab, {
      global: {
        stubs: {
          ScriptEditorPanel: ScriptEditorPanelStub,
          GenerateButton: { template: "<div></div>" },
          USlideover: {
            props: ["open"],
            emits: ["update:open"],
            template:
              "<div v-if='open' class='slideover'><slot name='body' /><slot name='footer' /></div>",
          },
          UTextarea: {
            props: ["modelValue"],
            emits: ["update:modelValue"],
            template:
              "<textarea id='source-draft' :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\"></textarea>",
          },
          UAccordion: { template: "<div class='markup-guide'><slot /></div>" },
          UButton: {
            props: ["disabled"],
            emits: ["click"],
            template:
              "<button :id='$attrs.id' :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
          },
          UAlert: { props: ["title"], template: "<div id='error-text'>{{ title }}</div>" },
          MarkupGuide: { template: "<div>guide</div>" },
        },
      },
    });
    const vm = wrapper.vm as unknown as ScriptLabVm;

    vm.openHelpPanel();
    await nextTick();
    expect(ui.editorSourcePanelOpen).toBe(true);
    expect(ui.markupGuideOpen).toBe(true);

    vm.setSourceDraft("[missing](break:)");
    vm.applySourceChanges();
    expect(editor.text).toBe("[missing](break:)");
    expect(ui.editorSourcePanelOpen).toBe(false);

    vm.openHelpPanel();
    await nextTick();
    expect(ui.editorSourcePanelOpen).toBe(true);

    vm.setSourceDraft("[word](/wɜːd/)");
    vm.applySourceChanges();
    expect(editor.text).toBe("[word](/wɜːd/)");
    expect(ui.editorSourcePanelOpen).toBe(false);

    vm.closeSourcePanel();
    await nextTick();
    expect(ui.editorSourcePanelOpen).toBe(false);

    expect(wrapper.find("#error-text").text()).toContain("Generation failed.");

    vm.handleResetControls();
    expect(editor.text).toBe("[word](/wɜːd/)");
    expect(voice.speed).toBe(1);
    expect(generation.audioUrl).toBe(null);
    expect(generation.error).toBe(null);
  });

  it("keeps generate disabled until the model is fully ready", async () => {
    const editor = useEditorStore();
    const generation = useGenerationStore();
    const voice = useVoiceStore();

    editor.text = "Pending model";
    generation.status = "error";
    generation.activityPhase = "error";
    generation.device = "webgpu";
    voice.selectedVoice = "af_heart";

    const ScriptLab = (await import("./ScriptLab.vue")).default;
    const wrapper = mount(ScriptLab, {
      global: {
        stubs: {
          ScriptEditorPanel: ScriptEditorPanelStub,
          GenerateButton: {
            props: ["elapsedLabel", "canCancel", "loading", "disabled"],
            template:
              "<button id='trigger-generate' :data-disabled='String(disabled)'>Generate</button>",
          },
          USlideover: {
            props: ["open"],
            emits: ["update:open"],
            template:
              "<div v-if='open' class='slideover'><slot name='body' /><slot name='footer' /></div>",
          },
          UTextarea: {
            props: ["modelValue"],
            emits: ["update:modelValue"],
            template:
              "<textarea id='source-draft' :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\"></textarea>",
          },
          UAccordion: { template: "<div class='markup-guide'><slot /></div>" },
          UButton: {
            props: ["disabled"],
            emits: ["click"],
            template:
              "<button :id='$attrs.id' :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
          },
          UAlert: { props: ["title"], template: "<div id='error-text'>{{ title }}</div>" },
          MarkupGuide: { template: "<div>guide</div>" },
        },
      },
    });

    expect(wrapper.find("#trigger-generate").attributes("data-disabled")).toBe("true");

    generation.status = "ready";
    generation.activityPhase = "idle";
    await nextTick();

    expect(wrapper.find("#trigger-generate").attributes("data-disabled")).toBe("false");
  });
});
