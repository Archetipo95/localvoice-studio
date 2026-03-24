<script setup lang="ts">
import { computed, h, inject, nextTick, onBeforeUnmount, onMounted, toRef } from "vue";
import { usePhoneticEditorMenu } from "../composables/usePhoneticEditorMenu";

const props = withDefaults(
  defineProps<{
    editor?: any;
    items?: any[] | any[][];
    char?: string;
    pluginKey?: string;
    filterFields?: string[];
    limit?: number;
    options?: Record<string, any>;
    appendTo?: HTMLElement | (() => HTMLElement);
    suggestionOptions?: Record<string, any>;
  }>(),
  {
    char: ":",
    pluginKey: "phoneticSuggestionMenu",
  },
);

const handlers = inject<any>(
  "editorHandlers",
  computed(() => ({})),
);

function cls(base: string, extra?: string) {
  return extra ? `${base} ${extra}` : base;
}

const ui = computed(() => ({
  content: ({ class: c }: any = {}) =>
    cls("z-50 min-w-64 overflow-hidden rounded-md border border-muted bg-default shadow-lg", c),
  viewport: () => "max-h-80 overflow-y-auto p-1",
  group: () => "py-0.5",
  label: ({ class: c }: any = {}) =>
    cls("px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted", c),
  separator: ({ class: c }: any = {}) => cls("my-1 h-px bg-muted/90", c),
  item: ({ class: c, active }: any = {}) =>
    cls(
      `flex cursor-pointer select-none items-start gap-2 rounded-sm px-2 py-1.5 text-sm ${active ? "bg-elevated" : "hover:bg-elevated/80"}`,
      c,
    ),
  itemLeadingIcon: () => "mt-0.5 size-4 shrink-0 text-muted",
  itemWrapper: () => "flex min-w-0 flex-col",
  itemLabel: () => "font-medium leading-tight text-toned",
  itemDescription: () => "text-[11px] leading-tight text-muted",
}));

let menu: { plugin: any; destroy: () => void } | null = null;

onMounted(async () => {
  await nextTick();
  if (!props.editor || props.editor.isDestroyed) return;

  menu = usePhoneticEditorMenu({
    editor: props.editor,
    char: props.char,
    pluginKey: props.pluginKey,
    items: toRef(() => props.items),
    filterFields: props.filterFields,
    limit: props.limit,
    options: props.options,
    appendTo: props.appendTo,
    suggestion: props.suggestionOptions,
    ui,
    onSelect: (editor: any, range: any, item: any) => {
      if (item.type === "label" || item.type === "separator") return;
      editor.chain().focus().deleteRange(range).run();
      const handler = (handlers as any)?.value?.[item.kind];
      if (handler) {
        handler.execute(editor, item).run();
      }
    },
    renderItem: (item: any, styles: any) => {
      if (item.type === "label") {
        return [h("span", {}, item.label)];
      }
      return [
        item.icon
          ? h("span", { class: styles.value.itemLeadingIcon(), "aria-hidden": "true" }, "•")
          : null,
        h("span", { class: styles.value.itemWrapper() }, [
          h("span", { class: styles.value.itemLabel() }, item.label),
          item.description
            ? h("span", { class: styles.value.itemDescription() }, item.description)
            : null,
        ]),
      ];
    },
  });

  props.editor.registerPlugin(menu.plugin);
});

onBeforeUnmount(() => {
  if (menu) {
    menu.destroy();
    menu = null;
  }
  if (props.editor && !props.editor.isDestroyed) {
    props.editor.unregisterPlugin(props.pluginKey);
  }
});
</script>

<template>
  <div />
</template>
