<script setup lang="ts">
import { computed, watch } from "vue";
import { useAppState } from "../composables/useAppState";
import { initWorker } from "../composables/useTtsWorker";
import { runtimePreference, modelDownloadApproved } from "../composables/useUiState";
import { hasWebGPU } from "../utils/runtime";

const { state } = useAppState();

const gpuAvailable = hasWebGPU();

const modelLoading = computed(() => {
  if (state.value.activityPhase === "model-loading") {
    return {
      title: "Loading model",
      detail: "Downloading and preparing the Kokoro model in the browser.",
    };
  }
  if (state.value.activityPhase === "model-fallback") {
    return {
      title: "Switching runtime",
      detail: "WebGPU was unavailable, so the app is retrying on CPU/WASM.",
    };
  }
  return null;
});

const showModelDownloadGate = computed(() => {
  return !modelDownloadApproved.value && !state.value.device && state.value.status !== "loading";
});

function handleDownloadModel() {
  modelDownloadApproved.value = true;
  initWorker();
}

/* v8 ignore start -- runtime preference persistence/reinit is exercised in E2E flows. */
watch(runtimePreference, (newVal, oldVal) => {
  if (newVal !== oldVal && (newVal === "webgpu" || newVal === "wasm")) {
    try {
      window.localStorage.setItem("kokoro-runtime-pref", String(newVal));
    } catch {}
    if (modelDownloadApproved.value) {
      initWorker();
    }
  }
});
/* v8 ignore stop */

function handleRuntimePreferenceUpdate(value: string) {
  runtimePreference.value = value as any;
}

defineExpose({
  handleDownloadModel,
  handleRuntimePreferenceUpdate,
});
</script>

<template>
  <section aria-labelledby="controls-title">
    <UCard v-if="showModelDownloadGate" class="mb-6 ring ring-warning/40 bg-warning/10">
      <h2 id="controls-title" class="mb-3 text-xs font-bold uppercase tracking-widest">
        1 - Studio Setup
      </h2>
      <div class="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <UIcon name="i-heroicons-arrow-down-tray" class="w-8 h-8 text-warning" />
          <div>
            <strong class="text-lg">Download required</strong>
            <p>This runs locally. Download the ~300MB Kokoro model to start.</p>
          </div>
        </div>
        <UButton
          id="download-model-button"
          color="warning"
          variant="soft"
          @click="handleDownloadModel"
        >
          Download Model
        </UButton>
      </div>
    </UCard>

    <UCard v-else-if="modelLoading" class="mb-6">
      <h2 id="controls-title" class="mb-3 text-xs font-bold uppercase tracking-widest">
        1 - Studio Setup
      </h2>
      <div class="flex flex-col gap-3">
        <div>
          <strong class="text-lg">{{ modelLoading.title }}</strong>
          <p>{{ modelLoading.detail }}</p>
        </div>
        <UProgress animation="carousel" />
      </div>
    </UCard>

    <div v-else class="flex flex-col gap-6 p-5 rounded-2xl ring ring-default bg-elevated">
      <h2 id="controls-title" class="text-xs font-bold uppercase tracking-widest">
        1 - Studio Setup
      </h2>
      <p class="leading-relaxed">
        Private, local, in-browser TTS with markup editing, voice blending, and worker-backed
        generation.
      </p>
      <div class="flex items-center gap-3">
        <span class="text-xs font-bold uppercase tracking-widest whitespace-nowrap">Run on</span>
        <USelect
          id="runtime-select"
          aria-label="Runtime"
          :model-value="runtimePreference"
          @update:model-value="handleRuntimePreferenceUpdate"
          :disabled="state.status === 'loading' || state.status === 'generating'"
          :items="[
            { label: 'GPU (faster)', value: 'webgpu', disabled: !gpuAvailable },
            { label: 'CPU (slower)', value: 'wasm' },
          ]"
        />
      </div>
    </div>
  </section>
</template>
