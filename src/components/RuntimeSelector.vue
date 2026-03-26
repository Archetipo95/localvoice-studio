<script setup lang="ts">
const props = defineProps<{
  modelLoading: {
    title: string;
    detail: string;
  } | null;
  runtimePreference: "webgpu" | "wasm";
  status: "idle" | "loading" | "ready" | "generating" | "error";
  gpuAvailable: boolean;
}>();

const emit = defineEmits<{
  updateRuntime: [value: "webgpu" | "wasm"];
}>();

function handleRuntimeChange(value: string | number) {
  emit("updateRuntime", String(value) as "webgpu" | "wasm");
}

defineExpose({
  handleRuntimeChange,
});
</script>

<template>
  <UCard v-if="props.modelLoading" class="mb-6">
    <div class="flex flex-col gap-3">
      <div>
        <strong class="text-lg">{{ props.modelLoading.title }}</strong>
        <p>{{ props.modelLoading.detail }}</p>
      </div>
      <UProgress animation="carousel" data-progress="1" />
    </div>
  </UCard>

  <div v-else class="flex flex-col gap-6 p-5 rounded-2xl ring ring-default bg-elevated">
    <p class="leading-relaxed">
      Private, local, in-browser TTS with markup editing, voice blending, and worker-backed
      generation.
    </p>

    <div class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
      <span class="text-xs font-bold uppercase tracking-widest">Run on</span>
      <USelect
        id="runtime-select"
        class="w-full sm:w-auto"
        aria-label="Runtime"
        :model-value="props.runtimePreference"
        @update:model-value="handleRuntimeChange"
        :disabled="props.status === 'loading' || props.status === 'generating'"
        :items="[
          { label: 'GPU (faster)', value: 'webgpu', disabled: !props.gpuAvailable },
          { label: 'CPU (slower)', value: 'wasm' },
        ]"
      />
    </div>
  </div>
</template>
