<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";
import { initWorker } from "../composables/useTtsWorker";
import { hasWebGPU } from "../utils/runtime";
import ModelDownloadGate from "./ModelDownloadGate.vue";
import RuntimeSelector from "./RuntimeSelector.vue";

const genStore = useGenerationStore();
const uiStore = useUiStore();
const { status, activityPhase, device } = storeToRefs(genStore);
const { runtimePreference, modelDownloadApproved } = storeToRefs(uiStore);

const gpuAvailable = hasWebGPU();

const modelLoading = computed(() => {
  if (activityPhase.value === "model-loading") {
    return {
      title: "Loading model",
      detail: "Downloading and preparing the Kokoro model in the browser.",
    };
  }
  if (activityPhase.value === "model-fallback") {
    return {
      title: "Switching runtime",
      detail: "WebGPU was unavailable, so the app is retrying on CPU/WASM.",
    };
  }
  return null;
});

const showModelDownloadGate = computed(
  () => !modelDownloadApproved.value && !device.value && status.value !== "loading",
);

const resolvedRuntimePreference = computed(() => runtimePreference.value);

function handleDownloadModel() {
  uiStore.setModelDownloadApproved(true);
  initWorker();
}

function handleRuntimePreferenceUpdate(value: string) {
  const next = value as "webgpu" | "wasm";
  if (runtimePreference.value === next) {
    return;
  }
  uiStore.setRuntimePreference(next);
  if (modelDownloadApproved.value) {
    initWorker();
  }
}

defineExpose({
  handleDownloadModel,
  handleRuntimePreferenceUpdate,
});
</script>

<template>
  <section aria-labelledby="controls-title">
    <h2 id="controls-title" class="mb-3 text-xs font-bold uppercase tracking-widest">
      1 - Studio Setup
    </h2>

    <ModelDownloadGate
      v-if="showModelDownloadGate"
      :disabled="status === 'loading' || status === 'generating'"
      @download="handleDownloadModel"
    />

    <RuntimeSelector
      v-else
      :model-loading="modelLoading"
      :runtime-preference="resolvedRuntimePreference"
      :status="status"
      :gpu-available="gpuAvailable"
      @update-runtime="handleRuntimePreferenceUpdate"
    />
  </section>
</template>
