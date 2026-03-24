<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import type { EditorCustomHandlers, EditorToolbarItem } from "@nuxt/ui";
import type { Editor } from "@tiptap/vue-3";
import { useAppState } from "../composables/useAppState";
import { generateAudio, cancelGeneration } from "../composables/useTtsWorker";
import { editorViewMode } from "../composables/useUiState";
import { stripSpeechMarkup } from "../utils/pronunciation";
import { getAllPhoneticChars, toPhoneticCharKind } from "../utils/phonetic-chars";
import ScriptEditorPanel from "./ScriptEditorPanel.vue";

const { state, dispatch } = useAppState();

const markupGuideVisible = ref(false);

const markupGuideAccordion = computed({
  get: () => (markupGuideVisible.value ? ["guide"] : []),
  set: (val: string[] | string | undefined) => {
    const open = Array.isArray(val) ? val : val ? [val] : [];
    markupGuideVisible.value = open.includes("guide");
  },
});

const markupGuideItems = [
  {
    label: "Speech Markup Guide",
    icon: "i-heroicons-musical-note",
    value: "guide",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert flat speech-markup text to minimal HTML for UEditor.
 * Splits on newlines, HTML-escapes only the characters that matter in HTML
 * (<, >, &). Square brackets and parentheses are safe and will render as-is.
 */
function textToHtml(text: string): string {
  const lines = text.split("\n");
  return lines
    .map((line) => {
      const escaped = line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      return `<p>${escaped === "" ? "<br>" : escaped}</p>`;
    })
    .join("");
}

// ── Editor state ───────────────────────────────────────────────────────────

const scriptEditor = useTemplateRef<{ getEditorText: () => string }>("scriptEditor");

const editorHtmlValue = computed(() =>
  textToHtml(
    editorViewMode.value === "plain" ? stripSpeechMarkup(state.value.text) : state.value.text,
  ),
);

function onEditorUpdate() {
  if (editorViewMode.value === "plain") return;
  const text = scriptEditor.value?.getEditorText?.() ?? "";
  dispatch({ type: "text", text });
}

// ── Custom TipTap handlers ─────────────────────────────────────────────────

function selectionText(editor: Editor): string {
  const { from, to } = editor.state.selection;
  return editor.state.doc.textBetween(from, to);
}

function isSelectionInsideMarkup(editor: Editor, pattern: RegExp): boolean {
  const { from, to, empty } = editor.state.selection;
  if (empty) return false;

  const scanStart = Math.max(1, from - 120);
  const docSize = editor.state.doc.content?.size ?? to;
  const scanEnd = Math.min(docSize, to + 40);
  const windowText = editor.state.doc.textBetween(scanStart, scanEnd, "\n", "\n");

  const selectionStartInWindow = from - scanStart;
  const selectionEndInWindow = to - scanStart;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(windowText)) !== null) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;
    if (selectionStartInWindow >= matchStart && selectionEndInWindow <= matchEnd) {
      return true;
    }
  }

  return false;
}

function canApplyMarkup(editor: Editor): boolean {
  return (
    !editor.state.selection.empty &&
    editor.isEditable &&
    !isSelectionInsideMarkup(editor, /\[[^\]]+\]\((?:\/[^)]*\/|break:\d+|[+-]\d+)\)/g)
  );
}

function canApplyPronunciation(editor: Editor): boolean {
  return canApplyMarkup(editor);
}

function canApplyBreak(editor: Editor): boolean {
  return canApplyMarkup(editor);
}

function canApplyStress(editor: Editor): boolean {
  return canApplyMarkup(editor);
}

/**
 * Create a handler for inserting a specific phonetic character.
 * Handles both direct character insertion and markup patterns.
 */
function createPhoneticCharHandler(char: string) {
  return {
    canExecute: (editor: Editor) => editor.isEditable,
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      return editor.chain().focus().insertContentAt({ from, to }, { type: "text", text: char });
    },
    isActive: () => false,
    isDisabled: (editor: Editor) => !editor.isEditable,
  };
}

/**
 * Pre-generate handlers for all phonetic characters.
 * This allows the suggestion menu to reference them by kind.
 */
function generatePhoneticHandlers() {
  const handlers: EditorCustomHandlers = {};
  for (const item of getAllPhoneticChars()) {
    handlers[toPhoneticCharKind(item.char)] = createPhoneticCharHandler(item.char);
  }

  return handlers;
}

/* v8 ignore start -- toolbar handler branch internals are covered in E2E editing scenarios. */
const phoneticHandlers = generatePhoneticHandlers();
const customHandlers = {
  undo: {
    canExecute: (editor: Editor) => editor.isEditable && editor.can().undo(),
    execute: (editor: Editor) => editor.chain().focus().undo(),
    isActive: (editor: Editor) => editor.isEditable && editor.can().undo(),
    isDisabled: (editor: Editor) => !editor.isEditable || !editor.can().undo(),
  },
  redo: {
    canExecute: (editor: Editor) => editor.isEditable && editor.can().redo(),
    execute: (editor: Editor) => editor.chain().focus().redo(),
    isActive: (editor: Editor) => editor.isEditable && editor.can().redo(),
    isDisabled: (editor: Editor) => !editor.isEditable || !editor.can().redo(),
  },
  pronunciation: {
    canExecute: (editor: Editor) => canApplyPronunciation(editor),
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      const selected = selectionText(editor);
      const markup = `[${selected}](/:/)`;
      // Cursor lands after `:`, before the closing `/`.
      const cursorPos = from + selected.length + 5; // `[` + sel + `](/:` = sel.length + 5
      return editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, { type: "text", text: markup })
        .setTextSelection(cursorPos);
    },
    isActive: (editor: Editor) => canApplyPronunciation(editor),
    isDisabled: (editor: Editor) => !canApplyPronunciation(editor),
  },
  break: {
    canExecute: (editor: Editor) => canApplyBreak(editor),
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      const selected = selectionText(editor);
      const markup = `[${selected}](break:500)`;
      // Cursor lands on the numeric duration value (500)
      const durationStart = from + selected.length + 9; // after `[sel](break:`
      const durationEnd = durationStart + 3; // length of '500'
      return editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, { type: "text", text: markup })
        .setTextSelection({ from: durationStart, to: durationEnd });
    },
    isActive: (editor: Editor) => canApplyBreak(editor),
    isDisabled: (editor: Editor) => !canApplyBreak(editor),
  },
  stressUp: {
    canExecute: (editor: Editor) => canApplyStress(editor),
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      const selected = selectionText(editor);
      const markup = `[${selected}](+1)`;
      // Cursor lands on the numeric value (1), after `[sel](+`
      const numStart = from + selected.length + 4;
      const numEnd = numStart + 1;
      return editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, { type: "text", text: markup })
        .setTextSelection({ from: numStart, to: numEnd });
    },
    isActive: (editor: Editor) => canApplyStress(editor),
    isDisabled: (editor: Editor) => !canApplyStress(editor),
  },
  stressDown: {
    canExecute: (editor: Editor) => canApplyStress(editor),
    execute: (editor: Editor) => {
      const { from, to } = editor.state.selection;
      const selected = selectionText(editor);
      const markup = `[${selected}](-1)`;
      // Cursor lands on the numeric value (1), after `[sel](-`
      const numStart = from + selected.length + 4;
      const numEnd = numStart + 1;
      return editor
        .chain()
        .focus()
        .insertContentAt({ from, to }, { type: "text", text: markup })
        .setTextSelection({ from: numStart, to: numEnd });
    },
    isActive: (editor: Editor) => canApplyStress(editor),
    isDisabled: (editor: Editor) => !canApplyStress(editor),
  },
  ...phoneticHandlers,
} satisfies EditorCustomHandlers;
/* v8 ignore stop */

// ── Toolbar items ──────────────────────────────────────────────────────────

const toolbarItems: EditorToolbarItem<typeof customHandlers>[][] = [
  [
    {
      kind: "undo",
      icon: "i-heroicons-arrow-uturn-left",
      tooltip: { text: "Undo" },
    },
    {
      kind: "redo",
      icon: "i-heroicons-arrow-uturn-right",
      tooltip: { text: "Redo" },
    },
  ],
  [
    {
      kind: "pronunciation",
      icon: "i-heroicons-musical-note",
      tooltip: { text: "Add pronunciation" },
    },
  ],
  [
    {
      kind: "break",
      icon: "i-heroicons-pause-circle",
      tooltip: { text: "Insert break" },
    },
  ],
  [
    {
      kind: "stressUp",
      icon: "i-heroicons-chevron-double-up",
      tooltip: { text: "Stress +1" },
    },
    {
      kind: "stressDown",
      icon: "i-heroicons-chevron-double-down",
      tooltip: { text: "Stress -1" },
    },
  ],
];

// ── Generate / Reset ───────────────────────────────────────────────────────

function handleGenerate() {
  const text = state.value.text.trim();
  if (!text) {
    dispatch({ type: "error", message: "Text is required." });
    return;
  }
  if (!state.value.selectedVoice) {
    dispatch({ type: "error", message: "Wait for the model voices to load before generating." });
    return;
  }
  if (!state.value.device) {
    dispatch({ type: "error", message: "Download and load the model before generating." });
    return;
  }
  generateAudio({
    type: "generate",
    text,
    voice: state.value.selectedVoice,
    secondaryVoice: state.value.secondaryVoice,
    secondaryRatio: state.value.secondaryRatio,
    language: state.value.language ?? undefined,
    speed: state.value.speed,
    pitchSemitones: state.value.pitchSemitones,
    sentencePauseMs: state.value.sentencePauseMs,
    newlinePauseMs: state.value.newlinePauseMs,
    paragraphPauseMs: state.value.paragraphPauseMs,
  });
}

function handleClearText() {
  dispatch({ type: "text", text: "" });
}

function handleResetControls() {
  cancelGeneration();
  dispatch({ type: "reset-controls" });
}

function handleEditorModeToggle(value: boolean) {
  editorViewMode.value = value ? "markup" : "plain";
}

/* v8 ignore start -- test-only exposure helpers are not part of runtime behavior. */
defineExpose({
  onEditorUpdate,
  customHandlers,
  toolbarItems,
  handleGenerate,
  handleClearText,
  handleResetControls,
  handleEditorModeToggle,
});
/* v8 ignore stop */
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
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pb-4 pt-1">
            <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-default ring ring-default">
              <div
                class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase tracking-wide"
              >
                <UIcon name="i-heroicons-musical-note" class="size-3.5 shrink-0" />
                Pronunciation
              </div>
              <p class="text-xs text-muted">Force a custom phonetic reading using IPA notation.</p>
              <div
                class="mt-1 rounded bg-elevated px-2.5 py-1.5 font-mono text-xs text-highlighted"
              >
                [word]<span class="text-muted">(</span>/phonemes/<span class="text-muted">)</span>
              </div>
              <p class="text-xs text-muted font-mono">[Kokoro](/kˈOʊkəɹOʊ/)</p>
              <p class="text-xs text-muted">
                Type <span class="font-mono text-highlighted">:</span> inside a pronunciation slot
                to open the IPA symbol menu.
              </p>
            </div>

            <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-default ring ring-default">
              <div
                class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase tracking-wide"
              >
                <UIcon name="i-heroicons-pause-circle" class="size-3.5 shrink-0" />
                Pause
              </div>
              <p class="text-xs text-muted">Insert a timed silence — value in milliseconds.</p>
              <div
                class="mt-1 rounded bg-elevated px-2.5 py-1.5 font-mono text-xs text-highlighted"
              >
                [label]<span class="text-muted">(</span>break:<span class="text-warning">500</span
                ><span class="text-muted">)</span>
              </div>
              <p class="text-xs text-muted font-mono">[pause here](break:500)</p>
            </div>

            <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-default ring ring-default">
              <div
                class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase tracking-wide"
              >
                <UIcon name="i-heroicons-chevron-double-up" class="size-3.5 shrink-0" />
                <UIcon name="i-heroicons-chevron-double-down" class="size-3.5 shrink-0" />
                Emphasis
              </div>
              <p class="text-xs text-muted">Reduce or increase how strongly a word is stressed.</p>
              <div
                class="mt-1 rounded bg-elevated px-2.5 py-1.5 font-mono text-xs text-highlighted"
              >
                [word]<span class="text-muted">(</span><span class="text-warning">-1</span
                ><span class="text-muted">)</span> &nbsp;·&nbsp; [word]<span class="text-muted"
                  >(</span
                ><span class="text-warning">+1</span><span class="text-muted">)</span>
              </div>
              <p class="text-xs text-muted font-mono">[softer](-1) &nbsp;·&nbsp; [stronger](+1)</p>
            </div>

            <div class="flex flex-col gap-1.5 p-3 rounded-lg bg-default ring ring-default">
              <div
                class="flex items-center gap-1.5 text-xs font-semibold text-warning uppercase tracking-wide"
              >
                <UIcon name="i-heroicons-bars-3" class="size-3.5 shrink-0" />
                Rhythm &amp; Tuning
              </div>
              <p class="text-xs text-muted">
                Shape natural pacing with punctuation or stress markers.
              </p>
              <div
                class="mt-1 rounded bg-elevated px-2.5 py-1.5 font-mono text-xs text-highlighted tracking-widest"
              >
                ; &nbsp; : &nbsp; , &nbsp; . &nbsp; ! &nbsp; ? &nbsp; ˈ &nbsp; ˌ
              </div>
              <p class="text-xs text-muted">Place inline to hint at pauses and intonation.</p>
            </div>
          </div>
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
        :model-value="editorHtmlValue"
        :is-markup-mode="editorViewMode === 'markup'"
        :handlers="customHandlers"
        :toolbar-items="toolbarItems"
        @update:model-value="onEditorUpdate"
        @toggle-mode="handleEditorModeToggle"
      />

      <div class="flex flex-wrap items-center justify-between gap-4 mt-2">
        <div class="flex items-center gap-4">
          <UButton v-if="state.canCancel" color="error" variant="outline" @click="cancelGeneration"
            >Cancel</UButton
          >
          <UButton
            :loading="state.activityPhase === 'generating'"
            :disabled="
              state.status === 'loading' ||
              state.status === 'generating' ||
              !state.selectedVoice ||
              !state.device
            "
            @click="handleGenerate"
            class="font-bold tracking-wide"
          >
            <template #leading>
              <UIcon
                v-if="state.activityPhase !== 'generating'"
                name="i-heroicons-sparkles"
                class="w-5 h-5"
              />
            </template>
            {{ state.activityPhase === "generating" ? "Generating..." : "Generate Audio" }}
          </UButton>
        </div>

        <UButton
          color="neutral"
          variant="outline"
          icon="i-heroicons-trash"
          :disabled="state.status === 'generating' || !state.text"
          @click="handleClearText"
        >
          Clear Text
        </UButton>
      </div>

      <UAlert
        v-if="state.error"
        id="error-text"
        :title="state.error"
        icon="i-heroicons-exclamation-triangle"
        color="error"
        variant="soft"
      />
    </div>
  </section>
</template>
