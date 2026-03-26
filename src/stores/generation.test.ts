import { describe, expect, it } from "vitest";
import { useGenerationStore } from "./generation";
import { DEFAULT_MODEL } from "../config/model-config";

describe("generation store", () => {
  it("keeps generating phase when previews finish during generation", () => {
    const store = useGenerationStore();

    store.status = "generating";
    store.activityPhase = "generating";
    store.setPreviewReady("generating");

    expect(store.activityPhase).toBe("generating");
  });

  it("maps preview-ready phase from status safely", () => {
    const store = useGenerationStore();

    store.activityPhase = "preview-loading";
    store.setPreviewReady("loading");
    expect(store.activityPhase).toBe("model-loading");

    store.activityPhase = "preview-loading";
    store.setPreviewReady("error");
    expect(store.activityPhase).toBe("error");

    store.activityPhase = "preview-loading";
    store.setPreviewReady("ready");
    expect(store.activityPhase).toBe("idle");
  });

  it("clears transient errors on retry and success paths", () => {
    const store = useGenerationStore();

    store.setError("Generation canceled.");
    store.startGeneration();
    expect(store.error).toBe(null);

    store.setError("Generation canceled.");
    store.setReady("webgpu");
    expect(store.error).toBe(null);

    store.setError("Generation canceled.");
    store.setAudioReady("blob:demo");
    expect(store.error).toBe(null);
  });

  it("keeps idle state for unapproved model changes and loading state for approved ones", () => {
    const store = useGenerationStore();

    store.changeModel(DEFAULT_MODEL, false);
    expect(store.status).toBe("idle");
    expect(store.activityPhase).toBe("idle");

    store.changeModel(DEFAULT_MODEL, true);
    expect(store.status).toBe("loading");
    expect(store.activityPhase).toBe("model-loading");
  });

  it("covers loading, fallback, preview, and reset control transitions", () => {
    const store = useGenerationStore();

    store.canCancel = true;
    store.error = "old";
    store.setInitLoading();
    expect(store.status).toBe("loading");
    expect(store.activityPhase).toBe("model-loading");
    expect(store.canCancel).toBe(false);
    expect(store.error).toBe(null);

    store.error = "old";
    store.setInitFallback();
    expect(store.status).toBe("loading");
    expect(store.activityPhase).toBe("model-fallback");
    expect(store.error).toBe(null);

    store.startPreview();
    expect(store.activityPhase).toBe("preview-loading");
    store.startPreview();
    expect(store.activityPhase).toBe("preview-loading");

    store.setAudioReady("blob:demo");
    expect(store.audioUrl).toBe("blob:demo");
    store.canCancel = true;
    store.clearAudio();
    expect(store.audioUrl).toBe(null);
    expect(store.canCancel).toBe(false);

    store.setError("boom");
    store.clearError();
    expect(store.error).toBe(null);

    store.device = null;
    store.resetControls();
    expect(store.status).toBe("idle");

    store.device = "webgpu";
    store.resetControls();
    expect(store.status).toBe("ready");
    expect(store.activityPhase).toBe("idle");
  });
});
