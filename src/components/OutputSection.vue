<script setup lang="ts">
import { computed } from "vue";
import { useAppState } from "../composables/useAppState";
import {
  clearSavedAudioCache,
  latestOutputSamples,
  previewAudioUrls,
} from "../composables/useTtsWorker";
import PatternPlaceholder from "./PatternPlaceholder.vue";

const { state } = useAppState();

const outputLoading = computed(() => {
  if (state.value.activityPhase !== "generating") {
    return null;
  }
  return {
    title: "Generating speech",
    detail: "Synthesizing your audio in the worker. This can take a moment for longer scripts.",
  };
});

const hasCachedAudio = computed(() => {
  return (
    state.value.audioUrl !== null ||
    previewAudioUrls.value.size > 0 ||
    latestOutputSamples.value !== null
  );
});

async function handleClearCachedAudio() {
  await clearSavedAudioCache();
}
</script>

<template>
  <section class="mt-6" aria-labelledby="output-title">
    <div class="flex flex-col gap-5 p-5 rounded-2xl ring ring-default bg-elevated">
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="output-title" class="text-xs font-bold uppercase tracking-widest">
            4 - Audio Output
          </h2>
          <p id="output-status-copy" class="text-xs text-muted mt-1">
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
          @click="handleClearCachedAudio"
        >
          Clear cached audio
        </UButton>
      </div>

      <div
        v-if="outputLoading"
        class="flex flex-col gap-3 p-4 rounded-xl ring ring-default bg-default text-center sm:text-left"
      >
        <div>
          <strong class="text-lg">{{ outputLoading.title }}</strong>
          <p>{{ outputLoading.detail }}</p>
        </div>
        <UProgress animation="carousel" />
      </div>

      <div
        v-else-if="state.audioUrl"
        class="flex flex-col gap-4 p-4 rounded-xl ring ring-default bg-default"
      >
        <div class="flex flex-col gap-3">
          <div class="rounded-xl p-3 ring ring-default bg-elevated transition-all">
            <audio
              id="output-audio"
              class="w-full outline-none h-8 rounded-lg"
              controls
              preload="metadata"
              :src="state.audioUrl ?? undefined"
            >
              <a :href="state.audioUrl ?? undefined" download="localvoice-studio.wav"
                >Download the generated audio</a
              >
            </audio>
          </div>

          <div class="flex justify-start sm:justify-end">
            <UButton
              id="download-link"
              class="w-full justify-center sm:w-auto"
              :to="state.audioUrl"
              download="localvoice-studio.wav"
              icon="i-heroicons-arrow-down-tray"
              target="_blank"
              color="neutral"
            >
              Download WAV
            </UButton>
          </div>
        </div>
      </div>

      <div v-else class="output-empty-state p-4 rounded-xl ring ring-default bg-default">
        <PatternPlaceholder>
          <p class="relative text-center text-sm text-muted">
            Generate audio to preview and download your final output.
          </p>
        </PatternPlaceholder>
      </div>
    </div>
  </section>
</template>
