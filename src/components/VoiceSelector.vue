<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useVoiceStore } from "../stores/voice";
import { formatVoiceLabel, splitVoicesByGender } from "../utils/voices";
import {
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";
import { buildVoicePreviewId, previewAudioUrls } from "../composables/usePreviewCache";

const voiceStore = useVoiceStore();
const { voices, selectedVoice } = storeToRefs(voiceStore);

const splitVoices = computed(() => splitVoicesByGender(voices.value));

const baseVoiceOptions = computed(() =>
  [...splitVoices.value.female, ...splitVoices.value.male].map((voice) => ({
    label: formatVoiceLabel(voice),
    value: voice.id,
  })),
);

function previewSrc(voiceId: string | null) {
  if (!voiceId) return undefined;
  return previewAudioUrls.value.get(
    buildVoicePreviewId({
      voice: voiceId,
      speed: 1,
      pitchSemitones: 0,
      sentencePauseMs: LONG_TEXT_PAUSE_MS,
      newlinePauseMs: LONG_TEXT_NEWLINE_PAUSE_MS,
      paragraphPauseMs: LONG_TEXT_PARAGRAPH_PAUSE_MS,
    }),
  );
}

function handleVoiceChange(value: string | number) {
  voiceStore.setVoice(String(value));
}

defineExpose({
  handleVoiceChange,
});
</script>

<template>
  <div class="flex flex-col gap-4 p-4 rounded-xl ring ring-default bg-default">
    <div class="flex flex-col gap-3">
      <h3 id="base-voice-title" class="text-xs font-bold uppercase tracking-widest">Base Voice</h3>
      <USelect
        id="voice-select"
        class="w-full"
        aria-label="Base Voice"
        :disabled="voices.length === 0"
        :model-value="selectedVoice"
        :items="baseVoiceOptions"
        @update:model-value="handleVoiceChange"
      />
    </div>

    <div
      id="base-voice-preview"
      class="rounded-xl p-3 ring ring-default bg-elevated transition-all"
      :class="{ 'opacity-50 grayscale': !previewSrc(selectedVoice) }"
    >
      <audio
        id="base-voice-sample-audio"
        :src="previewSrc(selectedVoice)"
        class="w-full outline-none h-8 rounded-lg"
        controls
        preload="none"
      />
    </div>
  </div>
</template>
