<script setup lang="ts">
import type { Editor } from "@tiptap/vue-3";
import type { EditorToolbarItem } from "@nuxt/ui";

defineProps<{
  editor: Editor | undefined;
  items: EditorToolbarItem<any>[][];
  isMarkupMode: boolean;
}>();

const emit = defineEmits<{
  "toggle-mode": [value: boolean];
}>();
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center border-b border-muted/80 bg-default/90">
    <UEditorToolbar
      :editor="editor"
      :items="items"
      layout="fixed"
      color="neutral"
      active-color="neutral"
      variant="ghost"
      active-variant="outline"
      class="min-w-0 px-2 py-1 overflow-x-auto flex-1"
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
</template>
