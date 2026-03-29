<script setup lang="ts">
import { computed, ref, useTemplateRef, watch } from "vue";
import { storeToRefs } from "pinia";
import { useEditorStore } from "../stores/editor";
import { useVoiceStore } from "../stores/voice";
import { useGenerationStore } from "../stores/generation";
import { useUiStore } from "../stores/ui";
import { generateAudio, resetStudioState } from "../composables/useTtsWorker";
import { resolveOutputFileName } from "../composables/useFilenameTemplate";
import { customHandlers, textToHtml, toolbarItems } from "../composables/useEditorHandlers";
import { stripSpeechMarkup } from "../utils/pronunciation";
import ScriptEditorPanel from "./ScriptEditorPanel.vue";
import MarkupGuide from "./MarkupGuide.vue";

const editorStore = useEditorStore();
const voiceStore = useVoiceStore();
const genStore = useGenerationStore();
const uiStore = useUiStore();
const { text } = storeToRefs(editorStore);
const { status } = storeToRefs(genStore);
const { editorViewMode, markupGuideOpen } = storeToRefs(uiStore);

const markupGuideAccordion = computed({
  get: () => (markupGuideOpen.value ? ["guide"] : []),
  set: (val: string[] | string | undefined) => {
    const open = Array.isArray(val) ? val : val ? [val] : [];
    markupGuideOpen.value = open.includes("guide");
  },
});

const markupGuideItems = [
  { label: "Speech Markup Guide", icon: "i-heroicons-book-open", value: "guide" },
];

const scriptEditor = useTemplateRef<{
  getEditorText: () => string;
  clearEditorText: () => void;
}>("scriptEditor");

const editorModelValue = ref(
  textToHtml(editorViewMode.value === "plain" ? stripSpeechMarkup(text.value) : text.value),
);
let pendingEditorEchoText: string | null = null;

watch(
  [text, editorViewMode],
  ([nextText, mode]) => {
    if (mode === "markup" && pendingEditorEchoText !== null && nextText === pendingEditorEchoText) {
      pendingEditorEchoText = null;
      return;
    }

    pendingEditorEchoText = null;

    const source = mode === "plain" ? stripSpeechMarkup(nextText) : nextText;
    editorModelValue.value = textToHtml(source);
  },
  { immediate: true },
);

const characterCount = computed(() => text.value.length);

function onEditorUpdate() {
  if (editorViewMode.value === "plain") return;
  const next = scriptEditor.value?.getEditorText?.() ?? "";
  pendingEditorEchoText = next;
  editorStore.setText(next);
}

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
  scriptEditor.value?.clearEditorText?.();
  editorStore.setText("");
}

function handleResetControls() {
  resetStudioState();
}

function handleEditorModeToggle(value: boolean) {
  uiStore.setEditorViewMode(value ? "markup" : "plain");
}

defineExpose({
  onEditorUpdate,
  customHandlers,
  toolbarItems,
  handleGenerate,
  handleClearText,
  handleResetControls,
  handleEditorModeToggle,
});
</script>

<template>
  <section class="mt-6" aria-labelledby="script-title">
    <div class="flex flex-col gap-5 p-5 rounded-2xl ring ring-default bg-elevated">
      <h2 id="script-title" class="text-xs font-bold uppercase tracking-widest">3 - Text Input</h2>

      <UAccordion
        class="markup-summary"
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

      <div
        v-if="editorViewMode === 'markup'"
        class="flex items-start gap-2 rounded-lg ring ring-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning"
      >
        <UIcon name="i-heroicons-cursor-arrow-rays" class="mt-0.5 size-4 shrink-0" />
        <p>
          Select a word or phrase in the editor before using Pronunciation, Pause, or Emphasis
          buttons.
        </p>
      </div>

      <ScriptEditorPanel
        ref="scriptEditor"
        :model-value="editorModelValue"
        :is-markup-mode="editorViewMode === 'markup'"
        :handlers="customHandlers"
        :toolbar-items="toolbarItems"
        @update:model-value="onEditorUpdate"
        @toggle-mode="handleEditorModeToggle"
      />

      <div class="mt-2 flex flex-wrap items-center justify-between gap-4">
        <p class="text-xs text-muted">
          Characters: <span class="font-semibold text-highlighted">{{ characterCount }}</span>
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

      <UAlert
        v-if="genStore.error && genStore.error !== 'Generation canceled.'"
        id="error-text"
        :title="genStore.error"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
      />
    </div>
  </section>
</template>
