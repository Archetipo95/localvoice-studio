<script setup lang="ts">
import { computed } from "vue";
import { storeToRefs } from "pinia";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";
import { useVoiceStore } from "../stores/voice";
import { resetStudioState } from "../composables/useTtsWorker";
import {
  buildMixPreviewId,
  buildVoicePreviewId,
  previewAudioUrls,
} from "../composables/usePreviewCache";
import {
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";
import { NO_BLEND_VOICE } from "../utils/mix";
import { formatVoiceLabel, splitVoicesByGender } from "../utils/voices";
import PatternPlaceholder from "./PatternPlaceholder.vue";
import VoiceSelector from "./VoiceSelector.vue";
import VoiceMixSlider from "./VoiceMixSlider.vue";
import AdvancedVoiceControls from "./AdvancedVoiceControls.vue";
import VoicePresetManager from "./VoicePresetManager.vue";

const genStore = useGenerationStore();
const uiStore = useUiStore();
const voiceStore = useVoiceStore();
const { status } = storeToRefs(genStore);
const { modelDownloadApproved, secondaryVoiceControlsOpen, advancedControlsOpen } =
  storeToRefs(uiStore);
const { voices, selectedVoice, secondaryVoice, secondaryRatio, speed, pitchSemitones, pauses } =
  storeToRefs(voiceStore);

const showModelDownloadGate = computed(
  () => !modelDownloadApproved.value && !genStore.device && status.value !== "loading",
);

const showFinalPreviewPlaceholder = computed(
  () => secondaryVoice.value === NO_BLEND_VOICE && voiceStore.isDefaultTuning,
);

function mixPreviewSrc() {
  const key = buildMixPreviewId({
    voice: selectedVoice.value,
    secondaryVoice: secondaryVoice.value,
    secondaryRatio: secondaryRatio.value,
    speed: speed.value,
    pitchSemitones: pitchSemitones.value,
    sentencePauseMs: pauses.value.sentence.value,
    newlinePauseMs: pauses.value.newline.value,
    paragraphPauseMs: pauses.value.paragraph.value,
  });
  return previewAudioUrls.value.get(key);
}

const splitVoices = computed(() => splitVoicesByGender(voices.value));

const secondaryVoiceOptions = computed(() => [
  { label: "None", value: NO_BLEND_VOICE },
  ...[...splitVoices.value.female, ...splitVoices.value.male].map((voice) => ({
    label: formatVoiceLabel(voice),
    value: voice.id,
    disabled: voice.id === selectedVoice.value,
  })),
]);

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

function handleSecondaryVoiceChange(value: string | number) {
  const nextVoice = String(value);
  secondaryVoiceControlsOpen.value = nextVoice !== NO_BLEND_VOICE;
  voiceStore.setSecondaryVoice(nextVoice);
  if (nextVoice === NO_BLEND_VOICE) {
    voiceStore.secondaryRatio = 0;
  } else if (voiceStore.secondaryRatio === 0) {
    voiceStore.secondaryRatio = 50;
  }
}

const accordionItems = [
  { label: "Blend", icon: "i-heroicons-users", value: "blend" },
  { label: "Advanced", icon: "i-heroicons-adjustments-horizontal", value: "advanced" },
];

const accordionOpen = computed({
  get: () => {
    const open: string[] = [];
    if (secondaryVoiceControlsOpen.value) open.push("blend");
    if (advancedControlsOpen.value) open.push("advanced");
    return open;
  },
  set: (value: string[] | string | undefined) => {
    const open = Array.isArray(value) ? value : value ? [value] : [];
    secondaryVoiceControlsOpen.value = open.includes("blend");
    advancedControlsOpen.value = open.includes("advanced");
  },
});

function handleResetControls() {
  resetStudioState();
}
</script>

<template>
  <section v-if="showModelDownloadGate" class="mt-6" aria-hidden="true">
    <div class="flex flex-col gap-5 p-5 rounded-2xl ring ring-default bg-elevated opacity-50">
      <h2 class="text-xs font-bold uppercase tracking-widest">2 - Voice Setup</h2>
      <PatternPlaceholder>
        <p class="relative text-center text-sm text-muted">
          Available after the model is downloaded.
        </p>
      </PatternPlaceholder>
    </div>
  </section>

  <section v-else class="mt-6" aria-labelledby="mixing-title">
    <div class="flex flex-col gap-5 p-5 rounded-2xl ring ring-default bg-elevated">
      <h2 id="mixing-title" class="text-xs font-bold uppercase tracking-widest">2 - Voice Setup</h2>

      <VoiceSelector />

      <div class="pt-2 border-t border-default">
        <UAccordion
          v-model="accordionOpen"
          type="multiple"
          :unmount-on-hide="false"
          :items="accordionItems"
        >
          <template #content="{ item }">
            <div v-if="item.value === 'blend'" class="mt-2 flex flex-col gap-4">
              <!-- Secondary Voice Selector -->
              <div class="flex flex-col gap-4 p-4 rounded-xl ring ring-default bg-default">
                <div class="flex flex-col gap-3">
                  <h3 class="text-xs font-bold uppercase tracking-widest">Secondary Voice</h3>
                  <USelect
                    id="secondary-voice-select"
                    class="w-full"
                    aria-label="Add Voice"
                    :disabled="voices.length === 0"
                    :model-value="secondaryVoice"
                    :items="secondaryVoiceOptions"
                    @update:model-value="handleSecondaryVoiceChange"
                  />
                </div>

                <div
                  v-if="secondaryVoice !== NO_BLEND_VOICE"
                  id="add-voice-preview"
                  class="rounded-xl p-3 ring ring-default bg-elevated transition-all"
                  :class="{ 'opacity-50 grayscale': !previewSrc(secondaryVoice) }"
                >
                  <audio
                    id="add-voice-sample-audio"
                    :src="previewSrc(secondaryVoice)"
                    class="w-full outline-none h-8 rounded-lg"
                    controls
                    preload="none"
                  />
                </div>
              </div>

              <!-- Mix Percentage Slider -->
              <div v-if="secondaryVoice !== NO_BLEND_VOICE" class="pt-2 border-t border-default">
                <VoiceMixSlider />
              </div>
            </div>
            <div v-else-if="item.value === 'advanced'" class="mt-2">
              <AdvancedVoiceControls />
            </div>
          </template>
        </UAccordion>
      </div>

      <div class="pt-2 border-t border-default">
        <div
          class="flex flex-col gap-4 p-4 rounded-xl ring ring-default bg-default"
          aria-labelledby="mix-voice-title"
        >
          <h3 id="mix-voice-title" class="text-xs font-bold uppercase tracking-widest">
            Tuned Preview
          </h3>
          <div
            v-if="showFinalPreviewPlaceholder"
            id="mix-voice-preview"
            class="rounded-xl ring ring-default"
          >
            <PatternPlaceholder>
              <p id="mix-preview-placeholder" class="relative text-center text-sm text-muted">
                Tuned preview appears when you blend or adjust the advanced controls.
              </p>
            </PatternPlaceholder>
          </div>
          <div
            v-else
            id="mix-voice-preview"
            class="rounded-xl p-3 ring ring-default bg-elevated transition-all"
            :class="{ 'opacity-50 grayscale': !mixPreviewSrc() }"
          >
            <audio
              id="mix-output-audio"
              :src="mixPreviewSrc()"
              class="w-full outline-none h-8 rounded-lg"
              controls
              preload="none"
            />
          </div>
        </div>

        <VoicePresetManager />

        <div class="mt-4 flex justify-end pt-3 border-t border-default">
          <UButton
            :disabled="status === 'loading' || status === 'generating'"
            color="neutral"
            variant="outline"
            icon="i-heroicons-trash"
            @click="handleResetControls"
          >
            Reset all controls
          </UButton>
        </div>
      </div>
    </div>
  </section>
</template>
