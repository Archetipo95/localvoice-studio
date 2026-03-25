<script setup lang="ts">
import { useTemplateRef, watch } from "vue";
import type { Editor } from "@tiptap/vue-3";
import type { EditorCustomHandlers, EditorSuggestionMenuItem, EditorToolbarItem } from "@nuxt/ui";
import { getPhoneticCharGroups } from "../utils/phonetic-chars";
import PhoneticSuggestionMenu from "./PhoneticSuggestionMenu.vue";
import EditorToolbar from "./EditorToolbar.vue";

const props = defineProps<{
  modelValue: string;
  isMarkupMode: boolean;
  handlers: EditorCustomHandlers;
  toolbarItems: EditorToolbarItem<any>[][];
}>();

const emit = defineEmits<{
  "update:model-value": [];
  "toggle-mode": [value: boolean];
}>();

const editorRef = useTemplateRef<{ editor: Editor | undefined }>("editorRef");
const phoneticMenuItems = getPhoneticCharGroups() satisfies EditorSuggestionMenuItem[][];
const appendToBody = typeof document !== "undefined" ? () => document.body : undefined;

watch(
  () => props.modelValue,
  (value) => {
    const editor = editorRef.value?.editor;
    if (!editor?.commands?.setContent) return;
    // In live markup editing, the editor is the source of truth.
    // Re-applying parent HTML on every transaction can cause runaway resyncs.
    if (props.isMarkupMode) return;
    if (editor.getHTML() === value) return;
    editor.commands.setContent(value, { emitUpdate: false });
  },
);

watch(
  () => props.isMarkupMode,
  (isMarkupMode) => {
    const editor = editorRef.value?.editor;
    if (!editor?.setEditable) return;
    editor.setEditable(isMarkupMode);
    if (!isMarkupMode && editor.isFocused) {
      editor.commands.blur();
    }
  },
  { immediate: true },
);

function getEditorText() {
  return editorRef.value?.editor?.getText({ blockSeparator: "\n" }) ?? "";
}

function clearEditorText() {
  const editor = editorRef.value?.editor;
  if (!editor?.commands) return;

  if (editor.commands.setContent) {
    editor.commands.setContent("", { emitUpdate: false });
  } else if (editor.commands.clearContent) {
    editor.commands.clearContent(false);
  }

  if (editor.commands.focus) {
    editor.commands.focus("start");
  }
}

defineExpose({
  getEditorText,
  clearEditorText,
});
</script>

<template>
  <div
    v-if="!isMarkupMode"
    class="flex items-start gap-2 rounded-lg ring ring-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning"
  >
    <UIcon name="i-heroicons-exclamation-triangle" class="mt-0.5 size-4 shrink-0" />
    <p>Plain mode is preview-only. Switch to Markup to edit.</p>
  </div>

  <UEditor
    ref="editorRef"
    v-slot="{ editor }"
    :model-value="modelValue"
    content-type="html"
    :editable="isMarkupMode"
    :handlers="handlers"
    :starter-kit="{
      blockquote: false,
      codeBlock: false,
      bulletList: false,
      orderedList: false,
      heading: false,
      link: { openOnClick: false },
    }"
    :image="false"
    :mention="false"
    :placeholder="{ placeholder: 'Type something to generate speech...', mode: 'firstLine' }"
    class="w-full max-h-[72vh] overflow-hidden font-mono ring ring-muted rounded-lg bg-default/80"
    :ui="{
      content:
        'bg-elevated rounded-b-lg p-2 border-t border-muted/80 flex-1 min-h-0 overflow-y-auto',
      base: 'min-h-72 h-full sm:px-4 py-3 bg-default border border-muted rounded-md text-toned flex flex-col overflow-hidden',
    }"
    @update:model-value="isMarkupMode && emit('update:model-value')"
  >
    <EditorToolbar
      :editor="editor"
      :items="toolbarItems"
      :is-markup-mode="isMarkupMode"
      @toggle-mode="emit('toggle-mode', $event)"
    />
    <div
      v-if="isMarkupMode"
      class="flex items-center gap-3 border-b border-muted/80 px-3 py-2 text-[11px] text-toned"
    >
      <span class="font-semibold">To use IPA symbols</span>
      <span class="text-highlighted">write `:` then search, Enter to insert</span>
    </div>
    <PhoneticSuggestionMenu
      v-if="isMarkupMode"
      :editor="editor"
      :items="phoneticMenuItems"
      char=":"
      plugin-key="phoneticSuggestionMenu"
      :filter-fields="['label', 'description', 'char', 'aliases', 'example']"
      :append-to="appendToBody"
      :suggestion-options="{ allowedPrefixes: null }"
      size="md"
    />
  </UEditor>
</template>
