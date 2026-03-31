<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useGenerationStore } from "../stores/generation";
import { clearSavedAudioCache } from "../composables/useTtsWorker";
import { generationHistory, latestExportMetadata } from "../composables/useGenerationHistory";
import { previewAudioUrls } from "../composables/usePreviewCache";
import PatternPlaceholder from "./PatternPlaceholder.vue";
import GenerationHistory from "./GenerationHistory.vue";

const genStore = useGenerationStore();
const { status, audioUrl } = storeToRefs(genStore);

const latestResolvedFileName = computed(
  () => latestExportMetadata.value?.fileName ?? "localvoice-studio.wav",
);

const hasCachedAudio = computed(
  () =>
    audioUrl.value !== null ||
    previewAudioUrls.value.size > 0 ||
    latestExportMetadata.value !== null ||
    generationHistory.value.length > 0,
);

async function handleClearCachedAudio() {
  await clearSavedAudioCache();
}
</script>

<template>
  <section class="mt-6" aria-labelledby="output-title">
    <div class="flex flex-col gap-5 rounded-2xl bg-elevated p-5 ring ring-default">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="output-title" class="text-xs font-bold uppercase tracking-widest">
            4 - Audio Output
          </h2>
          <p id="output-status-copy" class="mt-1 text-xs text-muted">
            Generated audio stays local to this browser session.
          </p>
        </div>
        <UButton
          v-if="hasCachedAudio"
          id="clear-audio-cache-button"
          class="self-start"
          size="xs"
          variant="soft"
          color="neutral"
          icon="i-heroicons-trash"
          :disabled="status === 'loading' || status === 'generating'"
          @click="handleClearCachedAudio"
        >
          Clear cached audio
        </UButton>
      </div>

      <div v-if="audioUrl" class="flex flex-col gap-4 rounded-xl bg-default p-4 ring ring-default">
        <div class="flex flex-col gap-3">
          <div class="rounded-xl bg-elevated p-3 ring ring-default transition-all">
            <audio
              id="output-audio"
              class="h-8 w-full rounded-lg outline-none"
              controls
              preload="metadata"
              :src="audioUrl ?? undefined"
            >
              <a :href="audioUrl ?? undefined" :download="latestResolvedFileName"
                >Download the generated audio</a
              >
            </audio>
          </div>

          <div class="flex flex-wrap items-center gap-3 text-xs text-muted">
            <span
              >File:
              <span class="font-semibold text-highlighted">{{ latestResolvedFileName }}</span></span
            >
            <span v-if="latestExportMetadata"
              >Format: <span class="font-semibold text-highlighted">16-bit WAV</span></span
            >
            <span v-if="latestExportMetadata"
              >Size:
              <span class="font-semibold text-highlighted"
                >{{ latestExportMetadata.sizeBytes }} bytes</span
              ></span
            >
          </div>

          <div class="flex justify-start sm:justify-end">
            <UButton
              id="download-link"
              class="w-full justify-center sm:w-auto"
              :to="audioUrl"
              :download="latestResolvedFileName"
              icon="i-heroicons-arrow-down-tray"
              target="_blank"
              color="neutral"
            >
              Download {{ latestResolvedFileName }}
            </UButton>
          </div>
        </div>
      </div>

      <GenerationHistory />

      <div v-if="!audioUrl" class="output-empty-state rounded-xl bg-default p-4 ring ring-default">
        <PatternPlaceholder>
          <p class="relative text-center text-sm text-muted">
            Generate audio from the script editor to preview and download your final output.
          </p>
        </PatternPlaceholder>
      </div>
    </div>
  </section>
</template>
