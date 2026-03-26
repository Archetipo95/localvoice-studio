// @vitest-environment jsdom
import { mount } from "@vue/test-utils";
import { ref } from "vue";
import { describe, expect, it, vi } from "vitest";
import { useVoiceStore } from "../stores/voice";
import { NO_BLEND_VOICE } from "../utils/mix";

type VoiceSelectorVm = {
  handleVoiceChange: (voice: string) => void;
};

const previewAudioUrls = ref(new Map<string, string>());

vi.mock("../composables/usePreviewCache", () => ({
  previewAudioUrls,
  buildVoicePreviewId: ({ voice }: { voice: string }) => `voice:${voice}`,
}));

describe("VoiceSelector", () => {
  it("updates the selected voice and resets an invalid blend pairing", async () => {
    const voiceStore = useVoiceStore();
    voiceStore.voices = [
      { id: "af_heart", label: "Heart" },
      { id: "am_michael", label: "Michael" },
    ];
    voiceStore.selectedVoice = "af_heart";
    voiceStore.secondaryVoice = "am_michael";
    voiceStore.secondaryRatio = 50;

    previewAudioUrls.value = new Map([["voice:af_heart", "blob:heart"]]);

    const VoiceSelector = (await import("./VoiceSelector.vue")).default;
    const wrapper = mount(VoiceSelector);
    const vm = wrapper.vm as unknown as VoiceSelectorVm;

    expect(wrapper.find("#base-voice-sample-audio").attributes("src")).toBe("blob:heart");

    vm.handleVoiceChange("am_michael");

    expect(voiceStore.selectedVoice).toBe("am_michael");
    expect(voiceStore.secondaryVoice).toBe(NO_BLEND_VOICE);
    expect(voiceStore.secondaryRatio).toBe(0);
  });
});
