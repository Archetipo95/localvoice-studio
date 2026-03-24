<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useAppState } from "../composables/useAppState";
import { NO_BLEND_VOICE } from "../utils/mix";
import { formatVoiceLabel, splitVoicesByGender } from "../utils/voices";
import {
  LONG_TEXT_PAUSE_MS,
  LONG_TEXT_NEWLINE_PAUSE_MS,
  LONG_TEXT_PARAGRAPH_PAUSE_MS,
} from "../utils/long-text";
import {
  secondaryVoiceControlsOpen,
  advancedControlsOpen,
  modelDownloadApproved,
  voicePresets,
  selectedPresetId,
  loadVoicePresets,
  persistVoicePresets,
} from "../composables/useUiState";
import PatternPlaceholder from "./PatternPlaceholder.vue";
import type { VoicePreset } from "../types";

const { state, dispatch } = useAppState();

const splitVoices = computed(() => splitVoicesByGender(state.value.voices));
const femaleVoices = computed(() => splitVoices.value.female);
const maleVoices = computed(() => splitVoices.value.male);

const baseVoiceOptions = computed(() => {
  return [...femaleVoices.value, ...maleVoices.value].map((voice) => ({
    label: formatVoiceLabel(voice),
    value: voice.id,
  }));
});

const secondaryVoiceOptions = computed(() => {
  return [
    { label: "None", value: NO_BLEND_VOICE },
    ...[...femaleVoices.value, ...maleVoices.value].map((voice) => ({
      label: formatVoiceLabel(voice),
      value: voice.id,
      disabled: voice.id === state.value.selectedVoice,
    })),
  ];
});

const accordionItems = [
  {
    label: "Blend",
    icon: "i-heroicons-users",
    value: "blend",
  },
  {
    label: "Advanced",
    icon: "i-heroicons-adjustments-horizontal",
    value: "advanced",
  },
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

import {
  buildMixPreviewId,
  buildVoicePreviewId,
  cancelGeneration,
  previewAudioUrls,
} from "../composables/useTtsWorker";

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

function mixPreviewSrc() {
  const key = buildMixPreviewId({
    voice: state.value.selectedVoice,
    secondaryVoice: state.value.secondaryVoice,
    secondaryRatio: state.value.secondaryRatio,
    speed: state.value.speed,
    pitchSemitones: state.value.pitchSemitones,
    sentencePauseMs: state.value.sentencePauseMs,
    newlinePauseMs: state.value.newlinePauseMs,
    paragraphPauseMs: state.value.paragraphPauseMs,
  });
  return previewAudioUrls.value.get(key);
}

// In e2e, mock TTS immediately populates the blobs.

const showModelDownloadGate = computed(() => {
  return !modelDownloadApproved.value && !state.value.device && state.value.status !== "loading";
});

const showFinalPreviewPlaceholder = computed(() => {
  const singleVoiceOnly = state.value.secondaryVoice === NO_BLEND_VOICE;
  const hasDefaultTuning =
    state.value.speed === 1 &&
    state.value.pitchSemitones === 0 &&
    state.value.sentencePauseMs === LONG_TEXT_PAUSE_MS &&
    state.value.newlinePauseMs === LONG_TEXT_NEWLINE_PAUSE_MS &&
    state.value.paragraphPauseMs === LONG_TEXT_PARAGRAPH_PAUSE_MS;

  return singleVoiceOnly && hasDefaultTuning;
});

const formatPitchSemitones = (st: number) => {
  if (Math.abs(st) < 0.01) return "0 st";
  return `${st > 0 ? "+" : ""}${st.toFixed(1)} st`;
};

function handleVoiceChange(value: string | number) {
  dispatch({ type: "voice", voice: String(value) });
}

function handleSecondaryVoiceChange(value: string | number) {
  const nextVoice = String(value);
  secondaryVoiceControlsOpen.value = nextVoice !== NO_BLEND_VOICE;
  dispatch({ type: "secondary-voice", voice: nextVoice });

  if (nextVoice === NO_BLEND_VOICE) {
    dispatch({ type: "secondary-ratio", ratio: 0 });
    return;
  }
  if (state.value.secondaryRatio === 0) {
    dispatch({ type: "secondary-ratio", ratio: 50 });
  }
}

// Sliders and such
function updateSpeed(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  dispatch({ type: "speed", speed: value });
}

function updatePitch(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  dispatch({ type: "pitch", semitones: value });
}

function updateSecondaryRatio(e: Event) {
  const value = Number((e.target as HTMLInputElement).value);
  dispatch({ type: "secondary-ratio", ratio: value });
}

const presetNameInput = ref("");
const canSavePreset = computed(() => presetNameInput.value.trim().length > 0);

const selectedPreset = computed(() => {
  return voicePresets.value.find((item) => item.id === selectedPresetId.value) ?? null;
});

const hasPresets = computed(() => voicePresets.value.length > 0);

const presetNameMatch = computed(() => {
  const name = presetNameInput.value.trim().toLowerCase();
  if (!name) return null;
  return voicePresets.value.find((preset) => preset.name.toLowerCase() === name) ?? null;
});

const savePresetLabel = computed(() => {
  if (!canSavePreset.value) return "Save preset";
  if (!presetNameMatch.value) return "Save new";
  if (presetNameMatch.value.id === selectedPresetId.value) return "Update selected";
  return "Overwrite existing";
});

const presetSaveHint = computed(() => {
  if (!canSavePreset.value) return "Name your preset to enable saving.";
  if (!presetNameMatch.value) return "Creates a new preset from your current setup.";
  if (presetNameMatch.value.id === selectedPresetId.value) {
    return "Updates the selected preset with your current setup.";
  }
  return "A preset with this name already exists and will be replaced.";
});

watch(
  () => state.value.model,
  (model) => {
    voicePresets.value = loadVoicePresets(model);
  },
  { immediate: true },
);

function captureCurrentPreset(name: string): VoicePreset {
  return {
    id: crypto.randomUUID(),
    name,
    voice: state.value.selectedVoice,
    secondaryVoice: state.value.secondaryVoice,
    secondaryRatio: state.value.secondaryRatio,
    speed: state.value.speed,
    pitchSemitones: state.value.pitchSemitones,
    sentencePauseMs: state.value.sentencePauseMs,
    sentencePauseMinMs: state.value.sentencePauseMinMs,
    sentencePauseMaxMs: state.value.sentencePauseMaxMs,
    newlinePauseMs: state.value.newlinePauseMs,
    newlinePauseMinMs: state.value.newlinePauseMinMs,
    newlinePauseMaxMs: state.value.newlinePauseMaxMs,
    paragraphPauseMs: state.value.paragraphPauseMs,
    paragraphPauseMinMs: state.value.paragraphPauseMinMs,
    paragraphPauseMaxMs: state.value.paragraphPauseMaxMs,
  };
}

function handleSavePreset() {
  const name = presetNameInput.value.trim();
  if (!name) {
    dispatch({ type: "error", message: "Enter a preset name first." });
    return;
  }

  const existing = voicePresets.value.find(
    (preset) => preset.name.toLowerCase() === name.toLowerCase(),
  );
  const nextPreset = captureCurrentPreset(name);
  if (existing) {
    nextPreset.id = existing.id;
    voicePresets.value = voicePresets.value.map((preset) =>
      preset.id === existing.id ? nextPreset : preset,
    );
  } else {
    voicePresets.value = [nextPreset, ...voicePresets.value];
  }

  selectedPresetId.value = nextPreset.id;
  persistVoicePresets(state.value.model);
}

function handleDeletePreset() {
  if (!selectedPresetId.value) return;
  voicePresets.value = voicePresets.value.filter((preset) => preset.id !== selectedPresetId.value);
  selectedPresetId.value = "";
  presetNameInput.value = "";
  persistVoicePresets(state.value.model);
}

function handleApplyPreset() {
  const preset = voicePresets.value.find((item) => item.id === selectedPresetId.value);
  if (preset) {
    dispatch({ type: "apply-preset", preset });
  }
}

function handlePresetSelectionUpdate(value: string) {
  selectedPresetId.value = value;
  handleApplyPreset();
}

function useSuggestedPresetName(name: string) {
  presetNameInput.value = name;
}

function handleResetControls() {
  cancelGeneration();
  dispatch({ type: "reset-controls" });
}

watch(selectedPresetId, (id) => {
  if (id) {
    const preset = voicePresets.value.find((p) => p.id === id);
    if (preset) presetNameInput.value = preset.name;
  } else {
    presetNameInput.value = "";
  }
});

const presetOptions = computed(() => {
  return voicePresets.value.map((p) => ({ label: p.name, value: p.id }));
});

function toggleBlend() {
  secondaryVoiceControlsOpen.value = !secondaryVoiceControlsOpen.value;
}

function toggleAdvanced() {
  advancedControlsOpen.value = !advancedControlsOpen.value;
}

defineExpose({
  previewSrc,
  mixPreviewSrc,
  formatPitchSemitones,
  handleVoiceChange,
  handleSecondaryVoiceChange,
  updateSpeed,
  updatePitch,
  updateSecondaryRatio,
  handleSavePreset,
  handleDeletePreset,
  handlePresetSelectionUpdate,
  handleResetControls,
  useSuggestedPresetName,
  toggleBlend,
  toggleAdvanced,
});
// Missing many UI update and render parts for clarity, but this covers structure
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

      <div class="flex flex-col gap-4 p-4 rounded-xl ring ring-default bg-default">
        <div class="flex flex-col gap-3">
          <h3 id="base-voice-title" class="text-xs font-bold uppercase tracking-widest">
            Base Voice
          </h3>
          <USelect
            id="voice-select"
            class="w-full"
            aria-label="Base Voice"
            :disabled="state.voices.length === 0"
            :model-value="state.selectedVoice"
            :items="baseVoiceOptions"
            @update:model-value="handleVoiceChange"
          />
        </div>
        <div
          id="base-voice-preview"
          class="rounded-xl p-3 ring ring-default bg-elevated transition-all"
          :class="{ 'opacity-50 grayscale': !previewSrc(state.selectedVoice) }"
        >
          <audio
            :id="`base-voice-sample-audio`"
            :src="previewSrc(state.selectedVoice)"
            class="w-full outline-none h-8 rounded-lg"
            controls
            preload="none"
          ></audio>
        </div>
      </div>

      <div class="pt-2 border-t border-default">
        <UAccordion
          v-model="accordionOpen"
          type="multiple"
          :unmount-on-hide="false"
          :items="accordionItems"
        >
          <template #content="{ item }">
            <div
              v-if="item.value === 'blend'"
              id="blend-drawer"
              class="mt-2 flex flex-col gap-4 p-4 rounded-xl ring ring-default bg-default"
            >
              <div class="flex flex-col gap-3">
                <h3 id="secondary-voice-title" class="text-xs font-bold uppercase tracking-widest">
                  Secondary Voice
                </h3>
                <USelect
                  id="secondary-voice-select"
                  class="w-full"
                  aria-label="Add Voice"
                  :disabled="state.voices.length === 0"
                  :model-value="state.secondaryVoice"
                  :items="secondaryVoiceOptions"
                  @update:model-value="handleSecondaryVoiceChange"
                />
                <div
                  v-if="state.secondaryVoice !== NO_BLEND_VOICE"
                  id="add-voice-preview"
                  class="rounded-xl p-3 ring ring-default bg-elevated transition-all"
                  :class="{ 'opacity-50 grayscale': !previewSrc(state.secondaryVoice) }"
                >
                  <audio
                    :id="`add-voice-sample-audio`"
                    :src="previewSrc(state.secondaryVoice)"
                    class="w-full outline-none h-8 rounded-lg"
                    controls
                    preload="none"
                  ></audio>
                </div>
              </div>

              <div
                v-if="state.secondaryVoice !== NO_BLEND_VOICE"
                class="flex flex-col gap-3 pt-4 border-t border-default"
              >
                <h3 class="text-xs font-bold uppercase tracking-widest">Mix Intensity</h3>
                <p class="text-xs text-muted">
                  This percentage is how much of the secondary voice is present in the main voice
                  output.
                </p>

                <label class="flex flex-col gap-1.5">
                  <div class="flex justify-between text-xs font-semibold">
                    <span>Secondary Voice in Main</span>
                    <span id="secondary-ratio-output">{{ state.secondaryRatio }}%</span>
                  </div>
                  <input
                    id="secondary-ratio-input"
                    aria-label="Secondary Voice Percentage in Main"
                    type="range"
                    class="w-full accent-primary cursor-pointer"
                    min="0"
                    max="100"
                    step="5"
                    :value="state.secondaryRatio"
                    @input="updateSecondaryRatio"
                  />
                </label>
              </div>
            </div>

            <div
              v-else-if="item.value === 'advanced'"
              id="tune-drawer"
              class="mt-2 flex flex-col gap-6 p-4 rounded-xl ring ring-default bg-default"
            >
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="flex flex-col gap-4">
                  <h3 class="text-xs font-bold uppercase tracking-widest">Delivery</h3>
                  <label class="flex flex-col gap-1.5">
                    <div class="flex justify-between text-xs font-semibold">
                      <span>Speed</span>
                      <span>{{ state.speed.toFixed(2) }}x</span>
                    </div>
                    <input
                      id="speed-input"
                      aria-label="Speed"
                      type="range"
                      class="w-full accent-primary cursor-pointer"
                      min="0.5"
                      max="2"
                      step="0.1"
                      :value="state.speed"
                      @input="updateSpeed"
                    />
                  </label>
                  <label class="flex flex-col gap-1.5 mt-2">
                    <div class="flex justify-between text-xs font-semibold">
                      <span>Pitch</span>
                      <span id="pitch-output">{{
                        formatPitchSemitones(state.pitchSemitones)
                      }}</span>
                    </div>
                    <input
                      id="pitch-input"
                      aria-label="Pitch"
                      type="range"
                      class="w-full accent-primary cursor-pointer"
                      min="-12"
                      max="12"
                      step="1"
                      :value="state.pitchSemitones"
                      @input="updatePitch"
                    />
                  </label>
                </div>

                <div
                  class="flex flex-col gap-4 border-t border-default pt-4 md:border-t-0 md:pt-0 md:border-l md:border-default md:pl-6"
                >
                  <h3 class="text-xs font-bold uppercase tracking-widest">Pauses (ms)</h3>
                  <div class="flex flex-col gap-3">
                    <label class="flex cursor-pointer items-center justify-between text-sm">
                      <span class="text-xs font-semibold">Sentence</span>
                      <UInput
                        type="number"
                        class="w-20"
                        min="0"
                        step="50"
                        :model-value="state.sentencePauseMs"
                        @update:model-value="
                          dispatch({ type: 'sentence-pause', pauseMs: Number($event) })
                        "
                      />
                    </label>
                    <label class="flex cursor-pointer items-center justify-between text-sm">
                      <span class="text-xs font-semibold">Newline</span>
                      <UInput
                        type="number"
                        class="w-20"
                        min="0"
                        step="50"
                        :model-value="state.newlinePauseMs"
                        @update:model-value="
                          dispatch({ type: 'newline-pause', pauseMs: Number($event) })
                        "
                      />
                    </label>
                    <label class="flex cursor-pointer items-center justify-between text-sm">
                      <span class="text-xs font-semibold">Paragraph</span>
                      <UInput
                        type="number"
                        class="w-20"
                        min="0"
                        step="50"
                        :model-value="state.paragraphPauseMs"
                        @update:model-value="
                          dispatch({ type: 'paragraph-pause', pauseMs: Number($event) })
                        "
                      />
                    </label>
                  </div>
                </div>
              </div>
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
            ></audio>
          </div>
        </div>

        <div class="mt-4">
          <UAccordion
            :unmount-on-hide="false"
            :items="[
              { label: 'Voice Presets', icon: 'i-heroicons-bookmark-square', value: 'presets' },
            ]"
            :default-value="['presets']"
            type="multiple"
          >
            <template #content="{ item }">
              <div
                v-if="item.value === 'presets'"
                class="flex flex-col gap-3 p-4 rounded-xl ring ring-default bg-default"
              >
                <p class="text-xs text-muted">
                  Save and recall complete voice recipes for this model in this browser.
                </p>

                <div v-if="!hasPresets" class="rounded-xl p-3 ring ring-default bg-default/70">
                  <p class="text-sm font-medium">No presets saved yet.</p>
                  <p class="mt-1 text-xs text-muted">
                    Name your current setup and press Save to create your first preset.
                  </p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <UButton
                      size="xs"
                      variant="soft"
                      @click="useSuggestedPresetName('Narration - Calm')"
                      >Narration - Calm</UButton
                    >
                    <UButton
                      size="xs"
                      variant="soft"
                      @click="useSuggestedPresetName('Story - Warm Blend')"
                      >Story - Warm Blend</UButton
                    >
                    <UButton
                      size="xs"
                      variant="soft"
                      @click="useSuggestedPresetName('Explainer - Crisp')"
                      >Explainer - Crisp</UButton
                    >
                  </div>
                </div>

                <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <label class="flex flex-col gap-1.5">
                    <span class="text-[11px] font-bold uppercase tracking-widest text-muted"
                      >Saved Presets</span
                    >
                    <USelect
                      id="preset-select"
                      aria-label="Voice Preset"
                      :model-value="selectedPresetId"
                      @update:model-value="handlePresetSelectionUpdate"
                      :items="presetOptions"
                      :disabled="!hasPresets"
                      placeholder="Select a preset"
                      class="w-full"
                    />
                    <p class="text-[11px] text-muted">Choosing one applies it immediately.</p>
                  </label>

                  <label class="flex flex-col gap-1.5">
                    <span class="text-[11px] font-bold uppercase tracking-widest text-muted"
                      >Preset Name</span
                    >
                    <UInput
                      id="preset-name-input"
                      v-model="presetNameInput"
                      placeholder="e.g. Podcast Warmth"
                      maxlength="40"
                      class="w-full"
                    />
                    <p class="text-[11px]" :class="presetNameMatch ? 'text-warning' : 'text-muted'">
                      {{ presetSaveHint }}
                    </p>
                  </label>
                </div>

                <div class="flex items-center justify-between gap-3 flex-wrap">
                  <div v-if="selectedPreset" class="text-xs text-muted">
                    Active preset: <strong class="text-toned">{{ selectedPreset.name }}</strong>
                  </div>
                  <div v-else class="text-xs text-muted">Active preset: none</div>

                  <div class="flex gap-2">
                    <UButton
                      id="save-preset-button"
                      icon="i-heroicons-document-arrow-down"
                      :disabled="!canSavePreset"
                      @click="handleSavePreset"
                      title="Save Preset"
                      variant="soft"
                    >
                      {{ savePresetLabel }}
                    </UButton>
                    <UButton
                      id="delete-preset-button"
                      icon="i-heroicons-trash"
                      color="error"
                      variant="soft"
                      :disabled="!selectedPresetId"
                      @click="handleDeletePreset"
                      title="Delete Preset"
                    >
                      Delete
                    </UButton>
                  </div>
                </div>
              </div>
            </template>
          </UAccordion>
        </div>

        <div class="mt-4 flex justify-end pt-3 border-t border-default">
          <UButton
            :disabled="state.status === 'loading' || state.status === 'generating'"
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
