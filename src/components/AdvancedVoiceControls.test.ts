// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { useVoiceStore } from "../stores/voice";

describe("AdvancedVoiceControls", () => {
  it("updates speed, pitch, and pause controls through the voice store", async () => {
    const voiceStore = useVoiceStore();
    voiceStore.speed = 1;
    voiceStore.pitchSemitones = 0;
    voiceStore.pauses.sentence.value = 150;
    voiceStore.pauses.newline.value = 225;
    voiceStore.pauses.paragraph.value = 325;

    const AdvancedVoiceControls = (await import("./AdvancedVoiceControls.vue")).default;
    const wrapper = mount(AdvancedVoiceControls, {
      global: {
        stubs: {
          UInput: {
            props: ["modelValue"],
            emits: ["update:modelValue"],
            template:
              "<input type='number' :value='modelValue' @input=\"$emit('update:modelValue', $event.target.value)\" />",
          },
        },
      },
    });

    await wrapper.get("#speed-input").setValue("1.4");
    await wrapper.get("#pitch-input").setValue("2");

    const pauseInputs = wrapper.findAll("input[type='number']");
    await pauseInputs[0]!.setValue("200");
    await pauseInputs[1]!.setValue("300");
    await pauseInputs[2]!.setValue("450");

    expect(voiceStore.speed).toBe(1.4);
    expect(voiceStore.pitchSemitones).toBe(2);
    expect(voiceStore.pauses.sentence.value).toBe(200);
    expect(voiceStore.pauses.newline.value).toBe(300);
    expect(voiceStore.pauses.paragraph.value).toBe(450);
    expect(wrapper.text()).toContain("+2.0 st");

    await wrapper.get("#pitch-input").setValue("-1");
    expect(wrapper.text()).toContain("-1.0 st");
  });
});
