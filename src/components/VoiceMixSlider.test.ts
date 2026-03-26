// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { useVoiceStore } from "../stores/voice";

describe("VoiceMixSlider", () => {
  it("updates the mix ratio through the voice store", async () => {
    const voiceStore = useVoiceStore();
    voiceStore.secondaryRatio = 25;

    const VoiceMixSlider = (await import("./VoiceMixSlider.vue")).default;
    const wrapper = mount(VoiceMixSlider);

    expect(wrapper.text()).toContain("25%");

    await wrapper.get("#secondary-ratio-input").setValue("60");

    expect(voiceStore.secondaryRatio).toBe(60);
    expect(wrapper.text()).toContain("60%");
  });
});
