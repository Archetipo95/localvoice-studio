<script setup lang="ts">
const props = defineProps<{
  canCancel: boolean;
  loading: boolean;
  disabled: boolean;
  elapsedLabel: string | null;
}>();

const emit = defineEmits<{
  generate: [];
  cancel: [];
}>();
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-between gap-4 rounded-xl ring ring-default bg-default p-4"
  >
    <div class="flex items-center gap-4">
      <UButton v-if="props.canCancel" color="error" variant="outline" @click="emit('cancel')">
        Cancel
      </UButton>
      <UButton
        :loading="props.loading"
        :disabled="props.disabled"
        @click="emit('generate')"
        class="font-bold tracking-wide"
      >
        <template #leading>
          <UIcon v-if="!props.loading" name="i-heroicons-sparkles" class="w-5 h-5" />
        </template>
        {{ props.loading ? "Generating..." : "Generate Audio" }}
      </UButton>
    </div>

    <div class="text-xs text-muted">
      <p v-if="props.elapsedLabel">
        <span class="font-semibold text-highlighted">{{ props.elapsedLabel }}</span>
      </p>
    </div>
  </div>
</template>
