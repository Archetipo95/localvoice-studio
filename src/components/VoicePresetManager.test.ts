// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";
import { useVoiceStore } from "../stores/voice";

describe("VoicePresetManager", () => {
  it("loads presets on mount, suggests names, saves, selects, and deletes presets", async () => {
    const ui = useUiStore();
    const voice = useVoiceStore();
    const generation = useGenerationStore();

    generation.model = {
      id: "m1",
      label: "Model",
      modelId: "model-1",
      voices: [{ id: "af_heart", label: "Heart" }],
    } as any;
    voice.selectedVoice = "af_heart";
    voice.secondaryVoice = "__none__";
    voice.secondaryRatio = 25;
    voice.speed = 1.1;
    voice.pitchSemitones = 2;
    voice.pauses.sentence.value = 100;
    voice.pauses.newline.value = 150;
    voice.pauses.paragraph.value = 250;

    const loadVoicePresets = vi.spyOn(ui, "loadVoicePresets");
    const upsertPreset = vi.spyOn(ui, "upsertPreset");
    const deletePreset = vi.spyOn(ui, "deletePreset");
    const selectPreset = vi.spyOn(ui, "selectPreset");
    const applyPreset = vi.spyOn(voice, "applyPreset");
    vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "generated-id") });

    const VoicePresetManager = (await import("./VoicePresetManager.vue")).default;
    const wrapper = mount(VoicePresetManager, {
      global: {
        stubs: {
          UAccordion: {
            props: ["items"],
            template: "<div><slot name='content' :item='items[0]' /></div>",
          },
          USelect: {
            props: ["modelValue", "items", "disabled"],
            emits: ["update:modelValue"],
            template:
              "<select id='preset-select' :disabled='disabled' :value='modelValue' @change=\"$emit('update:modelValue', $event.target.value)\"><option v-for='item in items' :key='item.value' :value='item.value'>{{ item.label }}</option></select>",
          },
          UInput: {
            props: ["modelValue", "placeholder"],
            emits: ["update:modelValue"],
            template:
              "<input id='preset-name-input' :value='modelValue' :placeholder='placeholder' @input=\"$emit('update:modelValue', $event.target.value)\" />",
          },
          UButton: {
            props: ["disabled"],
            emits: ["click"],
            template:
              "<button :id='$attrs.id' :disabled='disabled' @click=\"$emit('click')\"><slot /></button>",
          },
        },
      },
    });

    expect(loadVoicePresets).toHaveBeenCalledWith(generation.model);
    expect(wrapper.text()).toContain("No presets saved yet.");
    const suggestedButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("Narration - Calm"));
    await suggestedButton?.trigger("click");
    await nextTick();
    await wrapper.find("#preset-name-input").setValue("Narration - Calm");
    expect(wrapper.text()).toContain("Creates a new preset from your current setup.");

    await wrapper.find("#save-preset-button").trigger("click");
    expect(upsertPreset).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "generated-id",
        name: "Narration - Calm",
        voice: "af_heart",
        secondaryRatio: 25,
        speed: 1.1,
        pitchSemitones: 2,
      }),
      generation.model,
    );

    ui.voicePresets = [
      {
        id: "preset-1",
        name: "Narration - Calm",
        voice: "af_heart",
        secondaryVoice: "__none__",
        secondaryRatio: 0,
        speed: 1,
        pitchSemitones: 0,
        sentencePauseMs: 100,
        sentencePauseMinMs: 0,
        sentencePauseMaxMs: 200,
        newlinePauseMs: 150,
        newlinePauseMinMs: 0,
        newlinePauseMaxMs: 300,
        paragraphPauseMs: 250,
        paragraphPauseMinMs: 0,
        paragraphPauseMaxMs: 400,
      },
    ] as any;
    ui.selectedPresetId = "preset-1";
    await nextTick();

    expect(wrapper.text()).toContain("Update selected");
    expect(wrapper.text()).toContain("Active preset:");
    expect(wrapper.text()).toContain("Narration - Calm");

    (wrapper.vm as any).handlePresetSelectionUpdate("preset-1");
    await nextTick();
    expect(selectPreset).toHaveBeenCalledWith("preset-1");
    expect(applyPreset).toHaveBeenCalledWith(ui.voicePresets[0]);

    await wrapper.find("#delete-preset-button").trigger("click");
    expect(deletePreset).toHaveBeenCalledWith("preset-1", generation.model);

    ui.voicePresets = [
      { ...ui.voicePresets[0], id: "preset-2", name: "Story - Warm Blend" },
    ] as any;
    ui.selectedPresetId = "";
    await wrapper.find("#preset-name-input").setValue("Story - Warm Blend");
    await nextTick();
    expect(wrapper.text()).toContain("Overwrite existing");
  });
});
