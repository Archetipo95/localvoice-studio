<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useEditorStore } from "../stores/editor";
import { useGenerationStore } from "../stores/generation";
import { useVoiceStore } from "../stores/voice";
import {
  cancelGeneration,
  clearSavedAudioCache,
  generateAudio,
  generationElapsedMs,
  lastGenerationDurationMs,
} from "../composables/useTtsWorker";
import { generationHistory, latestExportMetadata } from "../composables/useGenerationHistory";
import { resolveOutputFileName } from "../composables/useFilenameTemplate";
import { previewAudioUrls } from "../composables/usePreviewCache";
import PatternPlaceholder from "./PatternPlaceholder.vue";
import GenerationHistory from "./GenerationHistory.vue";
import GenerateButton from "./GenerateButton.vue";

const genStore = useGenerationStore();
const voiceStore = useVoiceStore();
const editorStore = useEditorStore();
const { status, activityPhase, audioUrl, canCancel, device } = storeToRefs(genStore);

const outputLoading = computed(() => {
  if (activityPhase.value !== "generating") return null;
  return {
    title: "Generating speech",
    detail: "Synthesizing your audio in the worker. This can take a moment for longer scripts.",
  };
});

function formatGenerationDuration(elapsedMs: number): string {
  const seconds = elapsedMs / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = (seconds % 60).toFixed(1);
  return `${minutes}m ${remainingSeconds}s`;
}

const elapsedLabel = computed(() => {
  const isGenerating = activityPhase.value === "generating";
  const elapsed = isGenerating ? generationElapsedMs.value : (lastGenerationDurationMs.value ?? 0);
  if (elapsed <= 0) return null;
  const formatted = formatGenerationDuration(elapsed);
  return isGenerating ? `Time waiting: ${formatted}` : `Last generation time: ${formatted}`;
});

function handleGenerate() {
  generateAudio({
    type: "generate",
    text: editorStore.text,
    voice: voiceStore.selectedVoice,
    secondaryVoice: voiceStore.secondaryVoice,
    secondaryRatio: voiceStore.secondaryRatio,
    speed: voiceStore.speed,
    pitchSemitones: voiceStore.pitchSemitones,
    sentencePauseMs: voiceStore.pauses.sentence.value,
    newlinePauseMs: voiceStore.pauses.newline.value,
    paragraphPauseMs: voiceStore.pauses.paragraph.value,
    fileName: resolveOutputFileName(voiceStore.selectedVoice),
  });
}

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
          :disabled="status === 'loading' || status === 'generating'"
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

      <GenerateButton
        :can-cancel="canCancel"
        :loading="activityPhase === 'generating'"
        :disabled="
          status === 'loading' || status === 'generating' || !voiceStore.selectedVoice || !device
        "
        :elapsed-label="elapsedLabel"
        @generate="handleGenerate"
        @cancel="cancelGeneration"
      />

      <UAlert
        v-if="genStore.error === 'Generation canceled.'"
        id="generation-cancelled-alert"
        title="Generation canceled."
        icon="i-heroicons-information-circle"
        color="warning"
        variant="soft"
      />

      <div v-if="audioUrl" class="flex flex-col gap-4 p-4 rounded-xl ring ring-default bg-default">
        <div class="flex flex-col gap-3">
          <div class="rounded-xl p-3 ring ring-default bg-elevated transition-all">
            <audio
              id="output-audio"
              class="w-full outline-none h-8 rounded-lg"
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

      <div v-if="!audioUrl" class="output-empty-state p-4 rounded-xl ring ring-default bg-default">
        <PatternPlaceholder>
          <p class="relative text-center text-sm text-muted">
            Generate audio to preview and download your final output.
          </p>
        </PatternPlaceholder>
      </div>
    </div>
  </section>
</template>
