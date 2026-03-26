<script setup lang="ts">
defineProps<{
  disabled?: boolean;
}>();

const emit = defineEmits<{
  download: [];
}>();
</script>

<template>
  <UCard class="mb-6 ring ring-warning/40 bg-warning/10">
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
        :disabled="disabled"
        @click="emit('download')"
      >
        Download Model
      </UButton>
    </div>
  </UCard>
</template>
