import { describe, expect, it, beforeEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useEditorStore } from "../stores/editor";
import { useVoiceStore } from "../stores/voice";

describe("Pinia stores are singletons", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("exposes shared store instances across multiple calls", () => {
    const editorA = useEditorStore();
    const editorB = useEditorStore();

    expect(editorA).toBe(editorB);

    editorA.setText("Hello from store");
    expect(editorB.text).toBe("Hello from store");
  });

  it("allows stores to be updated and state is shared", () => {
    const voiceA = useVoiceStore();
    const voiceB = useVoiceStore();

    expect(voiceA).toBe(voiceB);

    voiceA.speed = 1.4;
    expect(voiceB.speed).toBe(1.4);
  });
});
