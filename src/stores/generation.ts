import { defineStore } from "pinia";
import { DEFAULT_MODEL } from "../config/model-config";
import type { ActivityPhase, AppStatus, ModelDefinition, RuntimeDevice } from "../types";

const STATUS_TO_PHASE: Record<AppStatus, ActivityPhase> = {
  generating: "generating",
  loading: "model-loading",
  error: "error",
  idle: "idle",
  ready: "idle",
};

export const useGenerationStore = defineStore("generation", {
  state: () => ({
    status: "idle" as AppStatus,
    activityPhase: "idle" as ActivityPhase,
    model: DEFAULT_MODEL as ModelDefinition,
    device: null as RuntimeDevice | null,
    error: null as string | null,
    audioUrl: null as string | null,
    canCancel: false,
  }),

  actions: {
    changeModel(model: ModelDefinition, downloadApproved = false) {
      this.model = model;
      this.status = downloadApproved ? "loading" : "idle";
      this.activityPhase = downloadApproved ? "model-loading" : "idle";
      this.device = null;
      this.error = null;
      this.audioUrl = null;
      this.canCancel = false;
    },

    setInitLoading() {
      this.status = "loading";
      this.activityPhase = "model-loading";
      this.canCancel = false;
      this.error = null;
    },

    setInitFallback() {
      this.status = "loading";
      this.activityPhase = "model-fallback";
      this.error = null;
    },

    setReady(device: RuntimeDevice): void {
      this.status = "ready";
      this.activityPhase = "idle";
      this.device = device;
      this.error = null;
      this.canCancel = false;
    },

    startGeneration() {
      this.status = "generating";
      this.activityPhase = "generating";
      this.canCancel = true;
      this.error = null;
    },

    startPreview() {
      if (this.activityPhase !== "preview-loading") {
        this.activityPhase = "preview-loading";
      }
    },

    setAudioReady(audioUrl: string) {
      this.status = "ready";
      this.activityPhase = "idle";
      this.audioUrl = audioUrl;
      this.canCancel = false;
      this.error = null;
    },

    clearAudio() {
      this.audioUrl = null;
      this.canCancel = false;
    },

    setPreviewReady(currentStatus: AppStatus) {
      const next = STATUS_TO_PHASE[currentStatus];
      if (this.activityPhase !== next) {
        this.activityPhase = next;
      }
    },

    setError(message: string) {
      this.status = "error";
      this.activityPhase = "error";
      this.error = message;
      this.canCancel = false;
    },

    clearError() {
      this.error = null;
    },

    resetControls() {
      this.status = this.device ? "ready" : "idle";
      this.activityPhase = "idle";
      this.error = null;
      this.audioUrl = null;
      this.canCancel = false;
    },
  },
});
