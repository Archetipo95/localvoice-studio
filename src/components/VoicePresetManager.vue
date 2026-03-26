<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useVoiceStore } from "../stores/voice";
import { useUiStore } from "../stores/ui";
import { useGenerationStore } from "../stores/generation";
import type { VoicePreset } from "../types";

const voiceStore = useVoiceStore();
const uiStore = useUiStore();
const genStore = useGenerationStore();

const { voicePresets, selectedPresetId } = storeToRefs(uiStore);
const { selectedVoice, secondaryVoice, secondaryRatio, speed, pitchSemitones, pauses } =
  storeToRefs(voiceStore);

// Load presets when the model changes.
watch(
  () => genStore.model,
  (model) => {
    uiStore.loadVoicePresets(model);
  },
  { immediate: true },
);

const presetNameInput = ref("");

const canSavePreset = computed(() => presetNameInput.value.trim().length > 0);

const selectedPreset = computed(
  () => voicePresets.value.find((item) => item.id === selectedPresetId.value) ?? null,
);

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
  if (presetNameMatch.value.id === selectedPresetId.value)
    return "Updates the selected preset with your current setup.";
  return "A preset with this name already exists and will be replaced.";
});

const presetOptions = computed(() =>
  voicePresets.value.map((p) => ({ label: p.name, value: p.id })),
);

watch(selectedPresetId, (id) => {
  const preset = voicePresets.value.find((p) => p.id === id);
  presetNameInput.value = preset ? preset.name : "";
});

function captureCurrentPreset(name: string): VoicePreset {
  return {
    id: crypto.randomUUID(),
    name,
    voice: selectedVoice.value,
    secondaryVoice: secondaryVoice.value,
    secondaryRatio: secondaryRatio.value,
    speed: speed.value,
    pitchSemitones: pitchSemitones.value,
    sentencePauseMs: pauses.value.sentence.value,
    sentencePauseMinMs: pauses.value.sentence.min,
    sentencePauseMaxMs: pauses.value.sentence.max,
    newlinePauseMs: pauses.value.newline.value,
    newlinePauseMinMs: pauses.value.newline.min,
    newlinePauseMaxMs: pauses.value.newline.max,
    paragraphPauseMs: pauses.value.paragraph.value,
    paragraphPauseMinMs: pauses.value.paragraph.min,
    paragraphPauseMaxMs: pauses.value.paragraph.max,
  };
}

function handleSavePreset() {
  const name = presetNameInput.value.trim();
  if (!name) return;
  const existing = voicePresets.value.find((p) => p.name.toLowerCase() === name.toLowerCase());
  const nextPreset = captureCurrentPreset(name);
  if (existing) nextPreset.id = existing.id;
  uiStore.upsertPreset(nextPreset, genStore.model);
}

function handleDeletePreset() {
  if (!selectedPresetId.value) return;
  uiStore.deletePreset(selectedPresetId.value, genStore.model);
  presetNameInput.value = "";
}

function handlePresetSelectionUpdate(value: string | number) {
  const id = String(value);
  uiStore.selectPreset(id);
  const preset = voicePresets.value.find((p) => p.id === id);
  if (preset) voiceStore.applyPreset(preset);
}

function useSuggestedPresetName(name: string) {
  presetNameInput.value = name;
}
</script>

<template>
  <div class="mt-4">
    <UAccordion
      :unmount-on-hide="false"
      :items="[{ label: 'Voice Presets', icon: 'i-heroicons-bookmark-square', value: 'presets' }]"
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
              <UButton size="xs" variant="soft" @click="useSuggestedPresetName('Narration - Calm')">
                Narration - Calm
              </UButton>
              <UButton
                size="xs"
                variant="soft"
                @click="useSuggestedPresetName('Story - Warm Blend')"
              >
                Story - Warm Blend
              </UButton>
              <UButton
                size="xs"
                variant="soft"
                @click="useSuggestedPresetName('Explainer - Crisp')"
              >
                Explainer - Crisp
              </UButton>
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
                :items="presetOptions"
                :disabled="!hasPresets"
                placeholder="Select a preset"
                class="w-full"
                @update:model-value="handlePresetSelectionUpdate"
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
            <div class="text-xs text-muted">
              Active preset:
              <strong v-if="selectedPreset" class="text-toned">{{ selectedPreset.name }}</strong>
              <span v-else>none</span>
            </div>
            <div class="flex gap-2">
              <UButton
                id="save-preset-button"
                icon="i-heroicons-document-arrow-down"
                :disabled="!canSavePreset"
                variant="soft"
                title="Save Preset"
                @click="handleSavePreset"
              >
                {{ savePresetLabel }}
              </UButton>
              <UButton
                id="delete-preset-button"
                icon="i-heroicons-trash"
                color="error"
                variant="soft"
                :disabled="!selectedPresetId"
                title="Delete Preset"
                @click="handleDeletePreset"
              >
                Delete
              </UButton>
            </div>
          </div>
        </div>
      </template>
    </UAccordion>
  </div>
</template>
