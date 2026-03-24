<script setup lang="ts">
import { useTemplateRef, watch } from "vue";
import type { Editor } from "@tiptap/vue-3";
import type { EditorCustomHandlers, EditorSuggestionMenuItem, EditorToolbarItem } from "@nuxt/ui";
import { getPhoneticCharGroups } from "../utils/phonetic-chars";
import PhoneticSuggestionMenu from "./PhoneticSuggestionMenu.vue";

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

defineExpose({
  getEditorText,
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
    placeholder="Type something to generate speech..."
    class="w-full font-mono ring ring-muted rounded-lg bg-default/80"
    :ui="{
      content: 'bg-elevated rounded-b-lg p-2 border-t border-muted/80',
      base: 'min-h-72 sm:px-4 py-3 bg-default border border-muted rounded-md text-toned',
    }"
    @update:model-value="isMarkupMode && emit('update:model-value')"
  >
    <div class="flex flex-col sm:flex-row sm:items-center border-b border-muted/80 bg-default/90">
      <UEditorToolbar
        :editor="editor"
        :items="toolbarItems"
        layout="fixed"
        color="neutral"
        active-color="neutral"
        variant="ghost"
        active-variant="outline"
        class="min-w-0 px-2 py-1 overflow-x-auto flex-1 [&_[role=separator]]:bg-muted [&_[role=separator]]:opacity-100 [&_[class*='divide-x']>*+*]:border-muted/90 [&_.border-l]:border-muted/90"
      />
      <div
        class="flex items-center justify-end gap-2 border-t border-muted/80 px-2 py-2 text-toned sm:border-t-0"
        aria-label="Toggle markup view"
      >
        <span class="text-xs font-semibold select-none">Plain</span>
        <USwitch
          :model-value="isMarkupMode"
          @update:model-value="emit('toggle-mode', $event)"
          aria-label="Toggle markup view"
        />
        <span class="text-xs font-semibold select-none">Markup</span>
      </div>
    </div>
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
