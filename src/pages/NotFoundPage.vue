<script setup lang="ts">
import { onMounted } from "vue";

onMounted(() => {
  document.title = "Page Not Found - LocalVoice Studio";
});
</script>

<template>
  <UEmpty
    icon="i-heroicons-document-magnifying-glass"
    title="Page not found"
    description="That route does not exist in LocalVoice Studio."
    :actions="[
      {
        label: 'Back to studio',
        to: '/',
        color: 'neutral',
        variant: 'soft',
      },
      {
        label: 'Open changelog',
        to: '/changelog',
        color: 'neutral',
        variant: 'ghost',
      },
    ]"
  />
</template>
