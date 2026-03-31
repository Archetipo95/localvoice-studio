<script setup lang="ts">
import type { Editor } from "@tiptap/vue-3";
import type { EditorToolbarItem } from "@nuxt/ui";
import type { ScriptEditorToolbarHandlers } from "../composables/useEditorHandlers";

defineProps<{
  editor: Editor | undefined;
  items: EditorToolbarItem<ScriptEditorToolbarHandlers>[][];
}>();

const emit = defineEmits<{
  "open-help": [];
}>();
</script>

<template>
  <div class="flex flex-col gap-2 px-3 py-3 lg:flex-row lg:items-center lg:gap-3">
    <UEditorToolbar
      :editor="editor"
      :items="items"
      layout="fixed"
      color="neutral"
      active-color="neutral"
      variant="ghost"
      active-variant="outline"
      class="min-w-0 overflow-x-auto px-0 py-0 lg:flex-none"
    />
    <div
      class="flex items-center justify-between gap-2 text-toned sm:justify-end lg:ml-auto"
      aria-label="Editor utilities"
    >
      <UButton
        color="neutral"
        variant="ghost"
        size="sm"
        icon="i-heroicons-question-mark-circle"
        trailing-icon=""
        class="rounded-lg px-2.5"
        aria-label="Open markup help"
        @click="emit('open-help')"
      >
        Help
      </UButton>
    </div>
  </div>
</template>
