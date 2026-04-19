<script setup lang="ts">
import { computed } from "vue";
import { marked } from "marked";

const props = defineProps<{
  value: string;
}>();

marked.setOptions({
  breaks: true,
  gfm: true,
});

const renderedMarkdown = computed(() => marked.parse(props.value || ""));
</script>

<template>
  <div
    class="release-markdown max-w-none text-[0.96rem] leading-7 text-toned prose-headings:text-highlighted prose-strong:text-highlighted prose-a:text-primary hover:prose-a:text-primary/80"
    v-html="renderedMarkdown"
  />
</template>
