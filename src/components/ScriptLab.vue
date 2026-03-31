<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useEditorStore } from "../stores/editor";
import { useVoiceStore } from "../stores/voice";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";
import {
  cancelGeneration,
  generateAudio,
  generationElapsedMs,
  lastGenerationDurationMs,
  resetStudioState,
} from "../composables/useTtsWorker";
import { resolveOutputFileName } from "../composables/useFilenameTemplate";
import ScriptEditorPanel from "./ScriptEditorPanel.vue";
import MarkupGuide from "./MarkupGuide.vue";
import GenerateButton from "./GenerateButton.vue";

const editorStore = useEditorStore();
const voiceStore = useVoiceStore();
const genStore = useGenerationStore();
const uiStore = useUiStore();

const { text } = storeToRefs(editorStore);
const { status, activityPhase, canCancel, device } = storeToRefs(genStore);
const { editorSourcePanelOpen, markupGuideOpen } = storeToRefs(uiStore);

const sourceDraft = ref(text.value);

const markupGuideAccordion = computed({
  get: () => (markupGuideOpen.value ? ["guide"] : []),
  set: (value: string[] | string | undefined) => {
    const open = Array.isArray(value) ? value : value ? [value] : [];
    uiStore.setMarkupGuideOpen(open.includes("guide"));
  },
});

const markupGuideItems = [
  { label: "Speech Markup Guide", icon: "i-heroicons-book-open", value: "guide" },
];

const characterCount = computed(() => text.value.length);

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

watch(
  () => editorSourcePanelOpen.value,
  (open) => {
    if (open) {
      sourceDraft.value = text.value;
    }
  },
  { immediate: true },
);

function handleGenerate() {
  generateAudio({
    type: "generate",
    text: text.value,
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

function handleClearText() {
  editorStore.setText("");
}

function handleResetControls() {
  resetStudioState();
}

function openHelpPanel() {
  sourceDraft.value = text.value;
  uiStore.setMarkupGuideOpen(true);
  uiStore.setEditorSourcePanelOpen(true);
}

function closeSourcePanel() {
  sourceDraft.value = text.value;
  uiStore.setEditorSourcePanelOpen(false);
}

function applySourceChanges() {
  editorStore.setText(sourceDraft.value);
  uiStore.setEditorSourcePanelOpen(false);
}

defineExpose({
  handleGenerate,
  handleClearText,
  handleResetControls,
  openHelpPanel,
  applySourceChanges,
  closeSourcePanel,
  setSourceDraft: (value: string) => {
    sourceDraft.value = value;
  },
});
</script>

<template>
  <section class="mt-6" aria-labelledby="script-title">
    <div class="flex flex-col gap-4 rounded-[28px] bg-elevated p-4 ring ring-default sm:p-5">
      <div class="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="script-title" class="text-xs font-bold uppercase tracking-widest">3 - Script</h2>
          <p class="mt-2 max-w-2xl text-sm leading-6 text-toned">
            Compose in plain language, then shape delivery only where it matters.
          </p>
          <p class="mt-1 max-w-3xl text-xs leading-5 text-muted">
            Write naturally. Select a word or phrase to add pronunciation, pause, or emphasis.
          </p>
        </div>
        <div class="text-sm text-muted">
          Characters: <span class="font-semibold text-highlighted">{{ characterCount }}</span>
        </div>
      </div>

      <div class="h-[clamp(32rem,72dvh,44rem)] min-h-0">
        <ScriptEditorPanel
          :model-value="text"
          @update:model-value="editorStore.setText($event)"
          @open-help="openHelpPanel"
        />
      </div>

      <div class="shrink-0 border-t border-default pt-4">
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

        <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p class="text-xs text-muted">
            Open <span class="font-semibold text-highlighted">Help</span> when you want the markup
            guide or need to hand-edit raw speech markup.
          </p>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-heroicons-trash"
            :disabled="status === 'generating' || !text"
            @click="handleClearText"
          >
            Clear Text
          </UButton>
        </div>
      </div>

      <UAlert
        v-if="genStore.error && genStore.error !== 'Generation canceled.'"
        id="error-text"
        :title="genStore.error"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
      />
    </div>

    <USlideover
      v-model:open="editorSourcePanelOpen"
      title="Help"
      description="Review the markup guide or edit the raw speech markup that powers the compose view."
      side="right"
      :ui="{
        content: 'z-[130] w-full sm:max-w-2xl',
        overlay: 'z-[129]',
        body: 'flex min-h-0 flex-col gap-5',
      }"
    >
      <template #body>
        <div class="space-y-2">
          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-sm font-semibold text-highlighted">Raw markup</p>
              <p class="text-xs text-muted">
                Changes here are applied back into the compose editor as structured tokens.
              </p>
            </div>
            <UButton color="neutral" variant="ghost" size="sm" @click="sourceDraft = text">
              Reset draft
            </UButton>
          </div>

          <UTextarea
            id="source-draft"
            v-model="sourceDraft"
            :rows="16"
            autoresize
            :maxrows="24"
            class="w-full"
            :ui="{
              root: 'w-full',
              base: 'min-h-[18rem] resize-y font-mono text-sm leading-6',
            }"
            placeholder="[word](/phonemes/) · [phrase](break:500) · [stronger](+1)"
          />
        </div>

        <UAccordion
          v-model="markupGuideAccordion"
          type="multiple"
          :unmount-on-hide="false"
          :items="markupGuideItems"
          :ui="{
            trigger: 'text-warning focus-visible:outline-warning',
            leadingIcon: 'text-warning',
            trailingIcon: 'text-warning',
          }"
        >
          <template #content>
            <MarkupGuide />
          </template>
        </UAccordion>
      </template>

      <template #footer>
        <div class="flex items-center justify-between gap-3">
          <UButton
            id="close-source-panel"
            color="neutral"
            variant="ghost"
            @click="closeSourcePanel"
          >
            Cancel
          </UButton>
          <UButton
            id="apply-source-changes"
            color="neutral"
            variant="solid"
            icon="i-heroicons-check"
            @click="applySourceChanges"
          >
            Apply Changes
          </UButton>
        </div>
      </template>
    </USlideover>
  </section>
</template>
