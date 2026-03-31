<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useTemplateRef, watch } from "vue";
import type { JSONContent } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/vue-3";
import type { EditorCustomHandlers } from "@nuxt/ui";
import { customHandlers, hasSelectedText, toolbarItems } from "../composables/useEditorHandlers";
import { playPronunciationPreview } from "../composables/useTtsWorker";
import { PauseToken, PronunciationToken, StressToken } from "../utils/editor-annotation-nodes";
import {
  PAUSE_TOKEN_NODE,
  PRONUNCIATION_TOKEN_NODE,
  STRESS_TOKEN_NODE,
  createPronunciationMarkup,
  editorDocToSpeechMarkup,
  isAnnotationNodeName,
  normalizePauseMs,
  normalizeStressLevel,
  speechMarkupToEditorDoc,
} from "../utils/editor-document";
import { getAllPhoneticChars } from "../utils/phonetic-chars";
import EditorToolbar from "./EditorToolbar.vue";

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:model-value": [value: string];
  "open-help": [];
}>();

type PronunciationEditorState = {
  type: typeof PRONUNCIATION_TOKEN_NODE;
  pos: number;
  top: number;
  left: number;
  label: string;
  phonemes: string;
  phoneticSearch: string;
};

type PauseEditorState = {
  type: typeof PAUSE_TOKEN_NODE;
  pos: number;
  top: number;
  left: number;
  label: string;
  pauseMs: number;
};

type StressEditorState = {
  type: typeof STRESS_TOKEN_NODE;
  pos: number;
  top: number;
  left: number;
  label: string;
  level: -2 | -1 | 1 | 2;
};

type TokenEditorState = PronunciationEditorState | PauseEditorState | StressEditorState;

const editorRef = useTemplateRef<{ editor: Editor | undefined }>("editorRef");
const panelRef = useTemplateRef<HTMLDivElement>("panelRef");
const phonemeInputRef = useTemplateRef<HTMLInputElement>("phonemeInputRef");

const editorDocValue = ref<JSONContent>(speechMarkupToEditorDoc(props.modelValue));
const pendingRawEchoText = ref<string | null>(null);
const pronunciationPreviewError = ref<string | null>(null);
const tokenEditor = ref<TokenEditorState | null>(null);
const phoneticCatalog = getAllPhoneticChars();

const pronunciationEditor = computed(() =>
  tokenEditor.value?.type === PRONUNCIATION_TOKEN_NODE ? tokenEditor.value : null,
);

const pauseEditor = computed(() =>
  tokenEditor.value?.type === PAUSE_TOKEN_NODE ? tokenEditor.value : null,
);

const stressEditor = computed(() =>
  tokenEditor.value?.type === STRESS_TOKEN_NODE ? tokenEditor.value : null,
);

const phoneticSuggestions = computed(() => {
  if (tokenEditor.value?.type !== PRONUNCIATION_TOKEN_NODE) {
    return phoneticCatalog.slice(0, 10);
  }

  const query = tokenEditor.value.phoneticSearch.trim().toLowerCase();
  if (!query) {
    return phoneticCatalog.slice(0, 10);
  }

  return phoneticCatalog
    .filter((item) =>
      [item.char, item.name, item.description, item.example ?? "", ...(item.aliases ?? [])].some(
        (value) => value.toLowerCase().includes(query),
      ),
    )
    .slice(0, 12);
});

async function previewMarkup(markup: string, label: string) {
  pronunciationPreviewError.value = null;

  try {
    await playPronunciationPreview(markup);
  } catch (error) {
    pronunciationPreviewError.value =
      error instanceof Error && error.message
        ? error.message
        : `Could not preview pronunciation for ${label}.`;
  }
}

async function previewSelectedText(editor: Editor) {
  const selectionContent = editor.state.selection.content().content.toJSON();
  const selectedMarkup = editorDocToSpeechMarkup({
    type: "doc",
    content: Array.isArray(selectionContent) ? selectionContent : [],
  }).trim();
  const { from, to } = editor.state.selection;
  const selectedLabel = editor.state.doc.textBetween(from, to).trim();

  if (!selectedMarkup) return;

  await previewMarkup(selectedMarkup, selectedLabel || "selection");
}

const mergedHandlers = computed<EditorCustomHandlers>(() => ({
  ...customHandlers,
  playSelection: {
    canExecute: (editor: Editor) => editor.isEditable && hasSelectedText(editor),
    execute: previewSelectedText,
    isActive: (editor: Editor) => editor.isEditable && hasSelectedText(editor),
    isDisabled: (editor: Editor) => !editor.isEditable || !hasSelectedText(editor),
  },
}));

watch(
  () => props.modelValue,
  (value) => {
    if (pendingRawEchoText.value !== null && value === pendingRawEchoText.value) {
      pendingRawEchoText.value = null;
      return;
    }

    pendingRawEchoText.value = null;
    const nextDoc = speechMarkupToEditorDoc(value);
    if (JSON.stringify(editorDocValue.value) === JSON.stringify(nextDoc)) {
      return;
    }

    editorDocValue.value = nextDoc;
    tokenEditor.value = null;
  },
);

function onEditorUpdate(nextDoc: JSONContent) {
  editorDocValue.value = nextDoc;
  const nextText = editorDocToSpeechMarkup(nextDoc);
  pendingRawEchoText.value = nextText;
  emit("update:model-value", nextText);
}

function handleSelectionUpdate({ editor }: { editor: Editor }) {
  if (hasSelectedText(editor)) {
    tokenEditor.value = null;
  }
}

function calculateTokenEditorPosition(target: HTMLElement | null) {
  const panel = panelRef.value;
  const token = target?.closest("[data-annotation-token]") as HTMLElement | null;
  if (!panel || !token) {
    return { top: 16, left: 16 };
  }

  const panelRect = panel.getBoundingClientRect();
  const tokenRect = token.getBoundingClientRect();
  const maxWidth = Math.min(panelRect.width - 24, 352);
  const left = Math.max(
    12,
    Math.min(tokenRect.left - panelRect.left, panelRect.width - maxWidth - 12),
  );
  const belowTop = tokenRect.bottom - panelRect.top + 10;
  const preferredAboveTop = tokenRect.top - panelRect.top - 220;

  return {
    top: preferredAboveTop > 12 ? preferredAboveTop : belowTop,
    left,
  };
}

function openTokenEditor(nodePos: number, node: ProseMirrorNode, target: HTMLElement | null) {
  const { top, left } = calculateTokenEditorPosition(target);

  if (node.type.name === PRONUNCIATION_TOKEN_NODE) {
    tokenEditor.value = {
      type: PRONUNCIATION_TOKEN_NODE,
      pos: nodePos,
      top,
      left,
      label: node.attrs.label ?? "",
      phonemes: node.attrs.phonemes ?? node.attrs.label ?? "",
      phoneticSearch: "",
    };
    nextTick(() => phonemeInputRef.value?.focus());
    return;
  }

  if (node.type.name === PAUSE_TOKEN_NODE) {
    tokenEditor.value = {
      type: PAUSE_TOKEN_NODE,
      pos: nodePos,
      top,
      left,
      label: node.attrs.label ?? "",
      pauseMs: normalizePauseMs(node.attrs.pauseMs),
    };
    return;
  }

  tokenEditor.value = {
    type: STRESS_TOKEN_NODE,
    pos: nodePos,
    top,
    left,
    label: node.attrs.label ?? "",
    level: normalizeStressLevel(node.attrs.level),
  };
}

function replaceTokenAtPosition(position: number, buildAttrs: () => Record<string, unknown>) {
  const editor = editorRef.value?.editor;
  if (!editor) return;

  const currentNode = editor.state.doc.nodeAt(position);
  if (!currentNode || !isAnnotationNodeName(currentNode.type.name)) {
    tokenEditor.value = null;
    return;
  }

  const schemaNode = editor.state.schema.nodes[currentNode.type.name];
  if (!schemaNode) return;

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.replaceWith(position, position + currentNode.nodeSize, schemaNode.create(buildAttrs()));
      return true;
    })
    .run();

  tokenEditor.value = null;
}

function saveTokenEditor() {
  if (!tokenEditor.value) return;
  const currentEditor = tokenEditor.value;

  if (currentEditor.type === PRONUNCIATION_TOKEN_NODE) {
    replaceTokenAtPosition(currentEditor.pos, () => ({
      label: currentEditor.label ?? "",
      phonemes: currentEditor.phonemes.trim() || currentEditor.label || "",
    }));
    return;
  }

  if (currentEditor.type === PAUSE_TOKEN_NODE) {
    replaceTokenAtPosition(currentEditor.pos, () => ({
      label: currentEditor.label ?? "",
      pauseMs: normalizePauseMs(currentEditor.pauseMs ?? 500),
    }));
    return;
  }

  replaceTokenAtPosition(currentEditor.pos, () => ({
    label: currentEditor.label ?? "",
    level: normalizeStressLevel(currentEditor.level ?? 1),
  }));
}

function removeToken() {
  if (!tokenEditor.value) return;

  const editor = editorRef.value?.editor;
  if (!editor) return;

  const currentNode = editor.state.doc.nodeAt(tokenEditor.value.pos);
  if (!currentNode) {
    tokenEditor.value = null;
    return;
  }

  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.delete(tokenEditor.value!.pos, tokenEditor.value!.pos + currentNode.nodeSize);
      return true;
    })
    .run();

  tokenEditor.value = null;
}

function insertPhoneticChar(char: string) {
  if (tokenEditor.value?.type !== PRONUNCIATION_TOKEN_NODE) return;

  const input = phonemeInputRef.value;
  const current = tokenEditor.value.phonemes;
  const selectionStart = input?.selectionStart ?? current.length;
  const selectionEnd = input?.selectionEnd ?? selectionStart;

  tokenEditor.value.phonemes =
    current.slice(0, selectionStart) + char + current.slice(selectionEnd);
  tokenEditor.value.phoneticSearch = "";

  nextTick(() => {
    if (!phonemeInputRef.value) return;
    const nextPosition = selectionStart + char.length;
    phonemeInputRef.value.focus();
    phonemeInputRef.value.setSelectionRange(nextPosition, nextPosition);
  });
}

function handleDocumentPointerDown(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest("[data-annotation-editor]") || target?.closest("[data-annotation-token]")) {
    return;
  }

  tokenEditor.value = null;
}

function handleDocumentKeydown(event: KeyboardEvent) {
  if (event.key === "Escape") {
    tokenEditor.value = null;
  }
}

watch(tokenEditor, (next, previous) => {
  if (!previous && next) {
    document.addEventListener("mousedown", handleDocumentPointerDown);
    document.addEventListener("keydown", handleDocumentKeydown);
  }

  if (previous && !next) {
    document.removeEventListener("mousedown", handleDocumentPointerDown);
    document.removeEventListener("keydown", handleDocumentKeydown);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("mousedown", handleDocumentPointerDown);
  document.removeEventListener("keydown", handleDocumentKeydown);
});

const editorProps = computed(() => ({
  handleClickOn: (
    _view: unknown,
    _pos: number,
    node: ProseMirrorNode,
    nodePos: number,
    event: MouseEvent,
    direct: boolean,
  ) => {
    if (!direct || !isAnnotationNodeName(node.type.name)) {
      return false;
    }

    const target = event.target instanceof HTMLElement ? event.target : null;

    if (
      node.type.name === PRONUNCIATION_TOKEN_NODE &&
      target?.closest("[data-token-action='play']")
    ) {
      void previewMarkup(
        createPronunciationMarkup({
          label: node.attrs.label ?? "",
          phonemes: node.attrs.phonemes ?? node.attrs.label ?? "",
        }),
        node.attrs.label ?? "selection",
      );
      return true;
    }

    openTokenEditor(nodePos, node, target);
    return true;
  },
}));

defineExpose({
  onEditorUpdate,
  handleSelectionUpdate,
  previewSelectedText,
  editorProps,
});
</script>

<template>
  <div ref="panelRef" class="relative h-full min-h-0">
    <div class="h-full min-h-0 overflow-hidden rounded-[24px] ring ring-default bg-default">
      <UEditor
        ref="editorRef"
        v-slot="{ editor }"
        :model-value="editorDocValue"
        content-type="json"
        :editable="true"
        :handlers="mergedHandlers"
        :extensions="[PronunciationToken, PauseToken, StressToken]"
        :starter-kit="{
          blockquote: false,
          codeBlock: false,
          bulletList: false,
          orderedList: false,
          heading: false,
          link: false,
        }"
        :image="false"
        :mention="false"
        :editor-props="editorProps"
        :placeholder="{
          placeholder:
            'Start with your script. Select words only when you want to shape how they sound.',
          mode: 'firstLine',
        }"
        :on-selection-update="handleSelectionUpdate"
        class="flex h-full min-h-0 flex-col bg-default"
        :ui="{
          content: 'editor-surface relative flex-1 min-h-0 overflow-y-auto px-3 pb-5 sm:px-5',
          base: 'editor-doc min-h-full border-0 bg-transparent px-0 py-4 text-[15px] text-toned shadow-none focus:outline-none',
        }"
        @update:model-value="onEditorUpdate"
      >
        <EditorToolbar :editor="editor" :items="toolbarItems" @open-help="emit('open-help')" />
      </UEditor>
    </div>

    <div
      v-if="tokenEditor"
      data-annotation-editor
      class="absolute z-30 w-[min(22rem,calc(100%-1.5rem))] rounded-2xl border border-default bg-elevated p-4 shadow-xl backdrop-blur"
      :style="{ top: `${tokenEditor.top}px`, left: `${tokenEditor.left}px` }"
    >
      <div class="flex items-start justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-highlighted">
            {{
              tokenEditor.type === PRONUNCIATION_TOKEN_NODE
                ? "Pronunciation"
                : tokenEditor.type === PAUSE_TOKEN_NODE
                  ? "Pause"
                  : "Emphasis"
            }}
          </p>
          <p class="mt-1 text-xs text-muted">
            Applies to <span class="font-medium text-highlighted">"{{ tokenEditor.label }}"</span>
          </p>
        </div>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          icon="i-heroicons-x-mark"
          aria-label="Close annotation editor"
          @click="tokenEditor = null"
        />
      </div>

      <div v-if="pronunciationEditor" class="mt-4 space-y-3">
        <label
          class="block text-xs font-medium uppercase tracking-wide text-muted"
          for="phoneme-input"
        >
          Phonemes
        </label>
        <div class="flex gap-2">
          <input
            id="phoneme-input"
            ref="phonemeInputRef"
            v-model="pronunciationEditor.phonemes"
            class="w-full rounded-xl border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none ring-0 focus:border-primary"
            placeholder="stjuːədʃɪp"
          />
          <UButton
            color="neutral"
            variant="soft"
            size="sm"
            icon="i-heroicons-speaker-wave"
            aria-label="Preview token pronunciation"
            @click="
              previewMarkup(
                createPronunciationMarkup({
                  label: pronunciationEditor.label,
                  phonemes: pronunciationEditor.phonemes.trim() || pronunciationEditor.label,
                }),
                pronunciationEditor.label,
              )
            "
          />
        </div>

        <div class="space-y-2 rounded-2xl border border-default/70 bg-default/70 p-3">
          <label
            class="block text-[11px] font-medium uppercase tracking-wide text-muted"
            for="ipa-search"
          >
            Quick IPA Insert
          </label>
          <input
            id="ipa-search"
            v-model="pronunciationEditor.phoneticSearch"
            class="w-full rounded-xl border border-default bg-default px-3 py-2 text-sm text-toned outline-none focus:border-primary"
            placeholder="Search schwa, stress, open e..."
          />
          <div class="max-h-40 space-y-1 overflow-y-auto pr-1">
            <button
              v-for="item in phoneticSuggestions"
              :key="`${item.char}-${item.name}`"
              type="button"
              class="flex w-full items-start gap-3 rounded-xl px-2.5 py-2 text-left transition hover:bg-primary/6"
              @click="insertPhoneticChar(item.char)"
            >
              <span class="text-base font-semibold text-highlighted">{{ item.char }}</span>
              <span class="min-w-0">
                <span class="block text-sm text-toned">{{ item.name }}</span>
                <span class="block text-xs text-muted">{{ item.description }}</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div v-else-if="pauseEditor" class="mt-4 space-y-3">
        <label
          class="block text-xs font-medium uppercase tracking-wide text-muted"
          for="pause-input"
        >
          Pause Length
        </label>
        <div class="flex items-center gap-3">
          <input
            id="pause-input"
            :value="String(pauseEditor.pauseMs)"
            type="number"
            min="0"
            step="50"
            class="w-full rounded-xl border border-default bg-default px-3 py-2 text-sm text-highlighted outline-none focus:border-primary"
            @input="
              pauseEditor.pauseMs = normalizePauseMs(
                Number.parseInt(($event.target as HTMLInputElement).value || '0', 10),
              )
            "
          />
          <span class="text-xs font-medium text-muted">ms</span>
        </div>
        <p class="text-xs leading-5 text-muted">
          Use a short pause for rhythm and a longer pause for intentional separation.
        </p>
      </div>

      <div v-else class="mt-4 space-y-3">
        <p class="text-xs font-medium uppercase tracking-wide text-muted">Stress Level</p>
        <div class="grid grid-cols-4 gap-2">
          <button
            v-for="level in [-2, -1, 1, 2]"
            :key="level"
            type="button"
            class="rounded-xl border px-3 py-2 text-sm font-medium transition"
            :class="
              stressEditor?.level === level
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-default bg-default text-toned hover:border-primary/50 hover:bg-primary/6'
            "
            @click="stressEditor && (stressEditor.level = normalizeStressLevel(level))"
          >
            {{ level > 0 ? `+${level}` : level }}
          </button>
        </div>
        <p class="text-xs leading-5 text-muted">
          Positive values add emphasis. Negative values soften the word.
        </p>
      </div>

      <div class="mt-4 flex items-center justify-between gap-3">
        <UButton
          color="error"
          variant="ghost"
          size="sm"
          icon="i-heroicons-trash"
          @click="removeToken"
        >
          Remove
        </UButton>
        <div class="flex items-center gap-2">
          <UButton color="neutral" variant="ghost" size="sm" @click="tokenEditor = null">
            Cancel
          </UButton>
          <UButton color="neutral" variant="solid" size="sm" @click="saveTokenEditor">
            Save
          </UButton>
        </div>
      </div>
    </div>
  </div>

  <p
    v-if="pronunciationPreviewError"
    class="mt-2 text-xs text-error"
    aria-live="polite"
    data-pronunciation-preview-error
  >
    {{ pronunciationPreviewError }}
  </p>
</template>
